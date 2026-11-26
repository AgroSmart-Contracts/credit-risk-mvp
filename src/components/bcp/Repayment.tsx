/**
 * Repayment at a glance: where the data comes from, coverage against the
 * proposed bands, and the two things repayment depends on (volume and price).
 * Every figure is recomputable from the coverage build; ranges are estimates.
 */
import type { ReactNode } from "react";
import { Lock, RefreshCw } from "lucide-react";
import { COST_USD_KG, COVERAGE_BANDS, STANDARD_STRESS, cov, coverageUnder, date, harvestBuild, range, stateFromCoverage, usd, type HarvestInput } from "../../lib/bcp/calc";
import type { State } from "../../lib/bcp/types";
import { PILOT_NOTE } from "./nav";
import { useLang, useT } from "./shared";
import { Lbl } from "./ui";

const kg = (n: number) => `${Math.round(n).toLocaleString("en-US")} kg`;
const perKg = (n: number) => `USD ${n.toFixed(2)}/kg`;
const INK: Record<State, string> = { verde: "text-bcp-green-text", ambar: "text-bcp-ambar-text", naranja: "text-bcp-naranja-text", rojo: "text-bcp-rojo-text", veto: "text-bcp-rojo-text" };
const inked = (c: number) => <span className={`num font-semibold ${INK[stateFromCoverage(c)]}`}>{cov(c)}</span>;

/** Where the figures come from and when; refreshing on demand opens with the pilot. */
export function SourceStrip({ cutoff, compact = false }: { cutoff: string; compact?: boolean }) {
  const t = useT();
  const sources = t("Aforo de campo · Satélite · Facturas · Central de riesgos · Cuenta de recaudo", "Field estimate · Satellite · Invoices · Credit bureau · Collection account");
  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border border-bcp-border ${compact ? "rounded-lg bg-bcp-bg/70 px-3 py-2" : "rounded-xl bg-white px-4 py-2.5"} text-[13px]`}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-bcp-fill px-2.5 py-0.5 font-semibold text-bcp-ink">
          <span aria-hidden className="h-2 w-2 rounded-full bg-bcp-green" />
          {t(`Datos al ${date(cutoff, "es")}`, `Data as of ${date(cutoff, "en")}`)}
        </span>
        <span className="text-bcp-muted">{t("Fuentes", "Sources")}:</span>
        <span className="text-bcp-ink">{sources}</span>
      </p>
      <button type="button" disabled title={t(PILOT_NOTE)} aria-label={`${t("Actualizar ahora", "Update now")} · ${t(PILOT_NOTE)}`} className="inline-flex min-h-[32px] cursor-not-allowed items-center gap-1.5 rounded-md border border-dashed border-bcp-border bg-white px-2.5 text-[12px] font-semibold text-bcp-muted">
        <Lock className="h-3 w-3" aria-hidden />
        <RefreshCw className="h-3 w-3" aria-hidden />
        {t("Actualizar ahora", "Update now")}
        <span className="hidden font-normal sm:inline">· {t(PILOT_NOTE)}</span>
      </button>
    </div>
  );
}

/** Coverage on a scale with the proposed bands: approval (ring), today (bar), estimated range (band). */
export function CoverageRange({ today, approval, low, high, compact = false }: { today: number; approval?: number; low?: number; high?: number; compact?: boolean }) {
  const t = useT();
  const lang = useLang();
  const values = [today, approval, low, high].filter((v): v is number => v !== undefined);
  const min = Math.min(0.8, Math.floor(Math.min(...values) * 10) / 10 - 0.1);
  const max = Math.max(2.3, Math.ceil(Math.max(...values) * 10) / 10 + 0.1);
  const at = (v: number) => `${((v - min) / (max - min)) * 100}%`;
  const zones = [
    { from: min, to: COVERAGE_BANDS.rojo, cls: "bg-bcp-rojo-bg" },
    { from: COVERAGE_BANDS.rojo, to: COVERAGE_BANDS.naranja, cls: "bg-bcp-naranja-bg" },
    { from: COVERAGE_BANDS.naranja, to: COVERAGE_BANDS.ambar, cls: "bg-bcp-ambar-bg" },
    { from: COVERAGE_BANDS.ambar, to: max, cls: "bg-bcp-verde-bg/60" },
  ];
  const label = [
    `${t("Hoy", "Today")} ${cov(today)}`,
    approval !== undefined ? `${t("aprobación", "approval")} ${cov(approval)}` : "",
    low !== undefined && high !== undefined ? `${t("proyección estimada", "estimated projection")} ${range(low, high, lang)}` : "",
  ].filter(Boolean).join(" · ");
  return (
    <div role="img" aria-label={label} className="w-full">
      {!compact && (
        <div className="relative mb-1 h-4 text-[11px] text-bcp-muted" aria-hidden>
          {[COVERAGE_BANDS.rojo, COVERAGE_BANDS.naranja, COVERAGE_BANDS.ambar].map((b) => (
            <span key={b} className="num absolute -translate-x-1/2" style={{ left: at(b) }}>{cov(b)}</span>
          ))}
        </div>
      )}
      <div className={`relative ${compact ? "h-3" : "h-5"} overflow-visible rounded-full`} aria-hidden>
        <div className="absolute inset-0 flex overflow-hidden rounded-full">
          {zones.map((z) => (
            <span key={z.from} className={z.cls} style={{ width: `${((z.to - z.from) / (max - min)) * 100}%` }} />
          ))}
        </div>
        {low !== undefined && high !== undefined && (
          <span className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-bcp-ink/30" style={{ left: at(low), width: `calc(${at(high)} - ${at(low)})` }} />
        )}
        {approval !== undefined && (
          <span className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bcp-ink bg-white ${compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5"}`} style={{ left: at(approval) }} />
        )}
        <span className={`absolute top-1/2 w-1 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-bcp-ink ${compact ? "h-4" : "h-7"}`} style={{ left: at(today) }} />
      </div>
      {!compact && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-bcp-muted" aria-hidden>
          <span className="flex items-center gap-1.5"><span className="h-3 w-1 rounded-sm bg-bcp-ink" />{t("Hoy", "Today")}</span>
          {approval !== undefined && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-bcp-ink" />{t("Aprobación", "Approval")}</span>}
          {low !== undefined && <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-bcp-ink/30" />{t("Proyección (estimado)", "Projection (estimate)")}</span>}
        </div>
      )}
    </div>
  );
}

