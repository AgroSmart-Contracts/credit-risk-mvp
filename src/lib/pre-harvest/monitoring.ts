/**
 * Monitoring panels: turn raw series into banded chart series and evaluate the
 * yellow / red rules from config.ts at any date. Pure functions, no I/O.
 */
import { formatMonth } from "./i18n";
import { CROP_THRESHOLDS as CT, MARKET_THRESHOLDS as MT, TAKEOUT_THRESHOLDS as TT, WEATHER_THRESHOLDS as WT } from "./config";
import type {
  Bilingual,
  ClimateFixture,
  MarketFixture,
  NdviPoint,
  PanelState,
  PreHarvestDeal,
  Severity,
  TakeoutInputs,
  Trigger,
} from "./types";

const DAY = 86_400_000;
export const toTime = (d: string) => Date.parse(`${d.slice(0, 10)}T00:00:00Z`);
export const addDays = (d: string, n: number) => new Date(toTime(d) + n * DAY).toISOString().slice(0, 10);
const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;
const median = (v: number[]) => {
  if (!v.length) return NaN;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
export function quantile(values: number[], q: number): number {
  const s = [...values].sort((a, b) => a - b);
  if (!s.length) return NaN;
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

function doy(date: string): number {
  const [, m, d] = date.split("-").map(Number);
  return Math.floor((Date.UTC(2001, m - 1, Math.min(d, m === 2 ? 28 : d)) - Date.UTC(2001, 0, 1)) / DAY) + 1;
}
const doyDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 365 - Math.abs(a - b));

function worst(triggers: Trigger[]): Severity {
  if (triggers.some((t) => t.severity === "red")) return "red";
  if (triggers.length) return "yellow";
  return "green";
}

// ---------------------------------------------------------------------------
// Panel 1 · Crop health (NDVI)
// ---------------------------------------------------------------------------

export interface CropPoint {
  date: string;
  ndvi: number;
  /** Field's own median for this time of year over the previous N years. */
  median: number;
  yellowLine: number;
  redLine: number;
  pctVsMedian: number;
  /** Vegetation Condition Index 0–100 against the full same-season history. */
  vci: number;
}

/** Baseline for one composite: same-season values from previous years. */
/** Years whose annual median NDVI shows an established canopy. */
const establishedCache = new WeakMap<NdviPoint[], Set<number>>();
function establishedYears(series: NdviPoint[]): Set<number> {
  const hit = establishedCache.get(series);
  if (hit) return hit;
  const byYear = new Map<number, number[]>();
  for (const p of series) {
    const y = Number(p.date.slice(0, 4));
    (byYear.get(y) ?? byYear.set(y, []).get(y)!).push(p.ndvi);
  }
  const out = new Set([...byYear].filter(([, v]) => median(v) >= CT.establishedMinNdvi).map(([y]) => y));
  establishedCache.set(series, out);
  return out;
}

export function ndviBaseline(series: NdviPoint[], date: string) {
  const year = Number(date.slice(0, 4));
  const target = doy(date);
  const established = establishedYears(series);
  const sameSeason = series.filter((p) => {
    const y = Number(p.date.slice(0, 4));
    return y < year && established.has(y) && doyDistance(doy(p.date), target) <= CT.seasonWindowDays;
  });
  const recent = sameSeason.filter((p) => Number(p.date.slice(0, 4)) >= year - CT.baselineYears);
  const all = sameSeason.map((p) => p.ndvi);
  const allYears = new Set(sameSeason.map((p) => p.date.slice(0, 4))).size;
  return {
    median: median(recent.map((p) => p.ndvi)),
    min: all.length ? Math.min(...all) : NaN,
    max: all.length ? Math.max(...all) : NaN,
    years: new Set(recent.map((p) => p.date.slice(0, 4))).size,
    allYears,
  };
}

/**
 * Sentinel-2 parcel readings (every ~5 days when clear) → 16-day composites, the
 * same rhythm the crop thresholds are written for (MODIS-style bins from 1 Jan).
 */
export function sentinelComposites(series: Array<{ date: string; ndviMean: number }>): NdviPoint[] {
  const bins = new Map<string, number[]>();
  for (const p of series) {
    const y = p.date.slice(0, 4);
    const bin = Math.floor((doy(p.date) - 1) / 16);
    const start = new Date(Date.UTC(Number(y), 0, 1 + bin * 16)).toISOString().slice(0, 10);
    (bins.get(start) ?? bins.set(start, []).get(start)!).push(p.ndviMean);
  }
  return [...bins.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ndvi: round(v.reduce((s, x) => s + x, 0) / v.length) }));
}

