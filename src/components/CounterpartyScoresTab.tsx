import { useMemo, useState } from "react";
import {
  ArrowRight,
  Ban,
  Building2,
  Calculator,
  ClipboardList,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { platformCounterparties, platformCounterpartiesBlocked, platformDeals } from "../data/platform-deals";
import { formatUSD } from "../lib/assessment";
import { platformDealToDeal } from "../lib/platform-deal-mapper";
import { explainPartyScore, type PartyScoreAudit } from "../lib/scoring";
import type {
  PlatformCounterpartyBlocked,
  PlatformCounterpartyDealRef,
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

function formatPts(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
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
            <span className="font-medium">Platform deal count</span> is counted
            per buyer↔supplier pair on that deal (`priorDealsBetweenParties`),
            not the company's total book — so the same supplier can score 85
            with a thin pair history and 100 with a thicker one.
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

function ScoreBandSummary({ cp }: { cp: PlatformCounterpartyScore }) {
  const bands = useMemo(() => {
    const map = new Map<number, { score: number; count: number; priorDeals: number[] }>();
    for (const d of cp.deals) {
      const row = map.get(d.score) ?? { score: d.score, count: 0, priorDeals: [] };
      row.count += 1;
      row.priorDeals.push(d.priorDeals);
      map.set(d.score, row);
    }
    return [...map.values()].sort((a, b) => a.score - b.score);
  }, [cp.deals]);

  if (cp.avgScore >= 100) return null;

  return (
    <div className="mt-4 rounded-lg border border-tm-border bg-tm-neutral-light/60 px-3 py-3">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-3.5 w-3.5 text-tm-primary" />
        <p className="text-[10px] font-semibold uppercase tracking-wide text-tm-primary">
          Why avg {cp.avgScore} &lt; 100
        </p>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-tm-text">
        Avg is the mean of this company's per-deal {cp.role} scores. Scores vary
        because platform-history points use{" "}
        <span className="font-medium">prior deals with that specific counterparty</span>
        , not company-wide volume.
      </p>
      <ul className="mt-2 space-y-1">
        {bands.map((b) => {
          const minPrior = Math.min(...b.priorDeals);
          const maxPrior = Math.max(...b.priorDeals);
          const priorLabel =
            minPrior === maxPrior ? `${minPrior} prior` : `${minPrior}–${maxPrior} prior`;
          return (
            <li key={b.score} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-tm-text">
                <span className="font-medium">{b.count}</span> deal{b.count === 1 ? "" : "s"} ·{" "}
                {priorLabel} with pair
              </span>
              <span className="shrink-0 font-medium text-tm-black">score {b.score}</span>
            </li>
          );
        })}
      </ul>
      {cp.yearsInBusiness < 5 && (
        <p className="mt-2 text-[11px] leading-relaxed text-tm-text-muted">
          Years in business = {cp.yearsInBusiness}
          {cp.role === "supplier"
            ? " → supplier ≥2 band is 0 pts (need ≥5 for +10). Deals with ≥10 prior still reach 100 via platform history + license."
            : " → buyer ≥2 band is +5 (need ≥5 for +10)."}
        </p>
      )}
    </div>
  );
}

function AuditorBreakdown({
  audit,
  deal,
  onAssess,
}: {
  audit: PartyScoreAudit;
  deal: PlatformCounterpartyDealRef;
  onAssess?: (mongoId: string) => void;
}) {
  const belowCeiling = audit.whyBelow100.length > 0;

  return (
    <div
      className={`rounded-lg border px-3 py-3 ${
        belowCeiling
          ? "border-tm-accent/30 bg-tm-accent/[0.04]"
          : "border-tm-primary/20 bg-tm-primary/[0.03]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-tm-black">{deal.name}</p>
          <p className="text-[11px] text-tm-text-muted">
            {formatUSD(deal.dealValue)} · {deal.priorDeals} prior deals with this pair ·{" "}
            {audit.role}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={`font-display text-xl ${
              belowCeiling ? "text-tm-accent-dark" : "text-tm-primary"
            }`}
          >
            {audit.score}
          </p>
          {onAssess && (
            <button
              type="button"
              onClick={() => onAssess(deal.mongoId)}
              className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-medium text-tm-primary hover:underline"
            >
              Open
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-tm-text-muted">Base</span>
          <span className="font-medium tabular-nums text-tm-black">{audit.base}</span>
        </div>
        {audit.lines.map((line) => (
          <div key={line.id} className="border-t border-tm-border/50 pt-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-tm-text">{line.label}</span>
              <span
                className={`shrink-0 tabular-nums font-medium ${
                  line.points < line.maxPoints ? "text-tm-accent-dark" : "text-tm-primary"
                }`}
              >
                {formatPts(line.points)}
                <span className="ml-1 text-[10px] font-normal text-tm-text-muted">
                  / {formatPts(line.maxPoints)}
                </span>
              </span>
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-tm-text-light">{line.detail}</p>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-tm-border pt-1.5 text-xs">
          <span className="font-semibold text-tm-black">
            Total{audit.rawTotal !== audit.score ? ` (raw ${audit.rawTotal}, clamped)` : ""}
          </span>
          <span className="font-medium tabular-nums text-tm-black">{audit.score}</span>
        </div>
      </div>

      {belowCeiling ? (
        <div className="mt-2.5 rounded-md bg-tm-accent/10 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-tm-accent-dark">
            Why {audit.score}, not 100
          </p>
          <ul className="mt-1.5 space-y-1">
            {audit.whyBelow100.map((reason) => (
              <li key={reason} className="text-[11px] leading-snug text-tm-text">
                {reason}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-2.5 text-[11px] text-tm-primary">
          Hit the 100 ceiling — band maxes and/or clamp filled every available point.
        </p>
      )}
    </div>
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

  const dealAudits = useMemo(() => {
    return cp.deals.map((deal) => {
      const record = platformDealByMongoId.get(deal.mongoId);
      const audit = record
        ? explainPartyScore(platformDealToDeal(record), cp.role)
        : null;
      return { deal, audit };
    });
  }, [cp.deals, cp.role]);

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

      <ScoreBandSummary cp={cp} />

      <div className="mt-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-tm-text-muted">
          Auditor detail — all {cp.deals.length} scored deal{cp.deals.length === 1 ? "" : "s"}
        </p>
        <div className="max-h-[40rem] space-y-3 overflow-y-auto pr-1">
          {dealAudits.map(({ deal, audit }) =>
            audit ? (
              <AuditorBreakdown
                key={deal.mongoId}
                audit={audit}
                deal={deal}
                onAssess={onAssess}
              />
            ) : (
              <div
                key={deal.mongoId}
                className="rounded-lg border border-dashed border-tm-border px-3 py-2 text-xs text-tm-text-muted"
              >
                {deal.name} — score {deal.score} (source deal record missing)
              </div>
            ),
          )}
        </div>
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
          its own — per company, per role, per product. Every scored deal under a counterparty
          shows the full auditor point breakdown.
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
