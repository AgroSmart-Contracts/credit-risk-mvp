/**
 * Price-vs-market benchmark — spec §4.B "Price vs market" (30% of Product weight,
 * called out in §3 as "the single highest-signal fraud variable").
 *
 * Rebuild 2026-07-30: product risk now keys primarily off the deal's
 * `offerUnitPriceUSD` versus the usual unit price for that product on the
 * same origin→destination corridor in the shipment-start month.
 *
 * Usual-price sources (see product-price-month-route.ts):
 *   1. Peru customs FOB P50 (product × route × month)
 *   2. docs/product-price-avg-with-spread-by-month-route-2026-07-28.csv
 *   3. docs/product-price-with-transport-mode-2026-07-29.csv
 *   4. fallback: market-intel adaptive-window dim_b_price_benchmark
 *
 * Direction: MONOTONIC. Paying meaningfully MORE than the usual rate for this
 * product / month / route raises product risk (lower score). At or below usual
 * is not penalized.
 *
 * DEAL_VALUE_MARKUP_RATIO — when the usual price is customs FOB, the deal's
 * offerUnitPrice still embeds the financed-transaction markup (~1.63× FOB,
 * from 4 DUA-matched ground-truth deals). Deflate before comparing to customs.
 * Platform-sheet usual prices are already on the deflated/FOB-like scale (their
 * own notes document the 1.5× raw ratio), so the same deflation applies.
 */
import type { Deal } from "../types";
import { dealPricePerKg } from "./market-intel/deal-params";
import {
  lookupUsualUnitPrice,
  shipmentMonthFromDate,
  type UsualPriceMatch,
} from "./product-price-month-route";

export const DEAL_VALUE_MARKUP_RATIO = 1.628;

/** Removes the structural dealValue/offerUnitPrice-vs-FOB markup. */
export function deflateForDealValueMarkup(rawPct: number): number {
  return ((1 + rawPct / 100) / DEAL_VALUE_MARKUP_RATIO - 1) * 100;
}

export interface PriceVsMarketDetail {
  pts: number;
  dealUnitPriceUSD: number | null;
  usualUsdPerKg: number | null;
  rawPctOverUsual: number | null;
  deflatedPctOverUsual: number | null;
  match: UsualPriceMatch | null;
  fallback: "month-route" | "market-intel" | "none";
}

/**
 * Deal unit price in USD/kg for comparison to customs FOB and the month-route
 * sheets. Prefer `dealValue / netKg` (presentation-aware) over raw
 * `offerUnitPriceUSD`, which is a per-carton/pack figure on the platform CSV
 * (e.g. $15.64 per 1.5kg carton = $10.43/kg — comparing the carton price to
 * customs $/kg was what put 125/169 deals into the severe band).
 */
function dealUnitPricePerKg(deal: Deal): number | null {
  const fromQty = dealPricePerKg(deal);
  if (fromQty != null && fromQty > 0) return fromQty;

  // Last resorts: market-intel extracted price, then raw offer (may be pack-priced).
  const bench = deal.marketIntel?.dim_b_price_benchmark;
  if (bench && !("status" in bench) && bench.deal_price_usd_per_kg != null) {
    return bench.deal_price_usd_per_kg;
  }
  if (deal.offerUnitPriceUSD != null && deal.offerUnitPriceUSD > 0) {
    return deal.offerUnitPriceUSD;
  }
  return null;
}

function bandPoints(deflatedPct: number): number {
  // Higher than usual → higher product risk (lower score).
  // Under-usual windfall capped at +10 (was +20) so "at market" does not look A+.
  if (deflatedPct <= 15) return 10;
  if (deflatedPct <= 30) return 0;
  if (deflatedPct <= 100) return -22;
  return -35; // severe over-usual for the month/route
}

/**
 * Points contribution to Dimension B from price-vs-usual (month × route).
 * Prefer offerUnitPriceUSD + shippingStartDate against the month-route table;
 * fall back to market-intel's adaptive window when no month-route usual exists.
 */
export function priceVsMarketPoints(deal: Deal): number {
  return priceVsMarketDetail(deal).pts;
}

export function priceVsMarketDetail(deal: Deal): PriceVsMarketDetail {
  const unit = dealUnitPricePerKg(deal);
  const month =
    shipmentMonthFromDate(deal.shippingStartDate) ??
    shipmentMonthFromDate(deal.createdAt ?? null);

  if (unit != null && month) {
    const match = lookupUsualUnitPrice({
      product: deal.product,
      origin: deal.origin,
      destination: deal.destination,
      shipmentMonth: month,
      transportMode: deal.transportMode,
      hsCode: deal.hsCode,
    });
    if (match) {
      const rawPct = ((unit - match.usualUsdPerKg) / match.usualUsdPerKg) * 100;
      // Customs usual = true FOB $/kg; deal $/kg still embeds the financed
      // markup → deflate. Platform-sheet usual prices are already on the same
      // platform $/kg scale as dealValue/kg (often literally the same deals),
      // so do not deflate against them or exact matches look "under market".
      const deflatedPct =
        match.source === "customs" ? deflateForDealValueMarkup(rawPct) : rawPct;
      return {
        pts: bandPoints(deflatedPct),
        dealUnitPriceUSD: unit,
        usualUsdPerKg: match.usualUsdPerKg,
        rawPctOverUsual: Math.round(rawPct * 100) / 100,
        deflatedPctOverUsual: Math.round(deflatedPct * 100) / 100,
        match,
        fallback: "month-route",
      };
    }
  }

  // Fallback: market-intel adaptive window (already persisted on the deal).
  const benchmark = deal.marketIntel?.dim_b_price_benchmark;
  if (!benchmark || "status" in benchmark) {
    return {
      pts: 0,
      dealUnitPriceUSD: unit,
      usualUsdPerKg: null,
      rawPctOverUsual: null,
      deflatedPctOverUsual: null,
      match: null,
      fallback: "none",
    };
  }
  const rawPct = benchmark.deal_vs_p50_pct;
  if (rawPct === null || rawPct === undefined) {
    return {
      pts: 0,
      dealUnitPriceUSD: unit,
      usualUsdPerKg: benchmark.p50 ?? null,
      rawPctOverUsual: null,
      deflatedPctOverUsual: null,
      match: null,
      fallback: "market-intel",
    };
  }
  const deflatedPct = deflateForDealValueMarkup(rawPct);
  return {
    pts: bandPoints(deflatedPct),
    dealUnitPriceUSD: unit,
    usualUsdPerKg: benchmark.p50 ?? null,
    rawPctOverUsual: rawPct,
    deflatedPctOverUsual: Math.round(deflatedPct * 100) / 100,
    match: null,
    fallback: "market-intel",
  };
}
