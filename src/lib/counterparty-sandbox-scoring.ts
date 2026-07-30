/**
 * Counterparty risk sandbox scorer — weighted average + coverage shrink toward 50.
 * Spec: Desktop counterparty-risk-scoring-method-outline-2026-07-30.md
 *
 * Separate from live CRAM Dimension A (`computeBuyerScore` / `computeSupplierScore`
 * in scoring.ts). Blank/null fields are excluded from both numerator and
 * filled-weight; unfilled weight still counts toward coverage (possible weight).
 */

export const SANDBOX_TRUST_BONUS_DEFAULT = 3;
export const SANDBOX_NEUTRAL = 50;

export type FilledNumber = number | null | undefined;

export interface WeightedField {
  id: string;
  label: string;
  weight: number;
  /** null/undefined = blank → excluded from raw average & filled weight */
  score: FilledNumber;
}

export interface GroupScoreResult {
  rawAverage: number | null;
  filledWeight: number;
  possibleWeight: number;
  coverageFraction: number;
  shrunkScore: number;
  trustBonus: number;
  score: number;
  fields: WeightedField[];
}

export interface SandboxBuyerInputs {
  yearsInBusiness?: FilledNumber;
  onlineVerifiability?: FilledNumber; // 90 | 55 | 15
  importLicenseStatus?: FilledNumber; // 100 | 0
  importLicenseTm?: FilledNumber; // 100 | 0; omit when N/A
  monthlyPurchaseVolumeUsd?: FilledNumber;
  yearlySalesUsd?: FilledNumber;
  annualImportVolumeMt?: FilledNumber;
  routeDiversity?: FilledNumber; // route count
  creditRating?: FilledNumber; // mapped 0–100
  platformTransactionCount?: FilledNumber;
  paymentDelayDays?: FilledNumber;
  /** true → +trustBonus (default 3); false/undefined → +0 */
  tmPlatformTrust?: boolean;
  trustBonusAmount?: number;
}

export interface SandboxSupplierInputs {
  yearsInBusiness?: FilledNumber;
  onlineVerifiability?: FilledNumber;
  exportLicenseStatus?: FilledNumber;
  productionCapacityMt?: FilledNumber;
  yearlySalesUsd?: FilledNumber;
  annualExportVolumeMt?: FilledNumber;
  routeDiversity?: FilledNumber;
  qualityCertifications?: FilledNumber; // 28 | 60 | 90
  platformTransactionCount?: FilledNumber;
  onTimeDeliveryRate?: FilledNumber; // 0–100 pass-through
  qualityRejectionRate?: FilledNumber; // 0–100, scored as MAX(15, 100 − rate)
  tmPlatformTrust?: boolean;
  trustBonusAmount?: number;
}

export interface SandboxRelationshipInputs {
  priorDealsBetweenParties?: FilledNumber;
  relationshipAgeMonths?: FilledNumber;
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, n));
}

function isFilled(score: FilledNumber): score is number {
  return score !== null && score !== undefined && Number.isFinite(score);
}

/** Years in business → MIN(100, years × 10) */
export function scoreYearsInBusiness(years: FilledNumber): FilledNumber {
  if (!isFilled(years)) return null;
  return Math.min(100, years * 10);
}

/** Online verifiability tiers */
export function scoreOnlineVerifiability(
  tier: "verified" | "less_authoritative" | "not_found" | null | undefined,
): FilledNumber {
  if (tier === "verified") return 90;
  if (tier === "less_authoritative") return 55;
  if (tier === "not_found") return 15;
  return null;
}

export function scoreLicenseValid(valid: boolean | null | undefined): FilledNumber {
  if (valid === true) return 100;
  if (valid === false) return 0;
  return null;
}

/** Monthly purchase volume USD bands */
export function scoreMonthlyPurchaseVolumeUsd(usd: FilledNumber): FilledNumber {
  if (!isFilled(usd)) return null;
  if (usd < 10_000) return 25;
  if (usd < 50_000) return 40;
  if (usd < 200_000) return 60;
  if (usd < 1_000_000) return 80;
  return 90;
}

/** Yearly sales USD bands (buyer & supplier) */
export function scoreYearlySalesUsd(usd: FilledNumber): FilledNumber {
  if (!isFilled(usd)) return null;
  if (usd < 500_000) return 25;
  if (usd < 2_000_000) return 40;
  if (usd < 10_000_000) return 60;
  if (usd < 50_000_000) return 80;
  return 90;
}

/** Annual volume / production capacity MT bands */
export function scoreVolumeMt(mt: FilledNumber): FilledNumber {
  if (!isFilled(mt)) return null;
  if (mt < 100) return 25;
  if (mt < 500) return 40;
  if (mt < 2_000) return 60;
  if (mt < 10_000) return 80;
  return 90;
}

