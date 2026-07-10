import type { Deal } from "../types";
import type { ScoreBreakdown } from "./scoring";
import { resolveDealCorridorFlag } from "./scoring";
import { computeTransactionStructureScore } from "./transaction-structure/scoring";
import {
  marketIntelPriceBenchmarkAdj,
  marketIntelSupplierConcentrationConcern,
} from "./market-intel/scoring";
import { resolveSupplierRuc } from "./market-intel/deal-params";

export interface RiskFactorAnalysis {
  concerns: string[];
  mitigating: string[];
}

export function analyzeRiskFactors(
  deal: Deal,
  scores: ScoreBreakdown,
): RiskFactorAnalysis {
  const concerns: string[] = [];
  const mitigating: string[] = [];

  // Counterparty
  if (
    deal.cofaceCoverage &&
    (deal.cofaceCoverage.coveragePct !== null ||
      deal.cofaceCoverage.coverageAmountUSD !== null)
  ) {
    mitigating.push("Coface credit insurance — coverage on file");
  } else if (deal.externalCreditSignal || deal.buyer.creditRating) {
    mitigating.push(
      "Coface credit insurance — buyer limit approved and on file",
    );
  }
  if (
    deal.buyer.platformDealsCompleted === 0 &&
    deal.supplier.platformDealsCompleted === 0
  ) {
    concerns.push("First-time buyer-supplier relationship on platform");
  }
  if (deal.buyer.licenseValid === false || deal.supplier.licenseValid === false) {
    concerns.push("Import/export license flagged as invalid");
  }
  if (scores.buyer < 55) {
    concerns.push("Buyer profile below neutral — limited track record");
  }
  if (deal.buyer.yearsInBusiness !== null && deal.buyer.yearsInBusiness <= 3) {
    concerns.push(
      `Buyer relatively new (${deal.buyer.yearsInBusiness} years in business)`,
    );
  }

  // Product
  if (
    deal.perishabilityClass === "Ultra-Perishable" &&
    deal.shelfLifeDays !== null &&
    deal.shelfLifeDays <= 14
  ) {
    concerns.push(
      `Ultra-perishable product — ${deal.shelfLifeDays}-day shelf life`,
    );
  } else if (deal.perishabilityClass === "Ultra-Perishable") {
    concerns.push("Ultra-perishable product — cold chain critical");
  }
  if (deal.coldChainRequired) {
    concerns.push("Cold chain required — infrastructure dependency");
  }
  if (deal.qualityGrade === "Grade A / Class I") {
    mitigating.push("Grade A / Class I quality — premium marketability");
  }

  // Route — CRAM Tables 2+3
  const corridorFlag = resolveDealCorridorFlag(deal);
  if (corridorFlag === "High" || corridorFlag === "Med-High") {
    concerns.push(
      `Route risk flag ${corridorFlag}${deal.routeRiskResolution?.rationale ? ` — ${deal.routeRiskResolution.rationale}` : ""}`,
    );
  }
  if (
    deal.estimatedTransitDays > 35 &&
    deal.perishabilityClass !== "Non-Perishable"
  ) {
    concerns.push(
      "35-day rule: ocean transit exceeds perishables ceiling",
    );
  }
  if (deal.estimatedTransitDays > 21 && deal.perishabilityClass !== "Non-Perishable") {
    concerns.push(
      `${deal.estimatedTransitDays}-day transit exceeds typical perishable window`,
    );
  }
  if (deal.numberOfTransshipments === 0 && deal.estimatedTransitDays < 10) {
    mitigating.push("Direct short-haul route — no transshipment");
  }
  if (corridorFlag === "Low" || corridorFlag === "Low-Med") {
    mitigating.push("Low geographic/political route risk corridor");
  }
  if (deal.routeRiskResolution?.eudrGate) {
    concerns.push("EUDR due-diligence statement required for EU destination");
  }

  // Structure — CRAM Transaction Structure model
  const structure = computeTransactionStructureScore(deal);
  if (!structure.complete) {
    concerns.push(
      "Transaction structure incomplete — confirm payment schedule and purchase/sale totals",
    );
  } else if (
    structure.tier === "Weak" ||
    structure.tier === "Insufficient"
  ) {
    concerns.push(
      `${structure.tier} transaction structure — ${structure.exposureDuration}d exposure`,
    );
  } else if (structure.tier === "Strong") {
    mitigating.push(
      `Strong transaction structure — ${structure.exposureDuration}d exposure`,
    );
  }
  if (
    structure.complete &&
    structure.cashFlow.worstCaseMargin < 0 &&
    structure.cashFlow.upsideDownsideRatio !== null &&
    structure.cashFlow.upsideDownsideRatio < 0.6
  ) {
    concerns.push(
      "Limited downside protection if buyer final tranche is unpaid",
    );
  }
  if (deal.advancePaymentPct === 0) {
    concerns.push("No buyer advance payment — full exposure at shipment");
  }
  if (deal.incoterm === "FOB") {
    mitigating.push("FOB incoterm — balanced risk transfer at port of loading");
  }

  const concentration = marketIntelSupplierConcentrationConcern(deal);
  if (concentration) {
    concerns.push(`Supplier buyer concentration — ${concentration}`);
  }
  const priceIntel = marketIntelPriceBenchmarkAdj(deal);
  if (priceIntel && priceIntel.pts < 0) {
    concerns.push(`Deal price vs customs market — ${priceIntel.label}`);
  } else if (priceIntel && priceIntel.pts > 0) {
    mitigating.push(`Deal price aligned with customs market — ${priceIntel.label}`);
  }
  if (deal.marketIntel?.dim_a_supplier?.confidence === "HIGH") {
    mitigating.push("Supplier verified in Peru customs data (HIGH confidence)");
  }
  if (
    deal.marketIntel?.dim_a_supplier?.confidence === "NO_HISTORY" &&
    resolveSupplierRuc(deal)
  ) {
    concerns.push("Supplier RUC not found in Peru 2025 customs — no export track record");
  }

  // Relationship
  if (deal.priorDealsBetweenParties >= 1) {
    mitigating.push(
      `${deal.priorDealsBetweenParties} prior deal(s) between parties`,
    );
  }

  return {
    concerns: concerns.slice(0, 5),
    mitigating: mitigating.slice(0, 5),
  };
}