/** Headline card: coverage today, its projection and the standard stress, then volume and price. */
export function RepaymentCard({ input, cutoff, approval, low, high, lowHighLabel, middle, yieldTHa, areaHa, chip, onCalc, footnote }: {
  input: HarvestInput;
  cutoff: string;
  approval?: number;
  low?: number;
  high?: number;
  lowHighLabel?: string;
  /** Replaces the projection figure (an application shows coverage on its condition). */
  middle?: { label: string; value: ReactNode; sub: string };
  yieldTHa?: number;
  areaHa?: number;
  chip?: ReactNode;
  onCalc?: () => void;
  footnote?: string;
}) {
  const t = useT();
  const lang = useLang();
  const b = harvestBuild(input);
  const price = coverageUnder(input, STANDARD_STRESS.price);
  const volume = coverageUnder(input, 0, STANDARD_STRESS.volume);
  const pb = harvestBuild(input, { price: STANDARD_STRESS.price });
  const vb = harvestBuild(input, { volume: STANDARD_STRESS.volume });
  const cushion = Math.round(((b.priceUsdKg - b.breakEvenUsdKg) / b.priceUsdKg) * 100);
  return (
    <section aria-label={t("Capacidad de repago", "Repayment capacity")} className="space-y-4 rounded-xl border border-bcp-border bg-white p-4 sm:p-5">
      <SourceStrip cutoff={cutoff} compact />
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:divide-x md:divide-bcp-divider [&>*]:md:px-4 [&>*:first-child]:md:pl-0">
        <div>
          <Lbl>{t("Cobertura de repago hoy", "Repayment coverage today")}</Lbl>
          <p className={`num mt-1 text-[32px] font-bold leading-none ${INK[stateFromCoverage(b.coverage)]}`}>{cov(b.coverage)}</p>
          <p className="mt-1.5 text-[13px] text-bcp-muted">
            {approval !== undefined ? t(`aprobación ${cov(approval)} · `, `approval ${cov(approval)} · `) : ""}
            {t(`umbral ${cov(COVERAGE_BANDS.ambar)}`, `threshold ${cov(COVERAGE_BANDS.ambar)}`)}
          </p>
        </div>
        <div>
          <Lbl>{middle?.label ?? lowHighLabel ?? t("Proyección al vencimiento", "Projection at maturity")}</Lbl>
          <p className="num mt-1 text-[24px] font-bold leading-tight text-bcp-ink">{middle ? middle.value : low !== undefined && high !== undefined ? range(low, high, lang) : t("Sin cambio", "No change")}</p>
          <p className="mt-1.5 text-[13px] text-bcp-muted">{middle?.sub ?? t("estimado", "estimate")}</p>
        </div>
        <div>
          <Lbl>{t("Estrés estándar", "Standard stress")}</Lbl>
          <p className="mt-1 text-[15px]">{t("Precio −20%", "Price −20%")} {inked(price)}</p>
          <p className="text-[15px]">{t("Volumen −30%", "Volume −30%")} {inked(volume)}</p>
        </div>
        {chip && <div className="flex items-start md:justify-end">{chip}</div>}
      </div>

      <CoverageRange today={b.coverage} approval={approval} low={low} high={high} />

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-bcp-border p-4">
          <Lbl>{t("Volumen exportable", "Exportable volume")}</Lbl>
          <p className="num mt-1 text-[22px] font-bold">{kg(b.exportKg)}</p>
          <p className="text-[13px] text-bcp-muted">
            {areaHa !== undefined && yieldTHa !== undefined
              ? t(`${areaHa.toFixed(2)} ha × ${yieldTHa.toFixed(1)} t/ha × ${b.exportablePct}% exportable`, `${areaHa.toFixed(2)} ha × ${yieldTHa.toFixed(1)} t/ha × ${b.exportablePct}% exportable`)
              : t(`${kg(b.volumeKg)} × ${b.exportablePct}% exportable`, `${kg(b.volumeKg)} × ${b.exportablePct}% exportable`)}
          </p>
          <p className="mt-2 border-t border-bcp-divider pt-2 text-[13px]">
            {t("Con −30%", "At −30%")}: <span className="num">{kg(vb.exportKg)}</span> → {inked(volume)}
          </p>
        </div>
        <div className="rounded-lg border border-bcp-border p-4">
          <Lbl>{t("Precio esperado a cosecha (FOB)", "Expected harvest price (FOB)")}</Lbl>
          <p className="num mt-1 text-[22px] font-bold">{perKg(b.priceUsdKg)}</p>
          <p className="text-[13px] text-bcp-muted">
            {t(`equilibrio ${perKg(b.breakEvenUsdKg)} · margen ${cushion}% · costos ${perKg(COST_USD_KG)}`, `break-even ${perKg(b.breakEvenUsdKg)} · cushion ${cushion}% · costs ${perKg(COST_USD_KG)}`)}
          </p>
          <p className="mt-2 border-t border-bcp-divider pt-2 text-[13px]">
            {t("Con −20%", "At −20%")}: <span className="num">{perKg(pb.priceUsdKg)}</span> → {inked(price)}
          </p>
        </div>
      </div>

      {(onCalc || footnote) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-bcp-divider pt-3">
          <p className="text-[13px] text-bcp-muted">{footnote ?? t(`Saldo al vencimiento ${usd(b.dueUsd)} · ingreso neto ${usd(b.netUsd)}`, `Due at maturity ${usd(b.dueUsd)} · net revenue ${usd(b.netUsd)}`)}</p>
          {onCalc && (
            <button type="button" onClick={onCalc} className="min-h-[40px] rounded-lg border border-bcp-border bg-white px-3 text-sm font-semibold text-bcp-ink hover:border-bcp-ink">
              {t("Ver el cálculo", "See the calculation")} →
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/** An application as requested next to TruMarket's condition: same inputs, two amounts due. */
export function LineCompare({ input, tenorDays, requestedUsd, requestedDueUsd, condition }: {
  input: HarvestInput;
  tenorDays: number;
  requestedUsd: number;
  requestedDueUsd: number;
  condition: { lineUsd: number; dueAtMaturityUsd: number };
}) {
  const t = useT();
  const col = (label: string, line: number, due: number, recommended: boolean) => {
    const today = harvestBuild(input, {}, due).coverage;
    const price = coverageUnder(input, STANDARD_STRESS.price, 0, due);
    const volume = coverageUnder(input, 0, STANDARD_STRESS.volume, due);
    const passes = price >= COVERAGE_BANDS.ambar && volume >= COVERAGE_BANDS.ambar;
    const rows: [string, ReactNode][] = [
      [t("Saldo al vencimiento", "Due at maturity"), <span key="due" className="num">{usd(due)}</span>],
      [t("Cobertura hoy", "Coverage today"), inked(today)],
      [t("Precio −20%", "Price −20%"), inked(price)],
      [t("Volumen −30%", "Volume −30%"), inked(volume)],
      [t("Precio de equilibrio", "Break-even price"), <span key="be" className="num">{perKg(harvestBuild(input, {}, due).breakEvenUsdKg)}</span>],
    ];
    return (
      <div className={`rounded-xl border p-4 sm:p-5 ${recommended ? "border-bcp-control-border bg-bcp-control" : "border-bcp-border bg-white"}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Lbl>{label}</Lbl>
          <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${passes ? "bg-bcp-verde-bg text-bcp-green-text" : "bg-bcp-naranja-bg text-bcp-naranja-text"}`}>
            {passes ? t(`Pasa ambos estrés ≥${cov(COVERAGE_BANDS.ambar)}`, `Passes both stresses ≥${cov(COVERAGE_BANDS.ambar)}`) : t("No pasa el estrés estándar", "Fails the standard stress")}
          </span>
        </div>
        <p className={`num mt-1 text-[28px] font-bold ${recommended ? "text-bcp-green-text" : "text-bcp-ink"}`}>{usd(line)}</p>
        <p className="text-[13px] text-bcp-muted">{t(`${tenorDays} días · 3 tramos`, `${tenorDays} days · 3 tranches`)}</p>
        <dl className="mt-3 divide-y divide-bcp-divider text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-1.5">
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  };
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {col(t("Línea solicitada", "Requested line"), requestedUsd, requestedDueUsd, false)}
      {col(t("Línea recomendada con condición", "Recommended line with condition"), condition.lineUsd, condition.dueAtMaturityUsd, true)}
    </div>
  );
}
