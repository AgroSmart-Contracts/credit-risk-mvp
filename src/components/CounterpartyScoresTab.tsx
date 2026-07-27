import { useMemo, useState } from "react";
import {
  ArrowRight,
  Ban,
  Building2,
  Calculator,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { platformCounterparties, platformCounterpartiesBlocked } from "../data/platform-deals";
import { formatUSD } from "../lib/assessment";
import type { PlatformCounterpartyBlocked, PlatformCounterpartyScore } from "../types/platform";

interface CounterpartyScoresTabProps {
  onAssessDealId?: (mongoId: string) => void;
  onGoToMissingFields?: () => void;
}

function ScorePill({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "good" | "warn";
}) {
  const toneClass =
    tone === "good"
      ? "bg-tm-primary/10 text-tm-primary"
      : tone === "warn"
        ? "bg-tm-accent/15 text-tm-accent-dark"
        : "bg-tm-neutral text-tm-text";
  return (
    <div className={`rounded-lg px-3 py-2 ${toneClass}`}>
      <p className="text-[10px] font-medium uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="font-display text-xl">{value}</p>
    </div>
  );
}

function FormulaPanel() {
  return (
    <aside className="rounded-xl border border-tm-border bg-tm-surface p-5 shadow-tm-sm lg:sticky lg:top-4">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-tm-primary/10 text-tm-primary">
          <Calculator className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-tm-black">
            Counterparty formulas
          </h2>
          <p className="text-[11px] text-tm-text-muted">
            What the scores on this page mean
          </p>
        </div>
      </div>

      <section className="mt-5 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-tm-primary">
          Per-counterparty score (this page)
        </p>
        <p className="text-xs leading-relaxed text-tm-text-light">
          Each row here is one company, in one role, for one product —{" "}
          <code className="rounded bg-tm-neutral px-1 text-[10px]">
            computeBuyerScore()
          </code>{" "}
          or{" "}
          <code className="rounded bg-tm-neutral px-1 text-[10px]">
            computeSupplierScore()
          </code>{" "}
          directly, not a blended pair score. Matches the ERD: `Counterparty`
          is a per-company-per-role entity with its own `riskScore` — `CRAM
          Assessment` references a separate buyer and supplier Counterparty
          record, not a merged one.
        </p>
        <ul className="space-y-2 text-xs leading-relaxed text-tm-text">
          <li>
            <span className="font-medium">Buyer</span> = base 50 + platform
            deals & completion rate + years-in-business band + credit rating
            + license validity + capacity
          </li>
          <li>
            <span className="font-medium">Supplier</span> = base 50 +
            platform deals & on-time rate + years-in-business band + quality
            certifications + license validity + capacity
          </li>
          <li>
            <span className="font-medium">Buyer credit rating</span> = Coface
            CRA/DRA grade for the buyer's company (preferred) or the buyer's
            company's country, when a Coface document has been analyzed for
            one of its deals — otherwise neutral (no platform-CSV deal has one
            yet)
          </li>
          <li>
            <span className="font-medium">Capacity</span> (buyer & supplier) =
            neutral — no data source anywhere yet
          </li>
        </ul>
        <p className="text-[10px] text-tm-text-muted">
          Source:{" "}
          <code className="text-[10px]">scoring.ts</code> /{" "}
          <code className="text-[10px]">
            docs/cram-formula-erd-audit-2026-07.md
          </code>
        </p>
      </section>

      <div className="my-5 border-t border-tm-border" />

      <section className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-tm-primary">
          Deal-level Dimension A (elsewhere)
        </p>
        <p className="text-xs leading-relaxed text-tm-text-light">
          A single deal's own CRAM composite still blends both parties —
          buyer×0.5 + supplier×0.5 + relationship signal — that's{" "}
          <code className="rounded bg-tm-neutral px-1 text-[10px]">
            computeCounterpartyScore()
          </code>
          , visible on the Platform deals tab and each deal's own risk
          dashboard, not on this page.
        </p>
      </section>

      <div className="mt-5 rounded-lg bg-tm-neutral-light px-3 py-2 text-[11px] leading-relaxed text-tm-text-muted">
        Assumed for MVP: license valid;{" "}
        <span className="font-medium text-tm-text">avgPaymentDelayDays = 0</span>
        ;{" "}
        <span className="font-medium text-tm-text">
          qualityRejectionRatePct = 0
        </span>{" "}
        (full points). Coface coverage is per-deal, Gate-1 pre-check — not a
        counterparty score input; see Missing fields / Platform deals. A deal
        can also be vetoed outright (spec §6) regardless of this score — see
        the deal's own risk dashboard.
      </div>
    </aside>
  );
}

function CounterpartyCard({
  cp,
  onAssess,
}: {
  cp: PlatformCounterpartyScore;
  onAssess?: () => void;
}) {
  const tone = cp.avgScore >= 70 ? "good" : cp.avgScore >= 40 ? "warn" : "default";
  const RoleIcon = cp.role === "buyer" ? ShoppingCart : Truck;

  return (
    <article className="rounded-xl border border-tm-border bg-tm-surface p-5 shadow-tm-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-tm-primary/10 text-tm-primary">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                cp.role === "buyer"
                  ? "bg-tm-blue/10 text-tm-blue"
                  : "bg-tm-accent/15 text-tm-accent-dark"
              }`}
            >
              <RoleIcon className="h-3 w-3" />
              {cp.role === "buyer" ? "Buyer" : "Supplier"}
            </span>
            <span className="rounded-full bg-tm-neutral px-2 py-0.5 text-[10px] font-medium text-tm-text-muted">
              {cp.product}
            </span>
          </div>
          <h3 className="mt-1.5 font-semibold text-tm-black">{cp.companyName}</h3>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ScorePill label="Avg score" value={cp.avgScore} tone={tone} />
        <ScorePill
          label="Score range"
          value={`${cp.minScore}–${cp.maxScore}`}
        />
        <ScorePill
          label="Years in business"
          value={`${cp.yearsInBusiness}${cp.yearsInBusinessSource === "default" ? "*" : ""}`}
        />
        <ScorePill
          label="Deals"
          value={`${cp.finishedDealCount}/${cp.dealCount}`}
        />
      </div>
      {cp.yearsInBusinessSource === "default" && (
        <p className="mt-1 text-[10px] text-tm-text-muted">
          * no years-in-business on file for this company — defaulted to neutral
        </p>
      )}

      <div className="mt-4 max-h-40 space-y-1 overflow-y-auto">
        {cp.deals.slice(0, 8).map((d) => (
          <div
            key={d.mongoId}
            className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-tm-neutral-light"
          >
            <span className="truncate text-tm-text">{d.name}</span>
            <span className="shrink-0 text-tm-text-muted">
              {formatUSD(d.dealValue)} · score {d.score}
            </span>
          </div>
        ))}
        {cp.deals.length > 8 && (
          <p className="px-2 text-[10px] text-tm-text-muted">
            +{cp.deals.length - 8} more deals
          </p>
        )}
      </div>

      {onAssess && (
        <button
          type="button"
          onClick={onAssess}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-tm-primary px-3 py-2 text-sm font-medium text-white hover:bg-tm-primary-dark"
        >
          View scored deal
          <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </article>
  );
}

function BlockedCounterpartyCard({
  cp,
  onGoToMissingFields,
}: {
  cp: PlatformCounterpartyBlocked;
  onGoToMissingFields?: () => void;
}) {
  const RoleIcon = cp.role === "buyer" ? ShoppingCart : Truck;

  return (
    <article className="rounded-xl border border-dashed border-tm-text-muted/40 bg-tm-neutral-light p-5 shadow-tm-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-tm-text-muted/10 text-tm-text-muted">
          <Ban className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                cp.role === "buyer"
                  ? "bg-tm-blue/10 text-tm-blue"
                  : "bg-tm-accent/15 text-tm-accent-dark"
              }`}
            >
              <RoleIcon className="h-3 w-3" />
              {cp.role === "buyer" ? "Buyer" : "Supplier"}
            </span>
            <span className="rounded-full bg-tm-neutral px-2 py-0.5 text-[10px] font-medium text-tm-text-muted">
              {cp.product}
            </span>
            <span className="rounded-full bg-tm-danger/10 px-2 py-0.5 text-[10px] font-semibold text-tm-danger-dark">
              No years in business on file
            </span>
          </div>
          <h3 className="mt-1.5 font-semibold text-tm-black">{cp.companyName}</h3>
          <p className="mt-1 text-xs text-tm-text-light">
            No score can be computed — {cp.dealCount} deal{cp.dealCount === 1 ? "" : "s"}{" "}
            ({cp.finishedDealCount} finished) depend on this company's{" "}
            {cp.role} years-in-business.
          </p>
        </div>
      </div>

      {onGoToMissingFields && (
        <button
          type="button"
          onClick={onGoToMissingFields}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-tm-border bg-tm-surface px-3 py-2 text-sm font-medium text-tm-text hover:border-tm-primary hover:text-tm-primary"
        >
          Fill in years in business
          <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </article>
  );
}

export function CounterpartyScoresTab({
  onAssessDealId,
  onGoToMissingFields,
}: CounterpartyScoresTabProps) {
  const [roleFilter, setRoleFilter] = useState<"all" | "buyer" | "supplier">("all");

  const buyers = useMemo(
    () => platformCounterparties.filter((cp) => cp.role === "buyer"),
    [],
  );
  const suppliers = useMemo(
    () => platformCounterparties.filter((cp) => cp.role === "supplier"),
    [],
  );
  const blockedBuyers = useMemo(
    () => platformCounterpartiesBlocked.filter((cp) => cp.role === "buyer"),
    [],
  );
  const blockedSuppliers = useMemo(
    () => platformCounterpartiesBlocked.filter((cp) => cp.role === "supplier"),
    [],
  );

  const visible =
    roleFilter === "buyer" ? buyers : roleFilter === "supplier" ? suppliers : platformCounterparties;

  const blockedVisible =
    roleFilter === "buyer" ? blockedBuyers : roleFilter === "supplier" ? blockedSuppliers : platformCounterpartiesBlocked;

  return (
    <div className="space-y-6">
      <div className="text-center lg:text-left">
        <h1 className="font-display text-3xl text-tm-black sm:text-4xl">
          Counterparty risk scores
        </h1>
        <p className="mt-2 max-w-2xl text-tm-text-light">
          {buyers.length + blockedBuyers.length} buyer profiles ({buyers.length} scored,{" "}
          {blockedBuyers.length} blocked) + {suppliers.length + blockedSuppliers.length} supplier
          profiles ({suppliers.length} scored, {blockedSuppliers.length} blocked), each scored on
          its own — per company, per role, per product — not as buyer↔supplier pairs. See the
          formula panel for why.
        </p>
      </div>

      <div className="flex gap-2">
        {(
          [
            [
              "all",
              `All (${platformCounterparties.length + platformCounterpartiesBlocked.length})`,
            ],
            ["buyer", `Buyers (${buyers.length + blockedBuyers.length})`],
            ["supplier", `Suppliers (${suppliers.length + blockedSuppliers.length})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setRoleFilter(value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              roleFilter === value
                ? "bg-tm-primary text-white"
                : "bg-tm-neutral text-tm-text-light hover:text-tm-black"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {visible.map((cp) => (
            <CounterpartyCard
              key={cp.id}
              cp={cp}
              onAssess={
                cp.deals[0] && onAssessDealId
                  ? () => onAssessDealId(cp.deals[0].mongoId)
                  : undefined
              }
            />
          ))}
          {visible.length === 0 && blockedVisible.length === 0 && (
            <p className="py-8 text-center text-sm text-tm-text-muted">
              No counterparties in this view
            </p>
          )}

          {blockedVisible.length > 0 && (
            <>
              <h2 className="pt-2 text-sm font-semibold text-tm-black">
                Blocked — no years-in-business on file ({blockedVisible.length})
              </h2>
              {blockedVisible.map((cp) => (
                <BlockedCounterpartyCard
                  key={cp.id}
                  cp={cp}
                  onGoToMissingFields={onGoToMissingFields}
                />
              ))}
            </>
          )}
        </div>
        <FormulaPanel />
      </div>
    </div>
  );
}
