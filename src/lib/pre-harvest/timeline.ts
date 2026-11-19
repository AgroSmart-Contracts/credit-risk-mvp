/**
 * Campaign monitoring: evaluates the campaign week by week on the observed data, the four
 * monitoring panels, re-scoring the deal, choosing the bank action, moving the
 * tranches and writing the alert log.
 */
import { ACTION_ORDER, CROP_THRESHOLDS, MONITORING_PENALTIES, PANEL_ACTIONS, TIER_ACTIONS, TRANCHES } from "./config";
import {
  addDays,
  buildCropSeries,
  buildMarketSeries,
  buildWeatherSeries,
  evaluateCrop,
  evaluateMarket,
  evaluateTakeout,
  evaluateWeather,
  amountDueUsd,
  ensoAt,
  ndviBaseline,
  referenceHarvestPrice,
  yieldAdjustment,
  type CropPoint,
  type MarketPoint,
  type WeatherPoint,
} from "./monitoring";
import { assess, scorePreHarvest } from "./scoring";
import type {
  AlertLogEntry,
  BankAction,
  Bilingual,
  DimensionScore,
  MonitoringData,
  OriginationSignals,
  PanelId,
  PanelState,
  PreHarvestAssessment,
  PreHarvestDeal,
  TakeoutInputs,
  TimelineFrame,
  TrancheState,
} from "./types";

const PANELS: PanelId[] = ["crop", "weather", "market", "takeout"];
const STEP_DAYS = 7;

export const PANEL_LABELS: Record<PanelId, Bilingual> = {
  crop: { en: "Crop health", es: "Salud del cultivo" },
  weather: { en: "Weather and water", es: "Clima y agua" },
  market: { en: "Market", es: "Mercado" },
  takeout: { en: "Repayment (M3 takeout)", es: "Repago (toma en M3)" },
};

const TRANCHE_TEXT: Record<TrancheState["id"], { label: Bilingual; condition: Bilingual }> = {
  approval: {
    label: { en: "Approval", es: "Aprobación" },
    condition: { en: "Tier confirmed by the analyst", es: "Tier confirmado por el analista" },
  },
  fruit_set: {
    label: { en: "Fruit set verified", es: "Cuajado verificado" },
    condition: { en: "Satellite + field inspection, crop not at high risk", es: "Satelital + inspección, cultivo sin riesgo alto" },
  },
  pre_harvest: {
    label: { en: "Pre-harvest", es: "Pre-cosecha" },
    condition: { en: "Satellite composite within band", es: "Compuesto satelital dentro de banda" },
  },
};

export function originationSignals(data: MonitoringData, deal: PreHarvestDeal): OriginationSignals {
  const atApproval = data.ndvi.series.filter((p) => p.date <= deal.approvalDate).at(-1);
  let ndviVsMedianPct: number | null = null;
  if (atApproval) {
    const b = ndviBaseline(data.ndvi.series, atApproval.date);
    if (Number.isFinite(b.median) && b.median > 0 && b.years >= CROP_THRESHOLDS.minBaselineYears) {
      ndviVsMedianPct = Math.round(((atApproval.ndvi - b.median) / b.median) * 1000) / 10;
    }
  }
  const window = data.ndvi.series.filter(
    (p) => p.date <= deal.approvalDate && p.date > addDays(deal.approvalDate, -CROP_THRESHOLDS.plantingWindowDays),
  );
  const cropPresenceNdvi = window.length ? Math.round((window.reduce((s, p) => s + p.ndvi, 0) / window.length) * 1000) / 1000 : null;

  // Second-lowest 16-day composite over the lookback: keeps a real dormant dip
  // (monthly averaging smooths it away) while one cloudy composite cannot trigger it.
  const from = addDays(deal.approvalDate, -CROP_THRESHOLDS.evergreenLookbackDays);
  const lows = data.ndvi.series
    .filter((p) => p.date <= deal.approvalDate && p.date > from)
    .map((p) => p.ndvi)
    .sort((a, b) => a - b);
  const seasonalMinNdvi = lows.length >= 24 ? lows[1] : null;

  return { ndviVsMedianPct, enso: ensoAt(data.climate, deal.approvalDate)?.value ?? null, cropPresenceNdvi, seasonalMinNdvi };
}

const strongest = (actions: BankAction[]) =>
  actions.reduce((a, b) => (ACTION_ORDER.indexOf(b) > ACTION_ORDER.indexOf(a) ? b : a), "continue" as BankAction);

/** Re-score: add a monitoring line to the dimension each non-green panel affects. */
export function rescore(
  origination: PreHarvestAssessment,
  panels: Record<PanelId, PanelState>,
  deal: PreHarvestDeal,
): PreHarvestAssessment {
  const dims: DimensionScore[] = origination.dimensions.map((d) => ({ ...d, lines: [...d.lines] }));
  for (const panel of PANELS) {
    const sev = panels[panel].severity;
    if (sev === "green") continue;
    const rule = MONITORING_PENALTIES[panel];
    const dim = dims.find((d) => d.key === rule.dimension)!;
    const pts = rule[sev];
    dim.lines.push({
      label: { en: `Monitoring: ${PANEL_LABELS[panel].en} ${sev === "red" ? "high risk" : "watch"}`, es: `Monitoreo: ${PANEL_LABELS[panel].es} ${sev === "red" ? "riesgo alto" : "vigilar"}` },
      value: panels[panel].triggers[0]?.message ?? { en: sev, es: sev },
      points: pts,
      source: { name: "Monitoring", status: "cached" },
    });
    dim.score = Math.max(0, Math.min(100, dim.score + pts));
  }
  return assess(dims, deal, origination.signalVetoes);
}

