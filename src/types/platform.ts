/** Platform CSV / CRAM enrichment types (credit-risk-mvp only — does not alter TruMarket Mongo schemas). */

import type { MarketIntelPayload } from "../lib/market-intel/types";

/**
 * "real" / "unverified" / "likely real" pass through to scoring with a badge.
 * "likely_test" rows are excluded from platform-deals.generated.json entirely
 * (decision 2026-07-24) — kept here only so the type covers what the source
 * CSV's `likely_test` column can contain, for anything that inspects the raw feed.
 */
export type DataQualityFlag = "real" | "unverified" | "likely real" | "likely_test";

export interface PlatformDealRecord {
  id: string;
  mongoId: string;
  dealRef: string;
  product: string;
  variety: string;
  quantityLabel: string;
  dealValueUSD: number;
  origin: string;
  destination: string;
  buyerName: string;
  supplierName: string;
  buyerYib: number | null;
  supplierYib: number | null;
  /** "csv" = pulled from that company's own deal rows; "verified" = no CSV source, filled from an external company-registry lookup (see YIB_OVERRIDE_BY_KEY in build-company-master.ts); "default" = no source at all, licenseValid-style default applies. */
  buyerYibSource: "csv" | "verified" | "default";
  supplierYibSource: "csv" | "verified" | "default";
  perishabilityClass:
    | "Ultra-Perishable"
    | "Perishable"
    | "Semi-Perishable"
    | "Non-Perishable";
  shelfLifeDays: number | null;
  coldChainRequired: boolean;
  estimatedTransitDays: number;
  numberOfTransshipments: number;
  routeRiskFlag: "Low" | "Medium" | "High";
  /** Raw CSV `transport` column ("by_air"/"sea_freight") normalized. Feeds Route dimension freight-mode split + veto register (spec §4.C/§6). */
  transportMode: "air" | "sea" | null;
  /** Raw CSV `offerUnitPrice`, USD. Feeds Product dimension price-vs-market (spec §4.B). */
  offerUnitPriceUSD: number | null;
  /** Real count from company-trade-profiles-2026-07-21.csv / this same CSV, grouped by buyer+supplier pair (likely_test rows excluded from the count). */
  priorDealsBetweenParties: number;
  /** Derived from (latest − earliest) createdAt for that buyer+supplier pair, in months. 0 when createdAt is missing on all of the pair's rows. */
  relationshipAgeMonths: number;
  status: string;
  likelyTest: DataQualityFlag;
  currentMilestone: number;
  /**
   * Raw passthrough of the CSV's free-text `customs` narrative column (e.g.
   * "DUA 011835-1 | 2025-02-15 | AEREO | FOB $47,750.00 | 5,400kg | ISRAEL").
   * The DUA reference number lives inside this text; there is no separate
   * `customsId` field — a bare record ID is a database foreign key concern
   * (see ERD `Customs._id`), not something this CSV-driven tool needs to
   * carry as its own column. Not yet parsed into structured fields.
   */
  customsNarrative: string | null;
  /** Coface response coverage. Decision 2026-07-24: defaults to 90% of dealValueUSD, persisted literally, whenever no real Coface record exists in the source CSV (100% of rows today). */
  cofaceCoverageAmountUSD: number;
  cofaceCoveragePct: number;
  /** true whenever the two fields above are the 90%-default, not a real Coface record. */
  cofaceIsDefaulted: boolean;
  counterpartyReady: boolean;
  /**
   * Batch-fetched at build time (scripts/lib/market-intel-cli.ts) from Peru
   * customs + SUNAT data, only when the supplier resolves to a valid Peru
   * RUC via company-master.json's taxIds — decision 2026-07-27. null means
   * either no valid RUC resolved, or the supplier has no shipment history in
   * this data bundle (HS 0810/0811, 2025 only) — not necessarily "no data
   * exists at all". Feeds computeBuyerScore()/computeSupplierScore()'s
   * capacity variables in src/lib/scoring.ts.
   */
  marketIntel: MarketIntelPayload | null;
  htmlFormulaScore: number | null;
  htmlFormulaBase: number | null;
  htmlFormulaBonus: number | null;
  missingFields: string[];
  createdAt: string;
}

export interface PlatformCounterpartyDealRef {
  mongoId: string;
  name: string;
  status: string;
  milestone: number;
  dealValue: number;
  score: number;
  priorDeals: number;
}

/**
 * A (company, role, product) group whose YIB is missing, so no
 * computeBuyerScore()/computeSupplierScore() could run for it at all — no
 * score to report, just how many deals depend on this gap. Reported here
 * (not just the Missing fields tab) so a buyer/supplier's absence from the
 * scored list is visible in the tab about counterparties, not silently
 * missing — decision 2026-07-27.
 */
export interface PlatformCounterpartyBlocked {
  id: string;
  companyName: string;
  role: "buyer" | "supplier";
  product: string;
  dealCount: number;
  finishedDealCount: number;
  deals: Array<{
    mongoId: string;
    name: string;
    status: string;
    milestone: number;
    dealValue: number;
  }>;
}

/**
 * One row per (company, role, product) — decision 2026-07-27. Matches the ERD:
 * `Counterparty` is a per-company-per-role entity (`role`, `riskScore` fields),
 * and `CRAM Assessment` references a separate `buyerCounterpartyId` and
 * `supplierCounterpartyId`, not a merged pair. Previously this was grouped by
 * (buyerName, supplierName) pair using a blended buyer×0.5+supplier×0.5 score,
 * which doesn't correspond to anything in the ERD — a counterparty's risk
 * score is its own, not shared with whichever party it happened to trade
 * with. Scoped by product too (not just company+role) since a company's real
 * track record can plausibly differ by commodity. The deal-level blended
 * Dimension A score (buyer×0.5+supplier×0.5+relationship) still exists —
 * that's `computeCounterpartyScore()`, used only inside a single deal's own
 * overall CRAM composite, not here.
 */
export interface PlatformCounterpartyScore {
  id: string;
  companyName: string;
  role: "buyer" | "supplier";
  product: string;
  yearsInBusiness: number;
  yearsInBusinessSource: "csv" | "verified" | "default";
  dealCount: number;
  finishedDealCount: number;
  avgScore: number;
  maxScore: number;
  minScore: number;
  deals: PlatformCounterpartyDealRef[];
  missingForFullCram: string[];
}

export type AppView =
  | "assess"
  | "counterparties"
  | "platform"
  | "missing"
  | "test-data"
  | "product-table"
  | "route-table";
