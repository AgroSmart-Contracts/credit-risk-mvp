import type { Deal } from "../types";
import type { ScoreBreakdown } from "./scoring";

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
    (deal.cofaceCoveragePct ?? 0) > 0 ||
    deal.externalCreditSignal ||
    deal.buyer.creditRating
  ) {
    const coverageLabel =
      deal.cofaceCoveragePct != null ? ` (${deal.cofaceCoveragePct}% covered)` : "";
    mitigating.push(
      `Coface credit insurance — buyer limit approved and on file${coverageLabel}`,
    );
  }
  if (
    deal.buyer.platformDealsCompleted === 0 &&
    deal.supplier.platformDealsCompleted === 0
  ) {
    concerns.push("First-time buyer-supplier relationship on platform");
  }
  if (deal.buyer.licenseValid === null || deal.supplier.licenseValid === null) {
    concerns.push("Import/export license validity not yet confirmed");
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

  // Route
  if (deal.estimatedTransitDays > 21 && deal.perishabilityClass !== "Non-Perishable") {
    concerns.push(
      `${deal.estimatedTransitDays}-day transit exceeds typical perishable window`,
    );
  }
  if (deal.numberOfTransshipments === 0 && deal.estimatedTransitDays < 10) {
    mitigating.push("Direct short-haul route — no transshipment");
  }
  if (deal.routeRiskFlag === "Low") {
    mitigating.push("Low geographic/political route risk corridor");
  }

  // Structure
  if (deal.advancePaymentPct === 0) {
    concerns.push("No buyer advance payment — full exposure at shipment");
  }
  if (deal.collateralType === "None" && deal.collateralValueUSD === 0) {
    concerns.push("No collateral posted — unsecured structure");
  }
  if (deal.insuranceCoverage === "None") {
    concerns.push("No cargo/credit insurance evidenced in documentation");
  }
  if (scores.paymentTermsAdj < 0) {
    concerns.push(`Extended payment terms (${deal.paymentTerms})`);
  } else if (
    deal.paymentTerms.toLowerCase().includes("against") &&
    scores.paymentTermsAdj > 0
  ) {
    mitigating.push("Documentary payment terms — partial settlement security");
  }
  if (deal.incoterm === "FOB") {
    mitigating.push("FOB incoterm — balanced risk transfer at port of loading");
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
