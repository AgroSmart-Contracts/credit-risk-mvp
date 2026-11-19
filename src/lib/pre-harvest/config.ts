/**
 * Pre-harvest CRAM configuration: weights, point rules, tiers, monitoring thresholds
 * and the bank actions they trigger. Everything a credit analyst might tune lives here.
 *
 * All values are uncalibrated defaults. Thresholds come from the data-source research
 * (Nov 2026); point rules are set so the seed deal scores Production 72, Operator 65,
 * Structure 70 (composite 69, tier B), matching the BCP presentation example.
 * Back-test against closed campaigns before using any of this to gate real capital.
 */
import type { BankAction, LetterTier, PanelId, Severity } from "./types";

export const PRE_HARVEST_ENGINE_VERSION = "pre-harvest-v0.1";

export const WEIGHTS = {
  production: 0.5,
  operator: 0.35,
  structure: 0.15,
  /** Dormant until M3 (purchase order signed); the deal then moves to the post-harvest model. */
  counterparty: 0,
} as const;

export const BASES = { production: 50, operator: 50, structure: 50 } as const;

/** Same letter tiers as the post-harvest engine spec. */
export const TIERS: Array<{ tier: Exclude<LetterTier, "VETO">; min: number }> = [
  { tier: "A", min: 80 },
  { tier: "B", min: 65 },
  { tier: "C", min: 50 },
  { tier: "D", min: 0 },
];

/** Base pricing per tier (% over the campaign), before the tenor multiplier. D is manual. */
export const PRICING_PCT: Record<Exclude<LetterTier, "VETO">, number | null> = {
  A: 7.5,
  B: 8.5,
  C: 10,
  D: null,
};

// ---------------------------------------------------------------------------
// Point rules (first matching band wins)
// ---------------------------------------------------------------------------

export const PRODUCTION_RULES = {
  /** Licensed water allocation ÷ crop water need. */
  waterCoverage: [
    { min: 1.0, pts: 4 },
    { min: 0.85, pts: -3 },
    { min: -Infinity, pts: -12 },
  ],
  /** Irrigation water EC, dS/m (avocado is salt sensitive). */
  salinityEc: [
    { max: 1.5, pts: 3 },
    { max: 3, pts: 0 },
    { max: Infinity, pts: -8 },
  ],
  /** Orchard age in years: Hass bears commercially from about year 4. */
  orchardAge: [
    { min: 4, max: 20, pts: 3 },
    { min: 3, max: 4, pts: 0 },
    { min: 20, max: Infinity, pts: -3 },
    { min: -Infinity, max: 3, pts: -8 },
  ],
  /** Declared yield vs MIDAGRI peer yield (P75) for the zone. Over-declaring is a risk signal. */
  declaredYieldVsPeerP75: [
    { max: 1.0, pts: 2 },
    { max: 1.3, pts: -4 },
    { max: Infinity, pts: -10 },
  ],
  /** Field NDVI vs its own 5-year median at approval, %. */
  satelliteVigorPct: [
    { min: -10, pts: 6 },
    { min: -25, pts: -4 },
    { min: -Infinity, pts: -12 },
  ],
  /**
   * Coastal El Niño at approval: 3-month mean Niño 1+2 anomaly, °C, banded like
   * ENFEN's ICEN classes (neutral < 0.4, weak 0.4–1.0, moderate 1.0–1.7, strong ≥ 1.7).
   * Coastal warming, not the central-Pacific ONI, is what hits Peru's valleys (2017, 2023).
   */
  enso: [
    { max: 0.4, pts: 2 },
    { max: 1.0, pts: -2 },
    { max: 1.7, pts: -6 },
    { max: Infinity, pts: -12 },
  ],
  senasa: { free: 4, low_prevalence: 0 },
  inspection: { bothOk: 2, oneIssue: -4, bothIssues: -10 },
} as const;

export const OPERATOR_RULES = {
  /** Last campaign revenue vs the oldest of the three. */
  revenueTrend: { growingPts: 6, flatBandPct: 10, flatPts: 2, decliningPts: -8 },
  /** Last campaign revenue ÷ loan envelope. */
  revenueToEnvelope: [
    { min: 1.5, pts: 4 },
    { min: 1.0, pts: 0 },
    { min: -Infinity, pts: -10 },
  ],
  credit: { Normal: 6, CPP: -4, Deficiente: -15, Dudoso: -25 },
  protestedDebtPts: -5,
  tenure: { ownedClear: 6, ownedOneLien: 2, leased: 1, informal: -10, multipleLiensPts: -8 },
  exporter: { strongMin: 60, strongPts: 6, weakPts: 2, noOwnRecordPts: -3 },
  packhouse: { contractPts: 3, utilizationOkMax: 85, utilizationOkPts: 1, overMax: 100, overPts: -6 },
  certification: { globalGapPts: 3, ipmRecordsPts: 2, noIpmRecordsPts: -2 },
} as const;

