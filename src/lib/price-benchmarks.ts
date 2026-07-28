/**
 * Price-vs-market benchmark — spec §4.B "Price vs market" (30% of Product weight,
 * called out in §3 as "the single highest-signal fraud variable").
 *
 * Rebuilt 2026-07-28 to read the real market-intel price benchmark
 * (`deal.marketIntel.dim_b_price_benchmark`, from
 * `docs/market-intel-peru-2025-2026-07-10`'s `price_benchmark()` — kg-weighted
 * P10–P90 percentiles per (variety × destination × adaptive time window),
 * backed by 60,466 real Peru customs shipment records) instead of the prior
 * single hardcoded per-product median. That data was already computed and
 * persisted onto every deal record at build time (see
 * scripts/lib/market-intel-cli.ts) but never read by scoring — this wires it
 * in. Covers blueberry/mango/avocado/strawberry/tropical varieties; still
 * returns neutral for products with no customs HS data ingested at all
 * (mandarin, ginger, asparagus) or no resolvable benchmark (`NEEDS_INPUT`,
 * missing p50, or no deal price extracted).
 *
 * Direction, per explicit decision: MONOTONIC, not symmetric. TruMarket is
 * the investor/financer side of these deals — paying meaningfully MORE than
 * the real going rate for this product on this corridor is the actual risk
 * (overpaying erodes margin and resale value); paying at or below the going
 * rate is not penalized. This intentionally reverses the pre-2026-07-28
 * version, which also penalized suspiciously-low prices (a fraud-detection
 * read on "too cheap to be real"). If that read is wanted again later, it's
 * a one-line change back to a symmetric band using the same
 * `deal_vs_p50_pct` value.
 */
import type { Deal } from "../types";

/**
 * spec §4.B bands, reinterpreted monotonically: at/below +15% over median
 * (i.e. anything at or below market, or only slightly over) is the safe
 * zone (+20, same magnitude as the original spec's ±15% safe band); 15–30%
 * over has no explicit spec rule (neutral, 0); >30% over is the spec's
 * over-market penalty (−22). No penalty is ever applied for being cheap.
 */
export function priceVsMarketPoints(deal: Deal): number {
  const benchmark = deal.marketIntel?.dim_b_price_benchmark;
  if (!benchmark || "status" in benchmark) return 0; // no market-intel, or NEEDS_INPUT (too few shipments even variety-only)
  const pct = benchmark.deal_vs_p50_pct;
  if (pct === null || pct === undefined) return 0; // benchmark resolved but no deal price could be extracted to compare
  if (pct <= 15) return 20;
  if (pct <= 30) return 0;
  return -22;
}
