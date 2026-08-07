/**
 * Unit tests for the sandbox counterparty weighted/shrink formula
 * (counterparty-risk-scoring-method-outline-2026-07-30.md).
 */
import { describe, expect, it } from "vitest";
import {
  SANDBOX_NEUTRAL,
  scoreBuyer,
  scoreComposite,
  scorePaymentDelayDays,
  scorePriorDeals,
  scoreQualityRejectionRate,
  scoreRelationship,
  scoreRouteDiversity,
  scoreSupplier,
  scoreVolumeMt,
  scoreWeightedGroup,
  scoreYearsInBusiness,
  scoreYearlySalesUsd,
} from "./counterparty-sandbox-scoring";

describe("sandbox field scorers", () => {
  it("years in business caps at 100", () => {
    expect(scoreYearsInBusiness(5)).toBe(50);
    expect(scoreYearsInBusiness(12)).toBe(100);
    expect(scoreYearsInBusiness(null)).toBeNull();
  });

  it("volume / sales bands", () => {
    expect(scoreVolumeMt(50)).toBe(25);
    expect(scoreVolumeMt(250)).toBe(40);
    expect(scoreVolumeMt(1_000)).toBe(60);
    expect(scoreVolumeMt(5_000)).toBe(80);
    expect(scoreVolumeMt(12_000)).toBe(90);
    expect(scoreYearlySalesUsd(100_000)).toBe(25);
    expect(scoreYearlySalesUsd(60_000_000)).toBe(90);
  });

  it("route diversity tiers", () => {
    expect(scoreRouteDiversity(1)).toBe(35);
    expect(scoreRouteDiversity(3)).toBe(55);
    expect(scoreRouteDiversity(8)).toBe(95);
  });

  it("prior deals cap at 5+", () => {
    expect(scorePriorDeals(0)).toBe(0);
    expect(scorePriorDeals(5)).toBe(100);
    expect(scorePriorDeals(9)).toBe(100);
  });

  it("payment delay / quality rejection default to 100 when blank (optimistic until measured)", () => {
    expect(scorePaymentDelayDays(null)).toBe(100);
    expect(scorePaymentDelayDays(undefined)).toBe(100);
    expect(scorePaymentDelayDays(0)).toBe(100);
    expect(scorePaymentDelayDays(10)).toBe(80);
    expect(scoreQualityRejectionRate(null)).toBe(100);
    expect(scoreQualityRejectionRate(undefined)).toBe(100);
    expect(scoreQualityRejectionRate(0)).toBe(100);
    expect(scoreQualityRejectionRate(10)).toBe(90);
  });
});

