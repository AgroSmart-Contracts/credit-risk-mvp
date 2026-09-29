/**
 * Product attribute catalog (CRAM Table 1 inputs): perishability, shelf life,
 * cold chain, AC group. The `.score` field is a legacy baked value and is **not**
 * used by `computeProductScore` — Dimension B is unit price vs usual only.
 */
import type { ProductRiskProfile } from "../types";
import { resolveHsProduct } from "./hs-product-map";

export type PerishabilityClass = ProductRiskProfile["perishabilityClass"];

export const PRODUCT_RISK_TABLE: ProductRiskProfile[] = [
  {
    product: "Fresh Avocado",
    score: 82,
    acRiskGroup: 2,
    productCategory: "Fresh Produce",
    perishabilityClass: "Perishable",
    shelfLifeDays: 35,
    coldChainRequired: true,
    rationale: "Durable fresh export with strong resale liquidity across core markets.",
    scoreConfirmed: true,
  },
  {
    product: "Fresh Mandarin",
    score: 68,
    acRiskGroup: 3,
    productCategory: "Fresh Produce",
    perishabilityClass: "Semi-Perishable",
    shelfLifeDays: 30,
    coldChainRequired: true,
    rationale: "Moderate perishability; sensitive to handling and market timing.",
    scoreConfirmed: true,
  },
  {
    product: "Fresh Blueberries",
    score: 42,
    acRiskGroup: 1,
    productCategory: "Fresh Produce",
    perishabilityClass: "Ultra-Perishable",
    shelfLifeDays: 21,
    coldChainRequired: true,
    rationale: "High claim frequency on long-haul routes and narrow freshness window.",
    scoreConfirmed: true,
  },
  {
    product: "Fresh Strawberries",
    score: 28,
    acRiskGroup: 1,
    productCategory: "Fresh Produce",
    perishabilityClass: "Ultra-Perishable",
    shelfLifeDays: 7,
    coldChainRequired: true,
    rationale: "Very short shelf life and extreme cold-chain dependency.",
    scoreConfirmed: true,
  },
  {
    product: "Fresh Grapes",
    score: 64,
    acRiskGroup: 1,
    productCategory: "Fresh Produce",
    perishabilityClass: "Perishable",
    shelfLifeDays: 28,
    coldChainRequired: true,
    rationale: "Reasonable shelf life, but quality degradation and rejection risk remain meaningful.",
    scoreConfirmed: true,
  },
  {
    product: "Fresh Ginger",
    score: 88,
    acRiskGroup: 3,
    productCategory: "Fresh Produce",
    perishabilityClass: "Semi-Perishable",
    shelfLifeDays: 60,
    coldChainRequired: false,
    rationale: "Semi-perishable profile with resilient logistics and broad secondary demand.",
    scoreConfirmed: true,
  },
  {
    product: "Green Coffee",
    score: 94,
    acRiskGroup: 4,
    productCategory: "Dried",
    perishabilityClass: "Non-Perishable",
    shelfLifeDays: null,
    coldChainRequired: false,
    rationale: "Stable dry cargo with deep export markets and limited spoilage risk.",
    scoreConfirmed: true,
  },
  {
    product: "Cacao Beans",
    score: 92,
    acRiskGroup: 4,
    productCategory: "Dried",
    perishabilityClass: "Non-Perishable",
    shelfLifeDays: null,
    coldChainRequired: false,
    rationale: "Low physical-loss profile when stored correctly; risk is mostly documentary/compliance.",
    scoreConfirmed: true,
  },

  // --- Added 2026-07-24: products present in the real deal book (full-deals-dataset-2026-07 (1).csv)
  // with no prior table row. Scores are provisional fallbacks (perishability-bucket estimate from
  // scoring.ts's own fallback formula), not AC-confirmed — see docs/product-route-table-gaps-2026-07.md.

  {
    product: "Fresh Asparagus",
    score: 38,
    acRiskGroup: 1,
    productCategory: "Fresh Produce",
    perishabilityClass: "Ultra-Perishable",
    shelfLifeDays: 14,
    coldChainRequired: true,
    rationale:
      "Provisional — tm-cram-reference-tables-2026-07.md Table 1 lists asparagus as Group 1 with a NEEDS_CONFIRM ❓ on Ultra vs Perishable (air-fresh trade is most time-critical of the fresh categories; ~10–21d shelf life at 2°C, high rejection sensitivity to tip decay/dehydration). Score is the Ultra-Perishable fallback bucket pending AC confirmation.",
    scoreConfirmed: false,
  },
  {
    product: "Fresh Mango",
    score: 55,
    productCategory: "Fresh Produce",
    perishabilityClass: "Perishable",
    shelfLifeDays: 21,
    coldChainRequired: true,
    rationale:
      "Provisional — Mango does not appear in tm-cram-reference-tables-2026-07.md Table 1 at all (only asparagus, grapes, blueberries, avocado, mandarin, ginger, coffee, cacao are tabled). Score is the generic Perishable fallback bucket; no AC-reviewed source exists yet. Only 1 real deal in the book depends on this row (Kuba / MCORP, Poland).",
    scoreConfirmed: false,
  },
  {
    product: "Mixed Berries / Tropical Fruits (IQF)",
    score: 60,
    productCategory: "Frozen",
    perishabilityClass: "Semi-Perishable",
    shelfLifeDays: 365,
    coldChainRequired: true,
    rationale:
      "Provisional — IQF (individually quick-frozen) mango/pineapple/passion fruit blends are not a tracked Nectora product and not in CRAM Table 1. product-details-2026-07-22.csv confirms Nectora has no comparable product line. Frozen state materially extends shelf life vs. fresh, but resale/claims behavior on rejection is unverified — treat as Semi-Perishable pending a real review, not Non-Perishable.",
    scoreConfirmed: false,
  },
  {
    product: "Frozen Tropical Fruits",
    score: 60,
    productCategory: "Frozen",
    perishabilityClass: "Semi-Perishable",
    shelfLifeDays: 365,
    coldChainRequired: true,
    rationale:
      "Provisional — same gap as Mixed Berries/Tropical (IQF): no Nectora product line, no CRAM Table 1 row. Backs 1 deal in the book (Industrias Solimar SAC → Juhinej Ltd, flagged likely_test/synthetic — merged into scoring like every other deal per decision 2026-07-28) — kept as a table row so a deal of this type isn't silently unscored, but there's nothing yet to validate the score against.",
    scoreConfirmed: false,
  },
];

export const PRODUCT_OPTIONS = PRODUCT_RISK_TABLE.map((entry) => entry.product);

function normalizeProductName(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function lookupProductRisk(
  product: string,
  hsCode?: string | null,
): ProductRiskProfile | null {
  // Prefer HS identity when present — commodity is tariff-defined.
  const fromHs = resolveHsProduct({ hsCode: hsCode ?? null, product });
  const label = fromHs?.product ?? product;
  const normalized = normalizeProductName(label);
  return (
    PRODUCT_RISK_TABLE.find(
      (entry) => normalizeProductName(entry.product) === normalized,
    ) ?? null
  );
}
