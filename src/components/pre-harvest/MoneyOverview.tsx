/**
 * First thing on a loan file: the money. What is out, what is at risk, when it
 * comes back and how well it is covered, and the risk score that opens the
 * technical detail behind it.
 */
import { ArrowRight, Banknote, CalendarClock, Scale, ShieldAlert, ShieldCheck } from "lucide-react";
import { bankView, moneyPosition, type BankMood, type BankView } from "../../lib/pre-harvest/finance";
import { formatDate, formatUsd, tb } from "../../lib/pre-harvest/i18n";
import type { CampaignSimulation } from "../../lib/pre-harvest/timeline";
import type { Bilingual, Lang, PanelId, PreHarvestAssessment, PreHarvestDeal, TimelineFrame } from "../../lib/pre-harvest/types";
import { fileStatus } from "../../lib/pre-harvest/verdict";
import { AnimatedNumber, Flash, Rise } from "./motion";
import { ContextStrip } from "./ContextStrip";
import { CreditTimeline } from "./CreditTimeline";
import { DetailDialog } from "./ui";

const PANELS: PanelId[] = ["crop", "weather", "market", "takeout"];

const TX = {
  exposure: { en: "Out today", es: "Desembolsado hoy" },
  atRisk: { en: "Expected loss", es: "Pérdida esperada" },
  repayment: { en: "Repayment", es: "Repago" },
  score: { en: "Risk score", es: "Score de riesgo" },
  sinceStart: { en: "since approval", es: "desde la aprobación" },
  details: { en: "See risk details", es: "Ver detalle del riesgo" },
} satisfies Record<string, Bilingual>;

const MOOD: Record<BankMood, { label: Bilingual; cls: string; box: string; Icon: typeof ShieldCheck }> = {
  comfortable: { label: { en: "Comfortable", es: "Tranquilo" }, cls: "bg-tm-primary text-white", box: "border-tm-primary/40 bg-tm-tint", Icon: ShieldCheck },
  watch: { label: { en: "Watch closely", es: "Vigilar de cerca" }, cls: "bg-tm-accent text-tm-black", box: "border-tm-accent/50 bg-tm-accent/10", Icon: ShieldAlert },
  act: { label: { en: "Act now", es: "Actuar ahora" }, cls: "bg-tm-danger text-white", box: "border-tm-danger/40 bg-tm-danger/5", Icon: ShieldAlert },
  decide: { label: { en: "Decision needed", es: "Decisión pendiente" }, cls: "bg-tm-black text-white", box: "border-tm-border bg-tm-neutral-light", Icon: Scale },
  settled: { label: { en: "Nothing at stake", es: "Nada en juego" }, cls: "bg-tm-neutral text-tm-black", box: "border-tm-border bg-tm-surface", Icon: ShieldCheck },
};

/** The one block the bank reads first: how to feel about this file, in one sentence of money. */
function BottomLine({ view, lang }: { view: BankView; lang: Lang }) {
  const mood = MOOD[view.mood];
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-3 ${mood.box}`}>
      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${mood.cls}`}>
        <mood.Icon className="h-3.5 w-3.5" />
        {tb(mood.label, lang)}
      </span>
      <p className="min-w-0 flex-1 basis-72 text-[15px] font-medium leading-snug text-tm-black">{tb(view.headline, lang)}</p>
    </div>
  );
}

/** One cell of the facts strip: label, figure, one line under it (the layout of a term sheet). */
function Tile({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`h-full bg-tm-surface px-4 py-3 ${className}`}>{children}</div>;
}

