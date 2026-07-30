/**
 * Transaction Structure compute engine — implements two things kept
 * numerically consistent:
 *
 * 1. The Kanato CRAM Transaction Structure model (docs/transaction-structure-model-reference.md)
 *    — cash-flow engine (4 signed tranches), Sub-A (payment terms/cash flow),
 *    Sub-B (collateral/security, 0% weight per Kanato's own calibration —
 *    kept computed/displayed, not scored), Sub-D (downside resilience via
 *    Upside:Downside Ratio), composite/tier/protocol. Formulas and bucket
 *    tables transcribed verbatim from that doc's §4–§9.
 *
 * 2. The deal-sensitivity-playbook.md's legs/cost-stack/insurance-overlay
 *    extension (2026-07-28) — multiple supply legs (sourcing/EXW/FOB-ready),
 *    a 3-layer cost stack (per-unit variable, per-deal fixed, per-leg
 *    purchase), and an insurance recovery overlay. When legs are supplied,
 *    their derived total cost/revenue feed directly into the Kanato cash-flow
 *    engine's purchaseTotal/saleTotal — so peak negative position, exposure
 *    duration, best/worst-case margin, and the upside:downside ratio all
 *    automatically reflect the itemized cost stack without re-deriving them
 *    separately.
 */
import type {
  CashFlowResult,
  DealFixedCost,
  DealLeg,
  DealPurpose,
  InsuranceOverlay,
  InsuranceOverlayResult,
  LegResult,
  ResolvedTransactionStructure,
  SensitivityAxis,
  SensitivityTable,
  StructureKpis,
  StructureTier,
  TransactionStructureInput,
  TransactionStructureReport,
  TransactionStructureScore,
} from "./types";

/** Empty starting point for the interactive builder — no legs, no tranches entered yet. */
export function blankTransactionStructureInput(): TransactionStructureInput {
  return {
    purchaseTotalUSD: null,
    saleTotalUSD: null,
    salePricePerKg: null,
    supAdvDay: null,
    supAdvPct: null,
    supFinDay: null,
    supFinPct: null,
    buyFirstDay: null,
    buyFirstPct: null,
    buyFinalDay: null,
    buyFinalPct: null,
    dealPurpose: null,
    tmProductOwnership: null,
    collectionRights: null,
    legs: [],
    fixedCosts: [],
    insurance: null,
  };
}

/** Minimal deal fields needed to seed an exploration-ready structure. */
export interface DealStructureSeed {
  dealValueUSD: number;
  offerUnitPriceUSD?: number | null;
  advancePaymentPct?: number;
  estimatedTransitDays?: number;
}

let defaultIdSeq = 0;
function defaultId(prefix: string): string {
  defaultIdSeq += 1;
  return `${prefix}-default-${defaultIdSeq}`;
}

/**
 * Seed a usable FOB-ready structure from deal value so KPIs / sensitivity
 * work immediately (deal-sensitivity-playbook exploration defaults).
 * Not verified deal economics — UI must label as exploration defaults.
 */
