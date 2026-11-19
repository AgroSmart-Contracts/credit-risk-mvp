import type { LetterTier } from "../../lib/pre-harvest/types";
import type { RiskTier } from "../../types";

/** SVG mirrors of the TruMarket tokens in index.css (Recharts and Leaflet take plain colours). */
export const CHART_COLORS = {
  green: "#0f9d6b",
  yellow: "#d9a93b",
  red: "#f25e6b",
  blue: "#4ea4d9",
  ink: "#102a40",
  muted: "#94a3b8",
  band: "#0f9d6b22",
  grid: "#e2e4e7",
  axis: "#6b7785",
  rule: "#cbd5e1",
} as const;

/** Letter tier → the post-harvest RiskTier, so the existing gauge colours apply. */
export function gaugeTier(tier: LetterTier): RiskTier {
  return ({ A: "Low Risk", B: "Medium-Low Risk", C: "Medium-High Risk", D: "High Risk", VETO: "Veto" } as const)[tier];
}
