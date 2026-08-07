/**
 * Price-vs-market benchmark — spec §4.B "Price vs market" (30% of Product weight,
 * called out in §3 as "the single highest-signal fraud variable").
 *
 * Rebuild 2026-07-30: product risk now keys primarily off the deal's
 * unit $/kg versus the usual unit price for that product on the
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
 * $/kg still embeds the financed-transaction markup (~1.63× FOB,
 * from 4 DUA-matched ground-truth deals). Deflate before comparing to customs.
 * Platform-sheet usual prices are already on the deal $/kg scale.
 */
import type { Deal } from "../types";
import { dealPricePerKg } from "./market-intel/deal-params";
import {
  lookupUsualUnitPrice,
  shipmentMonthFromDate,
  type UsualPriceMatch,
} from "./product-price-month-route";

export const DEAL_VALUE_MARKUP_RATIO = 1.628;

/** ±15% of usual is the Dimension B "safe" band (full +20 pts). */
export const PRICE_SAFE_BAND_PCT = 15;

export const PRICE_UNIT = "USD/kg" as const;

/** Removes the structural dealValue/offerUnitPrice-vs-FOB markup. */
export function deflateForDealValueMarkup(rawPct: number): number {
  return ((1 + rawPct / 100) / DEAL_VALUE_MARKUP_RATIO - 1) * 100;
}

export interface PriceVsMarketDetail {
  pts: number;
  /** Always USD per kg for comparisons. */
  priceUnit: typeof PRICE_UNIT;
  dealUnitPriceUSD: number | null;
  usualUsdPerKg: number | null;
  /** Observed or score-band safe range low. */
  safeMinUsdPerKg: number | null;
  /** Observed or score-band safe range high. */
  safeMaxUsdPerKg: number | null;
  /** Human range, e.g. "$2.82 – $2.89" or sheet display. */
  safeRangeDisplay: string | null;
  /** "observed" from sheet min/max; "score-band" = usual ±15%; null if no usual. */
  safeRangeSource: "observed" | "score-band" | null;
  rawPctOverUsual: number | null;
  deflatedPctOverUsual: number | null;
  match: UsualPriceMatch | null;
  fallback: "month-route" | "market-intel" | "none";
}

/**
 * Deal unit price in USD/kg for comparison to customs FOB and the month-route
 * sheets. Prefer `dealValue / netKg` (presentation-aware) over raw
 * `offerUnitPriceUSD`, which is a per-carton/pack figure on the platform CSV.
 */
function dealUnitPricePerKg(deal: Deal): number | null {
  const fromQty = dealPricePerKg(deal);
  if (fromQty != null && fromQty > 0) return fromQty;

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
  if (deflatedPct <= PRICE_SAFE_BAND_PCT) return 20;
  if (deflatedPct <= 30) return 0;
  if (deflatedPct <= 100) return -22;
  return -35;
}

function formatUsdKg(n: number): string {
  return `$${n.toFixed(2)}`;
}

function safeRangeFromUsual(
  usual: number,
  match: UsualPriceMatch | null,
): Pick<
  PriceVsMarketDetail,
  "safeMinUsdPerKg" | "safeMaxUsdPerKg" | "safeRangeDisplay" | "safeRangeSource"
> {
  const observedMin = match?.minUsdPerKg;
  const observedMax = match?.maxUsdPerKg;
  const hasRealSpread =
    observedMin != null &&
    observedMax != null &&
    observedMin > 0 &&
    observedMax > 0 &&
    // Single-observation rows store min === max — not a usable range.
    Math.abs(observedMax - observedMin) > 1e-9;

  if (hasRealSpread) {
    return {
      safeMinUsdPerKg: observedMin,
      safeMaxUsdPerKg: observedMax,
      safeRangeDisplay:
        match?.priceRangeDisplay?.trim() ||
        `${formatUsdKg(observedMin)} – ${formatUsdKg(observedMax)} /kg`,
      safeRangeSource: "observed",
    };
  }
  const lo = usual * (1 - PRICE_SAFE_BAND_PCT / 100);
  const hi = usual * (1 + PRICE_SAFE_BAND_PCT / 100);
  return {
    safeMinUsdPerKg: Math.round(lo * 1000) / 1000,
    safeMaxUsdPerKg: Math.round(hi * 1000) / 1000,
    safeRangeDisplay: `${formatUsdKg(lo)} – ${formatUsdKg(hi)} /kg (±${PRICE_SAFE_BAND_PCT}% of usual)`,
    safeRangeSource: "score-band",
  };
}

function emptyDetail(
  unit: number | null,
  partial: Partial<PriceVsMarketDetail> = {},
): PriceVsMarketDetail {
  return {
    pts: 0,
    priceUnit: PRICE_UNIT,
    dealUnitPriceUSD: unit,
    usualUsdPerKg: null,
    safeMinUsdPerKg: null,
    safeMaxUsdPerKg: null,
    safeRangeDisplay: null,
    safeRangeSource: null,
    rawPctOverUsual: null,
    deflatedPctOverUsual: null,
    match: null,
    fallback: "none",
    ...partial,
  };
}

/**
 * Points contribution to Dimension B from price-vs-usual (month × route).
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
    });
    if (match) {
      const rawPct = ((unit - match.usualUsdPerKg) / match.usualUsdPerKg) * 100;
      const deflatedPct =
        match.source === "customs" ? deflateForDealValueMarkup(rawPct) : rawPct;
      const range = safeRangeFromUsual(match.usualUsdPerKg, match);
      return {
        pts: bandPoints(deflatedPct),
        priceUnit: PRICE_UNIT,
        dealUnitPriceUSD: unit,
        usualUsdPerKg: match.usualUsdPerKg,
        ...range,
        rawPctOverUsual: Math.round(rawPct * 100) / 100,
        deflatedPctOverUsual: Math.round(deflatedPct * 100) / 100,
        match,
        fallback: "month-route",
      };
    }
  }

  const benchmark = deal.marketIntel?.dim_b_price_benchmark;
  if (!benchmark || "status" in benchmark) {
    return emptyDetail(unit, { fallback: "none" });
  }
  const rawPct = benchmark.deal_vs_p50_pct;
  if (rawPct === null || rawPct === undefined) {
    const usual = benchmark.p50 ?? null;
    const range =
      usual != null && usual > 0
        ? safeRangeFromUsual(usual, null)
        : {
            safeMinUsdPerKg: null,
            safeMaxUsdPerKg: null,
            safeRangeDisplay: null,
            safeRangeSource: null,
          };
    return emptyDetail(unit, {
      usualUsdPerKg: usual,
      ...range,
      fallback: "market-intel",
    });
  }
  const deflatedPct = deflateForDealValueMarkup(rawPct);
  const usual = benchmark.p50 ?? null;
  const range =
    usual != null && usual > 0
      ? safeRangeFromUsual(usual, null)
      : {
          safeMinUsdPerKg: null,
          safeMaxUsdPerKg: null,
          safeRangeDisplay: null,
          safeRangeSource: null,
        };
  return {
    pts: bandPoints(deflatedPct),
    priceUnit: PRICE_UNIT,
    dealUnitPriceUSD: unit,
    usualUsdPerKg: usual,
    ...range,
    rawPctOverUsual: rawPct,
    deflatedPctOverUsual: Math.round(deflatedPct * 100) / 100,
    match: null,
    fallback: "market-intel",
  };
}
