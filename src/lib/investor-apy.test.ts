import { describe, expect, it } from "vitest";
import {
  clampInvestorApyPct,
  expectedInvestorReturnUsd,
  investorApyPct,
  investorApyPctFromOverall,
} from "./investor-apy";

describe("investorApyPctFromOverall", () => {
  it("maps higher scores to lower APY within 10–18", () => {
    expect(investorApyPctFromOverall(95)).toBe(10);
    expect(investorApyPctFromOverall(82)).toBe(11);
    expect(investorApyPctFromOverall(72)).toBe(13);
    expect(investorApyPctFromOverall(58)).toBe(16);
    expect(investorApyPctFromOverall(40)).toBe(18);
  });
});

describe("investorApyPct", () => {
  it("adds uncertainty premium and caps at 18", () => {
    expect(investorApyPct(90, 0)).toBe(10);
    expect(investorApyPct(90, 1.0)).toBe(11);
    expect(investorApyPct(50, 2.5)).toBe(18); // 17 + 2.5 → 18
  });

  it("never goes below 10", () => {
    expect(clampInvestorApyPct(9)).toBe(10);
  });
});

describe("expectedInvestorReturnUsd", () => {
  it("annualizes over tenor months", () => {
    // $100k @ 12% for 2 months = 100000 * 0.12 * (2/12) = 2000
    expect(expectedInvestorReturnUsd(100_000, 12, 2)).toBe(2000);
  });
});
