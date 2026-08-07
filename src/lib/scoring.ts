import type { Deal, RiskTier } from "../types";
import { DIMENSION_WEIGHTS } from "./scoring-constants";
import { lookupRouteRisk, MAX_AIR_STOPS } from "./route-risk-tables";
import { priceVsMarketPoints } from "./price-benchmarks";
import {
  buildTransactionStructureReport,
  hasTransactionStructureInput,
} from "./transaction-structure/compute";
import {
  computeBuyerScore,
  computeCounterpartyCoveragePct,
  computeCounterpartyScore,
  computeSupplierScore,
  explainPartyScore,
  relationshipAdjustment,
  type PartyScoreAudit,
  type PartyScoreLine,
} from "./dimension-a";

export {
  computeBuyerScore,
  computeCounterpartyCoveragePct,
  computeCounterpartyScore,
  computeSupplierScore,
  explainPartyScore,
  relationshipAdjustment,
};
export type { PartyScoreAudit, PartyScoreLine };

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Coface coverage note — Gate 1 narrative only (`assessment.ts`).
 * Not a Dimension A score input.
 */
function externalCreditBonus(deal: Deal): number {
  const coveragePct = deal.cofaceCoveragePct ?? 0;
  if (coveragePct >= 80) return 12;
  if (coveragePct >= 50) return 8;
  if (coveragePct > 0) return 4;
  return deal.externalCreditSignal || deal.buyer.creditRating ? 8 : 0;
}

/**
 * Dimension B (Product) — driven by unit price vs usual for the same
 * product × origin→destination × shipment month (price-benchmarks.ts).
 *
 * Spec §4.B called price-vs-market the highest-signal fraud variable. The old
 * PRODUCT_RISK_TABLE `.score` was a baked AC structural shortcut; it is no
 * longer added into the deal score. That table is kept only for product
 * attributes (perishability, shelf life, cold chain) used when hydrating deals.
 *
 * Score = base 70 + price-vs-usual band points (−35 … +20). No grade / table overlay.
 */
export function computeProductScore(deal: Deal): number {
  return clamp(70 + priceVsMarketPoints(deal));
}

/**
 * Dimension C v2 owns the route score (transit / stops / corridor flag / perish /
 * cold-treatment). TS never recomputes the formula and does not layer Incoterms
 * on top — Incoterms are deal commercial terms, not corridor risk.
 * On a table miss return base 70 only (HANDOFF: engine never guesses).
 */
export function computeRouteScore(deal: Deal): number {
  const tableMatch =
    deal.routeRiskProfile ??
    lookupRouteRisk(
      deal.origin,
      deal.destination,
      deal.product,
      deal.transportMode,
      deal.numberOfTransshipments,
    );
  // Veto rows carry score 0 in the rendered table; composite still runs but
  // checkVetoRegister hard-stops the deal.
  return clamp(tableMatch ? tableMatch.score : 70);
}

/**
 * Payment terms — spec §4.D, 25% weight. Cash-in-advance +25 / LC +20 /
 * CAD (cash against documents / BL) +15 / 30d +10 / 60d 0 / 90d −10 / 120d+ −18.
 * Previously ran at roughly half these magnitudes and had no ≥120d bucket
 * distinct from 90d — resynced 2026-07-24.
 */
export function paymentTermsAdjustment(paymentTerms: string): number {
  const t = paymentTerms.toLowerCase();
  if (t.includes("cash in advance") || t.includes("prepaid")) return 25;
  if (t.includes("letter of credit") || t.includes(" l/c")) return 20;
  if (t.includes("against") && (t.includes("bl") || t.includes("doc")))
    return 15;
  if (/\b30\s*day/.test(t)) return 10;
  if (/\b120/.test(t)) return -18;
  if (/\b90\s*day/.test(t) || t === "90 days") return -10;
  if (/\b60\s*day/.test(t)) return 0;
  return 0;
}

/**
 * Relationship history — spec §4.D, 25% weight: ≥10 +15 / ≥5 +12 / ≥1 +8 / 0 −12.
 * Distinct from Dimension A's cross-applied relationship signal (different
 * point values, spec explicitly calls for both — see computeCounterpartyScore).
 * Previously missing the ≥10 tier entirely and used unrelated point values.
 */
