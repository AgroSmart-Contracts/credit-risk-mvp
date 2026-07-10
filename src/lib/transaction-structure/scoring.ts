import type { Deal } from "../../types";
import {
  getDealTransactionStructure,
  inferStructureFromDeal,
} from "./infer-from-deal";
import type {
  CashFlowResult,
  DealPurpose,
  ResolvedTransactionStructure,
  StructureTier,
  TransactionStructureScore,
} from "./types";

const SEVERITY = 1;

const PAYMENT_TERMS_BUCKETS = [
  { min: 0, points: 100 },
  { min: 30, points: 80 },
  { min: 35, points: 60 },
  { min: 45, points: 40 },
  { min: 60, points: 20 },
  { min: 91, points: 0 },
] as const;

const CONTRACT_TYPE_POINTS: Record<Deal["contractType"], number> = {
  Spot: 100,
  Forward: 60,
  Seasonal: 40,
};

const DEAL_PURPOSE_POINTS: Record<DealPurpose, number> = {
  Export: 100,
  Retail: 80,
  Processing: 60,
  Resale: 40,
};

const UPSIDE_DOWNSIDE_BUCKETS = [
  { min: 0, points: 0 },
  { min: 0.2, points: 20 },
  { min: 0.4, points: 30 },
  { min: 0.6, points: 40 },
  { min: 0.8, points: 45 },
  { min: 1.0, points: 50 },
  { min: 1.5, points: 60 },
  { min: 2.0, points: 70 },
  { min: 3.0, points: 80 },
  { min: 5.0, points: 90 },
  { min: 10.0, points: 95 },
] as const;

const STRUCTURE_TIERS: Array<{
  min: number;
  tier: StructureTier;
  protocol: string;
}> = [
  {
    min: 80,
    tier: "Strong",
    protocol: "Standard terms, fast-track routing",
  },
  {
    min: 60,
    tier: "Adequate",
    protocol: "Proceeds at policy-minimum collateral/advance requirements",
  },
  {
    min: 40,
    tier: "Weak",
    protocol:
      "Requires additional collateral/insurance or reduced financing % before approval",
  },
  {
    min: 0,
    tier: "Insufficient",
    protocol: "Restructure required, or escalate/decline",
  },
];

const W_A = 0.5;
const W_B = 0;
const W_D = 0.5;

const W_PAYMENT_TERMS = 0.6;
const W_ADVANCE = 0.1;
const W_CONTRACT = 0.15;
const W_PURPOSE = 0.15;

function bucketLookup(
  value: number,
  buckets: ReadonlyArray<{ min: number; points: number }>,
): number {
  let points = buckets[0]?.points ?? 0;
  for (const bucket of buckets) {
    if (value >= bucket.min) points = bucket.points;
  }
  return points;
}

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function pctToFraction(pct: number): number {
  return clampPct(pct) / 100;
}

export function resolveTransactionStructure(
  deal: Deal,
): ResolvedTransactionStructure {
  const inferred = inferStructureFromDeal(deal);
  const missingFields: string[] = [];

  const requireNumber = (
    key: keyof typeof inferred,
    value: number | null,
  ): number | null => {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      missingFields.push(key);
      return null;
    }
    return value;
  };

  const purchaseTotal = requireNumber(
    "purchaseTotalUSD",
    inferred.purchaseTotalUSD,
  );
  const saleTotal = requireNumber("saleTotalUSD", inferred.saleTotalUSD);
  const supAdvDay = requireNumber("supAdvDay", inferred.supAdvDay);
  const supAdvPct = requireNumber("supAdvPct", inferred.supAdvPct);
  const supFinDay = requireNumber("supFinDay", inferred.supFinDay);
  const supFinPct = requireNumber("supFinPct", inferred.supFinPct);
  const buyFirstDay = requireNumber("buyFirstDay", inferred.buyFirstDay);
  const buyFirstPct = requireNumber("buyFirstPct", inferred.buyFirstPct);
  const buyFinalDay = requireNumber("buyFinalDay", inferred.buyFinalDay);
  const buyFinalPct = requireNumber("buyFinalPct", inferred.buyFinalPct);

  if (inferred.dealPurpose === null) missingFields.push("dealPurpose");

  const complete =
    missingFields.length === 0 &&
    purchaseTotal !== null &&
    saleTotal !== null &&
    supAdvDay !== null &&
    supAdvPct !== null &&
    supFinDay !== null &&
    supFinPct !== null &&
    buyFirstDay !== null &&
    buyFirstPct !== null &&
    buyFinalDay !== null &&
    buyFinalPct !== null;

  return {
    purchaseTotal: purchaseTotal ?? 0,
    saleTotal: saleTotal ?? deal.dealValueUSD,
    supAdvDay: supAdvDay ?? 0,
    supAdvPct: supAdvPct ?? 0,
    supFinDay: supFinDay ?? 0,
    supFinPct: supFinPct ?? 0,
    buyFirstDay: buyFirstDay ?? 0,
    buyFirstPct: buyFirstPct ?? 0,
    buyFinalDay: buyFinalDay ?? 0,
    buyFinalPct: buyFinalPct ?? 0,
    dealPurpose: inferred.dealPurpose ?? "Export",
    tmProductOwnership: inferred.tmProductOwnership ?? true,
    collectionRights: inferred.collectionRights ?? true,
    complete,
    missingFields,
  };
}

