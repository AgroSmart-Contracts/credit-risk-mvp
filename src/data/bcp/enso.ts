/**
 * Coastal El Niño from real data: NOAA's monthly Niño 1+2 sea temperature anomaly,
 * read as a 3-month mean (the coastal index ENFEN's classes are defined on) and
 * classified with ENFEN's thresholds. The class a file records is the reading of the
 * last complete month before its date.
 */
import real from "./market-real.json";
import type { Tx } from "../../lib/bcp/types";

const L = (es: string, en: string): Tx => ({ es, en });

/** ENFEN coastal El Niño classes on the Niño 1+2 index (°C). */
export const ENSO_CLASSES: Array<{ min: number; label: Tx }> = [
  { min: 3.0, label: L("Extraordinario", "Extraordinary") },
  { min: 1.7, label: L("Fuerte", "Strong") },
  { min: 1.0, label: L("Moderado", "Moderate") },
  { min: 0.4, label: L("Débil", "Weak") },
  { min: -Infinity, label: L("Neutro", "Neutral") },
];
export const ensoClass = (v: number) => ENSO_CLASSES.find((c) => v >= c.min)!.label;

const MONTHS = real.nino12.months;

/** Coastal index for a month (YYYY-MM): mean anomaly of that month and the two before. */
export function ensoIndex(month: string): number | null {
  const i = MONTHS.findIndex((m) => m.month === month);
  if (i < 2) return null;
  return Math.round(((MONTHS[i].anom + MONTHS[i - 1].anom + MONTHS[i - 2].anom) / 3) * 100) / 100;
}

/** The monthly coastal index from `from` to the last complete month before `until` (both YYYY-MM-DD). */
export function ensoSeries(from: string, until: string): Array<{ date: string; v: number }> {
  return MONTHS.filter((m) => m.month >= from.slice(0, 7) && m.month < until.slice(0, 7))
    .map((m) => ({ date: `${m.month}-01`, v: ensoIndex(m.month) }))
    .filter((p): p is { date: string; v: number } => p.v !== null);
}

/** What was known on a date: the last complete month's reading and its class. */
export function ensoAt(d: string): { month: string; v: number; label: Tx } {
  const p = ensoSeries("2000-01-01", d).at(-1)!;
  return { month: p.date.slice(0, 7), v: p.v, label: ensoClass(p.v) };
}

/** Raw monthly anomaly of a month (for the copy: "+5.3 °C in October"). */
export const ninoAnomaly = (month: string) => MONTHS.find((m) => m.month === month)?.anom ?? null;
