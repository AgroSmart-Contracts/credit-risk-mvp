/** Dimension weights per banking framework — counterparty is primary default driver */
export const DIMENSION_WEIGHTS = {
  counterparty: 0.35,
  product: 0.2,
  route: 0.15,
  structure: 0.3,
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
