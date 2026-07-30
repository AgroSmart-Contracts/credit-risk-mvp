import type { Deal, RiskAssessment } from "../types";
import { DIMENSION_WEIGHTS } from "./scoring-constants";
import { computeOverallScore, type ScoreBreakdown } from "./scoring";
import { analyzeRiskFactors } from "./risk-factors";
import { lookupProductRisk } from "./product-risk-tables";
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
  const parts: string[] = [];
  if (deal.cofaceCoverageAmountUSD && deal.cofaceCoverageAmountUSD > 0) {
    const pct =
      deal.cofaceCoveragePct != null ? `${deal.cofaceCoveragePct}%` : "partial";
    parts.push(
      `Coface Gate 1: ${pct} cover, ${formatUSD(deal.cofaceCoverageAmountUSD)} protected (coverage is not a Dimension A point input)`,
    );
  } else if (externalBonus > 0) {
    parts.push("External credit support on file (Gate 1 narrative)");
  } else if (
    deal.buyer.platformDealsCompleted === 0 &&
    deal.supplier.platformDealsCompleted === 0
  ) {
    parts.push("Both parties new to platform, no track record");
  } else if (deal.buyer.licenseValid === null) {
    parts.push("First deal on platform, license not confirmed");
  } else {
    parts.push("Established counterparty profile on platform");
  }
  return parts.join(" · ");
}

function productWhy(deal: Deal): string {
  const tableMatch = deal.productRiskProfile ?? lookupProductRisk(deal.product);
  const price = priceVsMarketDetail(deal);
  const perish = (tableMatch?.perishabilityClass ?? deal.perishabilityClass).toLowerCase();
  const grade = deal.qualityGrade.split("/")[0].trim();
  const shelfDays = tableMatch?.shelfLifeDays ?? deal.shelfLifeDays;
  const shelf = shelfDays !== null ? `, ${shelfDays}-day shelf life` : "";

  const priceBit =
    price.fallback === "none" || price.usualUsdPerKg == null
      ? "price-vs-usual: no month×route benchmark"
      : `price-vs-usual ${price.deflatedPctOverUsual != null && price.deflatedPctOverUsual > 0 ? "+" : ""}${price.deflatedPctOverUsual}% (${price.dealUnitPriceUSD?.toFixed(2)} vs usual ${price.usualUsdPerKg.toFixed(2)} ${price.priceUnit}, ${price.match?.matchLevel ?? price.fallback}, ${price.pts >= 0 ? "+" : ""}${price.pts} pts)`;

  return `${perish}${shelf}, ${grade}. ${priceBit}.`;
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
        ? tableMatch.airStopsBand === "gt2"
          ? "air ≥3 stops"
          : "air ≤2 stops"
        : "ocean";
    return `Table score ${tableMatch.score} (${mode}) for ${tableMatch.origin} → ${tableMatch.destination}${provisional} — ${tableMatch.rationale}`;
  }

  const transship =
    deal.numberOfTransshipments === 0
      ? "no transshipment"
      : deal.numberOfTransshipments === 1
        ? "one transshipment"
        : `${deal.numberOfTransshipments} transshipments`;
  const modeLabel =
    deal.transportMode === "air" ? "air" : deal.transportMode === "sea" ? "sea" : "unknown mode";
  return `${deal.estimatedTransitDays}-day transit (${modeLabel}), ${transship}`;
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
    productPrice: priceVsMarketDetail(deal),
    overall: scores.overall,
    tier: scores.tier,
    vetoed: scores.vetoed,
    vetoReasons: scores.vetoReasons,
    concerns: factors.concerns,
    mitigating: factors.mitigating,
    structureReport: scores.structureReport,
  };
}
