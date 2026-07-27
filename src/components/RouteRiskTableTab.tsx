import { useMemo } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { ROUTE_OPTIONS } from "../lib/route-risk-tables";
import { platformDeals } from "../data/platform-deals";

export function RouteRiskTableTab() {
  const dealCountByRoute = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of platformDeals) {
      const key = `${d.origin} -> ${d.destination}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, []);

  const unmatchedRoutes = useMemo(() => {
    const matched = new Set(
      ROUTE_OPTIONS.map(
        (r) =>
          `${r.origin.toLowerCase().trim()} -> ${r.destination.toLowerCase().trim()}`,
      ),
    );
    const misses = new Map<string, number>();
    for (const d of platformDeals) {
      const key = `${d.origin.toLowerCase().trim()} -> ${d.destination.toLowerCase().trim()}`;
      if (!matched.has(key)) {
        misses.set(
          `${d.origin} -> ${d.destination}`,
          (misses.get(`${d.origin} -> ${d.destination}`) ?? 0) + 1,
        );
      }
    }
    return [...misses.entries()];
  }, []);

  const provisionalCount = ROUTE_OPTIONS.filter((r) => !r.scoreConfirmed).length;
  const provisionalDealCount = ROUTE_OPTIONS.filter((r) => !r.scoreConfirmed).reduce(
    (sum, r) =>
      sum + (dealCountByRoute.get(`${r.origin} -> ${r.destination}`) ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="font-display text-3xl text-tm-black sm:text-4xl">
          Route Risk Table (CRAM Dimension C)
        </h1>
        <p className="mt-2 text-tm-text-light">
          {ROUTE_OPTIONS.length} corridors tabled · {provisionalCount} provisional
          (not AC-confirmed), backing {provisionalDealCount} real deals ·{" "}
          {unmatchedRoutes.length} corridor{unmatchedRoutes.length === 1 ? "" : "s"} in
          the platform dataset still fall back to the generic transport-mode estimate.
        </p>
      </div>

      <div className="space-y-3">
        {ROUTE_OPTIONS.map((r) => {
          const dealCount = dealCountByRoute.get(`${r.origin} -> ${r.destination}`) ?? 0;
          return (
            <article
              key={`${r.origin}->${r.destination}`}
              className="rounded-xl border border-tm-border bg-tm-surface p-4 shadow-tm-sm sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-tm-black">
                      {r.origin} → {r.destination}
                    </h3>
                    {r.scoreConfirmed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-tm-primary/10 px-2 py-0.5 text-[10px] font-semibold text-tm-primary">
                        <CheckCircle2 className="h-3 w-3" /> AC-confirmed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-tm-accent/15 px-2 py-0.5 text-[10px] font-semibold text-tm-accent-dark">
                        <AlertTriangle className="h-3 w-3" /> Provisional
                      </span>
                    )}
                    <span className="rounded-full bg-tm-neutral px-2 py-0.5 text-[10px] font-semibold text-tm-text-muted">
                      {dealCount} deal{dealCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-tm-text-light">
                    {r.estimatedTransitDays}-day transit · {r.numberOfTransshipments}{" "}
                    transshipment{r.numberOfTransshipments === 1 ? "" : "s"} · {r.routeRiskFlag} flag
                  </p>
                  <p className="mt-2 text-xs text-tm-text-light">{r.rationale}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-2xl font-bold text-tm-black">{r.score}</p>
                  <p className="text-[10px] text-tm-text-muted">/100</p>
                </div>
              </div>
            </article>
          );
        })}
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

      <p className="text-center text-xs text-tm-text-muted">
        Source: tm-cram-reference-tables-2026-07.md Table 2, extended 2026-07-24. See{" "}
        docs/product-route-table-gaps-2026-07.md for what to verify against real BL/customs history.
      </p>
    </div>
  );
}
