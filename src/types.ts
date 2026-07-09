import type { AnalyzeDocumentsResult } from "./lib/document-analysis/types";
import type { CorridorRiskFlag } from "./lib/route-risk-tables";
import type { DimensionBreakdown } from "./lib/scoring";

export interface CofaceCoverage {
  coveragePct: number | null;
  coverageAmountUSD: number | null;
  documentName: string | null;
}

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
  routeRiskResolution?: {
    resolvedFlag: CorridorRiskFlag;
    source: "pair-override" | "corridor-default" | "35-day-rule";
    rationale?: string;
    eudrGate?: boolean;
    cramTablesVersion?: string;
  };
  priorDealsBetweenParties: number;
  relationshipAgeMonths: number;
  externalCreditSignal?: string;
  cofaceCoverage?: CofaceCoverage;
  sourceDocuments: {
    label: string;
    type: string;
    extractionHint?: string;
  }[];
  fieldsNeedingConfirmation: string[];
  documentAnalysis?: AnalyzeDocumentsResult;
  teaser: string;
}

export type RiskTier =
  | "Low Risk"
  | "Medium-Low Risk"
  | "Medium-High Risk"
  | "High Risk";

export interface SubScore {
  label: string;
  score: number;
  why: string;
  weight?: number;
  headroom?: number;
  breakdown?: DimensionBreakdown;
}

export interface PartyScore {
  label: string;
  score: number;
  why: string;
  headroom?: number;
  breakdown?: DimensionBreakdown;
}

export interface RiskAssessment {
  counterparty: SubScore;
  product: SubScore;
  route: SubScore;
  structure: SubScore;
  buyer: PartyScore;
  supplier: PartyScore;
  overall: number;
  overallRaw: number;
  tier: RiskTier;
  concerns: string[];
  mitigating: string[];
}

export interface FinancingRecommendation {
  maxFinancingAmount: number;
  maxFinancingPct: number;
  requiredAdvanceAmount: number;
  requiredAdvancePct: number;
  interestRate: number;
  baseRate: number;
  riskPremium: number;
  collateralRequired: string;
  decision: string;
  approvalLevel: string;
}

export type Step = 1 | 2 | 3 | 4;
