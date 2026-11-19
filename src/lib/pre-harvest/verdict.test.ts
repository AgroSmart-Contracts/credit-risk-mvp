import { describe, expect, it } from "vitest";
import { SEED_PRE_HARVEST_DEAL as SEED } from "../../data/pre-harvest/seed-deal";
import { CACHED_MONITORING_DATA } from "../../data/pre-harvest";
import { simulateCampaign } from "./timeline";
import { simulateStressed } from "./stress-fixtures";
import { monitoringVerdict, panelConclusions } from "./verdict";
import type { MonitoringData } from "./types";

const DATA: MonitoringData = CACHED_MONITORING_DATA;

describe("monitoring verdict", () => {
  it("at approval: continue and name the next tranche", () => {
    const sim = simulateCampaign(SEED, DATA);
    const v = monitoringVerdict(sim.frames[0]);
    expect(v.action).toBe("continue");
    expect(v.text.es).toMatch(/^Mantener\. Liberar el tramo 40%/);
    expect(v.text.en).toMatch(/^Continue\. Release tranche 40%/);
  });

  it("when stopped: stop, refer to committee, state exposure and the main red risk", () => {
    const sim = simulateStressed(SEED, DATA, "bad_quality");
    const v = monitoringVerdict(sim.frames.at(-1)!);
    expect(v.action).toBe("stop");
    expect(v.text.es).toContain("Detener desembolsos y elevar a comité de riesgos");
    expect(v.text.es).toContain("USD 21,000");
    expect(v.text.es).toContain("Riesgo principal");
  });

  it("concludes each panel with a headline and an action", () => {
    const sim = simulateStressed(SEED, DATA, "weather_shock");
    const frame = sim.frames.find((f) => f.panels.weather.severity === "red")!;
    const c = panelConclusions(sim, frame, SEED);
    expect(c.weather.headline.es).toBe("Riesgo climático: Alto");
    expect(c.weather.action).toBe("hold_tranche");
    expect(c.crop.headline.en).toMatch(/^Expected yield \d+% of declared$/);
    expect(c.market.headline.en).toMatch(/^Harvest covers principal \+ interest \d\.\d\d×$/);
  });
});
