export type DealPurpose = "Export" | "Retail" | "Processing" | "Resale";

export type StructureTier = "Strong" | "Adequate" | "Weak" | "Insufficient";

export type LegType = "sourcing" | "exw" | "fob_ready";

/** "per kg of what?" — the playbook's #1 source of modeling error (Module 1). */
export type PriceBasis = "gross_kg" | "packed_kg";

export type CostUnit = "per_carton" | "per_kg" | "flat";

/** A single cost-stack line — clamshells, labels, box, processing, purchase logistics, etc. */
export interface CostLine {
  id: string;
  label: string;
  amountPerUnit: number;
  unit: CostUnit;
  /** e.g. 18 for Peru's IGV. 0 if untaxed. */
  taxRatePct: number;
}

/**
 * One supply leg — playbook Module 1: "a deal can mix legs." Sourcing legs pay
 * for gross kg (discard applies, packing cost applies); EXW/FOB-ready legs pay
 * for already-packed kg (no discard, no packing — logistics only).
 */
export interface DealLeg {
  id: string;
  label: string;
  legType: LegType;
  /** Gross kg for a sourcing leg; already-packed/net kg for EXW/FOB-ready legs. */
  grossKg: number;
  /** Sourcing legs only — fraction (0–1) of gross kg lost to discard. 0 for EXW/FOB-ready. */
  discardPct: number;
  /** Sales unit conversion, e.g. 1.5 kg net per carton. */
  kgPerCarton: number;
  /** Which kg basis this leg's purchase price applies to — always ask "per kg of what?" */
  priceBasis: PriceBasis;
  /** This leg's own purchase price, USD per kg (at `priceBasis`). */
  purchasePricePerKg: number;
  /** Per-unit variable costs for this leg only (packing, clamshells, purchase logistics, etc.) — Module 1 cost-stack layer 1. */
  variableCosts: CostLine[];
}

/** Per-deal fixed cost — Module 1 cost-stack layer 2. Dilutes across all legs' pooled volume. */
export interface DealFixedCost {
  id: string;
  label: string;
  amountUSD: number;
}

/** Module 2's insurance overlay: `recovery = min(shortfall × indemnity%, cap)`. */
export interface InsuranceOverlay {
  indemnityPct: number | null;
  coverageCapUSD: number | null;
  policyValidityDate: string | null;
  policyholder: string | null;
}

/** Provenance of structure inputs — exploration defaults vs user-confirmed edits. */
export type StructureSource = "default" | "user";

/** Cash-flow + structure inputs per Kanato CRAM Transaction Structure model, extended 2026-07-28 with the deal-sensitivity-playbook's legs/cost-stack/insurance-overlay model. */
export interface TransactionStructureInput {
  /** Manual entry, or left null to derive from `legs` (sum of leg + fixed costs) when legs are provided. */
  purchaseTotalUSD: number | null;
  /** Manual entry, or left null to derive from `legs` (total_kg × FOB sale price) when legs + salePricePerKg are provided. */
  saleTotalUSD: number | null;
  /** FOB sale price, USD/kg — required to derive saleTotalUSD from legs; also the sensitivity engine's primary variable. */
  salePricePerKg: number | null;
  supAdvDay: number | null;
  supAdvPct: number | null;
  supFinDay: number | null;
  supFinPct: number | null;
  buyFirstDay: number | null;
  buyFirstPct: number | null;
  buyFinalDay: number | null;
  buyFinalPct: number | null;
  dealPurpose: DealPurpose | null;
  tmProductOwnership: boolean | null;
  collectionRights: boolean | null;
  legs: DealLeg[];
  fixedCosts: DealFixedCost[];
  insurance: InsuranceOverlay | null;
  /**
   * "default" = seeded for exploration from deal value (not verified economics).
   * "user" = confirmed/edited for scoring. Omitted on legacy blank inputs.
   */
  structureSource?: StructureSource;
}

export interface ResolvedTransactionStructure {
  purchaseTotal: number;
  saleTotal: number;
  supAdvDay: number;
  supAdvPct: number;
  supFinDay: number;
  supFinPct: number;
  buyFirstDay: number;
  buyFirstPct: number;
  buyFinalDay: number;
  buyFinalPct: number;
  dealPurpose: DealPurpose;
  tmProductOwnership: boolean;
  collectionRights: boolean;
  complete: boolean;
  missingFields: string[];
}

export interface CashFlowResult {
  supplierAdvanceAmount: number;
  supplierFinalAmount: number;
  buyerFirstAmount: number;
  buyerFinalAmount: number;
  cum1: number;
  cum2: number;
  cum3: number;
  cum4: number;
  peakNegativePosition: number;
  exposureDuration: number;
  bestCaseMargin: number;
  worstCaseMargin: number;
  upsideDownsideRatio: number | null;
}

/** Per-leg landed-cost breakdown — Module 2's "compare legs against each other." */
export interface LegResult {
  legId: string;
  label: string;
  legType: LegType;
  netKg: number;
  cartons: number;
  purchaseCostUSD: number;
  variableCostUSD: number;
  allocatedFixedCostUSD: number;
  landedCostPerKg: number;
}

/** Module 2's derived KPIs — always computed together. */
export interface StructureKpis {
  totalKg: number;
  revenue: number;
  cost: number;
  cashCollected: number;
  margin: number;
  capitalNeed: number;
  exposureAfterFirstCollection: number;
  breakevenPrice: number | null;
  minCollectionToBreakevenPct: number | null;
  minCollectionToBreakevenPctOfInvoice: number | null;
  maxLossOnDefault: number;
  selfFundingPrice: number | null;
}

export interface InsuranceOverlayResult {
  shortfall: number;
  recovery: number;
  marginBeforeInsurance: number;
  marginAfterInsurance: number;
  validityWarning: string | null;
}

export type SensitivityAxisKind = "price" | "collectionPct" | "costShift" | "discardPct";

export interface SensitivityAxis {
  kind: SensitivityAxisKind;
  label: string;
}

export interface SensitivityTable {
  rowAxis: SensitivityAxis;
  colAxis: SensitivityAxis;
  rowValues: number[];
  colValues: number[];
  /** cells[row][col] = total margin USD at that (rowValue, colValue) setting. */
  cells: number[][];
  currentRowIndex: number;
  currentColIndex: number;
}

export interface TransactionStructureScore {
  subA: number;
  subB: number;
  subD: number;
  composite: number;
  tier: StructureTier;
  protocol: string;
  cashFlow: CashFlowResult;
  paymentTermsPts: number;
  advancePts: number;
  contractTypePts: number;
  dealPurposePts: number;
  exposureDuration: number;
  complete: boolean;
  missingFields: string[];
}

/** The full computed bundle a Transaction Structure report/UI needs. */
export interface TransactionStructureReport {
  resolved: ResolvedTransactionStructure;
  legResults: LegResult[];
  kpis: StructureKpis;
  insuranceResult: InsuranceOverlayResult | null;
  score: TransactionStructureScore;
  sensitivity: SensitivityTable[];
}
