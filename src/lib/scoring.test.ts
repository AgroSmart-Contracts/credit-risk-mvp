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

/** Thin baseline — every buyer/supplier field blank, so it lands exactly on neutral 50. */
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
      name: "Test Buyer Unique XYZ",
      role: "buyer",
      yearsInBusiness: null,
      licenseValid: null,
      platformDealsCompleted: 0,
      platformCompletionRate: null,
      avgPaymentDelayDays: null,
    },
    supplier: {
      name: "Test Supplier Unique XYZ",
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
  it("blank buyer still gets optimistic payment-delay default (not pure neutral 50)", () => {
    // paymentDelayDays defaults to 100 until measured → slight lift over 50
    expect(computeBuyerScore(baseDeal())).toBe(55);
  });

  it("adds platform trust when profile has deals", () => {
    const deal = baseDeal({
      buyer: {
        ...baseDeal().buyer,
        profileDealCount: 3,
        platformDealsCompleted: 3,
      },
    });
    expect(computeBuyerScore(deal)).toBeGreaterThan(50);
  });

  it("years in business raises score", () => {
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
    const deal = baseDeal({
      buyer: { ...baseDeal().buyer, yearsInBusiness: 5 },
    });
    const audit = explainPartyScore(deal, "buyer");
    expect(audit.lines.some((l) => l.id === "yearsInBusiness")).toBe(true);
    expect(audit.score).toBe(computeBuyerScore(deal));
  });

  it("uses sandbox score for known platform buyer (Open Markets)", () => {
    const deal = baseDeal({
      product: "Fresh Mandarin",
      buyer: {
        ...baseDeal().buyer,
        name: "Open Markets Corporation",
        yearsInBusiness: 2,
        licenseValid: true,
        platformDealsCompleted: 10,
      },
    });
    // Precomputed sandbox score for this (company, product) after optimistic
    // payment-delay / rejection defaults.
    expect(computeBuyerScore(deal)).toBe(60);
  });
});

describe("computeSupplierScore / composite", () => {
  it("blank supplier still gets optimistic quality-rejection default (not pure neutral 50)", () => {
    expect(computeSupplierScore(baseDeal())).toBe(55);
  });

  it("composite and relationship are 0–100", () => {
    const deal = baseDeal({
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
    });
    const cp = computeCounterpartyScore(deal);
    expect(cp).toBeGreaterThan(50);
    expect(cp).toBeLessThanOrEqual(100);
    expect(relationshipAdjustment(deal)).toBeGreaterThanOrEqual(0);
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
    expect(overall.relationshipAdj).toBeDefined();
  });

  it("paymentTermsAdjustment and tiers", () => {
    expect(paymentTermsAdjustment("Cash in advance")).toBe(25);
    expect(getTier(80)).toBe("Low Risk");
  });

  it("veto register fires on no insurance", () => {
    const v = checkVetoRegister(baseDeal({ insuranceCoverage: "None" }));
    expect(v.vetoed).toBe(true);
  });

  it("air ≥4 stops is a Dimension C veto; 3 stops is not", () => {
    const at3 = checkVetoRegister(
      baseDeal({
        insuranceCoverage: "Basic",
        transportMode: "air",
        numberOfTransshipments: 3,
      }),
    );
    expect(at3.reasons.some((r) => /air stops/i.test(r))).toBe(false);

    const at4 = checkVetoRegister(
      baseDeal({
        insuranceCoverage: "Basic",
        transportMode: "air",
        numberOfTransshipments: 4,
      }),
    );
    expect(at4.vetoed).toBe(true);
    expect(at4.reasons.some((r) => /≥4 air stops/i.test(r))).toBe(true);
  });
});

describe("Dimension C v2 route table", () => {
  it("uses table score as-is when a row matches (no Incoterms overlay)", () => {
    const deal = baseDeal({
      origin: "Callao",
      destination: "Algeciras",
      product: "Cacao Beans",
      transportMode: "sea",
      insuranceCoverage: "Basic",
      incoterm: "FOB",
    });
    expect(computeRouteScore(deal)).toBe(100);
  });

  it("does not invent structural transit/transship points on a miss", () => {
    const deal = baseDeal({
      origin: "Nowhereville",
      destination: "Atlantis",
      product: "Unicorn Fruit",
      transportMode: "sea",
      estimatedTransitDays: 2,
      numberOfTransshipments: 0,
      routeRiskFlag: "Low",
      coldChainRequired: true,
      insuranceCoverage: "Basic",
      incoterm: "EXW",
    });
    expect(computeRouteScore(deal)).toBe(70);
  });
});
