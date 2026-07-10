import type { AnalyzeDocumentsResult } from "./document-analysis/types";
import type { CofaceCoverage, Deal } from "../types";
import { CRAM_REFERENCE_TABLES_VERSION } from "./cram-reference-version";
import { resolveRouteRiskFlag } from "./product-market-pair-table";
import { lookupProductRisk } from "./product-risk-tables";
import { lookupRouteRisk, normalizeRouteRiskFlag } from "./route-risk-tables";

export interface CreateDealInput {
  dealRef?: string;
  product: string;
  variety?: string;
  dealValueUSD: number;
  origin: string;
  destination: string;
  incoterm: string;
  buyerName: string;
  supplierName: string;
  paymentTerms: string;
  advancePaymentPct: number;
  qualityGrade: Deal["qualityGrade"];
  uploadedFileNames: string[];
  cofaceCoverage: CofaceCoverage;
  documentAnalysis?: AnalyzeDocumentsResult;
}

function nextDealRef(): string {
  const n = Math.floor(100 + Math.random() * 900);
  return `TM-2026-${n}`;
}

export function buildDealFromInput(input: CreateDealInput): Deal {
  const productEntry = lookupProductRisk(input.product);
  const routeEntry = lookupRouteRisk(input.origin, input.destination);

  const hasCoface =
    input.cofaceCoverage.coveragePct !== null ||
    input.cofaceCoverage.coverageAmountUSD !== null ||
    input.cofaceCoverage.documentName !== null;

  const cofaceSignal = hasCoface
    ? formatCofaceSignal(input.cofaceCoverage)
    : undefined;

  const analysis = input.documentAnalysis;
  const suggestions = analysis?.suggestions;

  const sourceDocuments =
    analysis?.documents.length
      ? analysis.documents.map((doc) => ({
          label: doc.fileName,
          type: doc.detectedType,
          extractionHint: doc.extractionHint,
        }))
      : input.uploadedFileNames.map((name) => ({
          label: name,
          type: name.toLowerCase().includes("coface")
            ? "credit_insurance"
            : name.toLowerCase().includes("order")
              ? "purchase_order"
              : "contract",
          extractionHint: "Uploaded for assessment — fields confirmed by user",
        }));

  if (input.cofaceCoverage.documentName) {
    const alreadyListed = sourceDocuments.some(
      (d) => d.label === input.cofaceCoverage.documentName,
    );
    if (!alreadyListed) {
      sourceDocuments.push({
        label: input.cofaceCoverage.documentName,
        type: "credit_insurance",
        extractionHint: "Coface coverage document on file",
      });
    }
  }

  const resolvedProduct =
    input.product.startsWith("Fresh") ? input.product : `Fresh ${input.product}`;
  const resolvedVariety = input.variety ?? suggestions?.variety ?? "—";
  const resolvedDealRef =
    input.dealRef ?? suggestions?.dealRef ?? nextDealRef();

  const resolvedRoute = resolveRouteRiskFlag(
    input.product,
    input.destination,
    routeEntry?.corridorDefaultRiskFlag ?? "Medium",
    routeEntry?.estimatedTransitDays ?? 14,
    productEntry?.perishabilityClass ?? "Perishable",
  );

  return {
    id: `custom-${Date.now()}`,
    dealRef: resolvedDealRef,
    product: resolvedProduct,
    variety: resolvedVariety,
    quantityLabel:
      suggestions?.quantityLabel ?? "To be confirmed from documentation",
    dealValueUSD: input.dealValueUSD,
    origin: input.origin,
    destination: input.destination,
    incoterm: input.incoterm,
    buyer: {
      name: input.buyerName,
      role: "buyer",
      yearsInBusiness: null,
      licenseValid: true,
      platformDealsCompleted: 0,
      platformCompletionRate: null,
      avgPaymentDelayDays: null,
      creditRating: cofaceSignal,
    },
    supplier: {
      name: input.supplierName,
      role: "supplier",
      yearsInBusiness: null,
      licenseValid: true,
      platformDealsCompleted: 0,
      platformCompletionRate: null,
      qualityRejectionRatePct: null,
    },
    supplierRuc: suggestions?.supplierRuc ?? null,
    paymentTerms: input.paymentTerms,
    advancePaymentPct: input.advancePaymentPct,
    contractType: "Spot",
    collateralType: "None",
    collateralValueUSD: 0,
    insuranceCoverage: hasCoface ? "Comprehensive" : "None",
    insuranceValueUSD: input.cofaceCoverage.coverageAmountUSD ?? 0,
    productCategory:
      productEntry?.perishabilityClass === "Non-Perishable"
        ? "Processed"
        : "Fresh Produce",
    perishabilityClass:
      productEntry?.perishabilityClass ?? "Perishable",
    shelfLifeDays: productEntry?.shelfLifeDaysMax ?? null,
    coldChainRequired: productEntry?.perishabilityClass !== "Non-Perishable",
    qualityGrade: input.qualityGrade,
    estimatedTransitDays: routeEntry?.estimatedTransitDays ?? 14,
    numberOfTransshipments: routeEntry
      ? routeEntry.directService
        ? 0
        : routeEntry.estimatedTransitDays > 20
          ? 1
          : 0
      : 0,
    routeRiskFlag: normalizeRouteRiskFlag(resolvedRoute.flag),
    routeRiskResolution: {
      resolvedFlag: resolvedRoute.flag,
      source: resolvedRoute.source,
      rationale: resolvedRoute.rationale,
      eudrGate: resolvedRoute.eudrGate,
      cramTablesVersion: CRAM_REFERENCE_TABLES_VERSION,
    },
    priorDealsBetweenParties: 0,
    relationshipAgeMonths: 0,
    externalCreditSignal: cofaceSignal,
    cofaceCoverage: input.cofaceCoverage,
    documentAnalysis: analysis,
    sourceDocuments:
      sourceDocuments.length > 0
        ? sourceDocuments
        : [
            {
              label: "Deal documentation (pending)",
              type: "contract",
            },
          ],
    fieldsNeedingConfirmation: [],
    transactionStructure: {
      purchaseTotalUSD: suggestions?.purchaseTotalUSD ?? null,
      saleTotalUSD: suggestions?.dealValueUSD ?? input.dealValueUSD,
      supAdvDay: null,
      supAdvPct: null,
      supFinDay: null,
      supFinPct: null,
      buyFirstDay: null,
      buyFirstPct: null,
      buyFinalDay: null,
      buyFinalPct: null,
      dealPurpose: null,
      tmProductOwnership: true,
      collectionRights: true,
    },
    teaser: hasCoface
      ? analysis
        ? `Extracted ${analysis.filledFields.length} fields from Spanish trade docs with Coface coverage`
        : "User-uploaded deal with Coface coverage"
      : analysis
        ? `Extracted ${analysis.filledFields.length} fields from uploaded trade documentation`
        : "User-uploaded deal — no Coface on file",
  };
}

export function formatCofaceSignal(coverage: CofaceCoverage): string {
  const parts: string[] = ["Coface credit coverage"];
  if (coverage.coveragePct !== null) {
    parts.push(`${coverage.coveragePct}% of deal value`);
  }
  if (coverage.coverageAmountUSD !== null) {
    parts.push(
      `USD ${coverage.coverageAmountUSD.toLocaleString("en-US")} limit`,
    );
  }
  return parts.join(" — ");
}
