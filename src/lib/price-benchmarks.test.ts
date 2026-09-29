import { describe, expect, it } from "vitest";
import type { Deal } from "../types";
import {
  DEAL_VALUE_MARKUP_RATIO,
  deflateForDealValueMarkup,
  priceVsMarketDetail,
  priceVsMarketPoints,
} from "./price-benchmarks";

/**
 * Ground truth for DEAL_VALUE_MARKUP_RATIO: 4 platform rows carry their own
 * verbatim customs FOB in the `customs` narrative; dealValue/kg vs that FOB
 * was 1.34×–1.88× (geomean 1.628×).
 */
const VERIFIED_DUA_MARKUP_RATIOS = [
  21600 / 12768.24,
  25920 / 15709.64,
  90000 / 47750.0,
  156800 / 117308.4,
];

function dealWith(overrides: Partial<Deal>): Deal {
  return {
    id: "t",
    dealRef: "T",
    product: "Fresh Blueberries",
    hsCode: null,
    hsHeading4: null,
    variety: "",
    quantityLabel: "1000 kg",
    dealValueUSD: 10000,
    origin: "Callao, Peru",
    destination: "Rotterdam, Netherlands",
    incoterm: "FOB",
    buyer: {
      name: "B",
      role: "buyer",
      yearsInBusiness: 5,
      licenseValid: true,
      platformDealsCompleted: 0,
      platformCompletionRate: 0,
      qualityRejectionRatePct: 0,
    },
    supplier: {
      name: "S",
      role: "supplier",
      yearsInBusiness: 5,
      licenseValid: true,
      platformDealsCompleted: 0,
      platformCompletionRate: 0,
      qualityRejectionRatePct: 0,
    },
    paymentTerms: "Documentary / against BL (platform default)",
    advancePaymentPct: 0,
    contractType: "Spot",
    collateralType: "None",
    collateralValueUSD: 0,
    insuranceCoverage: "None",
    insuranceConfirmed: true,
    insuranceValueUSD: 0,
    productCategory: "Fresh Produce",
    perishabilityClass: "Ultra-Perishable",
    shelfLifeDays: 21,
    coldChainRequired: true,
    qualityGrade: "Grade A / Class I",
    estimatedTransitDays: 22,
    numberOfTransshipments: 1,
    routeRiskFlag: "Low",
    transportMode: "sea",
    offerUnitPriceUSD: null,
    shippingStartDate: null,
    priorDealsBetweenParties: 0,
    relationshipAgeMonths: 0,
    sourceDocuments: [],
    fieldsNeedingConfirmation: [],
    teaser: "",
    ...overrides,
  };
}

describe("DEAL_VALUE_MARKUP_RATIO", () => {
  it("is the geometric mean of the 4 verified DUA-matched markup ratios", () => {
    const product = VERIFIED_DUA_MARKUP_RATIOS.reduce((a, b) => a * b, 1);
    const geomean = product ** (1 / VERIFIED_DUA_MARKUP_RATIOS.length);
    expect(DEAL_VALUE_MARKUP_RATIO).toBeCloseTo(geomean, 2);
  });
});

describe("deflateForDealValueMarkup", () => {
  it("maps a deal priced exactly at the raw customs P50 (0% raw) to below market", () => {
    expect(deflateForDealValueMarkup(0)).toBeCloseTo((1 / DEAL_VALUE_MARKUP_RATIO - 1) * 100, 5);
  });

  it("maps the typical markup itself back to ~0%", () => {
    const typicalMarkupPct = (DEAL_VALUE_MARKUP_RATIO - 1) * 100;
    expect(deflateForDealValueMarkup(typicalMarkupPct)).toBeCloseTo(0, 5);
  });
});

describe("priceVsMarketPoints — month × route via offerUnitPrice", () => {
  it("returns 0 when there is no unit price and no market-intel", () => {
    expect(priceVsMarketPoints(dealWith({}))).toBe(0);
  });

  it("scores a Peru→Netherlands blueberry sea deal using shipment-start month", () => {
    // quantityLabel must encode pack weight so dealPricePerKg can recover $/kg
    // (offerUnitPrice alone is per-carton on platform deals).
    const detail = priceVsMarketDetail(
      dealWith({
        offerUnitPriceUSD: 8,
        dealValueUSD: 8000,
        quantityLabel: "1000 x Carton x 1.5 Kg",
        shippingStartDate: "2025-10-15T00:00:00.000Z",
        transportMode: "sea",
      }),
    );
    expect(detail.fallback).toBe("month-route");
    expect(detail.usualUsdPerKg).not.toBeNull();
    expect(detail.match?.destinationCountry).toBe("PAISES BAJOS");
    expect(typeof detail.pts).toBe("number");
  });

  it("raises product risk (negative points) when unit price is far above usual for the month/route", () => {
    const pts = priceVsMarketPoints(
      dealWith({
        offerUnitPriceUSD: 40,
        dealValueUSD: 40000,
        quantityLabel: "1000 x Carton x 1.5 Kg",
        shippingStartDate: "2025-10-15T00:00:00.000Z",
        transportMode: "sea",
      }),
    );
    expect(pts).toBeLessThan(0);
  });

  it("falls back to market-intel when month-route usual is unavailable", () => {
    const pts = priceVsMarketPoints(
      dealWith({
        offerUnitPriceUSD: 10,
        shippingStartDate: "2019-01-01T00:00:00.000Z", // outside customs + sheet windows
        destination: "Nowhereville, Atlantis",
        marketIntel: {
          dim_b_price_benchmark: { deal_vs_p50_pct: 5, p50: 9 },
        } as Deal["marketIntel"],
      }),
    );
    expect(pts).toBe(10);
  });
});