export const STRUCTURE_RULES = {
  /** Loan ÷ projected campaign cost, %. */
  ltvPct: [
    { max: 60, pts: 12 },
    { max: 70, pts: 8 },
    { max: 80, pts: 0 },
    { max: Infinity, pts: -12 },
  ],
  phenologyTranchesPts: 4,
  /** Number of insurance layers in place (catastrophic, commercial, parametric). */
  insuranceLayers: { 3: 10, 2: 6, 1: 2, 0: -10 } as Record<number, number>,
  tenor: { shortMaxDays: 180, shortPts: 2, longMinDays: 240, longPts: -5 },
} as const;

// ---------------------------------------------------------------------------
// Tranches (tied to crop stage, not calendar)
// ---------------------------------------------------------------------------

export const TRANCHES = [
  { id: "approval", pct: 30 },
  { id: "fruit_set", pct: 40 },
  { id: "pre_harvest", pct: 30 },
] as const;

// ---------------------------------------------------------------------------
// Monitoring thresholds
// ---------------------------------------------------------------------------

export const CROP_THRESHOLDS = {
  /** MODIS composites are 16-day, so "bins" are composites. */
  yellowPctBelowMedian: 15,
  yellowConsecutiveBins: 2,
  redPctBelowMedian: 25,
  redConsecutiveBins: 3,
  /** Vegetation Condition Index (Kogan): < 35 drought, < 20 severe. */
  vciYellow: 35,
  vciRed: 20,
  /** VCI must stay low this many composites in a row (filters single cloudy composites). */
  vciConsecutiveBins: 2,
  /** VCI compares against the best and worst year on record: needs enough years to be meaningful. */
  vciMinYears: 7,
  /** VCI only counts when NDVI is also this far below the field median (irrigated orchards rarely touch their record lows). */
  vciMinBelowMedianPct: 5,
  fruitSetLateRedDays: 21,
  /** Planting validation: a standing orchard reads well above bare soil (~0.1). */
  plantingMinNdvi: 0.35,
  plantingWindowDays: 60,
  /**
   * Crop-type validation for evergreen crops (Hass avocado): the second-lowest 16-day
   * NDVI over the previous two years stays well above a dormant / pruned canopy. Table
   * grapes in Ica drop to ~0.2 every June after pruning.
   */
  evergreenMinNdvi: 0.4,
  evergreenLookbackDays: 730,
  baselineYears: 5,
  /**
   * A season counts toward the field's baseline only once the canopy is established
   * (annual median NDVI at or above this). A young orchard still closing its canopy
   * would otherwise read far "above normal" against its own bare early years.
   */
  establishedMinNdvi: 0.45,
  /** Fewer established seasons than this: no vigour-vs-normal reading at approval. */
  minBaselineYears: 2,
  /** Same-season window when building the field's own baseline. */
  seasonWindowDays: 12,
} as const;

export const WEATHER_THRESHOLDS = {
  /** Heat and cold thresholds apply around flowering and fruit set only. */
  sensitiveWindowDaysAfterFruitSet: 30,
  lookbackDays: 16,
  tmaxYellow: 33,
  tmaxRed: 36,
  heatYellowDays: 3,
  tminYellow: 8,
  coldYellowDays: 3,
  frostTminRed: 0,
  precipZYellow: 1.5,
  precipZRed: 2,
  /** Ica is almost rainless; floor the std so a drizzle does not read as a 10σ event. */
  precipMinStdMm: 3,
  /** Coastal El Niño (3-month mean Niño 1+2 anomaly, °C): ENFEN moderate / strong. */
  ensoYellow: 1.0,
  ensoRed: 1.7,
  ensoWindowMonths: 3,
  /**
   * Water: licensed allocation ÷ crop demand, where demand is the declared annual
   * need scaled by the last 30 days of evapotranspiration vs normal for the season.
   * Villacurí runs on groundwater, so the licence, not river flow, caps irrigation.
   */
  waterLookbackDays: 30,
  waterCoverageYellow: 1.0,
  waterCoverageRed: 0.85,
} as const;

