/**
 * CRAM Table 1 — Product table (dimension B inputs).
 * Source: tm-cram-reference-tables-2026-07.md
 *
 * Perishability points per spec §4.B:
 * Non-perishable +18 · Semi (+30d) +9 · Perishable (7–30d) −4 · Ultra (<7d) −12
 */
import { CRAM_REFERENCE_TABLES_VERSION } from "./cram-reference-version";

export type PerishabilityClass =
  | "Ultra-Perishable"
  | "Perishable"
  | "Semi-Perishable"
  | "Non-Perishable";

export type AcRiskGroup = 1 | 2 | 3 | 4;

export interface ProductRiskEntry {
  product: string;
  acRiskGroup: AcRiskGroup;
  perishabilityClass: PerishabilityClass;
  /** CRAM dimension-B perishability points */
  perishabilityPoints: number;
  shelfLifeDaysMin: number | null;
  shelfLifeDaysMax: number | null;
  gradeStandard: string;
  eudrRequired: boolean;
  keyVarieties: string[];
  /** Display score for UI (derived from CRAM attributes, 0–100 higher = safer) */
  baseScore: number;
  notes?: string;
}

export const PRODUCT_TABLE_VERSION = CRAM_REFERENCE_TABLES_VERSION;

export const PERISHABILITY_POINTS: Record<PerishabilityClass, number> = {
  "Non-Perishable": 18,
  "Semi-Perishable": 9,
  Perishable: -4,
  "Ultra-Perishable": -12,
};

function deriveProductBaseScore(
  perishabilityPoints: number,
  acRiskGroup: AcRiskGroup,
): number {
  // Neutral 70 + perishability term; group encodes price/claims volatility (not double-counted in perishability)
  const groupAdj = (4 - acRiskGroup) * 4;
  return Math.min(95, Math.max(35, Math.round(70 + perishabilityPoints + groupAdj)));
}

export const PRODUCT_RISK_TABLE: ProductRiskEntry[] = [
  {
    product: "Asparagus",
    acRiskGroup: 1,
    perishabilityClass: "Ultra-Perishable",
    perishabilityPoints: -12,
    shelfLifeDaysMin: 10,
    shelfLifeDaysMax: 21,
    gradeStandard: "Cat I/II + caliber",
    eudrRequired: false,
    keyVarieties: ["Green (UC-157)", "White"],
    baseScore: deriveProductBaseScore(-12, 1),
    notes: "Air-fresh trade norm; tip decay sensitivity",
  },
  {
    product: "Grapes",
    acRiskGroup: 1,
    perishabilityClass: "Perishable",
    perishabilityPoints: -4,
    shelfLifeDaysMin: 30,
    shelfLifeDaysMax: 60,
    gradeStandard: "Cat I/II + caliber/brix",
    eudrRequired: false,
    keyVarieties: ["Red Globe", "Sweet Globe", "Crimson", "Allison"],
    baseScore: deriveProductBaseScore(-4, 1),
    notes: "SO₂/CA extends shelf life; cold treatment PE→China",
  },
  {
    product: "Blueberries",
    acRiskGroup: 1,
    perishabilityClass: "Perishable",
    perishabilityPoints: -4,
    shelfLifeDaysMin: 30,
    shelfLifeDaysMax: 45,
    gradeStandard: "Class I",
    eudrRequired: false,
    keyVarieties: ["Ventura", "Biloxi", "Sekoya"],
    baseScore: deriveProductBaseScore(-4, 1),
    notes: "Fruit-fly protocol PE→USA; MRL sensitivity EU",
  },
  {
    product: "Avocado",
    acRiskGroup: 2,
    perishabilityClass: "Perishable",
    perishabilityPoints: -4,
    shelfLifeDaysMin: 25,
    shelfLifeDaysMax: 35,
    gradeStandard: "Cat I/II + caliber + dry-matter %",
    eudrRequired: false,
    keyVarieties: ["Hass"],
    baseScore: deriveProductBaseScore(-4, 2),
    notes: "Dry-matter minimums per market; ripening curve risk",
  },
  {
    product: "Mandarin",
    acRiskGroup: 3,
    perishabilityClass: "Perishable",
    perishabilityPoints: -4,
    shelfLifeDaysMin: 30,
    shelfLifeDaysMax: 60,
    gradeStandard: "CAT 1 (Class I)",
    eudrRequired: false,
    keyVarieties: ["W. Murcott", "Tango"],
    baseScore: deriveProductBaseScore(-4, 3),
    notes: "TM-2026-012 corridor; cold treatment PE→USA",
  },
  {
    product: "Ginger",
    acRiskGroup: 3,
    perishabilityClass: "Semi-Perishable",
    perishabilityPoints: 9,
    shelfLifeDaysMin: 60,
    shelfLifeDaysMax: 120,
    gradeStandard: "Grade by size/cleanliness",
    eudrRequired: false,
    keyVarieties: ["Kion (yellow)"],
    baseScore: deriveProductBaseScore(9, 3),
    notes: "Ambient-tolerant; deep spot market",
  },
  {
    product: "Coffee",
    acRiskGroup: 4,
    perishabilityClass: "Non-Perishable",
    perishabilityPoints: 18,
    shelfLifeDaysMin: 365,
    shelfLifeDaysMax: null,
    gradeStandard: "SCA cup score / export grades",
    eudrRequired: true,
    keyVarieties: ["Arabica (Cajamarca, Junín)"],
    baseScore: deriveProductBaseScore(18, 4),
    notes: "Dry container; EUDR DDS required for EU",
  },
  {
    product: "Cacao",
    acRiskGroup: 4,
    perishabilityClass: "Non-Perishable",
    perishabilityPoints: 18,
    shelfLifeDaysMin: 180,
    shelfLifeDaysMax: 365,
    gradeStandard: "Fermentation % / bean count / fino grade",
    eudrRequired: true,
    keyVarieties: ["CCN-51", "Criollo/fino de aroma"],
    baseScore: deriveProductBaseScore(18, 4),
    notes: "Dry container; EUDR DDS required for EU",
  },
];

const DEFAULT_PRODUCT_SCORE = 50;

function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^fresh\s+/i, "")
    .trim();
}

export function lookupProductRisk(productName: string): ProductRiskEntry | null {
  const normalized = normalizeProductName(productName);
  return (
    PRODUCT_RISK_TABLE.find(
      (entry) =>
        normalizeProductName(entry.product) === normalized ||
        normalized.includes(normalizeProductName(entry.product)),
    ) ?? null
  );
}

export function getProductBaseScore(productName: string): number {
  return lookupProductRisk(productName)?.baseScore ?? DEFAULT_PRODUCT_SCORE;
}

export function getPerishabilityPoints(productName: string): number {
  const entry = lookupProductRisk(productName);
  if (!entry) return PERISHABILITY_POINTS.Perishable;
  return entry.perishabilityPoints;
}

export function isEudrRequired(productName: string): boolean {
  return lookupProductRisk(productName)?.eudrRequired ?? false;
}

export const PRODUCT_OPTIONS = PRODUCT_RISK_TABLE.map((e) => e.product);
