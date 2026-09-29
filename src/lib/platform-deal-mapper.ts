import type { Deal } from "../types";
import type { PlatformDealRecord } from "../types/platform";
import { lookupProductRisk } from "./product-risk-tables";
import { lookupRouteRisk } from "./route-risk-tables";
import { scoreDealBuyer, scoreDealSupplier } from "./dimension-a";
import {
  hsHeading4,
  normalizeHsCode,
  resolveHsProduct,
} from "./hs-product-map";

/**
 * Dimension A blank fields for this deal's buyer/supplier, labeled to match
 * the "Buyer years in business" / "Supplier years in business" convention
 * already used below. Computed from the same WeightedField[] the scoring
 * engine itself uses (scoreDealBuyer/scoreDealSupplier), so this list can't
 * drift out of sync with what actually gets excluded from the raw average —
 * previously this tab only knew about a small hand-picked set of gaps
 * (customs narrative, risk-table fallback, YIB) with no visibility into
 * credit rating, frequency of deals, volumes, route diversity, quality
 * certifications, or quality rejection rate.
 */
function dimensionAMissingFields(deal: Deal): string[] {
  const buyerBlanks = scoreDealBuyer(deal)
    .fields.filter((f) => f.score == null)
    .map((f) => `Buyer ${f.label.charAt(0).toLowerCase()}${f.label.slice(1)}`);
  const supplierBlanks = scoreDealSupplier(deal)
    .fields.filter((f) => f.score == null)
    .map((f) => `Supplier ${f.label.charAt(0).toLowerCase()}${f.label.slice(1)}`);
  return [...buyerBlanks, ...supplierBlanks];
}

