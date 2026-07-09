export type DealFieldSuggestions = {
  dealRef?: string;
  product?: string;
  variety?: string;
  quantityLabel?: string;
  dealValueUSD?: number;
  origin?: string;
  destination?: string;
  incoterm?: string;
  buyerName?: string;
  supplierName?: string;
  paymentTerms?: string;
  advancePaymentPct?: number;
  qualityGrade?: string;
};

export type AnalyzedDocument = {
  fileName: string;
  detectedType: string;
  extractionHint?: string;
  requiresOcr?: boolean;
  extractionQuality?: 'high' | 'medium' | 'low';
};

export type AnalyzeDocumentsResult = {
  documents: AnalyzedDocument[];
  suggestions: DealFieldSuggestions;
  filledFields: string[];
  docCoveragePct: number;
};