export const MARKET_THRESHOLDS = {
  /**
   * Seasonal band: the spread of every earlier year's price for the same calendar
   * month, rescaled to the price level at approval. Peru's avocado price level moves
   * between years (2025 was a record-volume, low-price year), so the bank judges the
   * move since underwriting against the normal seasonal pattern, not the raw history.
   */
  yellowBelow: "p25",
  redBelow: "p10",
  yellowDropPct: 15,
  redDropPct: 30,
  coverageYellow: 1.5,
  coverageRed: 1.2,
  /** Hass harvest window in Peru (calendar months). Loan repayment comes from these sales. */
  harvestMonths: [4, 5, 6, 7],
  /** Share of the crop that makes export grade. */
  exportableSharePct: 80,
  /** Share of the FOB price that reaches the grower after packing, freight and fees. */
  farmGateSharePct: 65,
  /** Satellite yield adjustment: mean of the last N composites, ignored within ±dead-band, clamped. */
  yieldAdjustComposites: 3,
  yieldAdjustDeadBandPct: 10,
  yieldAdjustMin: 0.6,
  yieldAdjustMax: 1.1,
} as const;

export const TAKEOUT_THRESHOLDS = {
  /** Post-harvest advance ÷ pre-harvest amount due. */
  coverageYellow: 1.1,
  coverageRed: 1.0,
  /** Days after the declared M3 before a missing PO or Coface decision turns red. */
  graceDays: 14,
} as const;

// ---------------------------------------------------------------------------
// Re-scoring and bank actions
// ---------------------------------------------------------------------------

/** Dimension points removed while a panel is yellow or red. */
export const MONITORING_PENALTIES: Record<
  PanelId,
  { dimension: "production" | "operator"; yellow: number; red: number }
> = {
  crop: { dimension: "production", yellow: -10, red: -22 },
  weather: { dimension: "production", yellow: -6, red: -14 },
  market: { dimension: "operator", yellow: -12, red: -28 },
  takeout: { dimension: "operator", yellow: -10, red: -30 },
};

/** Action each panel asks for at each severity. The strongest action wins. */
export const PANEL_ACTIONS: Record<PanelId, Record<Severity, BankAction>> = {
  crop: { green: "continue", yellow: "hold_tranche", red: "stop" },
  weather: { green: "continue", yellow: "call_inspection", red: "hold_tranche" },
  market: { green: "continue", yellow: "hold_tranche", red: "stop" },
  // At M3 all tranches are out: red means no takeout, the loan goes to the committee.
  takeout: { green: "continue", yellow: "call_inspection", red: "stop" },
};

/** Action the re-scored tier asks for on its own. */
export const TIER_ACTIONS: Record<LetterTier, BankAction> = {
  A: "continue",
  B: "continue",
  C: "call_inspection",
  D: "hold_tranche",
  VETO: "stop",
};

export const ACTION_ORDER: BankAction[] = ["continue", "call_inspection", "hold_tranche", "stop"];

// ---------------------------------------------------------------------------
// Credit policy (bank view)
// ---------------------------------------------------------------------------

/**
 * Indicative 12-month probability of default by tier. Placeholder values for the
 * pilot; calibrate against closed campaigns before use.
 */
export const PD_BY_TIER: Record<LetterTier, number> = {
  A: 0.01,
  B: 0.025,
  C: 0.06,
  D: 0.15,
  VETO: 1,
};

/** Loss given default: unsecured base, reduced by each mitigant in place. */
export const LGD = {
  basePct: 60,
  perInsuranceLayerPct: 10,
  landCollateralPct: 10,
  packhouseAssignmentPct: 5,
  floorPct: 20,
} as const;

/** SBS provision rate by debtor rating (Res. SBS 11356-2008, no preferred guarantee). */
export const SBS_PROVISION_PCT = {
  Normal: 1,
  CPP: 5,
  Deficiente: 25,
  Dudoso: 60,
  Perdida: 100,
} as const;

/** Credit recommendation by tier. */
export const RECOMMENDATION: Record<LetterTier, "approve" | "approve_conditions" | "committee" | "decline"> = {
  A: "approve",
  B: "approve_conditions",
  C: "committee",
  D: "decline",
  VETO: "decline",
};

/** Stress test grid for revenue coverage: price and yield shocks, %. */
export const STRESS_PRICE_SHOCKS = [0, -10, -20, -30] as const;
export const STRESS_YIELD_SHOCKS = [0, -15, -30] as const;
