/**
 * CRAM Table 2 — Route/logistics table (dimension C inputs).
 * Source: tm-cram-reference-tables-2026-07.md
 */
import { CRAM_REFERENCE_TABLES_VERSION } from "./cram-reference-version";

export type CorridorRiskFlag =
  | "Low"
  | "Low-Med"
  | "Medium"
  | "Med-High"
  | "High";

export interface RouteRiskEntry {
  routeKey: string;
  origin: string;
  destination: string;
  market: string;
  estimatedTransitDays: number;
  transitDaysMin: number;
  transitDaysMax: number;
  directService: boolean;
  customsClearanceDaysMax: number | null;
  corridorDefaultRiskFlag: CorridorRiskFlag;
  /** Display score for UI (derived, 0–100 higher = safer) */
  baseScore: number;
  notes?: string;
}

export const ROUTE_TABLE_VERSION = CRAM_REFERENCE_TABLES_VERSION;

/** @deprecated Use corridorDefaultRiskFlag — kept for Deal compatibility */
export type RouteRiskFlag = "Low" | "Medium" | "High";

function deriveRouteBaseScore(
  transitDays: number,
  flag: CorridorRiskFlag,
): number {
  const transitAdj =
    transitDays <= 14 ? 14 : transitDays <= 21 ? 6 : -10;
  const flagAdj: Record<CorridorRiskFlag, number> = {
    Low: 12,
    "Low-Med": 8,
    Medium: 3,
    "Med-High": -5,
    High: -15,
  };
  return Math.min(95, Math.max(25, Math.round(70 + transitAdj + flagAdj[flag])));
}

export const ROUTE_RISK_TABLE: RouteRiskEntry[] = [
  {
    routeKey: "Peru → Colombia",
    origin: "Callao, Peru",
    destination: "Buenaventura, Colombia",
    market: "Colombia",
    transitDaysMin: 3,
    transitDaysMax: 5,
    estimatedTransitDays: 4,
    directService: true,
    customsClearanceDaysMax: null,
    corridorDefaultRiskFlag: "Low-Med",
    baseScore: deriveRouteBaseScore(4, "Low-Med"),
    notes: "TM-2026-012; intra-LATAM; phyto PE→CO required",
  },
  {
    routeKey: "Peru → USA (East)",
    origin: "Callao, Peru",
    destination: "Philadelphia, USA",
    market: "USA",
    transitDaysMin: 11,
    transitDaysMax: 14,
    estimatedTransitDays: 13,
    directService: true,
    customsClearanceDaysMax: 3,
    corridorDefaultRiskFlag: "Low",
    baseScore: deriveRouteBaseScore(13, "Low"),
    notes: "Fruit-fly protocols per commodity",
  },
  {
    routeKey: "Peru → USA (West)",
    origin: "Callao, Peru",
    destination: "Los Angeles, USA",
    market: "USA",
    transitDaysMin: 12,
    transitDaysMax: 16,
    estimatedTransitDays: 14,
    directService: true,
    customsClearanceDaysMax: 3,
    corridorDefaultRiskFlag: "Low",
    baseScore: deriveRouteBaseScore(14, "Low"),
  },
  {
    routeKey: "Peru → Spain",
    origin: "Callao, Peru",
    destination: "Valencia, Spain",
    market: "Spain",
    transitDaysMin: 17,
    transitDaysMax: 21,
    estimatedTransitDays: 19,
    directService: true,
    customsClearanceDaysMax: 5,
    corridorDefaultRiskFlag: "Low",
    baseScore: deriveRouteBaseScore(19, "Low"),
    notes: "Deep EU resale market",
  },
  {
    routeKey: "Peru → Portugal",
    origin: "Callao, Peru",
    destination: "Lisbon, Portugal",
    market: "Portugal",
    transitDaysMin: 18,
    transitDaysMax: 22,
    estimatedTransitDays: 20,
    directService: false,
    customsClearanceDaysMax: 5,
    corridorDefaultRiskFlag: "Low",
    baseScore: deriveRouteBaseScore(20, "Low"),
    notes: "Often via Algeciras (1 stop)",
  },
  {
    routeKey: "Peru → Netherlands",
    origin: "Callao, Peru",
    destination: "Rotterdam, Netherlands",
    market: "Germany / Netherlands",
    transitDaysMin: 19,
    transitDaysMax: 22,
    estimatedTransitDays: 21,
    directService: true,
    customsClearanceDaysMax: 3,
    corridorDefaultRiskFlag: "Low",
    baseScore: deriveRouteBaseScore(21, "Low"),
    notes: "EU north gateway; MRL-strict buyers",
  },
  {
    routeKey: "Peru → Israel",
    origin: "Callao, Peru",
    destination: "Haifa, Israel",
    market: "Israel",
    transitDaysMin: 35,
    transitDaysMax: 40,
    estimatedTransitDays: 36,
    directService: false,
    customsClearanceDaysMax: 7,
    corridorDefaultRiskFlag: "High",
    baseScore: deriveRouteBaseScore(36, "High"),
    notes: "35d+ rule; thin resale market on rejection",
  },
  {
    routeKey: "Peru → Egypt",
    origin: "Callao, Peru",
    destination: "Alexandria, Egypt",
    market: "Egypt",
    transitDaysMin: 25,
    transitDaysMax: 30,
    estimatedTransitDays: 28,
    directService: false,
    customsClearanceDaysMax: null,
    corridorDefaultRiskFlag: "Med-High",
    baseScore: deriveRouteBaseScore(28, "Med-High"),
    notes: "Transshipment via Med hub; customs variability",
  },
  {
    routeKey: "Peru → Jordan",
    origin: "Callao, Peru",
    destination: "Aqaba, Jordan",
    market: "Jordan",
    transitDaysMin: 30,
    transitDaysMax: 36,
    estimatedTransitDays: 33,
    directService: false,
    customsClearanceDaysMax: 7,
    corridorDefaultRiskFlag: "Med-High",
    baseScore: deriveRouteBaseScore(33, "Med-High"),
  },
  {
    routeKey: "Peru → Thailand",
    origin: "Callao, Peru",
    destination: "Bangkok, Thailand",
    market: "Thailand",
    transitDaysMin: 30,
    transitDaysMax: 38,
    estimatedTransitDays: 34,
    directService: false,
    customsClearanceDaysMax: 5,
    corridorDefaultRiskFlag: "Medium",
    baseScore: deriveRouteBaseScore(34, "Medium"),
    notes: "Near CA ceiling for most fresh categories",
  },
  {
    routeKey: "Peru → Taiwan",
    origin: "Callao, Peru",
    destination: "Kaohsiung, Taiwan",
    market: "Taiwan",
    transitDaysMin: 28,
    transitDaysMax: 32,
    estimatedTransitDays: 30,
    directService: false,
    customsClearanceDaysMax: 5,
    corridorDefaultRiskFlag: "Medium",
    baseScore: deriveRouteBaseScore(30, "Medium"),
    notes: "HFF corridor; governing-law clause mandatory",
  },
  {
    routeKey: "Peru → China",
    origin: "Callao, Peru",
    destination: "Shanghai, China",
    market: "China",
    transitDaysMin: 23,
    transitDaysMax: 27,
    estimatedTransitDays: 25,
    directService: true,
    customsClearanceDaysMax: 5,
    corridorDefaultRiskFlag: "Medium",
    baseScore: deriveRouteBaseScore(25, "Medium"),
    notes: "Cold treatment required for grapes PE→CN",
  },
  {
    routeKey: "Peru → UAE",
    origin: "Callao, Peru",
    destination: "Jebel Ali, UAE",
    market: "UAE / MENA",
    transitDaysMin: 28,
    transitDaysMax: 34,
    estimatedTransitDays: 31,
    directService: false,
    customsClearanceDaysMax: 3,
    corridorDefaultRiskFlag: "Medium",
    baseScore: deriveRouteBaseScore(31, "Medium"),
    notes: "Re-export hub — better resale liquidity",
  },
];

