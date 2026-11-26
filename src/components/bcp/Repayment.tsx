/**
 * Repayment at a glance: where the data comes from, coverage against the
 * proposed bands, and the two things repayment depends on (volume and price).
 * Every figure is recomputable from the coverage build; ranges are estimates.
 */
import { useState, type ReactNode } from "react";
import { Lock, RefreshCw } from "lucide-react";
import { COST_USD_KG, COVERAGE_BANDS, STANDARD_STRESS, cov, coverageUnder, date, harvestBuild, range, stateFromCoverage, usd, type HarvestInput } from "../../lib/bcp/calc";
import type { ConditionState, Provenance, State } from "../../lib/bcp/types";
import { PILOT_NOTE } from "./nav";
import { STATE_TEXT, useLang, useT } from "./shared";
import { Lbl, Prov } from "./ui";

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

const SCALE_MIN = 0.8;
const SCALE_MAX = 2.4;

/** The key for the small coverage bars in tables (the cards carry their own). */
export function CoverageLegend() {
  const t = useT();
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-bcp-muted">
      <span className="flex items-center gap-1.5"><span className="h-3 w-[3px] rounded-sm bg-bcp-ink" />{t("Hoy", "Today")}</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-bcp-ink" />{t("Aprobación (la línea marca el cambio)", "Approval (the line shows the change)")}</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-bcp-green/25" />{t("Estrés estándar, hasta hoy", "Standard stress, up to today")}</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-bcp-green/60" />{t("Proyección (estimado)", "Projection (estimate)")}</span>
    </p>
  );
}

