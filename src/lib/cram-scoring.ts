import type { PerishabilityClass } from "./product-risk-tables";
import type { CorridorRiskFlag } from "./route-risk-tables";

/** CRAM dimension-B/C point adjustments per tm-cram-reference-tables-2026-07.md */

export function cramTransitPoints(
  perishabilityClass: PerishabilityClass,
  estimatedTransitDays: number,
): number {
  if (perishabilityClass === "Non-Perishable") {
    if (estimatedTransitDays <= 30) return 12;
    if (estimatedTransitDays > 60) return -8;
    return 0;
  }
  if (estimatedTransitDays <= 14) return 14;
  if (estimatedTransitDays <= 21) return 6;
  return -10;
}

export function cramRouteFlagPoints(flag: CorridorRiskFlag): number {
  const map: Record<CorridorRiskFlag, number> = {
    Low: 12,
    "Low-Med": 8,
    Medium: 3,
    "Med-High": -5,
    High: -15,
  };
  return map[flag];
}

export function cramCustomsPoints(clearanceDaysMax: number | null): number {
  if (clearanceDaysMax === null) return 0;
  if (clearanceDaysMax <= 3) return 5;
  if (clearanceDaysMax > 7) return -8;
  return 0;
}

export function cramTransshipmentPoints(count: number): number {
  if (count === 0) return 10;
  if (count === 1) return 0;
  return -15;
}
