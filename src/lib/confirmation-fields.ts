import type { CounterpartyInput, Deal } from "../types";
import type { DealPurpose } from "./transaction-structure/types";
import {
  getDealTransactionStructure,
  inferStructureFromDeal,
  structureFieldLabels,
} from "./transaction-structure/infer-from-deal";
import { isStructureFieldUndisclosed } from "./transaction-structure/scoring";

export type CounterpartyConfirmationFieldId =
  | "buyer.yearsInBusiness"
  | "buyer.licenseValid"
  | "buyer.platformCompletionRate"
  | "buyer.avgPaymentDelayDays"
  | "supplier.yearsInBusiness"
  | "supplier.licenseValid"
  | "supplier.platformCompletionRate"
  | "supplier.qualityRejectionRatePct";

export type StructureConfirmationFieldId =
  | "structure.purchaseTotalUSD"
  | "structure.saleTotalUSD"
  | "structure.supAdvDay"
  | "structure.supAdvPct"
  | "structure.supFinDay"
  | "structure.supFinPct"
  | "structure.buyFirstDay"
  | "structure.buyFirstPct"
  | "structure.buyFinalDay"
  | "structure.buyFinalPct"
  | "structure.dealPurpose"
  | "structure.tmProductOwnership"
  | "structure.collectionRights";

export type ConfirmationFieldId =
  | CounterpartyConfirmationFieldId
  | StructureConfirmationFieldId;

export type ConfirmationFieldType =
  | "number"
  | "percent"
  | "boolean"
  | "text"
  | "select";

export interface ScoringConfirmationField {
  kind: "scoring";
  id: ConfirmationFieldId;
  label: string;
  type: ConfirmationFieldType;
  placeholder?: string;
  suffix?: string;
  section: "counterparty" | "structure";
  options?: Array<{ value: string; label: string }>;
  helpText?: string;
}

export interface FreeTextConfirmationField {
  kind: "freeText";
  key: string;
  label: string;
  placeholder?: string;
  section: "counterparty" | "structure" | "other";
}

export type ConfirmationField = ScoringConfirmationField | FreeTextConfirmationField;

const DEAL_PURPOSE_OPTIONS: Array<{ value: DealPurpose; label: string }> = [
  { value: "Export", label: "Export" },
  { value: "Retail", label: "Retail" },
  { value: "Processing", label: "Processing" },
  { value: "Resale", label: "Resale" },
];

const COUNTERPARTY_FIELD_DEFS: ScoringConfirmationField[] = [
  {
    kind: "scoring",
    id: "buyer.yearsInBusiness",
    label: "Buyer years in business",
    type: "number",
    placeholder: "e.g. 8",
    suffix: "years",
    section: "counterparty",
  },
  {
    kind: "scoring",
    id: "buyer.platformCompletionRate",
    label: "Buyer platform completion rate",
    type: "percent",
    placeholder: "e.g. 85",
    suffix: "%",
    section: "counterparty",
  },
  {
    kind: "scoring",
    id: "buyer.avgPaymentDelayDays",
    label: "Buyer avg payment delay",
    type: "number",
    placeholder: "e.g. 5",
    suffix: "days",
    section: "counterparty",
  },
  {
    kind: "scoring",
    id: "supplier.yearsInBusiness",
    label: "Supplier years in business",
    type: "number",
    placeholder: "e.g. 12",
    suffix: "years",
    section: "counterparty",
  },
  {
    kind: "scoring",
    id: "supplier.platformCompletionRate",
    label: "Supplier platform completion rate",
    type: "percent",
    placeholder: "e.g. 92",
    suffix: "%",
    section: "counterparty",
  },
  {
    kind: "scoring",
    id: "supplier.qualityRejectionRatePct",
    label: "Supplier quality rejection rate",
    type: "percent",
    placeholder: "e.g. 2",
    suffix: "%",
    section: "counterparty",
  },
];

function structureFieldDef(
  key: keyof ReturnType<typeof getDealTransactionStructure>,
  type: ConfirmationFieldType,
  extra?: Partial<ScoringConfirmationField>,
): ScoringConfirmationField {
  const labels = structureFieldLabels();
  return {
    kind: "scoring",
    id: `structure.${key}` as StructureConfirmationFieldId,
    label: labels[key],
    type,
    section: "structure",
    ...extra,
  };
}

