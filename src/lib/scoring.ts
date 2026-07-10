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
import { computeTransactionStructureScore } from "./transaction-structure/scoring";
import {
  marketIntelBuyerBreakdown,
  marketIntelPriceBenchmarkAdj,
  marketIntelRelationshipPts,
  marketIntelRoutePts,
  marketIntelSupplierBreakdown,
} from "./market-intel/scoring";

const CRAM_PRODUCT_BASE = 70;
const CRAM_ROUTE_BASE = 70;

export interface ScoreFactor {
  label: string;
  input: string;
  points: number;
  weightedContribution: number;
}

export interface DimensionBreakdown {
  value: number;
  raw: number;
  headroom: number;
  factors: ScoreFactor[];
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function factor(
  label: string,
  input: string,
  points: number,
  overallWeight: number,
): ScoreFactor {
  return {
    label,
    input,
    points,
    weightedContribution: points * overallWeight,
  };
}

function buildDimensionBreakdown(
  raw: number,
  factors: ScoreFactor[],
): DimensionBreakdown {
  return {
    value: Math.round(clamp(raw)),
    raw,
    headroom: Math.max(0, 100 - raw),
    factors,
  };
}

function formatYearsInput(years: number | null): string {
  if (years === null) return "Not disclosed";
  return `${years} year${years === 1 ? "" : "s"}`;
}

function formatLicenseInput(valid: boolean | null): string {
  if (valid === false) return "Invalid";
  if (valid === true) return "Valid";
  return "Valid (default)";
}

function yearsInBusinessScore(years: number | null, max: number): number {
  if (years === null) return 12;
  if (years <= 5) return 10;
  if (years <= 10) return 20;
  if (years <= 20) return 30;
  return max;
}

function licenseScore(valid: boolean | null): number {
  if (valid === false) return 0;
  return 15;
}

function buyerCompletionScore(rate: number | null): number {
  if (rate === null) return 3;
  return Math.min(25, rate * 0.25);
}

function supplierCompletionScore(rate: number | null): number {
  if (rate === null) return 4;
  return Math.min(30, rate * 0.3);
}

function buyerPaymentDelayScore(days: number | null | undefined): number {
  if (days === null || days === undefined) return 4;
  if (days === 0) return 20;
  if (days <= 5) return 15;
  if (days <= 15) return 8;
  return 0;
}

function supplierQualityScore(rejection: number | null | undefined): number {
  if (rejection === null || rejection === undefined) return 5;
  if (rejection === 0) return 25;
  if (rejection <= 3) return 18;
  if (rejection <= 8) return 10;
  return 0;
}

function formatCompletionInput(rate: number | null): string {
  if (rate === null) return "Not disclosed";
  return `${rate}%`;
}

function formatPaymentDelayInput(days: number | null | undefined): string {
  if (days === null || days === undefined) return "Not disclosed";
  if (days === 0) return "0 days (on time)";
  return `${days} days avg delay`;
}

function formatRejectionInput(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return "Not disclosed";
  return `${rate}%`;
}

function computeBuyerScoreDetail(deal: Deal): DimensionBreakdown {
  const { buyer } = deal;
  const intel = marketIntelBuyerBreakdown(deal);

  const years = intel?.yearsPts ?? yearsInBusinessScore(buyer.yearsInBusiness, 40);
  const license = intel?.licensePts ?? licenseScore(buyer.licenseValid);
  const completion =
    intel?.activityPts ?? buyerCompletionScore(buyer.platformCompletionRate);
  const paymentDelay =
    intel?.paymentPts ?? buyerPaymentDelayScore(buyer.avgPaymentDelayDays);
  const raw = years + license + completion + paymentDelay;
  const weight = DIMENSION_WEIGHTS.counterparty * 0.6;

  return buildDimensionBreakdown(raw, [
    factor(
      "Years in business",
      intel?.yearsLabel ?? formatYearsInput(buyer.yearsInBusiness),
      years,
      weight,
    ),
    factor(
      "Import/export license",
      intel?.licenseLabel ?? formatLicenseInput(buyer.licenseValid),
      license,
      weight,
    ),
    factor(
      "Platform completion rate",
      intel?.activityLabel ?? formatCompletionInput(buyer.platformCompletionRate),
      completion,
      weight,
    ),
    factor(
      "Avg payment delay",
      intel?.paymentLabel ?? formatPaymentDelayInput(buyer.avgPaymentDelayDays),
      paymentDelay,
      weight,
    ),
  ]);
}

function computeSupplierScoreDetail(deal: Deal): DimensionBreakdown {
  const { supplier } = deal;
  const intel = marketIntelSupplierBreakdown(deal);

  const years =
    intel?.yearsPts ?? yearsInBusinessScore(supplier.yearsInBusiness, 30);
  const license = intel?.licensePts ?? licenseScore(supplier.licenseValid);
  const completion =
    intel?.activityPts ?? supplierCompletionScore(supplier.platformCompletionRate);
  const quality =
    intel?.capacityPts ?? supplierQualityScore(supplier.qualityRejectionRatePct);
  const raw = years + license + completion + quality;
  const weight = DIMENSION_WEIGHTS.counterparty * 0.4;

  return buildDimensionBreakdown(raw, [
    factor(
      "Years in business",
      intel?.yearsLabel ?? formatYearsInput(supplier.yearsInBusiness),
      years,
      weight,
    ),
    factor(
      "Export license",
      intel?.licenseLabel ?? formatLicenseInput(supplier.licenseValid),
      license,
      weight,
    ),
    factor(
      intel ? "Customs activity" : "Platform completion rate",
      intel?.activityLabel ?? formatCompletionInput(supplier.platformCompletionRate),
      completion,
      weight,
    ),
    factor(
      intel ? "Capacity vs deal size" : "Quality rejection rate",
      intel?.capacityLabel ?? formatRejectionInput(supplier.qualityRejectionRatePct),
      quality,
      weight,
    ),
  ]);
}

function relationshipAdjustment(deal: Deal): number {
  const intelRel = marketIntelRelationshipPts(deal);
  if (intelRel) return intelRel.pts;

  let adj = 0;
  if (deal.priorDealsBetweenParties >= 4) adj += 10;
  else if (deal.priorDealsBetweenParties >= 1) adj += 5;
  if (deal.relationshipAgeMonths > 12) adj += 5;
  return adj;
}

function relationshipInput(deal: Deal): string {
  const intelRel = marketIntelRelationshipPts(deal);
  if (intelRel) return intelRel.label;

  const parts: string[] = [];
  if (deal.priorDealsBetweenParties >= 4) {
    parts.push(`${deal.priorDealsBetweenParties} prior deals`);
  } else if (deal.priorDealsBetweenParties >= 1) {
    parts.push(`${deal.priorDealsBetweenParties} prior deal(s)`);
  } else {
    parts.push("No prior deals");
  }
  if (deal.relationshipAgeMonths > 12) {
    parts.push(`${deal.relationshipAgeMonths} months relationship`);
  }
  return parts.join(" · ");
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

function externalCreditInput(deal: Deal): string {
  const coface = deal.cofaceCoverage;
  if (coface?.coveragePct !== null && coface?.coveragePct !== undefined) {
    return `Coface ${coface.coveragePct}% coverage`;
  }
  if (coface?.coverageAmountUSD) {
    return `Coface USD ${coface.coverageAmountUSD.toLocaleString()} limit`;
  }
  if (deal.externalCreditSignal || deal.buyer.creditRating) {
    return "External credit signal on file";
  }
  return "None";
}

function computeCounterpartyScoreDetail(deal: Deal): DimensionBreakdown {
  const buyerDetail = computeBuyerScoreDetail(deal);
  const supplierDetail = computeSupplierScoreDetail(deal);
  const relationship = relationshipAdjustment(deal);
  const external = externalCreditBonus(deal);
  const raw =
    buyerDetail.raw * 0.6 + supplierDetail.raw * 0.4 + relationship + external;
  const weight = DIMENSION_WEIGHTS.counterparty;

  const factors: ScoreFactor[] = [
    ...buyerDetail.factors.map((f) => ({
      ...f,
      label: `Buyer — ${f.label}`,
      points: f.points * 0.6,
      weightedContribution: f.points * 0.6 * weight,
    })),
    ...supplierDetail.factors.map((f) => ({
      ...f,
      label: `Supplier — ${f.label}`,
      points: f.points * 0.4,
      weightedContribution: f.points * 0.4 * weight,
    })),
    factor("Relationship history", relationshipInput(deal), relationship, weight),
    factor(
      "External credit (Coface)",
      externalCreditInput(deal),
      external,
      weight,
    ),
  ];

  return buildDimensionBreakdown(raw, factors);
}

export function computeBuyerScore(deal: Deal): number {
  return computeBuyerScoreDetail(deal).value;
}

export function computeSupplierScore(deal: Deal): number {
  return computeSupplierScoreDetail(deal).value;
}

export function computeCounterpartyScore(deal: Deal): number {
  return computeCounterpartyScoreDetail(deal).value;
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

function computeProductScoreDetail(deal: Deal): DimensionBreakdown {
  const productEntry = lookupProductRisk(deal.product);
  const perishabilityPts =
    productEntry?.perishabilityPoints ?? getPerishabilityPoints(deal.product);
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
  const raw =
    CRAM_PRODUCT_BASE + perishabilityPts + coldChainAdj + gradeAdj + eudrAdj;
  const weight = DIMENSION_WEIGHTS.product;

  return buildDimensionBreakdown(raw, [
    factor("CRAM base", "70 (neutral product anchor)", CRAM_PRODUCT_BASE, weight),
    factor(
      "Perishability class",
      productEntry?.perishabilityClass ?? deal.perishabilityClass,
      perishabilityPts,
      weight,
    ),
    factor(
      "Cold chain",
      deal.coldChainRequired ? "Required" : "Not required",
      coldChainAdj,
      weight,
    ),
    factor("Quality grade", deal.qualityGrade, gradeAdj, weight),
    factor(
      "EUDR compliance",
      isEudrRequired(deal.product) && isEuDestination(deal.destination)
        ? "EU destination — EUDR applies"
        : "Not applicable",
      eudrAdj,
      weight,
    ),
  ]);
}

export function computeProductScore(deal: Deal): number {
  return computeProductScoreDetail(deal).value;
}

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
  const corridorDefault = routeEntry?.corridorDefaultRiskFlag ?? "Medium";

  return resolveRouteRiskFlag(
    deal.product,
    deal.destination,
    corridorDefault,
    deal.estimatedTransitDays,
    deal.perishabilityClass,
  ).flag;
}

function computeRouteScoreDetail(deal: Deal): DimensionBreakdown {
  const routeEntry = lookupRouteRisk(deal.origin, deal.destination);
  const corridorFlag = resolveDealCorridorFlag(deal);
  const transitAdj = cramTransitPoints(
    deal.perishabilityClass,
    deal.estimatedTransitDays,
  );
  const flagAdj = cramRouteFlagPoints(corridorFlag);
  const intelRoute = marketIntelRoutePts(deal);
  const intelRouteAdj = intelRoute?.pts ?? 0;
  const transshipAdj = cramTransshipmentPoints(deal.numberOfTransshipments);
  const customsClearance = routeEntry?.customsClearanceDaysMax ?? null;
  const customsAdj = cramCustomsPoints(customsClearance);
  const incotermAdj = incotermAdjustment(deal.incoterm);
  const raw =
    CRAM_ROUTE_BASE +
    transitAdj +
    flagAdj +
    intelRouteAdj +
    transshipAdj +
    customsAdj +
    incotermAdj;
  const weight = DIMENSION_WEIGHTS.route;

  const factors = [
    factor("CRAM base", "70 (neutral route anchor)", CRAM_ROUTE_BASE, weight),
    factor(
      "Transit vs shelf life",
      `${deal.estimatedTransitDays} days (${deal.perishabilityClass})`,
      transitAdj,
      weight,
    ),
    factor("Corridor risk flag", corridorFlag, flagAdj, weight),
  ];

  if (intelRoute) {
    factors.push(
      factor(
        "Customs route intel",
        intelRoute.label,
        intelRouteAdj,
        weight,
      ),
    );
  }

  factors.push(
    factor(
      "Transshipments",
      String(deal.numberOfTransshipments),
      transshipAdj,
      weight,
    ),
    factor(
      "Customs clearance",
      customsClearance === null
        ? "Not disclosed"
        : `≤${customsClearance} days`,
      customsAdj,
      weight,
    ),
    factor("Incoterm", deal.incoterm || "Not set", incotermAdj, weight),
  );

  return buildDimensionBreakdown(raw, factors);
}

export function computeRouteScore(deal: Deal): number {
  return computeRouteScoreDetail(deal).value;
}

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

function computeStructureScoreDetail(deal: Deal): DimensionBreakdown {
  const result = computeTransactionStructureScore(deal);
  const weight = DIMENSION_WEIGHTS.structure;

  if (!result.complete) {
    return buildDimensionBreakdown(50, [
      factor(
        "Transaction structure",
        `Incomplete — confirm ${result.missingFields.length} field(s): ${result.missingFields.join(", ")}`,
        50,
        weight,
      ),
    ]);
  }

  const subAContribution = result.subA * 0.5;
  const subDContribution = result.subD * 0.5;
  const priceIntel = marketIntelPriceBenchmarkAdj(deal);
  const priceAdj = priceIntel?.pts ?? 0;
  const raw = Math.max(0, Math.min(100, result.composite + priceAdj));
  const ratioLabel =
    result.cashFlow.upsideDownsideRatio !== null
      ? `ratio ${result.cashFlow.upsideDownsideRatio.toFixed(2)}`
      : "no downside at 100% non-payment";

  const factors = [
    factor(
      "Sub-A · Payment exposure",
      `${result.exposureDuration}d exposure, advance ${result.advancePts}%, ${deal.contractType}`,
      subAContribution,
      weight,
    ),
    factor(
      "Sub-D · Downside resilience",
      ratioLabel,
      subDContribution,
      weight,
    ),
  ];

  if (priceIntel) {
    factors.push(
      factor("Price vs market (customs)", priceIntel.label, priceAdj, weight),
    );
  }

  factors.push(
    factor(
      "Structure tier",
      `${result.tier} — ${result.protocol}`,
      0,
      weight,
    ),
  );

  return buildDimensionBreakdown(raw, factors);
}

export function computeStructureScore(deal: Deal): number {
  return computeStructureScoreDetail(deal).value;
}

export function getTier(overallRaw: number): RiskTier {
  if (overallRaw >= 75) return "Low Risk";
  if (overallRaw >= 60) return "Medium-Low Risk";
  if (overallRaw >= 45) return "Medium-High Risk";
  return "High Risk";
}

export interface ScoreBreakdown {
  buyer: number;
  supplier: number;
  buyerDetail: DimensionBreakdown;
  supplierDetail: DimensionBreakdown;
  counterparty: DimensionBreakdown;
  product: DimensionBreakdown;
  route: DimensionBreakdown;
  structure: DimensionBreakdown;
  overall: number;
  overallRaw: number;
  tier: RiskTier;
  externalCreditBonus: number;
  paymentTermsAdj: number;
  corridorFlag: CorridorRiskFlag;
  perishabilityPoints: number;
  transitPoints: number;
}

export function computeOverallScore(deal: Deal): ScoreBreakdown {
  const buyerDetail = computeBuyerScoreDetail(deal);
  const supplierDetail = computeSupplierScoreDetail(deal);
  const counterparty = computeCounterpartyScoreDetail(deal);
  const product = computeProductScoreDetail(deal);
  const route = computeRouteScoreDetail(deal);
  const structure = computeStructureScoreDetail(deal);
  const corridorFlag = resolveDealCorridorFlag(deal);
  const productEntry = lookupProductRisk(deal.product);

  const overallRaw =
    counterparty.raw * DIMENSION_WEIGHTS.counterparty +
    product.raw * DIMENSION_WEIGHTS.product +
    route.raw * DIMENSION_WEIGHTS.route +
    structure.raw * DIMENSION_WEIGHTS.structure;

  return {
    buyer: buyerDetail.value,
    supplier: supplierDetail.value,
    buyerDetail,
    supplierDetail,
    counterparty,
    product,
    route,
    structure,
    overall: Math.round(overallRaw),
    overallRaw,
    tier: getTier(overallRaw),
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

export function getNormalizedRouteRiskFlag(
  deal: Deal,
): "Low" | "Medium" | "High" {
  return normalizeRouteRiskFlag(resolveDealCorridorFlag(deal));
}

if (import.meta.env?.DEV) {
  (globalThis as { __printScoreBreakdown?: (deal: Deal) => void }).__printScoreBreakdown =
    (deal: Deal) => {
      console.log(JSON.stringify(computeOverallScore(deal), null, 2));
    };
}
