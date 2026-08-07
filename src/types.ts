import type { AnalyzeDocumentsResult } from "./lib/document-analysis/types";
import type { CofaceRiskGrade } from "./lib/coface-analysis/types";
import type { MarketIntelPayload } from "./lib/market-intel/types";
import type { TransactionStructureInput, TransactionStructureReport } from "./lib/transaction-structure/types";

export interface CounterpartyInput {
  name: string;
  role: "buyer" | "supplier";
  yearsInBusiness: number | null;
  licenseValid: boolean | null;
  platformDealsCompleted: number;
  platformCompletionRate: number | null;
  avgPaymentDelayDays?: number | null;
  qualityRejectionRatePct?: number | null;
  creditRating?: string;
  /** Company×product deal count for Dimension A platform-history weight. */
  profileDealCount?: number;
  profileFinishedDealCount?: number;
  /** Customs volume/routes/sales enrichment for Dimension A. */
  customsEnrichment?: {
    matched: boolean;
    monthlyFobUsd: number | null;
    fobUsd: number | null;
    volumeMt: number | null;
    routeCount: number | null;
    roles: string[];
    shipments: number;
  } | null;
}

export interface SourceDocument {
  label: string;
  type: string;
  extractionHint?: string;
}

export interface ProductRiskProfile {
  product: string;
  score: number;
  acRiskGroup?: number;
  /** ERD `Product.productCategory`. Drives Deal.productCategory — was hardcoded "Fresh Produce" for every platform deal until 2026-07-24, which was wrong for the frozen/IQF products. */
  productCategory: "Fresh Produce" | "Frozen" | "Dried" | "Processed";
  perishabilityClass:
    | "Ultra-Perishable"
    | "Perishable"
    | "Semi-Perishable"
    | "Non-Perishable";
  shelfLifeDays: number | null;
  coldChainRequired: boolean;
  rationale: string;
  /**
   * false = this row exists so the deal can be scored at all, but the score
   * itself is a provisional fallback (perishability-bucket estimate), not an
   * AC-confirmed table value. Surfaced in the Product Risk Table tab.
   * Added 2026-07-24 when Mango / Asparagus / Mixed Berries–Tropical (IQF) /
   * Frozen Tropical Fruits were added to cover real deal-book products that
   * had no table row at all.
   */
  scoreConfirmed: boolean;
}

export interface RouteRiskProfile {
  origin: string;
  destination: string;
  /** Route risk is scored per (origin, destination, product) — adjustedScore depends on this product's shelf life / cold-chain need on this corridor. */
  product: string;
  /**
   * Freight mode this table row applies to (Dimension C v2).
   * Air rows are keyed by exact stop count (0–4); stop curve is baked into `score`.
   */
  transportMode: "sea" | "air";
  /** Exact air stop count for this row; null for ocean. */
  airStops: number | null;
  /**
   * @deprecated Prefer `airStops`. UI grouping only: `le2` = 0–2, `gt2` = ≥3.
   * null for sea rows.
   */
  airStopsBand: "le2" | "gt2" | null;
  /** Points from stop_modifiers.csv already baked into `score` (display only). */
  airStopPenalty: number;
  score: number;
  estimatedTransitDays: number;
  /**
   * For air rows equals `airStops`. For ocean, corridor transshipment count
   * from the lane (deal-level stops still live on Deal.numberOfTransshipments).
   */
  numberOfTransshipments: number;
  routeRiskFlag: "Low" | "Medium" | "High";
  /**
   * true when Dimension C v2 marks this row VETO (e.g. air ≥4 stops) or
   * transit exceeds shelf life — fed into checkVetoRegister().
   */
  vetoCandidate: boolean;
  rationale: string;
  /** false = provisional/estimated corridor or product (not sourced from confirmed BL history or an AC-reviewed table for both the route and the product). */
  scoreConfirmed: boolean;
  /** Lane id from Dimension C (e.g. PECLL-ESALG-O). */
  laneId?: string;
  /** Alias strings (UN/LOCODE, IATA, dirty platform names) for lookup. */
  originAliases?: string[];
  destinationAliases?: string[];
}

