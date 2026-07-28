import type { Deal } from "../types";
import type { PlatformDealRecord } from "../types/platform";
import { normalizeDealMilestone } from "./deal-milestone";
import { lookupProductRisk } from "./product-risk-tables";
import { lookupRouteRisk } from "./route-risk-tables";

/** Map a CSV-backed platform deal into the MVP Deal shape for scoring / wizard. */
export function platformDealToDeal(record: PlatformDealRecord): Deal {
  const productProfile = lookupProductRisk(record.product);
  const routeProfile = lookupRouteRisk(record.origin, record.destination, record.product);
  const milestone = normalizeDealMilestone(
    record.status,
    record.currentMilestone,
  );

  const fieldsNeedingConfirmation = [
    ...record.missingFields.filter(
      (f) => f.includes("customs") || f.includes("risk table"),
    ),
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
    : true;

  return {
    id: record.id,
    dealRef: record.dealRef,
    product: record.product,
    variety: record.variety,
    quantityLabel: record.quantityLabel,
    dealValueUSD: record.dealValueUSD,
    origin: record.origin,
    destination: record.destination,
    incoterm: "FOB",
    buyer: {
      name: record.buyerName,
      role: "buyer",
      yearsInBusiness: record.buyerYib,
      /** DEFAULT (decision 2026-07-24, unchanged): assumed true for all platform users — no license/KYC source in any CSV. See docs/cram-defaults-and-formula-2026-07.md. */
      licenseValid: true,
      platformDealsCompleted: record.priorDealsBetweenParties,
      platformCompletionRate:
        milestone >= 7
          ? 100
          : record.priorDealsBetweenParties > 0
            ? 85
            : null,
      /** DEFAULT (decision 2026-07-24, unchanged): 0 days = perfect score. No payment-timing source in any CSV. */
      avgPaymentDelayDays: 0,
    },
    supplier: {
      name: record.supplierName,
      role: "supplier",
      yearsInBusiness: record.supplierYib,
      licenseValid: supplierLicenseValid,
      platformDealsCompleted: record.priorDealsBetweenParties,
      platformCompletionRate:
        milestone >= 7
          ? 100
          : record.priorDealsBetweenParties > 0
            ? 85
            : null,
      /** DEFAULT (decision 2026-07-24, unchanged): 0% = perfect score. No quality-rejection source in any CSV. */
      qualityRejectionRatePct: 0,
    },
    paymentTerms: "Documentary / against BL (platform default)",
    advancePaymentPct: 0,
    contractType: "Spot",
    collateralType: "None",
    collateralValueUSD: 0,
    insuranceCoverage: "None",
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
    numberOfTransshipments:
      routeProfile?.numberOfTransshipments ?? record.numberOfTransshipments,
    routeRiskFlag: routeProfile?.routeRiskFlag ?? record.routeRiskFlag,
    transportMode: record.transportMode,
    offerUnitPriceUSD: record.offerUnitPriceUSD,
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
    fieldsNeedingConfirmation: [...new Set(fieldsNeedingConfirmation)],
    teaser: record.counterpartyReady
      ? `Counterparty-ready · YIB ${record.buyerYib}/${record.supplierYib} · ${record.status}`
      : `Incomplete CRAM inputs · ${record.status}`,
  };
}
