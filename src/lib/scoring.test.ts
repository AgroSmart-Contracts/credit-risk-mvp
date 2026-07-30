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
  relationshipAdjustment,
} from "./scoring";

/** Neutral baseline — blank fields shrink Dimension A toward 50. */
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

describe("computeBuyerScore — Dimension A weighted/shrink", () => {
  it("stays near neutral 50 when everything is blank (no trust bonus)", () => {
    expect(computeBuyerScore(baseDeal())).toBe(50);
  });

  it("adds platform trust when profile has deals", () => {
    const deal = baseDeal({
      buyer: {
        ...baseDeal().buyer,
        profileDealCount: 3,
        platformDealsCompleted: 3,
      },
    });
    // Thin coverage + trust +3 → above pure-blank 50
    expect(computeBuyerScore(deal)).toBeGreaterThan(50);
  });

  it("years in business raises raw average (10y → field score 100)", () => {
    const thin = computeBuyerScore(baseDeal());
    const withYib = computeBuyerScore(
      baseDeal({
        buyer: { ...baseDeal().buyer, yearsInBusiness: 10 },
      }),
    );
    expect(withYib).toBeGreaterThan(thin);
  });

  it("invalid license pulls score down vs valid", () => {
    const invalid = computeBuyerScore(
      baseDeal({
        buyer: { ...baseDeal().buyer, licenseValid: false, yearsInBusiness: 5 },
      }),
    );
    const valid = computeBuyerScore(
      baseDeal({
        buyer: { ...baseDeal().buyer, licenseValid: true, yearsInBusiness: 5 },
      }),
    );
    expect(valid).toBeGreaterThan(invalid);
  });

  it("explainPartyScore returns weighted field lines", () => {
    const audit = explainPartyScore(
      baseDeal({ buyer: { ...baseDeal().buyer, yearsInBusiness: 5 } }),
      "buyer",
    );
    expect(audit.lines.some((l) => l.id === "yearsInBusiness")).toBe(true);
    expect(audit.score).toBe(computeBuyerScore(baseDeal({
      buyer: { ...baseDeal().buyer, yearsInBusiness: 5 },
    })));
  });
});

describe("computeSupplierScore — Dimension A weighted/shrink", () => {
  it("stays near neutral without data", () => {
    expect(computeSupplierScore(baseDeal())).toBe(50);
  });

  it("on-time rate from completion lifts score", () => {
    const base = computeSupplierScore(baseDeal());
    const withOnTime = computeSupplierScore(
      baseDeal({
        supplier: {
          ...baseDeal().supplier,
          profileDealCount: 4,
          profileFinishedDealCount: 4,
          platformCompletionRate: 100,
          yearsInBusiness: 5,
          licenseValid: true,
        },
      }),
    );
    expect(withOnTime).toBeGreaterThan(base);
  });
});

describe("computeCounterpartyScore — composite", () => {
  it("blends buyer, supplier, and relationship fields", () => {
    const score = computeCounterpartyScore(
      baseDeal({
        priorDealsBetweenParties: 5,
        relationshipAgeMonths: 12,
        buyer: {
          ...baseDeal().buyer,
          yearsInBusiness: 8,
          licenseValid: true,
          profileDealCount: 5,
        },
        supplier: {
          ...baseDeal().supplier,
          yearsInBusiness: 8,
          licenseValid: true,
          profileDealCount: 5,
          platformCompletionRate: 95,
        },
      }),
    );
    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("relationshipAdjustment is 0–100 group score", () => {
    const none = relationshipAdjustment(baseDeal({ priorDealsBetweenParties: 0 }));
    const many = relationshipAdjustment(
      baseDeal({ priorDealsBetweenParties: 10, relationshipAgeMonths: 24 }),
    );
    expect(none).toBeGreaterThanOrEqual(0);
    expect(many).toBeGreaterThan(none);
  });
});

describe("other dimensions still score", () => {
  it("product / route / structure / overall run", () => {
    const deal = baseDeal({ insuranceCoverage: "Basic" });
    expect(computeProductScore(deal)).toBeGreaterThan(0);
    expect(computeRouteScore(deal)).toBeGreaterThan(0);
    expect(computeStructureScore(deal)).toBeGreaterThan(0);
    const overall = computeOverallScore(deal);
    expect(overall.overall).toBeGreaterThan(0);
    expect(overall.buyer).toBe(computeBuyerScore(deal));
    expect(overall.supplier).toBe(computeSupplierScore(deal));
  });

  it("paymentTermsAdjustment and tiers", () => {
    expect(paymentTermsAdjustment("Cash in advance")).toBe(25);
    expect(getTier(80)).toBe("Low Risk");
  });

  it("veto register fires on no insurance", () => {
    const v = checkVetoRegister(baseDeal({ insuranceCoverage: "None" }));
    expect(v.vetoed).toBe(true);
  });
});
