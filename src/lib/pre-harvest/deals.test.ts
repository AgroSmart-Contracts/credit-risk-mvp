import { describe, expect, it } from "vitest";
import { APPLICATION_0142_2627, APPLICATION_0177_2627, LIVE_0188_2627 } from "../../data/pre-harvest/deals";
import { SEED_PRE_HARVEST_DEAL as SEED } from "../../data/pre-harvest/seed-deal";
import { DATA_UNTIL, monitoringDataFor } from "../../data/pre-harvest";
import { scorePreHarvest } from "./scoring";
import { simulateCampaign } from "./timeline";
import { fileStatus } from "./verdict";
import { CLOSED_VIR_0311_2324 } from "../../data/pre-harvest/deal-viru-0311";

describe("planting validation", () => {
  it("vetoes when the satellite sees no standing crop before approval", () => {
    const a = scorePreHarvest(SEED, { ndviVsMedianPct: null, enso: 0.4, cropPresenceNdvi: 0.11, seasonalMinNdvi: null });
    expect(a.tier).toBe("VETO");
    expect(a.vetoReasons.map((r) => r.en).join(" ")).toContain("no standing crop");
  });

  it("passes a standing orchard", () => {
    expect(scorePreHarvest(SEED, { ndviVsMedianPct: 0, enso: 0.4, cropPresenceNdvi: 0.7, seasonalMinNdvi: 0.6 }).tier).not.toBe("VETO");
  });

  it("catches the real case: ICA-0142's orchard was cleared in May 2026, so its 2026-27 application is vetoed", () => {
    const sim = simulateCampaign(APPLICATION_0142_2627, monitoringDataFor("ica-0142"), DATA_UNTIL);
    expect(sim.signals.cropPresenceNdvi).toBeLessThan(0.2);
    expect(sim.origination.tier).toBe("VETO");
    expect(sim.frames.every((f) => f.action === "stop")).toBe(true);
    expect(sim.frames.at(-1)!.outstandingUsd).toBe(0);
  });

  it("the 2025-26 campaign on the same parcel passed: the orchard was standing then", () => {
    const sim = simulateCampaign(SEED, monitoringDataFor("ica-0142"));
    expect(sim.signals.cropPresenceNdvi).toBeGreaterThan(0.5);
    expect(sim.origination.tier).not.toBe("VETO");
  });
});

describe("live campaign", () => {
  it("is monitored only up to the last date with data", () => {
    const sim = simulateCampaign(LIVE_0188_2627, monitoringDataFor("ica-0188"), DATA_UNTIL);
    expect(sim.frames.at(-1)!.date <= DATA_UNTIL).toBe(true);
    expect(sim.frames.length).toBeLessThan(27);
  });
});

describe("crop-type validation", () => {
  it("flags a declared evergreen crop whose NDVI goes dormant during the year", () => {
    const a = scorePreHarvest(SEED, { ndviVsMedianPct: 0, enso: 0.4, cropPresenceNdvi: 0.7, seasonalMinNdvi: 0.2 });
    expect(a.tier).toBe("VETO");
    expect(a.vetoReasons.map((r) => r.en).join(" ")).toContain("does not match the declared Hass avocado");
  });

  it("catches the real case: ICA-0177's block is pruned bare every June (a vineyard), not avocado", () => {
    const sim = simulateCampaign(APPLICATION_0177_2627, monitoringDataFor("ica-0177"), DATA_UNTIL);
    expect(sim.signals.seasonalMinNdvi).toBeLessThan(0.35);
    expect(sim.origination.tier).toBe("VETO");
  });

  it("passes the evergreen blocks", () => {
    const seed = simulateCampaign(SEED, monitoringDataFor("ica-0142"));
    expect(seed.signals.seasonalMinNdvi).toBeGreaterThan(0.4);
    expect(seed.origination.tier).not.toBe("VETO");
  });
});

describe("Chavimochic 2023-24 (completed campaign, real data)", () => {
  const sim = simulateCampaign(CLOSED_VIR_0311_2324, monitoringDataFor("viru-0311"));

  it("passes the planting and crop-type checks on the evergreen block", () => {
    expect(sim.signals.cropPresenceNdvi).toBeGreaterThan(0.35);
    expect(sim.signals.seasonalMinNdvi).toBeGreaterThan(0.4);
    expect(sim.origination.tier).not.toBe("VETO");
  });

  it("flags the 2023 coastal El Niño at approval", () => {
    expect(sim.signals.enso).toBeGreaterThan(1.7);
    expect(sim.frames[0].panels.weather.severity).toBe("red");
  });

  it("gives a young orchard no vigour baseline instead of an inflated one", () => {
    expect(sim.signals.ndviVsMedianPct).toBeNull();
  });

  it("holds the fruit-set tranche under the alert, then is repaid by the takeout", () => {
    const last = sim.frames.at(-1)!;
    const fruit = last.tranches.find((t) => t.id === "fruit_set")!;
    expect(fruit.releasedOn! > fruit.dueDate).toBe(true);
    expect(fileStatus(last).status).toBe("repaid");
  });
});
