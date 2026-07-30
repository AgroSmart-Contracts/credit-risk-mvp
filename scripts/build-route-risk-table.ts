/**
 * Regenerates src/lib/route-risk-tables.ts from the three 2026-07-28/29 CSVs:
 *   - route-risk-given-commodity-OCEAN-2026-07-28.csv
 *   - route-risk-given-commodity-AIR-le2stops-2026-07-28.csv  (air, ≤2 stops)
 *   - route-risk-given-commodity-AIR-gt2stops-2026-07-28.csv  (air, ≥3 stops)
 *
 * Route risk is scored per (origin, destination, product, transportMode,
 * airStopsBand). `adjustedScore` is taken as-is (includes cold-chain,
 * freshness, and airStopPenalty).
 *
 * Corridor-level facts that don't vary by product (transit days,
 * ocean transshipments, Low/Medium/High flag, AC-confirmed corridor) are
 * preserved from CORRIDOR_FACTS — they aren't in the CSVs.
 *
 * Run: npx tsx scripts/build-route-risk-table.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsvRecords } from "./lib/csv";
import { PRODUCT_RISK_TABLE } from "../src/lib/product-risk-tables";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "src", "data");
const OUT_PATH = join(__dirname, "..", "src", "lib", "route-risk-tables.ts");

const SOURCES: Array<{
  file: string;
  transportMode: "sea" | "air";
  airStopsBand: "le2" | "gt2" | null;
  label: string;
}> = [
  {
    file: "route-risk-given-commodity-OCEAN-2026-07-28.csv",
    transportMode: "sea",
    airStopsBand: null,
    label: "ocean",
  },
  {
    file: "route-risk-given-commodity-AIR-le2stops-2026-07-28.csv",
    transportMode: "air",
    airStopsBand: "le2",
    label: "air ≤2 stops",
  },
  {
    file: "route-risk-given-commodity-AIR-gt2stops-2026-07-28.csv",
    transportMode: "air",
    airStopsBand: "gt2",
    label: "air ≥3 stops",
  },
];

/** Corridor-level facts, unchanged from the pre-2026-07-28 route-only table — see git history for provenance/rationale per corridor. */
interface CorridorFacts {
  estimatedTransitDays: number;
  numberOfTransshipments: number;
  routeRiskFlag: "Low" | "Medium" | "High";
  corridorConfirmed: boolean;
}

