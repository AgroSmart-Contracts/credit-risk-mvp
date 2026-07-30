import { describe, expect, it } from "vitest";
import type { Deal } from "../types";
import {
  computeBuyerScore,
  computeSupplierScore,
  computeCounterpartyScore,
  computeProductScore,
  computeRouteScore,
  computeStructureScore,
  computeOverallScore,
  explainPartyScore,
  paymentTermsAdjustment,
  checkVetoRegister,
  getTier,
} from "./scoring";

/** Neutral baseline — every variable at its "no data" midpoint, so each test only has to vary the one field it's checking. */
function baseDeal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: "test-deal",
    dealRef: "TEST-001",
    product: "Fresh Blueberries",
    variety: "",
    quantityLabel: "1000 kg",
    dealValueUSD: 100_000,
    origin: "Lima, Peru",
    destination: "Rotterdam, Netherlands",
    incoterm: "FOB",
    buyer: {
      name: "Test Buyer",
      role: "buyer",
      yearsInBusiness: null,
      licenseValid: null,
      platformDealsCompleted: 0,
      platformCompletionRate: null,
    },
    supplier: {
      name: "Test Supplier",
      role: "supplier",
      yearsInBusiness: null,
      licenseValid: null,
      platformDealsCompleted: 0,
      platformCompletionRate: null,
    },
    paymentTerms: "60 days",
    advancePaymentPct: 0,
    contractType: "Spot",
    collateralType: "None",
    collateralValueUSD: 0,
    insuranceCoverage: "None",
    insuranceValueUSD: 0,
    productCategory: "Fresh Produce",
    perishabilityClass: "Perishable",
    shelfLifeDays: 21,
    coldChainRequired: false,
    qualityGrade: "Grade A / Class I",
    estimatedTransitDays: 10,
    numberOfTransshipments: 0,
    routeRiskFlag: "Medium",
    transportMode: null,
    offerUnitPriceUSD: null,
    shippingStartDate: null,
    createdAt: null,
    priorDealsBetweenParties: 0,
    relationshipAgeMonths: 0,
    sourceDocuments: [],
    fieldsNeedingConfirmation: [],
    teaser: "",
    ...overrides,
  };
}

describe("computeBuyerScore — Dimension A buyer sub-score", () => {
  it("starts at 50 with everything unknown", () => {
    expect(computeBuyerScore(baseDeal())).toBe(50);
  });

  it.each([
    [1, -5],
    [2, 5],
    [5, 10],
    [10, 15],
  ])("years in business %i -> %i pts", (years, pts) => {
    const deal = baseDeal({ buyer: { ...baseDeal().buyer, yearsInBusiness: years } });
    expect(computeBuyerScore(deal)).toBe(50 + pts);
  });

  it("invalid license is -20", () => {
    const deal = baseDeal({ buyer: { ...baseDeal().buyer, licenseValid: false } });
    expect(computeBuyerScore(deal)).toBe(50 - 20);
  });

  it("valid license is +10", () => {
    const deal = baseDeal({ buyer: { ...baseDeal().buyer, licenseValid: true } });
    expect(computeBuyerScore(deal)).toBe(50 + 10);
  });

  it("clamps at 100", () => {
    const deal = baseDeal({
      buyer: {
        ...baseDeal().buyer,
        yearsInBusiness: 20,
        licenseValid: true,
        platformDealsCompleted: 20,
        platformCompletionRate: 100,
      },
    });
    expect(computeBuyerScore(deal)).toBe(100);
  });

  it("stacking every negative buyer signal bottoms out at 15, not below (current point tables never reach the 0 floor)", () => {
    const deal = baseDeal({
      buyer: { ...baseDeal().buyer, yearsInBusiness: 1, licenseValid: false, platformCompletionRate: 10 },
    });
    // 50 - 5 (years<2) - 20 (invalid license) - 10 (completion<60%) = 15
    expect(computeBuyerScore(deal)).toBe(15);
  });
});

