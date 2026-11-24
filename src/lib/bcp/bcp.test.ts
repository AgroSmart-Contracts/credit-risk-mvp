import { describe, expect, it } from "vitest";
import { PORTFOLIO } from "../../data/bcp/dataset";
import { RULINGS } from "../../data/bcp/rulings";
import { COST_USD_KG, accruedCost, cashCalendar, daysBetween, dueAt, coverageUnder, driverSum, fundsTotals, harvestBuild, priceEffect, scoreOf, stateCause, stressGrid, loanFunds, portfolioFigures, provision, scenarios, stateFromCoverage, SEVERITY, toDisburse, worstOf } from "./calc";

const F = portfolioFigures(PORTFOLIO.loans);
const loan = (id: string) => PORTFOLIO.loans.find((l) => l.id === id)!;

describe("BCP portfolio reconciles (spec 9.1)", () => {
  it("line, disbursed, frozen and to-disburse add up", () => {
    expect(F.line).toBe(150_000);
    expect(F.disbursed).toBe(66_600);
    expect(F.frozen).toBe(7_200);
    expect(F.pending).toBe(76_200);
    expect(F.disbursed + F.frozen + F.pending).toBe(F.line);
  });

  it("portfolio coverage is total net revenue over total amount due: 1.78x", () => {
    expect(F.due).toBe(158_085);
    expect(F.netRevenue).toBe(PORTFOLIO.loans.reduce((s, l) => s + harvestBuild(l).netUsd, 0));
    expect(F.coverage).toBe(1.78);
  });

  it("portfolio stress on net revenue: price -20% 1.27x, volume -30% 1.24x, both 0.89x", () => {
    expect(F.stress.price.coverage).toBe(1.27);
    expect(F.stress.volume.coverage).toBe(1.24);
    expect(F.stress.both.coverage).toBe(0.89);
    expect(F.stress.price.below).toEqual({ ambar: 5, naranja: 3, rojo: 0 });
    expect(F.stress.both.below.rojo).toBe(5);
  });

  it("exposure by state sums to disbursed", () => {
    // ICA-0188 (10,800) is amber on vigour only while technical signals may set a state.
    const v = RULINGS.technicalSignalsSetState ? 0 : 10_800;
    expect(F.byState.verde).toEqual({ usd: 29_400 + v, n: v ? 3 : 2 });
    expect(F.byState.ambar).toEqual({ usd: 20_400 - v, n: v ? 1 : 2 });
    expect(F.byState.naranja).toEqual({ usd: 16_800, n: 1 });
    expect(F.byState.rojo).toEqual({ usd: 0, n: 0 });
    expect(Object.values(F.byState).reduce((s, x) => s + x.usd, 0)).toBe(F.disbursed);
  });

  it("principal maturities on the full committed line: mar 2027 90,000 and abr 2027 60,000", () => {
    expect(F.maturities).toEqual([
      ["2027-03", 90_000],
      ["2027-04", 60_000],
    ]);
  });

  it("SBS provision 1% of disbursed: 666 (ICA-0188: 108)", () => {
    expect(F.provision).toBe(666);
    expect(provision(loan("ICA-0188"))).toBe(108);
  });

  it("use of funds: 93% reconciled, 72% paid direct, 4,930 unexplained, no cash", () => {
    expect(Math.round(F.reconciledPct)).toBe(93);
    expect(Math.round(F.directPct)).toBe(72);
    expect(F.unexplained).toBe(4_930);
    expect(F.cash).toBe(0);
    const per = Object.fromEntries(PORTFOLIO.loans.map((l) => [l.id, loanFunds(l)]));
    expect(per["ICA-0201"].unexplained).toBe(3_220);
    expect(per["ICA-0188"].unexplained).toBe(420);
    expect(per["ICA-0215"].unexplained).toBe(580);
    expect(per["PIS-0034"].unexplained).toBe(80);
    expect(per["ICA-0142"].unexplained).toBe(630);
  });

  it("7 of 7 tranches released with a complete checklist and the bank's conformity", () => {
    expect(F.tranchesReleased).toBe(7);
    expect(F.tranchesWithConformity).toBe(7);
  });

  it("each loan: disbursed equals its released tranches, and funds cover what was disbursed", () => {
    for (const l of PORTFOLIO.loans) {
      const released = l.tranches.filter((t) => t.status === "liberado").reduce((s, t) => s + t.amountUsd, 0);
      const frozen = l.tranches.filter((t) => t.status === "congelado").reduce((s, t) => s + t.amountUsd, 0);
      expect(released).toBe(l.disbursedUsd);
      expect(frozen).toBe(l.frozenUsd);
      expect(l.tranches.reduce((s, t) => s + t.amountUsd, 0)).toBe(l.lineUsd);
      expect(loanFunds(l).budget).toBe(l.disbursedUsd);
      expect(toDisburse(l)).toBeGreaterThanOrEqual(0);
    }
  });

  it("driver deltas sum to the coverage change on every loan", () => {
    for (const l of PORTFOLIO.loans) expect(driverSum(l)).toBeCloseTo(l.coverageToday - l.coverageAtApproval, 2);
  });

  it("state is the worse of the coverage band and the controls; only a pending technical ruling may exceed both", () => {
    for (const l of PORTFOLIO.loans) {
      expect(SEVERITY[l.state]).toBeGreaterThanOrEqual(SEVERITY[stateFromCoverage(l.coverageToday)]);
      if (stateCause(l) !== "tecnica") expect(l.state).toBe(worstOf(stateFromCoverage(l.coverageToday), l.controlsState));
    }
    expect(Object.fromEntries(PORTFOLIO.loans.map((l) => [l.id, stateCause(l)]))).toEqual({ "ICA-0201": "control", "ICA-0188": RULINGS.technicalSignalsSetState ? "tecnica" : null, "ICA-0215": "control", "PIS-0034": null, "ICA-0142": null });
    if (!RULINGS.technicalSignalsSetState) for (const l of PORTFOLIO.loans) expect(stateCause(l)).not.toBe("tecnica");
  });

  it("the amount due is the full line plus the estimated cost for its tenor (5% at 180 days)", () => {
    for (const l of PORTFOLIO.loans) expect(l.dueAtMaturityUsd).toBe(dueAt(l.lineUsd, daysBetween(l.approvalDate, l.maturityDate)));
    expect(dueAt(36_000, 180)).toBe(37_800);
    expect(dueAt(24_000, 200)).toBe(25_333);
  });

  it("cost accrued to date on what was disbursed: 797 across the portfolio, 210 on ICA-0201", () => {
    expect(accruedCost(loan("ICA-0201"), PORTFOLIO.cutoff)).toBe(210);
    expect(PORTFOLIO.loans.reduce((s, l) => s + accruedCost(l, PORTFOLIO.cutoff), 0)).toBe(797);
  });

  it("every coverage figure is rebuilt from its harvest inputs", () => {
    for (const l of PORTFOLIO.loans) {
      const b = harvestBuild(l);
      expect(l.volumeKg).toBe(Math.round(l.areaHa * l.yieldTHa * 1000));
      expect(b.netUsd).toBe(b.grossUsd - b.costUsd);
      expect(l.coverageToday).toBe(Math.round((b.netUsd / l.dueAtMaturityUsd) * 100) / 100);
      expect(l.breakEvenPriceUsdKg).toBe(Math.round((COST_USD_KG + l.dueAtMaturityUsd / b.exportKg) * 100) / 100);
    }
    expect(PORTFOLIO.loans.map((l) => l.coverageToday)).toEqual([1.57, 1.75, 1.6, 1.9, 2.05]);
  });

  it("the price driver is the change in expected price at today's exportable volume", () => {
    for (const l of PORTFOLIO.loans) expect(priceEffect(l, l.approvalPriceUsdKg)).toBe(l.driverDeltas.precio);
  });

  it("approval prices follow one market curve: same date, same price", () => {
    const byDate = new Map<string, number>();
    for (const l of PORTFOLIO.loans) {
      if (byDate.has(l.approvalDate)) expect(l.approvalPriceUsdKg).toBe(byDate.get(l.approvalDate));
      byDate.set(l.approvalDate, l.approvalPriceUsdKg);
    }
  });
});

