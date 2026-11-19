/**
 * Stress fixtures for the tests only (never shown in the app): each one layers a
 * shock on top of the real campaign data to exercise the monitoring rules:
 *   baseline       the real 2025-26 campaign data, unchanged
 *   bad_quality    DURING: crop vigour collapses after fruit set, fruit set runs late
 *   weather_shock  DURING: heat at fruit set, a coastal El Niño and a rain spike
 *   cant_repay     END: export price slides into harvest, revenue no longer covers the loan
 */
import type { MonitoringData, PreHarvestDeal, TakeoutInputs } from "./types";
import { addDays } from "./monitoring";
import { simulateCampaign } from "./timeline";

export type ScenarioId = "baseline" | "bad_quality" | "weather_shock" | "cant_repay";

export interface ScenarioData {
  data: MonitoringData;
  fruitSetDelayDays: number;
  /** Changes to the M3 takeout the scenario implies (smaller crop, lower PO price…). */
  takeout?: Partial<TakeoutInputs>;
}

export function applyScenario(base: MonitoringData, deal: PreHarvestDeal, id: ScenarioId): ScenarioData {
  if (id === "baseline") return { data: base, fruitSetDelayDays: 0 };

  if (id === "bad_quality") {
    const start = addDays(deal.fruitSetDate, -10);
    const deeper = addDays(deal.fruitSetDate, 30);
    const end = addDays(deal.approvalDate, deal.tenorDays + 30);
    return {
      fruitSetDelayDays: 28,
      // Weak crop: the buyer contracts 40% less export-grade fruit.
      takeout: { poVolumeKg: Math.round(deal.takeout.poVolumeKg * 0.6) },
      data: {
        ...base,
        ndvi: {
          ...base.ndvi,
          series: base.ndvi.series.map((p) =>
            p.date >= start && p.date <= end
              ? { ...p, ndvi: Math.round(p.ndvi * (p.date >= deeper ? 0.65 : 0.8) * 1000) / 1000 }
              : p,
          ),
        },
      },
    };
  }

  if (id === "weather_shock") {
    const heatFrom = addDays(deal.fruitSetDate, -6);
    const heatTo = addDays(deal.fruitSetDate, 2);
    const rainDays = [addDays(deal.preHarvestDate, -10), addDays(deal.preHarvestDate, -9), addDays(deal.preHarvestDate, -8)];
    // Coastal warming like 2017 / 2023: Niño 1+2 climbs past the "strong" ENFEN band.
    const ensoRamp: Record<string, number> = {};
    const start = Number(deal.approvalDate.slice(5, 7));
    [0.6, 1.2, 1.8, 2.4, 2.8, 2.6, 2.2].forEach((v, i) => {
      const y = Number(deal.approvalDate.slice(0, 4)) + Math.floor((start - 1 + i) / 12);
      const m = ((start - 1 + i) % 12) + 1;
      ensoRamp[`${y}-${String(m).padStart(2, "0")}`] = v;
    });
    // Heat also drives evapotranspiration up for the following weeks: water demand outruns the licence.
    const demandTo = addDays(deal.fruitSetDate, 40);
    return {
      fruitSetDelayDays: 0,
      data: {
        ...base,
        climate: {
          ...base.climate,
          weather: base.climate.weather.map((d) => {
            const hot = d.date >= heatFrom && d.date <= heatTo;
            const thirsty = d.date >= heatFrom && d.date <= demandTo;
            return {
              ...d,
              tmax: hot ? 37.2 + (d.date.charCodeAt(9) % 3) * 0.4 : d.tmax,
              precip: rainDays.includes(d.date) ? 22 : d.precip,
              et0: thirsty && d.et0 !== null ? Math.round(d.et0 * 1.3 * 100) / 100 : d.et0,
            };
          }),
          enso: base.climate.enso.map((p) => (ensoRamp[p.month] !== undefined ? { ...p, nino12: ensoRamp[p.month] } : p)),
        },
      },
    };
  }

  // cant_repay: price slides into harvest
  // Customs prices are visible a month late, so the slide starts ~3 months before M3.
  const slide = (month: string) => {
    if (month >= addDays(deal.preHarvestDate, 0).slice(0, 7)) return 0.5;
    if (month >= addDays(deal.preHarvestDate, -30).slice(0, 7)) return 0.65;
    if (month >= addDays(deal.preHarvestDate, -60).slice(0, 7)) return 0.85;
    return 1;
  };
  const scale = <T extends { month: string; usdPerKg: number }>(r: T): T =>
    slide(r.month) === 1 ? r : { ...r, usdPerKg: Math.round(r.usdPerKg * slide(r.month) * 1000) / 1000 };
  return {
    fruitSetDelayDays: 0,
    // The PO is signed at the collapsed price, and Coface trims the buyer limit.
    takeout: { poPriceUsdPerKg: Math.round(deal.takeout.poPriceUsdPerKg * 0.55 * 100) / 100, coface: "reduced", cofaceCoveragePct: 80 },
    data: {
      ...base,
      market: {
        ...base.market,
        veritradeMonthly: base.market.veritradeMonthly.map(scale),
        comtradeMonthly: base.market.comtradeMonthly.map(scale),
      },
    },
  };
}

/** Runs the campaign on the stressed data (and stressed takeout terms). */
export function simulateStressed(deal: PreHarvestDeal, base: MonitoringData, id: ScenarioId) {
  const { data, takeout } = applyScenario(base, deal, id);
  return simulateCampaign({ ...deal, takeout: { ...deal.takeout, ...takeout } }, data);
}
