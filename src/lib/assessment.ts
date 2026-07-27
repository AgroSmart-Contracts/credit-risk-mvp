import type { Deal, RiskAssessment } from "../types";
import { DIMENSION_WEIGHTS } from "./scoring-constants";
import { computeOverallScore } from "./scoring";
import { analyzeRiskFactors } from "./risk-factors";
import { lookupProductRisk } from "./product-risk-tables";
import { lookupRouteRisk } from "./route-risk-tables";

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatUSDDetailed(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function counterpartyWhy(deal: Deal, externalBonus: number): string {
  if (deal.cofaceCoverageAmountUSD && deal.cofaceCoverageAmountUSD > 0) {
    const pct =
      deal.cofaceCoveragePct != null ? `${deal.cofaceCoveragePct}%` : "partial";
    return `Coface-backed buyer, ${pct} cover, ${formatUSD(deal.cofaceCoverageAmountUSD)} protected`;
  }
  if (externalBonus > 0) {
    return "External credit support on file";
  }
  if (
    deal.buyer.platformDealsCompleted === 0 &&
    deal.supplier.platformDealsCompleted === 0
  ) {
    return "Both parties new to platform, no track record";
  }
  if (deal.buyer.licenseValid === null) {
    return "First deal on platform, license not confirmed";
  }
  return "Established counterparty profile on platform";
}

function productWhy(deal: Deal): string {
  const tableMatch = deal.productRiskProfile ?? lookupProductRisk(deal.product);
  if (tableMatch) {
    const provisional = tableMatch.scoreConfirmed ? "" : " (provisional, not AC-confirmed)";
    return `Table score ${tableMatch.score} for ${tableMatch.product}${provisional} — ${tableMatch.rationale}`;
  }

  const perish = deal.perishabilityClass.toLowerCase();
  const grade = deal.qualityGrade.split("/")[0].trim();
  const shelf =
    deal.shelfLifeDays !== null ? `, ${deal.shelfLifeDays}-day shelf life` : "";
  return `${perish}${shelf}, ${grade}`;
}

function routeWhy(deal: Deal): string {
  const tableMatch =
    deal.routeRiskProfile ?? lookupRouteRisk(deal.origin, deal.destination);
  if (tableMatch) {
    const provisional = tableMatch.scoreConfirmed ? "" : " (provisional, not AC-confirmed)";
    return `Table score ${tableMatch.score} for ${tableMatch.origin} → ${tableMatch.destination}${provisional} — ${tableMatch.rationale}`;
  }

  const transship =
    deal.numberOfTransshipments === 0
      ? "no transshipment"
      : deal.numberOfTransshipments === 1
        ? "one transshipment"
        : `${deal.numberOfTransshipments} transshipments`;
  return `${deal.estimatedTransitDays}-day transit, ${transship}`;
}

function structureWhy(deal: Deal, paymentAdj: number): string {
  if (paymentAdj < 0) {
    return `${deal.paymentTerms} — no advance or collateral`;
  }
  if (deal.advancePaymentPct > 0) {
    return `${deal.advancePaymentPct}% advance, ${deal.collateralType.toLowerCase()}`;
  }
  if (
    deal.paymentTerms.toLowerCase().includes("against") &&
    deal.insuranceCoverage === "None"
  ) {
    return "Documentary terms, no insurance on file";
  }
  if (deal.insuranceCoverage === "None" && deal.collateralType === "None") {
    return "No advance payment, no collateral yet";
  }
  return "Standard spot structure, limited mitigants";
}

export function buildRiskAssessment(deal: Deal): RiskAssessment {
  const scores = computeOverallScore(deal);
  const factors = analyzeRiskFactors(deal, scores);

  return {
    counterparty: {
      label: "Counterparty",
      score: scores.counterparty,
      weight: DIMENSION_WEIGHTS.counterparty,
      why: counterpartyWhy(deal, scores.externalCreditBonus),
    },
    product: {
      label: "Product",
      score: scores.product,
      weight: DIMENSION_WEIGHTS.product,
      why: productWhy(deal),
    },
    route: {
      label: "Trade Route",
      score: scores.route,
      weight: DIMENSION_WEIGHTS.route,
      why: routeWhy(deal),
    },
    structure: {
      label: "Deal Structure",
      score: scores.structure,
      weight: DIMENSION_WEIGHTS.structure,
      why: structureWhy(deal, scores.paymentTermsAdj),
    },
    buyer: { label: "Buyer", score: scores.buyer, why: "" },
    supplier: { label: "Supplier", score: scores.supplier, why: "" },
    overall: scores.overall,
    tier: scores.tier,
    vetoed: scores.vetoed,
    vetoReasons: scores.vetoReasons,
    concerns: factors.concerns,
    mitigating: factors.mitigating,
  };
}
