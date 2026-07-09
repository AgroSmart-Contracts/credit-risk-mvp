import type { DealFieldSuggestions } from "./types";

export type DetectedFieldRow = { key: string; label: string; value: string };

const CORE_FIELD_LABELS: Record<string, string> = {
  product: "Product",
  variety: "Variety",
  route: "Route",
  dealValueUSD: "Deal value (USD)",
  buyerName: "Buyer",
  supplierName: "Supplier",
  incoterm: "Incoterm",
  paymentTerms: "Payment terms",
  advancePaymentPct: "Advance payment %",
  qualityGrade: "Quality grade",
};

export function formatDetectedDealFields(
  suggestions: DealFieldSuggestions,
): DetectedFieldRow[] {
  const rows: DetectedFieldRow[] = [];

  const push = (key: string, value: string | number | undefined) => {
    if (value === undefined || value === null || value === "") return;
    rows.push({
      key,
      label: CORE_FIELD_LABELS[key] ?? key,
      value: String(value),
    });
  };

  push("product", suggestions.product);
  push("variety", suggestions.variety);

  if (suggestions.origin || suggestions.destination) {
    push(
      "route",
      [suggestions.origin, suggestions.destination].filter(Boolean).join(" → "),
    );
  }

  if (suggestions.dealValueUSD != null) {
    push("dealValueUSD", Math.round(suggestions.dealValueUSD).toLocaleString("en-US"));
  }

  push("buyerName", suggestions.buyerName);
  push("supplierName", suggestions.supplierName);
  push("incoterm", suggestions.incoterm);
  push("paymentTerms", suggestions.paymentTerms);

  if (suggestions.advancePaymentPct != null) {
    push("advancePaymentPct", suggestions.advancePaymentPct);
  }

  push("qualityGrade", suggestions.qualityGrade);

  return rows;
}

export function countCoreDetectedFields(suggestions: DealFieldSuggestions): number {
  return formatDetectedDealFields(suggestions).length;
}
