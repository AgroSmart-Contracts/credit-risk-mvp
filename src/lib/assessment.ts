import type { Deal, RiskAssessment } from "../types";
import { DIMENSION_WEIGHTS } from "./scoring-constants";
import { computeOverallScore, type ScoreBreakdown } from "./scoring";
import { analyzeRiskFactors } from "./risk-factors";
import { lookupRouteRisk } from "./route-risk-tables";
import { priceVsMarketDetail } from "./price-benchmarks";

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
    return `Coface Gate 1: ${pct} cover, ${formatUSD(deal.cofaceCoverageAmountUSD)} protected (coverage is not a Dimension A point input)`;
  }
  if (externalBonus > 0) {
    return "External credit support on file (Gate 1 narrative)";
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
  return "Weighted/shrink counterparty profile (Dimension A)";
}

function productWhy(deal: Deal): string {
  const price = priceVsMarketDetail(deal);
  if (price.fallback === "none" || price.usualUsdPerKg == null) {
    return `Unit price vs usual: no month×route benchmark — base 70 (neutral). Deal unit ${
      price.dealUnitPriceUSD != null ? `$${price.dealUnitPriceUSD.toFixed(2)}/kg` : "unknown"
    }.`;
  }
  const pct =
    price.deflatedPctOverUsual != null && price.deflatedPctOverUsual > 0
      ? `+${price.deflatedPctOverUsual}`
      : `${price.deflatedPctOverUsual}`;
  return `Unit price vs usual ${pct}% ($${price.dealUnitPriceUSD?.toFixed(2)}/kg vs usual $${price.usualUsdPerKg.toFixed(2)}/kg, ${price.match?.matchLevel ?? price.fallback}, ${price.pts >= 0 ? "+" : ""}${price.pts} pts) → base 70 ${price.pts >= 0 ? "+" : ""}${price.pts}.`;
}

function routeWhy(deal: Deal): string {
  const tableMatch =
    deal.routeRiskProfile ??
    lookupRouteRisk(
      deal.origin,
      deal.destination,
      deal.product,
      deal.transportMode,
      deal.numberOfTransshipments,
    );
  if (tableMatch) {
    const provisional = tableMatch.scoreConfirmed ? "" : " (provisional, not AC-confirmed)";
    const mode =
      tableMatch.transportMode === "air"
        ? `air ${tableMatch.airStops ?? 0} stops`
        : "ocean";
    if (tableMatch.vetoCandidate) {
      return `Dimension C veto (${mode}) for ${tableMatch.origin} → ${tableMatch.destination} — ${tableMatch.rationale}`;
    }
    return `Table score ${tableMatch.score} (${mode}) for ${tableMatch.origin} → ${tableMatch.destination}${provisional} — ${tableMatch.rationale}`;
  }

  return `No Dimension C table row for ${deal.origin} → ${deal.destination} / ${deal.product} (${deal.transportMode ?? "unknown mode"}, ${deal.numberOfTransshipments} stops) — using base 70`;
}

function structureWhy(
  deal: Deal,
  paymentAdj: number,
  structureReport: ScoreBreakdown["structureReport"],
): string {
  if (structureReport) {
    const { tier, composite, cashFlow } = structureReport.score;
    const downside =
      cashFlow.worstCaseMargin >= 0
        ? "no downside on total non-payment"
        : `upside:downside ${cashFlow.upsideDownsideRatio?.toFixed(2) ?? "n/a"}`;
    const sourceNote =
      deal.transactionStructure?.structureSource === "default"
        ? "Structure from exploration defaults — "
        : deal.transactionStructure?.structureSource === "user"
          ? "User-confirmed structure — "
          : "";
    return `${sourceNote}${tier} (${composite}/100) — ${cashFlow.exposureDuration}-day exposure, ${downside}`;
  }
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
      why: structureWhy(deal, scores.paymentTermsAdj, scores.structureReport),
    },
    buyer: { label: "Buyer", score: scores.buyer, why: "" },
    supplier: { label: "Supplier", score: scores.supplier, why: "" },
    relationshipAdj: scores.relationshipAdj,
    counterpartyCoveragePct: scores.counterpartyCoveragePct,
    overall: scores.overall,
    tier: scores.tier,
    vetoed: scores.vetoed,
    vetoReasons: scores.vetoReasons,
    concerns: factors.concerns,
    mitigating: factors.mitigating,
    structureReport: scores.structureReport,
  };
}
