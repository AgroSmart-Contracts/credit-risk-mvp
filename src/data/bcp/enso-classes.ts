/** ENFEN coastal El Niño classes on the Niño 1+2 index (°C). */
import type { Tx } from "../../lib/bcp/types";

const L = (es: string, en: string): Tx => ({ es, en });

export const ENSO_CLASSES: Array<{ min: number; label: Tx }> = [
  { min: 3.0, label: L("Extraordinario", "Extraordinary") },
  { min: 1.7, label: L("Fuerte", "Strong") },
  { min: 1.0, label: L("Moderado", "Moderate") },
  { min: 0.4, label: L("Débil", "Weak") },
  { min: -Infinity, label: L("Neutro", "Neutral") },
];
export const ensoClass = (v: number) => ENSO_CLASSES.find((c) => v >= c.min)!.label;