describe("ICA-0188 worked example (spec 9.3)", () => {
  const l = loan("ICA-0188");
  it("coverage 2.10x → 1.75x; on net revenue, price -20% 1.25x, volume -30% 1.22x, break-even 1.35", () => {
    expect(l.coverageHistory.at(-1)!.value).toBe(1.75);
    expect(scenarios(l).map((s) => s.coverage)).toEqual([1.25, 1.22]);
    expect(l.breakEvenPriceUsdKg).toBe(1.35);
  });
  it("T1 use of funds: 10,800 budget, 10,380 reconciled, 72% direct", () => {
    const t = fundsTotals(l.useOfFunds[0].lines);
    expect(t.budget).toBe(10_800);
    expect(t.reconciled).toBe(10_380);
    expect(Math.round(t.directPct)).toBe(72);
  });
});

describe("copy rules (spec 2.7 and 2.9)", () => {
  const all = JSON.stringify(PORTFOLIO);
  it("no em or en dashes", () => {
    expect(all).not.toMatch(/[–—]/);
  });
  it("no forbidden words or names", () => {
    expect(all).not.toMatch(/\b(demo|mock|simulaci[oó]n|IA|AI)\b|inteligencia artificial|Coface|Veritrade|Comtrade/i);
  });
});

describe("cash calendar", () => {
  it("one basis with coverage: the frozen tranche counts as if released and the amount due comes back", () => {
    const cal = cashCalendar(PORTFOLIO.loans, PORTFOLIO.cutoff);
    expect(cal.reduce((s, r) => s + r.out, 0)).toBe(76_200 + 7_200);
    expect(cal.reduce((s, r) => s + r.back, 0)).toBe(158_085);
    expect(cal.reduce((s, r) => s + r.principal, 0)).toBe(150_000);
    const ica0201 = cal.flatMap((r) => r.items).find((x) => x.loanId === "ICA-0201" && x.dir === "back")!;
    expect(ica0201.amount).toBe(25_333);
    expect(cal[0].month.slice(0, 7)).toBe("2026-11");
  });
});

