/**
 * Coface risk letter grades (excellent → very bad).
 * @see CRA (Country Risk Assessment) and DRA (Debtor / company risk) in Coface risk management UI.
 */
export type CofaceRiskGrade = 'A1' | 'A2' | 'A3' | 'A4' | 'B' | 'C' | 'D';

/** Parsed from a Coface limit notification PDF (response document). */
export type CofaceExtractionResult = {
  /** Response: approved guaranteed limit (maps to `cofaceCoverageAmountUSD` on deal). */
  guaranteedAmount: number;
  currency: string;
  coverageAmountUSD: number;
  /** Response: same as guaranteed limit in USD-equivalent (MVP). */
  coverageApprovedAmountUSD: number;
  /** Request: amount asked for on the application line, if present. */
  requestedCoverageAmount?: number;
  requestedCoverageAmountUSD?: number;
  /** Request / response: buyer (debtor) name on the notification. */
  debtorName?: string;
  /** Request: buyer country when stated on the Coface document. */
  country?: string;
  /** Response: Coface CRA — country risk assessment (A1–A4, B, C, D). */
  countryRiskGrade?: CofaceRiskGrade;
  /** Response: Coface DRA / company (debtor) risk assessment (A1–A4, B, C, D). */
  companyRiskGrade?: CofaceRiskGrade;
  decisionDate?: string;
  notificationNumber?: string;
  extractionHint: string;
};