const CORRIDOR_FACTS: Record<string, CorridorFacts> = {
  "Callao, Peru|Buenaventura, Colombia": { estimatedTransitDays: 7, numberOfTransshipments: 0, routeRiskFlag: "Low", corridorConfirmed: true },
  "Callao, Peru|Miami, United States": { estimatedTransitDays: 12, numberOfTransshipments: 0, routeRiskFlag: "Low", corridorConfirmed: true },
  "Callao, Peru|Port Hueneme, United States": { estimatedTransitDays: 12, numberOfTransshipments: 0, routeRiskFlag: "Low", corridorConfirmed: false },
  "Callao, Peru|Hueneme, United States": { estimatedTransitDays: 12, numberOfTransshipments: 0, routeRiskFlag: "Low", corridorConfirmed: false },
  "Callao, Peru|Valencia, Spain": { estimatedTransitDays: 18, numberOfTransshipments: 1, routeRiskFlag: "Low", corridorConfirmed: true },
  "Callao, Peru|Rotterdam, Netherlands": { estimatedTransitDays: 22, numberOfTransshipments: 1, routeRiskFlag: "Low", corridorConfirmed: true },
  "Callao, Peru|Jebel Ali, UAE": { estimatedTransitDays: 18, numberOfTransshipments: 1, routeRiskFlag: "Medium", corridorConfirmed: true },
  "Callao, Peru|Kaohsiung, Taiwan, Province of China": { estimatedTransitDays: 35, numberOfTransshipments: 1, routeRiskFlag: "High", corridorConfirmed: true },
  "Chancay, Peru|Kaohsiung, Taiwan, Province of China": { estimatedTransitDays: 35, numberOfTransshipments: 1, routeRiskFlag: "High", corridorConfirmed: false },
  "Callao, Peru|Tel Aviv, Israel": { estimatedTransitDays: 35, numberOfTransshipments: 1, routeRiskFlag: "High", corridorConfirmed: true },
  "Callao, Peru|Dubai, United Arab Emirates": { estimatedTransitDays: 18, numberOfTransshipments: 1, routeRiskFlag: "Medium", corridorConfirmed: true },
  "Callao, Peru|Lisbon, Portugal": { estimatedTransitDays: 20, numberOfTransshipments: 1, routeRiskFlag: "Low", corridorConfirmed: false },
  "Callao, Peru|Amsterdam, Netherlands": { estimatedTransitDays: 22, numberOfTransshipments: 1, routeRiskFlag: "Low", corridorConfirmed: true },
  "Callao, Peru|Madrid, Spain": { estimatedTransitDays: 18, numberOfTransshipments: 1, routeRiskFlag: "Low", corridorConfirmed: false },
  "Callao, Peru|Malaga, Spain": { estimatedTransitDays: 18, numberOfTransshipments: 1, routeRiskFlag: "Low", corridorConfirmed: false },
  "Callao, Peru|Mumbai, India": { estimatedTransitDays: 28, numberOfTransshipments: 1, routeRiskFlag: "High", corridorConfirmed: false },
  "Callao, Peru|Gdansk, Poland": { estimatedTransitDays: 24, numberOfTransshipments: 1, routeRiskFlag: "Medium", corridorConfirmed: false },
  "Callao, Peru|Guarulhos, Brazil": { estimatedTransitDays: 10, numberOfTransshipments: 0, routeRiskFlag: "Low", corridorConfirmed: false },
  "Callao, Peru|San Antonio, Chile": { estimatedTransitDays: 7, numberOfTransshipments: 0, routeRiskFlag: "Low", corridorConfirmed: false },
  "Callao, Peru|Vienna, Austria": { estimatedTransitDays: 24, numberOfTransshipments: 1, routeRiskFlag: "Medium", corridorConfirmed: false },
  "Callao, Peru|Bangkok, Thailand": { estimatedTransitDays: 34, numberOfTransshipments: 1, routeRiskFlag: "Medium", corridorConfirmed: false },
  "Callao, Peru|St Petersburg, Russian Federation": { estimatedTransitDays: 30, numberOfTransshipments: 1, routeRiskFlag: "High", corridorConfirmed: false },
  "Callao, Peru|Frankurt Am Main, Germany": { estimatedTransitDays: 26, numberOfTransshipments: 1, routeRiskFlag: "Medium", corridorConfirmed: false },
  "Callao, Peru|Algeciras, Spain": { estimatedTransitDays: 19, numberOfTransshipments: 1, routeRiskFlag: "Low", corridorConfirmed: false },
  "Callao, Peru|San Vicente, Chile": { estimatedTransitDays: 8, numberOfTransshipments: 0, routeRiskFlag: "Low", corridorConfirmed: false },
  "Callao, Peru|Vancouver, Canada": { estimatedTransitDays: 14, numberOfTransshipments: 1, routeRiskFlag: "Medium", corridorConfirmed: false },
  "Aereopuerto Jorge Chavez, Peru|Bangkok, Thailand": { estimatedTransitDays: 34, numberOfTransshipments: 1, routeRiskFlag: "Medium", corridorConfirmed: false },
  "Puerto Bolivar, Ecuador|St Petersburg, Russian Federation": { estimatedTransitDays: 30, numberOfTransshipments: 1, routeRiskFlag: "High", corridorConfirmed: false },
  // Asia lanes added 2026-07-29 for platform deals the CSVs don't cover — see EXTRA_CORRIDORS.
  "San Antonio, Chile|Shanghai, China": { estimatedTransitDays: 25, numberOfTransshipments: 1, routeRiskFlag: "Medium", corridorConfirmed: false },
  "San Antonio, Chile|Hong Kong, Hong Kong": { estimatedTransitDays: 26, numberOfTransshipments: 1, routeRiskFlag: "Medium", corridorConfirmed: false },
  "Callao, Peru|Shanghai, China": { estimatedTransitDays: 32, numberOfTransshipments: 1, routeRiskFlag: "High", corridorConfirmed: false },
  "Callao, Peru|Hong Kong, Hong Kong": { estimatedTransitDays: 34, numberOfTransshipments: 1, routeRiskFlag: "High", corridorConfirmed: false },
};

