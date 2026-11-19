import { describe, expect, it } from "vitest";
import { SEED_PRE_HARVEST_DEAL as SEED } from "../../data/pre-harvest/seed-deal";
import { CACHED_MONITORING_DATA as DATA } from "../../data/pre-harvest";
import { TAKEOUT_THRESHOLDS as TT } from "./config";
import { addDays, evaluateTakeout } from "./monitoring";
import { simulateStressed, type ScenarioId } from "./stress-fixtures";
import type { TakeoutInputs } from "./types";

const DUE = 72_975; // USD 70,000 + 8.5% for 180 days
const at = (patch: Partial<TakeoutInputs>, date = addDays(SEED.m3Date, 1)) =>
  evaluateTakeout({ ...SEED.takeout, ...patch }, SEED, date, DUE);

describe("M3 takeout", () => {
  it("is pending (green) before M3", () => {
    const r = at({}, addDays(SEED.m3Date, -1));
    expect(r.stage).toBe("pending");
    expect(r.severity).toBe("green");
  });

  it("covers the seed loan: 88 t × $1.70 × 90% Coface × 70% advance = 1.29×", () => {
    const r = at({});
    expect(r.advanceUsd).toBe(94_248);
    expect(r.coverage).toBeCloseTo(1.29, 2);
    expect(r.severity).toBe("green");
  });

  it(`grades coverage at ${TT.coverageYellow}× / ${TT.coverageRed}×`, () => {
    expect(at({ poPriceUsdPerKg: 1.4 }).severity).toBe("yellow"); // 1.06×
    expect(at({ poPriceUsdPerKg: 1.2 }).severity).toBe("red"); // 0.91×
  });

  it(`flags a missing PO yellow at M3 and red after ${TT.graceDays} days`, () => {
    expect(at({ poSignedDate: null }).severity).toBe("yellow");
    expect(at({ poSignedDate: null }, addDays(SEED.m3Date, TT.graceDays)).severity).toBe("red");
  });

  it("is red when Coface declines the buyer, yellow when it trims the limit", () => {
    expect(at({ coface: "declined" }).severity).toBe("red");
    expect(at({ coface: "reduced", cofaceCoveragePct: 85 }).triggers.map((t) => t.metric)).toContain("coface");
  });

  it("follows the scenarios: a weak crop or a price collapse breaks the takeout", () => {
    const final = (s: ScenarioId) => simulateStressed(SEED, DATA, s).frames.at(-1)!.panels.takeout.severity;
    expect(final("baseline")).toBe("green");
    expect(final("bad_quality")).toBe("red");
    expect(final("cant_repay")).toBe("red");
  });
});
