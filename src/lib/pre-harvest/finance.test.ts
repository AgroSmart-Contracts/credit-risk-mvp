import { describe, expect, it } from "vitest";
import { LIVE_0188_2627 } from "../../data/pre-harvest/deals";
import { CLOSED_VIR_0311_2324 as VIRU } from "../../data/pre-harvest/deal-viru-0311";
import { monitoringDataFor } from "../../data/pre-harvest";
import { simulateFile } from "../../data/pre-harvest/files";
import { bankView, cropOutlook, exposureCurve, financialImpact, moneyPosition, panelMoneyReading, signalMoney } from "./finance";

describe("money position", () => {
  const sim = simulateFile(VIRU);
  const end = sim.frames.at(-1)!;

  it("a repaid loan has nothing out and nothing at risk", () => {
    const m = moneyPosition(VIRU, sim, end);
    expect(m.exposureUsd).toBe(0);
    expect(m.moneyAtRiskUsd).toBe(0);
    expect(m.downsideShortfallUsd).toBeNull();
    expect(m.amountDueUsd).toBeGreaterThan(VIRU.envelopeUsd);
    expect(m.maturityDate).toBe("2024-03-13");
  });

  it("before repayment, the full line out carries money at risk below the exposure", () => {
    const before = sim.frames.filter((f) => f.outstandingUsd === VIRU.envelopeUsd && !f.m3Reached).at(-1)!;
    const m = moneyPosition(VIRU, sim, before);
    expect(m.exposureUsd).toBe(VIRU.envelopeUsd);
    expect(m.moneyAtRiskUsd).toBeGreaterThan(0);
    expect(m.moneyAtRiskUsd).toBeLessThan(m.exposureUsd);
  });

  it("puts nothing at risk before the first tranche goes out", () => {
    const before = { ...sim.frames[0], outstandingUsd: 0 };
    expect(moneyPosition(VIRU, sim, before).moneyAtRiskUsd).toBe(0);
  });
});

describe("financial reading of a TruMarket update", () => {
  const sim = simulateFile(VIRU);

  it("the El Niño alert at approval translates into a decision on money", () => {
    const first = sim.alerts[0];
    const fi = financialImpact(VIRU, sim, first);
    expect(fi.headline.en.length).toBeGreaterThan(10);
    expect(fi.headline.en).not.toMatch(/NDVI|Niño/);
    expect(fi.adverse).toBe(true);
  });

  it("every update carries a money reading in both languages", () => {
    for (const a of sim.alerts) {
      const fi = financialImpact(VIRU, sim, a);
      expect(fi.headline.es).toBeTruthy();
      expect(fi.details.every((d) => d.en && d.es)).toBe(true);
    }
  });

  it("each monitoring area is read in money", () => {
    const frame = sim.frames.at(-1)!;
    for (const p of ["crop", "weather", "market", "takeout"] as const) {
      expect(panelMoneyReading(p, VIRU, sim, frame).en).toMatch(/USD|yield|loan|harvest/);
    }
  });
});

describe("credit timeline", () => {
  it("a repaid loan's exposure comes back to zero at maturity", () => {
    const sim = simulateFile(VIRU);
    const curve = exposureCurve(VIRU, sim, sim.frames.at(-1)!, true);
    expect(curve.at(-1)).toMatchObject({ date: "2024-03-13", actual: 0 });
    expect(Math.max(...curve.map((p) => p.actual ?? 0))).toBe(VIRU.envelopeUsd);
  });

  it("a live loan shows its plan to maturity: the remaining tranches, then repayment", () => {
    const sim = simulateFile(LIVE_0188_2627);
    const frame = sim.frames.at(-1)!;
    const curve = exposureCurve(LIVE_0188_2627, sim, frame);
    const planned = curve.filter((p) => p.planned !== null).map((p) => p.planned!);
    expect(Math.max(...planned)).toBe(LIVE_0188_2627.envelopeUsd);
    expect(planned.at(-1)).toBe(0);
  });
});

describe("expected path to harvest", () => {
  it("projects the live parcel's NDVI to harvest inside a range", () => {
    const sim = simulateFile(LIVE_0188_2627);
    const frame = sim.frames.at(-1)!;
    const out = cropOutlook(monitoringDataFor("ica-0188").ndvi.series, sim.series.crop, frame.date, LIVE_0188_2627.m3Date);
    expect(out.length).toBeGreaterThan(3);
    for (const p of out) {
      expect(p.low).toBeLessThanOrEqual(p.expected);
      expect(p.high).toBeGreaterThanOrEqual(p.expected);
    }
  });
});

describe("the bank's bottom line", () => {
  it("a repaid loan has nothing at stake and reports the interest earned", () => {
    const sim = simulateFile(VIRU);
    const v = bankView(VIRU, sim, sim.frames.at(-1)!);
    expect(v.mood).toBe("settled");
    expect(v.headline.en).toMatch(/interest/);
    expect(v.badCase).toBeNull();
  });

  it("a live loan states what is out, what is due and the cushion in USD, and says why when it is not on track", () => {
    const sim = simulateFile(LIVE_0188_2627);
    const frame = sim.frames.at(-1)!;
    const v = bankView(LIVE_0188_2627, sim, frame);
    const m = moneyPosition(LIVE_0188_2627, sim, frame);
    expect(v.cushionUsd).toBe(m.expectedRepaymentUsd! - m.amountDueUsd);
    expect(v.headline.en).toContain("out");
    if (v.mood !== "comfortable") expect(v.headline.en).toMatch(/^(Weather and water|Crop health|Market|Repayment|Thin cover)[^.]*\./i);
    // The bad case can only be worse than the expected case.
    if (v.badCase) expect(v.badCase.cushionUsd).toBeLessThanOrEqual(v.cushionUsd!);
  });

  it("the price line names the break-even price, consistent with the coverage", () => {
    const sim = simulateFile(LIVE_0188_2627);
    const frame = sim.frames.at(-1)!;
    const line = signalMoney("price", "green", LIVE_0188_2627, sim, frame);
    const be = frame.expectedHarvestPrice! / moneyPosition(LIVE_0188_2627, sim, frame).coverage!;
    expect(line?.en).toContain(`USD ${be.toFixed(2)}/kg`);
  });
});
