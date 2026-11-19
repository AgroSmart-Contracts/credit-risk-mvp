import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { ResearchFinding } from "../../data/pre-harvest/files";
import { DECISION_TEXT, type DecisionEntry } from "../../lib/pre-harvest/decisions";
import { ACTOR_TEXT, financialImpact, type Actor } from "../../lib/pre-harvest/finance";
import { formatDate, formatUsd, tb } from "../../lib/pre-harvest/i18n";
import { PANEL_LABELS, type CampaignSimulation } from "../../lib/pre-harvest/timeline";
import type { Bilingual, Lang, PanelId, PreHarvestDeal, Severity } from "../../lib/pre-harvest/types";
import { Card, SectionTitle } from "./ui";

const TX = {
  title: { en: "What happened on this loan", es: "Qué pasó en este préstamo" },
  hint: {
    en: "Who did what, and when: TruMarket's updates on the parcel, the bank's and the analyst's decisions, the buyer and the insurer, and dated public reports for the same area. Open any source to check it.",
    es: "Quién hizo qué y cuándo: las actualizaciones de TruMarket sobre el predio, las decisiones del banco y del analista, el comprador y la aseguradora, y reportes públicos fechados de la misma zona. Abra cualquier fuente para verificarla.",
  },
  all: { en: "All", es: "Todo" },
  trumarket: { en: "TruMarket", es: "TruMarket" },
  bank: { en: "Bank and parties", es: "Banco y partes" },
  public: { en: "Public sources", es: "Fuentes públicas" },
  before: { en: "Before the application", es: "Antes de la solicitud" },
  during: { en: "During the financed period", es: "Durante el periodo financiado" },
  after: { en: "After harvest", es: "Después de la cosecha" },
  forThisFile: { en: "For this loan", es: "Para este préstamo" },
  watch: { en: "Watch", es: "Vigilar" },
  high: { en: "High risk", es: "Riesgo alto" },
};

type Item =
  | { kind: "finding"; date: string; actor: Actor; panel: PanelId; f: ResearchFinding }
  | { kind: "alert"; date: string; actor: Actor; panel: PanelId; severity: Exclude<Severity, "green">; text: Bilingual; forLoan: Bilingual }
  | { kind: "milestone"; date: string; actor: Actor; text: Bilingual }
  | { kind: "decision"; date: string; actor: Actor; who: string; text: Bilingual; note: string };

const ACTOR_CLASS: Record<Actor, string> = {
  trumarket: "bg-tm-primary text-white",
  bank: "bg-tm-neutral text-tm-black",
  analyst: "bg-tm-neutral text-tm-black",
  buyer: "bg-tm-neutral text-tm-black",
  insurer: "bg-tm-neutral text-tm-black",
  public: "border border-tm-border text-tm-text-light",
};

const DOT_CLASS: Record<Item["kind"], string> = {
  finding: "bg-tm-text-muted",
  alert: "bg-tm-accent",
  milestone: "bg-tm-black",
  decision: "bg-tm-primary",
};

