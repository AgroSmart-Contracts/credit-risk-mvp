import type { Deal } from "../types";
import type { PlatformDealRecord } from "../types/platform";
import {
  computeBuyerScore,
  computeCounterpartyScore,
  computeSupplierScore,
} from "./scoring";
import { platformDealToDeal } from "./platform-deal-mapper";

export interface CounterpartyScoreBreakdown {
  buyerScore: number;
  supplierScore: number;
  counterpartyScore: number;
  htmlFormulaScore: number | null;
  missingFields: string[];
  canScoreCounterparty: boolean;
}

/** Fields required to run Dim A (counterparty) without heavy defaults. */
export const COUNTERPARTY_REQUIRED_FIELDS = [
  "buyer.name",
  "supplier.name",
  "buyer.yearsInBusiness",
  "supplier.yearsInBusiness",
  "dealValueUSD",
] as const;

/** Fields still absent across the CSV enrichment (full CRAM / Dim A extras).
 *  Assumed for MVP scoring: licenseValidity=true, avgPaymentDelayDays=0,
 *  qualityRejectionRatePct=0 (perfect scores — ignore until real data).
 *  Coface coverage is deliberately not listed here — it's never null/zero
 *  (always a real record's value or the 90%-default), so it isn't a "missing
 *  field" gap; cofaceIsDefaulted on the record distinguishes the two cases. */
export const COUNTERPARTY_ENRICHMENT_GAPS = ["customs export narrative"] as const;

export function listMissingCounterpartyFields(
  record: PlatformDealRecord,
): string[] {
  const missing: string[] = [];
  if (!record.buyerName || record.buyerName.startsWith("Unknown")) {
    missing.push("buyer.name");
  }
  if (!record.supplierName || record.supplierName.startsWith("Unknown")) {
    missing.push("supplier.name");
  }
  if (record.buyerYib === null) missing.push("buyer.yearsInBusiness");
  if (record.supplierYib === null) missing.push("supplier.yearsInBusiness");
  if (record.dealValueUSD <= 0) missing.push("dealValueUSD");
  return missing;
}

export function isCounterpartyReady(record: PlatformDealRecord): boolean {
  return listMissingCounterpartyFields(record).length === 0;
}

export function scorePlatformCounterparty(
  record: PlatformDealRecord,
): CounterpartyScoreBreakdown {
  const requiredMissing = listMissingCounterpartyFields(record);
  const enrichmentMissing = COUNTERPARTY_ENRICHMENT_GAPS.filter((field) => {
    if (field.startsWith("customs")) return !record.customsNarrative;
    return true;
  });

  if (requiredMissing.length > 0) {
    return {
      buyerScore: 0,
      supplierScore: 0,
      counterpartyScore: 0,
      htmlFormulaScore: record.htmlFormulaScore,
      missingFields: [...requiredMissing, ...enrichmentMissing],
      canScoreCounterparty: false,
    };
  }

  const deal = platformDealToDeal(record);
  return {
    buyerScore: computeBuyerScore(deal),
    supplierScore: computeSupplierScore(deal),
    counterpartyScore: computeCounterpartyScore(deal),
    htmlFormulaScore: record.htmlFormulaScore,
    missingFields: enrichmentMissing,
    canScoreCounterparty: true,
  };
}

export function scoreDealCounterparty(deal: Deal): CounterpartyScoreBreakdown {
  return {
    buyerScore: computeBuyerScore(deal),
    supplierScore: computeSupplierScore(deal),
    counterpartyScore: computeCounterpartyScore(deal),
    htmlFormulaScore: null,
    missingFields: deal.fieldsNeedingConfirmation,
    canScoreCounterparty:
      deal.buyer.yearsInBusiness !== null &&
      deal.supplier.yearsInBusiness !== null,
  };
}