export function buildCropSeries(series: NdviPoint[], from: string, to: string): CropPoint[] {
  return series
    .filter((p) => p.date >= from && p.date <= to)
    .map((p) => {
      const b = ndviBaseline(series, p.date);
      // Too few years on record: report a neutral VCI rather than a misleading extreme.
      const range = b.allYears >= CT.vciMinYears ? b.max - b.min : 0;
      return {
        date: p.date,
        ndvi: p.ndvi,
        median: round(b.median),
        yellowLine: round(b.median * (1 - CT.yellowPctBelowMedian / 100)),
        redLine: round(b.median * (1 - CT.redPctBelowMedian / 100)),
        pctVsMedian: round(((p.ndvi - b.median) / b.median) * 100, 1),
        vci: range > 0 ? round(Math.max(0, Math.min(100, ((p.ndvi - b.min) / range) * 100)), 1) : 50,
      };
    })
    .filter((p) => Number.isFinite(p.median));
}

export function evaluateCrop(
  points: CropPoint[],
  asOf: string,
  deal: PreHarvestDeal,
  fruitSetDelayDays: number,
): PanelState {
  const upTo = points.filter((p) => p.date <= asOf);
  const triggers: Trigger[] = [];
  const last = upTo.at(-1);

  const lastN = (n: number) => upTo.slice(-n);
  const red3 = lastN(CT.redConsecutiveBins);
  const yellow2 = lastN(CT.yellowConsecutiveBins);

  if (red3.length === CT.redConsecutiveBins && red3.every((p) => p.pctVsMedian <= -CT.redPctBelowMedian)) {
    triggers.push({
      panel: "crop",
      metric: "ndvi_below_median",
      date: last!.date,
      value: last!.pctVsMedian,
      limit: `≤ −${CT.redPctBelowMedian}% × ${CT.redConsecutiveBins}`,
      severity: "red",
      message: {
        en: `NDVI ${CT.redPctBelowMedian}%+ below the field's 5-year median for ${CT.redConsecutiveBins} composites in a row`,
        es: `NDVI ${CT.redPctBelowMedian}%+ bajo la mediana de 5 años del campo por ${CT.redConsecutiveBins} compuestos seguidos`,
      },
    });
  } else if (
    yellow2.length === CT.yellowConsecutiveBins &&
    yellow2.every((p) => p.pctVsMedian <= -CT.yellowPctBelowMedian)
  ) {
    triggers.push({
      panel: "crop",
      metric: "ndvi_below_median",
      date: last!.date,
      value: last!.pctVsMedian,
      limit: `≤ −${CT.yellowPctBelowMedian}% × ${CT.yellowConsecutiveBins}`,
      severity: "yellow",
      message: {
        en: `NDVI ${CT.yellowPctBelowMedian}%+ below the field's 5-year median for ${CT.yellowConsecutiveBins} composites in a row`,
        es: `NDVI ${CT.yellowPctBelowMedian}%+ bajo la mediana de 5 años del campo por ${CT.yellowConsecutiveBins} compuestos seguidos`,
      },
    });
  }

  const vciRun = lastN(CT.vciConsecutiveBins);
  const vciLow = (p: CropPoint) => p.vci < CT.vciYellow && p.pctVsMedian <= -CT.vciMinBelowMedianPct;
  if (last && vciRun.length === CT.vciConsecutiveBins && vciRun.every(vciLow)) {
    const red = vciRun.every((p) => p.vci < CT.vciRed);
    triggers.push({
      panel: "crop",
      metric: "vci",
      date: last.date,
      value: last.vci,
      limit: `< ${red ? CT.vciRed : CT.vciYellow}`,
      severity: red ? "red" : "yellow",
      message: {
        en: `Vegetation Condition Index ${last.vci} (${red ? "severe stress" : "stress"})`,
        es: `Índice de Condición de Vegetación ${last.vci} (${red ? "estrés severo" : "estrés"})`,
      },
    });
  }

  if (fruitSetDelayDays > CT.fruitSetLateRedDays && asOf >= addDays(deal.fruitSetDate, CT.fruitSetLateRedDays)) {
    triggers.push({
      panel: "crop",
      metric: "fruit_set_late",
      date: asOf,
      value: fruitSetDelayDays,
      limit: `> ${CT.fruitSetLateRedDays} d`,
      severity: "red",
      message: {
        en: `Fruit set ${fruitSetDelayDays} days later than the declared calendar`,
        es: `Cuajado ${fruitSetDelayDays} días después del calendario declarado`,
      },
    });
  }

  return { panel: "crop", severity: worst(triggers), triggers };
}

