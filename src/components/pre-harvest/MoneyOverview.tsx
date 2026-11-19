/**
 * First thing on a loan file: the money. What is out, what is at risk, when it
 * comes back and how well it is covered, and the risk score that opens the
 * technical detail behind it.
 */
import { ArrowRight, Banknote, CalendarClock, ShieldAlert, ShieldCheck } from "lucide-react";
import { moneyPosition } from "../../lib/pre-harvest/finance";
import { formatDate, formatUsd, tb } from "../../lib/pre-harvest/i18n";
import type { CampaignSimulation } from "../../lib/pre-harvest/timeline";
import type { Bilingual, Lang, PanelId, PreHarvestAssessment, PreHarvestDeal, TimelineFrame } from "../../lib/pre-harvest/types";
import { fileStatus } from "../../lib/pre-harvest/verdict";
import { AnimatedNumber, Flash, Rise } from "./motion";
import { ContextStrip } from "./ContextStrip";

const PANELS: PanelId[] = ["crop", "weather", "market", "takeout"];

const TX = {
  exposure: { en: "Exposure today", es: "Exposición hoy" },
  of: { en: "of", es: "de" },
  committed: { en: "committed", es: "comprometido" },
  atRisk: { en: "Money at risk", es: "Dinero en riesgo" },
  atRiskSub: { en: "Expected loss on what is out", es: "Pérdida esperada sobre lo desembolsado" },
  lowPrice: { en: "If prices fall to a 1-in-10 low", es: "Si el precio cae a un mínimo de 1 en 10 años" },
  stillCovered: { en: "still covered", es: "aún cubierto" },
  short: { en: "short", es: "faltante" },
  repayment: { en: "Repayment", es: "Repago" },
  due: { en: "due", es: "vence el" },
  inDays: { en: "days left", es: "días restantes" },
  repaid: { en: "Repaid", es: "Repagado" },
  started: { en: "Started", es: "Inició" },
  day: { en: "day", es: "día" },
  covered: { en: "covered by the harvest", es: "cubierto por la cosecha" },
  score: { en: "Risk score", es: "Score de riesgo" },
  higherSafer: { en: "higher = safer", es: "mayor = más seguro" },
  sinceStart: { en: "since approval", es: "desde la aprobación" },
  details: { en: "See risk details", es: "Ver detalle del riesgo" },
  noRisks: { en: "No active risks. The harvest is expected to repay the loan", es: "Sin riesgos activos. Se espera que la cosecha repague el préstamo" },
  activeRisks: { en: "Active risks", es: "Riesgos activos" },
  impact: { en: "Impact on the loan", es: "Impacto en el préstamo" },
  watch: { en: "Watch", es: "Vigilar" },
  high: { en: "High risk", es: "Riesgo alto" },
} satisfies Record<string, Bilingual>;

function Tile({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`h-full rounded-xl border border-tm-border bg-tm-surface p-4 ${className}`}>{children}</div>;
}

