import type { CounterpartyInput, Deal } from "../types";

export type ConfirmationFieldId =
  | "buyer.yearsInBusiness"
  | "buyer.licenseValid"
  | "buyer.platformCompletionRate"
  | "buyer.avgPaymentDelayDays"
  | "supplier.yearsInBusiness"
  | "supplier.licenseValid"
  | "supplier.platformCompletionRate"
  | "supplier.qualityRejectionRatePct";

export type ConfirmationFieldType = "number" | "percent" | "boolean" | "text";

export interface ScoringConfirmationField {
  kind: "scoring";
  id: ConfirmationFieldId;
  label: string;
  type: ConfirmationFieldType;
  placeholder?: string;
  suffix?: string;
}

export interface FreeTextConfirmationField {
  kind: "freeText";
  key: string;
  label: string;
  placeholder?: string;
}

export type ConfirmationField = ScoringConfirmationField | FreeTextConfirmationField;

const SCORING_FIELD_DEFS: ScoringConfirmationField[] = [
  {
    kind: "scoring",
    id: "buyer.yearsInBusiness",
    label: "Buyer years in business",
    type: "number",
    placeholder: "e.g. 8",
    suffix: "years",
  },
  {
    kind: "scoring",
    id: "buyer.licenseValid",
    label: "Buyer import/export license validity",
    type: "boolean",
  },
  {
    kind: "scoring",
    id: "buyer.platformCompletionRate",
    label: "Buyer platform completion rate",
    type: "percent",
    placeholder: "e.g. 85",
    suffix: "%",
  },
  {
    kind: "scoring",
    id: "buyer.avgPaymentDelayDays",
    label: "Buyer avg payment delay",
    type: "number",
    placeholder: "e.g. 5",
    suffix: "days",
  },
  {
    kind: "scoring",
    id: "supplier.yearsInBusiness",
    label: "Supplier years in business",
    type: "number",
    placeholder: "e.g. 12",
    suffix: "years",
  },
  {
    kind: "scoring",
    id: "supplier.licenseValid",
    label: "Supplier export license validity",
    type: "boolean",
  },
  {
    kind: "scoring",
    id: "supplier.platformCompletionRate",
    label: "Supplier platform completion rate",
    type: "percent",
    placeholder: "e.g. 92",
    suffix: "%",
  },
  {
    kind: "scoring",
    id: "supplier.qualityRejectionRatePct",
    label: "Supplier quality rejection rate",
    type: "percent",
    placeholder: "e.g. 2",
    suffix: "%",
  },
];

const LEGACY_LABEL_TO_ID: Record<string, ConfirmationFieldId | null> = {
  "buyer years in business": "buyer.yearsInBusiness",
  "supplier years in business": "supplier.yearsInBusiness",
  "import/export license validity": null,
  "buyer import license validity": "buyer.licenseValid",
  "supplier export license validity": "supplier.licenseValid",
  "buyer platform completion rate": "buyer.platformCompletionRate",
  "buyer avg payment delay": "buyer.avgPaymentDelayDays",
  "supplier platform completion rate": "supplier.platformCompletionRate",
  "supplier quality rejection rate": "supplier.qualityRejectionRatePct",
};

function getParty(
  deal: Deal,
  party: "buyer" | "supplier",
): CounterpartyInput {
  return deal[party];
}

function isUndisclosed(
  deal: Deal,
  id: ConfirmationFieldId,
): boolean {
  const [party, field] = id.split(".") as ["buyer" | "supplier", string];
  const counterparty = getParty(deal, party);
  const value = counterparty[field as keyof CounterpartyInput];
  return value === null || value === undefined;
}

export function listConfirmationFields(deal: Deal): ConfirmationField[] {
  const scoring = SCORING_FIELD_DEFS.filter((def) => isUndisclosed(deal, def.id));

  const coveredLabels = new Set(
    scoring.map((field) => field.label.toLowerCase()),
  );

  const freeText: FreeTextConfirmationField[] = [];
  for (const label of deal.fieldsNeedingConfirmation) {
    const mapped = LEGACY_LABEL_TO_ID[label.toLowerCase()];
    if (mapped) continue;
    if (label.toLowerCase().includes("import/export license")) continue;
    if (coveredLabels.has(label.toLowerCase())) continue;
    freeText.push({
      kind: "freeText",
      key: label,
      label,
      placeholder: "Enter value or estimate",
    });
  }

  return [...scoring, ...freeText];
}

export type ConfirmationValues = Record<string, string | boolean>;

function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

function setPartyField(
  party: CounterpartyInput,
  field: string,
  value: number | boolean,
): CounterpartyInput {
  return { ...party, [field]: value };
}

export function applyConfirmations(
  deal: Deal,
  values: ConfirmationValues,
): Deal {
  let next: Deal = { ...deal, buyer: { ...deal.buyer }, supplier: { ...deal.supplier } };

  for (const [key, raw] of Object.entries(values)) {
    if (raw === "" || raw === null || raw === undefined) continue;

    if (key.startsWith("buyer.") || key.startsWith("supplier.")) {
      const id = key as ConfirmationFieldId;
      const [partyName, field] = id.split(".") as ["buyer" | "supplier", string];
      const def = SCORING_FIELD_DEFS.find((item) => item.id === id);
      if (!def) continue;

      if (def.type === "boolean" && typeof raw === "boolean") {
        next[partyName] = setPartyField(next[partyName], field, raw);
        continue;
      }

      if (typeof raw === "string") {
        const num = parseNumber(raw);
        if (num === null) continue;
        if (def.type === "percent" && (num < 0 || num > 100)) continue;
        if (def.type === "number" && num < 0) continue;
        next[partyName] = setPartyField(next[partyName], field, num);
      }
      continue;
    }

    const label = key;
    const text = typeof raw === "string" ? raw.trim() : "";
    if (!text) continue;

    if (label.toLowerCase().includes("buyer credit")) {
      next.buyer = { ...next.buyer, creditRating: text };
    }
  }

  return next;
}
