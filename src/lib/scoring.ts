import type { Deal, RiskTier } from "../types";
import type { CofaceRiskGrade } from "./coface-analysis/types";
import { DIMENSION_WEIGHTS } from "./scoring-constants";
import { lookupProductRisk } from "./product-risk-tables";
import { lookupRouteRisk } from "./route-risk-tables";
import { priceVsMarketPoints } from "./price-benchmarks";

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Dimension A (Counterparty) — synced to tm-cram-engine-spec-2026-06.md §4.A.
 * Each sub-score = base 50 + variable point deltas, clamped 0–100.
 *
 * Buyer credit rating is sourced from Coface's own CRA/DRA grades
 * (`deal.cofaceCompanyRiskGrade` / `deal.cofaceCountryRiskGrade`, extracted
 * from an uploaded Coface limit notification by
 * `lib/coface-analysis/analyze-coface-client.ts` in the Assess Deal wizard —
 * see `creditRatingPoints()` below) — decision 2026-07-24, fixing a gap
 * where these fields existed on `Deal` and were populated by the document
 * pipeline but never read by this file. They're null (neutral, 0 pts) for
 * every platform CSV deal today since none of the 84 real deals in the
 * source dataset have a Coface document on file — the field is live and
 * ready the moment one is uploaded/analyzed for any deal.
 *
 * Three of the ten spec variables (buyer capacity, supplier quality
 * certifications, supplier capacity) still have **no data source at all**
 * anywhere in the current TruMarket CSV exports or document pipeline — per
 * decision 2026-07-24, these keep their spec weight but score at a
 * **neutral midpoint (0 pts, neither bonus nor penalty)** until a real
 * source exists, rather than being dropped/redistributed. `NEEDS_DATA_*`
 * markers below are what to wire up once that data lands.
 */

const NEEDS_DATA_BUYER_CAPACITY_POINTS = 0; // spec: ≤50% of monthly vol +5 / >2× −10
const NEEDS_DATA_SUPPLIER_CAPACITY_POINTS = 0; // spec: ≤30% of production +5 / >100% −15
const NEEDS_DATA_QUALITY_CERT_POINTS = 0; // spec: multiple certs +15 / at least one +10

/**
 * Maps Coface's own CRA/DRA letter grades onto the spec's credit-rating
 * point bucket (AAA–AA +15 / A–BBB +10 / BB–B +5 / ≤CCC −15). Coface's scale
 * isn't literally S&P notches, so this is a best-effort bucket mapping, not
 * a verified equivalence table — flag to AC if a different mapping is
 * preferred. Company grade (debtor-specific) is preferred over country
 * grade (macro) when both are present, since it's the more specific signal.
 */
const COFACE_GRADE_POINTS: Record<CofaceRiskGrade, number> = {
  A1: 15,
  A2: 15,
  A3: 10,
  A4: 10,
  B: 5,
  C: -15,
  D: -15,
};

function creditRatingPoints(deal: Deal): number {
  const grade = deal.cofaceCompanyRiskGrade ?? deal.cofaceCountryRiskGrade ?? null;
  if (!grade) return 0; // neutral — no Coface document analyzed for this deal
  return COFACE_GRADE_POINTS[grade] ?? 0;
}

function yearsInBusinessPointsBuyer(years: number | null): number {
  if (years === null) return 0; // neutral — no data
  if (years >= 10) return 15;
  if (years >= 5) return 10;
  if (years >= 2) return 5;
  return -5;
}

function yearsInBusinessPointsSupplier(years: number | null): number {
  if (years === null) return 0; // neutral — no data
  if (years >= 10) return 15;
  if (years >= 5) return 10;
  if (years >= 2) return 0;
  return -10;
}

/** Buyer: import license validity. Invalid is veto-grade (handled by the veto register, not here). */
function licensePointsBuyer(valid: boolean | null): number {
  if (valid === true) return 10;
  if (valid === false) return -20;
  return 0; // neutral — unconfirmed
}

/** Supplier: export license validity. Invalid is veto-grade (handled by the veto register, not here). */
function licensePointsSupplier(valid: boolean | null): number {
  if (valid === true) return 15;
  if (valid === false) return -25;
  return 0; // neutral — unconfirmed
}

function platformDealsCompletionPointsBuyer(
  dealsCompleted: number,
  completionRate: number | null,
): number {
  let dealsPts = 0;
  if (dealsCompleted >= 10) dealsPts = 20;
  else if (dealsCompleted >= 5) dealsPts = 10;
  else if (dealsCompleted >= 1) dealsPts = 5;

  let completionPts = 0; // neutral when unknown
  if (completionRate !== null) {
    if (completionRate >= 95) completionPts = 15;
    else if (completionRate >= 80) completionPts = 10;
    else if (completionRate >= 60) completionPts = 5;
    else completionPts = -10;
  }
  return dealsPts + completionPts;
}

function platformDealsOnTimePointsSupplier(
  dealsCompleted: number,
  onTimeRate: number | null,
): number {
  let dealsPts = 0;
  if (dealsCompleted >= 10) dealsPts = 20;
  else if (dealsCompleted >= 5) dealsPts = 10;
  else if (dealsCompleted >= 1) dealsPts = 5;

  let onTimePts = 0; // neutral when unknown
  if (onTimeRate !== null) {
    if (onTimeRate >= 90) onTimePts = 15;
    else if (onTimeRate >= 75) onTimePts = 10;
    else if (onTimeRate < 50) onTimePts = -15;
  }
  return dealsPts + onTimePts;
}

