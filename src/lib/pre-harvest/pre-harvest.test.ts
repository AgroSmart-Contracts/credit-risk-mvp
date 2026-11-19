import { describe, expect, it } from "vitest";
import { SEED_PRE_HARVEST_DEAL as SEED } from "../../data/pre-harvest/seed-deal";
import { CACHED_MONITORING_DATA } from "../../data/pre-harvest";
import { CROP_THRESHOLDS as CT, MARKET_THRESHOLDS as MT, WEATHER_THRESHOLDS as WT } from "./config";
import { ptsAtLeast, ptsAtMost, scorePreHarvest, tierFor } from "./scoring";
import {
  addDays,
  buildMarketSeries,
  buildWeatherSeries,
  referenceHarvestPrice,
  evaluateCrop,
  evaluateMarket,
  evaluateWeather,
  type CropPoint,
  type MarketPoint,
  type WeatherPoint,
} from "./monitoring";
import { rescore, simulateCampaign } from "./timeline";
import { simulateStressed } from "./stress-fixtures";
import type {
  ClimateFixture,
  MonitoringData,
  PanelId,
  PanelState,
  PreHarvestDeal,
} from "./types";

const SIGNALS = { ndviVsMedianPct: -3.6, enso: 0.43, cropPresenceNdvi: 0.7, seasonalMinNdvi: 0.6 };
const DATA: MonitoringData = CACHED_MONITORING_DATA;

const withChecks = (patch: (d: PreHarvestDeal) => void): PreHarvestDeal => {
  const d = structuredClone(SEED);
  patch(d);
  return d;
};

// ---------------------------------------------------------------------------

describe("scoring engine", () => {
  it("scores the seed deal at 67, tier B (Production 68, Operator 65, Structure 70)", () => {
    const a = scorePreHarvest(SEED, SIGNALS);
    const by = Object.fromEntries(a.dimensions.map((d) => [d.key, d.score]));
    expect(by).toMatchObject({ production: 68, operator: 65, structure: 70 });
    expect(a.composite).toBe(67);
    expect(a.tier).toBe("B");
    expect(a.pricingPct).toBe(8.5);
    expect(a.ltvPct).toBeCloseTo(68, 0);
  });

  it("keeps Counterparty dormant at 0% weight until M3", () => {
    const cp = scorePreHarvest(SEED, SIGNALS).dimensions.find((d) => d.key === "counterparty")!;
    expect(cp.dormant).toBe(true);
    expect(cp.weight).toBe(0);
  });

  it("explains every point: dimension score = base + sum of line points", () => {
    for (const d of scorePreHarvest(SEED, SIGNALS).dimensions.filter((x) => !x.dormant)) {
      expect(d.score).toBe(d.base + d.lines.reduce((s, l) => s + l.points, 0));
      for (const l of d.lines) {
        expect(l.label.en).toBeTruthy();
        expect(l.label.es).toBeTruthy();
      }
    }
  });

  it("maps composites to the post-harvest letter tiers", () => {
    expect([80, 79, 65, 64, 50, 49, 0].map(tierFor)).toEqual(["A", "B", "B", "C", "C", "D", "D"]);
  });

  it("applies band helpers at their edges", () => {
    const min = [{ min: 1, pts: 4 }, { min: 0.85, pts: -3 }, { min: -Infinity, pts: -12 }];
    expect([1, 0.99, 0.85, 0.84].map((v) => ptsAtLeast(v, min))).toEqual([4, -3, -3, -12]);
    const max = [{ max: 1.5, pts: 3 }, { max: 3, pts: 0 }, { max: Infinity, pts: -8 }];
    expect([1.5, 1.51, 3, 3.1].map((v) => ptsAtMost(v, max))).toEqual([3, 0, 0, -8]);
  });

  it("marks satellite and ENSO lines provisional when there is no reading", () => {
    const a = scorePreHarvest(SEED, { ndviVsMedianPct: null, enso: null, cropPresenceNdvi: null, seasonalMinNdvi: null });
    const prod = a.dimensions.find((d) => d.key === "production")!;
    const provisional = prod.lines.filter((l) => l.value.en.includes("provisional"));
    expect(provisional.map((l) => l.source.name)).toEqual(["Sentinel-2 NDVI", "NOAA CPC Niño 1+2"]);
    expect(provisional.map((l) => l.points)).toEqual([0, 0]);
  });

  it.each([
    ["credit loss", (d: PreHarvestDeal) => (d.checks.credit.rating = "Perdida")],
    ["inactive RUC", (d: PreHarvestDeal) => (d.checks.ruc.active = false)],
    ["no water licence", (d: PreHarvestDeal) => (d.checks.ana.licenceValid = false)],
    ["SENASA quarantine", (d: PreHarvestDeal) => (d.checks.senasa.zoneStatus = "quarantine")],
  ])("vetoes on %s regardless of composite", (_, patch) => {
    const a = scorePreHarvest(withChecks(patch), SIGNALS);
    expect(a.tier).toBe("VETO");
    expect(a.pricingPct).toBeNull();
    expect(a.vetoReasons.length).toBeGreaterThan(0);
  });

  it("penalises over-declared yield and high LTV", () => {
    const base = scorePreHarvest(SEED, SIGNALS).composite;
    const greedy = withChecks((d) => {
      d.formato.declaredYieldTPerHa = 20;
      d.formato.campaignCostUsd = 77_000; // LTV 91%
    });
    expect(scorePreHarvest(greedy, SIGNALS).composite).toBeLessThan(base - 3);
  });
});

