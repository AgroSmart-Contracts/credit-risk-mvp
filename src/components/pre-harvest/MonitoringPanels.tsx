import { useMemo, useState, type ReactNode } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CROP_THRESHOLDS as CT, MARKET_THRESHOLDS as MT, WEATHER_THRESHOLDS as WT } from "../../lib/pre-harvest/config";
import { addDays, toTime } from "../../lib/pre-harvest/monitoring";
import { formatDate, formatMonth, formatUsd, t, tb } from "../../lib/pre-harvest/i18n";
import type { Bilingual, Lang, PanelId, PreHarvestDeal, TimelineFrame } from "../../lib/pre-harvest/types";
import type { CampaignSimulation } from "../../lib/pre-harvest/timeline";
import { ActionChip, DetailDialog, SectionTitle, SeverityChip } from "./ui";

const capitalFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
import { SatellitePanel } from "./SatellitePanel";
import { panelConclusions, type PanelConclusion } from "../../lib/pre-harvest/verdict";
import { cropOutlook, panelMoneyReading, priceOutlook } from "../../lib/pre-harvest/finance";
import type { NdviPoint } from "../../lib/pre-harvest/types";
import { CHART_COLORS as C } from "./theme";

const CHART_HEIGHT = 230;
const SENSITIVE_LABEL = { en: "Flowering / fruit-set window", es: "Ventana de floración / cuajado" };

/** One tick on the 1st of each month in [from, to] (avoids repeated month labels). */
function monthTicks(from: number, to: number): number[] {
  const out: number[] = [];
  const d = new Date(from);
  let cur = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  while (cur <= to) {
    out.push(cur);
    const c = new Date(cur);
    cur = Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + 1, 1);
  }
  return out;
}
const axisTick = { fontSize: 11, fill: C.axis };

function useAxis(lang: Lang) {
  return useMemo(
    () => ({
      tickFormatter: (v: number) => {
        const d = new Date(v).toISOString().slice(0, 10);
        return `${formatDate(d, lang).split(" ")[1]} ${d.slice(2, 4)}`;
      },
      tooltipLabel: (v: number) => formatDate(new Date(v).toISOString().slice(0, 10), lang),
    }),
    [lang],
  );
}

/**
 * Milestone markers and the cut-off cursor. Returned as an array of ReferenceLines:
 * Recharts 2 only renders its own element types as direct children, so a wrapper
 * component here would be silently dropped.
 */
function milestoneLines(deal: PreHarvestDeal, frameDate: string, lang: Lang) {
  // Pre-harvest and M3 are two weeks apart: put their labels on opposite sides of the line.
  const items: Array<[string, string, "insideTopLeft" | "insideTopRight"]> = [
    [deal.approvalDate, t("milestoneApproval", lang), "insideTopLeft"],
    [deal.fruitSetDate, t("milestoneFruitSet", lang), "insideTopLeft"],
    [deal.preHarvestDate, t("milestonePreHarvest", lang), "insideTopRight"],
    [deal.m3Date, t("milestoneM3", lang), "insideTopLeft"],
  ];
  return [
    ...items.map(([d, label, position]) => (
      <ReferenceLine
        key={label}
        x={toTime(d)}
        stroke={C.rule}
        strokeDasharray="2 3"
        // A milestone within ~12 days of today would print over the "Today" label: the line stays, its label goes.
        label={Math.abs(toTime(d) - toTime(frameDate)) < 12 * 86_400_000 ? undefined : { value: label, position, fontSize: 10, fill: C.muted }}
      />
    )),
    <ReferenceLine key="cutoff" x={toTime(frameDate)} stroke={C.ink} strokeWidth={1.5} label={{ value: lang === "es" ? "Hoy" : "Today", position: "insideBottomRight", fontSize: 10, fill: C.ink }} />,
  ];
}

type LegendItem = { label: string; color: string; kind: "line" | "dashed" | "area" };

