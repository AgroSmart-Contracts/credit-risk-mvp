import { describe, expect, it } from "vitest";
import { computeRiskReward } from "./risk-reward";
import type { Deal, FinancingRecommendation } from "../types";

function stubDeal(over: Partial<Deal> = {}): Deal {
  return {
    id: "t",
    dealRef: "t",
    product: "Fresh Blueberries",
    hsCode: null,
    hsHeading4: null,
    variety: null,
    quantityLabel: null,
    dealValueUSD: 100_000,
    origin: "Peru",
    destination: "Spain",
    incoterm: "FOB",
    buyer: {
      name: "Buyer",
      role: "buyer",
      yearsInBusiness: 5,
      licenseValid: true,
      platformDealsCompleted: 2,
      platformCompletionRate: 100,
      avgPaymentDelayDays: 0,
    },
    supplier: {
      name: "Supplier",
      role: "supplier",
      yearsInBusiness: 5,
      licenseValid: true,
      platformDealsCompleted: 2,
      platformCompletionRate: 100,
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
    estimatedTransitDays: 20,
    numberOfTransshipments: 0,
    routeRiskFlag: "Standard",
    transportMode: "ocean",
    offerUnitPriceUSD: 5,
    shippingStartDate: null,
    createdAt: null,
    priorDealsBetweenParties: 0,
    relationshipAgeMonths: 0,
    ...over,
  } as Deal;
}

function stubFin(over: Partial<FinancingRecommendation> = {}): FinancingRecommendation {
  return {
    maxFinancingAmount: 80_000,
    maxFinancingPct: 80,
    requiredAdvanceAmount: 20_000,
    requiredAdvancePct: 20,
    interestRate: 12.5,
    baseRate: 6,
    riskPremium: 4,
    uncertaintyPremium: 2.5,
    counterpartyCoveragePct: 30,
    collateralRequired: "Inventory pledge + insurance",
    decision: "MANUAL REVIEW",
    approvalLevel: "Credit Manager",
    ...over,
  };
}

describe("computeRiskReward — structure investment summary", () => {
  it("produces cash-flow KPIs and an investment call", () => {
    const rr = computeRiskReward({
      deal: stubDeal(),
      overall: 59,
      tier: "Medium-High Risk",
      vetoed: true,
      financing: stubFin({ interestRate: 10 }),
    });
    expect(rr.capitalNeedUsd).toBeGreaterThan(0);
    expect(rr.buyerFirstCoversCapitalPct).toBeGreaterThan(50);
    expect(rr.marginUsd).toBeGreaterThan(0);
    expect(rr.call).toMatch(/fund|restructure|decline/);
    expect(rr.bullets.length).toBeGreaterThanOrEqual(1);
    expect(rr.oneLiner.length).toBeGreaterThan(20);
  });

  it("flags fund-with-conditions when vetoed but first payment covers capital", () => {
    const rr = computeRiskReward({
      deal: stubDeal({ advancePaymentPct: 0 }),
      overall: 52,
      tier: "Veto",
      vetoed: true,
      financing: stubFin({ interestRate: 14 }),
    });
    // Default structure uses 70% buyer first — typically covers most capital need.
    expect(rr.buyerFirstCoversCapitalPct).toBeGreaterThan(60);
    expect(["fund", "fund-with-conditions"]).toContain(rr.call);
    expect(rr.justifiesHighRisk || rr.call === "fund-with-conditions").toBe(true);
  });

  it("recommends loss-cover advance equal to at-risk after 1st collection", () => {
    const rr = computeRiskReward({
      deal: stubDeal({ advancePaymentPct: 0 }),
      overall: 59,
      tier: "Medium-High Risk",
      vetoed: true,
      financing: stubFin(),
    });
    expect(rr.lossCoverAdvanceUsd).toBe(Math.round(rr.atRiskAfterFirstUsd));
    expect(rr.lossCoverAdvancePct).toBeGreaterThan(0);
    expect(rr.lossCoverAlreadyMet).toBe(false);
    expect(rr.lossCoverAdvanceShortfallUsd).toBe(rr.lossCoverAdvanceUsd);
  });
});
