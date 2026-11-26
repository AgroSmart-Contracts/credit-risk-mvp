/**
 * Repayment at a glance: where the data comes from, coverage against the
 * proposed bands, and the two things repayment depends on (volume and price).
 * Every figure is recomputable from the coverage build; ranges are estimates.
 */
import { useState, type ReactNode } from "react";
import { Lock, RefreshCw } from "lucide-react";
import { COST_USD_KG, COVERAGE_BANDS, DISPERSION, STANDARD_STRESS, cov, coverageDistribution, coverageUnder, date, daysBetween, harvestBuild, range, repaymentIndex, stateFromCoverage, usd, type HarvestInput } from "../../lib/bcp/calc";
import type { ConditionState, Provenance, State } from "../../lib/bcp/types";
import { BANK_EDITION } from "./edition";
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

/** The key for the small coverage trend charts in tables (the cards carry their own). */
export function CoverageLegend() {
  const t = useT();
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-bcp-muted">
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-bcp-ink bg-white" />{t("Aprobación", "Approval")}</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-bcp-ink" />{t("Hoy", "Today")}</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-1.5 rounded-sm border border-dashed border-bcp-ink/70 bg-bcp-ink/10" />{t("Al vencimiento (estimado)", "At maturity (estimate)")}</span>
      <span className="flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-bcp-ambar" />{t(`Umbral ${cov(COVERAGE_BANDS.ambar)}`, `Threshold ${cov(COVERAGE_BANDS.ambar)}`)}</span>
    </p>
  );
}

const SCALE_MIN = 0.8;
const SCALE_MAX = 2.4;

/**
 * Coverage over the campaign, for tables: time left to right (approval to
 * maturity), coverage bottom to top on one fixed scale with the risk bands and
 * the 1.50x threshold. Solid: the recorded weekly history up to today; dashed:
 * the estimated range at maturity.
 */
export function CoverageTrend({ history, today, low, high, from, to, cutoff }: { history: { date: string; value: number }[]; today: number; low?: number; high?: number; from: string; to: string; cutoff: string }) {
  const t = useT();
  const lang = useLang();
  const W = 220;
  const H = 64;
  const L = 8;
  const R = W - 10;
  const TOP = 2.2;
  const BOT = 0.9;
  const y = (v: number) => H - 5 - ((Math.min(TOP, Math.max(BOT, v)) - BOT) / (TOP - BOT)) * (H - 10);
  const span = Math.max(1, daysBetween(from, to));
  const x = (d: string) => L + ((R - L) * Math.min(1, Math.max(0, daysBetween(from, d) / span)));
  const pts = [...history.filter((p) => p.date <= cutoff), { date: cutoff, value: today }];
  const line = pts.map((p, k) => `${k ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const xToday = x(cutoff);
  const proj = low !== undefined && high !== undefined;
  const mid = proj ? (low! + high!) / 2 : today;
  const approval = history[0]?.value ?? today;
  const bands: [number, number, string][] = [
    [BOT, COVERAGE_BANDS.rojo, "fill-bcp-rojo-bg"],
    [COVERAGE_BANDS.rojo, COVERAGE_BANDS.naranja, "fill-bcp-naranja-bg"],
    [COVERAGE_BANDS.naranja, COVERAGE_BANDS.ambar, "fill-bcp-ambar-bg"],
    [COVERAGE_BANDS.ambar, TOP, "fill-bcp-verde-bg"],
  ];
  const label = `${t("Aprobación", "Approval")} ${cov(approval)} → ${t("hoy", "today")} ${cov(today)}${proj ? ` → ${t("al vencimiento", "at maturity")} ${range(low!, high!, lang)} (${t("estimado", "estimate")})` : ""}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[64px] w-full max-w-[240px]" role="img" aria-label={label}>
      {bands.map(([a, b, c]) => <rect key={a} x={0} width={W} y={y(b)} height={y(a) - y(b)} rx={0} className={c} opacity={0.7} />)}
      <line x1={0} x2={W} y1={y(COVERAGE_BANDS.ambar)} y2={y(COVERAGE_BANDS.ambar)} className="stroke-bcp-ambar" strokeDasharray="3 2" strokeWidth={1} />
      <path d={line} className="fill-none stroke-bcp-ink" strokeWidth={2} strokeLinejoin="round" />
      {proj && <line x1={xToday} x2={R} y1={y(today)} y2={y(mid)} className="stroke-bcp-ink" strokeWidth={1.5} strokeDasharray="3 3" opacity={0.7} />}
      {proj && <rect x={R - 4} width={8} y={y(high!) - 1} height={Math.max(3, y(low!) - y(high!) + 2)} rx={2} className="fill-bcp-ink/10 stroke-bcp-ink" strokeDasharray="2 1.5" strokeWidth={1} opacity={0.9} />}
      <circle cx={L} cy={y(approval)} r={3.5} className="fill-white stroke-bcp-ink" strokeWidth={1.75} />
      <circle cx={xToday} cy={y(today)} r={4} className="fill-bcp-ink stroke-white" strokeWidth={1.5} />
    </svg>
  );
}


