export type DealPurpose = "Export" | "Retail" | "Processing" | "Resale";

export type StructureTier = "Strong" | "Adequate" | "Weak" | "Insufficient";

/** Cash-flow + structure inputs per Kanato CRAM Transaction Structure model */
export interface TransactionStructureInput {
  purchaseTotalUSD: number | null;
  saleTotalUSD: number | null;
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
