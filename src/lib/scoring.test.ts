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

/** Neutral baseline — every variable at its "no data" midpoint. */
function baseDeal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: "test-deal",
    dealRef: "TEST-001",
    product: "Fresh Blueberries",
    hsCode: null,
    hsHeading4: null,
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
      avgPaymentDelayDays: null,
    },
    supplier: {
      name: "Test Supplier",
      role: "supplier",
      yearsInBusiness: null,
      licenseValid: null,
      platformDealsCompleted: 0,
      platformCompletionRate: null,
      qualityRejectionRatePct: null,
    },
    paymentTerms: "60 days",
    advancePaymentPct: 0,
    contractType: "Spot",
    collateralType: "None",
    collateralValueUSD: 0,
    insuranceCoverage: "None",
    insuranceConfirmed: true,
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

describe("computeBuyerScore / computeSupplierScore — Dimension A (weighted/shrink)", () => {
  it("starts near neutral 50 with everything unknown", () => {
    expect(computeBuyerScore(baseDeal())).toBe(50);
    expect(computeSupplierScore(baseDeal())).toBe(50);
  });

  it("moves with years in business", () => {
    const young = computeBuyerScore(
      baseDeal({ buyer: { ...baseDeal().buyer, yearsInBusiness: 1 } }),
    );
    const mature = computeBuyerScore(
      baseDeal({ buyer: { ...baseDeal().buyer, yearsInBusiness: 10 } }),
    );
    expect(mature).toBeGreaterThan(young);
  });

  it("invalid buyer license can reduce or leave score (blank vs known)", () => {
    const unknown = computeBuyerScore(baseDeal());
    const invalid = computeBuyerScore(
      baseDeal({ buyer: { ...baseDeal().buyer, licenseValid: false } }),
    );
    // Invalid is never better than unknown/valid baselines on this engine.
    expect(invalid).toBeLessThanOrEqual(unknown);
  });
});

describe("explainPartyScore — auditor trail", () => {
  it("matches computeSupplierScore", () => {
    const deal = baseDeal({
      supplier: {
        ...baseDeal().supplier,
        yearsInBusiness: 5,
        licenseValid: true,
        platformDealsCompleted: 4,
      },
    });
    const audit = explainPartyScore(deal, "supplier");
    expect(audit.score).toBe(computeSupplierScore(deal));
    expect(audit).toBeTruthy();
  });
});

describe("computeCounterpartyScore — blended Dimension A", () => {
  it("rewards thicker pair history vs zero priors", () => {
    const none = computeCounterpartyScore(baseDeal({ priorDealsBetweenParties: 0 }));
    const thick = computeCounterpartyScore(
      baseDeal({ priorDealsBetweenParties: 10 }),
    );
    expect(thick).toBeGreaterThan(none);
  });
});

describe("computeStructureScore — Dimension D", () => {
  it("confirmed defaults without relationship: 60 − 5 collateral (= 55)", () => {
    expect(
      computeStructureScore(
        baseDeal({ insuranceCoverage: "None", insuranceConfirmed: true }),
      ),
    ).toBe(55);
  });

  it("unconfirmed insurance applies −8 haircut", () => {
    expect(
      computeStructureScore(
        baseDeal({ insuranceCoverage: "None", insuranceConfirmed: false }),
      ),
    ).toBe(47);
  });

  it("Letter of Credit covering full deal value gets +5 full-coverage bonus", () => {
    const deal = baseDeal({
      collateralType: "Letter of Credit",
      collateralValueUSD: 100_000,
      dealValueUSD: 100_000,
      insuranceConfirmed: true,
      insuranceCoverage: "Basic",
    });
    expect(computeStructureScore(deal)).toBe(91);
  });

  it("does not award full-coverage bonus when collateral is under deal value", () => {
    const deal = baseDeal({
      collateralType: "Letter of Credit",
      collateralValueUSD: 50_000,
      dealValueUSD: 100_000,
      insuranceConfirmed: true,
      insuranceCoverage: "Basic",
    });
    expect(computeStructureScore(deal)).toBe(86);
  });
});

