/**
 * Risk details: the layer behind the score. Why the score is where it is, the
 * counterparty checks and the loan's cash flows, then the
 * technical monitoring (satellite, crop, weather, market, repayment).
 */
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, XCircle } from "lucide-react";
import { moneyPosition } from "../../lib/pre-harvest/finance";
import { formatDate, formatUsd, tb } from "../../lib/pre-harvest/i18n";
import { addDays } from "../../lib/pre-harvest/monitoring";
import type { CampaignSimulation } from "../../lib/pre-harvest/timeline";
import type { Bilingual, Lang, NdviPoint, PreHarvestAssessment, PreHarvestDeal, TimelineFrame } from "../../lib/pre-harvest/types";
import type { LiveCheck } from "./live";
import { MonitoringPanels } from "./MonitoringPanels";
import { Card, SectionTitle } from "./ui";

const L = (en: string, es: string): Bilingual => ({ en, es });
const TX = {
  scoreFrom: L("Score at approval", "Score a la aprobación"),
  whySub: L("Only what changed since approval, with its effect on the score", "Solo lo que cambió desde la aprobación, con su efecto en el score"),
  noChange: L("Nothing has changed since approval.", "Nada ha cambiado desde la aprobación."),
  total: L("Change since approval", "Cambio desde la aprobación"),
  ensoNote: L(
    "The approval score already priced the El Niño outlook at that date; monitoring adds what has been observed since, so the two are not the same risk counted twice.",
    "El score de aprobación ya incorporó el pronóstico de El Niño a esa fecha; el monitoreo agrega lo observado desde entonces, por lo que no es el mismo riesgo contado dos veces.",
  ),
  checkedToday: L("checked today", "revisado hoy"),
  direction: L("Direction", "Dirección"),
  exposureCol: L("Exposure after", "Exposición después"),
  next: L("Next", "Siguiente"),
  full: L("Full breakdown in Credit analysis", "Detalle completo en Análisis de crédito"),
  counterparty: L("Counterparty checks", "Controles de contraparte"),
  counterpartySub: L("Registries, credit bureau and buyer cover behind this loan", "Registros, central de riesgos y cobertura del comprador de este préstamo"),
  checked: L("checked", "revisado"),
  rechecked: L("re-checked", "revisado"),
  cash: L("Cash flows", "Flujos de caja"),
  cashSub: L("Every movement of money on this loan, done and planned", "Cada movimiento de dinero del préstamo, realizado y previsto"),
  date: L("Date", "Fecha"),
  flow: L("Movement", "Movimiento"),
  amount: L("Amount", "Monto"),
  status: L("Status", "Estado"),
  done: L("Done", "Realizado"),
  planned: L("Planned", "Previsto"),
  held: L("Held", "Retenido"),
  stopped: L("Stopped", "Detenido"),
  technical: L("Technical monitoring", "Monitoreo técnico"),
};


const DIM_NAME: Record<string, Bilingual> = {
  production: L("Production", "Producción"),
  operator: L("Operator", "Operador"),
  structure: L("Structure", "Estructura"),
  counterparty: L("Buyer", "Comprador"),
};

