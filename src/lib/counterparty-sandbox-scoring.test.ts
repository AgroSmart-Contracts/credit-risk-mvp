/**
 * Unit tests for the sandbox counterparty weighted/shrink formula
 * (counterparty-risk-scoring-method-outline-2026-07-30.md).
 */
import { describe, expect, it } from "vitest";
import {
  SANDBOX_NEUTRAL,
  scoreBuyer,
  scoreComposite,
  scorePriorDeals,
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
    expect(r.coverageFraction).toBe(0.5);
    expect(r.shrunkScore).toBe(0.5 * 100 + 0.5 * 50);
    expect(r.score).toBe(75);
  });

  it("fully blank profile lands on neutral 50", () => {
    const r = scoreWeightedGroup([
      { id: "a", label: "a", weight: 4, score: null },
      { id: "b", label: "b", weight: 4, score: null },
    ]);
    expect(r.rawAverage).toBeNull();
    expect(r.shrunkScore).toBe(SANDBOX_NEUTRAL);
    expect(r.score).toBe(50);
  });

  it("adds trust bonus flat after shrinkage, capped at 100", () => {
    const r = scoreWeightedGroup(
      [{ id: "a", label: "a", weight: 1, score: 100 }],
      3,
    );
    expect(r.shrunkScore).toBe(100);
    expect(r.score).toBe(100);
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
    expect(r.filledWeight).toBe(9);
    expect(r.rawAverage).toBeCloseTo(550 / 9, 5);
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