function milestones(sim: CampaignSimulation): Item[] {
  const last = sim.frames.at(-1)!;
  const out: Item[] = [];
  for (const tr of last.tranches) {
    if (tr.status === "released" && tr.releasedOn) {
      // Monitoring steps weekly: within a week of the due date counts as on time.
      const late = (Date.parse(tr.releasedOn) - Date.parse(tr.dueDate)) / 86_400_000 > 7;
      out.push({
        kind: "milestone",
        actor: "bank",
        date: tr.releasedOn,
        text: {
          en: `Released tranche ${tr.pct}% to the grower (${formatUsd(tr.amountUsd, "en")})${late ? `, after holding it since ${formatDate(tr.dueDate, "en")}` : ""}`,
          es: `Liberó el tramo ${tr.pct}% al productor (${formatUsd(tr.amountUsd, "es")})${late ? `, tras retenerlo desde el ${formatDate(tr.dueDate, "es")}` : ""}`,
        },
      });
    } else if (tr.status === "held" || tr.status === "stopped") {
      out.push({
        kind: "milestone",
        actor: "bank",
        date: tr.dueDate,
        text: {
          en: `${tr.status === "held" ? "Held" : "Stopped"} tranche ${tr.pct}% (${formatUsd(tr.amountUsd, "en")})`,
          es: `${tr.status === "held" ? "Retuvo" : "Detuvo"} el tramo ${tr.pct}% (${formatUsd(tr.amountUsd, "es")})`,
        },
      });
    }
  }
  const tk = sim.takeout;
  if (tk.poSignedDate) {
    out.push({
      kind: "milestone",
      actor: "buyer",
      date: tk.poSignedDate,
      text: {
        en: `Signed the purchase order: ${(tk.poVolumeKg / 1000).toFixed(1)} t at USD ${tk.poPriceUsdPerKg.toFixed(2)}/kg (${tk.buyerCountry})`,
        es: `Firmó la orden de compra: ${(tk.poVolumeKg / 1000).toFixed(1)} t a USD ${tk.poPriceUsdPerKg.toFixed(2)}/kg (${tk.buyerCountry})`,
      },
    });
    if (tk.coface !== "pending") {
      out.push({
        kind: "milestone",
        actor: "insurer",
        date: tk.poSignedDate,
        text: {
          en: `${tk.coface === "approved" ? "Approved" : tk.coface === "reduced" ? "Reduced" : "Declined"} cover on the buyer (${tk.cofaceCoveragePct}%)`,
          es: `${tk.coface === "approved" ? "Aprobó" : tk.coface === "reduced" ? "Redujo" : "Rechazó"} la cobertura del comprador (${tk.cofaceCoveragePct}%)`,
        },
      });
    }
  }
  return out;
}