export interface Deal {
  id: string;
  dealRef: string;
  product: string;
  variety: string;
  quantityLabel: string;
  dealValueUSD: number;
  origin: string;
  destination: string;
  incoterm: string;
  buyer: CounterpartyInput;
  supplier: CounterpartyInput;
  paymentTerms: string;
  advancePaymentPct: number;
  contractType: "Spot" | "Forward" | "Seasonal";
  collateralType:
    | "None"
    | "Personal Guarantee"
    | "Warehouse Receipt"
    | "Inventory Pledge"
    | "Bank Guarantee"
    | "Letter of Credit";
  collateralValueUSD: number;
  insuranceCoverage: "None" | "Basic" | "Comprehensive" | "All Risk";
  insuranceValueUSD: number;
  productCategory: "Fresh Produce" | "Frozen" | "Dried" | "Processed";
  perishabilityClass:
    | "Ultra-Perishable"
    | "Perishable"
    | "Semi-Perishable"
    | "Non-Perishable";
  shelfLifeDays: number | null;
  coldChainRequired: boolean;
  qualityGrade: "Grade A / Class I" | "Grade B / Class II" | "Industrial";
  estimatedTransitDays: number;
  numberOfTransshipments: number;
  routeRiskFlag: "Low" | "Medium" | "High";
  /** Freight mode — spec §4.C differentiates transit-time/transshipment points by air vs ocean, and §6's veto register only fires on air transshipments. null = unknown (spec variables default neutral). */
  transportMode: "air" | "sea" | null;
  /** Deal Register `offerUnitPrice`, USD. Feeds spec §4.B "Price vs market" (30% of Product weight) — see lib/price-benchmarks.ts. null = not captured. */
  offerUnitPriceUSD: number | null;
  /**
   * Planned / actual shipment start (ISO). Drives product price-vs-usual by
   * calendar month × route. Prefer this over `createdAt` when both exist.
   */
  shippingStartDate?: string | null;
  /** Platform deal creation timestamp (ISO). Fallback month anchor when shippingStartDate is missing. */
  createdAt?: string | null;
  priorDealsBetweenParties: number;
  relationshipAgeMonths: number;
  externalCreditSignal?: string;
  supplierRuc?: string;
  /** Coface response: approved guaranteed limit (USD-equivalent in MVP). */
  cofaceCoverageAmountUSD?: number | null;
  /** % of deal value covered; manual or derived from approved ÷ dealValueUSD. */
  cofaceCoveragePct?: number | null;
  /** Coface request: buyer country on the credit application / notification. */
  cofaceRequestCountry?: string | null;
  /** Coface request: buyer (debtor) name on the notification. */
  cofaceRequestBuyerName?: string | null;
  /** Coface request: coverage or deal amount requested (`You requested:` line). */
  cofaceRequestedCoverageAmountUSD?: number | null;
  /** Coface response: country risk assessment grade A–D. */
  cofaceCountryRiskGrade?: CofaceRiskGrade | null;
  /** Coface response: company (debtor) risk assessment grade A–D. */
  cofaceCompanyRiskGrade?: CofaceRiskGrade | null;
  productRiskProfile?: ProductRiskProfile;
  routeRiskProfile?: RouteRiskProfile;
  documentAnalysis?: AnalyzeDocumentsResult;
  marketIntel?: MarketIntelPayload;
  transactionStructure?: TransactionStructureInput;
  sourceDocuments: SourceDocument[];
  fieldsNeedingConfirmation: string[];
  teaser: string;
  isCustom?: boolean;
}

export type RiskTier =
  | "Low Risk"
  | "Medium-Low Risk"
  | "Medium-High Risk"
  | "High Risk"
  | "Veto";

export interface SubScore {
  label: string;
  score: number;
  why: string;
  weight?: number;
}

export interface PartyScore {
  label: string;
  score: number;
  why: string;
}

export interface RiskAssessment {
  counterparty: SubScore;
  product: SubScore;
  route: SubScore;
  structure: SubScore;
  buyer: PartyScore;
  supplier: PartyScore;
  /** Dimension A relationship group score (0–100). */
  relationshipAdj: number;
  /** Composite counterparty data completeness, 0–100 — see financing.ts's uncertaintyPremium. */
  counterpartyCoveragePct: number;
  overall: number;
  tier: RiskTier;
  /** Spec §6 single-veto register — true if any hard-stop condition fired, overriding the composite-based tier. */
  vetoed: boolean;
  vetoReasons: string[];
  concerns: string[];
  mitigating: string[];
  /** Full cash-flow/legs/sensitivity report — populated only when deal.transactionStructure has real input (see computeStructureScore). */
  structureReport: TransactionStructureReport | null;
}

export interface FinancingRecommendation {
  maxFinancingAmount: number;
  maxFinancingPct: number;
  requiredAdvanceAmount: number;
  requiredAdvancePct: number;
  interestRate: number;
  baseRate: number;
  riskPremium: number;
  /**
   * Extra APY added when counterparty data coverage is thin, on top of
   * riskPremium (which is keyed off the score alone). Two deals landing on
   * the same score bucket with very different data completeness no longer
   * get priced identically — see dimension-a.ts's computeCounterpartyCoveragePct.
   */
  uncertaintyPremium: number;
  /** Coverage % this uncertaintyPremium was computed from, for auditability. */
  counterpartyCoveragePct: number | null;
  collateralRequired: string;
  decision: string;
  approvalLevel: string;
}

export type Step = 1 | 2 | 3 | 4;
