import type { CofaceExtractionResult } from "./coface-analysis/types";
import type { Deal, RouteRiskProfile, SourceDocument } from "../types";
import { lookupProductRisk } from "./product-risk-tables";
import { lookupRouteRisk } from "./route-risk-tables";

export interface DealDraftInput {
  product: string;
  variety: string;
  dealValueUSD: number;
  buyerName: string;
  supplierName: string;
  paymentTerms: string;
  advancePaymentPct: number;
  incoterm: string;
  qualityGrade: Deal["qualityGrade"];
  origin: string;
  destination: string;
  cofaceCoverageAmountUSD: number | null;
  cofaceCoveragePct: number | null;
  cofaceRequestCountry?: string | null;
  cofaceRequestBuyerName?: string | null;
  cofaceRequestedCoverageAmountUSD?: number | null;
  cofaceCountryRiskGrade?: Deal["cofaceCountryRiskGrade"];
  cofaceCompanyRiskGrade?: Deal["cofaceCompanyRiskGrade"];
  sourceDocuments: SourceDocument[];
}

export function applyCofaceExtractToDraft(
  draft: DealDraftInput,
  extract: CofaceExtractionResult,
  dealValueUSD: number,
): DealDraftInput {
  const derivedPct = computeCoveragePctFromExtract(
    extract.coverageAmountUSD,
    dealValueUSD,
  );
  return {
    ...draft,
    buyerName: extract.debtorName?.trim() || draft.buyerName,
    cofaceCoverageAmountUSD: extract.coverageApprovedAmountUSD,
    cofaceCoveragePct: derivedPct,
    cofaceRequestCountry: extract.country ?? null,
    cofaceRequestBuyerName: extract.debtorName ?? null,
    cofaceRequestedCoverageAmountUSD:
      extract.requestedCoverageAmountUSD ?? null,
    cofaceCountryRiskGrade: extract.countryRiskGrade ?? null,
    cofaceCompanyRiskGrade: extract.companyRiskGrade ?? null,
  };
}

function computeCoveragePctFromExtract(
  coverageAmountUSD: number,
  dealValueUSD: number,
): number | null {
  if (!Number.isFinite(dealValueUSD) || dealValueUSD <= 0) return null;
  return Math.min(100, Math.round((coverageAmountUSD / dealValueUSD) * 100));
}

export function createBlankDeal(): Deal {
  return {
    id: "custom-deal",
    dealRef: "TM-DRAFT",
    product: "",
    variety: "",
    quantityLabel: "To be confirmed",
    dealValueUSD: 0,
    origin: "Callao, Peru",
    destination: "Rotterdam, Netherlands",
    incoterm: "FOB",
    buyer: {
      name: "",
      role: "buyer",
      yearsInBusiness: null,
      licenseValid: null,
      platformDealsCompleted: 0,
      platformCompletionRate: null,
      avgPaymentDelayDays: null,
    },
    supplier: {
      name: "",
      role: "supplier",
      yearsInBusiness: null,
      licenseValid: null,
      platformDealsCompleted: 0,
      platformCompletionRate: null,
      qualityRejectionRatePct: null,
    },
    paymentTerms: "",
    advancePaymentPct: 0,
    contractType: "Spot",
    collateralType: "None",
    collateralValueUSD: 0,
    insuranceCoverage: "None",
    insuranceValueUSD: 0,
    productCategory: "Fresh Produce",
    perishabilityClass: "Perishable",
    shelfLifeDays: null,
    coldChainRequired: true,
    qualityGrade: "Grade A / Class I",
    estimatedTransitDays: 18,
    numberOfTransshipments: 1,
    routeRiskFlag: "Medium",
    transportMode: null,
    offerUnitPriceUSD: null,
    priorDealsBetweenParties: 0,
    relationshipAgeMonths: 0,
    cofaceCoverageAmountUSD: null,
    cofaceCoveragePct: null,
    cofaceRequestCountry: null,
    cofaceRequestBuyerName: null,
    cofaceRequestedCoverageAmountUSD: null,
    cofaceCountryRiskGrade: null,
    cofaceCompanyRiskGrade: null,
    sourceDocuments: [],
    fieldsNeedingConfirmation: [
      "Buyer years in business",
      "Supplier years in business",
      "Import/export license validity",
    ],
    teaser: "Upload trade documents to generate an assessment",
    isCustom: true,
  };
}

