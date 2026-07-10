import type { Deal, RiskAssessment } from "../types";
import { DIMENSION_WEIGHTS } from "./scoring-constants";
import { computeOverallScore, type ScoreBreakdown } from "./scoring";
import { analyzeRiskFactors } from "./risk-factors";
import { computeTransactionStructureScore } from "./transaction-structure/scoring";

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
  if (deal.cofaceCoverage) {
    const { coveragePct, coverageAmountUSD } = deal.cofaceCoverage;
    if (coveragePct !== null || coverageAmountUSD !== null) {
      const parts: string[] = ["Coface coverage on file"];
      if (coveragePct !== null) parts.push(`${coveragePct}% of deal`);
      if (coverageAmountUSD !== null)
        parts.push(`USD ${coverageAmountUSD.toLocaleString()} limit`);
      return parts.join(" — ");
    }
  }
  if (externalBonus > 0) {
    return "Coface-backed buyer, EUR 40,000 approved limit";
  }
  if (
    deal.buyer.platformDealsCompleted === 0 &&
    deal.supplier.platformDealsCompleted === 0
  ) {
    return "Both parties new to platform, no track record";
  }
  return "Established counterparty profile on platform";
}

function productWhy(deal: Deal): string {
  const perish = deal.perishabilityClass.toLowerCase();
  const grade = deal.qualityGrade.split("/")[0].trim();
  const shelf =
    deal.shelfLifeDays !== null ? `, ${deal.shelfLifeDays}-day shelf life` : "";
  return `${perish}${shelf}, ${grade}`;
}

function routeWhy(deal: Deal, scores: ScoreBreakdown): string {
  const transship =
    deal.numberOfTransshipments === 0
      ? "no transshipment"
      : deal.numberOfTransshipments === 1
        ? "one transshipment"
        : `${deal.numberOfTransshipments} transshipments`;
  const flagLabel = scores.corridorFlag;
  const source = deal.routeRiskResolution?.source;
  const sourceNote =
    source === "pair-override"
      ? " (product×market override)"
      : source === "35-day-rule"
        ? " (35-day rule)"
        : "";
  return `${deal.estimatedTransitDays}-day transit, ${transship}, ${flagLabel} corridor${sourceNote}`;
}

function structureWhy(deal: Deal): string {
  const result = computeTransactionStructureScore(deal);
  if (!result.complete) {
    return `Confirm payment schedule and purchase/sale totals (${result.missingFields.length} field(s) missing)`;
  }
  const ratioNote =
    result.cashFlow.upsideDownsideRatio !== null
      ? `upside:downside ${result.cashFlow.upsideDownsideRatio.toFixed(2)}`
      : "no loss even if buyer final tranche is unpaid";
  return `${result.tier} structure — ${result.exposureDuration}d exposure, ${ratioNote}`;
}

export function buildRiskAssessment(deal: Deal): RiskAssessment {
  const scores = computeOverallScore(deal);
  const factors = analyzeRiskFactors(deal, scores);

  if (import.meta.env.DEV) {
    console.group(`[score] ${deal.dealRef}`);
    console.log("overallRaw:", scores.overallRaw.toFixed(2), "→ display:", scores.overall);
    console.log("tier:", scores.tier);
    for (const key of ["counterparty", "product", "route", "structure"] as const) {
      const dim = scores[key];
      console.log(
        `${key}: raw=${dim.raw.toFixed(1)} clamped=${dim.value} headroom=${dim.headroom.toFixed(1)}`,
      );
      console.table(dim.factors);
    }
    console.groupEnd();
  }

  return {
    counterparty: {
      label: "Counterparty",
      score: scores.counterparty.value,
      weight: DIMENSION_WEIGHTS.counterparty,
      why: counterpartyWhy(deal, scores.externalCreditBonus),
      headroom: scores.counterparty.headroom,
      breakdown: scores.counterparty,
    },
    product: {
      label: "Product",
      score: scores.product.value,
      weight: DIMENSION_WEIGHTS.product,
      why: productWhy(deal),
      headroom: scores.product.headroom,
      breakdown: scores.product,
    },
    route: {
      label: "Trade Route",
      score: scores.route.value,
      weight: DIMENSION_WEIGHTS.route,
      why: routeWhy(deal, scores),
      headroom: scores.route.headroom,
      breakdown: scores.route,
    },
    structure: {
      label: "Deal Structure",
      score: scores.structure.value,
      weight: DIMENSION_WEIGHTS.structure,
      why: structureWhy(deal),
      headroom: scores.structure.headroom,
      breakdown: scores.structure,
    },
    buyer: {
      label: "Buyer",
      score: scores.buyer,
      why: "",
      headroom: scores.buyerDetail.headroom,
      breakdown: scores.buyerDetail,
    },
    supplier: {
      label: "Supplier",
      score: scores.supplier,
      why: "",
      headroom: scores.supplierDetail.headroom,
      breakdown: scores.supplierDetail,
    },
    overall: scores.overall,
    overallRaw: scores.overallRaw,
    tier: scores.tier,
    concerns: factors.concerns,
    mitigating: factors.mitigating,
  };
}