/** Route diversity by distinct route count */
export function scoreRouteDiversity(routes: FilledNumber): FilledNumber {
  if (!isFilled(routes)) return null;
  const n = Math.floor(routes);
  if (n <= 0) return 35;
  if (n === 1) return 35;
  if (n === 2) return 40;
  if (n === 3) return 55;
  if (n === 4) return 70;
  if (n === 5) return 80;
  if (n <= 7) return 90;
  return 95;
}

/** Credit rating letter → score */
export function scoreCreditRating(
  grade: string | null | undefined,
): FilledNumber {
  if (grade === null || grade === undefined || grade === "") return null;
  const g = grade.toUpperCase().replace(/\s+/g, "");
  if (g === "AAA" || g === "AA" || g.startsWith("AA")) return 90;
  if (g === "A" || g.startsWith("A")) return 85;
  if (g.startsWith("BBB")) return 70;
  if (g.startsWith("BB")) return 55;
  if (g === "B" || g.startsWith("B")) return 40;
  if (g.startsWith("CCC") || g.startsWith("CC") || g === "C" || g === "D") return 28;
  return null;
}

export function scorePlatformTransactionCount(count: FilledNumber): FilledNumber {
  if (!isFilled(count)) return null;
  return Math.min(100, count * 10);
}

export function scorePaymentDelayDays(days: FilledNumber): FilledNumber {
  if (!isFilled(days)) return null;
  return Math.max(15, 100 - days * 2);
}

export function scoreQualityCertifications(
  tier: "none" | "some" | "multiple" | null | undefined,
): FilledNumber {
  if (tier === "none") return 28;
  if (tier === "some") return 60;
  if (tier === "multiple") return 90;
  return null;
}

export function scoreOnTimeDeliveryRate(rate: FilledNumber): FilledNumber {
  if (!isFilled(rate)) return null;
  return clamp(rate);
}

export function scoreQualityRejectionRate(rate: FilledNumber): FilledNumber {
  if (!isFilled(rate)) return null;
  return Math.max(15, 100 - rate);
}

export function scorePriorDeals(count: FilledNumber): FilledNumber {
  if (!isFilled(count)) return null;
  return Math.min(100, count * 20);
}

export function scoreRelationshipAgeMonths(months: FilledNumber): FilledNumber {
  if (!isFilled(months)) return null;
  return Math.min(100, (months * 100) / 24);
}

/**
 * Group raw average → coverage → shrink toward 50 → optional flat trust bonus.
 */
export function scoreWeightedGroup(
  fields: WeightedField[],
  trustBonus = 0,
): GroupScoreResult {
  const possibleWeight = fields.reduce((s, f) => s + f.weight, 0);
  let filledWeight = 0;
  let weightedSum = 0;
  for (const f of fields) {
    if (!isFilled(f.score)) continue;
    filledWeight += f.weight;
    weightedSum += f.score * f.weight;
  }
  const rawAverage = filledWeight > 0 ? weightedSum / filledWeight : null;
  const coverageFraction = possibleWeight > 0 ? filledWeight / possibleWeight : 0;
  const shrunkScore =
    rawAverage === null
      ? SANDBOX_NEUTRAL
      : coverageFraction * rawAverage + (1 - coverageFraction) * SANDBOX_NEUTRAL;
  const bonus = Math.max(0, trustBonus);
  const score = clamp(shrunkScore + bonus);
  return {
    rawAverage,
    filledWeight,
    possibleWeight,
    coverageFraction,
    shrunkScore,
    trustBonus: bonus,
    score,
    fields,
  };
}

export function buildBuyerFields(input: SandboxBuyerInputs): WeightedField[] {
  return [
    {
      id: "yearsInBusiness",
      label: "Years in business",
      weight: 7,
      score: scoreYearsInBusiness(input.yearsInBusiness),
    },
    {
      id: "onlineVerifiability",
      label: "Online verifiability",
      weight: 2,
      score: input.onlineVerifiability ?? null,
    },
    {
      id: "importLicenseStatus",
      label: "Import license status",
      weight: 2,
      score: input.importLicenseStatus ?? null,
    },
    // Import license — TM only when TM is the importing buyer (weight 1); omit field when N/A
    ...(isFilled(input.importLicenseTm)
      ? [
          {
            id: "importLicenseTm",
            label: "Import license — TM",
            weight: 1,
            score: input.importLicenseTm,
          } satisfies WeightedField,
        ]
      : []),
    {
      id: "monthlyPurchaseVolume",
      label: "Monthly purchase volume",
      weight: 4,
      score: scoreMonthlyPurchaseVolumeUsd(input.monthlyPurchaseVolumeUsd),
    },
    {
      id: "yearlySales",
      label: "Yearly sales",
      weight: 4,
      score: scoreYearlySalesUsd(input.yearlySalesUsd),
    },
    {
      id: "annualImportVolume",
      label: "Annual import volume",
      weight: 4,
      score: scoreVolumeMt(input.annualImportVolumeMt),
    },
    {
      id: "routeDiversity",
      label: "Route diversity",
      weight: 2,
      score: scoreRouteDiversity(input.routeDiversity),
    },
    {
      id: "creditRating",
      label: "Credit rating",
      weight: 7,
      score: input.creditRating ?? null,
    },
    {
      id: "platformTransactionHistory",
      label: "Platform transaction history",
      weight: 4,
      score: scorePlatformTransactionCount(input.platformTransactionCount),
    },
    {
      id: "paymentDelay",
      label: "Payment delay",
      weight: 4,
      score: scorePaymentDelayDays(input.paymentDelayDays),
    },
  ];
}

