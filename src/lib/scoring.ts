import type { Deal, RiskTier } from "../types";
import { DIMENSION_WEIGHTS } from "./scoring-constants";
import { lookupRouteRisk } from "./route-risk-tables";
import { priceVsMarketPoints } from "./price-benchmarks";
import {
  buildTransactionStructureReport,
  hasTransactionStructureInput,
} from "./transaction-structure/compute";
import {
  computeBuyerScore,
  computeCounterpartyScore,
  computeSupplierScore,
  explainPartyScore,
  relationshipAdjustment,
  type PartyScoreAudit,
  type PartyScoreLine,
} from "./dimension-a";

export {
  computeBuyerScore,
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
 * Coface coverage note — **not a Counterparty (Dimension A) score input.**
 * Per spec §1, Coface is Gate 1 narrative only (`assessment.ts`).
 */
function externalCreditBonus(deal: Deal): number {
  const coveragePct = deal.cofaceCoveragePct ?? 0;
  if (coveragePct >= 80) return 12;
  if (coveragePct >= 50) return 8;
  if (coveragePct > 0) return 4;
  return deal.externalCreditSignal || deal.buyer.creditRating ? 8 : 0;
}

/**
 * Dimension B (Product) — perishability structural baseline + quality grade +
 * price-vs-usual (month × route).
 *
 * The AC product-risk table still supplies perishability / shelf life / cold
 * chain metadata for the deal and Route vetoes, but its hardcoded 0–100
 * `score` is **not** used as the Dimension B baseline anymore (decision
 * 2026-07-30): live product risk is driven by perishability class + this
 * shipment's grade and unit price vs the usual month×route band.
 */
function productStructuralScore(deal: Deal): number {
  const perishabilityPts: Record<Deal["perishabilityClass"], number> = {
    "Non-Perishable": 18,
    "Semi-Perishable": 9,
    Perishable: -4,
    "Ultra-Perishable": -12,
  };
  return 70 + perishabilityPts[deal.perishabilityClass];
}

function qualityGradePoints(qualityGrade: Deal["qualityGrade"]): number {
  if (qualityGrade === "Grade A / Class I") return 18;
  if (qualityGrade === "Grade B / Class II") return 5;
  return 8; // Industrial
}

export function computeProductScore(deal: Deal): number {
  const structuralScore = productStructuralScore(deal);
  const priceAdj = priceVsMarketPoints(deal);
  const gradeAdj = qualityGradePoints(deal.qualityGrade);
  return clamp(structuralScore + priceAdj + gradeAdj);
}

/** Incoterms — spec §4.C, 20% weight. */
function incotermAdjustment(incoterm: string): number {
  const map: Record<string, number> = {
    EXW: -8,
    FCA: 0,
    FAS: 0,
    FOB: 8,
    CFR: 5,
    CPT: 5,
    CIF: 12,
    CIP: 12,
    DAP: 15,
    DPU: 15,
    DDP: 15,
  };
  return map[incoterm.toUpperCase()] ?? 0;
}

/**
 * Transit time × freight — spec §4.C, 25% weight. Differentiated by freight
 * mode: air, ocean-reefer (perishable/cold-chain cargo), ocean-non-perishable.
 * `deal.transportMode` is null for any deal with no source data — neutral 0
 * in that case (can't tell which curve applies).
 */
function transitTimePoints(deal: Deal): number {
  if (deal.transportMode === "air") {
    if (deal.estimatedTransitDays <= 2) return 18;
    if (deal.estimatedTransitDays <= 5) return 12;
    return -10; // spec only tables ≤2d/2–5d for air; beyond that treated as the risk case
  }
  if (deal.transportMode === "sea") {
    const isReefer = deal.perishabilityClass !== "Non-Perishable";
    if (isReefer) {
      if (deal.estimatedTransitDays <= 14) return 14;
      if (deal.estimatedTransitDays <= 21) return 6;
      return -10;
    }
    if (deal.estimatedTransitDays <= 30) return 12;
    if (deal.estimatedTransitDays > 60) return -8;
    return 0; // 31–60d non-perishable: no explicit spec bucket
  }
  return 0; // transportMode unknown
}

/**
 * Transshipments × freight — spec §4.C, 20% weight. ≥2 air transshipments is
 * also a spec §6 veto (see checkVetoRegister) — that's evaluated separately
 * and independently sinks the deal regardless of this point value.
 */
function transshipmentPoints(deal: Deal): number {
  if (deal.transportMode === "air") {
    if (deal.numberOfTransshipments === 0) return 15;
    if (deal.numberOfTransshipments === 1) return -10;
    return -20;
  }
  // sea, or unknown mode — spec's ocean table is the more conservative default
  if (deal.numberOfTransshipments === 0) return 15;
  if (deal.numberOfTransshipments === 1) return 3;
  return -10;
}

function routeFlagPoints(routeRiskFlag: Deal["routeRiskFlag"]): number {
  if (routeRiskFlag === "Low") return 12;
  if (routeRiskFlag === "Medium") return 3;
  return -15;
}

/**
 * Structural route score (transit time + transshipments + route-risk flag) —
 * spec base 70. Matches the ERD's `Route(T2)` design: a per-corridor
 * pre-computed value (`bestRouteRiskFlag`/`riskOverrideValue`), so when a
 * route-risk-tables.ts row matches, its static `score` is used directly
 * instead of recomputing this — same reasoning as the Product dimension.
 */
function routeFallbackStructuralScore(deal: Deal): number {
  return 70 + transitTimePoints(deal) + transshipmentPoints(deal) + routeFlagPoints(deal.routeRiskFlag);
}

// spec §4.C "Customs clearance time" (5%wt, ≤3d +5 / >7d −8) has no data source —
// `customsNarrative` is unparsed free text, not a structured clearance-time number.
// Not implemented; stays out of computeRouteScore entirely rather than guessed at.

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
  const structuralScore = tableMatch ? tableMatch.score : routeFallbackStructuralScore(deal);

  // Incoterms (20%wt) is genuinely per-deal, not baked into either the
  // static table score or the fallback.
  const incotermAdj = incotermAdjustment(deal.incoterm);
  // Cold-chain requirement (15%wt): spec's flat rule (required+documented −5)
  // only applies in the fallback path. When a route-risk-tables.ts row
  // matches, its adjustedScore already bakes in a route+product-specific
  // cold-chain penalty (decision 2026-07-28 — see route-risk-tables.ts) —
  // applying the flat −5 on top would double-count the same risk factor.
  // Air ≥3-stop penalty is likewise baked into the matched row's score.
  const coldChainAdj = tableMatch ? 0 : deal.coldChainRequired ? -5 : 0;

  return clamp(structuralScore + incotermAdj + coldChainAdj);
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
 * Distinct from Dimension A's relationship fields inside the weighted/shrink
 * composite (see computeCounterpartyScore / scoreRelationship).
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
  if (deal.transportMode === "air" && deal.numberOfTransshipments >= 2) {
    reasons.push(`≥2 transshipments by air (${deal.numberOfTransshipments})`);
  }
  // Decision 2026-07-28: route-risk-tables.ts rows carry a per-(route,product)
  // vetoCandidate flag when estimated transit time meaningfully exceeds this
  // product's shelf life — a shipment that's structurally likely to arrive
  // spoiled, independent of the composite score.
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
  /** Spec §4.A relationship add-on inside Dimension A (not a separate dimension). */
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
    relationshipAdj,
    paymentTermsAdj: paymentTermsAdjustment(deal.paymentTerms),
    structureReport,
  };
}
