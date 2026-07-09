import type { Deal, RiskTier } from "../types";
import {
  cramCustomsPoints,
  cramRouteFlagPoints,
  cramTransshipmentPoints,
  cramTransitPoints,
} from "./cram-scoring";
import {
  getPerishabilityPoints,
  isEudrRequired,
  lookupProductRisk,
} from "./product-risk-tables";
import {
  lookupRouteRisk,
  normalizeRouteRiskFlag,
  type CorridorRiskFlag,
} from "./route-risk-tables";
import { resolveRouteRiskFlag } from "./product-market-pair-table";
import { DIMENSION_WEIGHTS } from "./scoring-constants";

const CRAM_PRODUCT_BASE = 70;
const CRAM_ROUTE_BASE = 70;

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function yearsInBusinessScore(years: number | null, max: number): number {
  if (years === null) return 15;
  if (years <= 5) return 10;
  if (years <= 10) return 20;
  if (years <= 20) return max === 30 ? 30 : 30;
  return max;
}

function licenseScore(valid: boolean | null): number {
  if (valid === true) return 15;
  if (valid === false) return 0;
  return 8;
}

export function computeBuyerScore(deal: Deal): number {
  const { buyer } = deal;
  const years = yearsInBusinessScore(buyer.yearsInBusiness, 40);
  const license = licenseScore(buyer.licenseValid);
  const completion =
    buyer.platformCompletionRate === null
      ? 15
      : Math.min(25, buyer.platformCompletionRate * 0.25);
  let paymentDelay: number;
  if (
    buyer.avgPaymentDelayDays === null ||
    buyer.avgPaymentDelayDays === undefined
  ) {
    paymentDelay = 15;
  } else if (buyer.avgPaymentDelayDays === 0) {
    paymentDelay = 20;
  } else if (buyer.avgPaymentDelayDays <= 5) {
    paymentDelay = 15;
  } else if (buyer.avgPaymentDelayDays <= 15) {
    paymentDelay = 8;
  } else {
    paymentDelay = 0;
  }
  return clamp(years + license + completion + paymentDelay);
}

export function computeSupplierScore(deal: Deal): number {
  const { supplier } = deal;
  const years = yearsInBusinessScore(supplier.yearsInBusiness, 30);
  const license = licenseScore(supplier.licenseValid);
  const completion =
    supplier.platformCompletionRate === null
      ? 15
      : Math.min(30, supplier.platformCompletionRate * 0.3);
  const rejection = supplier.qualityRejectionRatePct;
  let quality: number;
  if (rejection === null || rejection === undefined) {
    quality = 13;
  } else if (rejection === 0) {
    quality = 25;
  } else if (rejection <= 3) {
    quality = 18;
  } else if (rejection <= 8) {
    quality = 10;
  } else {
    quality = 0;
  }
  return clamp(years + license + completion + quality);
}

function relationshipAdjustment(deal: Deal): number {
  let adj = 0;
  if (deal.priorDealsBetweenParties >= 4) adj += 10;
  else if (deal.priorDealsBetweenParties >= 1) adj += 5;
  if (deal.relationshipAgeMonths > 12) adj += 5;
  return adj;
}

function externalCreditBonus(deal: Deal): number {
  const coface = deal.cofaceCoverage;
  if (coface) {
    const pct = coface.coveragePct ?? 0;
    if (pct >= 80) return 12;
    if (pct >= 50) return 8;
    if (pct > 0) return 5;
    if (coface.coverageAmountUSD !== null && coface.coverageAmountUSD > 0) {
      const ratio =
        deal.dealValueUSD > 0
          ? coface.coverageAmountUSD / deal.dealValueUSD
          : 0;
      if (ratio >= 0.8) return 12;
      if (ratio >= 0.5) return 8;
      return 5;
    }
  }
  return deal.externalCreditSignal || deal.buyer.creditRating ? 8 : 0;
}

export function computeCounterpartyScore(deal: Deal): number {
  const buyer = computeBuyerScore(deal);
  const supplier = computeSupplierScore(deal);
  const relationship = relationshipAdjustment(deal);
  const external = externalCreditBonus(deal);
  return clamp(buyer * 0.6 + supplier * 0.4 + relationship + external);
}

/** CRAM Table 1 — dimension B: perishability + grade */
export function computeProductScore(deal: Deal): number {
  const productEntry = lookupProductRisk(deal.product);
  const perishabilityPts =
    productEntry?.perishabilityPoints ??
    getPerishabilityPoints(deal.product);

  const coldChainAdj =
    deal.coldChainRequired && deal.perishabilityClass !== "Non-Perishable"
      ? -8
      : 0;
  const gradeAdj =
    deal.qualityGrade === "Grade A / Class I"
      ? 8
      : deal.qualityGrade === "Grade B / Class II"
        ? 0
        : -10;

  const eudrAdj =
    isEudrRequired(deal.product) && isEuDestination(deal.destination) ? -12 : 0;

  return clamp(
    CRAM_PRODUCT_BASE + perishabilityPts + coldChainAdj + gradeAdj + eudrAdj,
  );
}

function isEuDestination(destination: string): boolean {
  const d = destination.toLowerCase();
  return (
    d.includes("spain") ||
    d.includes("portugal") ||
    d.includes("netherlands") ||
    d.includes("germany") ||
    d.includes("rotterdam") ||
    d.includes("valencia") ||
    d.includes("lisbon")
  );
}

/** Incoterm risk allocation per MVP product plan */
function incotermAdjustment(incoterm: string): number {
  const map: Record<string, number> = {
    EXW: -5,
    FCA: 0,
    FAS: 0,
    FOB: 5,
    CFR: 3,
    CIF: 8,
    CPT: 3,
    CIP: 8,
    DAP: 10,
    DPU: 10,
    DDP: 10,
  };
  return map[incoterm.toUpperCase()] ?? 0;
}