export function computeBuyerScore(deal: Deal): number {
  const { buyer } = deal;
  const yearsPts = yearsInBusinessPointsBuyer(buyer.yearsInBusiness);
  const licensePts = licensePointsBuyer(buyer.licenseValid);
  const dealsPts = platformDealsCompletionPointsBuyer(
    buyer.platformDealsCompleted,
    buyer.platformCompletionRate,
  );
  return clamp(
    50 +
      dealsPts +
      yearsPts +
      creditRatingPoints(deal) +
      licensePts +
      NEEDS_DATA_BUYER_CAPACITY_POINTS,
  );
}

export function computeSupplierScore(deal: Deal): number {
  const { supplier } = deal;
  const yearsPts = yearsInBusinessPointsSupplier(supplier.yearsInBusiness);
  const licensePts = licensePointsSupplier(supplier.licenseValid);
  const dealsPts = platformDealsOnTimePointsSupplier(
    supplier.platformDealsCompleted,
    supplier.platformCompletionRate,
  );
  return clamp(
    50 +
      dealsPts +
      yearsPts +
      NEEDS_DATA_QUALITY_CERT_POINTS +
      licensePts +
      NEEDS_DATA_SUPPLIER_CAPACITY_POINTS,
  );
}

/** Cross-applied relationship signal within Counterparty — spec §4.A. */
function relationshipAdjustment(deal: Deal): number {
  if (deal.priorDealsBetweenParties >= 10) return 10;
  if (deal.priorDealsBetweenParties >= 5) return 7;
  if (deal.priorDealsBetweenParties >= 1) return 5;
  return -10;
}

/**
 * Coface coverage note — **not a Counterparty (Dimension A) score input.**
 * Per spec §1, Coface is Gate 1: a pass/fail pre-check evaluated before
 * `compute_cram` runs at all, not a scored variable inside any of the four
 * dimensions. Kept here only to drive the counterparty "why" narrative
 * (`assessment.ts`) — it must not be added into `computeCounterpartyScore`.
 */
function externalCreditBonus(deal: Deal): number {
  const coveragePct = deal.cofaceCoveragePct ?? 0;
  if (coveragePct >= 80) return 12;
  if (coveragePct >= 50) return 8;
  if (coveragePct > 0) return 4;
  return deal.externalCreditSignal || deal.buyer.creditRating ? 8 : 0;
}

export function computeCounterpartyScore(deal: Deal): number {
  const buyer = computeBuyerScore(deal);
  const supplier = computeSupplierScore(deal);
  const relationship = relationshipAdjustment(deal);
  return clamp(buyer * 0.5 + supplier * 0.5 + relationship);
}

/**
 * Dimension B (Product) — synced to spec §4.B. base 70 · Perishability 30% /
 * Price-vs-market 30% / Quality grade 30% / Standardisation & phyto 10%.
 *
 * The static product-risk-tables.ts score (when a table row matches) already
 * encodes the perishability-class judgment for that product type — it stands
 * in for the "Perishability class" + "Standardisation & phyto" variables
 * (40% combined) as a pre-computed structural baseline, consistent with how
 * the ERD's `Product.productRiskScore` field is a stored, AC-reviewed value
 * rather than something recomputed live per deal (spec §3: reference tables
 * are Git-sourced, not live-computed). Quality grade and price-vs-market are
 * genuinely PER-DEAL (this shipment's grade/price, not the product's usual
 * one), so they're layered on top additively rather than baked into the
 * table lookup — this also fixes a bug where a matched table row returned
 * `tableMatch.score` directly and ignored quality grade entirely.
 */
function productFallbackStructuralScore(deal: Deal): number {
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
  const tableMatch = deal.productRiskProfile ?? lookupProductRisk(deal.product);
  const structuralScore = tableMatch ? tableMatch.score : productFallbackStructuralScore(deal);
  const priceAdj = priceVsMarketPoints(deal.product, deal.offerUnitPriceUSD);
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
    deal.routeRiskProfile ?? lookupRouteRisk(deal.origin, deal.destination);
  const structuralScore = tableMatch ? tableMatch.score : routeFallbackStructuralScore(deal);

  // Incoterms (20%wt) and cold-chain requirement (15%wt) are genuinely
  // per-deal, not baked into either the static table score or the fallback —
  // fixes a bug where a matched table row skipped incoterm entirely.
  const incotermAdj = incotermAdjustment(deal.incoterm);
  // spec: required+documented −5 / required+incomplete −12 / not required 0.
  // No source distinguishes documented vs incomplete, so "documented" (the
  // less severe, spec-real value) is assumed when required — same optimistic-
  // default pattern as license validity / payment delay elsewhere.
  const coldChainAdj = deal.coldChainRequired ? -5 : 0;

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
 * Dimension D (Transaction Structure) — resynced to spec §4.D 2026-07-24.
 * base 60. Previously: advance-payment-% alone drove a 20–90 base swing (not
 * a spec concept at all — advance-payment is only a 10%-weight adjustment),
 * collateral/insurance/payment-terms points ran at roughly half of spec's
 * magnitudes, "None" collateral/insurance were neutral instead of spec's
 * penalty/veto, and the relationship sub-formula didn't match §4.D at all.
 */
export function computeStructureScore(deal: Deal): number {
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
  paymentTermsAdj: number;
}

export function computeOverallScore(deal: Deal): ScoreBreakdown {
  const buyer = Math.round(computeBuyerScore(deal));
  const supplier = Math.round(computeSupplierScore(deal));
  const counterparty = Math.round(computeCounterpartyScore(deal));
  const product = Math.round(computeProductScore(deal));
  const route = Math.round(computeRouteScore(deal));
  const structure = Math.round(computeStructureScore(deal));

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
    paymentTermsAdj: paymentTermsAdjustment(deal.paymentTerms),
  };
}
