/**
 * Report platform deals with no Dimension C v2 route-table hit.
 * Run: npx tsx scripts/report-route-table-misses.ts
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { platformDealsReadyForCounterparty } from "../src/data/platform-deals";
import { platformDealToDeal } from "../src/lib/platform-deal-mapper";
import { lookupRouteRisk, ROUTE_ENGINE_VERSION } from "../src/lib/route-risk-tables";
import { computeRouteScore } from "../src/lib/scoring";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(
  __dirname,
  "..",
  "docs",
  "dimension-c-v2-platform-route-misses-2026-08-04.md",
);

interface Miss {
  dealRef: string;
  mongoId: string;
  origin: string;
  destination: string;
  product: string;
  transportMode: string;
  stops: number;
  routeScoreFallback: number;
  incoterm: string;
}

function escCell(s: string): string {
  return s.replace(/\|/g, "/").replace(/\n/g, " ");
}

const misses: Miss[] = [];
let hits = 0;

for (const r of platformDealsReadyForCounterparty) {
  const d = platformDealToDeal(r);
  const m = lookupRouteRisk(
    d.origin,
    d.destination,
    d.product,
    d.transportMode,
    d.numberOfTransshipments,
  );
  if (m) {
    hits += 1;
    continue;
  }
  misses.push({
    dealRef: r.dealRef,
    mongoId: r.mongoId,
    origin: d.origin,
    destination: d.destination,
    product: d.product,
    transportMode: d.transportMode ?? "unknown",
    stops: d.numberOfTransshipments,
    routeScoreFallback: computeRouteScore(d),
    incoterm: d.incoterm,
  });
}

const groups = new Map<string, Miss[]>();
for (const m of misses) {
  const key = `${m.origin} → ${m.destination} · ${m.product} · ${m.transportMode} · stops=${m.stops}`;
  const list = groups.get(key) ?? [];
  list.push(m);
  groups.set(key, list);
}

const sortedGroups = [...groups.entries()].sort(
  (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
);

const lines: string[] = [];
lines.push("# Dimension C v2 — platform deal route table misses");
lines.push("");
lines.push("Generated: 2026-08-04");
lines.push(`Engine: \`${ROUTE_ENGINE_VERSION}\``);
lines.push(
  "Source: prescored platform deals (`platformDealsReadyForCounterparty` → `lookupRouteRisk`)",
);
lines.push("");
lines.push("## Summary");
lines.push("");
lines.push("| Metric | Count |");
lines.push("|---|---:|");
lines.push(`| Platform deals (ready / listed) | ${platformDealsReadyForCounterparty.length} |`);
lines.push(`| Table hit | ${hits} |`);
lines.push(`| **Table miss** | **${misses.length}** |`);
lines.push(
  `| Distinct miss corridors (OD × product × mode × stops) | ${sortedGroups.length} |`,
);
lines.push("");
lines.push(
  "Misses do **not** invent transit/transship/flag points. Route score falls back to **base 70** (HANDOFF: engine never guesses).",
);
lines.push("");
lines.push("## Likely causes");
lines.push("");
lines.push(
  "1. **Air tagged at seaport** — platform OD uses `Callao, Peru` for air; Dimension C air lanes POL is `Lima Jorge Chavez` (LIM).",
);
lines.push(
  "2. **Country-level OD** — e.g. `Peru → Netherlands` instead of a scored node pair.",
);
lines.push(
  "3. **Destination not in `lanes.csv`** — Guarulhos, Mumbai, Tel Aviv, etc. may be absent or under a different node name.",
);
lines.push(
  "4. **Product / mode / stop combo** — row exists for ocean but not for this air stop count (exact `airStops` key).",
);
lines.push("");
lines.push("## Misses by corridor (grouped)");
lines.push("");

for (const [key, rows] of sortedGroups) {
  const sorted = [...rows].sort((a, b) => a.dealRef.localeCompare(b.dealRef));
  lines.push(`### ${key} (${sorted.length} deal${sorted.length === 1 ? "" : "s"})`);
  lines.push("");
  lines.push("| Deal ref | Mongo ID | Incoterm | Fallback route score |");
  lines.push("|---|---|---|---:|");
  for (const r of sorted) {
    lines.push(
      `| ${escCell(r.dealRef)} | \`${r.mongoId}\` | ${escCell(r.incoterm || "—")} | ${r.routeScoreFallback} |`,
    );
  }
  lines.push("");
}

lines.push(`## Flat list (all ${misses.length} misses)`);
lines.push("");
lines.push(
  "| # | Deal ref | Origin | Destination | Product | Mode | Stops | Fallback |",
);
lines.push("|---:|---|---|---|---|---|---:|---:|");

const flat = [...misses].sort(
  (a, b) =>
    a.origin.localeCompare(b.origin) ||
    a.destination.localeCompare(b.destination) ||
    a.dealRef.localeCompare(b.dealRef),
);
flat.forEach((m, i) => {
  lines.push(
    `| ${i + 1} | ${escCell(m.dealRef)} | ${escCell(m.origin)} | ${escCell(m.destination)} | ${escCell(m.product)} | ${m.transportMode} | ${m.stops} | ${m.routeScoreFallback} |`,
  );
});

lines.push("");
lines.push("## Next steps");
lines.push("");
lines.push(
  "- Map platform air origins `Callao*` to LIM aliases (or normalize in `platform-deal-mapper`).",
);
lines.push(
  "- Add missing lanes/nodes in Dimension C (`lanes.csv` / `nodes.csv`) then `./run.sh` + `npm run build:route-risk`.",
);
lines.push("- Prefer port/airport codes over country-only OD in the platform export.");
lines.push("");

writeFileSync(OUT, lines.join("\n"));
console.log(`Wrote ${OUT} (${misses.length} misses, ${sortedGroups.length} groups)`);