export function buildSupplierFields(input: SandboxSupplierInputs): WeightedField[] {
  return [
    {
      id: "yearsInBusiness",
      label: "Years in business",
      weight: 7,
      score: scoreYearsInBusiness(input.yearsInBusiness),
    },
    {
      id: "onlineVerifiability",
      label: "Online verifiability",
      weight: 2,
      score: input.onlineVerifiability ?? null,
    },
    {
      id: "exportLicenseStatus",
      label: "Export license status",
      weight: 2,
      score: input.exportLicenseStatus ?? null,
    },
    {
      id: "productionCapacity",
      label: "Production capacity",
      weight: 4,
      score: scoreVolumeMt(input.productionCapacityMt),
    },
    {
      id: "yearlySales",
      label: "Yearly sales",
      weight: 4,
      score: scoreYearlySalesUsd(input.yearlySalesUsd),
    },
    {
      id: "annualExportVolume",
      label: "Annual export volume",
      weight: 4,
      score: scoreVolumeMt(input.annualExportVolumeMt),
    },
    {
      id: "routeDiversity",
      label: "Route diversity",
      weight: 2,
      score: scoreRouteDiversity(input.routeDiversity),
    },
    {
      id: "qualityCertifications",
      label: "Quality certifications",
      weight: 2,
      score: input.qualityCertifications ?? null,
    },
    {
      id: "platformTransactionHistory",
      label: "Platform transaction history",
      weight: 4,
      score: scorePlatformTransactionCount(input.platformTransactionCount),
    },
    {
      id: "onTimeDeliveryRate",
      label: "On-time delivery rate",
      weight: 7,
      score: scoreOnTimeDeliveryRate(input.onTimeDeliveryRate),
    },
    {
      id: "qualityRejectionRate",
      label: "Quality rejection rate",
      weight: 4,
      score: scoreQualityRejectionRate(input.qualityRejectionRate),
    },
  ];
}

export function buildRelationshipFields(
  input: SandboxRelationshipInputs,
): WeightedField[] {
  return [
    {
      id: "priorDeals",
      label: "Prior deals between parties",
      weight: 6,
      score: scorePriorDeals(input.priorDealsBetweenParties),
    },
    {
      id: "relationshipAge",
      label: "Relationship age (months)",
      weight: 4,
      score: scoreRelationshipAgeMonths(input.relationshipAgeMonths),
    },
  ];
}

export function scoreBuyer(input: SandboxBuyerInputs): GroupScoreResult {
  const bonus =
    input.tmPlatformTrust === true
      ? (input.trustBonusAmount ?? SANDBOX_TRUST_BONUS_DEFAULT)
      : 0;
  return scoreWeightedGroup(buildBuyerFields(input), bonus);
}

export function scoreSupplier(input: SandboxSupplierInputs): GroupScoreResult {
  const bonus =
    input.tmPlatformTrust === true
      ? (input.trustBonusAmount ?? SANDBOX_TRUST_BONUS_DEFAULT)
      : 0;
  return scoreWeightedGroup(buildSupplierFields(input), bonus);
}

export function scoreRelationship(
  input: SandboxRelationshipInputs,
): GroupScoreResult {
  return scoreWeightedGroup(buildRelationshipFields(input), 0);
}

/**
 * Composite across all Buyer + Supplier + Relationship fields, then both
 * trust bonuses added flat on top.
 */
export function scoreComposite(args: {
  buyer: SandboxBuyerInputs;
  supplier: SandboxSupplierInputs;
  relationship: SandboxRelationshipInputs;
}): GroupScoreResult {
  const buyerFields = buildBuyerFields(args.buyer);
  const supplierFields = buildSupplierFields(args.supplier);
  const relationshipFields = buildRelationshipFields(args.relationship);
  const all = [...buyerFields, ...supplierFields, ...relationshipFields];
  const buyerBonus =
    args.buyer.tmPlatformTrust === true
      ? (args.buyer.trustBonusAmount ?? SANDBOX_TRUST_BONUS_DEFAULT)
      : 0;
  const supplierBonus =
    args.supplier.tmPlatformTrust === true
      ? (args.supplier.trustBonusAmount ?? SANDBOX_TRUST_BONUS_DEFAULT)
      : 0;
  return scoreWeightedGroup(all, buyerBonus + supplierBonus);
}