// ---------------------------------------------------------------------------

const cropPoints = (pcts: number[], vci = 60): CropPoint[] =>
  pcts.map((pct, i) => ({
    date: addDays("2025-10-01", i * 16),
    ndvi: 0.65 * (1 + pct / 100),
    median: 0.65,
    yellowLine: 0.65 * 0.85,
    redLine: 0.65 * 0.75,
    pctVsMedian: pct,
    vci,
  }));

describe("crop health thresholds", () => {
  const last = (p: CropPoint[]) => p.at(-1)!.date;

  it("stays green on a single low composite", () => {
    const p = cropPoints([0, -2, -30]);
    expect(evaluateCrop(p, last(p), SEED, 0).severity).toBe("green");
  });

  it(`is yellow after ${CT.yellowConsecutiveBins} composites ≥${CT.yellowPctBelowMedian}% below median`, () => {
    const p = cropPoints([0, -15, -16]);
    expect(evaluateCrop(p, last(p), SEED, 0).severity).toBe("yellow");
    const q = cropPoints([0, -14.9, -16]);
    expect(evaluateCrop(q, last(q), SEED, 0).severity).toBe("green");
  });

  it(`is red after ${CT.redConsecutiveBins} composites ≥${CT.redPctBelowMedian}% below median`, () => {
    const p = cropPoints([-25, -26, -30]);
    expect(evaluateCrop(p, last(p), SEED, 0).severity).toBe("red");
    const q = cropPoints([-20, -26, -30]);
    expect(evaluateCrop(q, last(q), SEED, 0).severity).toBe("yellow");
  });

  it("uses VCI only when it stays low for consecutive composites and NDVI is below normal", () => {
    // 8% below median: under the VCI gate (−5%) but above the NDVI yellow rule (−15%).
    const one = cropPoints([-8, -8]).map((p, i) => ({ ...p, vci: i === 1 ? 10 : 60 }));
    expect(evaluateCrop(one, last(one), SEED, 0).severity).toBe("green");
    const yellow = cropPoints([-8, -8]).map((p) => ({ ...p, vci: 30 }));
    expect(evaluateCrop(yellow, last(yellow), SEED, 0).severity).toBe("yellow");
    const red = cropPoints([-8, -8]).map((p) => ({ ...p, vci: 15 }));
    expect(evaluateCrop(red, last(red), SEED, 0).severity).toBe("red");
    // Low VCI while NDVI sits at its normal (an exceptional record year stretching the range): no alert.
    const atNormal = cropPoints([0, 0]).map((p) => ({ ...p, vci: 15 }));
    expect(evaluateCrop(atNormal, last(atNormal), SEED, 0).severity).toBe("green");
  });

  it(`flags fruit set more than ${CT.fruitSetLateRedDays} days late as red`, () => {
    const p = cropPoints([0, 0, 0, 0, 0, 0]);
    const after = addDays(SEED.fruitSetDate, CT.fruitSetLateRedDays + 1);
    expect(evaluateCrop(p, after, SEED, CT.fruitSetLateRedDays + 7).severity).toBe("red");
    expect(evaluateCrop(p, after, SEED, CT.fruitSetLateRedDays).severity).toBe("green");
  });
});