/** Map a CSV-backed platform deal into the MVP Deal shape for scoring / wizard. */
export function platformDealToDeal(record: PlatformDealRecord): Deal {
  const hsResolved = resolveHsProduct({
    hsCode: record.hsCode,
    product: record.product,
  });
  const hsCode =
    normalizeHsCode(record.hsCode) ?? hsResolved?.hsCode ?? null;
  const heading = hsHeading4(hsCode) ?? record.hsHeading4 ?? null;
  // Prefer HS-derived product label when the tariff maps to a known commodity.
  const product = hsResolved?.product ?? record.product;
  const productProfile = lookupProductRisk(product, hsCode);
  // Prefer named ports for Dimension C when present (aliases include bare port names).
  const originForRoute =
    record.portOfOrigin?.trim() || record.origin;
  const destinationForRoute =
    record.portOfDestination?.trim() || record.destination;
  const routeProfile = lookupRouteRisk(
    originForRoute,
    destinationForRoute,
    product,
    record.transportMode,
    record.numberOfTransshipments,
  );

  const fieldsNeedingConfirmation = [
    ...record.missingFields.filter((f) => {
      if (f.includes("customs") && record.customsNarrative) return false;
      return f.includes("customs") || f.includes("risk table");
    }),
  ];

  if (record.buyerYib === null) {
    fieldsNeedingConfirmation.unshift("Buyer years in business");
  }
  if (record.supplierYib === null) {
    fieldsNeedingConfirmation.unshift("Supplier years in business");
  }

  /**
   * SUNAT `estado`/`condicion` (ACTIVO/HABIDO — active & not delinquent) is a
   * real license/good-standing signal, batch-fetched at build time whenever
   * the supplier resolves to a Peru RUC (see scripts/lib/market-intel-cli.ts)
   * — decision 2026-07-27. Falls back to the true-default (documented gap:
   * no license/KYC source otherwise) when SUNAT didn't resolve. This feeds
   * both licensePointsSupplier() and the veto register (an inactive/
   * delinquent SUNAT status is exactly what the veto register's "invalid
   * export license" check means) — computed once here, not duplicated.
   */
  const supplierSunat = record.marketIntel?.dim_a_supplier.sunat;
  const supplierLicenseValid = supplierSunat?.resolved
    ? (!supplierSunat.estado || supplierSunat.estado === "ACTIVO") &&
      (!supplierSunat.condicion || supplierSunat.condicion === "HABIDO")
    : null;

  const deal: Deal = {
    id: record.id,
    dealRef: record.dealRef,
    product,
    hsCode,
    hsHeading4: heading,
    variety: record.variety,
    quantityLabel: record.quantityLabel,
    presentation: record.presentation,
    quantityKg: record.quantityKg,
    dealValueUSD: record.dealValueUSD,
    origin: record.origin,
    destination: record.destination,
    portOfOrigin: record.portOfOrigin,
    portOfDestination: record.portOfDestination,
    shipmentCompany: record.shipmentCompany,
    incoterm: "FOB",
    buyer: {
      name: record.buyerName,
      role: "buyer",
      yearsInBusiness: record.buyerYib,
      /** Unknown until KYC — blank in Dimension A (not scored as valid). */
      licenseValid: null,
      platformDealsCompleted: record.priorDealsBetweenParties,
      /**
       * Do not invent completion rates from milestone/priors — blanks shrink
       * toward 50 instead of padding A with fake 85/100%.
       */
      platformCompletionRate: null,
      /** No payment-timing source — leave blank for Dimension A (excludes blanks). */
      avgPaymentDelayDays: null,
    },
    supplier: {
      name: record.supplierName,
      role: "supplier",
      yearsInBusiness: record.supplierYib,
      licenseValid: supplierLicenseValid,
      platformDealsCompleted: record.priorDealsBetweenParties,
      platformCompletionRate: null,
      /** No quality-rejection source — leave blank for Dimension A. */
      qualityRejectionRatePct: null,
    },
    paymentTerms: "Documentary / against BL (platform default)",
    advancePaymentPct: 0,
    contractType: "Spot",
    collateralType: "None",
    collateralValueUSD: 0,
    insuranceCoverage: "None",
    /** CSV has no insurance source — haircut in D, do not veto. */
    insuranceConfirmed: false,
    insuranceValueUSD: 0,
    /** productCategory now sourced from the product table (ERD Product.productCategory) instead of hardcoded "Fresh Produce" — was wrong for Frozen/IQF products. Falls back to "Fresh Produce" only when no table row exists. */
    productCategory: productProfile?.productCategory ?? "Fresh Produce",
    perishabilityClass:
      productProfile?.perishabilityClass ?? record.perishabilityClass,
    shelfLifeDays: productProfile?.shelfLifeDays ?? record.shelfLifeDays,
    coldChainRequired:
      productProfile?.coldChainRequired ?? record.coldChainRequired,
    qualityGrade: "Grade A / Class I",
    estimatedTransitDays:
      routeProfile?.estimatedTransitDays ?? record.estimatedTransitDays,
    // Keep the platform deal's stop count (air stop band is selected from it).
    // Do not overwrite with the table row's band marker (2/3).
    numberOfTransshipments: record.numberOfTransshipments,
    routeRiskFlag: routeProfile?.routeRiskFlag ?? record.routeRiskFlag,
    transportMode: record.transportMode,
    offerUnitPriceUSD: record.offerUnitPriceUSD,
    shippingStartDate: record.shippingStartDate,
    createdAt: record.createdAt || null,
    priorDealsBetweenParties: record.priorDealsBetweenParties,
    relationshipAgeMonths: record.relationshipAgeMonths,
    /**
     * Decision 2026-07-24: no platform deal in the source CSV has a real
     * Coface record (cofaceRecordId is 0% filled) — default to 90% coverage
     * of dealValueUSD, persisted literally by the generator
     * (cofaceIsDefaulted marks which ones are the default vs a real record).
     * Not read by computeCounterpartyScore — Coface is Gate 1, evaluated
     * before CRAM, not a Dimension-A input (see scoring.ts).
     */
    cofaceCoverageAmountUSD: record.cofaceCoverageAmountUSD,
    cofaceCoveragePct: record.cofaceCoveragePct,
    marketIntel: record.marketIntel ?? undefined,
    productRiskProfile: productProfile ?? undefined,
    routeRiskProfile: routeProfile ?? undefined,
    sourceDocuments: record.customsNarrative
      ? [
          {
            label: `Customs export record — ${record.customsNarrative}`,
            type: "customs",
            extractionHint: "Linked from platform customsNarrative",
          },
        ]
      : [],
    fieldsNeedingConfirmation: [],
    teaser: record.counterpartyReady
      ? `Counterparty-ready · YIB ${record.buyerYib}/${record.supplierYib} · ${record.status}`
      : `Incomplete CRAM inputs · ${record.status}`,
  };

  deal.fieldsNeedingConfirmation = [
    ...new Set([
      ...fieldsNeedingConfirmation,
      ...dimensionAMissingFields(deal),
    ]),
  ];
  return deal;
}
