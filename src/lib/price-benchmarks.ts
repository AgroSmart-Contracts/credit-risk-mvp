/**
 * Price-vs-market benchmark — spec §4.B "Price vs market" (30% of Product weight,
 * called out in §3 as "the single highest-signal fraud variable"). Was entirely
 * unimplemented before 2026-07-24 — the static product-risk-tables.ts score has no
 * per-deal price signal at all.
 *
 * Only one product has a real benchmark: `docs/pricing-intelligence.xlsx` is a
 * 2025 Peru customs export dataset (36,288 real declarations, tariff code
 * 0810400000 — fresh blueberries only) with a real `US$ FOB UNIT` column. The
 * benchmark below is the median USD/kg computed from that file (rows with
 * UNIDAD MEDIDA = KILOGRAMO, price 0.5–50 USD/kg to exclude data-entry errors):
 * n=35,491, median $5.56/kg, P25 $4.17, P75 $7.64, P10 $2.10, P90 $9.28.
 *
 * No benchmark exists for the other 11 products — fabricating one would mean
 * presenting invented market data as real, so `priceVsMarketPoints` returns 0
 * (neutral) for anything not in this table, exactly like the other NEEDS_DATA
 * spec variables in scoring.ts.
 */

export interface PriceBenchmark {
  product: string;
  medianUsdPerUnit: number;
  source: string;
  scoreConfirmed: boolean;
}

export const PRICE_BENCHMARKS: PriceBenchmark[] = [
  {
    product: "Fresh Blueberries",
    medianUsdPerUnit: 5.56,
    source:
      "docs/pricing-intelligence.xlsx — Peru 2025 customs exports, tariff 0810400000, n=35,491, median USD/kg",
    scoreConfirmed: true,
  },
];

function normalizeProductName(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function lookupPriceBenchmark(product: string): PriceBenchmark | null {
  const normalized = normalizeProductName(product);
  return (
    PRICE_BENCHMARKS.find((b) => normalizeProductName(b.product) === normalized) ?? null
  );
}

/**
 * spec §4.B: within ±5–15% +20 / >+30% −22 / <−30% −18. Spec's "±5–15%" band is
 * read here as "within ±15% of benchmark" (the safe zone); the 15–30% band either
 * side has no explicit spec rule, so it's treated as neutral (0) rather than
 * guessed at.
 */
export function priceVsMarketPoints(product: string, offerUnitPriceUSD: number | null): number {
  if (offerUnitPriceUSD === null || offerUnitPriceUSD <= 0) return 0;
  const benchmark = lookupPriceBenchmark(product);
  if (!benchmark) return 0; // neutral — no benchmark data for this product
  const deviationPct =
    ((offerUnitPriceUSD - benchmark.medianUsdPerUnit) / benchmark.medianUsdPerUnit) * 100;
  if (Math.abs(deviationPct) <= 15) return 20;
  if (deviationPct > 30) return -22;
  if (deviationPct < -30) return -18;
  return 0;
}
