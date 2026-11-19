import { describe, expect, it } from "vitest";
import { PORTFOLIO } from "./dataset";
import { GEO, ensoClass, num, technicalSeries } from "./technical";

const cond = (id: string, es: string) => PORTFOLIO.loans.find((l) => l.id === id)!.conditions.find((c) => c.label.es === es)!;

describe("technical series never contradict the file", () => {
  for (const loan of PORTFOLIO.loans) {
    const s = technicalSeries(loan, PORTFOLIO.cutoff);
    it(`${loan.id}: vigour, water and price start at approval and end at today's value`, () => {
      for (const [series, label] of [
        [s.vigor, "Vigor del cultivo vs lo normal del lote"],
        [s.agua, "Agua disponible vs necesidad"],
        [s.precio, "Precio esperado a cosecha"],
      ] as const) {
        const c = cond(loan.id, label);
        expect(series.find((p) => p.date === loan.approvalDate)?.v).toBe(num(c.atApproval.es));
        expect(series.at(-1)).toEqual({ date: PORTFOLIO.cutoff, v: num(c.today.es) });
      }
    });
    it(`${loan.id}: El Niño class at approval and in the last complete month matches the table`, () => {
      const c = cond(loan.id, "El Niño costero");
      // Known at approval: the last complete month before the approval month.
      const i = s.enso.findIndex((p) => p.date.slice(0, 7) === loan.approvalDate.slice(0, 7));
      const atApp = s.enso[i - 1];
      expect(ensoClass(atApp.v).es).toBe(c.atApproval.es);
      expect(ensoClass(s.enso.at(-2)!.v).es).toBe(c.today.es);
    });
    it(`${loan.id}: has a location and real weather history to the cut-off`, () => {
      expect(GEO[loan.id]).toBeDefined();
      expect(s.clima.length).toBeGreaterThan(60);
      expect(s.clima.at(-1)!.date <= PORTFOLIO.cutoff).toBe(true);
    });
  }
});