export function defaultStructureFromDeal(deal: DealStructureSeed): TransactionStructureInput {
  const saleTotal = Math.max(0, deal.dealValueUSD);
  const unitPrice =
    deal.offerUnitPriceUSD != null && deal.offerUnitPriceUSD > 0
      ? deal.offerUnitPriceUSD
      : saleTotal > 0
        ? 5
        : 5;
  const netKg = saleTotal > 0 ? saleTotal / unitPrice : 1000;
  const salePricePerKg = unitPrice;
  // Illustrative 15% gross margin before fixed logistics — labeled assumption.
  const purchasePricePerKg = Math.round(salePricePerKg * 0.85 * 100) / 100;
  const fixedLogistics = Math.max(500, Math.round(saleTotal * 0.02));
  const transit = Math.max(1, deal.estimatedTransitDays ?? 30);
  const buyerFirstDay = Math.max(0, transit);
  const buyerFinalDay = buyerFirstDay + 10;
  const advancePct = Math.max(0, Math.min(100, deal.advancePaymentPct ?? 0)) / 100;
  // Documentary-style split: first collection on BL/arrival, balance later.
  // If the deal already has an advance %, treat that as buyer first %.
  const buyFirstPct = advancePct > 0 ? advancePct : 0.7;
  const buyFinalPct = Math.max(0, 1 - buyFirstPct);

  return {
    purchaseTotalUSD: null,
    saleTotalUSD: null,
    salePricePerKg,
    // Supplier paid earlier than buyer collections (capital need).
    supAdvDay: 0,
    supAdvPct: 0.5,
    supFinDay: Math.max(0, buyerFirstDay - 5),
    supFinPct: 0.5,
    buyFirstDay: buyerFirstDay,
    buyFirstPct,
    buyFinalDay: buyerFinalDay,
    buyFinalPct,
    dealPurpose: "Export",
    tmProductOwnership: true,
    collectionRights: true,
    legs: [
      {
        id: defaultId("leg"),
        label: "FOB-ready supply (default)",
        legType: "fob_ready",
        grossKg: Math.round(netKg * 100) / 100,
        discardPct: 0,
        kgPerCarton: 1.5,
        priceBasis: "packed_kg",
        purchasePricePerKg,
        variableCosts: [
          {
            id: defaultId("cost"),
            label: "Onward logistics / handling",
            amountPerUnit: 0,
            unit: "per_kg",
            taxRatePct: 0,
          },
        ],
      },
    ],
    fixedCosts: [
      {
        id: defaultId("fixed"),
        label: "Logistics to port (default)",
        amountUSD: fixedLogistics,
      },
    ],
    insurance: null,
    structureSource: "default",
  };
}

/** Apply playbook Module 3 what-if overrides onto a structure copy (sandbox). */
export function applyStructureWhatIf(
  input: TransactionStructureInput,
  overrides: {
    salePricePerKg?: number;
    costShiftPerKg?: number;
    discardPct?: number; // 0–100, sourcing legs only
  },
): TransactionStructureInput {
  const costShift = overrides.costShiftPerKg ?? 0;
  const discardFrac =
    overrides.discardPct !== undefined ? Math.max(0, Math.min(100, overrides.discardPct)) / 100 : null;
  return {
    ...input,
    salePricePerKg: overrides.salePricePerKg ?? input.salePricePerKg,
    legs: input.legs.map((leg) => ({
      ...leg,
      discardPct:
        leg.legType === "sourcing" && discardFrac !== null ? discardFrac : leg.discardPct,
      purchasePricePerKg: Math.max(0, leg.purchasePricePerKg + costShift),
    })),
    purchaseTotalUSD: null,
    saleTotalUSD: null,
  };
}

/** Resolve structure for UI: keep user/deal structure if present, else seed defaults. */
export function structureForDeal(
  deal: DealStructureSeed & { transactionStructure?: TransactionStructureInput | null },
): TransactionStructureInput {
  if (hasTransactionStructureInput(deal.transactionStructure)) {
    return deal.transactionStructure;
  }
  return defaultStructureFromDeal(deal);
}

// ---------------------------------------------------------------------------
// Resolution — fill defaults, track completeness (same convention as
// product-risk-tables.ts / route-risk-tables.ts: real value where one exists,
// a neutral default where it doesn't, always reported in missingFields).
// ---------------------------------------------------------------------------

