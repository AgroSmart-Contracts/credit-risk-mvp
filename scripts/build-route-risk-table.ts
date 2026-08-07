/**
 * Renders src/lib/route-risk-tables.ts from Dimension C v2 generated output.
 *
 * Source of truth: docs/Models/cram-dimension-c/route-risk-table-v2.csv
 * (produced by score_route.py — never hand-edit scores).
 *
 * This replaces the legacy join of hand-maintained ocean/air CSVs + CORRIDOR_FACTS.
 *
 * Run: npx tsx scripts/build-route-risk-table.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsvRecords } from "./lib/csv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIM_C = join(__dirname, "..", "docs", "Models", "cram-dimension-c");
const OUT_PATH = join(__dirname, "..", "src", "lib", "route-risk-tables.ts");

const V2_TABLE = join(DIM_C, "route-risk-table-v2.csv");
const NODES = join(DIM_C, "nodes.csv");
const STOP_MODIFIERS = join(DIM_C, "stop_modifiers.csv");

type CorridorFlag = "Low" | "Medium" | "High";

interface NodeRow {
  node_id: string;
  code: string;
  name: string;
  aliases: string;
}

interface V2Row {
  lane_id: string;
  pol: string;
  pod: string;
  pol_code: string;
  pod_code: string;
  mode: string;
  stops: string;
  commodity: string;
  score: string;
  veto_reason: string;
  eff_days: string;
  headroom_days: string;
  corridor_flag: string;
  exists: string;
  transit_evidence: string;
}

interface StopModRow {
  stops: string;
  mode: string;
  points: string;
  status: string;
}

function flagFromCsv(raw: string): CorridorFlag {
  const u = raw.trim().toUpperCase();
  if (u === "LOW") return "Low";
  if (u === "MED" || u === "MEDIUM") return "Medium";
  return "High";
}

function modeFromCsv(raw: string): "sea" | "air" {
  return raw.trim().toUpperCase() === "AIR" ? "air" : "sea";
}

function parseStops(raw: string, mode: "sea" | "air"): number | null {
  if (mode === "sea") return null;
  if (!raw.trim()) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function aliasList(node: NodeRow | undefined, displayName: string, code: string): string[] {
  const out = new Set<string>();
  out.add(displayName);
  if (code) out.add(code);
  if (node) {
    out.add(node.name);
    out.add(node.node_id);
    out.add(node.code);
    for (const part of String(node.aliases ?? "").split("|")) {
      const t = part.trim();
      if (t) out.add(t);
    }
  }
  return [...out];
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function loadAirStopPoints(): Map<number, number> {
  const mods = parseCsvRecords(readFileSync(STOP_MODIFIERS, "utf8")) as unknown as StopModRow[];
  const map = new Map<number, number>();
  for (const m of mods) {
    if (String(m.mode).toUpperCase() !== "AIR") continue;
    const stops = Number(m.stops);
    const pts = Number(m.points);
    if (Number.isFinite(stops) && Number.isFinite(pts)) map.set(stops, pts);
  }
  return map;
}

function main() {
  const nodes = parseCsvRecords(readFileSync(NODES, "utf8")) as unknown as NodeRow[];
  const byCode = new Map<string, NodeRow>();
  const byName = new Map<string, NodeRow>();
  for (const n of nodes) {
    byCode.set(String(n.code).toUpperCase(), n);
    byCode.set(String(n.node_id).toUpperCase(), n);
    byName.set(String(n.name).toLowerCase(), n);
  }

  const airStopPoints = loadAirStopPoints();
  const rows = parseCsvRecords(readFileSync(V2_TABLE, "utf8")) as unknown as V2Row[];
  const profiles: string[] = [];
  let kept = 0;
  let vetoes = 0;

  for (const r of rows) {
    const transportMode = modeFromCsv(r.mode);
    const airStops = parseStops(r.stops, transportMode);
    const isVeto =
      String(r.score).toUpperCase() === "VETO" || Boolean(String(r.veto_reason ?? "").trim());
    const scoreNum = isVeto ? 0 : Number(r.score);
    if (!isVeto && !Number.isFinite(scoreNum)) continue;

    const polNode =
      byCode.get(String(r.pol_code).toUpperCase()) ?? byName.get(String(r.pol).toLowerCase());
    const podNode =
      byCode.get(String(r.pod_code).toUpperCase()) ?? byName.get(String(r.pod).toLowerCase());

    const originAliases = aliasList(polNode, r.pol, r.pol_code);
    const destinationAliases = aliasList(podNode, r.pod, r.pod_code);

    const effDays = Number(r.eff_days);
    const headroom = Number(r.headroom_days);
    const evidence = String(r.transit_evidence || r.exists || "REF").toUpperCase();
    const scoreConfirmed = evidence === "AC" || evidence === "VERITRADE";
    const airStopPenalty =
      transportMode === "air" && airStops != null ? (airStopPoints.get(airStops) ?? 0) : 0;

    const stopBit =
      transportMode === "air"
        ? airStops != null && airStops >= 4
          ? `air ${airStops} stops (VETO)`
          : `air ${airStops ?? 0} stops`
        : "ocean";
    const rationale = isVeto
      ? `Dimension C v2 · ${stopBit}; veto: ${r.veto_reason || "engine veto"}`
      : `Dimension C v2 · ${stopBit}; eff ${Number.isFinite(effDays) ? effDays : "?"}d` +
        (Number.isFinite(headroom) ? `, headroom ${headroom}d` : "") +
        `; flag ${r.corridor_flag}; evidence ${evidence}`;

    // Legacy UI band: le2 = 0–2 stops, gt2 = ≥3 (including veto band).
    const airStopsBand =
      transportMode === "air"
        ? airStops != null && airStops > 2
          ? "gt2"
          : "le2"
        : null;

    profiles.push(`  {
    origin: '${esc(r.pol)}',
    destination: '${esc(r.pod)}',
    product: '${esc(r.commodity)}',
    transportMode: '${transportMode}',
    airStops: ${airStops === null ? "null" : airStops},
    airStopsBand: ${airStopsBand === null ? "null" : `'${airStopsBand}'`},
    airStopPenalty: ${airStopPenalty},
    score: ${scoreNum},
    estimatedTransitDays: ${Number.isFinite(effDays) ? Math.round(effDays) : 0},
    numberOfTransshipments: ${airStops ?? 0},
    routeRiskFlag: '${flagFromCsv(r.corridor_flag)}',
    vetoCandidate: ${isVeto},
    rationale: '${esc(rationale)}',
    scoreConfirmed: ${scoreConfirmed},
    laneId: '${esc(r.lane_id)}',
    originAliases: [${originAliases.map((a) => `'${esc(a)}'`).join(", ")}],
    destinationAliases: [${destinationAliases.map((a) => `'${esc(a)}'`).join(", ")}],
  }`);

    kept += 1;
    if (isVeto) vetoes += 1;
  }

  const out = `/** Auto-generated by scripts/build-route-risk-table.ts from
 * docs/Models/cram-dimension-c/route-risk-table-v2.csv (Dimension C v2).
 * Do not edit by hand — re-run the script after regenerating the CSV via
 * docs/Models/cram-dimension-c/./run.sh
 */