const productConfirmedByName = new Map(
  PRODUCT_RISK_TABLE.map((p) => [p.product, p.scoreConfirmed]),
);
const shelfLifeByProduct = new Map(
  PRODUCT_RISK_TABLE.map((p) => [p.product, p.shelfLifeDays]),
);
const coldChainByProduct = new Map(
  PRODUCT_RISK_TABLE.map((p) => [p.product, p.coldChainRequired]),
);

/**
 * Corridors absent from the AC CSVs but carrying live platform deals. Base
 * scores come from the CSVs' own base-score-vs-transit-days relationship
 * (base ≈ 98 − 1.70 × days); they are provisional until AC confirms them, which
 * `corridorConfirmed: false` surfaces in the UI.
 */
const EXTRA_CORRIDORS: Array<{ origin: string; destination: string; routeBaseScore: number }> = [
  { origin: "San Antonio, Chile", destination: "Shanghai, China", routeBaseScore: 56 },
  { origin: "San Antonio, Chile", destination: "Hong Kong, Hong Kong", routeBaseScore: 54 },
  { origin: "Callao, Peru", destination: "Shanghai, China", routeBaseScore: 44 },
  { origin: "Callao, Peru", destination: "Hong Kong, Hong Kong", routeBaseScore: 40 },
];

/**
 * Sea reefers run controlled atmosphere, which extends shelf life well past the
 * ambient figure PRODUCT_RISK_TABLE carries for air and ground handling.
 *
 * Peru 2025 customs (Datasur, 36,288 blueberry export lines) shows 94.7 M kg
 * reaching Rotterdam on 22-day transits and 51.6 M kg reaching China, Taiwan and
 * Hong Kong on 35-day transits, at the highest unit prices in the dataset — so
 * the 21-day ambient figure was flagging routine, well-paid lanes as veto
 * candidates. Only blueberries have customs evidence behind them; every other
 * product keeps its ambient shelf life on sea until comparable data exists.
 */
const SEA_SHELF_LIFE_DAYS: Record<string, number> = {
  "Fresh Blueberries": 42,
};

function shelfLifeDays(product: string, transportMode: "sea" | "air"): number | null {
  const ambient = shelfLifeByProduct.get(product) ?? null;
  if (ambient === null) return null;
  return transportMode === "sea" ? (SEA_SHELF_LIFE_DAYS[product] ?? ambient) : ambient;
}

/** Freshness bands on ratio = transit days / shelf life days, as used by the AC CSVs. */
function freshnessPenalty(ratio: number): number {
  if (ratio <= 0.5) return 5;
  if (ratio <= 0.8) return 0;
  if (ratio <= 1.0) return -10;
  return -25;
}

