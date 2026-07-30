import { useMemo, useState } from "react";
import {
  ArrowRight,
  Ban,
  Building2,
  Calculator,
  ShoppingCart,
  Truck,
} from "lucide-react";
import {
  platformCounterparties,
  platformCounterpartiesBlocked,
  platformDeals,
} from "../data/platform-deals";
import { formatUSD } from "../lib/assessment";
import type {
  PlatformCounterpartyBlocked,
  PlatformCounterpartyScore,
} from "../types/platform";

interface CounterpartyScoresTabProps {
  onAssessDealId?: (mongoId: string) => void;
  onGoToMissingFields?: () => void;
}

const platformDealByMongoId = new Map(platformDeals.map((d) => [d.mongoId, d]));

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
            Dimension A formula
          </h2>
          <p className="text-[11px] text-tm-text-muted">
            Same as Platform deals / Assess
          </p>
        </div>
      </div>

      <section className="mt-5 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-tm-primary">
          Per party (buyer or supplier)
        </p>
        <p className="rounded-lg bg-tm-neutral-light px-3 py-2 font-mono text-[11px] leading-relaxed text-tm-text">
          score = coverage × rawAvg + (1 − coverage) × 50 + trustBonus
        </p>
        <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-tm-text-light">
          <li>Raw avg = weighted mean of filled fields only</li>
          <li>Coverage = filled weight ÷ all field weights</li>
          <li>Thin profiles shrink toward neutral 50</li>
          <li>TM platform trust +3 flat when on platform</li>
          <li>Customs fills volume, sales, routes when matched</li>
        </ul>
      </section>

      <div className="my-4 border-t border-tm-border" />

      <section className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-tm-primary">
          Deal counterparty dimension
        </p>
        <p className="rounded-lg bg-tm-neutral-light px-3 py-2 font-mono text-[11px] leading-relaxed text-tm-text">
          composite over buyer + supplier + relationship fields
        </p>
        <p className="text-xs text-tm-text-light">
          Spec:{" "}
          <code className="text-[10px]">
            docs/counterparty-risk-scoring-method-outline-2026-07-30.md
          </code>
        </p>
      </section>
    </aside>
  );
}