/**
 * Satellite yield adjustment used by the market panel: the mean NDVI ÷ median of
 * the last few composites, clamped. Inside the dead-band it stays at 1: an
 * evergreen orchard's NDVI moves ±10% from cloud residue and canopy cycles, and
 * that is not a yield signal.
 */
export function yieldAdjustment(points: CropPoint[], asOf: string): number {
  const recent = points.filter((p) => p.date <= asOf).slice(-MT.yieldAdjustComposites);
  if (!recent.length) return 1;
  const ratio = recent.reduce((s, p) => s + p.ndvi / p.median, 0) / recent.length;
  if (ratio >= 1 - MT.yieldAdjustDeadBandPct / 100) return 1;
  return Math.min(MT.yieldAdjustMax, Math.max(MT.yieldAdjustMin, ratio));
}

// ---------------------------------------------------------------------------
// Panel 2 · Weather and water
// ---------------------------------------------------------------------------

export interface WeatherPoint {
  date: string;
  tmax: number | null;
  tmin: number | null;
  rh: number | null;
  et0: number | null;
  precip: number | null;
  precip30: number;
  precipZ: number;
  /** Last 30 days of reference evapotranspiration ÷ normal for the season (1 = normal demand). */
  demandFactor: number | null;
  /** Licensed water ÷ current crop demand (allocation ÷ (declared need × demandFactor)). */
  waterCoverage: number | null;
}

export function buildWeatherSeries(
  climate: ClimateFixture,
  from: string,
  to: string,
  deal?: PreHarvestDeal,
): WeatherPoint[] {
  const days = climate.weather;
  const licence = deal ? deal.formato.waterAllocationM3PerHa / deal.formato.cropWaterNeedM3PerHa : null;
  const out: WeatherPoint[] = [];
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    if (d.date < from || d.date > to) continue;
    let sum = 0;
    let et0 = 0;
    let et0Days = 0;
    for (let k = Math.max(0, i - 29); k <= i; k++) {
      sum += days[k].precip ?? 0;
      if (days[k].et0 !== null) {
        et0 += days[k].et0!;
        et0Days++;
      }
    }
    const clim = climate.precipClimatology[doy(d.date) - 1];
    const std = Math.max(clim?.std30 ?? 0, WT.precipMinStdMm);
    const et0Normal = climate.et0Climatology[doy(d.date) - 1]?.mean30 ?? 0;
    const demandFactor = et0Days >= WT.waterLookbackDays * 0.8 && et0Normal > 0 ? (et0 * (30 / et0Days)) / et0Normal : null;
    out.push({
      date: d.date,
      tmax: d.tmax,
      tmin: d.tmin,
      rh: d.rh,
      et0: d.et0,
      precip: d.precip,
      precip30: round(sum, 1),
      precipZ: round((sum - (clim?.mean30 ?? 0)) / std, 2),
      demandFactor: demandFactor === null ? null : round(demandFactor, 3),
      waterCoverage: demandFactor === null || licence === null ? null : round(licence / demandFactor, 3),
    });
  }
  return out;
}

/**
 * Coastal El Niño signal the bank would know at `asOf`: the mean Niño 1+2 anomaly of
 * the last N complete months (an operational stand-in for ENFEN's ICEN, which is a
 * centred 3-month mean and so is only final a month later).
 */