describe("computeSupplierScore — Dimension A supplier sub-score", () => {
  it("starts at 50 with everything unknown", () => {
    expect(computeSupplierScore(baseDeal())).toBe(50);
  });

  it("invalid license is -25 (harsher than buyer's -20)", () => {
    const deal = baseDeal({ supplier: { ...baseDeal().supplier, licenseValid: false } });
    expect(computeSupplierScore(deal)).toBe(50 - 25);
  });

  it("2-5 years is neutral for supplier (unlike buyer's +5)", () => {
    const deal = baseDeal({ supplier: { ...baseDeal().supplier, yearsInBusiness: 3 } });
    expect(computeSupplierScore(deal)).toBe(50);
  });
});

describe("explainPartyScore — auditor trail", () => {
  it("matches computeSupplierScore and explains BIO FARMING-style 85", () => {
    const deal = baseDeal({
      supplier: {
        ...baseDeal().supplier,
        yearsInBusiness: 2,
        licenseValid: true,
        platformDealsCompleted: 4,
        platformCompletionRate: 100,
      },
    });
    const audit = explainPartyScore(deal, "supplier");
    expect(audit.score).toBe(85);
    expect(audit.score).toBe(computeSupplierScore(deal));
    expect(audit.rawTotal).toBe(50 + 5 + 15 + 0 + 0 + 15 + 0);
    expect(audit.whyBelow100.some((r) => r.includes("Platform deals"))).toBe(true);
    expect(audit.whyBelow100.some((r) => r.includes("Years in business"))).toBe(true);
  });

  it("hits 100 when pair history is thick enough despite young YIB", () => {
    const deal = baseDeal({
      supplier: {
        ...baseDeal().supplier,
        yearsInBusiness: 2,
        licenseValid: true,
        platformDealsCompleted: 11,
        platformCompletionRate: 100,
      },
    });
    const audit = explainPartyScore(deal, "supplier");
    expect(audit.score).toBe(100);
    expect(audit.whyBelow100).toEqual([]);
  });
});

describe("computeCounterpartyScore — blended Dimension A", () => {
  it("is buyer*0.5 + supplier*0.5 + relationship, not buyer*0.6+supplier*0.4", () => {
    const deal = baseDeal({
      buyer: { ...baseDeal().buyer, licenseValid: true }, // buyer 60
      supplier: { ...baseDeal().supplier, licenseValid: true }, // supplier 65
      priorDealsBetweenParties: 0, // relationship -10
    });
    // 60*0.5 + 65*0.5 - 10 = 52.5
    expect(computeCounterpartyScore(deal)).toBeCloseTo(52.5);
  });

  it("relationship bonus scales with prior deals", () => {
    const rel = (n: number) => computeCounterpartyScore(baseDeal({ priorDealsBetweenParties: n })) - 50;
    expect(rel(0)).toBe(-10);
    expect(rel(1)).toBe(5);
    expect(rel(5)).toBe(7);
    expect(rel(10)).toBe(10);
  });
});

describe("computeStructureScore — Dimension D", () => {
  it("base 60 with everything at documented defaults", () => {
    // None collateral (-5) + 60-day terms (0) + no prior deals (-12) + 0% advance (0) + no insurance (0, veto handled separately)
    expect(computeStructureScore(baseDeal())).toBe(60 - 5 - 12);
  });

  it("Letter of Credit collateral covering full deal value gets the +5 full-coverage bonus", () => {
    const deal = baseDeal({
      collateralType: "Letter of Credit",
      collateralValueUSD: 100_000,
      dealValueUSD: 100_000,
    });
    // base 60 + LC 25 + full-coverage 5 + terms 0 + relationship -12 + advance 0
    expect(computeStructureScore(deal)).toBe(60 + 25 + 5 - 12);
  });

  it("does not award the full-coverage bonus when collateral is under the deal value", () => {
    const deal = baseDeal({
      collateralType: "Letter of Credit",
      collateralValueUSD: 50_000,
      dealValueUSD: 100_000,
    });
    expect(computeStructureScore(deal)).toBe(60 + 25 - 12);
  });
});