function CounterpartyCard({
  cp,
  onAssess,
}: {
  cp: PlatformCounterpartyScore;
  onAssess?: (mongoId: string) => void;
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
            {cp.customsMatched && (
              <span className="rounded-full bg-tm-primary/10 px-2 py-0.5 text-[10px] font-medium text-tm-primary">
                customs matched
              </span>
            )}
          </div>
          <h3 className="mt-1.5 font-semibold text-tm-black">{cp.companyName}</h3>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ScorePill label="Score" value={cp.avgScore} tone={tone} />
        <ScorePill
          label="Coverage"
          value={cp.coveragePct != null ? `${cp.coveragePct}%` : "—"}
        />
        <ScorePill
          label="Years in business"
          value={`${cp.yearsInBusiness}${cp.yearsInBusinessSource === "default" ? "*" : ""}`}
        />
        <ScorePill
          label="Platform deals"
          value={`${cp.finishedDealCount}/${cp.dealCount}`}
        />
      </div>

      {(cp.rawAverage != null || cp.customsMatched) && (
        <div className="mt-4 rounded-lg border border-tm-border bg-tm-neutral-light/60 px-3 py-3 text-xs text-tm-text">
          <p>
            Raw avg{" "}
            <span className="font-medium text-tm-black">
              {cp.rawAverage ?? "n/a"}
            </span>
            {" · "}
            trust +{cp.trustBonus ?? 0}
            {cp.customsMatched && (
              <>
                {" · "}
                customs {cp.customsShipments} shipments
                {cp.customsVolumeMt != null && <> · {cp.customsVolumeMt} MT</>}
                {cp.customsRoutes != null && <> · {cp.customsRoutes} routes</>}
              </>
            )}
          </p>
          {cp.filledFieldIds && cp.filledFieldIds.length > 0 && (
            <p className="mt-1.5 text-[11px] text-tm-text-muted">
              Filled: {cp.filledFieldIds.join(", ")}
            </p>
          )}
        </div>
      )}

      <div className="mt-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-tm-text-muted">
          Platform deals ({cp.deals.length})
        </p>
        <ul className="max-h-48 space-y-1.5 overflow-y-auto">
          {cp.deals.map((deal) => {
            const record = platformDealByMongoId.get(deal.mongoId);
            return (
              <li
                key={deal.mongoId}
                className="flex items-center justify-between gap-2 rounded-lg border border-tm-border/60 px-2.5 py-1.5 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-tm-black">{deal.name}</p>
                  <p className="text-[11px] text-tm-text-muted">
                    {formatUSD(deal.dealValue)}
                    {record ? ` · ${record.origin} → ${record.destination}` : ""}
                    {typeof deal.score === "number" ? ` · score ${deal.score}` : ""}
                  </p>
                </div>
                {onAssess && (
                  <button
                    type="button"
                    onClick={() => onAssess(deal.mongoId)}
                    className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-tm-primary hover:underline"
                  >
                    Open
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </article>
  );
}

function BlockedCard({
  cp,
  onGoToMissingFields,
}: {
  cp: PlatformCounterpartyBlocked;
  onGoToMissingFields?: () => void;
}) {
  return (
    <article className="rounded-xl border border-dashed border-tm-border bg-tm-surface/60 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-tm-neutral text-tm-text-muted">
          <Ban className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-tm-text-muted">
            Missing years in business · {cp.role} · {cp.product}
          </p>
          <h3 className="mt-1 font-semibold text-tm-black">{cp.companyName}</h3>
          <p className="mt-1 text-xs text-tm-text-light">
            Cannot score without YIB ({cp.dealCount} deal
            {cp.dealCount === 1 ? "" : "s"}).
          </p>
        </div>
      </div>
      {onGoToMissingFields && (
        <button
          type="button"
          onClick={onGoToMissingFields}
          className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-tm-primary hover:underline"
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

  const scored = platformCounterparties;
  const buyers = useMemo(
    () => scored.filter((cp) => cp.role === "buyer"),
    [scored],
  );
  const suppliers = useMemo(
    () => scored.filter((cp) => cp.role === "supplier"),
    [scored],
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
    roleFilter === "buyer"
      ? buyers
      : roleFilter === "supplier"
        ? suppliers
        : scored;

  const blockedVisible =
    roleFilter === "buyer"
      ? blockedBuyers
      : roleFilter === "supplier"
        ? blockedSuppliers
        : platformCounterpartiesBlocked;

  const customsMatched = scored.filter((c) => c.customsMatched).length;

  return (
    <div className="space-y-6">
      <div className="text-center lg:text-left">
        <h1 className="font-display text-3xl text-tm-black sm:text-4xl">
          Counterparty risk scores
        </h1>
        <p className="mt-2 max-w-2xl text-tm-text-light">
          Dimension A scores for {scored.length} (company, role, product)
          profiles — same weighted/shrink formula used in Platform deals.
          {customsMatched > 0 && (
            <> {customsMatched} matched to customs aggregates.</>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "buyer", "supplier"] as const).map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => setRoleFilter(role)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
              roleFilter === role
                ? "bg-tm-primary text-white"
                : "bg-tm-neutral text-tm-text-muted hover:bg-tm-neutral/80"
            }`}
          >
            {role}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          {visible.map((cp) => (
            <CounterpartyCard
              key={cp.id}
              cp={cp}
              onAssess={onAssessDealId}
            />
          ))}
          {blockedVisible.map((cp) => (
            <BlockedCard
              key={cp.id}
              cp={cp}
              onGoToMissingFields={onGoToMissingFields}
            />
          ))}
        </div>
        <FormulaPanel />
      </div>
    </div>
  );
}