/** What moved the score since approval: only the lines that changed, each with its effect on the composite. */
function ScoreDrivers({ current, origination, lang, onCredit }: { current: PreHarvestAssessment; origination: PreHarvestAssessment; lang: Lang; onCredit: () => void }) {
  const changes = current.dimensions
    .filter((d) => !d.dormant)
    .flatMap((d) => {
      const before = new Map((origination.dimensions.find((o) => o.key === d.key)?.lines ?? []).map((l) => [l.label.en, l.points]));
      return d.lines
        .map((l) => ({ line: l, dim: d, diff: l.points - (before.get(l.label.en) ?? 0) }))
        .filter((x) => x.diff !== 0);
    })
    .sort((a, b) => a.diff * a.dim.weight - b.diff * b.dim.weight);
  const delta = current.composite - origination.composite;
  return (
    <Card>
      <SectionTitle
        title={`${tb(TX.scoreFrom, lang)} ${origination.composite} · ${origination.tier} → ${current.composite} · ${current.tier}`}
        hint={tb(TX.whySub, lang)}
      />
      {changes.length === 0 ? (
        <p className="text-sm text-tm-text-light">{tb(TX.noChange, lang)}</p>
      ) : (
        <ul className="space-y-2.5">
          {changes.map(({ line, dim, diff }, i) => {
            const effect = Math.round(diff * dim.weight * 10) / 10;
            return (
              <li key={i} className="flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-tm-black">{tb(line.label, lang).replace(/^(Monitoring|Monitoreo): /, "")}</span>
                  <span className="text-tm-text-light"> · {tb(line.value, lang)}</span>
                  <span className="block text-xs text-tm-text-muted">
                    {diff > 0 ? "+" : ""}
                    {diff} {lang === "es" ? "pts en" : "pts in"} {tb(DIM_NAME[dim.key], lang)} × {Math.round(dim.weight * 100)}%
                  </span>
                </span>
                <span className={`shrink-0 font-semibold tabular-nums ${effect < 0 ? "text-tm-danger-dark" : "text-tm-primary-dark"}`}>
                  {effect > 0 ? "+" : ""}
                  {effect}
                </span>
              </li>
            );
          })}
          <li className="flex justify-between border-t border-tm-border pt-2 text-sm font-semibold text-tm-black">
            <span>{tb(TX.total, lang)}</span>
            <span className="tabular-nums">
              {delta > 0 ? "+" : ""}
              {delta}
            </span>
          </li>
        </ul>
      )}
      <p className="mt-3 text-xs text-tm-text-light">{tb(TX.ensoNote, lang)}</p>
      <button type="button" onClick={onCredit} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-tm-black hover:underline">
        {tb(TX.full, lang)} <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </Card>
  );
}

type CheckState = "ok" | "watch" | "pending" | "fail";

function StateIcon({ state }: { state: CheckState }) {
  if (state === "ok") return <CheckCircle2 className="h-4 w-4 shrink-0 text-tm-primary" />;
  if (state === "fail") return <XCircle className="h-4 w-4 shrink-0 text-tm-danger-dark" />;
  if (state === "watch") return <AlertTriangle className="h-4 w-4 shrink-0 text-tm-accent-dark" />;
  return <Clock className="h-4 w-4 shrink-0 text-tm-text-muted" />;
}

