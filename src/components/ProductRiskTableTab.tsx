import { useMemo } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { PRODUCT_RISK_TABLE } from "../lib/product-risk-tables";
import { platformDeals } from "../data/platform-deals";

export function ProductRiskTableTab() {
  const dealCountByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of platformDeals) {
      map.set(d.product, (map.get(d.product) ?? 0) + 1);
    }
    return map;
  }, []);

  const provisionalCount = PRODUCT_RISK_TABLE.filter((p) => !p.scoreConfirmed).length;
  const provisionalDealCount = PRODUCT_RISK_TABLE.filter((p) => !p.scoreConfirmed).reduce(
    (sum, p) => sum + (dealCountByProduct.get(p.product) ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="font-display text-3xl text-tm-black sm:text-4xl">
          Product Risk Table (CRAM Dimension B)
        </h1>
        <p className="mt-2 text-tm-text-light">
          {PRODUCT_RISK_TABLE.length} products tabled · {provisionalCount} provisional
          (not AC-confirmed), backing {provisionalDealCount} real deals in the current
          platform dataset.
        </p>
      </div>

      <div className="space-y-3">
        {PRODUCT_RISK_TABLE.map((p) => {
          const dealCount = dealCountByProduct.get(p.product) ?? 0;
          return (
            <article
              key={p.product}
              className="rounded-xl border border-tm-border bg-tm-surface p-4 shadow-tm-sm sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-tm-black">{p.product}</h3>
                    {p.scoreConfirmed ? (
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
                    {p.perishabilityClass}
                    {p.shelfLifeDays !== null ? ` · ${p.shelfLifeDays}-day shelf life` : ""}
                    {p.coldChainRequired ? " · cold chain required" : ""}
                    {p.acRiskGroup ? ` · AC Group ${p.acRiskGroup}` : ""}
                  </p>
                  <p className="mt-2 text-xs text-tm-text-light">{p.rationale}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-2xl font-bold text-tm-black">{p.score}</p>
                  <p className="text-[10px] text-tm-text-muted">/100</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <p className="text-center text-xs text-tm-text-muted">
        Source: tm-cram-reference-tables-2026-07.md Table 1, extended 2026-07-24. See{" "}
        docs/product-route-table-gaps-2026-07.md for what to verify before treating the
        provisional rows as confirmed.
      </p>
    </div>
  );
}