/** A reading behind volume or price: value, effect on repayment, provenance and source. */
export type DriverRow = { label: string; value: string; effect: string; state: ConditionState; provenance: Provenance; source: string };

function DriverList({ rows }: { rows: DriverRow[] }) {
  const t = useT();
  if (!rows.length) return null;
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((r) => (
        <div key={r.label} className="rounded-lg border border-bcp-divider bg-bcp-bg/60 p-3 text-[13px]">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="font-semibold text-bcp-ink">{r.label}</span>
            <span className="num font-semibold">{r.value}</span>
          </div>
          <p className="text-bcp-muted">{r.effect} · {t(STATE_TEXT[r.state])}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-bcp-muted"><Prov p={r.provenance} /> {r.source}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * The estimated distribution of one input as a bell curve: the tail below a
 * line is shaded (below break-even, or below the standard stress), with
 * P10, P50 and P90 marked. A picture of the stated assumption, not of data.
 */
function BellCurve({ mean, sd, fmt, shadeBelow, warnBelow, shadeLabel, lines, ticks }: {
  mean: number;
  sd: number;
  fmt: (n: number) => string;
  shadeBelow: number;
  /** Second, lighter zone: below the 1.50x threshold. */
  warnBelow?: number;
  shadeLabel: string;
  lines: { v: number; label: string; cls: string }[];
  ticks: { v: number; label: string; strong?: boolean }[];
}) {
  const W = 560;
  const H = 120;
  const lo = Math.min(mean - 3 * sd, shadeBelow - sd * 0.3, ...lines.map((l) => l.v - sd * 0.3));
  const hi = mean + 3 * sd;
  const PAD = 70;
  const x = (v: number) => PAD + ((v - lo) / (hi - lo)) * (W - PAD * 2);
  const y = (v: number) => H - 22 - Math.exp(-((v - mean) ** 2) / (2 * sd * sd)) * (H - 36);
  const pts = Array.from({ length: 81 }, (_, k) => lo + ((hi - lo) * k) / 80);
  const path = pts.map((v, k) => `${k ? "L" : "M"}${x(v).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = (cut: number) => {
    const tail = pts.filter((v) => v <= cut);
    return tail.length ? `M${x(lo)},${H - 22} ` + tail.map((v) => `L${x(v).toFixed(1)},${y(v).toFixed(1)}`).join(" ") + ` L${x(Math.min(cut, hi)).toFixed(1)},${y(Math.min(cut, hi)).toFixed(1)} L${x(Math.min(cut, hi)).toFixed(1)},${H - 22} Z` : "";
  };
  const tailPath = area(shadeBelow);
  const warnPath = warnBelow !== undefined ? area(warnBelow) : "";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${ticks.map((k) => `${k.label} ${fmt(k.v)}`).join(" · ")} · ${shadeLabel}`}>
      <path d={`${path} L${x(hi)},${H - 22} L${x(lo)},${H - 22} Z`} className="fill-bcp-verde-bg" />
      {warnPath && <path d={warnPath} className="fill-bcp-ambar-bg" />}
      {tailPath && <path d={tailPath} className="fill-bcp-rojo-bg" />}
      <path d={path} className="fill-none stroke-bcp-green-text" strokeWidth={2} />
      <line x1={x(lo)} x2={x(hi)} y1={H - 22} y2={H - 22} className="stroke-bcp-border" />
      {[...lines].sort((a, b) => a.v - b.v).map((l, k, all) => {
        // Labels never leave the chart, and two close lines read outward from each other.
        const lx = x(l.v);
        const near = all.length > 1 && Math.abs(x(all[1].v) - x(all[0].v)) < 90;
        const anchor = lx < 50 || (near && k === 0) ? "end" : lx > W - 50 || (near && k === all.length - 1) ? "start" : "middle";
        const tx = anchor === "end" ? Math.max(lx - 4, 60) : anchor === "start" ? Math.min(lx + 4, W - 60) : lx;
        return (
          <g key={l.label}>
            <line x1={lx} x2={lx} y1={14} y2={H - 22} strokeDasharray="4 3" className={l.cls} strokeWidth={1.5} />
            <text x={tx} y={10} textAnchor={anchor === "end" && lx < 60 ? "start" : anchor} className="fill-bcp-naranja-text text-[11px] font-semibold">{l.label}</text>
          </g>
        );
      })}
      {ticks.map((k) => (
        <g key={k.label}>
          <line x1={x(k.v)} x2={x(k.v)} y1={k.strong ? y(k.v) : H - 26} y2={H - 18} className={k.strong ? "stroke-bcp-ink" : "stroke-bcp-muted"} strokeWidth={k.strong ? 2 : 1} />
          <text x={x(k.v)} y={H - 5} textAnchor="middle" className={`text-[11px] ${k.strong ? "fill-bcp-ink font-semibold" : "fill-bcp-muted"}`}>{k.label} {fmt(k.v)}</text>
        </g>
      ))}
    </svg>
  );
}

/** Coverage percentiles on the band scale: P10-P90 light, P25-P75 dark, P50 ring, approval above. */
function DistributionBar({ d, approval }: { d: ReturnType<typeof coverageDistribution>; approval?: number }) {
  const t = useT();
  const pos = (v: number) => ((Math.min(SCALE_MAX, Math.max(SCALE_MIN, v)) - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
  const at = (v: number) => `${pos(v)}%`;
  const zones = [
    { from: SCALE_MIN, to: COVERAGE_BANDS.rojo, cls: "bg-bcp-rojo-bg" },
    { from: COVERAGE_BANDS.rojo, to: COVERAGE_BANDS.naranja, cls: "bg-bcp-naranja-bg" },
    { from: COVERAGE_BANDS.naranja, to: COVERAGE_BANDS.ambar, cls: "bg-bcp-ambar-bg" },
    { from: COVERAGE_BANDS.ambar, to: SCALE_MAX, cls: "bg-bcp-bg" },
  ];
  return (
    <div>
      <div className="relative mb-1 h-4 text-[11px]" aria-hidden>
        {[[COVERAGE_BANDS.rojo, "text-bcp-rojo-text"], [COVERAGE_BANDS.naranja, "text-bcp-naranja-text"], [COVERAGE_BANDS.ambar, "text-bcp-ambar-text"]].map(([b, c]) => (
          <span key={b} className={`num absolute -translate-x-1/2 font-semibold ${c}`} style={{ left: at(b as number) }}>{cov(b as number)}</span>
        ))}
        {approval !== undefined && <span className="absolute -translate-x-1/2 text-bcp-ink" style={{ left: at(approval), top: 2 }} title={t("Aprobación", "Approval")}>▼</span>}
      </div>
      <div className="relative h-6 rounded-lg border border-bcp-border" role="img" aria-label={`P10 ${cov(d.p10)} · P25 ${cov(d.p25)} · P50 ${cov(d.p50)} · P75 ${cov(d.p75)} · P90 ${cov(d.p90)}`}>
        <div className="absolute inset-0 flex overflow-hidden rounded-lg">
          {zones.map((z) => <span key={z.from} className={z.cls} style={{ width: `${((z.to - z.from) / (SCALE_MAX - SCALE_MIN)) * 100}%` }} />)}
        </div>
        {[COVERAGE_BANDS.rojo, COVERAGE_BANDS.naranja, COVERAGE_BANDS.ambar].map((v) => <span key={v} className="absolute inset-y-0 border-l border-dashed border-bcp-naranja/60" style={{ left: at(v) }} />)}
        <span className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-bcp-green/30" style={{ left: at(d.p10), width: `${pos(d.p90) - pos(d.p10)}%` }} />
        <span className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-bcp-green/70" style={{ left: at(d.p25), width: `${pos(d.p75) - pos(d.p25)}%` }} />
        <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bcp-green-text bg-white" style={{ left: at(d.p50) }} />
      </div>
    </div>
  );
}

/** Headline card: repayment at a glance, the estimated distribution, then volume (Q) and price (P). */
export function RepaymentCard({ input, cutoff, approval, low, high, lowHighLabel, middle, yieldTHa, areaHa, chip, onCalc, footnote, drivers, controls }: {
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
  /** Controls state, for the internal index. */
  controls?: Exclude<State, "veto">;
}) {
  const t = useT();
  const lang = useLang();
  const [panel, setPanel] = useState<"q" | "p" | null>(null);
  const b = harvestBuild(input);
  const d = coverageDistribution(input);
  const price = coverageUnder(input, STANDARD_STRESS.price);
  const volume = coverageUnder(input, 0, STANDARD_STRESS.volume);
  const pb = harvestBuild(input, { price: STANDARD_STRESS.price });
  const vb = harvestBuild(input, { volume: STANDARD_STRESS.volume });
  const breakEvenKg = b.dueUsd / (b.priceUsdKg - COST_USD_KG);
  // Headroom without any assumption: how far each input can fall, the other held, before 1.50x and 1.00x.
  const kgAt = (c: number) => (c * b.dueUsd) / (b.priceUsdKg - COST_USD_KG);
  const priceAt = (c: number) => COST_USD_KG + (c * b.dueUsd) / b.exportKg;
  const fall = (from: number, to: number) => Math.max(0, Math.round((1 - to / from) * 1000) / 10);
  const head = {
    q: { t150: kgAt(COVERAGE_BANDS.ambar), be: breakEvenKg, f150: fall(b.exportKg, kgAt(COVERAGE_BANDS.ambar)), fbe: fall(b.exportKg, breakEvenKg) },
    p: { t150: priceAt(COVERAGE_BANDS.ambar), be: priceAt(1), f150: fall(b.priceUsdKg, priceAt(COVERAGE_BANDS.ambar)), fbe: fall(b.priceUsdKg, priceAt(1)) },
  };
  const index = BANK_EDITION ? null : repaymentIndex(d, controls ?? "verde");
  const estimate = t("Estimado · supuesto a calibrar en el piloto", "Estimate · assumption to calibrate in the pilot");
  const assumption = t(`Supuesto: volumen ±${DISPERSION.volume * 100}% y precio ±${DISPERSION.price * 100}% (1 desv. estándar)`, `Assumption: volume ±${DISPERSION.volume * 100}% and price ±${DISPERSION.price * 100}% (1 standard deviation)`);
  const toggle = (k: "q" | "p") => setPanel((v) => (v === k ? null : k));
  const Headroom = ({ h, unit, what }: { h: (typeof head)["q"]; unit: (n: number) => string; what: string }) => (
    <div className="grid gap-2 sm:grid-cols-2">
      {[
        [h.f150, h.t150, t(`hasta el umbral ${cov(COVERAGE_BANDS.ambar)}`, `to the ${cov(COVERAGE_BANDS.ambar)} threshold`), "border-bcp-ambar"],
        [h.fbe, h.be, t("hasta el equilibrio (1.00x)", "to break-even (1.00x)"), "border-bcp-rojo"],
      ].map(([f, v, k, c]) => (
        <div key={k as string} className={`rounded-lg border border-l-4 border-bcp-divider bg-white px-3 py-2 ${c}`}>
          <p className="text-[12px] text-bcp-muted">{t(`Margen ${k as string}`, `Headroom ${k as string}`)}</p>
          <p className="text-[15px]"><b className="num font-bold">{(f as number) === 0 ? t("ya bajo", "already below") : `−${(f as number).toFixed(1)}%`}</b> <span className="text-bcp-muted">{t(`de ${what} · ${unit(v as number)}`, `of ${what} · ${unit(v as number)}`)}</span></p>
        </div>
      ))}
    </div>
  );
  const card = (on: boolean) => `rounded-xl border p-4 text-left transition-colors ${on ? "border-bcp-ink bg-bcp-bg/60" : "border-bcp-border bg-white hover:border-bcp-ink"}`;
  return (
    <section aria-label={t("Capacidad de repago", "Repayment capacity")} className="space-y-4 rounded-xl border border-bcp-border bg-white p-4 sm:p-5">
      <SourceStrip cutoff={cutoff} compact />
      <div className={`grid gap-4 md:divide-x md:divide-bcp-divider [&>*]:md:px-4 [&>*:first-child]:md:pl-0 ${index !== null ? "md:grid-cols-[1fr_1.2fr_1.2fr_auto]" : "md:grid-cols-[1.2fr_1.2fr_auto]"}`}>
        {index !== null && (
          <div>
            <Lbl>{t("Índice de capacidad de repago (interno)", "Repayment capacity index (internal)")}</Lbl>
            <p className={`num mt-1 text-[36px] font-bold leading-none ${index >= 70 ? "text-bcp-green-text" : index >= 45 ? "text-bcp-ambar-text" : "text-bcp-naranja-text"}`}>{index}<span className="text-[16px] font-semibold text-bcp-muted"> / 100</span></p>
            <p className="mt-1.5 text-[13px] text-bcp-muted">{t("Distribución y controles · no visible para el banco", "Distribution and controls · not shown to the bank")}</p>
          </div>
        )}
        <div>
          <Lbl>{t("Cobertura esperada (P50)", "Expected coverage (P50)")}</Lbl>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className={`num text-[36px] font-bold leading-none ${INK[stateFromCoverage(d.p50)]}`}>{cov(d.p50)}</span>
            <span className="num text-[13px] text-bcp-muted">P10 {cov(d.p10)} · P90 {cov(d.p90)}</span>
          </p>
          <p className="mt-1.5 text-[13px] text-bcp-muted">
            {approval !== undefined ? t(`aprobación ${cov(approval)} · `, `approval ${cov(approval)} · `) : ""}
            {t(`equilibrio ${perKg(b.breakEvenUsdKg)}`, `break-even ${perKg(b.breakEvenUsdKg)}`)}
          </p>
        </div>
        <div>
          <Lbl>{middle?.label ?? lowHighLabel ?? t("Proyección al vencimiento", "Projection at maturity")}</Lbl>
          <p className="num mt-1 text-[28px] font-bold leading-tight text-bcp-ink">{middle ? middle.value : low !== undefined && high !== undefined ? range(low, high, lang) : t("Sin cambio", "No change")}</p>
          <p className="mt-1.5 text-[13px] text-bcp-muted">{middle?.sub ?? t("estimado", "estimate")}</p>
        </div>
        {chip && <div className="flex items-start md:justify-end">{chip}</div>}
      </div>

      <div className="border-t border-bcp-divider pt-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[13px] text-bcp-muted">{t("Distribución estimada P10–P90 de la cobertura", "Estimated P10–P90 distribution of coverage")} · {assumption}</p>
          <p className="flex flex-wrap items-center gap-3 text-[12px] text-bcp-muted">
            <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-bcp-green/30" />P10–P90</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-bcp-green/70" />P25–P75</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-bcp-green-text" />P50</span>
            {approval !== undefined && <span className="flex items-center gap-1.5"><span className="text-bcp-ink">▼</span>{t("Aprobación", "Approval")}</span>}
          </p>
        </div>
        <DistributionBar d={d} approval={approval} />
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
          <p className="num flex flex-wrap gap-x-4">
            {([["P10", d.p10], ["P25", d.p25], ["P50", d.p50], ["P75", d.p75], ["P90", d.p90]] as const).map(([k, v]) => (
              <span key={k} className={k === "P50" ? "font-semibold text-bcp-green-text" : "text-bcp-muted"}><b className="font-semibold text-bcp-ink">{k}</b> {cov(v)}</span>
            ))}
          </p>
          <p><b className="font-semibold">{t(`Cola bajo ${cov(COVERAGE_BANDS.naranja)}`, `Tail below ${cov(COVERAGE_BANDS.naranja)}`)}:</b> <span className={`num font-semibold ${d.tailBelow130 >= 10 ? "text-bcp-naranja-text" : "text-bcp-green-text"}`}>{d.tailBelow130}%</span> <span className="text-bcp-muted">({t("estimado", "estimate")})</span></p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <button type="button" onClick={() => toggle("q")} aria-expanded={panel === "q"} className={card(panel === "q")}>
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-bcp-muted">{t("Volumen exportable (Q)", "Exportable volume (Q)")}</span>
            <span className="text-[13px] font-semibold text-bcp-ink">{t("Campo y lo que lo mueve", "Field and drivers")} {panel === "q" ? "▴" : "›"}</span>
          </span>
          <span className="num mt-1 block text-[24px] font-bold">{kg(b.exportKg)}</span>
          <span className="block text-[13px] text-bcp-muted">
            {areaHa !== undefined && yieldTHa !== undefined
              ? t(`${areaHa.toFixed(2)} ha × ${yieldTHa.toFixed(1)} t/ha × ${b.exportablePct}% exportable`, `${areaHa.toFixed(2)} ha × ${yieldTHa.toFixed(1)} t/ha × ${b.exportablePct}% exportable`)
              : t(`${kg(b.volumeKg)} × ${b.exportablePct}% exportable`, `${kg(b.volumeKg)} × ${b.exportablePct}% exportable`)}
            {" · "}P10–P90 {kg(d.volume.p10)} {t("a", "to")} {kg(d.volume.p90)}
          </span>
          <span className="mt-2 block border-t border-bcp-divider pt-2 text-[13px]">{t("Con −30%", "At −30%")}: <span className="num">{kg(vb.exportKg)}</span> → {inked(volume)}</span>
        </button>
        <button type="button" onClick={() => toggle("p")} aria-expanded={panel === "p"} className={card(panel === "p")}>
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-bcp-muted">{t("Precio FOB esperado (P)", "Expected FOB price (P)")}</span>
            <span className="text-[13px] font-semibold text-bcp-ink">{t("Mercado y lo que lo mueve", "Market and drivers")} {panel === "p" ? "▴" : "›"}</span>
          </span>
          <span className="num mt-1 block text-[24px] font-bold">{perKg(b.priceUsdKg)}</span>
          <span className="block text-[13px] text-bcp-muted">
            {t(`equilibrio ${perKg(b.breakEvenUsdKg)}`, `break-even ${perKg(b.breakEvenUsdKg)}`)} · P10–P90 USD {d.price.p10.toFixed(2)} {t("a", "to")} {d.price.p90.toFixed(2)}
          </span>
          <span className="mt-2 block border-t border-bcp-divider pt-2 text-[13px]">{t("Con −20%", "At −20%")}: <span className="num">{perKg(pb.priceUsdKg)}</span> → {inked(price)}</span>
        </button>
      </div>

      {panel === "q" && (
        <div className="space-y-3 rounded-xl border border-bcp-border p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-[16px] font-bold">{t("Volumen exportable (Q): distribución estimada", "Exportable volume (Q): estimated distribution")}</h4>
            <span className="text-[12px] text-bcp-muted">{estimate}</span>
          </div>
          <div className="rounded-lg bg-bcp-bg/60 p-3">
            <p className="mb-1 text-[12px] text-bcp-muted">{t("Volumen exportable (t) · ámbar: bajo el umbral 1.50x · rojo: bajo el equilibrio (1.00x)", "Exportable volume (t) · amber: below the 1.50x threshold · red: below break-even (1.00x)")}</p>
            <div className="mx-auto max-w-[620px]">
              <BellCurve mean={b.exportKg} sd={d.volume.sd} fmt={(n) => `${(n / 1000).toFixed(1)} t`} shadeBelow={breakEvenKg} warnBelow={head.q.t150} shadeLabel={t("bajo equilibrio", "below break-even")}
                lines={[{ v: breakEvenKg, label: t("equilibrio", "break-even"), cls: "stroke-bcp-rojo" }, { v: vb.exportKg, label: "−30%", cls: "stroke-bcp-naranja" }]}
                ticks={[{ v: d.volume.p10, label: "P10" }, { v: d.volume.p50, label: "P50", strong: true }, { v: d.volume.p90, label: "P90" }]} />
            </div>
          </div>
          <Headroom h={head.q} unit={(n) => `${(n / 1000).toFixed(1)} t`} what={t("volumen, con el precio constante", "volume, price held")} />
          <p className="text-[12px] text-bcp-muted">{t("P50 = volumen esperado hoy. Los factores aún no confirmados (como El Niño) están en la proyección, no en la curva. Una curva normal subestima los choques extremos; por eso rige el estrés estándar.", "P50 = expected volume today. Factors not yet confirmed (such as El Niño) are in the projection, not in the curve. A normal curve understates extreme shocks; that is why the standard stress applies.")}</p>
          <p className="text-[13px] font-semibold text-bcp-muted">{t("Lo que mueve el volumen", "What moves the volume")}</p>
          <DriverList rows={drivers?.volume ?? []} />
        </div>
      )}
      {panel === "p" && (
        <div className="space-y-3 rounded-xl border border-bcp-border p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-[16px] font-bold">{t("Precio FOB (P): distribución estimada", "FOB price (P): estimated distribution")}</h4>
            <span className="text-[12px] text-bcp-muted">{estimate}</span>
          </div>
          <div className="rounded-lg bg-bcp-bg/60 p-3">
            <p className="mb-1 text-[12px] text-bcp-muted">{t("Precio FOB (USD/kg) · ámbar: bajo el umbral 1.50x · rojo: bajo el equilibrio del préstamo (1.00x)", "FOB price (USD/kg) · amber: below the 1.50x threshold · red: below the loan's break-even (1.00x)")}</p>
            <div className="mx-auto max-w-[620px]">
              <BellCurve mean={b.priceUsdKg} sd={d.price.sd} fmt={(n) => n.toFixed(2)} shadeBelow={b.breakEvenUsdKg} warnBelow={head.p.t150} shadeLabel={t("bajo equilibrio", "below break-even")}
                lines={[{ v: b.breakEvenUsdKg, label: t("equilibrio", "break-even"), cls: "stroke-bcp-rojo" }, { v: pb.priceUsdKg, label: "−20%", cls: "stroke-bcp-naranja" }]}
                ticks={[{ v: d.price.p10, label: "P10" }, { v: d.price.p50, label: "P50", strong: true }, { v: d.price.p90, label: "P90" }]} />
            </div>
          </div>
          <Headroom h={head.p} unit={(n) => `USD ${n.toFixed(2)}`} what={t("precio, con el volumen constante", "price, volume held")} />
          <p className="text-[12px] text-bcp-muted">{t("P50 = precio esperado a cosecha hoy. Una curva normal subestima los choques extremos; por eso rige el estrés estándar.", "P50 = expected harvest price today. A normal curve understates extreme shocks; that is why the standard stress applies.")}</p>
          <p className="text-[13px] font-semibold text-bcp-muted">{t("Lo que mueve el precio", "What moves the price")}</p>
          <DriverList rows={drivers?.price ?? []} />
        </div>
      )}

      {(onCalc || footnote) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-bcp-divider pt-3">
          <p className="text-[13px] text-bcp-muted">{footnote ?? t(`Saldo al vencimiento ${usd(b.dueUsd)} · ingreso neto ${usd(b.netUsd)} · bandas, tramos y decisiones son deterministas y auditables`, `Due at maturity ${usd(b.dueUsd)} · net revenue ${usd(b.netUsd)} · bands, tranches and decisions are deterministic and auditable`)}</p>
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
