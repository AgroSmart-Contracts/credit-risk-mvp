import { describe, expect, it } from "vitest";
import { PORTFOLIO } from "../../data/bcp/dataset";
import { cashCalendar, driverSum, fundsTotals, scoreOf, stressGrid, loanFunds, portfolioFigures, provision, scenarios, stateFromCoverage, SEVERITY, toDisburse } from "./calc";

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

  it("portfolio coverage is the disbursement-weighted average: 1.80x", () => {
    expect(F.coverage).toBe(1.8);
  });

  it("exposure by state sums to disbursed", () => {
    expect(F.byState.verde).toEqual({ usd: 29_400, n: 2 });
    expect(F.byState.ambar).toEqual({ usd: 20_400, n: 2 });
    expect(F.byState.naranja).toEqual({ usd: 16_800, n: 1 });
    expect(F.byState.rojo).toEqual({ usd: 0, n: 0 });
    expect(Object.values(F.byState).reduce((s, x) => s + x.usd, 0)).toBe(F.disbursed);
  });

  it("capital maturities: mar 2027 90,000 and abr 2027 60,000", () => {
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

  it("state is the most severe of the coverage band and the agreed triggers", () => {
    for (const l of PORTFOLIO.loans) expect(SEVERITY[l.state]).toBeGreaterThanOrEqual(SEVERITY[stateFromCoverage(l.coverageToday)]);
  });
});

describe("ICA-0188 worked example (spec 9.3)", () => {
  const l = loan("ICA-0188");
  it("coverage 2.10x → 1.75x, scenarios 1.40x and 1.23x, break-even 1.11", () => {
    expect(l.coverageHistory.at(-1)!.value).toBe(1.75);
    expect(scenarios(l).map((s) => s.coverage)).toEqual([1.4, 1.23]);
    expect(Math.round((l.expectedPriceUsdKg / l.coverageToday) * 100) / 100).toBe(l.breakEvenPriceUsdKg);
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
  it("money out equals what is still to disburse; money back equals the amounts due", () => {
    const cal = cashCalendar(PORTFOLIO.loans, PORTFOLIO.cutoff);
    expect(cal.reduce((s, r) => s + r.out, 0)).toBe(76_200);
    // Principal back: the line less what is frozen (frozen money is not lent).
    expect(cal.reduce((s, r) => s + r.back, 0)).toBe(150_000 - 7_200);
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
      expect(a.dueAtMaturityUsd).toBe(Math.round(a.requestedUsd * 1.05));
      expect(scoreOf(a.scoreDims, "today")).toBe(a.score);
      if (a.veto) expect(a.recommendation).toBe("rechazar");
    }
  });
  it("stress grid: no shock is today's coverage; the worst corner is price -30% and volume -30%", () => {
    const g = stressGrid(1.75);
    expect(g[0].cells[0].coverage).toBe(1.75);
    expect(g[2].cells[3].coverage).toBe(0.86);
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