function Label({ children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-tm-text-muted">{children}</p>;
}

export function MoneyOverview({
  deal,
  sim,
  frame,
  current,
  lang,
  onOpenRisk,
}: {
  deal: PreHarvestDeal;
  sim: CampaignSimulation;
  frame: TimelineFrame;
  current: PreHarvestAssessment;
  lang: Lang;
  onOpenRisk: () => void;
}) {
  const m = moneyPosition(deal, sim, frame);
  const view = bankView(deal, sim, frame);
  const fs = fileStatus(frame);
  const repaid = fs.status === "repaid";
  // An application has lent nothing: no exposure, no repayment clock, no "since approval".
  const application = deal.status === "application";
  const declined = fs.status === "declined";
  const fmt = (n: number) => formatUsd(Math.round(n), lang);
  const delta = application ? 0 : current.composite - sim.origination.composite;
  const marker = Math.max(0, Math.min(100, current.composite));
  const off = PANELS.filter((p) => frame.panels[p].severity !== "green");
  const worst = off.some((p) => frame.panels[p].severity === "red") ? "red" : off.length ? "yellow" : "green";
  const segments = frame.tranches.map((t) => ({
    pct: (t.amountUsd / deal.envelopeUsd) * 100,
    cls: application
      ? "bg-tm-neutral"
      : repaid
        ? "bg-tm-primary/40"
        : t.status === "released"
          ? "bg-tm-black"
          : t.status === "held"
            ? "bg-tm-accent"
            : t.status === "stopped"
              ? "bg-tm-danger"
              : "bg-tm-neutral",
  }));
  // Expected loss if the full line were drawn: what approving an application puts at risk.
  const fullLineLoss = Math.round(deal.envelopeUsd * (m.pdPct / 100) * (m.lgdPct / 100));
  // The score's gradient: red (unsafe) on the left to green (safe) on the right.
  const scale = "linear-gradient(90deg, var(--color-tm-danger), var(--color-tm-accent) 45%, var(--color-tm-primary))";
  const big = "font-display text-[22px] leading-tight text-tm-black";
  const sub = "text-xs text-tm-text-light";

  return (
    <section aria-label={lang === "es" ? "Posición del préstamo" : "Loan position"} className="space-y-3">
      <Flash signal={view.mood} tone={view.mood === "act" ? "danger" : "accent"}>
        <BottomLine view={view} lang={lang} />
      </Flash>

      <div className="grid gap-px overflow-hidden rounded-xl border border-tm-border bg-tm-border sm:grid-cols-2 xl:grid-cols-4">
        <Rise delay={0}>
          <Tile>
            <Label icon={<Banknote className="h-4 w-4" />}>{tb(TX.exposure, lang)}</Label>
            <AnimatedNumber value={m.exposureUsd} format={fmt} className={big} />
            <p className={sub}>
              {lang === "es" ? "de" : "of"} {fmt(m.committedUsd)} {application ? (lang === "es" ? "solicitados" : "requested") : lang === "es" ? "comprometidos" : "committed"}
            </p>
            <div className="mt-2.5 flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
              {segments.map((s, i) => (
                <span key={i} className={`h-full transition-colors duration-300 ${s.cls}`} style={{ width: `${s.pct}%` }} />
              ))}
            </div>
          </Tile>
        </Rise>

        <Rise delay={0.04}>
          <Tile>
            <Label icon={<ShieldAlert className="h-4 w-4" />}>{tb(TX.atRisk, lang)}</Label>
            {application && !declined ? (
              <>
                <p className={big}>{fmt(fullLineLoss)}</p>
                <p className={sub}>{lang === "es" ? "si se aprueba y desembolsa todo" : "if approved and fully drawn"}</p>
              </>
            ) : application ? (
              <>
                <p className={big}>{fmt(0)}</p>
                <p className={sub}>
                  {lang === "es" ? "Si se aprobara" : "If approved"}: <b className="font-semibold text-tm-danger-dark">{fmt(fullLineLoss)}</b>
                </p>
              </>
            ) : (
              <>
                <AnimatedNumber value={m.moneyAtRiskUsd} format={fmt} className={big} />
                <p className={sub}>{m.exposureUsd === 0 ? (lang === "es" ? "Nada pendiente" : "Nothing outstanding") : lang === "es" ? "sobre lo desembolsado" : "on what is out"}</p>
              </>
            )}
          </Tile>
        </Rise>

        <Rise delay={0.08}>
          <Tile>
            <Label icon={<CalendarClock className="h-4 w-4" />}>{tb(TX.repayment, lang)}</Label>
            {application ? (
              <>
                <p className={big}>{fmt(m.amountDueUsd)}</p>
                <p className={sub}>
                  {lang === "es" ? "vencería a los" : "would be due after"} {deal.tenorDays} {lang === "es" ? "días" : "days"}
                </p>
              </>
            ) : repaid ? (
              <>
                <p className={big}>{fmt(m.amountDueUsd)}</p>
                <p className={sub}>
                  {lang === "es" ? "devuelto el" : "back on"} {formatDate(m.maturityDate, lang)}
                </p>
              </>
            ) : (
              <>
                <p className={big}>
                  <AnimatedNumber value={m.daysToMaturity} format={(n) => String(Math.round(n))} /> <span className="text-base text-tm-text-light">{lang === "es" ? "días" : "days left"}</span>
                </p>
                <p className={sub}>
                  {fmt(m.amountDueUsd)} {lang === "es" ? "vence el" : "due"} {formatDate(m.maturityDate, lang)}
                </p>
              </>
            )}
            {!application && (
              <div className="mt-2.5">
                <DetailDialog
                  label={lang === "es" ? "Plan de desembolsos y repago" : "Disbursement and repayment plan"}
                  title={lang === "es" ? "Plan de desembolsos y repago" : "Disbursement and repayment plan"}
                  subtitle={lang === "es" ? "Lo que sale al productor, lo desembolsado en cada momento y lo que vuelve al banco" : "What goes out to the grower, what is out at each point, and what comes back to the bank"}
                  lang={lang}
                >
                  <CreditTimeline deal={deal} sim={sim} frame={frame} lang={lang} />
                </DetailDialog>
              </div>
            )}
          </Tile>
        </Rise>

        <Rise delay={0.12}>
          <button
            type="button"
            onClick={onOpenRisk}
            className="group h-full w-full bg-tm-surface px-4 py-3 text-left transition-colors hover:bg-tm-neutral-light focus-visible:outline-2 focus-visible:outline-tm-black"
          >
            <Label icon={<ShieldCheck className="h-4 w-4" />}>{tb(TX.score, lang)}</Label>
            {current.tier === "VETO" ? (
              <p className="font-display text-[26px] leading-tight text-tm-danger-dark">Veto</p>
            ) : (
              <p className={big}>
                <AnimatedNumber value={current.composite} format={(n) => String(Math.round(n))} /> · {current.tier}{" "}
                <span className="text-sm text-tm-text-muted">/ 100</span>
              </p>
            )}
            <p className={sub}>
              {application ? (
                <>{lang === "es" ? "a la solicitud" : "at application"}</>
              ) : delta !== 0 ? (
                <span className={delta < 0 ? "font-semibold text-tm-accent-dark" : "font-semibold text-tm-primary-dark"}>
                  {delta > 0 ? "▲ +" : "▼ "}
                  {delta} {tb(TX.sinceStart, lang)}
                </span>
              ) : (
                <>= {tb(TX.sinceStart, lang)}</>
              )}
            </p>
            <div className="relative mt-2.5 h-1.5 rounded-full" style={{ background: scale }}>
              <span
                className="absolute -top-1 h-3.5 w-1 -translate-x-1/2 rounded-sm bg-tm-black ring-2 ring-tm-surface transition-[left] duration-500"
                style={{ left: `${marker}%` }}
              />
            </div>
            <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-tm-black group-hover:underline">
              {tb(TX.details, lang)} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </p>
          </button>
        </Rise>
      </div>

      {!repaid && deal.status !== "closed" && (
        <Flash signal={worst} tone={worst === "red" ? "danger" : "accent"}>
          <ContextStrip deal={deal} sim={sim} frame={frame} lang={lang} />
        </Flash>
      )}
    </section>
  );
}