const DEFAULT_ROUTE_SCORE = 55;

function extractCountry(location: string): string {
  return (
    location.split(",").pop()?.trim().toLowerCase() ??
    location.split(",")[0]?.trim().toLowerCase() ??
    location.toLowerCase()
  );
}

function routeKeyFromLocations(origin: string, destination: string): string {
  const from = extractCountry(origin);
  const to = extractCountry(destination);
  const countryLabels: Record<string, string> = {
    peru: "Peru",
    colombia: "Colombia",
    usa: "USA",
    spain: "Spain",
    portugal: "Portugal",
    netherlands: "Netherlands",
    israel: "Israel",
    egypt: "Egypt",
    jordan: "Jordan",
    thailand: "Thailand",
    taiwan: "Taiwan",
    china: "China",
    uae: "UAE",
  };
  const fromLabel = countryLabels[from] ?? origin;
  const toLabel = countryLabels[to] ?? destination;
  return `${fromLabel} → ${toLabel}`;
}

export function lookupRouteRisk(
  origin: string,
  destination: string,
): RouteRiskEntry | null {
  const key = routeKeyFromLocations(origin, destination);
  const exact = ROUTE_RISK_TABLE.find((r) => r.routeKey === key);
  if (exact) return exact;

  const fromCountry = extractCountry(origin);
  const toCountry = extractCountry(destination);

  return (
    ROUTE_RISK_TABLE.find((r) => {
      const rFrom = extractCountry(r.origin);
      const rTo = extractCountry(r.destination);
      return rFrom === fromCountry && rTo === toCountry;
    }) ?? null
  );
}

export function getRouteBaseScore(origin: string, destination: string): number {
  return lookupRouteRisk(origin, destination)?.baseScore ?? DEFAULT_ROUTE_SCORE;
}

/** Normalize corridor flag to Deal.routeRiskFlag (3-level) */
export function normalizeRouteRiskFlag(
  flag: CorridorRiskFlag,
): RouteRiskFlag {
  if (flag === "Low" || flag === "Low-Med") return "Low";
  if (flag === "High" || flag === "Med-High") return "High";
  return "Medium";
}

export const ROUTE_OPTIONS = ROUTE_RISK_TABLE.map((r) => ({
  label: r.routeKey,
  origin: r.origin,
  destination: r.destination,
}));
