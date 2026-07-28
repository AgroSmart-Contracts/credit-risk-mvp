import { useMemo } from "react";
import { CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import { ROUTE_OPTIONS } from "../lib/route-risk-tables";
import { platformDeals } from "../data/platform-deals";
import type { RouteRiskProfile } from "../types";

interface Corridor {
  origin: string;
  destination: string;
  rows: RouteRiskProfile[];
}

function corridorKey(origin: string, destination: string): string {
  return `${origin.toLowerCase().trim()} -> ${destination.toLowerCase().trim()}`;
}

function rowKey(origin: string, destination: string, product: string): string {
  return `${corridorKey(origin, destination)} :: ${product.toLowerCase().trim()}`;
}

export function RouteRiskTableTab() {
  const corridors = useMemo(() => {
    const map = new Map<string, Corridor>();
    for (const r of ROUTE_OPTIONS) {
      const key = corridorKey(r.origin, r.destination);
      let corridor = map.get(key);
      if (!corridor) {
        corridor = { origin: r.origin, destination: r.destination, rows: [] };
        map.set(key, corridor);
      }
      corridor.rows.push(r);
    }
    return [...map.values()];
  }, []);

  const dealCountByRow = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of platformDeals) {
      const key = rowKey(d.origin, d.destination, d.product);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, []);

  const dealCountByCorridor = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of platformDeals) {
      const key = corridorKey(d.origin, d.destination);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, []);

  const unmatchedRoutes = useMemo(() => {
    const matchedCorridors = new Set(corridors.map((c) => corridorKey(c.origin, c.destination)));
    const misses = new Map<string, number>();
    for (const d of platformDeals) {
      const key = corridorKey(d.origin, d.destination);
      if (!matchedCorridors.has(key)) {
        misses.set(
          `${d.origin} -> ${d.destination}`,
          (misses.get(`${d.origin} -> ${d.destination}`) ?? 0) + 1,
        );
      }
    }
    return [...misses.entries()];
  }, [corridors]);

  const provisionalRowCount = ROUTE_OPTIONS.filter((r) => !r.scoreConfirmed).length;
  const provisionalDealCount = ROUTE_OPTIONS.filter((r) => !r.scoreConfirmed).reduce(
    (sum, r) => sum + (dealCountByRow.get(rowKey(r.origin, r.destination, r.product)) ?? 0),
    0,
  );
  const vetoCandidateDealCount = ROUTE_OPTIONS.filter((r) => r.vetoCandidate).reduce(
    (sum, r) => sum + (dealCountByRow.get(rowKey(r.origin, r.destination, r.product)) ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="font-display text-3xl text-tm-black sm:text-4xl">
          Route Risk Table (CRAM Dimension C)
        </h1>
        <p className="mt-2 text-tm-text-light">
          {corridors.length} corridors × {ROUTE_OPTIONS.length / corridors.length} products ={" "}
          {ROUTE_OPTIONS.length} (route, product) rows tabled — decision 2026-07-28: route risk is
          scored per product now, not per corridor alone. {provisionalRowCount} rows are provisional
          (not AC-confirmed for both the corridor and the product), backing {provisionalDealCount}{" "}
          real deals. {vetoCandidateDealCount} deals sit on a (route, product) combination whose
          estimated transit time meaningfully exceeds that product's shelf life — a mandatory veto
          candidate, not just a lower score.{" "}
          {unmatchedRoutes.length} corridor{unmatchedRoutes.length === 1 ? "" : "s"} in the platform
          dataset still fall back to the generic transport-mode estimate.
        </p>
      </div>

      {unmatchedRoutes.length > 0 && (
        <section className="rounded-xl border border-dashed border-tm-danger/40 bg-tm-danger/5 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-tm-black">
            <AlertTriangle className="h-4 w-4 text-tm-danger" />
            Corridors with no table row at all ({unmatchedRoutes.length})
          </h2>
          <p className="mt-1 text-xs text-tm-text-light">
            These fall back to a generic by_air/sea_freight transit-time estimate —
            not even a provisional corridor-specific figure.
          </p>
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
          const corridorDealCount = dealCountByCorridor.get(corridorKey(c.origin, c.destination)) ?? 0;
          const rows = [...c.rows].sort((a, b) => b.score - a.score);
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
                  {corridorDealCount} deal{corridorDealCount === 1 ? "" : "s"} on this corridor
                </span>
              </div>
              <p className="mt-1 text-xs text-tm-text-light">
                {rows[0].estimatedTransitDays}-day transit · {rows[0].numberOfTransshipments}{" "}
                transshipment{rows[0].numberOfTransshipments === 1 ? "" : "s"} · {rows[0].routeRiskFlag}{" "}
                corridor flag (product-independent facts)
              </p>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead>
                    <tr className="text-tm-text-muted">
                      <th className="pb-1.5 pr-2 font-semibold">Product</th>
                      <th className="pb-1.5 pr-2 font-semibold">Score</th>
                      <th className="pb-1.5 pr-2 font-semibold">Status</th>
                      <th className="pb-1.5 pr-2 font-semibold">Deals</th>
                      <th className="pb-1.5 font-semibold">Rationale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const dealCount = dealCountByRow.get(rowKey(r.origin, r.destination, r.product)) ?? 0;
                      return (
                        <tr key={rowKey(r.origin, r.destination, r.product)} className="border-t border-tm-border/60">
                          <td className="py-1.5 pr-2 font-medium text-tm-black">{r.product}</td>
                          <td className="py-1.5 pr-2 font-semibold text-tm-black">{r.score}</td>
                          <td className="py-1.5 pr-2">
                            <div className="flex flex-wrap gap-1">
                              {r.vetoCandidate && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-tm-danger/10 px-1.5 py-0.5 text-[9px] font-semibold text-tm-danger">
                                  <ShieldAlert className="h-2.5 w-2.5" /> Veto candidate
                                </span>
                              )}
                              {r.scoreConfirmed ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-tm-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-tm-primary">
                                  <CheckCircle2 className="h-2.5 w-2.5" /> AC-confirmed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-tm-accent/15 px-1.5 py-0.5 text-[9px] font-semibold text-tm-accent-dark">
                                  <AlertTriangle className="h-2.5 w-2.5" /> Provisional
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-1.5 pr-2 text-tm-text-muted">{dealCount}</td>
                          <td className="py-1.5 text-tm-text-light">{r.rationale}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </article>
          );
        })}
      </div>

      <p className="text-center text-xs text-tm-text-muted">
        Source: src/data/route-risk-given-commodity-2026-07-28.csv (decision 2026-07-28) — corridor
        base scores from tm-cram-reference-tables-2026-07.md Table 2, adjusted per product for
        cold-chain requirement and freshness ratio (transit days ÷ shelf-life days). See{" "}
        docs/product-route-table-gaps-2026-07.md for what to verify against real BL/customs history.
      </p>
    </div>
  );
}