// ---------------------------------------------------------------------------

const climate: ClimateFixture = {
  source: "test",
  lat: 0,
  lon: 0,
  fetchedAt: "",
  weather: [],
  precipClimatology: [],
  et0Climatology: [],
  enso: [],
};

const days = (from: string, n: number, patch: (i: number) => Partial<WeatherPoint> = () => ({})): WeatherPoint[] =>
  Array.from({ length: n }, (_, i) => ({
    date: addDays(from, i),
    tmax: 28,
    tmin: 14,
    rh: 70,
    et0: 4,
    precip: 0,
    precip30: 0,
    precipZ: 0,
    demandFactor: 1,
    waterCoverage: 1.11,
    ...patch(i),
  }));

describe("weather and water thresholds", () => {
  const inWindow = addDays(SEED.fruitSetDate, -5);

  it(`is yellow on ${WT.heatYellowDays}+ days above ${WT.tmaxYellow} °C during flowering / fruit set`, () => {
    const s = days(addDays(inWindow, -15), 16, (i) => ({ tmax: i >= 13 ? 34 : 28 }));
    expect(evaluateWeather(s, climate, inWindow, SEED, 0).severity).toBe("yellow");
  });

  it("ignores heat outside the sensitive window (Ica summers are hot)", () => {
    const late = addDays(SEED.fruitSetDate, WT.sensitiveWindowDaysAfterFruitSet + 20);
    const s = days(addDays(late, -15), 16, () => ({ tmax: 35 }));
    expect(evaluateWeather(s, climate, late, SEED, 0).severity).toBe("green");
  });

  it(`is red above ${WT.tmaxRed} °C or at frost in the window`, () => {
    const hot = days(addDays(inWindow, -15), 16, (i) => ({ tmax: i === 15 ? 36.5 : 28 }));
    expect(evaluateWeather(hot, climate, inWindow, SEED, 0).severity).toBe("red");
    const frost = days(addDays(inWindow, -15), 16, (i) => ({ tmin: i === 15 ? -0.5 : 14 }));
    expect(evaluateWeather(frost, climate, inWindow, SEED, 0).severity).toBe("red");
  });

  it("grades the 30-day rainfall z-score", () => {
    const at = (z: number) => days(addDays(inWindow, -1), 2, () => ({ precipZ: z }));
    expect(evaluateWeather(at(1.5), climate, inWindow, SEED, 0).severity).toBe("green");
    expect(evaluateWeather(at(1.6), climate, inWindow, SEED, 0).severity).toBe("yellow");
    expect(evaluateWeather(at(-2.1), climate, inWindow, SEED, 0).severity).toBe("red");
  });

  it(`grades coastal El Niño (Niño 1+2, 3-month mean) at ${WT.ensoYellow} / ${WT.ensoRed} °C`, () => {
    const s = days(addDays("2025-12-20", -1), 2);
    const withEnso = (v: number): ClimateFixture => ({
      ...climate,
      enso: ["2025-09", "2025-10", "2025-11"].map((month) => ({ month, nino12: v, nino34: 0 })),
    });
    expect(evaluateWeather(s, withEnso(0.9), "2025-12-20", SEED, 0).severity).toBe("green");
    expect(evaluateWeather(s, withEnso(1.0), "2025-12-20", SEED, 0).severity).toBe("yellow");
    expect(evaluateWeather(s, withEnso(1.7), "2025-12-20", SEED, 0).severity).toBe("red");
    // On 20 Nov, November is not complete: only Sep–Oct are known, not enough for a 3-month mean.
    expect(evaluateWeather(s, withEnso(2), "2025-11-20", SEED, 0).severity).toBe("green");
  });

  it("uses Niño 1+2, not ONI: a coastal event with a neutral central Pacific still alerts (2017)", () => {
    const s = days(addDays("2017-04-10", -1), 2);
    const coastal2017: ClimateFixture = {
      ...climate,
      enso: [
        { month: "2017-01", nino12: 1.07, nino34: -0.26 },
        { month: "2017-02", nino12: 1.14, nino34: 0.1 },
        { month: "2017-03", nino12: 1.83, nino34: 0.21 },
      ],
    };
    expect(evaluateWeather(s, coastal2017, "2017-04-10", SEED, 0).triggers.map((t) => t.metric)).toContain("enso");
  });

  it(`grades licensed water vs current crop demand at ${WT.waterCoverageYellow}× / ${WT.waterCoverageRed}×`, () => {
    const at = (c: number) => days(addDays("2026-01-20", -1), 2, () => ({ waterCoverage: c }));
    expect(evaluateWeather(at(1.0), climate, "2026-01-20", SEED, 0).severity).toBe("green");
    expect(evaluateWeather(at(0.99), climate, "2026-01-20", SEED, 0).severity).toBe("yellow");
    expect(evaluateWeather(at(0.84), climate, "2026-01-20", SEED, 0).severity).toBe("red");
  });

  it("derives water coverage from evapotranspiration vs normal and the grower's licence", () => {
    const fixture = (et0: number): ClimateFixture => ({
      ...climate,
      weather: Array.from({ length: 30 }, (_, i) => ({ date: addDays("2026-01-01", i), tmax: 30, tmin: 18, precip: 0, rh: 70, et0 })),
      precipClimatology: Array.from({ length: 365 }, (_, i) => ({ doy: i + 1, mean30: 0, std30: 0 })),
      et0Climatology: Array.from({ length: 365 }, (_, i) => ({ doy: i + 1, mean30: 120 })),
    });
    // Normal demand: allocation 10,000 ÷ need 9,000 = 1.11×.
    expect(buildWeatherSeries(fixture(4), "2026-01-30", "2026-01-30", SEED)[0].waterCoverage).toBeCloseTo(1.111, 2);
    // Evapotranspiration 25% above normal: 1.11 ÷ 1.25 = 0.89×.
    expect(buildWeatherSeries(fixture(5), "2026-01-30", "2026-01-30", SEED)[0].waterCoverage).toBeCloseTo(0.889, 2);
  });
});