export interface CampaignSimulation {
  origination: PreHarvestAssessment;
  signals: OriginationSignals;
  frames: TimelineFrame[];
  alerts: AlertLogEntry[];
  series: { crop: CropPoint[]; weather: WeatherPoint[]; market: MarketPoint[]; enso: MonitoringData["climate"]["enso"] };
  fruitSetDelayDays: number;
  referencePrice: number;
  takeout: TakeoutInputs;
  amountDue: number;
}

export function simulateCampaign(
  deal: PreHarvestDeal,
  data: MonitoringData,
  /** Last date with data: a live campaign is only monitored up to here. */
  until?: string,
): CampaignSimulation {
  // Observed campaigns only: fruit set is judged on its declared date, the takeout on the PO on file.
  const fruitSetDelayDays = 0;
  const takeout = deal.takeout;
  const signals = originationSignals(data, deal);
  const origination = scorePreHarvest(deal, signals);

  const end = addDays(deal.approvalDate, deal.tenorDays);
  const chartFrom = addDays(deal.approvalDate, -120);
  const crop = buildCropSeries(data.ndvi.series, chartFrom, addDays(end, 30));
  const weather = buildWeatherSeries(data.climate, chartFrom, addDays(end, 30), deal);
  const market = buildMarketSeries(data.market, deal.approvalDate);

  // Coverage is judged against the bank's full commitment: principal + interest.
  const amountDue = amountDueUsd(deal, origination.pricingPct);
  const referencePrice = referenceHarvestPrice(data.market, deal.approvalDate) ?? market.at(-1)?.usdPerKg ?? 0;
  const fruitSetDue = addDays(deal.fruitSetDate, fruitSetDelayDays);
  const dueDates: Record<TrancheState["id"], string> = {
    approval: deal.approvalDate,
    fruit_set: fruitSetDue,
    pre_harvest: deal.preHarvestDate,
  };
  let tranches: TrancheState[] = TRANCHES.map((t) => ({
    id: t.id,
    pct: t.pct,
    amountUsd: Math.round((deal.envelopeUsd * t.pct) / 100),
    dueDate: dueDates[t.id],
    status: "pending",
    releasedOn: null,
    ...TRANCHE_TEXT[t.id],
  }));

  const frames: TimelineFrame[] = [];
  const alerts: AlertLogEntry[] = [];
  const active = new Map<string, "yellow" | "red">();
  let stopped = origination.tier === "VETO";

  const stop = until && until < end ? until : end;
  for (let date = deal.approvalDate; date <= stop; date = addDays(date, STEP_DAYS)) {
    const cropState = evaluateCrop(crop, date, deal, fruitSetDelayDays);
    const weatherState = evaluateWeather(weather, data.climate, date, deal, fruitSetDelayDays);
    const marketEval = evaluateMarket(market, date, deal, amountDue, yieldAdjustment(crop, date), referencePrice);
    const panels: Record<PanelId, PanelState> = {
      crop: cropState,
      weather: weatherState,
      market: { panel: "market", severity: marketEval.severity, triggers: marketEval.triggers },
      takeout: evaluateTakeout(takeout, deal, date, amountDue),
    };

    const current = rescore(origination, panels, deal);
    let action = strongest([
      ...PANELS.map((p) => PANEL_ACTIONS[p][panels[p].severity]),
      TIER_ACTIONS[current.tier],
    ]);
    // Red = stop disbursement. It stays stopped until a human review clears it.
    if (action === "stop") stopped = true;
    if (stopped) action = "stop";

    tranches = tranches.map((t) => {
      if (t.status === "released" || t.status === "stopped") return t;
      if (stopped) return { ...t, status: "stopped" };
      if (date < t.dueDate) return t;
      const ok =
        t.id === "approval"
          ? current.tier !== "D"
          : t.id === "fruit_set"
            ? (action === "continue" || action === "call_inspection") && cropState.severity !== "red"
            : (action === "continue" || action === "call_inspection") && cropState.severity === "green";
      return ok ? { ...t, status: "released", releasedOn: date } : { ...t, status: "held" };
    });

    const outstandingUsd = tranches.filter((t) => t.status === "released").reduce((s, t) => s + t.amountUsd, 0);

    for (const panel of PANELS) {
      const seen = new Set<string>();
      for (const trig of panels[panel].triggers) {
        const key = `${panel}:${trig.metric}`;
        seen.add(key);
        if (active.get(key) === trig.severity || (active.get(key) === "red" && trig.severity === "yellow")) continue;
        active.set(key, trig.severity);
        alerts.push({
          date,
          panel,
          metric: trig.metric,
          value: trig.value,
          limit: trig.limit,
          severity: trig.severity,
          composite: current.composite,
          tier: current.tier,
          action,
          message: trig.message,
        });
      }
      for (const key of [...active.keys()]) if (key.startsWith(`${panel}:`) && !seen.has(key)) active.delete(key);
    }

    frames.push({
      date,
      panels,
      composite: current.composite,
      tier: current.tier,
      action,
      tranches,
      outstandingUsd,
      coverageRatio: marketEval.coverage,
      expectedHarvestPrice: marketEval.expectedHarvestPrice,
      expectedRevenueUsd: marketEval.expectedRevenueUsd,
      priceDropPct: marketEval.dropPct,
      m3Reached: date >= deal.m3Date,
    });
  }

  return {
    origination,
    signals,
    frames,
    alerts,
    series: { crop, weather, market, enso: data.climate.enso },
    fruitSetDelayDays,
    referencePrice,
    takeout,
    amountDue,
  };
}