describe("paymentTermsAdjustment", () => {
  it.each([
    ["Cash in advance", 25],
    ["Letter of Credit at sight", 20],
    ["Documentary / against BL (platform default)", 5],
    ["Cash against documents / BL", 15],
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
    const deal = baseDeal({
      insuranceCoverage: "Basic",
      insuranceConfirmed: true,
    });
    expect(checkVetoRegister(deal).vetoed).toBe(false);
  });

  it("vetoes on confirmed missing cargo insurance", () => {
    expect(
      checkVetoRegister(
        baseDeal({ insuranceCoverage: "None", insuranceConfirmed: true }),
      ).vetoed,
    ).toBe(true);
  });

  it("does not veto unconfirmed None insurance", () => {
    expect(
      checkVetoRegister(
        baseDeal({ insuranceCoverage: "None", insuranceConfirmed: false }),
      ).vetoed,
    ).toBe(false);
  });

  it("vetoes on invalid buyer license", () => {
    const result = checkVetoRegister(
      baseDeal({
        insuranceCoverage: "Basic",
        insuranceConfirmed: true,
        buyer: { ...baseDeal().buyer, licenseValid: false },
      }),
    );
    expect(result.vetoed).toBe(true);
    expect(result.reasons).toContain("Buyer import license invalid");
  });

  it("vetoes when air stops exceed MAX_AIR_STOPS (3)", () => {
    const ok = baseDeal({
      insuranceCoverage: "Basic",
      insuranceConfirmed: true,
      transportMode: "air",
      numberOfTransshipments: 3,
    });
    const veto = baseDeal({
      insuranceCoverage: "Basic",
      insuranceConfirmed: true,
      transportMode: "air",
      numberOfTransshipments: 4,
    });
    expect(checkVetoRegister(ok).vetoed).toBe(false);
    expect(checkVetoRegister(veto).vetoed).toBe(true);
  });

  it("collects multiple independent veto reasons", () => {
    const deal = baseDeal({
      insuranceCoverage: "None",
      insuranceConfirmed: true,
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

describe("computeOverallScore — composite + APY", () => {
  it("weights the four dimensions at 40/25/20/15", () => {
    const result = computeOverallScore(
      baseDeal({ insuranceCoverage: "Basic", insuranceConfirmed: true }),
    );
    const expected = Math.round(
      result.counterparty * 0.4 +
        result.product * 0.25 +
        result.route * 0.2 +
        result.structure * 0.15,
    );
    expect(result.overall).toBe(expected);
  });

  it("forces tier to Veto when confirmed insurance is None", () => {
    const result = computeOverallScore(
      baseDeal({
        insuranceCoverage: "None",
        insuranceConfirmed: true,
        paymentTerms: "cash in advance",
        collateralType: "Letter of Credit",
        collateralValueUSD: 100_000,
      }),
    );
    expect(result.vetoed).toBe(true);
    expect(result.tier).toBe("Veto");
    expect(result.investorApyPct).toBeGreaterThanOrEqual(10);
    expect(result.investorApyPct).toBeLessThanOrEqual(18);
  });

  it("attaches investorApyPct and does not veto unconfirmed None", () => {
    const result = computeOverallScore(
      baseDeal({ insuranceCoverage: "None", insuranceConfirmed: false }),
    );
    expect(result.vetoed).toBe(false);
    expect(result.investorApyPct).toBeGreaterThanOrEqual(10);
    expect(result.investorApyPct).toBeLessThanOrEqual(18);
  });
});

describe("computeProductScore / computeRouteScore — missing-data haircuts", () => {
  it("product score uses base 55 when no price benchmark exists", () => {
    expect(
      computeProductScore(
        baseDeal({
          product: "Some Unlisted Product",
          hsCode: null,
          hsHeading4: null,
          offerUnitPriceUSD: null,
        }),
      ),
    ).toBe(55);
  });

  it("route score uses base 55 on table miss", () => {
    expect(
      computeRouteScore(
        baseDeal({
          origin: "Nowhere",
          destination: "Nowhere Else",
          transportMode: "sea",
          routeRiskProfile: undefined,
        }),
      ),
    ).toBe(55);
  });

  it("provisional route rows take an −8 haircut", () => {
    const profileBase = {
      origin: "A",
      destination: "B",
      product: "Fresh Blueberries",
      hsCode: null,
      hsHeading4: null,
      transportMode: "sea" as const,
      airStops: null,
      airStopsBand: null,
      airStopPenalty: 0,
      score: 80,
      estimatedTransitDays: 20,
      numberOfTransshipments: 0,
      routeRiskFlag: "Medium" as const,
      vetoCandidate: false,
      rationale: "test",
      scoreConfirmed: true,
    };
    expect(computeRouteScore(baseDeal({ routeRiskProfile: profileBase }))).toBe(
      80,
    );
    expect(
      computeRouteScore(
        baseDeal({
          routeRiskProfile: { ...profileBase, scoreConfirmed: false },
        }),
      ),
    ).toBe(72);
  });

  it("air stop bands differentiate route risk", () => {
    const ocean = baseDeal({
      origin: "Callao, Peru",
      destination: "Buenaventura, Colombia",
      product: "Fresh Avocado",
      hsCode: null,
      hsHeading4: null,
      transportMode: "sea",
      numberOfTransshipments: 0,
      routeRiskProfile: undefined,
    });
    const airFew = computeRouteScore({
      ...ocean,
      transportMode: "air",
      numberOfTransshipments: 1,
    });
    const airMany = computeRouteScore({
      ...ocean,
      transportMode: "air",
      numberOfTransshipments: 3,
    });
    expect(airFew).toBeGreaterThanOrEqual(airMany);
  });

  it("air can score safer than ocean on long asparagus corridors", () => {
    const ocean = baseDeal({
      origin: "Callao, Peru",
      destination: "Rotterdam, Netherlands",
      product: "Fresh Asparagus",
      hsCode: null,
      hsHeading4: null,
      transportMode: "sea",
      numberOfTransshipments: 1,
      routeRiskProfile: undefined,
    });
    const air = {
      ...ocean,
      transportMode: "air" as const,
      numberOfTransshipments: 1,
    };
    expect(computeRouteScore(air)).toBeGreaterThan(computeRouteScore(ocean));
  });
});