export function ResearchTimeline({
  deal,
  sim,
  findings,
  decisions = [],
  lang,
  applicationDate,
  upTo,
}: {
  deal: PreHarvestDeal;
  sim: CampaignSimulation;
  findings: ResearchFinding[];
  decisions?: DecisionEntry[];
  lang: Lang;
  applicationDate?: string;
  /** Replay cut-off: only what was known (or published) by this date. */
  upTo?: string;
}) {
  const [filter, setFilter] = useState<"all" | "trumarket" | "bank" | "public">("all");
  const items: Item[] = [
    ...findings.map((f): Item => ({ kind: "finding", actor: "public", date: f.date, panel: f.panel, f })),
    ...sim.alerts.map(
      (a): Item => ({
        kind: "alert",
        actor: "trumarket",
        date: a.date,
        panel: a.panel,
        severity: a.severity,
        text: a.message,
        forLoan: (() => {
          const fi = financialImpact(deal, sim, a);
          return {
            en: [fi.headline.en, ...fi.details.map((d) => d.en)].join(" · "),
            es: [fi.headline.es, ...fi.details.map((d) => d.es)].join(" · "),
          };
        })(),
      }),
    ),
    ...milestones(sim),
    {
      kind: "milestone" as const,
      actor: "bank" as const,
      date: deal.approvalDate,
      text: {
        en: `Approved the loan: ${formatUsd(deal.envelopeUsd, "en")} over ${deal.tenorDays} days (score ${sim.origination.composite} · ${sim.origination.tier})`,
        es: `Aprobó el préstamo: ${formatUsd(deal.envelopeUsd, "es")} a ${deal.tenorDays} días (score ${sim.origination.composite} · ${sim.origination.tier})`,
      },
    },
    ...decisions.map(
      (d): Item => ({
        kind: "decision",
        actor: "analyst",
        date: d.at.slice(0, 10),
        who: d.analyst,
        text: {
          en: `${DECISION_TEXT[d.kind].en} · ${d.subject}${d.amountUsd !== null ? ` · ${formatUsd(d.amountUsd, "en")}` : ""}`,
          es: `${DECISION_TEXT[d.kind].es} · ${d.subject}${d.amountUsd !== null ? ` · ${formatUsd(d.amountUsd, "es")}` : ""}`,
        },
        note: d.note,
      }),
    ),
  ]
    .filter((i) => i.kind === "decision" || !upTo || i.date <= upTo)
    .filter((i) =>
      filter === "all" ? true : filter === "trumarket" ? i.actor === "trumarket" : filter === "public" ? i.actor === "public" : i.actor !== "trumarket" && i.actor !== "public",
    )
    .sort((a, b) => a.date.localeCompare(b.date) || (a.kind === "milestone" ? 1 : -1));

  const start = applicationDate ?? deal.approvalDate;
  const groups: Array<[Bilingual, Item[]]> = [
    [TX.before, items.filter((i) => i.date < start)],
    [TX.during, items.filter((i) => i.date >= start && i.date <= deal.m3Date)],
    [TX.after, items.filter((i) => i.date > deal.m3Date)],
  ];

  const actorName = (i: Item) => (i.kind === "decision" ? `${tb(ACTOR_TEXT.analyst, lang)} · ${i.who}` : i.kind === "finding" ? i.f.source : tb(ACTOR_TEXT[i.actor], lang));

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle title={tb(TX.title, lang)} hint={tb(TX.hint, lang)} />
        <div className="inline-flex rounded-lg border border-tm-border p-0.5 text-xs font-medium" role="group">
          {(["all", "trumarket", "bank", "public"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={filter === k}
              onClick={() => setFilter(k)}
              className={`rounded-md px-2.5 py-1 ${filter === k ? "bg-tm-primary text-white" : "text-tm-text-light hover:text-tm-black"}`}
            >
              {tb(TX[k], lang)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {groups
          .filter(([, list]) => list.length)
          .map(([label, list]) => (
            <section key={label.en}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-tm-text-muted">{tb(label, lang)}</p>
              <ol className="relative space-y-4 border-l border-tm-border pl-5">
                {list.map((i, n) => (
                  <li key={`${i.kind}-${i.date}-${n}`} className="relative">
                    <span
                      className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-tm-surface ${
                        i.kind === "alert" && i.severity === "red" ? "bg-tm-danger" : DOT_CLASS[i.kind]
                      }`}
                    />
                    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-tm-text-muted">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${ACTOR_CLASS[i.actor]}`}>{actorName(i)}</span>
                      {formatDate(i.date, lang)}
                      {(i.kind === "alert" || i.kind === "finding") && <> · {tb(PANEL_LABELS[i.panel], lang)}</>}
                      {i.kind === "alert" && (
                        <span className={i.severity === "red" ? "font-semibold text-tm-danger-dark" : "font-semibold text-tm-accent-dark"}>
                          · {tb(i.severity === "red" ? TX.high : TX.watch, lang)}
                        </span>
                      )}
                    </p>
                    {i.kind === "finding" ? (
                      <div className="mt-1">
                        <a href={i.f.url} target="_blank" rel="noreferrer" className="group inline-flex items-start gap-1 font-medium text-tm-black hover:underline">
                          <span>{i.f.headline}</span>
                          <ExternalLink className="mt-1 h-3 w-3 shrink-0 text-tm-text-muted group-hover:text-tm-black" />
                        </a>
                        <p className="mt-0.5 text-sm text-tm-text-light">{tb(i.f.summary, lang)}</p>
                        <p className="mt-1 text-sm text-tm-black">
                          <span className="font-semibold">{tb(TX.forThisFile, lang)}:</span> {tb(i.f.relevance, lang)}
                        </p>
                      </div>
                    ) : i.kind === "alert" ? (
                      <div className="mt-1">
                        <p className="text-sm text-tm-black">{tb(i.text, lang)}</p>
                        <p className="mt-0.5 text-sm text-tm-text-light">
                          <span className="font-semibold text-tm-black">{tb(TX.forThisFile, lang)}:</span> {tb(i.forLoan, lang)}
                        </p>
                      </div>
                    ) : i.kind === "decision" ? (
                      <p className="mt-1 text-sm font-medium text-tm-black">
                        {tb(i.text, lang)}
                        {i.note && <span className="font-normal text-tm-text-light"> · “{i.note}”</span>}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm font-medium text-tm-black">{tb(i.text, lang)}</p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          ))}
      </div>
    </Card>
  );
}