function computeLegAggregates(legs: DealLeg[], fixedCosts: DealFixedCost[]) {
  const totalFixedCostUSD = fixedCosts.reduce((sum, f) => sum + f.amountUSD, 0);

  const withNetKg = legs.map((leg) => {
    const netKg =
      leg.legType === "sourcing"
        ? leg.grossKg * (1 - clamp01(leg.discardPct))
        : leg.grossKg;
    return { leg, netKg };
  });
  const totalKg = withNetKg.reduce((sum, { netKg }) => sum + netKg, 0);

  const legResults: LegResult[] = withNetKg.map(({ leg, netKg }) => {
    const cartons = leg.kgPerCarton > 0 ? netKg / leg.kgPerCarton : 0;
    // Sourcing legs are priced per gross kg by convention (you pay for what
    // you bought at the orchard, discard included); EXW/FOB-ready legs are
    // priced per the already-packed/net kg stated on `grossKg`.
    const purchaseCostUSD =
      leg.priceBasis === "gross_kg"
        ? leg.grossKg * leg.purchasePricePerKg
        : netKg * leg.purchasePricePerKg;
    const variableCostUSD = leg.variableCosts.reduce((sum, c) => {
      const base =
        c.unit === "per_carton" ? cartons * c.amountPerUnit : c.unit === "per_kg" ? netKg * c.amountPerUnit : c.amountPerUnit;
      return sum + base * (1 + c.taxRatePct / 100);
    }, 0);
    const allocatedFixedCostUSD = totalKg > 0 ? totalFixedCostUSD * (netKg / totalKg) : 0;
    const landedCostPerKg =
      netKg > 0 ? (purchaseCostUSD + variableCostUSD + allocatedFixedCostUSD) / netKg : 0;
    return {
      legId: leg.id,
      label: leg.label,
      legType: leg.legType,
      netKg,
      cartons,
      purchaseCostUSD,
      variableCostUSD,
      allocatedFixedCostUSD,
      landedCostPerKg,
    };
  });

  const totalPurchaseCost = legResults.reduce((s, r) => s + r.purchaseCostUSD, 0);
  const totalVariableCost = legResults.reduce((s, r) => s + r.variableCostUSD, 0);
  const totalCost = totalPurchaseCost + totalVariableCost + totalFixedCostUSD;

  return { legResults, totalKg, totalCost };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

const DEFAULTS = {
  supAdvDay: 0,
  supAdvPct: 1,
  supFinDay: 0,
  supFinPct: 0,
  buyFirstDay: 30,
  buyFirstPct: 1,
  buyFinalDay: 30,
  buyFinalPct: 0,
  dealPurpose: "Export" as DealPurpose,
  tmProductOwnership: true,
  collectionRights: true,
};

export function resolveTransactionStructure(
  input: TransactionStructureInput,
  fallbackDealValueUSD: number,
): { resolved: ResolvedTransactionStructure; legResults: LegResult[]; totalKg: number } {
  const missingFields: string[] = [];
  const { legResults, totalKg, totalCost } = computeLegAggregates(input.legs, input.fixedCosts);
  const hasLegs = input.legs.length > 0;

  let purchaseTotal = input.purchaseTotalUSD;
  if (purchaseTotal === null) {
    if (hasLegs) purchaseTotal = totalCost;
    else missingFields.push("purchase total (or add supply legs)");
  }

  let saleTotal = input.saleTotalUSD;
  if (saleTotal === null) {
    if (hasLegs && input.salePricePerKg !== null) saleTotal = totalKg * input.salePricePerKg;
    else missingFields.push("sale total (or add supply legs + sale price/kg)");
  }

  if (purchaseTotal === null) purchaseTotal = fallbackDealValueUSD;
  if (saleTotal === null) saleTotal = fallbackDealValueUSD;

  const field = <K extends keyof typeof DEFAULTS>(
    key: K,
    value: (typeof DEFAULTS)[K] | null,
    label: string,
  ): (typeof DEFAULTS)[K] => {
    if (value === null) {
      missingFields.push(label);
      return DEFAULTS[key];
    }
    return value;
  };

  const resolved: ResolvedTransactionStructure = {
    purchaseTotal,
    saleTotal,
    supAdvDay: field("supAdvDay", input.supAdvDay, "supplier advance day"),
    supAdvPct: field("supAdvPct", input.supAdvPct, "supplier advance %"),
    supFinDay: field("supFinDay", input.supFinDay, "supplier final day"),
    supFinPct: field("supFinPct", input.supFinPct, "supplier final %"),
    buyFirstDay: field("buyFirstDay", input.buyFirstDay, "buyer first-payment day"),
    buyFirstPct: field("buyFirstPct", input.buyFirstPct, "buyer first-payment %"),
    buyFinalDay: field("buyFinalDay", input.buyFinalDay, "buyer final-payment day"),
    buyFinalPct: field("buyFinalPct", input.buyFinalPct, "buyer final-payment %"),
    dealPurpose: field("dealPurpose", input.dealPurpose, "deal purpose"),
    tmProductOwnership: field("tmProductOwnership", input.tmProductOwnership, "TM product ownership"),
    collectionRights: field("collectionRights", input.collectionRights, "collection rights (CISG)"),
    complete: false,
    missingFields,
  };
  resolved.complete = missingFields.length === 0;
  return { resolved, legResults, totalKg };
}

// ---------------------------------------------------------------------------
// Cash-flow engine — §4 of the reference doc, verbatim.
// ---------------------------------------------------------------------------

const SEVERITY = 1; // §7: worst case models total non-payment of the final tranche.

export function computeCashFlow(r: ResolvedTransactionStructure): CashFlowResult {
  const supplierAdvanceAmount = -r.supAdvPct * r.purchaseTotal;
  const supplierFinalAmount = -r.supFinPct * r.purchaseTotal;
  const buyerFirstAmount = r.buyFirstPct * r.saleTotal;
  const buyerFinalAmount = r.buyFinalPct * r.saleTotal;

  const cum1 = supplierAdvanceAmount;
  const cum2 = cum1 + supplierFinalAmount;
  const cum3 = cum2 + buyerFirstAmount;
  const cum4 = cum3 + buyerFinalAmount;

  const peakNegativePosition = Math.min(cum1, cum2, cum3, cum4);
  const exposureDuration = r.buyFinalDay - r.supAdvDay;
  const bestCaseMargin = cum4;
  const worstCaseMargin = cum3 + buyerFinalAmount * (1 - SEVERITY);

  let upsideDownsideRatio: number | null = null;
  if (worstCaseMargin < 0) {
    upsideDownsideRatio = bestCaseMargin / Math.abs(worstCaseMargin);
  }

  return {
    supplierAdvanceAmount,
    supplierFinalAmount,
    buyerFirstAmount,
    buyerFinalAmount,
    cum1,
    cum2,
    cum3,
    cum4,
    peakNegativePosition,
    exposureDuration,
    bestCaseMargin,
    worstCaseMargin,
    upsideDownsideRatio,
  };
}

// ---------------------------------------------------------------------------
// KPIs — playbook Module 2.
// ---------------------------------------------------------------------------

export function computeKpis(
  r: ResolvedTransactionStructure,
  cashFlow: CashFlowResult,
  totalKg: number,
): StructureKpis {
  const collectedFraction = r.buyFirstPct + r.buyFinalPct;
  const cashCollected = cashFlow.buyerFirstAmount + cashFlow.buyerFinalAmount;
  const margin = cashCollected - r.purchaseTotal;

  const breakevenPrice =
    totalKg > 0 && collectedFraction > 0 ? r.purchaseTotal / (totalKg * collectedFraction) : null;

  const stillOwedAfterFirst = r.purchaseTotal - cashFlow.buyerFirstAmount;
  const minCollectionToBreakevenPct =
    cashFlow.buyerFinalAmount > 0 ? (stillOwedAfterFirst / cashFlow.buyerFinalAmount) * 100 : null;
  const minCollectionToBreakevenPctOfInvoice =
    r.saleTotal > 0 ? (stillOwedAfterFirst / r.saleTotal) * 100 : null;

  const selfFundingPrice =
    totalKg > 0 && r.buyFirstPct > 0 ? r.purchaseTotal / (totalKg * r.buyFirstPct) : null;

  return {
    totalKg,
    revenue: r.saleTotal,
    cost: r.purchaseTotal,
    cashCollected,
    margin,
    capitalNeed: Math.abs(cashFlow.peakNegativePosition),
    exposureAfterFirstCollection: Math.max(0, -cashFlow.cum3),
    breakevenPrice,
    minCollectionToBreakevenPct,
    minCollectionToBreakevenPctOfInvoice,
    maxLossOnDefault: cashFlow.cum3 < 0 ? cashFlow.cum3 : 0,
    selfFundingPrice,
  };
}

// ---------------------------------------------------------------------------
// Insurance overlay — playbook Module 2.
// ---------------------------------------------------------------------------

export function computeInsuranceOverlay(
  overlay: InsuranceOverlay | null,
  cashFlow: CashFlowResult,
  expectedFinalPaymentDate: Date,
): InsuranceOverlayResult | null {
  if (!overlay || overlay.indemnityPct === null || overlay.coverageCapUSD === null) return null;
  const shortfall = Math.max(0, -cashFlow.worstCaseMargin);
  const recovery = Math.min(shortfall * (overlay.indemnityPct / 100), overlay.coverageCapUSD);
  let validityWarning: string | null = null;
  if (overlay.policyValidityDate) {
    const validity = new Date(overlay.policyValidityDate);
    if (!Number.isNaN(validity.getTime()) && validity < expectedFinalPaymentDate) {
      validityWarning = `Policy valid until ${overlay.policyValidityDate}, before the expected final-payment date (${expectedFinalPaymentDate.toISOString().slice(0, 10)}) — cover may lapse before collection risk does.`;
    }
  }
  return {
    shortfall,
    recovery,
    marginBeforeInsurance: cashFlow.worstCaseMargin,
    marginAfterInsurance: cashFlow.worstCaseMargin + recovery,
    validityWarning,
  };
}

// ---------------------------------------------------------------------------
// Scoring — Sub-A / Sub-B / Sub-D, §5–§9 of the reference doc, verbatim.
// ---------------------------------------------------------------------------

function bucketFloor(value: number, table: Array<[number, number]>): number {
  let pts = table[0][1];
  for (const [min, points] of table) {
    if (value >= min) pts = points;
  }
  return pts;
}

const PAYMENT_TERMS_BUCKETS: Array<[number, number]> = [
  [0, 100],
  [30, 80],
  [35, 60],
  [45, 40],
  [60, 20],
  [91, 0],
];

const UPSIDE_DOWNSIDE_BUCKETS: Array<[number, number]> = [
  [0.0, 0],
  [0.2, 20],
  [0.4, 30],
  [0.6, 40],
  [0.8, 45],
  [1.0, 50],
  [1.5, 60],
  [2.0, 70],
  [3.0, 80],
  [5.0, 90],
  [10.0, 95],
];

const CONTRACT_TYPE_PTS: Record<string, number> = { Spot: 100, Forward: 60, Seasonal: 40 };
const DEAL_PURPOSE_PTS: Record<DealPurpose, number> = { Export: 100, Retail: 80, Processing: 60, Resale: 40 };

const TIERS: Array<{ tier: StructureTier; min: number; protocol: string }> = [
  { tier: "Strong", min: 80, protocol: "Standard terms, fast-track routing" },
  { tier: "Adequate", min: 60, protocol: "Proceeds at policy-minimum collateral/advance requirements" },
  { tier: "Weak", min: 40, protocol: "Requires additional collateral/insurance or reduced financing % before approval" },
  { tier: "Insufficient", min: 0, protocol: "Restructure required, or escalate/decline" },
];

// Top-level + Sub-A weights, §9. Sub-B stays 0% per Kanato's explicit
// calibration decision — computed/displayed for reference, not scored.
const W_A = 0.5;
const W_B = 0;
const W_D = 0.5;
const W_PAYMENT_TERMS = 0.6;
const W_ADVANCE = 0.1;
const W_CONTRACT_TYPE = 0.15;
const W_DEAL_PURPOSE = 0.15;
const W_OWNERSHIP_COLLECTION = 0.5;
const W_COVERAGE_RATIO = 0.5;

export function computeStructureScoreFromReport(
  r: ResolvedTransactionStructure,
  cashFlow: CashFlowResult,
  advancePaymentPct: number,
  contractType: string,
): TransactionStructureScore {
  const paymentTermsPts = bucketFloor(cashFlow.exposureDuration, PAYMENT_TERMS_BUCKETS);
  const advancePts = Math.max(0, Math.min(100, advancePaymentPct));
  const contractTypePts = CONTRACT_TYPE_PTS[contractType] ?? 60;
  const dealPurposePts = DEAL_PURPOSE_PTS[r.dealPurpose];

  const subA =
    paymentTermsPts * W_PAYMENT_TERMS +
    advancePts * W_ADVANCE +
    contractTypePts * W_CONTRACT_TYPE +
    dealPurposePts * W_DEAL_PURPOSE;

  const ownershipCollectionPts = Math.min(
    100,
    (r.tmProductOwnership || r.collectionRights ? 100 : 0) + (r.tmProductOwnership && r.collectionRights ? 10 : 0),
  );
  const coverageRatio = r.saleTotal > 0 ? cashFlow.buyerFirstAmount / r.saleTotal : 0;
  const coverageRatioPts = Math.round(clamp01(coverageRatio) * 100);
  const subB = ownershipCollectionPts * W_OWNERSHIP_COLLECTION + coverageRatioPts * W_COVERAGE_RATIO;

  const subD =
    cashFlow.worstCaseMargin >= 0
      ? 100
      : cashFlow.upsideDownsideRatio !== null
        ? bucketFloor(cashFlow.upsideDownsideRatio, UPSIDE_DOWNSIDE_BUCKETS)
        : 0;

  const composite = subA * W_A + subB * W_B + subD * W_D;
  const { tier, protocol } = TIERS.find((t) => composite >= t.min) ?? TIERS[TIERS.length - 1];

  return {
    subA: Math.round(subA * 10) / 10,
    subB: Math.round(subB * 10) / 10,
    subD: Math.round(subD * 10) / 10,
    composite: Math.round(composite * 10) / 10,
    tier,
    protocol,
    cashFlow,
    paymentTermsPts,
    advancePts,
    contractTypePts,
    dealPurposePts,
    exposureDuration: cashFlow.exposureDuration,
    complete: r.complete,
    missingFields: r.missingFields,
  };
}

// ---------------------------------------------------------------------------
// Sensitivity — playbook Module 3. Pure recompute of total margin at
// overridden settings, so every table cell is just this function in a loop.
// ---------------------------------------------------------------------------

interface SensitivityOverrides {
  salePricePerKgOverride?: number;
  collectionPctOverride?: number; // 0–1, applied to the final tranche only
  costShiftPerKg?: number; // added to every leg's purchasePricePerKg
  discardPctOverride?: number; // 0–1, applied to every sourcing leg
}

function marginAt(
  input: TransactionStructureInput,
  fallbackDealValueUSD: number,
  overrides: SensitivityOverrides,
): number {
  const legs = input.legs.map((leg) => ({
    ...leg,
    discardPct:
      leg.legType === "sourcing" && overrides.discardPctOverride !== undefined
        ? overrides.discardPctOverride
        : leg.discardPct,
    purchasePricePerKg: leg.purchasePricePerKg + (overrides.costShiftPerKg ?? 0),
  }));
  const adjustedInput: TransactionStructureInput = {
    ...input,
    legs,
    salePricePerKg: overrides.salePricePerKgOverride ?? input.salePricePerKg,
    purchaseTotalUSD: null,
    saleTotalUSD: null,
  };
  const { resolved, totalKg } = resolveTransactionStructure(adjustedInput, fallbackDealValueUSD);
  const cashFlow = computeCashFlow(resolved);
  const collectionPct = overrides.collectionPctOverride ?? 1;
  const cashCollected = cashFlow.buyerFirstAmount + cashFlow.buyerFinalAmount * collectionPct;
  void totalKg;
  return cashCollected - resolved.purchaseTotal;
}

function stepRange(current: number, stepSize: number, steps: number): number[] {
  const values: number[] = [];
  for (let i = -steps; i <= steps; i++) values.push(Math.max(0, current + i * stepSize));
  return values;
}

function buildTable(
  input: TransactionStructureInput,
  fallbackDealValueUSD: number,
  rowAxis: SensitivityAxis,
  rowValues: number[],
  colAxis: SensitivityAxis,
  colValues: number[],
): SensitivityTable {
  const overridesFor = (rowV: number, colV: number): SensitivityOverrides => {
    const o: SensitivityOverrides = {};
    for (const [axis, v] of [
      [rowAxis, rowV],
      [colAxis, colV],
    ] as const) {
      if (axis.kind === "price") o.salePricePerKgOverride = v;
      else if (axis.kind === "collectionPct") o.collectionPctOverride = v / 100;
      else if (axis.kind === "costShift") o.costShiftPerKg = v;
      else if (axis.kind === "discardPct") o.discardPctOverride = v / 100;
    }
    return o;
  };
  const cells = rowValues.map((rowV) => colValues.map((colV) => marginAt(input, fallbackDealValueUSD, overridesFor(rowV, colV))));
  return {
    rowAxis,
    colAxis,
    rowValues,
    colValues,
    cells,
    currentRowIndex: Math.floor(rowValues.length / 2),
    currentColIndex: Math.floor(colValues.length / 2),
  };
}

export function buildSensitivityTables(
  input: TransactionStructureInput,
  fallbackDealValueUSD: number,
  currentSalePricePerKg: number,
): SensitivityTable[] {
  const tables: SensitivityTable[] = [];
  const priceStep = Math.max(0.05, Math.round(currentSalePricePerKg * 0.05 * 100) / 100);
  const priceValues = stepRange(currentSalePricePerKg, priceStep, 4);

  tables.push(
    buildTable(
      input,
      fallbackDealValueUSD,
      { kind: "price", label: "Sale price ($/kg)" },
      priceValues,
      { kind: "collectionPct", label: "Collection % of final tranche" },
      [100, 75, 50, 25, 0],
    ),
  );

  tables.push(
    buildTable(
      input,
      fallbackDealValueUSD,
      { kind: "price", label: "Sale price ($/kg)" },
      priceValues,
      { kind: "costShift", label: "Cost shift ($/kg on supply legs)" },
      [-0.5, -0.25, 0, 0.25, 0.5],
    ),
  );

  if (input.legs.some((l) => l.legType === "sourcing")) {
    const avgPrice =
      input.legs.filter((l) => l.legType === "sourcing").reduce((s, l) => s + l.purchasePricePerKg, 0) /
      Math.max(1, input.legs.filter((l) => l.legType === "sourcing").length);
    tables.push(
      buildTable(
        input,
        fallbackDealValueUSD,
        { kind: "costShift", label: "Purchase price shift ($/kg)" },
        stepRange(avgPrice, Math.max(0.05, Math.round(avgPrice * 0.05 * 100) / 100), 4).map((v) => v - avgPrice),
        { kind: "discardPct", label: "Discard %" },
        [0, 5, 10, 15, 20],
      ),
    );
  }

  return tables;
}

// ---------------------------------------------------------------------------
// Orchestrator — the one entry point a UI/report needs.
// ---------------------------------------------------------------------------

/** True when the deal has actually entered any structure input worth using — same "matched vs fallback" convention as product/route tables. */
export function hasTransactionStructureInput(input: TransactionStructureInput | null | undefined): input is TransactionStructureInput {
  if (!input) return false;
  return (
    input.legs.length > 0 ||
    input.purchaseTotalUSD !== null ||
    input.saleTotalUSD !== null ||
    input.supAdvDay !== null ||
    input.buyFirstDay !== null
  );
}

export function buildTransactionStructureReport(
  input: TransactionStructureInput,
  fallbackDealValueUSD: number,
  advancePaymentPct: number,
  contractType: string,
  now: Date = new Date(),
): TransactionStructureReport {
  const { resolved, legResults, totalKg } = resolveTransactionStructure(input, fallbackDealValueUSD);
  const cashFlow = computeCashFlow(resolved);
  const kpis = computeKpis(resolved, cashFlow, totalKg);
  const expectedFinalPaymentDate = new Date(now.getTime() + resolved.buyFinalDay * 24 * 60 * 60 * 1000);
  const insuranceResult = computeInsuranceOverlay(input.insurance, cashFlow, expectedFinalPaymentDate);
  const score = computeStructureScoreFromReport(resolved, cashFlow, advancePaymentPct, contractType);
  const currentSalePricePerKg = input.salePricePerKg ?? (totalKg > 0 ? resolved.saleTotal / totalKg : 0);
  const sensitivity = buildSensitivityTables(input, fallbackDealValueUSD, currentSalePricePerKg);

  return { resolved, legResults, kpis, insuranceResult, score, sensitivity };
}
