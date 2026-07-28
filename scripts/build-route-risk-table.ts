/**
 * Regenerates src/lib/route-risk-tables.ts from
 * src/data/route-risk-given-commodity-2026-07-28.csv — decision 2026-07-28:
 * route risk is now scored per (origin, destination, product), not per
 * (origin, destination) alone, using a per-corridor base score adjusted for
 * cold-chain requirement and a freshness ratio (transit days / shelf life
 * days) specific to each product on that corridor. The CSV's `adjustedScore`
 * is taken as-is (not re-derived) since it's the AC-provided figure.
 *
 * Corridor-level facts that don't vary by product (transit days,
 * transshipments, the old qualitative Low/Medium/High flag, and whether the
 * *corridor itself* was AC-confirmed) are preserved from the prior
 * route-only table — they aren't in the new CSV since it's commodity-keyed.
 * Combined `scoreConfirmed` = corridor was AC-confirmed AND the product's
 * own risk-table row was AC-confirmed (src/lib/product-risk-tables.ts) —
 * the adjustedScore formula depends on both.
 *
 * Run: npx tsx scripts/build-route-risk-table.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsvRecords } from "./lib/csv";
import { PRODUCT_RISK_TABLE } from "../src/lib/product-risk-tables";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "..", "src", "data", "route-risk-given-commodity-2026-07-28.csv");
const OUT_PATH = join(__dirname, "..", "src", "lib", "route-risk-tables.ts");

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
};

const productConfirmedByName = new Map(
  PRODUCT_RISK_TABLE.map((p) => [p.product, p.scoreConfirmed]),
);

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function main() {
  const csvText = readFileSync(CSV_PATH, "utf-8");
  const rows = parseCsvRecords(csvText);

  const entries: string[] = [];
  let missingCorridorFacts = 0;
  let missingProductConfirmed = 0;

  for (const row of rows) {
    const origin = row.origin;
    const destination = row.destination;
    const product = row.commodity;
    const adjustedScore = Number(row.adjustedScore);
    const vetoCandidate = row.vetoCandidate.trim().toUpperCase() === "Y";
    const coldChainRequired = row.coldChainRequired.trim().toUpperCase() === "TRUE";
    const freshnessRatio = row["freshnessRatio(transit days/shelf life day)"].trim();
    const notes = row.notes.trim();

    const corridorKey = `${origin}|${destination}`;
    const corridor = CORRIDOR_FACTS[corridorKey];
    if (!corridor) {
      missingCorridorFacts++;
      console.error(`No corridor facts for ${corridorKey} — skipping row (${product})`);
      continue;
    }
    const productConfirmed = productConfirmedByName.get(product);
    if (productConfirmed === undefined) {
      missingProductConfirmed++;
      console.error(`No product-risk-table entry for "${product}" — skipping row`);
      continue;
    }

    const rationaleParts = [
      `Base corridor score ${row.routeBaseScore}${coldChainRequired ? ` (cold-chain required, ${row.coldChainPenalty} route penalty)` : " (no cold chain required)"}`,
      freshnessRatio
        ? `freshness ratio ${freshnessRatio} (transit days / shelf life days), ${row.freshnessPenalty} penalty`
        : "non-perishable — no freshness rule",
      notes || null,
    ].filter(Boolean);
    const rationale = rationaleParts.join("; ") + ".";

    const scoreConfirmed = corridor.corridorConfirmed && productConfirmed;

    entries.push(
      `  {
    origin: "${esc(origin)}",
    destination: "${esc(destination)}",
    product: "${esc(product)}",
    score: ${adjustedScore},
    estimatedTransitDays: ${corridor.estimatedTransitDays},
    numberOfTransshipments: ${corridor.numberOfTransshipments},
    routeRiskFlag: "${corridor.routeRiskFlag}",
    vetoCandidate: ${vetoCandidate},
    rationale: "${esc(rationale)}",
    scoreConfirmed: ${scoreConfirmed},
  },`,
    );
  }

  if (missingCorridorFacts > 0 || missingProductConfirmed > 0) {
    throw new Error(
      `Aborting: ${missingCorridorFacts} rows with unknown corridor, ${missingProductConfirmed} rows with unknown product — fix CORRIDOR_FACTS or product-risk-tables.ts first.`,
    );
  }

  const tsFile = `/** Auto-generated by scripts/build-route-risk-table.ts from src/data/route-risk-given-commodity-2026-07-28.csv — do not edit by hand. */
import type { RouteRiskProfile } from "../types";

export type CorridorRiskFlag = "Low" | "Medium" | "High";

/**
 * Route risk, per (origin, destination, product) — decision 2026-07-28.
 * \`score\` is the CSV's adjustedScore: corridor base score, adjusted for a
 * cold-chain route penalty and a freshness-ratio penalty (estimated transit
 * days ÷ that product's shelf-life days — see product-risk-tables.ts).
 * \`vetoCandidate\` flags rows where the freshness ratio meaningfully exceeds
 * 1.0 (transit time meets/exceeds shelf life) — fed into checkVetoRegister()
 * in scoring.ts alongside the existing cargo-insurance veto.
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

export function lookupRouteRisk(
  origin: string,
  destination: string,
  product: string,
): RouteRiskProfile | null {
  const normalizedOrigin = normalizeLocation(origin);
  const normalizedDestination = normalizeLocation(destination);
  const normalizedProduct = normalizeProduct(product);

  return (
    ROUTE_OPTIONS.find(
      (entry) =>
        normalizeLocation(entry.origin) === normalizedOrigin &&
        normalizeLocation(entry.destination) === normalizedDestination &&
        normalizeProduct(entry.product) === normalizedProduct,
    ) ?? null
  );
}
`;

  writeFileSync(OUT_PATH, tsFile);
  console.log(`Wrote ${entries.length} (origin, destination, product) route-risk rows to ${OUT_PATH}`);
  console.log(`Veto candidates: ${entries.filter((e) => e.includes("vetoCandidate: true")).length}`);
}

main();