function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-tm-text-light">
      {items.map((it) => (
        <li key={it.label} className="inline-flex items-center gap-1.5">
          {it.kind === "area" ? (
            <span className="h-2.5 w-4 rounded-sm" style={{ background: it.color, opacity: 0.25 }} />
          ) : (
            <span
              className="w-4"
              style={{ borderTop: `${it.kind === "line" ? 2.5 : 1.5}px ${it.kind === "dashed" ? "dashed" : "solid"} ${it.color}` }}
            />
          )}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

function PanelShell({
  title,
  subtitle,
  frame,
  panel,
  lang,
  source,
  children,
  extra,
  legend,
  conclusion,
  height = CHART_HEIGHT,
  forLoan,
  more,
}: {
  title: string;
  subtitle: string;
  frame: TimelineFrame;
  panel: PanelId;
  lang: Lang;
  source: string;
  children: ReactNode;
  extra?: ReactNode;
  legend?: LegendItem[];
  conclusion: PanelConclusion;
  height?: number;
  /** What this area means for the loan, in money. */
  forLoan?: Bilingual;
  /** More evidence behind the reading (e.g. the field images), opened on demand. */
  more?: ReactNode;
}) {
  const state = frame.panels[panel];
  const sevBorder = state.severity === "red" ? "border-l-tm-danger" : state.severity === "yellow" ? "border-l-tm-accent" : "border-l-tm-primary";
  const chart = (
    <>
      {extra}
      {legend && <Legend items={legend} />}
      <div style={{ height }}>{children}</div>
      <p className="mt-1 text-[11px] text-tm-text-muted">
        {source} · {lang === "es" ? "lectura de TruMarket" : "TruMarket reading"} {formatDate(frame.date, lang)}
      </p>
    </>
  );
  return (
    <div id={`panel-${panel}`} className="scroll-mt-20">
      {/* The money reading leads; what TruMarket saw is the supporting line; the chart opens on demand. */}
      <div className={`rounded-xl border border-l-4 border-tm-border bg-tm-surface p-4 shadow-tm-sm ${sevBorder}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-tm-text-muted">{title.replace(/^\d+ · /, "")}</p>
          <span className="flex items-center gap-2">
            <SeverityChip severity={state.severity} lang={lang} />
            <ActionChip action={conclusion.action} lang={lang} />
          </span>
        </div>
        {forLoan && <p className="mt-1.5 text-[15px] font-medium leading-snug text-tm-black">{capitalFirst(tb(forLoan, lang))}</p>}
        <p className="mt-1 text-xs text-tm-text-light">
          <span className="font-medium text-tm-black">{tb(conclusion.headline, lang)}</span> · {tb(conclusion.detail, lang)}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2 print:hidden">
          <DetailDialog title={title.replace(/^\d+ · /, "")} subtitle={subtitle} lang={lang}>
            {chart}
          </DetailDialog>
          {more}
        </div>
        <div className="mt-3 hidden print:block">{chart}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Dot renderer for an observed series: small dots, and a pulsing ring on the
 * latest reading so the eye lands on "now".
 */
function endDot(lastT: number | undefined, color: string, r = 2.5) {
  return function Dot(props: { cx?: number; cy?: number; payload?: { t: number }; index?: number }) {
    const { cx, cy, payload, index } = props;
    if (cx === undefined || cy === undefined || !Number.isFinite(cy)) return <g key={index} />;
    if (payload?.t === lastT) {
      return (
        <g key={index}>
          <circle cx={cx} cy={cy} r={9} fill={color} className="tm-ping" />
          <circle cx={cx} cy={cy} r={4.5} fill={color} stroke="white" strokeWidth={1.5} />
        </g>
      );
    }
    return <circle key={index} cx={cx} cy={cy} r={r} fill={color} />;
  };
}

function CropPanel({
  sim,
  deal,
  frame,
  lang,
  conclusion,
  ndviSeries,
}: {
  sim: CampaignSimulation;
  deal: PreHarvestDeal;
  frame: TimelineFrame;
  lang: Lang;
  conclusion: PanelConclusion;
  ndviSeries?: NdviPoint[];
}) {
  const axis = useAxis(lang);
  const end = addDays(deal.approvalDate, deal.tenorDays + 20);
  type Row = { t: number; ndvi?: number | null; median?: number; yellowLine?: number; redLine?: number; expected?: number; range?: [number, number] };
  const observed: Row[] = sim.series.crop
    .filter((p) => p.date <= end)
    .map((p) => ({
      t: toTime(p.date),
      ndvi: p.date <= frame.date ? p.ndvi : null,
      median: p.median,
      yellowLine: p.yellowLine,
      redLine: p.redLine,
    }));
  // Expected path to harvest, from the last reading: only while the campaign is still ahead.
  const outlook = ndviSeries && frame.date < deal.m3Date ? cropOutlook(ndviSeries, sim.series.crop, frame.date, addDays(deal.m3Date, 15)) : [];
  const byT = new Map(observed.map((r) => [r.t, r]));
  for (const o of outlook) {
    const t = toTime(o.date);
    const row = byT.get(t) ?? { t };
    row.expected = o.expected;
    row.range = [o.low, o.high];
    byT.set(t, row);
  }
  const data = [...byT.values()].sort((a, b) => a.t - b.t);
  const lastSeen = observed.filter((r) => r.ndvi !== null && r.ndvi !== undefined).at(-1)?.t;
  return (
    <PanelShell
      title={t("crop", lang)}
      subtitle={t("cropSub", lang)}
      frame={frame}
      panel="crop"
      conclusion={conclusion}
      lang={lang}
      source="Sentinel-2 L2A · 10 m · parcel mean, 16-day composites · Earth Search (AWS)"
      legend={[
        { label: t("ndvi", lang), color: C.green, kind: "line" },
        { label: t("median5y", lang), color: C.muted, kind: "dashed" },
        { label: `${t("yellowLine", lang)} −${CT.yellowPctBelowMedian}%`, color: C.yellow, kind: "dashed" },
        { label: `${t("redLine", lang)} −${CT.redPctBelowMedian}%`, color: C.red, kind: "dashed" },
        ...(outlook.length ? [{ label: lang === "es" ? "Trayectoria esperada a cosecha" : "Expected path to harvest", color: C.ink, kind: "dashed" as const }] : []),
      ]}
      forLoan={panelMoneyReading("crop", deal, sim, frame)}
      more={
        <DetailDialog label={lang === "es" ? "Ver imágenes del campo" : "View field images"} title={lang === "es" ? "Imágenes satelitales del predio" : "Parcel satellite images"} lang={lang}>
          <SatellitePanel cutoff={frame.date} parcelId={deal.parcelId} lang={lang} />
        </DetailDialog>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[toTime(addDays(deal.approvalDate, -120)), toTime(end)]}
            ticks={monthTicks(toTime(addDays(deal.approvalDate, -120)), toTime(end))}
            tickFormatter={axis.tickFormatter}
            tick={axisTick}
          />
          <YAxis domain={[0.2, 1]} ticks={[0.2, 0.4, 0.6, 0.8, 1]} allowDataOverflow tick={axisTick} tickFormatter={(v: number) => v.toFixed(1)} />
          <Tooltip
            labelFormatter={axis.tooltipLabel}
            formatter={(v: number | [number, number]) => (Array.isArray(v) ? `${v[0].toFixed(2)}–${v[1].toFixed(2)}` : v?.toFixed(3))}
          />
          <Area dataKey="range" name={lang === "es" ? "Rango esperado" : "Expected range"} stroke="none" fill={C.ink} fillOpacity={0.08} connectNulls isAnimationActive animationDuration={300} />
          {milestoneLines(deal, frame.date, lang)}
          <Line dataKey="median" name={t("median5y", lang)} stroke={C.muted} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          <Line dataKey="yellowLine" name={`${t("yellowLine", lang)} −${CT.yellowPctBelowMedian}%`} stroke={C.yellow} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
          <Line dataKey="redLine" name={`${t("redLine", lang)} −${CT.redPctBelowMedian}%`} stroke={C.red} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
          <Line dataKey="expected" name={lang === "es" ? "Esperado" : "Expected"} stroke={C.ink} strokeDasharray="4 4" strokeWidth={1.5} dot={false} connectNulls isAnimationActive animationDuration={300} />
          <Line
            dataKey="ndvi"
            name={t("ndvi", lang)}
            stroke={C.green}
            strokeWidth={2.5}
            dot={endDot(lastSeen, C.green)}
            activeDot={{ r: 5 }}
            connectNulls
            isAnimationActive
            animationDuration={400}
            animationEasing="ease-out"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </PanelShell>
  );
}

// ---------------------------------------------------------------------------

type WeatherTab = "temperature" | "rain" | "enso" | "water";

function WeatherPanel({
  sim,
  deal,
  frame,
  lang,
  conclusion,
}: {
  sim: CampaignSimulation;
  deal: PreHarvestDeal;
  frame: TimelineFrame;
  lang: Lang;
  conclusion: PanelConclusion;
}) {
  const axis = useAxis(lang);
  const [tab, setTab] = useState<WeatherTab>("temperature");
  const from = addDays(deal.approvalDate, -30);
  const end = addDays(deal.approvalDate, deal.tenorDays + 20);
  const sensitiveEnd = addDays(deal.fruitSetDate, sim.fruitSetDelayDays + WT.sensitiveWindowDaysAfterFruitSet);

  const daily = sim.series.weather
    .filter((p) => p.date >= from && p.date <= end)
    .map((p) => {
      const seen = p.date <= frame.date;
      return {
        t: toTime(p.date),
        tmax: seen ? p.tmax : null,
        tmin: seen ? p.tmin : null,
        precipZ: seen ? p.precipZ : null,
        waterCoverage: seen ? p.waterCoverage : null,
        demandPct: seen && p.demandFactor !== null ? Math.round((p.demandFactor - 1) * 100) : null,
      };
    });
  // Monthly SST anomalies; a month is shown once it is complete at the cut-off date.
  const lastComplete = addDays(`${frame.date.slice(0, 7)}-01`, -1).slice(0, 7);
  const enso = sim.series.enso
    .filter((p) => p.month >= from.slice(0, 7) && p.month <= end.slice(0, 7))
    .map((p) => ({
      t: toTime(`${p.month}-15`),
      nino12: p.month <= lastComplete ? p.nino12 : null,
      nino34: p.month <= lastComplete ? p.nino34 : null,
    }));

  const y = (label: string): LegendItem => ({ label, color: C.yellow, kind: "dashed" });
  const r = (label: string): LegendItem => ({ label, color: C.red, kind: "dashed" });
  const weatherLegend: LegendItem[] =
    tab === "temperature"
      ? [
          { label: t("tmax", lang), color: C.red, kind: "line" },
          { label: t("tmin", lang), color: C.blue, kind: "line" },
          y(`${t("yellowLine", lang)} ${WT.tmaxYellow} °C / ${WT.tminYellow} °C`),
          r(`${t("redLine", lang)} ${WT.tmaxRed} °C`),
          { label: tb(SENSITIVE_LABEL, lang), color: C.yellow, kind: "area" },
        ]
      : tab === "rain"
        ? [{ label: t("precipZ", lang), color: C.blue, kind: "line" }, y(`|z| ${WT.precipZYellow}`), r(`z ${WT.precipZRed}`)]
        : tab === "enso"
          ? [
              { label: t("nino12", lang), color: C.ink, kind: "line" },
              { label: t("nino34", lang), color: C.muted, kind: "dashed" },
              y(`+${WT.ensoYellow} °C`),
              r(`+${WT.ensoRed} °C`),
            ]
          : [
              { label: t("waterCoverageLabel", lang), color: C.blue, kind: "line" },
              y(`${WT.waterCoverageYellow.toFixed(2)}×`),
              r(`${WT.waterCoverageRed.toFixed(2)}×`),
            ];

  const tabs: Array<[WeatherTab, string]> = [
    ["temperature", t("temperature", lang)],
    ["rain", t("rain", lang)],
    ["enso", t("enso", lang)],
    ["water", t("water", lang)],
  ];

  // An array, not a fragment: Recharts 2 ignores children wrapped in a Fragment.
  const common = [
    <CartesianGrid key="grid" stroke="#f0f0f0" vertical={false} />,
    <XAxis
      key="x"
      dataKey="t"
      type="number"
      scale="time"
      domain={[toTime(from), toTime(end)]}
      ticks={monthTicks(toTime(from), toTime(end))}
      tickFormatter={axis.tickFormatter}
      tick={axisTick}
    />,
    <Tooltip
      key="tip"
      labelFormatter={axis.tooltipLabel}
      formatter={(v: number) => (typeof v === "number" ? v.toFixed(2) : v)}
    />,
  ];

  return (
    <PanelShell
      title={t("weather", lang)}
      subtitle={t("weatherSub", lang)}
      frame={frame}
      panel="weather"
      forLoan={panelMoneyReading("weather", deal, sim, frame)}
      conclusion={conclusion}
      lang={lang}
      source="Open-Meteo ERA5 (temperature, rain, evapotranspiration) · NOAA CPC OISST Niño 1+2 / 3.4"
      legend={weatherLegend}
      extra={
        <div className="mb-2 flex flex-wrap gap-1" role="tablist">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${tab === id ? "bg-tm-primary text-white" : "bg-tm-neutral-light text-tm-text-light hover:text-tm-black"}`}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        {tab === "temperature" ? (
          <ComposedChart data={daily} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
            {common}
            <YAxis domain={[0, 40]} tick={axisTick} />
            <ReferenceArea x1={toTime(deal.approvalDate)} x2={toTime(sensitiveEnd)} fill={C.yellow} fillOpacity={0.12} />
            {milestoneLines(deal, frame.date, lang)}
            <ReferenceLine y={WT.tmaxYellow} stroke={C.yellow} strokeDasharray="3 3" />
            <ReferenceLine y={WT.tmaxRed} stroke={C.red} strokeDasharray="3 3" />
            <ReferenceLine y={WT.tminYellow} stroke={C.yellow} strokeDasharray="3 3" />
            <Line dataKey="tmax" name={t("tmax", lang)} stroke={C.red} dot={false} strokeWidth={1.5} isAnimationActive animationDuration={400} />
            <Line dataKey="tmin" name={t("tmin", lang)} stroke={C.blue} dot={false} strokeWidth={1.5} isAnimationActive={false} />
          </ComposedChart>
        ) : tab === "rain" ? (
          <ComposedChart data={daily} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
            {common}
            <YAxis domain={[-3, 4]} tick={axisTick} />
            {milestoneLines(deal, frame.date, lang)}
            <ReferenceLine y={WT.precipZYellow} stroke={C.yellow} strokeDasharray="3 3" />
            <ReferenceLine y={WT.precipZRed} stroke={C.red} strokeDasharray="3 3" />
            <ReferenceLine y={-WT.precipZYellow} stroke={C.yellow} strokeDasharray="3 3" />
            <Line dataKey="precipZ" name={t("precipZ", lang)} stroke={C.blue} dot={false} strokeWidth={1.5} isAnimationActive animationDuration={400} />
          </ComposedChart>
        ) : tab === "enso" ? (
          <ComposedChart data={enso} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
            {common}
            <YAxis domain={[-1.5, 2.5]} tick={axisTick} />
            {milestoneLines(deal, frame.date, lang)}
            <ReferenceLine y={0} stroke={C.rule} />
            <ReferenceLine y={WT.ensoYellow} stroke={C.yellow} strokeDasharray="3 3" />
            <ReferenceLine y={WT.ensoRed} stroke={C.red} strokeDasharray="3 3" />
            <Line dataKey="nino34" name={t("nino34", lang)} stroke={C.muted} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <Line dataKey="nino12" name={t("nino12", lang)} stroke={C.ink} strokeWidth={2} dot={{ r: 3 }} isAnimationActive animationDuration={400} />
          </ComposedChart>
        ) : (
          <ComposedChart data={daily} margin={{ top: 12, right: 8, left: -10, bottom: 0 }}>
            {common}
            <YAxis domain={[0.6, 1.4]} tick={axisTick} tickFormatter={(v: number) => `${v.toFixed(1)}×`} />
            {milestoneLines(deal, frame.date, lang)}
            <ReferenceLine y={WT.waterCoverageYellow} stroke={C.yellow} strokeDasharray="3 3" />
            <ReferenceLine y={WT.waterCoverageRed} stroke={C.red} strokeDasharray="3 3" />
            <Line dataKey="waterCoverage" name={t("waterCoverageLabel", lang)} stroke={C.blue} strokeWidth={1.5} dot={false} isAnimationActive animationDuration={400} />
          </ComposedChart>
        )}
      </ResponsiveContainer>
    </PanelShell>
  );
}

// ---------------------------------------------------------------------------

function MarketPanel({
  sim,
  deal,
  frame,
  lang,
  conclusion,
}: {
  sim: CampaignSimulation;
  deal: PreHarvestDeal;
  frame: TimelineFrame;
  lang: Lang;
  conclusion: PanelConclusion;
}) {
  const axis = useAxis(lang);
  // Same window as the other panels: from four months before approval to just after maturity.
  const fromDate = addDays(deal.approvalDate, -120);
  const toDate = addDays(deal.approvalDate, deal.tenorDays + 20);
  const from = fromDate.slice(0, 7);
  const end = toDate.slice(0, 7);
  const visible = frame.date.slice(0, 7);
  type Row = { t: number; price: number | null; band: [number, number]; p10: number; p25: number; p50: number; expected?: number };
  const rows = new Map<string, Row>();
  for (const p of sim.series.market.filter((x) => x.month >= from && x.month <= end)) {
    rows.set(p.month, { t: toTime(`${p.month}-15`), price: p.month < visible ? p.usdPerKg : null, band: [p.p25, p.p75], p10: p.p10, p25: p.p25, p50: p.p50 });
  }
  // Months with no data yet carry the seasonal band, and the expected price while harvest is ahead.
  for (const o of priceOutlook(sim, frame.date, end)) {
    if (o.month < from) continue;
    const row = rows.get(o.month) ?? { t: toTime(`${o.month}-15`), price: null, band: [o.p25, o.p75] as [number, number], p10: o.p10, p25: o.p25, p50: o.p50 };
    if (frame.date < deal.m3Date || o.month <= deal.m3Date.slice(0, 7)) row.expected = o.expected;
    rows.set(o.month, row);
  }
  const data = [...rows.values()].sort((x, y) => x.t - y.t);
  const current = sim.series.market.filter((p) => p.month < visible).at(-1);
  const outlook = data.filter((r) => r.expected !== undefined);
  const lastSeen = data.filter((r) => r.price !== null).at(-1)?.t;

  return (
    <PanelShell
      title={t("market", lang)}
      subtitle={t("marketSub", lang)}
      frame={frame}
      panel="market"
      conclusion={conclusion}
      lang={lang}
      legend={[
        { label: t("price", lang), color: C.ink, kind: "line" },
        { label: t("band", lang), color: C.green, kind: "area" },
        { label: t("seasonalMedian", lang), color: C.muted, kind: "dashed" },
        { label: `${t("yellowLine", lang)} P25`, color: C.yellow, kind: "dashed" },
        { label: `${t("redLine", lang)} P10`, color: C.red, kind: "dashed" },
        ...(outlook.length > 1 ? [{ label: lang === "es" ? "Precio esperado a cosecha" : "Expected price to harvest", color: C.ink, kind: "dashed" as const }] : []),
      ]}
      forLoan={panelMoneyReading("market", deal, sim, frame)}
      source={
        lang === "es"
          ? "Veritrade (por embarque, aduanas Perú) · UN Comtrade (historia para la banda estacional)"
          : "Veritrade (shipment level, Peru customs) · UN Comtrade (history for the seasonal band)"
      }
      extra={
        <dl className="mb-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="rounded-md bg-tm-neutral-light px-2 py-1.5">
            <dt className="text-tm-text-muted">{t("price", lang)}</dt>
            <dd className="font-semibold text-tm-black">{current ? `$${current.usdPerKg.toFixed(2)} · ${formatMonth(current.month, lang)}` : "–"}</dd>
          </div>
          <div className="rounded-md bg-tm-neutral-light px-2 py-1.5">
            <dt className="text-tm-text-muted">{t("expectedHarvestPrice", lang)}</dt>
            <dd className="font-semibold text-tm-black">
              {frame.expectedHarvestPrice === null ? "–" : `$${frame.expectedHarvestPrice.toFixed(2)}`}
              <span className="font-normal text-tm-text-light">
                {" "}
                · {t("reference", lang)} ${sim.referencePrice.toFixed(2)}
              </span>
            </dd>
          </div>
          <div className="rounded-md bg-tm-neutral-light px-2 py-1.5">
            <dt className="text-tm-text-muted">{t("expectedRevenue", lang)}</dt>
            <dd className="font-semibold text-tm-black">{frame.expectedRevenueUsd === null ? "–" : formatUsd(frame.expectedRevenueUsd, lang)}</dd>
          </div>
          <div className="rounded-md bg-tm-neutral-light px-2 py-1.5">
            <dt className="text-tm-text-muted">{t("coverage", lang)}</dt>
            <dd className="font-semibold text-tm-black">
              {frame.coverageRatio === null ? "–" : `${frame.coverageRatio.toFixed(2)}× (${t("yellowLine", lang).toLowerCase()} <${MT.coverageYellow}×)`}
            </dd>
          </div>
        </dl>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[toTime(fromDate), toTime(toDate)]}
            ticks={monthTicks(toTime(fromDate), toTime(toDate))}
            tickFormatter={axis.tickFormatter}
            tick={axisTick}
          />
          <YAxis domain={[1, 3.2]} tick={axisTick} tickFormatter={(v: number) => `$${v.toFixed(1)}`} />
          <Tooltip
            labelFormatter={axis.tooltipLabel}
            formatter={(v: number | [number, number]) => (Array.isArray(v) ? `$${v[0].toFixed(2)}–$${v[1].toFixed(2)}` : `$${v?.toFixed(2)}`)}
          />
          {milestoneLines(deal, frame.date, lang)}
          <Area dataKey="band" name={t("band", lang)} stroke="none" fill={C.green} fillOpacity={0.12} isAnimationActive={false} />
          <Line dataKey="p50" name={t("seasonalMedian", lang)} stroke={C.muted} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          <Line dataKey="p25" name={`${t("yellowLine", lang)} P25`} stroke={C.yellow} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
          <Line dataKey="p10" name={`${t("redLine", lang)} P10`} stroke={C.red} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
          <Line dataKey="expected" name={lang === "es" ? "Esperado" : "Expected"} stroke={C.ink} strokeDasharray="4 4" strokeWidth={1.5} dot={false} connectNulls isAnimationActive animationDuration={300} />
          <Line dataKey="price" name={t("price", lang)} stroke={C.ink} strokeWidth={2.5} dot={endDot(lastSeen, C.ink, 3)} activeDot={{ r: 5 }} isAnimationActive animationDuration={400} animationEasing="ease-out" />
        </ComposedChart>
      </ResponsiveContainer>
    </PanelShell>
  );
}

function TakeoutPanel({
  sim,
  deal,
  frame,
  lang,
  conclusion,
}: {
  sim: CampaignSimulation;
  deal: PreHarvestDeal;
  frame: TimelineFrame;
  lang: Lang;
  conclusion: PanelConclusion;
}) {
  const tk = sim.takeout;
  const reached = frame.date >= deal.m3Date;
  const signed = reached && tk.poSignedDate !== null && tk.poSignedDate <= frame.date;
  const poValue = tk.poVolumeKg * tk.poPriceUsdPerKg;
  const advance = tk.coface === "declined" ? 0 : poValue * (tk.cofaceCoveragePct / 100) * (tk.advanceRatePct / 100);
  const ratio = Math.min(1.6, advance / sim.amountDue);
  const cofaceText: Record<typeof tk.coface, Bilingual> = {
    approved: { en: "Approved", es: "Aprobado" },
    reduced: { en: `Reduced to ${tk.cofaceCoveragePct}%`, es: `Reducido al ${tk.cofaceCoveragePct}%` },
    declined: { en: "Declined", es: "Rechazado" },
    pending: { en: "Pending", es: "Pendiente" },
  };
  const steps: Array<{ label: string; value: string; ok: boolean | null }> = [
    {
      label: t("tkPo", lang),
      value: signed
        ? `${formatDate(tk.poSignedDate!, lang)} · ${tk.poVolumeKg.toLocaleString("en-US")} kg × $${tk.poPriceUsdPerKg.toFixed(2)}`
        : reached
          ? t("tkNotSigned", lang)
          : t("tkExpected", lang),
      ok: reached ? signed : null,
    },
    {
      label: t("tkCoface", lang),
      value: reached ? `${tb(cofaceText[tk.coface], lang)} · ${tk.buyerCountry}` : t("tkExpected", lang),
      ok: reached ? tk.coface === "approved" || tk.coface === "reduced" : null,
    },
    {
      label: t("tkAdvance", lang),
      value:
        reached && signed
          ? `${formatUsd(advance, lang)} (${tk.advanceRatePct}% × ${tk.cofaceCoveragePct}% × ${formatUsd(poValue, lang)})`
          : "–",
      ok: reached && signed ? advance >= sim.amountDue : null,
    },
  ];
  const barClass = !(reached && signed) ? "bg-tm-border" : ratio >= 1.1 ? "bg-tm-primary" : ratio >= 1 ? "bg-tm-accent" : "bg-tm-danger";
  return (
    <PanelShell
      title={t("tkTitle", lang)}
      subtitle={t("tkSub", lang)}
      frame={frame}
      panel="takeout"
      forLoan={panelMoneyReading("takeout", deal, sim, frame)}
      conclusion={conclusion}
      lang={lang}
      source={t("tkSource", lang)}
      height={150}
    >
      <div className="grid h-full gap-4 md:grid-cols-[1.3fr_1fr]">
        <ol className="space-y-2.5">
          {steps.map((st, i) => (
            <li key={st.label} className="flex items-start gap-2.5">
              <span
                className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                  st.ok === null ? "bg-tm-neutral text-tm-text-muted" : st.ok ? "bg-tm-primary text-white" : "bg-tm-danger text-white"
                }`}
              >
                {st.ok === null ? i + 1 : st.ok ? "✓" : "✕"}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-tm-black">{st.label}</p>
                <p className="text-xs text-tm-text-light">{st.value}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-col justify-center">
          <p className="text-xs text-tm-text-muted">{t("tkCoverage", lang)}</p>
          <div className="relative mt-2 h-3 rounded-full bg-tm-neutral">
            <div className={`h-full rounded-full ${barClass}`} style={{ width: `${(Math.max(0, ratio) / 1.6) * 100}%` }} />
            <span className="absolute -top-1 -bottom-1 w-0.5 bg-tm-black" style={{ left: `${(1 / 1.6) * 100}%` }} title="1.0×" />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-tm-text-light">
            <span>
              {t("tkDue", lang)} {formatUsd(sim.amountDue, lang)}
            </span>
            <span className="font-semibold text-tm-black">{reached && signed ? `${(advance / sim.amountDue).toFixed(2)}×` : "–"}</span>
          </div>
        </div>
      </div>
    </PanelShell>
  );
}

export function MonitoringPanels(props: { sim: CampaignSimulation; deal: PreHarvestDeal; frame: TimelineFrame; lang: Lang; ndviSeries?: NdviPoint[] }) {
  const { sim, deal, frame, lang } = props;
  const conclusions = panelConclusions(sim, frame, deal);
  return (
    <div>
      <SectionTitle
        title={t("monitoring", lang)}
        hint={
          lang === "es"
            ? `Cada tarjeta dice primero qué significa para el préstamo; el gráfico y los datos se abren aparte. Normal · Vigilar (alerta y re-score) · Riesgo alto (detener desembolsos). ${t("thresholdPolicy", lang)}.`
            : `Each card says first what it means for the loan; the chart and data open separately. Normal · Watch (alert and re-score) · High risk (stop disbursement). ${t("thresholdPolicy", lang)}.`
        }
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <CropPanel {...props} conclusion={conclusions.crop} />
        <WeatherPanel {...props} conclusion={conclusions.weather} />
        <MarketPanel {...props} conclusion={conclusions.market} />
        <TakeoutPanel {...props} conclusion={conclusions.takeout} />
      </div>
    </div>
  );
}
