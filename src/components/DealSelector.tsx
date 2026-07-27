import { ArrowRight, Cherry, Citrus, FileUp, Grape } from "lucide-react";
import type { Deal } from "../types";
import { formatUSDDetailed } from "../lib/assessment";

interface DealSelectorProps {
  deals: Deal[];
  onSelect: (deal: Deal) => void;
  onCreateNew: () => void;
}

const productIcons: Record<string, typeof Citrus> = {
  "Fresh Mandarin": Citrus,
  "Fresh Blueberries": Grape,
  "Fresh Strawberries": Cherry,
};

function routeLabel(origin: string, destination: string): string {
  const from = origin.split(",")[1]?.trim() ?? origin;
  const to = destination.split(",")[1]?.trim() ?? destination;
  return `${from} → ${to}`;
}

export function DealSelector({
  deals,
  onSelect,
  onCreateNew,
}: DealSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl text-tm-black sm:text-4xl">
          Select a deal to assess
        </h1>
        <p className="mt-2 text-tm-text-light">
          Multi-dimensional assessment — documentation-driven scoring with
          platform enrichment
        </p>
      </div>

      <button
        type="button"
        onClick={onCreateNew}
        className="group flex w-full items-center gap-4 rounded-xl border border-dashed border-tm-primary/35 bg-tm-surface p-5 text-left shadow-tm-sm transition-all duration-200 hover:border-tm-primary hover:shadow-tm-md"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-tm-primary/10 text-tm-primary">
          <FileUp className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-tm-black">
            Create deal assessment
          </div>
          <p className="mt-0.5 text-sm text-tm-text-light">
            Upload trade documents, select product and route from the risk
            tables, and add manual or document-based Coface cover.
          </p>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 text-tm-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-tm-primary" />
      </button>

      <p className="pt-2 text-center text-[11px] font-semibold uppercase tracking-wide text-tm-text-muted">
        Or choose a sample deal
      </p>

      {deals.map((deal) => {
        const Icon = productIcons[deal.product] ?? Citrus;
        return (
          <button
            key={deal.id}
            type="button"
            onClick={() => onSelect(deal)}
            className="group flex w-full items-center gap-4 rounded-xl border border-tm-border bg-tm-surface p-5 text-left shadow-tm-sm transition-all duration-200 hover:border-tm-primary/40 hover:shadow-tm-md"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-tm-primary/10 text-tm-primary">
              <Icon className="h-6 w-6" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-semibold text-tm-black">
                  {deal.product}
                </span>
                <span className="text-sm text-tm-text-light">
                  {deal.variety}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-tm-text-light">
                {routeLabel(deal.origin, deal.destination)}
              </p>
              <p className="mt-1 text-xs text-tm-text-muted">{deal.teaser}</p>
            </div>

            <div className="hidden shrink-0 text-right sm:block">
              <p className="font-display text-xl text-tm-black">
                {formatUSDDetailed(deal.dealValueUSD)}
              </p>
              <p className="text-xs text-tm-text-muted">{deal.dealRef}</p>
            </div>

            <ArrowRight className="h-5 w-5 shrink-0 text-tm-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-tm-primary" />
          </button>
        );
      })}
    </div>
  );
}
