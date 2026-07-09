export type CofaceExtractionResult = {
  guaranteedAmount: number;
  currency: string;
  coverageAmountUSD: number;
  debtorName?: string;
  decisionDate?: string;
  notificationNumber?: string;
  extractionHint: string;
};