function toSourceDocument(fileName: string, type: string): SourceDocument {
  return {
    label: fileName,
    type,
  };
}

export function buildSourceDocumentsFromUploads(
  dealFiles: File[],
  cofaceFile: File | null,
): SourceDocument[] {
  const docs = dealFiles.map((file) => toSourceDocument(file.name, "uploaded_trade_doc"));
  if (cofaceFile) {
    docs.push(toSourceDocument(cofaceFile.name, "credit_insurance"));
  }
  return docs;
}

function buildTeaser(
  product: string,
  routeProfile: RouteRiskProfile | null,
  cofaceCoveragePct: number | null,
): string {
  const parts = [`${product || "Custom product"} assessment`];
  if (routeProfile) parts.push(routeProfile.routeRiskFlag.toLowerCase() + "-risk corridor");
  if (cofaceCoveragePct && cofaceCoveragePct > 0) {
    parts.push(`Coface ${cofaceCoveragePct}% cover`);
  }
  return parts.join(", ");
}

export function buildDealFromDraft(baseDeal: Deal, draft: DealDraftInput): Deal {
  const productProfile = lookupProductRisk(draft.product);
  const routeProfile = lookupRouteRisk(draft.origin, draft.destination);

  return {
    ...baseDeal,
    dealRef:
      baseDeal.isCustom || baseDeal.dealRef === "TM-DRAFT"
        ? `TM-${new Date().getFullYear()}-DRAFT`
        : baseDeal.dealRef,
    product: draft.product,
    variety: draft.variety || "Not specified",
    dealValueUSD: draft.dealValueUSD,
    origin: draft.origin,
    destination: draft.destination,
    incoterm: draft.incoterm.toUpperCase() || baseDeal.incoterm,
    buyer: {
      ...baseDeal.buyer,
      name: draft.buyerName,
      creditRating:
        draft.cofaceCoverageAmountUSD && draft.cofaceCoverageAmountUSD > 0
          ? `Coface cover on file — ${draft.cofaceCoveragePct ?? "?"}% / USD ${Math.round(draft.cofaceCoverageAmountUSD).toLocaleString()}`
          : baseDeal.buyer.creditRating,
    },
    supplier: {
      ...baseDeal.supplier,
      name: draft.supplierName,
    },
    paymentTerms: draft.paymentTerms,
    advancePaymentPct: draft.advancePaymentPct,
    qualityGrade: draft.qualityGrade,
    perishabilityClass: productProfile?.perishabilityClass ?? baseDeal.perishabilityClass,
    shelfLifeDays: productProfile?.shelfLifeDays ?? baseDeal.shelfLifeDays,
    coldChainRequired: productProfile?.coldChainRequired ?? baseDeal.coldChainRequired,
    estimatedTransitDays:
      routeProfile?.estimatedTransitDays ?? baseDeal.estimatedTransitDays,
    numberOfTransshipments:
      routeProfile?.numberOfTransshipments ?? baseDeal.numberOfTransshipments,
    routeRiskFlag: routeProfile?.routeRiskFlag ?? baseDeal.routeRiskFlag,
    externalCreditSignal:
      draft.cofaceCoverageAmountUSD && draft.cofaceCoverageAmountUSD > 0
        ? `Coface cover on file — ${draft.cofaceCoveragePct ?? "?"}% / USD ${Math.round(draft.cofaceCoverageAmountUSD).toLocaleString()}`
        : undefined,
    cofaceCoverageAmountUSD: draft.cofaceCoverageAmountUSD,
    cofaceCoveragePct: draft.cofaceCoveragePct,
    cofaceRequestCountry: draft.cofaceRequestCountry ?? null,
    cofaceRequestBuyerName: draft.cofaceRequestBuyerName ?? null,
    cofaceRequestedCoverageAmountUSD:
      draft.cofaceRequestedCoverageAmountUSD ?? null,
    cofaceCountryRiskGrade: draft.cofaceCountryRiskGrade ?? null,
    cofaceCompanyRiskGrade: draft.cofaceCompanyRiskGrade ?? null,
    productRiskProfile: productProfile ?? undefined,
    routeRiskProfile: routeProfile ?? undefined,
    sourceDocuments: draft.sourceDocuments.length
      ? draft.sourceDocuments
      : baseDeal.sourceDocuments,
    teaser: buildTeaser(draft.product, routeProfile, draft.cofaceCoveragePct),
    isCustom: baseDeal.isCustom ?? false,
  };
}
