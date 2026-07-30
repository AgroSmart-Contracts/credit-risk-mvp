import { useMemo } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { PRODUCT_RISK_TABLE } from "../lib/product-risk-tables";
import { platformDeals } from "../data/platform-deals";

/**
 * Product attribute catalog (perishability, shelf life, cold chain, AC group).
 * Hardcoded AC 0–100 scores are shown as legacy reference only — live
 * Dimension B uses perishability class + quality grade + price-vs-usual.
 */
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
          Product attributes
        </h1>
        <p className="mt-2 max-w-2xl mx-auto text-tm-text-light">
          {PRODUCT_RISK_TABLE.length} products · {provisionalCount} provisional
          (not AC-confirmed), backing {provisionalDealCount} deals. Live Product
          Risk uses perishability class + grade + month×route price — not the
          legacy AC score on each card.
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
                        <CheckCircle2 className="h-3 w-3" /> AC-confirmed attrs
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
                  <p className="text-[10px] uppercase tracking-wide text-tm-text-muted">
                    Legacy AC score
                  </p>
                  <p className="text-lg font-semibold text-tm-text-muted line-through decoration-tm-border">
                    {p.score}
                  </p>
                  <p className="text-[10px] text-tm-text-muted">not used in live B</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <p className="text-center text-xs text-tm-text-muted">
        Attribute source: tm-cram-reference-tables-2026-07.md Table 1. Price unit
        for live scoring is always USD/kg vs month×route usual (see Product Risk
        on a deal).
      </p>
    </div>
  );
}