function CounterpartyChecks({ deal, sim, checks, lang }: { deal: PreHarvestDeal; sim: CampaignSimulation; checks: LiveCheck[]; lang: Lang }) {
  const c = deal.checks;
  const tk = sim.takeout;
  const today = checks.length > 0;
  const es = lang === "es";
  const lien = (n: number) => `${n} ${es ? (n === 1 ? "carga" : "cargas") : n === 1 ? "lien" : "liens"}`;
  const groups: Array<[Bilingual, Array<{ name: string; detail: string; state: CheckState; when: string }>]> = [
    [
      L("Registry", "Registros"),
      [
        { name: "SUNAT · RUC", detail: `${c.ruc.active ? (es ? "activo" : "active") : es ? "inactivo" : "inactive"} · ${c.ruc.habido ? "habido" : "no habido"}`, state: c.ruc.active && c.ruc.habido ? "ok" : "fail", when: deal.checksDate },
        {
          name: "SUNARP",
          detail: `${c.sunarp.tenure === "owned" ? (es ? "propio" : "owned") : c.sunarp.tenure === "leased" ? (es ? "arrendado" : "leased") : "informal"} · ${lien(c.sunarp.liens)}`,
          state: c.sunarp.tenure === "informal" ? "fail" : c.sunarp.liens > 0 ? "watch" : "ok",
          when: deal.checksDate,
        },
        { name: "ANA", detail: `${c.ana.licenceId} · ${c.ana.licenceValid ? (es ? "vigente" : "valid") : es ? "no vigente" : "invalid"}`, state: c.ana.licenceValid ? "ok" : "fail", when: deal.checksDate },
        { name: "SENASA", detail: tb(c.senasa.note, lang), state: c.senasa.zoneStatus === "quarantine" ? "fail" : "ok", when: deal.checksDate },
        { name: es ? "Inspección en campo" : "Field inspection", detail: tb(c.inspection.note, lang), state: c.inspection.soilOk && c.inspection.sanitationOk ? "ok" : "watch", when: deal.inspectionDate },
      ],
    ],
    [
      L("Credit", "Crédito"),
      [
        {
          name: `${c.credit.bureau} · SBS`,
          detail: `${c.credit.rating} · ${c.credit.protestedDebts} ${es ? "protestos" : "protested debts"}`,
          state: c.credit.rating === "Normal" && c.credit.protestedDebts === 0 ? "ok" : c.credit.rating === "CPP" ? "watch" : "fail",
          when: deal.checksDate,
        },
      ],
    ],
    [
      L("Buyer and insurance", "Comprador y seguro"),
      [
        {
          name: `Coface · ${es ? "comprador" : "buyer"} (${tk.buyerCountry})`,
          detail: `${{ approved: es ? "aprobada" : "approved", reduced: es ? "reducida" : "reduced", declined: es ? "rechazada" : "declined", pending: es ? "pendiente" : "pending" }[tk.coface]} · ${tk.cofaceCoveragePct}%`,
          state: tk.coface === "approved" ? "ok" : tk.coface === "declined" ? "fail" : tk.coface === "reduced" ? "watch" : "pending",
          when: tk.poSignedDate ?? deal.checksDate,
        },
        {
          name: es ? "Seguros (3 capas)" : "Insurance (3 layers)",
          detail: [c.insurance.catastrophic && "SAC", c.insurance.commercial && (es ? "comercial" : "commercial"), c.insurance.parametric && (es ? "paramétrico" : "parametric")].filter(Boolean).join(" · ") || (es ? "ninguno" : "none"),
          state: c.insurance.catastrophic || c.insurance.commercial || c.insurance.parametric ? "ok" : "watch",
          when: deal.checksDate,
        },
      ],
    ],
  ];
  return (
    <Card>
      <SectionTitle title={tb(TX.counterparty, lang)} hint={tb(TX.counterpartySub, lang)} />
      <div className="space-y-3">
        {groups.map(([title, rows]) => (
          <div key={title.en}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-tm-text-muted">{tb(title, lang)}</p>
            <ul className="divide-y divide-tm-border">
              {rows.map((r) => (
                <li key={r.name} className="flex items-start gap-2.5 py-2 text-sm">
                  <StateIcon state={r.state} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-tm-black">{r.name}</p>
                    <p className="text-xs text-tm-text-light">{r.detail}</p>
                  </div>
                  <span className="shrink-0 text-right text-[11px] leading-snug text-tm-text-muted">
                    {formatDate(r.when, lang)}
                    {today && <span className="block">{tb(TX.checkedToday, lang)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CashFlows({ deal, sim, frame, lang }: { deal: PreHarvestDeal; sim: CampaignSimulation; frame: TimelineFrame; lang: Lang }) {
  const m = moneyPosition(deal, sim, frame);
  const tk = sim.takeout;
  const poValue = tk.poVolumeKg * tk.poPriceUsdPerKg;
  const advance = tk.coface === "declined" ? 0 : poValue * (tk.cofaceCoveragePct / 100) * (tk.advanceRatePct / 100);
  const stateText: Record<string, Bilingual> = { done: TX.done, planned: TX.planned, held: TX.held, stopped: TX.stopped };
  type Row = { date: string; flow: Bilingual; note?: Bilingual; direction: Bilingual; principal: number; amount: number; state: "done" | "planned" | "held" | "stopped" };
  const repaid = frame.m3Reached && tk.poSignedDate !== null && tk.poSignedDate <= frame.date && frame.date >= addDays(m.maturityDate, -7);
  const rows: Row[] = [
    ...frame.tranches.map(
      (t): Row => ({
        date: t.releasedOn ?? t.dueDate,
        flow: { en: `Tranche ${t.pct}% · ${t.label.en}`, es: `Tramo ${t.pct}% · ${t.label.es}` },
        direction: L("Bank → Grower", "Banco → Productor"),
        principal: t.status === "stopped" ? 0 : t.amountUsd,
        amount: -t.amountUsd,
        state: t.status === "released" ? "done" : t.status === "pending" ? "planned" : t.status,
      }),
    ),
    {
      date: m.maturityDate,
      flow: L("Repayment: principal + interest", "Repago: capital + intereses"),
      note: {
        en: `Funded by the post-harvest advance on the buyer's PO: ${formatUsd(Math.round(advance), "en")} (${tk.advanceRatePct}% × Coface ${tk.cofaceCoveragePct}% × PO ${formatUsd(Math.round(poValue), "en")})`,
        es: `Financiado con el adelanto post-cosecha sobre la OC: ${formatUsd(Math.round(advance), "es")} (${tk.advanceRatePct}% × Coface ${tk.cofaceCoveragePct}% × OC ${formatUsd(Math.round(poValue), "es")})`,
      },
      direction: L("Grower → Bank", "Productor → Banco"),
      principal: -Infinity,
      amount: m.amountDueUsd,
      state: repaid ? "done" : "planned",
    },
  ];
  rows.sort((a, b) => a.date.localeCompare(b.date));
  let running = 0;
  const withExposure = rows.map((r) => {
    running = r.principal === -Infinity ? 0 : running + r.principal;
    return { ...r, exposure: running };
  });
  const nextIdx = withExposure.findIndex((r) => r.state !== "done");
  return (
    <Card>
      <SectionTitle title={tb(TX.cash, lang)} hint={tb(TX.cashSub, lang)} />
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-tm-text-muted">
            <tr>
              <th className="py-1.5 pr-3 font-semibold">{tb(TX.date, lang)}</th>
              <th className="py-1.5 pr-3 font-semibold">{tb(TX.flow, lang)}</th>
              <th className="py-1.5 pr-3 font-semibold">{tb(TX.direction, lang)}</th>
              <th className="py-1.5 pr-3 text-right font-semibold">{tb(TX.amount, lang)}</th>
              <th className="py-1.5 pr-3 text-right font-semibold">{tb(TX.exposureCol, lang)}</th>
              <th className="py-1.5 font-semibold">{tb(TX.status, lang)}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-tm-border">
            {withExposure.map((r, i) => (
              <tr key={i} className={`align-top ${i === nextIdx ? "bg-tm-neutral-light" : ""}`}>
                <td className="whitespace-nowrap py-2 pr-3 text-tm-text-light">
                  {formatDate(r.date, lang)}
                  {i === nextIdx && <span className="block text-[11px] font-semibold text-tm-black">{tb(TX.next, lang)}</span>}
                </td>
                <td className="py-2 pr-3 text-tm-black">
                  {tb(r.flow, lang)}
                  {r.note && <span className="block text-xs text-tm-text-light">{tb(r.note, lang)}</span>}
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-xs text-tm-text-light">{tb(r.direction, lang)}</td>
                <td className={`whitespace-nowrap py-2 pr-3 text-right font-semibold tabular-nums ${r.amount < 0 ? "text-tm-black" : "text-tm-primary-dark"}`}>
                  {r.amount < 0 ? "−" : "+"}
                  {formatUsd(Math.abs(r.amount), lang)}
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums text-tm-text-light">{formatUsd(r.exposure, lang)}</td>
                <td className="py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.state === "done" ? "bg-tm-neutral text-tm-black" : r.state === "planned" ? "text-tm-text-muted" : r.state === "held" ? "bg-tm-accent/15 text-tm-accent-dark" : "bg-tm-danger/15 text-tm-danger-dark"
                    }`}
                  >
                    {tb(stateText[r.state], lang)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function RiskDetails({
  deal,
  sim,
  frame,
  current,
  checks,
  ndviSeries,
  lang,
  onCredit,
}: {
  deal: PreHarvestDeal;
  sim: CampaignSimulation;
  frame: TimelineFrame;
  current: PreHarvestAssessment;
  checks: LiveCheck[];
  ndviSeries?: NdviPoint[];
  lang: Lang;
  onCredit: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <ScoreDrivers current={current} origination={sim.origination} lang={lang} onCredit={onCredit} />
        <CounterpartyChecks deal={deal} sim={sim} checks={checks} lang={lang} />
      </div>
      <CashFlows deal={deal} sim={sim} frame={frame} lang={lang} />
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-tm-text-muted">{tb(TX.technical, lang)}</p>
        <MonitoringPanels sim={sim} deal={deal} frame={frame} lang={lang} ndviSeries={ndviSeries} />
      </div>
    </div>
  );
}
