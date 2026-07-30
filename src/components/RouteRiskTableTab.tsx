import { useMemo } from "react";
import { CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import { ROUTE_OPTIONS } from "../lib/route-risk-tables";
import { platformDeals } from "../data/platform-deals";
import type { RouteRiskProfile } from "../types";

interface UnifiedRow {
  origin: string;
  destination: string;
  product: string;
  ocean: RouteRiskProfile;
  airLe2: RouteRiskProfile | null;
  airGt2: RouteRiskProfile | null;
}

interface CorridorGroup {
  origin: string;
  destination: string;
  rows: UnifiedRow[];
}

function corridorKey(origin: string, destination: string): string {
  return `${origin.toLowerCase().trim()} -> ${destination.toLowerCase().trim()}`;
}

function productKey(origin: string, destination: string, product: string): string {
  return `${corridorKey(origin, destination)} :: ${product.toLowerCase().trim()}`;
}

const COLUMN_TITLES = {
  ocean: {
    short: "Ocean",
    title: "Route risk by ocean freight",
    description: "Sea / reefer corridor score for this commodity (transit days ÷ shelf life).",
  },
  airLe2: {
    short: "Air ≤2 stops",
    title: "Route risk by air, ≤2 stops/transits",
    description:
      "Air freight with direct or ≤2 stops — shorter transit, freshness recomputed (should be ≥ ocean for perishables).",
  },
  airGt2: {
    short: "Air ≥3 stops",
    title: "Route risk by air, ≥3 stops/transits",
    description:
      "Air freight with ≥3 stops — more handoffs; cold-chain lanes take an additional air-stop penalty (typically −15).",
  },
} as const;

function ScoreCell({
  profile,
  highlightVs,
}: {
  profile: RouteRiskProfile | null;
  highlightVs?: number | null;
}) {
  if (!profile) return <span className="text-tm-text-muted">—</span>;
  const delta =
    highlightVs != null && Number.isFinite(highlightVs) ? profile.score - highlightVs : null;
  return (
    <div className="space-y-0.5">
      <div className="flex flex-wrap items-center gap-1">
        <span className="font-semibold text-tm-black">{profile.score}</span>
        {delta != null && delta > 0 && (
          <span className="text-[10px] font-medium text-tm-primary">+{delta} vs ocean</span>
        )}
        {delta != null && delta < 0 && (
          <span className="text-[10px] font-medium text-tm-danger">{delta} vs ocean</span>
        )}
        {delta === 0 && (
          <span className="text-[10px] text-tm-text-muted">= ocean</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {profile.vetoCandidate && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-tm-danger/10 px-1.5 py-0.5 text-[9px] font-semibold text-tm-danger">
            <ShieldAlert className="h-2.5 w-2.5" /> Veto
          </span>
        )}
        {profile.airStopPenalty !== 0 && (
          <span className="rounded-full bg-tm-accent/15 px-1.5 py-0.5 text-[9px] font-semibold text-tm-accent-dark">
            stop {profile.airStopPenalty}
          </span>
        )}
        {!profile.scoreConfirmed && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-tm-accent/15 px-1.5 py-0.5 text-[9px] font-semibold text-tm-accent-dark">
            <AlertTriangle className="h-2.5 w-2.5" /> Prov.
          </span>
        )}
        {profile.scoreConfirmed && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-tm-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-tm-primary">
            <CheckCircle2 className="h-2.5 w-2.5" /> AC
          </span>
        )}
      </div>
      <p className="text-[10px] text-tm-text-muted">{profile.estimatedTransitDays}d transit</p>
    </div>
  );
}