describe("paymentTermsAdjustment", () => {
  it.each([
    ["Cash in advance", 25],
    ["Letter of Credit at sight", 20],
    ["30 days from BL", 10],
    ["60 days", 0],
    ["90 days", -10],
    ["120 days net", -18],
  ])("%s -> %i", (terms, expected) => {
    expect(paymentTermsAdjustment(terms)).toBe(expected);
  });
});

describe("checkVetoRegister — spec §6 hard stops", () => {
  it("passes a clean deal", () => {
    const deal = baseDeal({ insuranceCoverage: "Basic" });
    const result = checkVetoRegister(deal);
    expect(result.vetoed).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it("vetoes on missing cargo insurance", () => {
    const deal = baseDeal({ insuranceCoverage: "None" });
    expect(checkVetoRegister(deal).vetoed).toBe(true);
  });

  it("vetoes on invalid buyer license", () => {
    const deal = baseDeal({
      insuranceCoverage: "Basic",
      buyer: { ...baseDeal().buyer, licenseValid: false },
    });
    const result = checkVetoRegister(deal);
    expect(result.vetoed).toBe(true);
    expect(result.reasons).toContain("Buyer import license invalid");
  });

  it("vetoes on invalid supplier license", () => {
    const deal = baseDeal({
      insuranceCoverage: "Basic",
      supplier: { ...baseDeal().supplier, licenseValid: false },
    });
    expect(checkVetoRegister(deal).vetoed).toBe(true);
  });

  it("vetoes on 2+ air transshipments but not 1", () => {
    const oneHop = baseDeal({ insuranceCoverage: "Basic", transportMode: "air", numberOfTransshipments: 1 });
    const twoHops = baseDeal({ insuranceCoverage: "Basic", transportMode: "air", numberOfTransshipments: 2 });
    expect(checkVetoRegister(oneHop).vetoed).toBe(false);
    expect(checkVetoRegister(twoHops).vetoed).toBe(true);
  });

  it("does not veto on 2+ transshipments by sea", () => {
    const deal = baseDeal({ insuranceCoverage: "Basic", transportMode: "sea", numberOfTransshipments: 3 });
    expect(checkVetoRegister(deal).vetoed).toBe(false);
  });

  it("collects multiple independent veto reasons at once", () => {
    const deal = baseDeal({
      insuranceCoverage: "None",
      buyer: { ...baseDeal().buyer, licenseValid: false },
      supplier: { ...baseDeal().supplier, licenseValid: false },
    });
    expect(checkVetoRegister(deal).reasons).toHaveLength(3);
  });
});

describe("getTier", () => {
  it.each([
    [90, "Low Risk"],
    [75, "Low Risk"],
    [74, "Medium-Low Risk"],
    [60, "Medium-Low Risk"],
    [59, "Medium-High Risk"],
    [45, "Medium-High Risk"],
    [44, "High Risk"],
    [0, "High Risk"],
  ])("score %i -> %s", (score, tier) => {
    expect(getTier(score)).toBe(tier);
  });
});

describe("computeOverallScore — full composite + veto override", () => {
  it("weights the four dimensions at 40/25/20/15", () => {
    const deal = baseDeal({ insuranceCoverage: "Basic" });
    const result = computeOverallScore(deal);
    const expected = Math.round(
      result.counterparty * 0.4 + result.product * 0.25 + result.route * 0.2 + result.structure * 0.15,
    );
    expect(result.overall).toBe(expected);
  });

  it("forces tier to Veto regardless of how high the composite scores", () => {
    // Stack every positive signal, but leave insurance at "None" (veto trigger).
    const deal = baseDeal({
      buyer: { ...baseDeal().buyer, yearsInBusiness: 15, licenseValid: true, platformCompletionRate: 100, platformDealsCompleted: 15 },
      supplier: { ...baseDeal().supplier, yearsInBusiness: 15, licenseValid: true, platformCompletionRate: 100, platformDealsCompleted: 15 },
      priorDealsBetweenParties: 15,
      collateralType: "Letter of Credit",
      collateralValueUSD: 100_000,
      paymentTerms: "cash in advance",
      insuranceCoverage: "None", // the one bad signal
    });
    const result = computeOverallScore(deal);
    expect(result.overall).toBeGreaterThan(70); // composite would read as Low Risk on its own
    expect(result.vetoed).toBe(true);
    expect(result.tier).toBe("Veto");
  });

  it("does not throw and stays neutral when every optional field is null/default", () => {
    const result = computeOverallScore(baseDeal());
    expect(Number.isFinite(result.overall)).toBe(true);
    expect(result.tier).toBeDefined();
  });
});

describe("computeProductScore / computeRouteScore — structural fallback + per-deal adjustments", () => {
  it("product score falls back to perishability-bucket structural score when no table match", () => {
    const deal = baseDeal({ product: "Some Unlisted Product", perishabilityClass: "Non-Perishable", qualityGrade: "Grade A / Class I" });
    // fallback structural 70+18, quality grade Grade A +18, no price data (0) = 106, clamped to 100
    expect(computeProductScore(deal)).toBe(100);
  });

  it("route score applies incoterm and cold-chain adjustments on top of the structural fallback", () => {
    const deal = baseDeal({
      origin: "Nowhere",
      destination: "Nowhere Else",
      transportMode: "sea",
      perishabilityClass: "Non-Perishable",
      estimatedTransitDays: 25,
      numberOfTransshipments: 0,
      routeRiskFlag: "Low",
      incoterm: "CIF",
      coldChainRequired: true,
    });
    // structural fallback: 70 + transit(<=30d non-perishable +12) + transshipment(0 +15) + routeFlag(Low +12) = 109 -> clamp 100
    // + incoterm CIF +12, + coldChain -5 -> still clamps at 100
    expect(computeRouteScore(deal)).toBe(100);
  });

  it("air ≥3 stops uses the higher-risk table (airStopPenalty baked into adjustedScore)", () => {
    const ocean = baseDeal({
      origin: "Callao, Peru",
      destination: "Buenaventura, Colombia",
      product: "Fresh Avocado",
      transportMode: "sea",
      numberOfTransshipments: 0,
      routeRiskProfile: undefined,
      incoterm: "FCA", // 0 pts so table score shows through unchanged
      coldChainRequired: true,
    });
    const airFewStops = baseDeal({
      ...ocean,
      transportMode: "air",
      numberOfTransshipments: 1,
    });
    const airManyStops = baseDeal({
      ...ocean,
      transportMode: "air",
      numberOfTransshipments: 3,
    });
    // Short corridor: avocado already max freshness on ocean (91). Air ≤2 stays 91;
    // air ≥3 applies −15 stop penalty → 76.
    expect(computeRouteScore(ocean)).toBe(91);
    expect(computeRouteScore(airFewStops)).toBe(91);
    expect(computeRouteScore(airManyStops)).toBe(76);
  });

  it("air ≤2 stops scores safer than ocean when freshness was ocean-bound", () => {
    const ocean = baseDeal({
      origin: "Callao, Peru",
      destination: "Rotterdam, Netherlands",
      product: "Fresh Asparagus",
      transportMode: "sea",
      numberOfTransshipments: 1,
      routeRiskProfile: undefined,
      incoterm: "FCA",
      coldChainRequired: true,
    });
    const air = baseDeal({
      ...ocean,
      transportMode: "air",
      numberOfTransshipments: 1,
    });
    expect(computeRouteScore(ocean)).toBe(41);
    expect(computeRouteScore(air)).toBe(71);
  });
});
