/**
 * Buyer+supplier pair history for Dimension A's relationship group, counted
 * in time order: a deal's prior deals are the pair's shipments dated
 * strictly before it, and its relationship age runs from the pair's first
 * shipment to this one. Replaces the old rule (pair total − 1 on every deal,
 * age = first-to-last shipment), which credited a 2024 deal with shipments
 * that only happened in 2026.
 */
import { companyGroupKey } from "./company-name";
import type { PlatformDealRecord } from "../../src/types/platform";

const UNKNOWN_PARTIES = new Set(["UNKNOWN BUYER", "UNKNOWN SUPPLIER"]);

function dealTime(r: PlatformDealRecord): number | null {
  const t = new Date(r.shippingStartDate || r.createdAt || "").getTime();
  return Number.isNaN(t) ? null : t;
}

function monthsBetween(a: number, b: number): number {
  return Math.round(Math.abs(b - a) / (1000 * 60 * 60 * 24 * 30));
}

function pairKeyOf(r: PlatformDealRecord): string | null {
  const buyer = companyGroupKey(r.buyerName);
  const supplier = companyGroupKey(r.supplierName);
  if (UNKNOWN_PARTIES.has(buyer) || UNKNOWN_PARTIES.has(supplier)) return null;
  return `${buyer}::${supplier}`;
}

export function assignChronologicalPairHistory(records: PlatformDealRecord[]): PlatformDealRecord[] {
  const byPair = new Map<string, number[]>();
  for (const r of records) {
    const k = pairKeyOf(r);
    const t = dealTime(r);
    if (k && t !== null) byPair.set(k, [...(byPair.get(k) ?? []), t]);
  }
  return records.map((r) => {
    const k = pairKeyOf(r);
    const t = dealTime(r);
    if (!k || t === null) return { ...r, priorDealsBetweenParties: 0, relationshipAgeMonths: 0 };
    const earlier = (byPair.get(k) ?? []).filter((x) => x < t);
    return {
      ...r,
      priorDealsBetweenParties: earlier.length,
      relationshipAgeMonths: earlier.length ? monthsBetween(Math.min(...earlier), t) : 0,
    };
  });
}