/** One category scale for the coastal El Niño signal, used everywhere it is named. */
export function ensoCategory(v: number): Bilingual {
  if (v >= 3) return { en: "extraordinary", es: "extraordinario" };
  if (v >= WT.ensoRed) return { en: "strong", es: "fuerte" };
  if (v >= WT.ensoYellow) return { en: "moderate", es: "moderado" };
  if (v >= 0.4) return { en: "weak", es: "débil" };
  return { en: "neutral", es: "neutro" };
}

export function ensoAt(climate: Pick<ClimateFixture, "enso">, asOf: string): { month: string; value: number; nino34: number } | null {
  const lastComplete = addDays(`${asOf.slice(0, 7)}-01`, -1).slice(0, 7);
  const known = climate.enso.filter((p) => p.month <= lastComplete).slice(-WT.ensoWindowMonths);
  if (known.length < WT.ensoWindowMonths) return null;
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return {
    month: known.at(-1)!.month,
    value: round(mean(known.map((p) => p.nino12)), 2),
    nino34: round(mean(known.map((p) => p.nino34)), 2),
  };
}

export function evaluateWeather(
  series: WeatherPoint[],
  climate: ClimateFixture,
  asOf: string,
  deal: PreHarvestDeal,
  fruitSetDelayDays: number,
): PanelState {
  const triggers: Trigger[] = [];
  const window = series.filter((p) => p.date <= asOf && p.date > addDays(asOf, -WT.lookbackDays));
  const today = series.filter((p) => p.date <= asOf).at(-1);
  const sensitiveEnd = addDays(deal.fruitSetDate, fruitSetDelayDays + WT.sensitiveWindowDaysAfterFruitSet);
  const sensitive = asOf >= deal.approvalDate && asOf <= sensitiveEnd;

  if (sensitive && window.length) {
    const tmaxPeak = Math.max(...window.map((p) => p.tmax ?? -99));
    const hotDays = window.filter((p) => (p.tmax ?? -99) > WT.tmaxYellow).length;
    if (tmaxPeak > WT.tmaxRed) {
      triggers.push({
        panel: "weather", metric: "heat", date: asOf, value: tmaxPeak, limit: `> ${WT.tmaxRed} °C`, severity: "red",
        message: { en: `Heat ${tmaxPeak.toFixed(1)} °C during flowering / fruit set`, es: `Calor ${tmaxPeak.toFixed(1)} °C en floración / cuajado` },
      });
    } else if (hotDays >= WT.heatYellowDays) {
      triggers.push({
        panel: "weather", metric: "heat", date: asOf, value: hotDays, limit: `${WT.heatYellowDays}+ d > ${WT.tmaxYellow} °C`, severity: "yellow",
        message: { en: `${hotDays} days above ${WT.tmaxYellow} °C during flowering / fruit set`, es: `${hotDays} días sobre ${WT.tmaxYellow} °C en floración / cuajado` },
      });
    }

    const tminLow = Math.min(...window.map((p) => p.tmin ?? 99));
    const coldDays = window.filter((p) => (p.tmin ?? 99) < WT.tminYellow).length;
    if (tminLow <= WT.frostTminRed) {
      triggers.push({
        panel: "weather", metric: "cold", date: asOf, value: tminLow, limit: `≤ ${WT.frostTminRed} °C`, severity: "red",
        message: { en: `Frost ${tminLow.toFixed(1)} °C at fruit set`, es: `Helada ${tminLow.toFixed(1)} °C en cuajado` },
      });
    } else if (coldDays >= WT.coldYellowDays) {
      triggers.push({
        panel: "weather", metric: "cold", date: asOf, value: coldDays, limit: `${WT.coldYellowDays}+ d < ${WT.tminYellow} °C`, severity: "yellow",
        message: { en: `${coldDays} cold nights below ${WT.tminYellow} °C`, es: `${coldDays} noches frías bajo ${WT.tminYellow} °C` },
      });
    }
  }

  if (today && Math.abs(today.precipZ) > WT.precipZYellow) {
    const red = Math.abs(today.precipZ) > WT.precipZRed;
    triggers.push({
      panel: "weather", metric: "precip_anomaly", date: asOf, value: today.precipZ, limit: `|z| > ${red ? WT.precipZRed : WT.precipZYellow}`,
      severity: red ? "red" : "yellow",
      message: {
        en: `30-day rainfall z-score ${today.precipZ.toFixed(1)} (${today.precip30} mm)${today.precipZ > 0 ? ", flood / huaico risk" : ""}`,
        es: `Z-score de lluvia 30 días ${today.precipZ.toFixed(1)} (${today.precip30} mm)${today.precipZ > 0 ? ", riesgo de huaico" : ""}`,
      },
    });
  }

  const enso = ensoAt(climate, asOf);
  if (enso && enso.value >= WT.ensoYellow) {
    const red = enso.value >= WT.ensoRed;
    const sign = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
    triggers.push({
      panel: "weather", metric: "enso", date: asOf, value: enso.value, limit: `Niño 1+2 ≥ ${red ? WT.ensoRed : WT.ensoYellow} °C`,
      severity: red ? "red" : "yellow",
      message: {
        en: `Coastal El Niño: Niño 1+2 ${sign(enso.value)} °C (3 months to ${formatMonth(enso.month, "en")}), ${ensoCategory(enso.value).en}`,
        es: `El Niño costero: Niño 1+2 ${sign(enso.value)} °C (3 meses a ${formatMonth(enso.month, "es")}), ${ensoCategory(enso.value).es}`,
      },
    });
  }

  if (today && today.waterCoverage !== null && today.waterCoverage < WT.waterCoverageYellow) {
    const red = today.waterCoverage < WT.waterCoverageRed;
    const pct = Math.round(today.waterCoverage * 100);
    triggers.push({
      panel: "weather", metric: "water", date: asOf, value: today.waterCoverage, limit: `< ${red ? WT.waterCoverageRed : WT.waterCoverageYellow}×`,
      severity: red ? "red" : "yellow",
      message: {
        en: `Licensed water covers ${pct}% of current crop demand (evapotranspiration ${Math.round(((today.demandFactor ?? 1) - 1) * 100)}% above normal)`,
        es: `La dotación de agua cubre el ${pct}% de la demanda actual del cultivo (evapotranspiración ${Math.round(((today.demandFactor ?? 1) - 1) * 100)}% sobre lo normal)`,
      },
    });
  }

  return { panel: "weather", severity: worst(triggers), triggers };
}

