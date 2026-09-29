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
  counterpartySandboxMeta,
  sandboxCounterparties,
} from "../data/counterparty-sandbox-scores";
import { platformCounterpartiesBlocked, platformDeals } from "../data/platform-deals";
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
  sub,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
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
      {sub && <p className="text-[10px] opacity-70">{sub}</p>}
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
            Same formula as Platform deals / Assess
          </p>
        </div>
      </div>

      <section className="mt-5 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-tm-primary">
          How each score is built
        </p>
        <ol className="list-decimal space-y-2 pl-4 text-xs leading-relaxed text-tm-text">
          <li>
            <span className="font-medium">Raw average</span> — Σ(field score ×
            weight) ÷ Σ(filled weights). Blank fields are excluded.
          </li>
          <li>
            <span className="font-medium">Coverage</span> — the more
            conservative of filled weight ÷ possible weight and filled fields
            ÷ total fields. A couple of heavy fields (e.g. credit rating +
            years-in-business) no longer look as complete as their weight
            alone would suggest.
          </li>
          <li>
            <span className="font-medium">Shrink toward 50</span> — coverage ×
            raw + (1 − coverage) × 50. Thin profiles stay near neutral.
          </li>
          <li>
            <span className="font-medium">TM trust bonus</span> — +3 flat after
            shrink when the company is on the platform (or a known TM
            affiliate). Hand-set, not calibrated against outcomes yet.
          </li>
          <li>
            <span className="font-medium">Range</span> — best/worst case if
            every missing field turned out to score 100 / 0. The published
            score is the midpoint (missing fields assumed neutral).
          </li>
        </ol>
      </section>

      <div className="my-5 border-t border-tm-border" />

      <section className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-tm-primary">
          Customs enrichment
        </p>
        <ul className="space-y-2 text-xs leading-relaxed text-tm-text">
          <li>
            Annual volume (MT), yearly FOB, monthly FOB, and route diversity
            from Veritrade + Datasur when the company matches.
          </li>
          <li>
            Found in customs → frequency of deals scored from shipment count
            (yearly FOB ÷ 12 for monthly purchase volume).
          </li>
          <li>
            Sources: {counterpartySandboxMeta.customsSources.join("; ")}
          </li>
        </ul>
      </section>

      <div className="my-5 border-t border-tm-border" />

      <section className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-tm-primary">
          Live Dimension A
        </p>
        <p className="text-xs leading-relaxed text-tm-text-light">
          Platform deals / Assess use these same scores via{" "}
          <code className="rounded bg-tm-neutral px-1 text-[10px]">
            computeBuyerScore
          </code>{" "}
          /{" "}
          <code className="rounded bg-tm-neutral px-1 text-[10px]">
            computeSupplierScore
          </code>
          .
        </p>
      </section>

      <div className="mt-5 rounded-lg bg-tm-neutral-light px-3 py-2 text-[11px] leading-relaxed text-tm-text-muted">
        Regenerated {new Date(counterpartySandboxMeta.generatedAt).toLocaleString()}.
        Spec:{" "}
        <code className="text-[10px]">
          docs/counterparty-risk-scoring-method-outline-2026-07-30.md
        </code>
      </div>
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
  const score = cp.sandbox?.score ?? cp.avgScore;
  const tone = score >= 70 ? "good" : score >= 40 ? "warn" : "default";
  const RoleIcon = cp.role === "buyer" ? ShoppingCart : Truck;
  const sb = cp.sandbox;

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
            {sb?.customsMatched && (
              <span className="rounded-full bg-tm-primary/10 px-2 py-0.5 text-[10px] font-medium text-tm-primary">
                customs matched
              </span>
            )}
          </div>
          <h3 className="mt-1.5 font-semibold text-tm-black">{cp.companyName}</h3>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ScorePill
          label="Sandbox score"
          value={score}
          sub={sb ? `range ${sb.scoreLow}–${sb.scoreHigh}` : undefined}
          tone={tone}
        />
        <ScorePill
          label="Coverage"
          value={sb ? `${sb.coveragePct}%` : "—"}
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

      {sb && (
        <div className="mt-4 rounded-lg border border-tm-border bg-tm-neutral-light/60 px-3 py-3 text-xs text-tm-text">
          <p>
            Raw avg{" "}
            <span className="font-medium text-tm-black">
              {sb.rawAverage ?? "n/a"}
            </span>
            {" · "}
            trust +{sb.trustBonus}
            {sb.customsMatched && (
              <>
                {" · "}
                customs {sb.customsShipments} shipments
                {sb.customsVolumeMt != null && <> · {sb.customsVolumeMt} MT</>}
                {sb.customsRoutes != null && <> · {sb.customsRoutes} routes</>}
              </>
            )}
          </p>
          <p className="mt-1.5 text-[11px] text-tm-text-muted">
            Filled: {sb.filledFieldIds.join(", ") || "none"}
          </p>
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

function BlockedCounterpartyCard({
  cp,
  onGoToMissingFields,
}: {
  cp: PlatformCounterpartyBlocked;
  onGoToMissingFields?: () => void;
}) {
  const RoleIcon = cp.role === "buyer" ? ShoppingCart : Truck;
  return (
    <article className="rounded-xl border border-dashed border-tm-border bg-tm-surface/60 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-tm-accent/15 text-tm-accent-dark">
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
          </div>
          <h3 className="mt-1.5 font-semibold text-tm-black">{cp.companyName}</h3>
          <p className="mt-1 text-xs text-tm-text-light">
            No score — {cp.dealCount} deal{cp.dealCount === 1 ? "" : "s"} need{" "}
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
    () => sandboxCounterparties.filter((cp) => cp.role === "buyer"),
    [],
  );
  const suppliers = useMemo(
    () => sandboxCounterparties.filter((cp) => cp.role === "supplier"),
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
    roleFilter === "buyer"
      ? buyers
      : roleFilter === "supplier"
        ? suppliers
        : sandboxCounterparties;

  const blockedVisible =
    roleFilter === "buyer"
      ? blockedBuyers
      : roleFilter === "supplier"
        ? blockedSuppliers
        : platformCounterpartiesBlocked;

  const customsMatched = sandboxCounterparties.filter(
    (c) => c.sandbox?.customsMatched,
  ).length;

  return (
    <div className="space-y-6">
      <div className="text-center lg:text-left">
        <h1 className="font-display text-3xl text-tm-black sm:text-4xl">
          Counterparty risk scores
        </h1>
        <p className="mt-2 max-w-2xl text-tm-text-light">
          Sandbox weighted/shrink scores for {sandboxCounterparties.length}{" "}
          (company, role, product) profiles — {customsMatched} enriched from
          customs. Live CRAM Dimension A is unchanged.
        </p>
      </div>

      <div className="flex gap-2">
        {(
          [
            [
              "all",
              `All (${sandboxCounterparties.length + platformCounterpartiesBlocked.length})`,
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
              onAssess={onAssessDealId}
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