/** Coverage on a scale with the proposed bands: approval (ring), today (bar), estimated range (band). */
export function CoverageRange({ today, approval, low, high, stress, compact = false }: { today: number; approval?: number; low?: number; high?: number; stress?: number; compact?: boolean }) {
  const t = useT();
  const lang = useLang();
  // One fixed scale everywhere, so 1.50x sits at the same place on every row and rows compare.
  const clamp = (v: number) => Math.min(SCALE_MAX, Math.max(SCALE_MIN, v));
  const pos = (v: number) => ((clamp(v) - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
  const at = (v: number) => `${pos(v)}%`;
  const min = SCALE_MIN;
  const max = SCALE_MAX;
  const zones = [
    { from: min, to: COVERAGE_BANDS.rojo, cls: "bg-bcp-rojo-bg" },
    { from: COVERAGE_BANDS.rojo, to: COVERAGE_BANDS.naranja, cls: "bg-bcp-naranja-bg" },
    { from: COVERAGE_BANDS.naranja, to: COVERAGE_BANDS.ambar, cls: "bg-bcp-ambar-bg" },
    { from: COVERAGE_BANDS.ambar, to: max, cls: "bg-bcp-verde-bg/70" },
  ];
  const ticks: [number, string][] = [[COVERAGE_BANDS.rojo, "bg-bcp-rojo/50"], [COVERAGE_BANDS.naranja, "bg-bcp-naranja/50"], [COVERAGE_BANDS.ambar, "bg-bcp-ambar/60"]];
  const label = [
    `${t("Hoy", "Today")} ${cov(today)}`,
    approval !== undefined ? `${t("aprobación", "approval")} ${cov(approval)}` : "",
    low !== undefined && high !== undefined ? `${t("proyección estimada", "estimated projection")} ${range(low, high, lang)}` : "",
    stress !== undefined ? `${t("estrés estándar", "standard stress")} ${cov(stress)}` : "",
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
      <div className={`relative ${compact ? "h-3.5" : "h-5"}`} aria-hidden>
        <div className="absolute inset-0 flex overflow-hidden rounded-full">
          {zones.map((z) => (
            <span key={z.from} className={z.cls} style={{ width: `${((z.to - z.from) / (max - min)) * 100}%` }} />
          ))}
        </div>
        {ticks.map(([v, c]) => (
          <span key={v} className={`absolute inset-y-0 w-px ${c}`} style={{ left: at(v) }} />
        ))}
        {/* Light green: how far the standard stress takes coverage; dark green: the estimated projection. */}
        {stress !== undefined && (
          <span className="absolute inset-y-[22%] rounded-full bg-bcp-green/25" style={{ left: at(Math.min(stress, today)), width: `${Math.abs(pos(today) - pos(stress))}%` }} />
        )}
        {low !== undefined && high !== undefined && (
          <span className="absolute inset-y-[22%] rounded-full bg-bcp-green/60" style={{ left: at(low), width: `max(6px, ${pos(high) - pos(low)}%)` }} />
        )}
        {approval !== undefined && (
          <span className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-bcp-ink/45" style={{ left: at(Math.min(approval, today)), width: `${Math.abs(pos(approval) - pos(today))}%` }} />
        )}
        {approval !== undefined && (
          <span className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bcp-ink bg-white ${compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5"}`} style={{ left: at(approval) }} />
        )}
        <span className={`absolute top-1/2 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-sm bg-bcp-ink ${compact ? "h-5" : "h-7"}`} style={{ left: at(today) }} />
      </div>
      {!compact && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-bcp-muted" aria-hidden>
          <span className="flex items-center gap-1.5"><span className="h-3 w-1 rounded-sm bg-bcp-ink" />{t("Hoy", "Today")}</span>
          {approval !== undefined && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-bcp-ink" />{t("Aprobación", "Approval")}</span>}
          {stress !== undefined && <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-bcp-green/25" />{t("Estrés estándar", "Standard stress")} {cov(stress)}</span>}
          {low !== undefined && <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-bcp-green/60" />{t("Proyección (estimado)", "Projection (estimate)")}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * Where repayment breaks, on one axis: the break-even point (coverage 1.00x),
 * the proposed threshold (1.50x), the standard stress and the expected value.
 * Every marker follows from the coverage build, so the bank can check each one.
 */
function BreakLine({ expected, stressed, breakEven, threshold, fmt, stressLabel }: { expected: number; stressed: number; breakEven: number; threshold: number; fmt: (n: number) => string; stressLabel: string }) {
  const t = useT();
  const max = Math.max(expected, threshold) * 1.12;
  const at = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;
  const marks: { v: number; label: string; cls: string }[] = [
    { v: breakEven, label: `${t("equilibrio (1.00x)", "break-even (1.00x)")} ${fmt(breakEven)}`, cls: "bg-bcp-rojo" },
    { v: threshold, label: `${t("umbral", "threshold")} ${cov(COVERAGE_BANDS.ambar)}: ${fmt(threshold)}`, cls: "bg-bcp-ambar" },
    { v: stressed, label: `${stressLabel} ${fmt(stressed)}`, cls: "bg-bcp-naranja" },
    { v: expected, label: `${t("esperado", "expected")} ${fmt(expected)}`, cls: "bg-bcp-ink" },
  ];
  return (
    <div className="mt-3" role="img" aria-label={marks.map((m) => m.label).join(" · ")}>
      <div className="relative h-2.5 rounded-full" aria-hidden>
        <div className="absolute inset-0 flex overflow-hidden rounded-full">
          <span className="bg-bcp-rojo-bg" style={{ width: at(breakEven) }} />
          <span className="bg-bcp-ambar-bg" style={{ width: `calc(${at(threshold)} - ${at(breakEven)})` }} />
          <span className="flex-1 bg-bcp-verde-bg/70" />
        </div>
        {marks.map((m) => (
          <span key={m.label} className={`absolute top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-sm ${m.cls}`} style={{ left: at(m.v) }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-bcp-muted" aria-hidden>
        {marks.map((m) => (
          <li key={m.label} className={`num flex items-center gap-1.5 ${m.v === expected ? "font-semibold text-bcp-ink" : ""}`}>
            <span className={`h-3 w-[3px] rounded-sm ${m.cls}`} />
            {m.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A reading behind volume or price: value, effect on repayment, provenance and source. */
export type DriverRow = { label: string; value: string; effect: string; state: ConditionState; provenance: Provenance; source: string };

function Drivers({ rows }: { rows: DriverRow[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (!rows.length) return null;
  return (
    <div className="mt-2 border-t border-bcp-divider pt-2">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="min-h-[32px] text-[13px] font-semibold text-bcp-green-text hover:underline">
        {open ? t("Ocultar lo que lo mueve", "Hide what moves it") : t(`Qué lo mueve (${rows.length})`, `What moves it (${rows.length})`)} {open ? "▴" : "▾"}
      </button>
      {open && (
        <ul className="mt-1 divide-y divide-bcp-divider text-[13px]">
          {rows.map((r) => (
            <li key={r.label} className="py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-semibold text-bcp-ink">{r.label}</span>
                <span className="num font-semibold">{r.value}</span>
              </div>
              <p className="text-bcp-muted">{r.effect} · {t(STATE_TEXT[r.state])}</p>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-bcp-muted"><Prov p={r.provenance} /> {r.source}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Headline card: coverage today, its projection and the standard stress, then volume and price. */
export function RepaymentCard({ input, cutoff, approval, low, high, lowHighLabel, middle, yieldTHa, areaHa, chip, onCalc, footnote, drivers }: {
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
  /** The readings behind each of the two inputs (loan conditions or application checks). */
  drivers?: { volume: DriverRow[]; price: DriverRow[] };
}) {
  const t = useT();
  const lang = useLang();
  const b = harvestBuild(input);
  const margin = b.priceUsdKg - COST_USD_KG;
  // Volume and price at which coverage is exactly 1.00x and the 1.50x threshold, other things equal.
  const kgAt = (c: number) => (c * b.dueUsd) / margin;
  const priceAt = (c: number) => COST_USD_KG + (c * b.dueUsd) / b.exportKg;
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

      <CoverageRange today={b.coverage} approval={approval} low={low} high={high} stress={Math.min(price, volume)} />

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
          <BreakLine expected={b.exportKg} stressed={vb.exportKg} breakEven={kgAt(1)} threshold={kgAt(COVERAGE_BANDS.ambar)} fmt={(n) => `${(n / 1000).toFixed(1)} t`} stressLabel="−30%" />
          <Drivers rows={drivers?.volume ?? []} />
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
          <BreakLine expected={b.priceUsdKg} stressed={pb.priceUsdKg} breakEven={priceAt(1)} threshold={priceAt(COVERAGE_BANDS.ambar)} fmt={(n) => `${n.toFixed(2)}`} stressLabel="−20%" />
          <Drivers rows={drivers?.price ?? []} />
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