function structureRelationshipAdjustment(deal: Deal): number {
  if (deal.priorDealsBetweenParties >= 10) return 15;
  if (deal.priorDealsBetweenParties >= 5) return 12;
  if (deal.priorDealsBetweenParties >= 1) return 8;
  return -12;
}

/** Advance payment % — spec §4.D, 10% weight: ≥50% +10 / ≥25% +7 / ≥10% +5. */
function advancePaymentPoints(advancePaymentPct: number): number {
  if (advancePaymentPct >= 50) return 10;
  if (advancePaymentPct >= 25) return 7;
  if (advancePaymentPct >= 10) return 5;
  return 0;
}

/**
 * Collateral structure — spec §4.D, 35% weight: LC +25 / Bank Guarantee +20 /
 * Warehouse Receipt +15 / Inventory Pledge +10 / Personal Guarantee +5 /
 * None −5, +5 more if collateral value fully covers the deal value.
 */
function collateralPoints(deal: Deal): number {
  const base: Record<Deal["collateralType"], number> = {
    "Letter of Credit": 25,
    "Bank Guarantee": 20,
    "Warehouse Receipt": 15,
    "Inventory Pledge": 10,
    "Personal Guarantee": 5,
    None: -5,
  };
  let pts = base[deal.collateralType];
  if (
    deal.collateralType !== "None" &&
    deal.dealValueUSD > 0 &&
    deal.collateralValueUSD >= deal.dealValueUSD
  ) {
    pts += 5;
  }
  return pts;
}

/**
 * Insurance — spec §4.D, 5% weight, **mandatory floor**: All-Risk +5 /
 * Comprehensive +3 / Basic +1 / None → does not execute (veto, see
 * checkVetoRegister — not a negative point value here, spec treats it as a
 * hard stop rather than a penalty).
 */
function insurancePoints(insuranceCoverage: Deal["insuranceCoverage"]): number {
  if (insuranceCoverage === "All Risk") return 5;
  if (insuranceCoverage === "Comprehensive") return 3;
  if (insuranceCoverage === "Basic") return 1;
  return 0;
}

/**
 * Dimension D (Transaction Structure) — replaced 2026-07-28 with the Kanato
 * CRAM Transaction Structure model (docs/transaction-structure-model-reference.md),
 * extended with the deal-sensitivity-playbook.md's legs/cost-stack/insurance
 * overlay (src/lib/transaction-structure/compute.ts) — a real cash-flow
 * engine (peak negative position, upside:downside ratio, tiers) instead of
 * the flat category-lookup formula below. Falls back to that flat formula
 * when the deal has no transaction-structure input at all (e.g. every
 * platform-CSV-sourced deal today — that data was never captured for the
 * bulk deal book, only for hand-modeled deals), same "matched vs fallback"
 * convention used throughout scoring.ts for Product/Route.
 */
export function computeStructureScore(deal: Deal): number {
  if (hasTransactionStructureInput(deal.transactionStructure)) {
    const report = buildTransactionStructureReport(
      deal.transactionStructure,
      deal.dealValueUSD,
      deal.advancePaymentPct,
      deal.contractType,
    );
    return report.score.composite;
  }
  return clamp(
    60 +
      collateralPoints(deal) +
      paymentTermsAdjustment(deal.paymentTerms) +
      structureRelationshipAdjustment(deal) +
      advancePaymentPoints(deal.advancePaymentPct) +
      insurancePoints(deal.insuranceCoverage),
  );
}

export function getTier(overall: number): RiskTier {
  if (overall >= 75) return "Low Risk";
  if (overall >= 60) return "Medium-Low Risk";
  if (overall >= 45) return "Medium-High Risk";
  return "High Risk";
}

