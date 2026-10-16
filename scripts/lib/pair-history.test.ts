import { describe, expect, it } from "vitest";
import { assignChronologicalPairHistory } from "./pair-history";
import type { PlatformDealRecord } from "../../src/types/platform";

function deal(id: string, buyerName: string, supplierName: string, date: string): PlatformDealRecord {
  return {
    mongoId: id,
    buyerName,
    supplierName,
    shippingStartDate: `${date}T00:00:00.000Z`,
    createdAt: "",
    priorDealsBetweenParties: 99,
    relationshipAgeMonths: 99,
  } as PlatformDealRecord;
}

describe("assignChronologicalPairHistory", () => {
  it("counts only the pair's earlier shipments", () => {
    const out = assignChronologicalPairHistory([
      deal("c", "Open Markets Corporation", "BIO FARMING PERU S.A.C.", "2026-06-13"),
      deal("a", "Open Markets Corporation", "BIO FARMING PERU S.A.C.", "2024-06-11"),
      deal("b", "OPEN MARKETS CORPORATION", "Bio Farming Peru S.A.C", "2025-05-31"),
      deal("x", "Other Buyer", "BIO FARMING PERU S.A.C.", "2025-01-01"),
    ]);
    const byId = Object.fromEntries(out.map((r) => [r.mongoId, r]));
    expect(byId.a.priorDealsBetweenParties).toBe(0);
    expect(byId.a.relationshipAgeMonths).toBe(0);
    expect(byId.b.priorDealsBetweenParties).toBe(1);
    expect(byId.c.priorDealsBetweenParties).toBe(2);
    expect(byId.c.relationshipAgeMonths).toBe(24); // 732 days ÷ 30
    expect(byId.x.priorDealsBetweenParties).toBe(0);
  });

  it("does not count same-day shipments as prior, nor unknown parties", () => {
    const out = assignChronologicalPairHistory([
      deal("a", "Eagle", "Holy Fruit Peru", "2025-10-21"),
      deal("b", "Eagle", "Holy Fruit Peru", "2025-10-21"),
      deal("u", "Unknown buyer", "Holy Fruit Peru", "2026-01-01"),
      deal("v", "Unknown buyer", "Holy Fruit Peru", "2026-02-01"),
    ]);
    expect(out.map((r) => r.priorDealsBetweenParties)).toEqual([0, 0, 0, 0]);
  });
});