// ---------------------------------------------------------------------------

const market = (price: number, approvalPrice = 2): MarketPoint[] => [
  { month: "2025-08", usdPerKg: approvalPrice, source: "veritrade", shipments: 100, p10: 1.6, p25: 1.8, p50: 2, p75: 2.2, p90: 2.4 },
  { month: "2025-12", usdPerKg: price, source: "veritrade", shipments: 100, p10: 1.6, p25: 1.8, p50: 2, p75: 2.2, p90: 2.4 },
];

describe("market thresholds", () => {
  const small = 10_000; // small amount due, so coverage stays green
  const REF = 2;

  it("grades price vs the seasonal P25 / P10 band", () => {
    expect(evaluateMarket(market(1.9), "2026-01-10", SEED, small, 1, REF).severity).toBe("green");
    expect(evaluateMarket(market(1.79), "2026-01-10", SEED, small, 1, REF).triggers.map((t) => t.metric)).toContain("price_band");
    expect(evaluateMarket(market(1.59), "2026-01-10", SEED, small, 1, REF).severity).toBe("red");
  });

  it(`grades the expected harvest price vs the reference at ${MT.yellowDropPct}% / ${MT.redDropPct}%`, () => {
    const y = evaluateMarket(market(1.7), "2026-01-10", SEED, small, 1, REF);
    expect(y.expectedHarvestPrice).toBeCloseTo(1.7, 3);
    expect(y.dropPct).toBeCloseTo(15, 1);
    expect(y.triggers.find((t) => t.metric === "price_drop")?.severity).toBe("yellow");
    const r = evaluateMarket(market(1.4), "2026-01-10", SEED, small, 1, REF);
    expect(r.triggers.find((t) => t.metric === "price_drop")?.severity).toBe("red");
  });

  it("does not credit price upside above the seasonal norm", () => {
    expect(evaluateMarket(market(2.4), "2026-01-10", SEED, small, 1, REF).expectedHarvestPrice).toBe(REF);
  });

  it(`grades coverage of principal + interest at ${MT.coverageYellow}× / ${MT.coverageRed}×`, () => {
    // 9.24 ha × 15 t × 80% exportable × $2 × 65% farm-gate = USD 144,144
    const r = evaluateMarket(market(2), "2026-01-10", SEED, 80_000, 1, REF);
    expect(r.expectedRevenueUsd).toBe(144_144);
    expect(r.coverage).toBeCloseTo(1.8, 2);
    expect(r.severity).toBe("green");
    expect(evaluateMarket(market(2), "2026-01-10", SEED, 110_000, 1, REF).severity).toBe("yellow");
    expect(evaluateMarket(market(2), "2026-01-10", SEED, 125_000, 1, REF).severity).toBe("red");
  });

  it("only uses complete months (a month's prices are visible the month after)", () => {
    expect(evaluateMarket(market(1, 2), "2025-12-20", SEED, small, 1, REF).price?.month).toBe("2025-08");
  });

  it("takes the reference price from the last harvest window before approval", () => {
    // Approval Sep 2025 → Apr–Jul 2025, volume-weighted (Veritrade): about $1.68/kg.
    expect(referenceHarvestPrice(DATA.market, SEED.approvalDate)).toBeCloseTo(1.675, 2);
  });

  it("rescales the seasonal band to the price level at approval", () => {
    const raw = buildMarketSeries(DATA.market);
    const anchored = buildMarketSeries(DATA.market, SEED.approvalDate);
    const atApproval = anchored.find((p) => p.month === "2025-08")!;
    expect(atApproval.p50).toBeCloseTo(atApproval.usdPerKg, 2);
    expect(anchored.length).toBe(raw.length);
  });
});

