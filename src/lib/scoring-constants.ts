/**
 * Dimension weights — synced to tm-cram-engine-spec-2026-06.md §2
 * Composite = A(Counterparty)×0.40 + B(Product)×0.25 + C(Route)×0.20 + D(Structure)×0.15
 * Post-harvest mode only; a pre-season variant with different weights is out of scope for now.
 */
export const DIMENSION_WEIGHTS = {
  counterparty: 0.4,
  product: 0.25,
  route: 0.2,
  structure: 0.15,
} as const;

export const DIMENSION_LABELS = {
  counterparty: {
    title: "Counterparty Risk",
    description:
      "Buyer & supplier creditworthiness, platform history, relationship depth",
  },
  product: {
    title: "Product Risk",
    description:
      "Perishability, cold chain, quality grade, handling requirements",
  },
  route: {
    title: "Trade Route Risk",
    description: "Transit time, transshipments, incoterms, geographic risk",
  },
  structure: {
    title: "Transaction Structure Risk",
    description:
      "Payment terms, advance, collateral, insurance, deal sizing",
  },
} as const;