export function RouteRiskTableTab() {
  const unified = useMemo(() => {
    const byKey = new Map<string, UnifiedRow>();
    for (const r of ROUTE_OPTIONS) {
      const key = productKey(r.origin, r.destination, r.product);
      let row = byKey.get(key);
      if (!row) {
        row = {
          origin: r.origin,
          destination: r.destination,
          product: r.product,
          ocean: r,
          airLe2: null,
          airGt2: null,
        };
        byKey.set(key, row);
      }
      if (r.transportMode === "sea") row.ocean = r;
      else if (r.airStopsBand === "le2") row.airLe2 = r;
      else if (r.airStopsBand === "gt2") row.airGt2 = r;
    }
    return [...byKey.values()].sort((a, b) => {
      const c = corridorKey(a.origin, a.destination).localeCompare(
        corridorKey(b.origin, b.destination),
      );
      if (c !== 0) return c;
      return a.product.localeCompare(b.product);
    });
  }, []);

  const corridors = useMemo(() => {
    const map = new Map<string, CorridorGroup>();
    for (const row of unified) {
      const key = corridorKey(row.origin, row.destination);
      let g = map.get(key);
      if (!g) {
        g = { origin: row.origin, destination: row.destination, rows: [] };
        map.set(key, g);
      }
      g.rows.push(row);
    }
    return [...map.values()];
  }, [unified]);

  const dealCountByCorridor = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of platformDeals) {
      const key = corridorKey(d.origin, d.destination);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, []);

  const unmatchedRoutes = useMemo(() => {
    const matched = new Set(corridors.map((c) => corridorKey(c.origin, c.destination)));
    const misses = new Map<string, number>();
    for (const d of platformDeals) {
      const key = corridorKey(d.origin, d.destination);
      if (!matched.has(key)) {
        const label = `${d.origin} -> ${d.destination}`;
        misses.set(label, (misses.get(label) ?? 0) + 1);
      }
    }
    return [...misses.entries()];
  }, [corridors]);

  const airSaferCount = unified.filter(
    (r) => r.airLe2 != null && r.airLe2.score > r.ocean.score,
  ).length;
  const airEqualCount = unified.filter(
    (r) => r.airLe2 != null && r.airLe2.score === r.ocean.score,
  ).length;
  const airWorseCount = unified.filter(
    (r) => r.airLe2 != null && r.airLe2.score < r.ocean.score,
  ).length;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="font-display text-3xl text-tm-black sm:text-4xl">
          Route Risk Table (CRAM Dimension C)
        </h1>
        <p className="mt-2 text-tm-text-light">
          One row per (corridor × commodity) with three mode scores side by side —{" "}
          {unified.length} products across {corridors.length} corridors.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(COLUMN_TITLES) as Array<keyof typeof COLUMN_TITLES>).map((key) => {
          const col = COLUMN_TITLES[key];
          return (
            <div
              key={key}
              className="rounded-xl border border-tm-border bg-tm-surface p-4 shadow-tm-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-tm-text-muted">
                {col.short}
              </p>
              <h2 className="mt-1 text-sm font-semibold text-tm-black">{col.title}</h2>
              <p className="mt-1 text-xs text-tm-text-light">{col.description}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-tm-accent/40 bg-tm-accent/10 px-4 py-3 text-xs text-tm-accent-dark">
        <p className="font-semibold">Validation (2026-07-29)</p>
        <p className="mt-1">
          Prior air ≤2 CSVs copied ocean freshness ratios (same transit days), so scores were
          identical — that contradicted industry practice (air is days, ocean is weeks for
          perishables). Air scores were recomputed with mode-specific transit. Result: air ≤2 is
          safer than ocean on <strong>{airSaferCount}</strong> rows, equal on{" "}
          <strong>{airEqualCount}</strong> (mostly non-perishables / already-good freshness), worse
          on <strong>{airWorseCount}</strong>.
        </p>
        <p className="mt-2">
          Blueberry sea rows were then rescored on a 42-day controlled-atmosphere shelf life
          instead of the 21-day ambient figure. Peru 2025 customs shows 94.7 M kg reaching
          Rotterdam on 22-day transits and 51.6 M kg reaching China, Taiwan and Hong Kong on
          35-day transits, at the highest unit prices in that data — lanes the ambient figure was
          flagging as veto candidates.
        </p>
      </div>

      {unmatchedRoutes.length > 0 && (
        <section className="rounded-xl border border-dashed border-tm-danger/40 bg-tm-danger/5 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-tm-black">
            <AlertTriangle className="h-4 w-4 text-tm-danger" />
            Corridors with no table row ({unmatchedRoutes.length})
          </h2>
          <ul className="mt-3 space-y-1">
            {unmatchedRoutes.map(([route, count]) => (
              <li key={route} className="flex items-center justify-between text-xs">
                <span className="text-tm-text-light">{route}</span>
                <span className="font-semibold text-tm-text-muted">
                  {count} deal{count === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="space-y-3">
        {corridors.map((c) => {
          const corridorDealCount =
            dealCountByCorridor.get(corridorKey(c.origin, c.destination)) ?? 0;
          return (
            <article
              key={corridorKey(c.origin, c.destination)}
              className="rounded-xl border border-tm-border bg-tm-surface p-4 shadow-tm-sm sm:p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-tm-black">
                  {c.origin} → {c.destination}
                </h3>
                <span className="rounded-full bg-tm-neutral px-2 py-0.5 text-[10px] font-semibold text-tm-text-muted">
                  {corridorDealCount} deal{corridorDealCount === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead>
                    <tr className="text-tm-text-muted">
                      <th className="pb-1.5 pr-2 font-semibold">Commodity</th>
                      <th className="pb-1.5 pr-2 font-semibold" title={COLUMN_TITLES.ocean.description}>
                        {COLUMN_TITLES.ocean.title}
                      </th>
                      <th className="pb-1.5 pr-2 font-semibold" title={COLUMN_TITLES.airLe2.description}>
                        {COLUMN_TITLES.airLe2.title}
                      </th>
                      <th className="pb-1.5 font-semibold" title={COLUMN_TITLES.airGt2.description}>
                        {COLUMN_TITLES.airGt2.title}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.rows.map((r) => (
                      <tr
                        key={productKey(r.origin, r.destination, r.product)}
                        className="border-t border-tm-border/60 align-top"
                      >
                        <td className="py-2 pr-2 font-medium text-tm-black">{r.product}</td>
                        <td className="py-2 pr-2">
                          <ScoreCell profile={r.ocean} />
                        </td>
                        <td className="py-2 pr-2">
                          <ScoreCell profile={r.airLe2} highlightVs={r.ocean.score} />
                        </td>
                        <td className="py-2">
                          <ScoreCell profile={r.airGt2} highlightVs={r.ocean.score} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          );
        })}
      </div>

      <p className="text-center text-xs text-tm-text-muted">
        Unified source:{" "}
        <code className="rounded bg-tm-neutral px-1">
          src/data/route-risk-given-commodity-by-mode-2026-07-29.csv
        </code>{" "}
        · rebuild with{" "}
        <code className="rounded bg-tm-neutral px-1">npx tsx scripts/build-route-risk-table.ts</code>
      </p>
    </div>
  );
}