describe("score breakdowns and applications", () => {
  it("each loan's score is the weighted sum of its dimensions, at approval and today", () => {
    for (const l of PORTFOLIO.loans) {
      expect(scoreOf(l.scoreDims, "approval")).toBe(l.scoreAtApproval);
      expect(scoreOf(l.scoreDims, "today")).toBe(l.scoreToday);
      expect(l.scoreDims.reduce((s, d) => s + d.weight, 0)).toBeCloseTo(1, 5);
    }
  });
  it("applications: tranches add up to the request, due includes the bank cost, score adds up", () => {
    for (const a of PORTFOLIO.applications) {
      expect(a.tranches.reduce((s, t) => s + t.amountUsd, 0)).toBe(a.requestedUsd);
      expect(a.dueAtMaturityUsd).toBe(dueAt(a.requestedUsd, a.tenorDays));
      expect(scoreOf(a.scoreDims, "today")).toBe(a.score);
      if (a.veto) expect(a.recommendation).toBe("rechazar");
    }
  });
  it("a recommendation that fails the standard stress carries a condition that passes it (ICA-0244)", () => {
    const a = PORTFOLIO.applications.find((x) => x.id === "ICA-0244")!;
    expect(a.coverage).toBe(1.85);
    expect([coverageUnder(a, -0.2), coverageUnder(a, 0, -0.3)]).toEqual([1.33, 1.29]);
    expect(a.recommendation).toBe("aprobar_condicion");
    const due = a.condition!.dueAtMaturityUsd;
    expect(due).toBe(dueAt(a.condition!.lineUsd, a.tenorDays));
    expect([coverageUnder(a, 0, 0, due), coverageUnder(a, -0.2, 0, due), coverageUnder(a, 0, -0.3, due)]).toEqual([2.18, 1.56, 1.52]);
    // The largest line in thousands that passes both cases.
    expect(coverageUnder(a, 0, -0.3, dueAt(a.condition!.lineUsd + 1000, a.tenorDays))).toBeLessThan(1.5);
  });
  it("stress grid on net revenue: today's coverage at no shock; ICA-0201 worst corner 0.63x", () => {
    const l = loan("ICA-0201");
    const g = stressGrid(l);
    expect(g[0].cells[0].coverage).toBe(1.57);
    expect(g[0].cells[2].coverage).toBe(1.13);
    expect(g[2].cells[3].coverage).toBe(0.63);
  });
});

describe("evidence links", () => {
  it("every change and cause points to an existing condition row", () => {
    for (const c of PORTFOLIO.changes) {
      if (!c.evidence) continue;
      const loan = PORTFOLIO.loans.find((l) => l.id === c.evidence!.loanId)!;
      expect(loan.conditions.some((x) => x.label.es === c.evidence!.condition)).toBe(true);
    }
    for (const l of PORTFOLIO.loans) for (const cause of l.causes) if (cause.condition) expect(l.conditions.some((x) => x.label.es === cause.condition)).toBe(true);
  });
});

describe("projections include every estimated risk on a loan", () => {
  it("every loan under the El Niño watch carries it in its projection (-0.10x to -0.20x at least)", () => {
    for (const l of PORTFOLIO.loans) {
      const watched = l.conditions.some((c) => c.label.es === "El Niño costero" && c.state === "observacion");
      if (!watched) continue;
      expect(l.projection, l.id).toBeDefined();
      expect(l.projection!.high).toBeLessThanOrEqual(Math.round((l.coverageToday - 0.1) * 100) / 100);
      expect(l.projection!.low).toBeLessThanOrEqual(Math.round((l.coverageToday - 0.2) * 100) / 100);
    }
  });
  it("ICA-0201 adds the late fertilisation (-0.27x to -0.42x) to El Niño", () => {
    const l = PORTFOLIO.loans.find((x) => x.id === "ICA-0201")!;
    expect(l.projection).toMatchObject({ low: 0.95, high: 1.2 });
  });
  it("the portfolio projection weights loan projections by amount due, as portfolio coverage", () => {
    const w = PORTFOLIO.loans.reduce((s, l) => s + l.dueAtMaturityUsd, 0);
    const at = (k: "low" | "high") => Math.round((PORTFOLIO.loans.reduce((s, l) => s + l.dueAtMaturityUsd * l.projection![k], 0) / w) * 100) / 100;
    expect(PORTFOLIO.projection).toMatchObject({ low: at("low"), high: at("high") });
    expect(PORTFOLIO.projection).toMatchObject({ low: 1.51, high: 1.63 });
    expect(PORTFOLIO.projection.text.es).toContain(`${at("low").toFixed(2)}x a ${at("high").toFixed(2)}x`);
  });
});
