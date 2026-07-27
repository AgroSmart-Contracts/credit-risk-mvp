import { ArrowRight, Calculator, Cherry, Citrus, Grape, Leaf } from "lucide-react";
import {
  prescoredPlatformDeals,
  type PrescoredDeal,
} from "../data/prescored-deals";
import { formatUSDDetailed } from "../lib/assessment";
import { getTierColors } from "../lib/risk-colors";

interface PrescoredDealsTabProps {
  onSelect: (dealId: string) => void;
}

const productIcons: Record<string, typeof Citrus> = {
  "Fresh Mandarin": Citrus,
  "Fresh Blueberries": Grape,
  "Fresh Strawberries": Cherry,
  "Fresh Ginger": Leaf,
  "Fresh Avocado": Leaf,
  "Fresh Grapes": Grape,
  "Fresh Asparagus": Leaf,
};

function routeLabel(origin: string, destination: string): string {
  const from = origin.split(",")[1]?.trim() ?? origin;
  const to = destination.split(",")[1]?.trim() ?? destination;
  return `${from} → ${to}`;
}

function CramFormulaPanel() {
  return (
    <aside className="rounded-xl border border-tm-border bg-tm-surface p-5 shadow-tm-sm lg:sticky lg:top-4">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-tm-primary/10 text-tm-primary">
          <Calculator className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-tm-black">
            How scores are calculated
          </h2>
          <p className="text-[11px] text-tm-text-muted">
            Full CRAM for platform deals
          </p>
        </div>
      </div>

      <section className="mt-5 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-tm-primary">
          Overall score
        </p>
        <p className="rounded-lg bg-tm-neutral-light px-3 py-2 font-mono text-[11px] leading-relaxed text-tm-text">
          overall = Counterparty×0.40 + Product×0.25 + Route×0.20 +
          Structure×0.15
        </p>
        <p className="text-[10px] text-tm-text-muted">
          Source:{" "}
          <code className="text-[10px]">scoring.ts</code> /{" "}
          <code className="text-[10px]">
            docs/cram-formula-erd-audit-2026-07.md
          </code>
        </p>
      </section>

      <div className="my-4 border-t border-tm-border" />

      <section className="space-y-3 text-xs leading-relaxed text-tm-text">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-tm-primary">
            A · Counterparty (40%)
          </p>
          <p className="mt-1 text-tm-text-light">
            buyer×0.5 + supplier×0.5 + relationship signal
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-tm-text-light">
            <li>YIB bands + license (assumed valid) + platform track record</li>
            <li>Credit rating from Coface CRA/DRA grade, when on file</li>
            <li>
              Payment delay = 0 days · quality rejection = 0% (perfect defaults)
            </li>
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-tm-primary">
            B · Product (25%)
          </p>
          <p className="mt-1 text-tm-text-light">
            Product risk table score (perishability / cold chain) + quality
            grade + price-vs-market benchmark (Fresh Blueberries only so far)
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-tm-primary">
            C · Route (20%)
          </p>
          <p className="mt-1 text-tm-text-light">
            Corridor table or transit/transshipment/flag by freight mode, +
            incoterm + cold-chain requirement
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-tm-primary">
            D · Structure (15%)
          </p>
          <p className="mt-1 text-tm-text-light">
            Base 60 + collateral + insurance + payment terms + relationship
            history + advance %
          </p>
        </div>
      </section>

      <div className="my-4 border-t border-tm-border" />

      <section className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-tm-primary">
          Risk tiers
        </p>
        <ul className="space-y-1 text-xs text-tm-text-light">
          <li>≥ 75 → Low</li>
          <li>60–74 → Medium-Low</li>
          <li>45–59 → Medium-High</li>
          <li>&lt; 45 → High</li>
          <li>Veto → hard stop (spec §6), overrides the score above</li>
        </ul>
      </section>

      <div className="mt-5 rounded-lg bg-tm-neutral-light px-3 py-2 text-[11px] leading-relaxed text-tm-text-muted">
        Financing interest = 6.0% base + risk premium from overall score. See
        Missing fields tab for Coface / customs gaps still open on deals.
      </div>
    </aside>
  );
}

function PrescoredCard({
  entry,
  onSelect,
}: {
  entry: PrescoredDeal;
  onSelect: (dealId: string) => void;
}) {
  const { deal, assessment } = entry;
  const Icon = productIcons[deal.product] ?? Citrus;
  const tierColors = getTierColors(assessment.tier);

  return (
    <button
      type="button"
      onClick={() => onSelect(deal.id)}
      className="group flex w-full items-center gap-4 rounded-xl border border-tm-border bg-tm-surface p-5 text-left shadow-tm-sm transition-all duration-200 hover:border-tm-primary/40 hover:shadow-tm-md"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-tm-primary/10 text-tm-primary">
        <Icon className="h-6 w-6" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-semibold text-tm-black">{deal.product}</span>
          <span className="text-sm text-tm-text-light">{deal.variety}</span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tierColors.badge}`}
          >
            Score {Math.round(assessment.overall)} ·{" "}
            {assessment.tier.replace(" Risk", "")}
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
}

export function PrescoredDealsTab({ onSelect }: PrescoredDealsTabProps) {
  const sorted = [...prescoredPlatformDeals].sort(
    (a, b) => b.assessment.overall - a.assessment.overall,
  );

  return (
    <div className="space-y-6">
      <div className="text-center lg:text-left">
        <h1 className="font-display text-3xl text-tm-black sm:text-4xl">
          Platform deals · pre-scored
        </h1>
        <p className="mt-2 max-w-2xl text-tm-text-light">
          {prescoredPlatformDeals.length} CSV-ready deals with full CRAM already
          run. Select one to open the risk dashboard and financing terms.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-3">
          {sorted.map((entry) => (
            <PrescoredCard
              key={entry.deal.id}
              entry={entry}
              onSelect={onSelect}
            />
          ))}
        </div>
        <CramFormulaPanel />
      </div>
    </div>
  );
}