/** Cold chain costs 4 points once a corridor is long enough for a break to matter. */
function coldChainPenalty(coldChainRequired: boolean, oceanDays: number): number {
  return coldChainRequired && oceanDays >= 14 ? -4 : 0;
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function bandTransshipments(airStopsBand: "le2" | "gt2" | null, corridorStops: number): number {
  if (airStopsBand === "le2") return 2;
  if (airStopsBand === "gt2") return 3;
  return corridorStops;
}

/** Mode-specific transit for display / deal defaults — air is much shorter than ocean. */
function modeTransitDays(
  oceanDays: number,
  airStopsBand: "le2" | "gt2" | null,
): number {
  if (airStopsBand === null) return oceanDays;
  let base: number;
  if (oceanDays <= 10) base = 1;
  else if (oceanDays <= 18) base = 2;
  else if (oceanDays <= 25) base = 3;
  else base = 4;
  return airStopsBand === "gt2" ? base + 2 : base;
}

function main() {
  const entries: string[] = [];
  let missingCorridorFacts = 0;
  let missingProductConfirmed = 0;
  const counts: Record<string, number> = {};

  /** Rows whose derived score differs from the CSV's adjustedScore — expected only where SEA_SHELF_LIFE_DAYS applies. */
  const scoreDrift: string[] = [];

  function buildEntry(
    source: (typeof SOURCES)[number],
    origin: string,
    destination: string,
    product: string,
    routeBaseScore: number,
    csvScore: number | null,
    csvNote: string,
  ): string | null {
    const corridorKey = `${origin}|${destination}`;
    const corridor = CORRIDOR_FACTS[corridorKey];
    if (!corridor) {
      missingCorridorFacts++;
      console.error(`No corridor facts for ${corridorKey} — skipping row (${product}, ${source.label})`);
      return null;
    }
    const productConfirmed = productConfirmedByName.get(product);
    if (productConfirmed === undefined) {
      missingProductConfirmed++;
      console.error(`No product-risk-table entry for "${product}" — skipping row (${source.label})`);
      return null;
    }

    const estimatedTransitDays = modeTransitDays(
      corridor.estimatedTransitDays,
      source.airStopsBand,
    );
    const coldChainRequired = coldChainByProduct.get(product) ?? false;
    const coldChain = coldChainPenalty(coldChainRequired, corridor.estimatedTransitDays);
    const shelfLife = shelfLifeDays(product, source.transportMode);
    const ratio =
      shelfLife === null ? null : Math.round((estimatedTransitDays / shelfLife) * 100) / 100;
    const freshness = ratio === null ? 0 : freshnessPenalty(ratio);
    const vetoCandidate = ratio !== null && ratio > 1;
    // ≥3 air stops only matters where a cold chain can break.
    const airStopPenalty =
      source.airStopsBand === "gt2" && coldChainRequired ? -15 : 0;
    const score = routeBaseScore + coldChain + freshness + airStopPenalty;

    if (csvScore !== null && csvScore !== score) {
      scoreDrift.push(
        `${origin} -> ${destination} ${product} (${source.label}): CSV ${csvScore} -> ${score}`,
      );
    }

    const rationale =
      [
        source.label,
        `Base corridor score ${routeBaseScore}${coldChainRequired ? ` (cold-chain required, ${coldChain} route penalty)` : " (no cold chain required)"}`,
        ratio === null
          ? "non-perishable — no freshness rule"
          : `freshness ratio ${ratio} (${estimatedTransitDays}d transit / ${shelfLife}d shelf life), ${freshness} penalty`,
        airStopPenalty !== 0 ? `air stop penalty ${airStopPenalty}` : null,
        csvScore === null ? "corridor not in the AC CSVs — provisional base score" : null,
        csvScore !== null && csvScore !== score
          ? `rescored from CSV ${csvScore} on the recalibrated sea shelf life`
          : csvNote || null,
      ]
        .filter(Boolean)
        .join("; ") + ".";

    const airStopsBandLiteral =
      source.airStopsBand === null ? "null" : `"${source.airStopsBand}"`;

    return `  {
    origin: "${esc(origin)}",
    destination: "${esc(destination)}",
    product: "${esc(product)}",
    transportMode: "${source.transportMode}",
    airStopsBand: ${airStopsBandLiteral},
    airStopPenalty: ${airStopPenalty},
    score: ${score},
    estimatedTransitDays: ${estimatedTransitDays},
    numberOfTransshipments: ${bandTransshipments(source.airStopsBand, corridor.numberOfTransshipments)},
    routeRiskFlag: "${corridor.routeRiskFlag}",
    vetoCandidate: ${vetoCandidate},
    rationale: "${esc(rationale)}",
    scoreConfirmed: ${corridor.corridorConfirmed && productConfirmed},
  },`;
  }

  for (const source of SOURCES) {
    const csvText = readFileSync(join(DATA_DIR, source.file), "utf-8");
    const rows = parseCsvRecords(csvText);
    let sourceCount = 0;

    for (const row of rows) {
      const origin = row.origin?.trim();
      const destination = row.destination?.trim();
      const product = row.commodity?.trim();
      if (!origin || !destination || !product) continue;

      const entry = buildEntry(
        source,
        origin,
        destination,
        product,
        Number(row.routeBaseScore),
        Number(row.adjustedScore),
        (row.notes ?? "").trim(),
      );
      if (!entry) continue;
      entries.push(entry);
      sourceCount += 1;
    }

    for (const extra of EXTRA_CORRIDORS) {
      for (const { product } of PRODUCT_RISK_TABLE) {
        const entry = buildEntry(
          source,
          extra.origin,
          extra.destination,
          product,
          extra.routeBaseScore,
          null,
          "",
        );
        if (!entry) continue;
        entries.push(entry);
        sourceCount += 1;
      }
    }

    counts[source.label] = sourceCount;
  }

  if (missingCorridorFacts > 0 || missingProductConfirmed > 0) {
    throw new Error(
      `Aborting: ${missingCorridorFacts} rows with unknown corridor, ${missingProductConfirmed} rows with unknown product — fix CORRIDOR_FACTS or product-risk-tables.ts first.`,
    );
  }

  const tsFile = `/** Auto-generated by scripts/build-route-risk-table.ts from ocean + air (≤2 / ≥3 stops) CSVs — do not edit by hand. */
import type { RouteRiskProfile } from "../types";

export type CorridorRiskFlag = "Low" | "Medium" | "High";
export type AirStopsBand = "le2" | "gt2";

/**
 * Route risk, per (origin, destination, product, transportMode, airStopsBand)
 * — decision 2026-07-29.
 * \`score\` = corridor base score (from the AC CSVs) + cold-chain penalty
 * + freshness penalty + airStopPenalty (−15 for air ≥3 stops on cold-chain
 * cargo). Freshness is derived from mode transit days ÷ shelf life rather than
 * copied from the CSVs, so sea rows pick up the controlled-atmosphere shelf
 * lives in the generator's SEA_SHELF_LIFE_DAYS.
 * \`vetoCandidate\` flags a freshness ratio above 1.0.
 */
export const ROUTE_OPTIONS: RouteRiskProfile[] = [
${entries.join("\n")}
];

function normalizeLocation(value: string): string {
  return value.toLowerCase().replace(/\\s+/g, " ").trim();
}

function normalizeProduct(value: string): string {
  return value.toLowerCase().replace(/\\s+/g, " ").trim();
}

/** Resolve which table variant applies for a deal's freight mode + air stops. */
export function resolveRouteTableKey(
  transportMode: "air" | "sea" | null | undefined,
  numberOfTransshipments: number,
): { transportMode: "sea" | "air"; airStopsBand: AirStopsBand | null } {
  if (transportMode === "air") {
    return {
      transportMode: "air",
      airStopsBand: numberOfTransshipments > 2 ? "gt2" : "le2",
    };
  }
  // Sea, or unknown mode → ocean table (historically identical to air ≤2).
  return { transportMode: "sea", airStopsBand: null };
}

export function lookupRouteRisk(
  origin: string,
  destination: string,
  product: string,
  transportMode: "air" | "sea" | null = null,
  numberOfTransshipments = 0,
): RouteRiskProfile | null {
  const normalizedOrigin = normalizeLocation(origin);
  const normalizedDestination = normalizeLocation(destination);
  const normalizedProduct = normalizeProduct(product);
  const key = resolveRouteTableKey(transportMode, numberOfTransshipments);

  return (
    ROUTE_OPTIONS.find(
      (entry) =>
        normalizeLocation(entry.origin) === normalizedOrigin &&
        normalizeLocation(entry.destination) === normalizedDestination &&
        normalizeProduct(entry.product) === normalizedProduct &&
        entry.transportMode === key.transportMode &&
        entry.airStopsBand === key.airStopsBand,
    ) ?? null
  );
}
`;

  writeFileSync(OUT_PATH, tsFile);
  console.log(`Wrote ${entries.length} route-risk rows to ${OUT_PATH}`);
  for (const [label, n] of Object.entries(counts)) {
    console.log(`  ${label}: ${n}`);
  }
  console.log(`Veto candidates: ${entries.filter((e) => e.includes("vetoCandidate: true")).length}`);
  console.log(`Rows rescored against the recalibrated sea shelf life (${scoreDrift.length}):`);
  for (const drift of scoreDrift) console.log(`  ${drift}`);
}

main();