export function computeCashFlow(
  structure: ResolvedTransactionStructure,
): CashFlowResult {
  const supplierAdvanceAmount =
    -pctToFraction(structure.supAdvPct) * structure.purchaseTotal;
  const supplierFinalAmount =
    -pctToFraction(structure.supFinPct) * structure.purchaseTotal;
  const buyerFirstAmount =
    pctToFraction(structure.buyFirstPct) * structure.saleTotal;
  const buyerFinalAmount =
    pctToFraction(structure.buyFinalPct) * structure.saleTotal;

  const cum1 = supplierAdvanceAmount;
  const cum2 = cum1 + supplierFinalAmount;
  const cum3 = cum2 + buyerFirstAmount;
  const cum4 = cum3 + buyerFinalAmount;

  const peakNegativePosition = Math.min(cum1, cum2, cum3, cum4);
  const exposureDuration = structure.buyFinalDay - structure.supAdvDay;
  const bestCaseMargin = cum4;
  const worstCaseMargin =
    cum3 + buyerFinalAmount * (1 - SEVERITY);
  const upsideDownsideRatio =
    worstCaseMargin >= 0
      ? null
      : bestCaseMargin / Math.abs(worstCaseMargin);

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

function computeSubB(
  structure: ResolvedTransactionStructure,
  cashFlow: CashFlowResult,
): number {
  let ownershipCollectionPts = 0;
  if (structure.tmProductOwnership || structure.collectionRights) {
    ownershipCollectionPts = 100;
    if (structure.tmProductOwnership && structure.collectionRights) {
      ownershipCollectionPts = Math.min(100, ownershipCollectionPts + 10);
    }
  }

  const coverageRatio =
    structure.saleTotal > 0
      ? cashFlow.buyerFirstAmount / structure.saleTotal
      : 0;
  const coverageRatioPts = Math.min(
    100,
    Math.floor(coverageRatio / 0.05) * 5,
  );

  return ownershipCollectionPts * 0.5 + coverageRatioPts * 0.5;
}

export function computeTransactionStructureScore(
  deal: Deal,
): TransactionStructureScore {
  const structure = resolveTransactionStructure(deal);
  const cashFlow = computeCashFlow(structure);

  const paymentTermsPts = bucketLookup(
    cashFlow.exposureDuration,
    PAYMENT_TERMS_BUCKETS,
  );
  const advancePts = clampPct(deal.advancePaymentPct);
  const contractTypePts = CONTRACT_TYPE_POINTS[deal.contractType];
  const dealPurposePts = DEAL_PURPOSE_POINTS[structure.dealPurpose];

  const subA =
    paymentTermsPts * W_PAYMENT_TERMS +
    advancePts * W_ADVANCE +
    contractTypePts * W_CONTRACT +
    dealPurposePts * W_PURPOSE;

  const subB = computeSubB(structure, cashFlow);

  let subD: number;
  if (cashFlow.worstCaseMargin >= 0) {
    subD = 100;
  } else if (cashFlow.upsideDownsideRatio === null) {
    subD = 0;
  } else {
    subD = bucketLookup(cashFlow.upsideDownsideRatio, UPSIDE_DOWNSIDE_BUCKETS);
  }

  const composite = subA * W_A + subB * W_B + subD * W_D;
  const tierEntry =
    STRUCTURE_TIERS.find((entry) => composite >= entry.min) ??
    STRUCTURE_TIERS[STRUCTURE_TIERS.length - 1];

  return {
    subA,
    subB,
    subD,
    composite,
    tier: tierEntry.tier,
    protocol: tierEntry.protocol,
    cashFlow,
    paymentTermsPts,
    advancePts,
    contractTypePts,
    dealPurposePts,
    exposureDuration: cashFlow.exposureDuration,
    complete: structure.complete,
    missingFields: structure.missingFields,
  };
}

export function isStructureFieldUndisclosed(
  deal: Deal,
  field: keyof ReturnType<typeof getDealTransactionStructure>,
): boolean {
  if (field === "tmProductOwnership" || field === "collectionRights") {
    return false;
  }

  if (field === "saleTotalUSD") {
    return false;
  }

  if (field === "purchaseTotalUSD") {
    const existing = getDealTransactionStructure(deal).purchaseTotalUSD;
    if (existing != null) return false;
    const extracted = deal.documentAnalysis?.suggestions?.purchaseTotalUSD;
    return extracted == null || !Number.isFinite(extracted);
  }

  const existing = getDealTransactionStructure(deal);
  if (existing[field] !== null && existing[field] !== undefined) {
    return false;
  }

  const inferred = inferStructureFromDeal(deal);
  return inferred[field] === null || inferred[field] === undefined;
}