const STRUCTURE_FIELD_DEFS: ScoringConfirmationField[] = [
  structureFieldDef("purchaseTotalUSD", "number", {
    placeholder: "e.g. 30881.50",
    suffix: "USD",
    helpText:
      "Filled from purchase order / supplier contract when detected; confirm if missing",
  }),
  structureFieldDef("saleTotalUSD", "number", {
    placeholder: "e.g. 35419.20",
    suffix: "USD",
    helpText: "Total collected from buyer (may differ from headline deal value)",
  }),
  structureFieldDef("supAdvDay", "number", {
    placeholder: "0",
    suffix: "days",
    helpText: "Day offset for supplier advance (0 = at contract)",
  }),
  structureFieldDef("supAdvPct", "percent", {
    placeholder: "e.g. 60",
    suffix: "%",
    helpText: "% of purchase paid to supplier in advance",
  }),
  structureFieldDef("supFinDay", "number", {
    placeholder: "e.g. 7",
    suffix: "days",
  }),
  structureFieldDef("supFinPct", "percent", {
    placeholder: "e.g. 40",
    suffix: "%",
  }),
  structureFieldDef("buyFirstDay", "number", {
    placeholder: "e.g. 7",
    suffix: "days",
    helpText: "First buyer payment — often against BL/docs",
  }),
  structureFieldDef("buyFirstPct", "percent", {
    placeholder: "e.g. 60",
    suffix: "%",
  }),
  structureFieldDef("buyFinalDay", "number", {
    placeholder: "e.g. 32",
    suffix: "days",
    helpText: "Final buyer payment — often days after arrival",
  }),
  structureFieldDef("buyFinalPct", "percent", {
    placeholder: "e.g. 40",
    suffix: "%",
  }),
  structureFieldDef("dealPurpose", "select", {
    options: DEAL_PURPOSE_OPTIONS,
    helpText: "Export is typical for cross-border agro trades",
  }),
];

const SCORING_FIELD_DEFS: ScoringConfirmationField[] = [
  ...COUNTERPARTY_FIELD_DEFS,
  ...STRUCTURE_FIELD_DEFS,
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

function isCounterpartyUndisclosed(
  deal: Deal,
  id: CounterpartyConfirmationFieldId,
): boolean {
  const [party, field] = id.split(".") as ["buyer" | "supplier", string];
  const counterparty = getParty(deal, party);
  const value = counterparty[field as keyof CounterpartyInput];
  return value === null || value === undefined;
}

function isStructureUndisclosed(
  deal: Deal,
  id: StructureConfirmationFieldId,
): boolean {
  const field = id.replace("structure.", "") as keyof ReturnType<
    typeof getDealTransactionStructure
  >;
  return isStructureFieldUndisclosed(deal, field);
}

export function listConfirmationFields(deal: Deal): ConfirmationField[] {
  const scoring = SCORING_FIELD_DEFS.filter((def) => {
    if (def.section === "counterparty") {
      return isCounterpartyUndisclosed(
        deal,
        def.id as CounterpartyConfirmationFieldId,
      );
    }
    return isStructureUndisclosed(deal, def.id as StructureConfirmationFieldId);
  });

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
      section: "other",
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

function setStructureField(
  deal: Deal,
  field: string,
  value: number | boolean | DealPurpose,
): Deal {
  const current = inferStructureFromDeal(deal);
  return {
    ...deal,
    transactionStructure: {
      ...current,
      [field]: value,
    },
  };
}

export function applyConfirmations(
  deal: Deal,
  values: ConfirmationValues,
): Deal {
  let next: Deal = {
    ...deal,
    buyer: { ...deal.buyer },
    supplier: { ...deal.supplier },
  };

  for (const [key, raw] of Object.entries(values)) {
    if (raw === "" || raw === null || raw === undefined) continue;

    if (key.startsWith("structure.")) {
      const field = key.slice("structure.".length);
      const def = STRUCTURE_FIELD_DEFS.find((item) => item.id === key);
      if (!def) continue;

      if (def.type === "boolean" && typeof raw === "boolean") {
        next = setStructureField(next, field, raw);
        continue;
      }

      if (def.type === "select" && typeof raw === "string") {
        next = setStructureField(next, field, raw as DealPurpose);
        continue;
      }

      if (typeof raw === "string") {
        const num = parseNumber(raw);
        if (num === null) continue;
        if (def.type === "percent" && (num < 0 || num > 100)) continue;
        if (def.type === "number" && num < 0) continue;
        next = setStructureField(next, field, num);
      }
      continue;
    }

    if (key.startsWith("buyer.") || key.startsWith("supplier.")) {
      const id = key as CounterpartyConfirmationFieldId;
      const [partyName, field] = id.split(".") as ["buyer" | "supplier", string];
      const def = COUNTERPARTY_FIELD_DEFS.find((item) => item.id === id);
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