export function resolveDealCorridorFlag(deal: Deal): CorridorRiskFlag {
  if (deal.routeRiskResolution?.resolvedFlag) {
    return deal.routeRiskResolution.resolvedFlag;
  }

  const routeEntry = lookupRouteRisk(deal.origin, deal.destination);
  const corridorDefault =
    routeEntry?.corridorDefaultRiskFlag ?? "Medium";

  return resolveRouteRiskFlag(
    deal.product,
    deal.destination,
    corridorDefault,
    deal.estimatedTransitDays,
    deal.perishabilityClass,
  ).flag;
}

/** CRAM Tables 2+3 — dimension C: transit, pair override, customs */
export function computeRouteScore(deal: Deal): number {
  const routeEntry = lookupRouteRisk(deal.origin, deal.destination);
  const corridorFlag = resolveDealCorridorFlag(deal);

  const transitAdj = cramTransitPoints(
    deal.perishabilityClass,
    deal.estimatedTransitDays,
  );
  const flagAdj = cramRouteFlagPoints(corridorFlag);
  const transshipAdj = cramTransshipmentPoints(deal.numberOfTransshipments);
  const customsAdj = cramCustomsPoints(
    routeEntry?.customsClearanceDaysMax ?? null,
  );

  return clamp(
    CRAM_ROUTE_BASE +
      transitAdj +
      flagAdj +
      transshipAdj +
      customsAdj +
      incotermAdjustment(deal.incoterm),
  );
}

/**
 * Payment terms adjustment — per MVP plan & banking framework.
 * Extended terms increase default exposure window.
 */
export function paymentTermsAdjustment(paymentTerms: string): number {
  const t = paymentTerms.toLowerCase();
  if (t.includes("cash in advance") || t.includes("prepaid")) return 15;
  if (t.includes("letter of credit") || t.includes(" l/c")) return 12;
  if (t.includes("against") && (t.includes("bl") || t.includes("doc")))
    return 8;
  if (/\b30\s*day/.test(t)) return 5;
  if (/\b90\s*day/.test(t) || t === "90 days") return -12;
  if (/\b120/.test(t)) return -20;
  if (/\b60\s*day/.test(t)) return 0;
  return 0;
}

function structureRelationshipAdjustment(deal: Deal): number {
  if (deal.priorDealsBetweenParties >= 5) return 7;
  if (deal.priorDealsBetweenParties >= 1) return 5;
  return -8;
}

export function computeStructureScore(deal: Deal): number {
  let base: number;
  const adv = deal.advancePaymentPct;
  if (adv === 0) base = 20;
  else if (adv <= 19) base = 35;
  else if (adv <= 39) base = 55;
  else if (adv <= 59) base = 75;
  else base = 90;

  const collateralBonus: Record<string, number> = {
    None: 0,
    "Personal Guarantee": 5,
    "Warehouse Receipt": 10,
    "Inventory Pledge": 10,
    "Bank Guarantee": 15,
    "Letter of Credit": 15,
  };

  const insuranceBonus: Record<string, number> = {
    None: 0,
    Basic: 5,
    Comprehensive: 10,
    "All Risk": 15,
  };

  return clamp(
    base +
      (collateralBonus[deal.collateralType] ?? 0) +
      (insuranceBonus[deal.insuranceCoverage] ?? 0) +
      paymentTermsAdjustment(deal.paymentTerms) +
      structureRelationshipAdjustment(deal),
  );
}

export function getTier(overall: number): RiskTier {
  if (overall >= 75) return "Low Risk";
  if (overall >= 60) return "Medium-Low Risk";
  if (overall >= 45) return "Medium-High Risk";
  return "High Risk";
}

export interface ScoreBreakdown {
  buyer: number;
  supplier: number;
  counterparty: number;
  product: number;
  route: number;
  structure: number;
  overall: number;
  tier: RiskTier;
  externalCreditBonus: number;
  paymentTermsAdj: number;
  corridorFlag: CorridorRiskFlag;
  perishabilityPoints: number;
  transitPoints: number;
}

export function computeOverallScore(deal: Deal): ScoreBreakdown {
  const buyer = Math.round(computeBuyerScore(deal));
  const supplier = Math.round(computeSupplierScore(deal));
  const counterparty = Math.round(computeCounterpartyScore(deal));
  const product = Math.round(computeProductScore(deal));
  const route = Math.round(computeRouteScore(deal));
  const structure = Math.round(computeStructureScore(deal));
  const corridorFlag = resolveDealCorridorFlag(deal);
  const productEntry = lookupProductRisk(deal.product);

  const overall = Math.round(
    counterparty * DIMENSION_WEIGHTS.counterparty +
      product * DIMENSION_WEIGHTS.product +
      route * DIMENSION_WEIGHTS.route +
      structure * DIMENSION_WEIGHTS.structure,
  );

  return {
    buyer,
    supplier,
    counterparty,
    product,
    route,
    structure,
    overall,
    tier: getTier(overall),
    externalCreditBonus: externalCreditBonus(deal),
    paymentTermsAdj: paymentTermsAdjustment(deal.paymentTerms),
    corridorFlag,
    perishabilityPoints:
      productEntry?.perishabilityPoints ??
      getPerishabilityPoints(deal.product),
    transitPoints: cramTransitPoints(
      deal.perishabilityClass,
      deal.estimatedTransitDays,
    ),
  };
}

/** Expose normalized 3-level flag for legacy consumers */
export function getNormalizedRouteRiskFlag(
  deal: Deal,
): "Low" | "Medium" | "High" {
  return normalizeRouteRiskFlag(resolveDealCorridorFlag(deal));
}