describe("scoreWeightedGroup — shrink toward neutral", () => {
  it("excludes blank fields from raw average", () => {
    const r = scoreWeightedGroup([
      { id: "a", label: "a", weight: 7, score: 100 },
      { id: "b", label: "b", weight: 7, score: null },
    ]);
    expect(r.rawAverage).toBe(100);
    expect(r.filledWeight).toBe(7);
    expect(r.possibleWeight).toBe(14);
    expect(r.weightCoverageFraction).toBe(0.5);
    expect(r.fieldCoverageFraction).toBe(0.5);
    expect(r.coverageFraction).toBe(0.5);
    expect(r.shrunkScore).toBe(0.5 * 100 + 0.5 * 50);
    expect(r.score).toBe(75);
    // Range is the score's midpoint: pessimistic assumes the blank field is
    // 0, optimistic assumes it's 100.
    expect(r.pessimisticScore).toBe(50);
    expect(r.optimisticScore).toBe(100);
    expect((r.pessimisticScore + r.optimisticScore) / 2).toBe(r.score);
  });

  it("fully blank profile lands on neutral 50, with a full 0-100 range", () => {
    const r = scoreWeightedGroup([
      { id: "a", label: "a", weight: 4, score: null },
      { id: "b", label: "b", weight: 4, score: null },
    ]);
    expect(r.rawAverage).toBeNull();
    expect(r.shrunkScore).toBe(SANDBOX_NEUTRAL);
    expect(r.score).toBe(50);
    expect(r.pessimisticScore).toBe(0);
    expect(r.optimisticScore).toBe(100);
  });

  it("adds trust bonus flat after shrinkage, capped at 100", () => {
    const r = scoreWeightedGroup(
      [{ id: "a", label: "a", weight: 1, score: 100 }],
      3,
    );
    expect(r.shrunkScore).toBe(100);
    expect(r.score).toBe(100);
  });

  it("coverage is the more conservative of weight-based and field-count-based fractions", () => {
    // Two heavy fields filled (weight 7 each = 14/28 = 50% by weight), but
    // only 2 of 4 fields filled = 50% by count too — coincidentally equal.
    const equal = scoreWeightedGroup([
      { id: "a", label: "a", weight: 7, score: 100 },
      { id: "b", label: "b", weight: 7, score: 100 },
      { id: "c", label: "c", weight: 7, score: null },
      { id: "d", label: "d", weight: 7, score: null },
    ]);
    expect(equal.weightCoverageFraction).toBe(0.5);
    expect(equal.fieldCoverageFraction).toBe(0.5);

    // One heavy field filled out of a group dominated by light fields: high
    // weight coverage but low field coverage — the blend should use the
    // lower (field-count) number, not the flattering weight number.
    const thinButHeavy = scoreWeightedGroup([
      { id: "a", label: "a", weight: 7, score: 100 },
      { id: "b", label: "b", weight: 1, score: null },
      { id: "c", label: "c", weight: 1, score: null },
      { id: "d", label: "d", weight: 1, score: null },
      { id: "e", label: "e", weight: 1, score: null },
    ]);
    expect(thinButHeavy.weightCoverageFraction).toBeCloseTo(7 / 11, 5);
    expect(thinButHeavy.fieldCoverageFraction).toBe(0.2);
    expect(thinButHeavy.coverageFraction).toBe(0.2);
    expect(thinButHeavy.coverageFraction).toBeLessThan(
      thinButHeavy.weightCoverageFraction,
    );
  });
});

describe("scoreBuyer / scoreSupplier / composite", () => {
  it("buyer with only YIB + license + platform trust", () => {
    const r = scoreBuyer({
      yearsInBusiness: 5,
      importLicenseStatus: 100,
      tmPlatformTrust: true,
    });
    expect(r.possibleWeight).toBe(40);
    // YIB(7) + license(2) + paymentDelay optimistic default(4) = 13
    expect(r.filledWeight).toBe(13);
    expect(r.rawAverage).toBeCloseTo(950 / 13, 5);
    expect(r.trustBonus).toBe(3);
    expect(r.score).toBeGreaterThan(50);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("supplier customs-style enrichment", () => {
    const r = scoreSupplier({
      yearsInBusiness: 10,
      exportLicenseStatus: 100,
      annualExportVolumeMt: 3_000,
      productionCapacityMt: 3_000,
      yearlySalesUsd: 5_000_000,
      routeDiversity: 4,
      platformTransactionCount: 5,
      onlineVerifiability: 55,
      tmPlatformTrust: true,
    });
    expect(r.coverageFraction).toBeGreaterThan(0.5);
    expect(r.score).toBeGreaterThan(70);
  });

  it("relationship zeros are real findings (not excluded)", () => {
    const r = scoreRelationship({
      priorDealsBetweenParties: 0,
      relationshipAgeMonths: 0,
    });
    expect(r.rawAverage).toBe(0);
    expect(r.coverageFraction).toBe(1);
    expect(r.score).toBe(0);
  });

  it("composite adds both trust bonuses", () => {
    const r = scoreComposite({
      buyer: { yearsInBusiness: 10, tmPlatformTrust: true },
      supplier: { yearsInBusiness: 10, tmPlatformTrust: true },
      relationship: { priorDealsBetweenParties: 3, relationshipAgeMonths: 12 },
    });
    expect(r.trustBonus).toBe(6);
  });
});