import type { RouteRiskProfile } from "../types";

export type CorridorRiskFlag = "Low" | "Medium" | "High";
/** @deprecated Prefer \`airStops\`. Kept for UI grouping: le2 = 0–2, gt2 = ≥3. */
export type AirStopsBand = "le2" | "gt2";

export const ROUTE_ENGINE_VERSION = "dimension-c-v2";
/** AC ruling 2026-07-30: air ≥4 stops is a hard veto. */
export const MAX_AIR_STOPS = 3;

/**
 * Route risk per (origin, destination, product, transportMode, airStops).
 * Scores come from score_route.py — TS never recomputes the formula.
 */
export const ROUTE_OPTIONS: RouteRiskProfile[] = [
${profiles.join(",\n")}
];

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/\\s+/g, " ").trim();
}

function locationMatches(query: string, canonical: string, aliases: string[] = []): boolean {
  const q = normalizeKey(query);
  if (!q) return false;
  if (normalizeKey(canonical) === q) return true;
  for (const a of aliases) {
    const na = normalizeKey(a);
    if (!na) continue;
    if (na === q) return true;
    // Platform dirty strings often append ", Country"
    if (q.startsWith(na + ",") || q.startsWith(na + " ")) return true;
    if (na.startsWith(q + ",")) return true;
  }
  const c = normalizeKey(canonical);
  if (q.startsWith(c + ",") || q.startsWith(c + " ")) return true;
  if (c.startsWith(q + ",")) return true;
  return false;
}

function productMatches(a: string, b: string): boolean {
  return normalizeKey(a) === normalizeKey(b);
}

/** Resolve which stop count to look up for a deal. Ocean ignores stops. */
export function resolveAirStops(
  transportMode: "air" | "sea" | null | undefined,
  numberOfTransshipments: number,
): number | null {
  if (transportMode === "air") {
    return Math.max(0, Math.floor(numberOfTransshipments || 0));
  }
  return null;
}

/** @deprecated Use resolveAirStops — kept for older call sites. */
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
  return { transportMode: "sea", airStopsBand: null };
}

export function lookupRouteRisk(
  origin: string,
  destination: string,
  product: string,
  transportMode: "air" | "sea" | null = null,
  numberOfTransshipments = 0,
): RouteRiskProfile | null {
  const mode: "sea" | "air" = transportMode === "air" ? "air" : "sea";
  const stops = resolveAirStops(mode, numberOfTransshipments);

  const matches = ROUTE_OPTIONS.filter(
    (entry) =>
      locationMatches(origin, entry.origin, entry.originAliases) &&
      locationMatches(destination, entry.destination, entry.destinationAliases) &&
      productMatches(product, entry.product) &&
      entry.transportMode === mode &&
      (mode === "sea" ? entry.airStops == null : entry.airStops === stops),
  );

  if (matches.length === 0) return null;
  // Prefer AC/VERITRADE-confirmed rows when aliases collapse multiple lanes.
  matches.sort((a, b) => Number(b.scoreConfirmed) - Number(a.scoreConfirmed));
  return matches[0] ?? null;
}
`;

  writeFileSync(OUT_PATH, out);
  console.log(
    `Wrote ${kept} Dimension C v2 profiles (${vetoes} veto rows) → ${OUT_PATH}`,
  );
}

main();
