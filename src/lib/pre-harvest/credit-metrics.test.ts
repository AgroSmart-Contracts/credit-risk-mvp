import { describe, expect, it } from "vitest";
import { SEED_PRE_HARVEST_DEAL as SEED } from "../../data/pre-harvest/seed-deal";
import { CACHED_MONITORING_DATA } from "../../data/pre-harvest";
import {
  amountDueUsd,
  breakevenPrice,
  expectedLoss,
  keyRisksAndMitigants,
  lgdPct,
  recommendationFor,
  sbsProvision,
  stressMatrix,
  trancheConditions,
} from "./credit-metrics";
import { scorePreHarvest } from "./scoring";
import { simulateCampaign } from "./timeline";
import { simulateStressed } from "./stress-fixtures";
import type { MonitoringData, PreHarvestDeal } from "./types";

const SIGNALS = { ndviVsMedianPct: -3.6, enso: 0.43, cropPresenceNdvi: 0.7, seasonalMinNdvi: 0.6 };
const DATA: MonitoringData = CACHED_MONITORING_DATA;
const clone = (patch: (d: PreHarvestDeal) => void) => {
  const d = structuredClone(SEED);
  patch(d);
  return d;
};

describe("credit metrics", () => {
  it("maps tiers to a recommendation", () => {
    expect(["A", "B", "C", "D", "VETO"].map((t) => recommendationFor(t as never))).toEqual([
      "approve",
      "approve_conditions",
      "committee",
      "decline",
      "decline",
    ]);
  });

  it("adds interest for the tenor to the amount due", () => {
    expect(amountDueUsd(SEED, 8.5)).toBeCloseTo(72_975, 0);
  });

  it("reduces LGD for insurance, land and proceeds assignment, with a floor", () => {
    expect(lgdPct(SEED)).toBe(25); // 60 − 2 layers×10 − land 10 − assignment 5
    const bare = clone((d) => {
      d.checks.insurance = { ...d.checks.insurance, commercial: false, parametric: false };
      d.checks.sunarp.tenure = "leased";
      d.packhouseAssignment = false;
    });
    expect(lgdPct(bare)).toBe(60);
    const all = clone((d) => (d.checks.insurance = { ...d.checks.insurance, catastrophic: true }));
    expect(lgdPct(all)).toBe(20);
  });

  it("computes expected loss as PD × LGD × EAD", () => {
    expect(expectedLoss(SEED, "B")).toMatchObject({ pdPct: 2.5, lgdPct: 25, eadUsd: 70_000, elUsd: 438 });
  });

  it("applies the SBS provision rate for the client's rating", () => {
    expect(sbsProvision(SEED)).toEqual({ ratePct: 1, amountUsd: 700 });
    expect(sbsProvision(clone((d) => (d.checks.credit.rating = "Deficiente")))).toEqual({ ratePct: 25, amountUsd: 17_500 });
  });

  it("finds the FOB break-even price that repays principal + interest", () => {
    // 72,975 ÷ (9.24 ha × 15 t × 80% exportable × 65% farm-gate) = 1.0125 $/kg
    expect(breakevenPrice(SEED, 8.5)).toBeCloseTo(1.0125, 3);
    expect(breakevenPrice(SEED, 8.5, 0.8)).toBeGreaterThan(breakevenPrice(SEED, 8.5));
  });

  it("builds a price × yield stress grid that falls monotonically", () => {
    const grid = stressMatrix(SEED, 8.5, 2);
    expect(grid[0].cells[0].coverage).toBeCloseTo(2.0, 1);
    for (const row of grid) {
      const c = row.cells.map((x) => x.coverage);
      expect([...c].sort((a, b) => b - a)).toEqual(c);
    }
    expect(grid.at(-1)!.cells.at(-1)!.coverage).toBeLessThan(grid[0].cells[0].coverage);
  });

  it("lists the weakest score lines as risks and the strongest as mitigants", () => {
    const { risks, mitigants } = keyRisksAndMitigants(scorePreHarvest(SEED, SIGNALS));
    expect(risks.every((r) => r.points < 0)).toBe(true);
    expect(risks[0].label.en).toBe("Own export track record");
    expect(mitigants).toHaveLength(3);
    expect(mitigants.every((m) => m.points > 0)).toBe(true);
  });

  it("meets every approval condition for the seed deal", () => {
    const sim = simulateCampaign(SEED, DATA);
    const f = sim.frames[0];
    const approval = f.tranches.find((t) => t.id === "approval")!;
    expect(trancheConditions(SEED, approval, f, 0, 1).every((c) => c.status === "met")).toBe(true);
  });

  it("fails the fruit-set conditions in the bad-quality scenario once due", () => {
    const sim = simulateStressed(SEED, DATA, "bad_quality");
    const f = sim.frames.at(-1)!;
    const fruit = f.tranches.find((t) => t.id === "fruit_set")!;
    expect(trancheConditions(SEED, fruit, f, sim.fruitSetDelayDays, 0.7).some((c) => c.status === "failed")).toBe(true);
  });
});