// ---------------------------------------------------------------------------
// Panel 3 · Market (price per kg × expected kg vs loan)
// ---------------------------------------------------------------------------

export interface MarketPoint {
  month: string;
  usdPerKg: number;
  source: "veritrade" | "comtrade" | "mirror";
  shipments: number | null;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

/**
 * One monthly price series: Veritrade where it exists (shipment level, current),
 * Comtrade before that. The band for each month uses the same calendar month in
 * every earlier year (no look-ahead). With `anchorDate`, the band is rescaled so
 * the month the bank saw at approval sits on its seasonal median (see config).
 */
export function buildMarketSeries(market: MarketFixture, anchorDate?: string): MarketPoint[] {
  const raw = rawMarketSeries(market);
  if (!anchorDate) return raw;
  const anchor = marketAt(raw, anchorDate);
  if (!anchor || !(anchor.p50 > 0)) return raw;
  const k = anchor.usdPerKg / anchor.p50;
  return raw.map((p) => ({
    ...p,
    p10: round(p.p10 * k),
    p25: round(p.p25 * k),
    p50: round(p.p50 * k),
    p75: round(p.p75 * k),
    p90: round(p.p90 * k),
  }));
}

function rawMarketSeries(market: MarketFixture): MarketPoint[] {
  const byMonth = new Map<string, { usdPerKg: number; source: MarketPoint["source"]; shipments: number | null }>();
  // Lowest priority first: partner-reported mirror prices only fill months Peru did not report.
  for (const r of market.mirrorMonthly ?? []) byMonth.set(r.month, { usdPerKg: r.usdPerKg, source: "mirror", shipments: null });
  for (const r of market.comtradeMonthly) byMonth.set(r.month, { usdPerKg: r.usdPerKg, source: "comtrade", shipments: null });
  for (const r of market.veritradeMonthly) byMonth.set(r.month, { usdPerKg: r.usdPerKg, source: "veritrade", shipments: r.shipments });
  const months = [...byMonth.keys()].sort();
  return months.map((month) => {
    const cal = month.slice(5);
    // The seasonal band is built from Peru-reported FOB only. Mirror prices (partner
    // imports scaled by one average CIF→FOB factor) fill observed months but would
    // skew the band: the CIF/FOB gap moves with the season and the destination mix.
    const prior = months
      .filter((m) => m < month && m.slice(5) === cal && byMonth.get(m)!.source !== "mirror")
      .map((m) => byMonth.get(m)!.usdPerKg);
    const fallback = market.seasonalBand[Number(cal) - 1];
    const use = prior.length >= 3;
    return {
      month,
      ...byMonth.get(month)!,
      p10: round(use ? quantile(prior, 0.1) : fallback.p10),
      p25: round(use ? quantile(prior, 0.25) : fallback.p25),
      p50: round(use ? quantile(prior, 0.5) : fallback.p50),
      p75: round(use ? quantile(prior, 0.75) : fallback.p75),
      p90: round(use ? quantile(prior, 0.9) : fallback.p90),
    };
  });
}

/** Latest complete month the bank can see at `asOf`. */
export function marketAt(series: MarketPoint[], asOf: string): MarketPoint | null {
  const current = asOf.slice(0, 7);
  return series.filter((p) => p.month < current).at(-1) ?? null;
}

export function expectedKg(deal: PreHarvestDeal, yieldAdj: number): number {
  return deal.formato.areaHa * deal.formato.declaredYieldTPerHa * 1000 * (MT.exportableSharePct / 100) * yieldAdj;
}

/** What the grower owes at maturity: principal plus interest for the tenor. */
export function amountDueUsd(deal: PreHarvestDeal, pricingPct: number | null): number {
  return deal.envelopeUsd * (1 + ((pricingPct ?? 0) / 100) * (deal.tenorDays / 360));
}

/**
 * Reference harvest price at underwriting: the volume-weighted FOB $/kg of the
 * last complete harvest window (Apr–Jul) before approval. A realised price, not
 * a forecast.
 */
export function referenceHarvestPrice(market: MarketFixture, approvalDate: string): number | null {
  const approvalYear = Number(approvalDate.slice(0, 4));
  const lastMonth = Math.max(...MT.harvestMonths);
  // Last harvest window that had fully closed before approval.
  const year = Number(approvalDate.slice(5, 7)) > lastMonth ? approvalYear : approvalYear - 1;
  const months = new Set(MT.harvestMonths.map((m) => `${year}-${String(m).padStart(2, "0")}`));
  const rows = market.veritradeMonthly.filter((r) => months.has(r.month));
  const comtrade = market.comtradeMonthly.filter((r) => months.has(r.month));
  // Peru-reported months first; mirror prices only when Peru did not report (2020-05 to 2023-12).
  const mirror = (market.mirrorMonthly ?? [])
    .filter((r) => months.has(r.month))
    .map((r) => ({ kg: r.kg, fobUsd: r.usdPerKg * r.kg }));
  const src =
    rows.length === months.size ? rows : comtrade.length === months.size ? comtrade : mirror.length === months.size ? mirror : comtrade.length ? comtrade : mirror;
  const kg = src.reduce((s, r) => s + r.kg, 0);
  return kg > 0 ? round(src.reduce((s, r) => s + r.fobUsd, 0) / kg, 3) : null;
}

/**
 * Expected harvest price at `asOf`: the reference price, moved by how the market
 * has performed since approval against its normal seasonal path (price ÷ the
 * approval-anchored seasonal median). Conservative: upside is not credited, so a
 * strong off-season market never inflates coverage, while a weak one cuts it.
 */
export function expectedHarvestPrice(series: MarketPoint[], asOf: string, reference: number): number | null {
  const price = marketAt(series, asOf);
  if (!price || !(price.p50 > 0)) return null;
  return round(reference * Math.min(1, price.usdPerKg / price.p50), 3);
}

export interface MarketEvaluation extends PanelState {
  price: MarketPoint | null;
  expectedHarvestPrice: number | null;
  expectedRevenueUsd: number | null;
  coverage: number | null;
  dropPct: number | null;
}

/**
 * @param amountDue principal + interest the harvest has to repay (the bank's full
 *   commitment, not just what has been disbursed so far).
 */
export function evaluateMarket(
  series: MarketPoint[],
  asOf: string,
  deal: PreHarvestDeal,
  amountDue: number,
  yieldAdj: number,
  referencePrice: number,
): MarketEvaluation {
  const triggers: Trigger[] = [];
  const price = marketAt(series, asOf);
  if (!price) {
    return { panel: "market", severity: "green", triggers, price, expectedHarvestPrice: null, expectedRevenueUsd: null, coverage: null, dropPct: null };
  }
  const forward = expectedHarvestPrice(series, asOf, referencePrice) ?? referencePrice;

  // 1. Is this month's price abnormal for this time of year?
  const p = price.usdPerKg;
  if (p < price[MT.redBelow]) {
    triggers.push({
      panel: "market", metric: "price_band", date: asOf, value: p, limit: `< ${MT.redBelow.toUpperCase()} ${price[MT.redBelow]}`, severity: "red",
      message: { en: `Avocado FOB $${p.toFixed(2)}/kg below the seasonal ${MT.redBelow.toUpperCase()} (${formatMonth(price.month, "en")})`, es: `Palta FOB $${p.toFixed(2)}/kg bajo el ${MT.redBelow.toUpperCase()} estacional (${formatMonth(price.month, "es")})` },
    });
  } else if (p < price[MT.yellowBelow]) {
    triggers.push({
      panel: "market", metric: "price_band", date: asOf, value: p, limit: `< ${MT.yellowBelow.toUpperCase()} ${price[MT.yellowBelow]}`, severity: "yellow",
      message: { en: `Avocado FOB $${p.toFixed(2)}/kg below the seasonal ${MT.yellowBelow.toUpperCase()} (${formatMonth(price.month, "en")})`, es: `Palta FOB $${p.toFixed(2)}/kg bajo el ${MT.yellowBelow.toUpperCase()} estacional (${formatMonth(price.month, "es")})` },
    });
  }

  // 2. Has the expected harvest price fallen below the underwriting reference? (season-neutral)
  const dropPct = referencePrice > 0 ? round(((referencePrice - forward) / referencePrice) * 100, 1) : null;
  if (dropPct !== null && dropPct >= MT.yellowDropPct) {
    const red = dropPct >= MT.redDropPct;
    triggers.push({
      panel: "market", metric: "price_drop", date: asOf, value: dropPct, limit: `≥ ${red ? MT.redDropPct : MT.yellowDropPct}%`, severity: red ? "red" : "yellow",
      message: {
        en: `Expected harvest price $${forward.toFixed(2)}/kg, ${dropPct}% below the $${referencePrice.toFixed(2)} reference`,
        es: `Precio esperado en cosecha $${forward.toFixed(2)}/kg, ${dropPct}% bajo la referencia de $${referencePrice.toFixed(2)}`,
      },
    });
  }

  // 3. Does the expected harvest repay principal + interest?
  const revenue = forward * expectedKg(deal, yieldAdj) * (MT.farmGateSharePct / 100);
  const coverage = amountDue > 0 ? round(revenue / amountDue, 2) : null;
  if (coverage !== null && coverage < MT.coverageYellow) {
    const red = coverage < MT.coverageRed;
    triggers.push({
      panel: "market", metric: "coverage", date: asOf, value: coverage, limit: `< ${red ? MT.coverageRed : MT.coverageYellow}×`, severity: red ? "red" : "yellow",
      message: {
        en: `Expected harvest revenue covers principal + interest ${coverage}× (USD ${Math.round(revenue).toLocaleString("en-US")})`,
        es: `El ingreso esperado de la cosecha cubre capital + intereses ${coverage}× (USD ${Math.round(revenue).toLocaleString("en-US")})`,
      },
    });
  }

  return {
    panel: "market",
    severity: worst(triggers),
    triggers,
    price,
    expectedHarvestPrice: forward,
    expectedRevenueUsd: Math.round(revenue),
    coverage,
    dropPct,
  };
}

// ---------------------------------------------------------------------------
// Panel 4 · Repayment: the M3 takeout by post-harvest financing
// ---------------------------------------------------------------------------

export interface TakeoutEvaluation extends PanelState {
  /** "pending" before M3, otherwise the outcome. */
  stage: "pending" | "due" | "done";
  poValueUsd: number | null;
  advanceUsd: number | null;
  coverage: number | null;
}

/**
 * At M3 the pre-harvest loan is repaid by a post-harvest advance on the buyer's PO
 * (insured by Coface). Checks: PO signed, Coface decision, advance ≥ amount due.
 */
export function evaluateTakeout(
  takeout: TakeoutInputs,
  deal: PreHarvestDeal,
  asOf: string,
  amountDue: number,
): TakeoutEvaluation {
  const none = { poValueUsd: null, advanceUsd: null, coverage: null };
  if (asOf < deal.m3Date) return { panel: "takeout", severity: "green", triggers: [], stage: "pending", ...none };

  const triggers: Trigger[] = [];
  const pastGrace = asOf >= addDays(deal.m3Date, TT.graceDays);
  const signed = takeout.poSignedDate !== null && takeout.poSignedDate <= asOf;

  if (!signed) {
    triggers.push({
      panel: "takeout", metric: "po_missing", date: asOf, value: 0, limit: "PO", severity: pastGrace ? "red" : "yellow",
      message: { en: "No signed purchase order at M3", es: "Sin orden de compra firmada en M3" },
    });
    return { panel: "takeout", severity: worst(triggers), triggers, stage: "due", ...none };
  }

  const poValue = takeout.poVolumeKg * takeout.poPriceUsdPerKg;
  if (takeout.coface === "declined" || (takeout.coface === "pending" && pastGrace)) {
    triggers.push({
      panel: "takeout", metric: "coface", date: asOf, value: 0, limit: "Coface", severity: "red",
      message: {
        en: takeout.coface === "declined" ? `Coface declined the buyer (${takeout.buyer})` : "No Coface decision on the buyer",
        es: takeout.coface === "declined" ? `Coface rechazó al comprador (${takeout.buyer})` : "Sin decisión de Coface sobre el comprador",
      },
    });
    return { panel: "takeout", severity: "red", triggers, stage: "due", poValueUsd: Math.round(poValue), advanceUsd: 0, coverage: 0 };
  }

  const insured = poValue * (takeout.coface === "pending" ? 0 : takeout.cofaceCoveragePct / 100);
  const advance = insured * (takeout.advanceRatePct / 100);
  const coverage = amountDue > 0 ? round(advance / amountDue, 2) : null;
  if (takeout.coface === "reduced") {
    triggers.push({
      panel: "takeout", metric: "coface", date: asOf, value: takeout.cofaceCoveragePct, limit: "Coface", severity: "yellow",
      message: { en: `Coface reduced the limit to ${takeout.cofaceCoveragePct}% of the PO`, es: `Coface redujo la línea al ${takeout.cofaceCoveragePct}% de la OC` },
    });
  }
  if (coverage !== null && coverage < TT.coverageYellow) {
    const red = coverage < TT.coverageRed;
    triggers.push({
      panel: "takeout", metric: "takeout_coverage", date: asOf, value: coverage, limit: `< ${red ? TT.coverageRed : TT.coverageYellow}×`,
      severity: red ? "red" : "yellow",
      message: {
        en: `Post-harvest advance covers ${coverage}× of the pre-harvest amount due (USD ${Math.round(advance).toLocaleString("en-US")})`,
        es: `El adelanto post-cosecha cubre ${coverage}× lo adeudado pre-cosecha (USD ${Math.round(advance).toLocaleString("en-US")})`,
      },
    });
  }
  return {
    panel: "takeout",
    severity: worst(triggers),
    triggers,
    stage: "done",
    poValueUsd: Math.round(poValue),
    advanceUsd: Math.round(advance),
    coverage,
  };
}
