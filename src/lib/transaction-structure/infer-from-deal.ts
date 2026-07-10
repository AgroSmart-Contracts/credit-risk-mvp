import type { Deal } from "../../types";
import type { TransactionStructureInput } from "./types";

const EMPTY_STRUCTURE: TransactionStructureInput = {
  purchaseTotalUSD: null,
  saleTotalUSD: null,
  supAdvDay: null,
  supAdvPct: null,
  supFinDay: null,
  supFinPct: null,
  buyFirstDay: null,
  buyFirstPct: null,
  buyFinalDay: null,
  buyFinalPct: null,
  dealPurpose: null,
  tmProductOwnership: null,
  collectionRights: null,
};

export function getDealTransactionStructure(
  deal: Deal,
): TransactionStructureInput {
  return deal.transactionStructure ?? EMPTY_STRUCTURE;
}

/** Best-effort parse of buyer payment tranches from contract text */
export function inferBuyerTranchesFromPaymentTerms(
  paymentTerms: string,
  estimatedTransitDays: number,
): Pick<
  TransactionStructureInput,
  "buyFirstDay" | "buyFirstPct" | "buyFinalDay" | "buyFinalPct"
> {
  const t = paymentTerms.toLowerCase();
  const pctMatches = [...paymentTerms.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map(
    (m) => Number(m[1]),
  );

  if (pctMatches.length < 2) {
    return {
      buyFirstDay: null,
      buyFirstPct: null,
      buyFinalDay: null,
      buyFinalPct: null,
    };
  }

  const buyFirstPct = pctMatches[0];
  const buyFinalPct = pctMatches[1];
  const againstDocs =
    t.includes("against") &&
    (t.includes("bl") || t.includes("doc") || t.includes("draft"));
  const arrivalMatch = t.match(/(\d+)\s*days?\s*(?:after\s+)?arrival/);
  const arrivalDays = arrivalMatch ? Number(arrivalMatch[1]) : 10;

  const buyFirstDay = againstDocs ? Math.max(3, estimatedTransitDays) : 0;
  const buyFinalDay = againstDocs
    ? buyFirstDay + arrivalDays
    : Math.max(30, estimatedTransitDays + 14);

  return { buyFirstDay, buyFirstPct, buyFinalDay, buyFinalPct };
}

export function inferStructureFromDeal(deal: Deal): TransactionStructureInput {
  const existing = getDealTransactionStructure(deal);
  const buyerTranches = inferBuyerTranchesFromPaymentTerms(
    deal.paymentTerms,
    deal.estimatedTransitDays,
  );
  const extractedPurchase =
    deal.documentAnalysis?.suggestions?.purchaseTotalUSD ?? null;

  return {
    purchaseTotalUSD: existing.purchaseTotalUSD ?? extractedPurchase,
    saleTotalUSD: existing.saleTotalUSD ?? deal.dealValueUSD,
    supAdvDay: existing.supAdvDay,
    supAdvPct: existing.supAdvPct,
    supFinDay: existing.supFinDay,
    supFinPct: existing.supFinPct,
    buyFirstDay: existing.buyFirstDay ?? buyerTranches.buyFirstDay,
    buyFirstPct: existing.buyFirstPct ?? buyerTranches.buyFirstPct,
    buyFinalDay: existing.buyFinalDay ?? buyerTranches.buyFinalDay,
    buyFinalPct: existing.buyFinalPct ?? buyerTranches.buyFinalPct,
    dealPurpose: existing.dealPurpose,
    tmProductOwnership: existing.tmProductOwnership ?? true,
    collectionRights: existing.collectionRights ?? true,
  };
}

export function structureFieldLabels(): Record<
  keyof TransactionStructureInput,
  string
> {
  return {
    purchaseTotalUSD: "Purchase total (USD paid to supplier)",
    saleTotalUSD: "Sale total (USD collected from buyer)",
    supAdvDay: "Supplier advance — day offset",
    supAdvPct: "Supplier advance — % of purchase",
    supFinDay: "Supplier final payment — day offset",
    supFinPct: "Supplier final payment — % of purchase",
    buyFirstDay: "Buyer first payment — day offset",
    buyFirstPct: "Buyer first payment — % of sale",
    buyFinalDay: "Buyer final payment — day offset",
    buyFinalPct: "Buyer final payment — % of sale",
    dealPurpose: "Deal purpose",
    tmProductOwnership: "TM product ownership",
    collectionRights: "CISG / collection rights apply",
  };
}