function Label({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-tm-text-light">
      {icon}
      {children}
    </p>
  );
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
  const fs = fileStatus(frame);
  const repaid = fs.status === "repaid";
  // An application has lent nothing: no exposure, no repayment clock, no "since approval".
  const application = deal.status === "application";
  const declined = fs.status === "declined";
  const fmt = (n: number) => formatUsd(Math.round(n), lang);
  const delta = application ? 0 : current.composite - sim.origination.composite;
  const marker = Math.max(0, Math.min(100, current.composite));
  const off = PANELS.filter((p) => frame.panels[p].severity !== "green").sort(
    (a, b) => Number(frame.panels[b].severity === "red") - Number(frame.panels[a].severity === "red"),
  );
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
  // The score's gradient: red (unsafe) on the left to green (safe) on the right.
  const scale = "linear-gradient(90deg, var(--color-tm-danger), var(--color-tm-accent) 45%, var(--color-tm-primary))";

  return (
    <section aria-label={lang === "es" ? "Posición del préstamo" : "Loan position"} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Rise delay={0}>
          <Tile>
            <Label icon={<Banknote className="h-4 w-4" />}>{tb(TX.exposure, lang)}</Label>
            <AnimatedNumber value={m.exposureUsd} format={fmt} className="font-display text-[26px] leading-tight text-tm-black" />
            <p className="text-xs text-tm-text-light">
              {tb(TX.of, lang)} {fmt(m.committedUsd)} {tb(TX.committed, lang)}
            </p>
            <div className="mt-2.5 flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
              {segments.map((s, i) => (
                <span key={i} className={`h-full transition-colors duration-300 ${s.cls}`} style={{ width: `${s.pct}%` }} />
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-tm-text-muted">
              {frame.tranches.map((t) => `${t.pct}%`).join(" · ")} · {lang === "es" ? "tramos" : "tranches"}
              {repaid && ` · ${lang === "es" ? "todo repagado" : "all repaid"}`}
              {application && ` · ${lang === "es" ? "nada desembolsado" : "nothing disbursed"}`}
            </p>
          </Tile>
        </Rise>

        <Rise delay={0.04}>
          <Tile>
            <Label icon={<ShieldAlert className="h-4 w-4" />}>{tb(TX.atRisk, lang)}</Label>
            <AnimatedNumber value={m.moneyAtRiskUsd} format={fmt} className="font-display text-[26px] leading-tight text-tm-black" />
            <p className="text-xs text-tm-text-light">
              {m.exposureUsd === 0
                ? repaid
                  ? lang === "es"
                    ? "Préstamo repagado: nada pendiente"
                    : "Loan repaid: nothing outstanding"
                  : lang === "es"
                    ? "Nada desembolsado"
                    : "Nothing disbursed"
                : `${tb(TX.atRiskSub, lang)} · PD ${m.pdPct.toFixed(1)}% × LGD ${m.lgdPct.toFixed(0)}%`}
            </p>
            {m.downsideCoverage !== null && !declined && (
              <p className="mt-2.5 text-xs text-tm-text-light">
                {tb(TX.lowPrice, lang)}:{" "}
                {m.downsideShortfallUsd ? (
                  <b className="font-semibold text-tm-danger-dark">
                    {fmt(m.downsideShortfallUsd)} {tb(TX.short, lang)}
                  </b>
                ) : (
                  <b className="font-semibold text-tm-black">
                    {tb(TX.stillCovered, lang)} {m.downsideCoverage.toFixed(2)}×
                  </b>
                )}
              </p>
            )}
          </Tile>
        </Rise>

        <Rise delay={0.08}>
          <Tile>
            <Label icon={<CalendarClock className="h-4 w-4" />}>{tb(TX.repayment, lang)}</Label>
            {application ? (
              <>
                <p className="font-display text-[26px] leading-tight text-tm-black">
                  {declined ? (lang === "es" ? "Rechazada" : "Declined") : lang === "es" ? "En evaluación" : "Under review"}
                </p>
                <p className="text-xs text-tm-text-light">
                  {lang === "es" ? "Propuesto" : "Proposed"}: {fmt(deal.envelopeUsd)} · {deal.tenorDays} {lang === "es" ? "días desde el" : "days from"} {formatDate(m.startDate, lang)}
                </p>
              </>
            ) : (
              <>
                {repaid ? (
                  <p className="font-display text-[26px] leading-tight text-tm-black">{tb(TX.repaid, lang)}</p>
                ) : (
                  <p className="font-display text-[26px] leading-tight text-tm-black">
                    <AnimatedNumber value={m.daysToMaturity} format={(n) => String(Math.round(n))} /> <span className="text-base text-tm-text-light">{tb(TX.inDays, lang)}</span>
                  </p>
                )}
                <p className="text-xs text-tm-text-light">
                  {fmt(m.amountDueUsd)} {tb(TX.due, lang)} {formatDate(m.maturityDate, lang)}
                </p>
                <p className="mt-2.5 text-xs text-tm-text-light">
                  {tb(TX.started, lang)} {formatDate(m.startDate, lang)} · {tb(TX.day, lang)} {m.daysElapsed}/{deal.tenorDays}
                  {m.coverage !== null && (
                    <>
                      {" · "}
                      <b className={m.coverage < 1.1 ? "font-semibold text-tm-accent-dark" : "font-semibold text-tm-black"}>{m.coverage.toFixed(2)}×</b>{" "}
                      {m.coverageSource === "po" ? (lang === "es" ? "cubierto por la OC del comprador" : "covered by the buyer's PO") : tb(TX.covered, lang)}
                    </>
                  )}
                </p>
              </>
            )}
          </Tile>
        </Rise>

        <Rise delay={0.12}>
          <button
            type="button"
            onClick={onOpenRisk}
            className="group h-full w-full rounded-xl border border-tm-border bg-tm-surface p-4 text-left transition-colors hover:border-tm-black focus-visible:outline-2 focus-visible:outline-tm-black"
          >
            <Label icon={<ShieldCheck className="h-4 w-4" />}>{tb(TX.score, lang)}</Label>
            {current.tier === "VETO" ? (
              <p className="font-display text-[26px] leading-tight text-tm-danger-dark">Veto</p>
            ) : (
              <p className="font-display text-[26px] leading-tight text-tm-black">
                <AnimatedNumber value={current.composite} format={(n) => String(Math.round(n))} /> · {current.tier}{" "}
                <span className="text-sm text-tm-text-muted">/ 100</span>
              </p>
            )}
            <p className="text-xs text-tm-text-light">
              {application ? (
                <>{lang === "es" ? "a la solicitud" : "at application"}</>
              ) : delta !== 0 ? (
                <span className={delta < 0 ? "font-semibold text-tm-accent-dark" : "font-semibold text-tm-primary-dark"}>
                  {delta > 0 ? "▲ +" : "▼ "}
                  {delta} {tb(TX.sinceStart, lang)}
                </span>
              ) : (
                <>= {tb(TX.sinceStart, lang)}</>
              )}{" "}
              · {tb(TX.higherSafer, lang)}
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

      <Flash signal={worst} tone={worst === "red" ? "danger" : "accent"}>
        <ContextStrip deal={deal} sim={sim} frame={frame} lang={lang} onImpact={onOpenRisk} />
      </Flash>
    </section>
  );
}