/**
 * Single-veto register — spec §6, evaluated first, hard stops regardless of
 * composite score. Not implemented before 2026-07-24 (mentioned only in code
 * comments) — `getTier` could never actually return a veto outcome.
 *
 * Two of the spec's four conditions have no data source and are not checked:
 * "Ultra-perishable + cold-chain execution deficient" needs a per-shipment
 * "protocol documented vs incomplete" signal that doesn't exist anywhere in
 * the CSV/document pipeline (same gap noted on the Route dimension's own
 * cold-chain variable). Fabricating a check would be worse than omitting it.
 */
export interface VetoResult {
  vetoed: boolean;
  reasons: string[];
}

export function checkVetoRegister(deal: Deal): VetoResult {
  const reasons: string[] = [];
  if (deal.buyer.licenseValid === false) {
    reasons.push("Buyer import license invalid");
  }
  if (deal.supplier.licenseValid === false) {
    reasons.push("Supplier export license invalid");
  }
  if (deal.insuranceCoverage === "None") {
    reasons.push("No cargo insurance on file (mandatory baseline)");
  }
  // AC ruling 2026-07-30: air ≥4 stops is a hard veto (supersedes legacy ≥2).
  if (deal.transportMode === "air" && deal.numberOfTransshipments > MAX_AIR_STOPS) {
    reasons.push(
      `≥${MAX_AIR_STOPS + 1} air stops (${deal.numberOfTransshipments}) — Dimension C veto`,
    );
  }
  // Dimension C v2 rows set vetoCandidate for engine vetoes (air ≥4, etc.).
  const routeMatch =
    deal.routeRiskProfile ??
    lookupRouteRisk(
      deal.origin,
      deal.destination,
      deal.product,
      deal.transportMode,
      deal.numberOfTransshipments,
    );
  if (routeMatch?.vetoCandidate) {
    reasons.push(
      `Estimated transit time exceeds ${deal.product}'s shelf life on this corridor (${deal.origin} → ${deal.destination})`,
    );
  }
  return { vetoed: reasons.length > 0, reasons };
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
  vetoed: boolean;
  vetoReasons: string[];
  externalCreditBonus: number;
  /**
   * Composite counterparty data completeness, 0–100. Separate from
   * `counterparty` (the score itself) so a thin-data deal and a
   * well-documented deal that happen to land on the same score can still be
   * told apart downstream (see financing.ts's uncertaintyPremium).
   */
  counterpartyCoveragePct: number;
  /** Dimension A relationship group score (0–100). */
  relationshipAdj: number;
  paymentTermsAdj: number;
  /** Populated only when deal.transactionStructure has real input — see computeStructureScore. */
  structureReport: ReturnType<typeof buildTransactionStructureReport> | null;
}

export function computeOverallScore(deal: Deal): ScoreBreakdown {
  const buyer = Math.round(computeBuyerScore(deal));
  const supplier = Math.round(computeSupplierScore(deal));
  const relationshipAdj = relationshipAdjustment(deal);
  const counterparty = Math.round(computeCounterpartyScore(deal));
  const counterpartyCoveragePct = computeCounterpartyCoveragePct(deal);
  const product = Math.round(computeProductScore(deal));
  const route = Math.round(computeRouteScore(deal));
  const structureReport = hasTransactionStructureInput(deal.transactionStructure)
    ? buildTransactionStructureReport(deal.transactionStructure, deal.dealValueUSD, deal.advancePaymentPct, deal.contractType)
    : null;
  const structure = Math.round(structureReport ? structureReport.score.composite : computeStructureScore(deal));

  const overall = Math.round(
    counterparty * DIMENSION_WEIGHTS.counterparty +
      product * DIMENSION_WEIGHTS.product +
      route * DIMENSION_WEIGHTS.route +
      structure * DIMENSION_WEIGHTS.structure,
  );

  const veto = checkVetoRegister(deal);

  return {
    buyer,
    supplier,
    counterparty,
    product,
    route,
    structure,
    overall,
    tier: veto.vetoed ? "Veto" : getTier(overall),
    vetoed: veto.vetoed,
    vetoReasons: veto.reasons,
    externalCreditBonus: externalCreditBonus(deal),
    counterpartyCoveragePct,
    relationshipAdj,
    paymentTermsAdj: paymentTermsAdjustment(deal.paymentTerms),
    structureReport,
  };
}