// ---------------------------------------------------------------------------

describe("re-scoring and campaign replay", () => {
  const green: PanelState = { panel: "crop", severity: "green", triggers: [] };
  const panels = (over: Partial<Record<PanelId, PanelState["severity"]>>) =>
    Object.fromEntries(
      (["crop", "weather", "market", "takeout"] as PanelId[]).map((p) => [p, { ...green, panel: p, severity: over[p] ?? "green" }]),
    ) as Record<PanelId, PanelState>;

  it("re-scores the dimension each panel affects", () => {
    const origin = scorePreHarvest(SEED, SIGNALS);
    expect(rescore(origin, panels({}), SEED).composite).toBe(67);
    expect(rescore(origin, panels({ crop: "yellow" }), SEED).composite).toBe(62);
    expect(rescore(origin, panels({ crop: "red" }), SEED).composite).toBe(56);
  });

  it("scores the seed deal at 67 B on the real data at approval", () => {
    const sim = simulateCampaign(SEED, DATA);
    expect(sim.signals.enso).toBeCloseTo(0.43, 2);
    expect(sim.origination.composite).toBe(67);
    expect(sim.origination.tier).toBe("B");
    expect(sim.frames[0].tranches.find((t) => t.id === "approval")?.status).toBe("released");
  });

  it("keeps a stop sticky and stops every remaining tranche", () => {
    const sim = simulateStressed(SEED, DATA, "bad_quality");
    const firstStop = sim.frames.findIndex((f) => f.action === "stop");
    expect(firstStop).toBeGreaterThan(0);
    expect(sim.frames.slice(firstStop).every((f) => f.action === "stop")).toBe(true);
    const last = sim.frames.at(-1)!;
    expect(last.tranches.filter((t) => t.status !== "released").every((t) => t.status === "stopped")).toBe(true);
  });

  it("ends the can't-repay scenario with a red market alert", () => {
    const sim = simulateStressed(SEED, DATA, "cant_repay");
    expect(sim.alerts.some((a) => a.panel === "market" && a.severity === "red")).toBe(true);
  });

  it("logs an alert once per escalation, not every week", () => {
    const sim = simulateStressed(SEED, DATA, "weather_shock");
    const keys = sim.alerts.map((a) => `${a.panel}:${a.metric}:${a.severity}`);
    const consecutiveDupes = keys.filter((k, i) => i > 0 && keys[i - 1] === k);
    expect(consecutiveDupes).toEqual([]);
  });
});
