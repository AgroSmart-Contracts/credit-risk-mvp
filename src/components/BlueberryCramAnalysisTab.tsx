import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  loadBlueberryCramCases,
  type BlueberryCramCase,
  type CounterpartyMethodAudit,
  type DimensionBreakdown,
} from "../lib/blueberry-cram-analysis";
import { formatUSD } from "../lib/assessment";
import { SANDBOX_NEUTRAL } from "../lib/counterparty-sandbox-scoring";
import {
  formatDecisionLabel,
  getDecisionStyle,
  getScoreBarColor,
  getTierColors,
} from "../lib/risk-colors";

function ScorePill({ score }: { score: number }) {
  return (
    <span
      className={`inline-flex min-w-[2.5rem] items-center justify-center rounded-md px-2 py-0.5 text-sm font-semibold text-white ${getScoreBarColor(score)}`}
    >
      {Math.round(score)}
    </span>
  );
}

function CounterpartyMethodPanel({ audit }: { audit: CounterpartyMethodAudit }) {
  // Worked example using the Buyer row's real numbers, so the formula can be
  // checked by eye against the table below instead of staying purely symbolic.
  const ex = audit.parties[0];
  const exRemainder = Math.round((100 - ex.coveragePct) * 10) / 10;
  return (
    <div className="mb-3 space-y-3 rounded-lg border border-tm-blue/30 bg-tm-blue/5 px-3 py-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-tm-blue">
          Raw avg · coverage · shrink (same math as Counterparties)
        </p>
        <p className="mt-1 font-mono text-[11px] text-tm-text-muted">
          raw = Σ(score×w) ÷ Σ(filled w) · coverage = min(filled w ÷ possible
          w, filled fields ÷ total fields) · shrink = coverage×raw +
          (1−coverage)×{SANDBOX_NEUTRAL} · then +trust
        </p>
        <p className="mt-1.5 font-mono text-[11px] text-tm-blue">
          Worked example ({ex.label}): raw {ex.rawAverage ?? "—"} from{" "}
          {ex.filledWeight}/{ex.possibleWeight} filled w · coverage min(
          {ex.weightCoveragePct}% w-cov, {ex.fieldCoveragePct}% field-cov [
          {ex.filledFieldCount}/{ex.totalFieldCount}]) = {ex.coveragePct}% ·
          shrink {ex.coveragePct}%×{ex.rawAverage ?? 0} + {exRemainder}%×
          {SANDBOX_NEUTRAL} = {ex.shrunkScore} · +{ex.trustBonus} trust ={" "}
          {ex.finalScore} (range {ex.rangeLow}–{ex.rangeHigh})
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-xs">
          <thead>
            <tr className="border-b border-tm-border text-[10px] uppercase tracking-wide text-tm-text-muted">
              <th className="py-1.5 pr-2 font-medium">Group</th>
              <th className="py-1.5 pr-2 font-medium">Raw avg</th>
              <th className="py-1.5 pr-2 font-medium">Coverage</th>
              <th className="py-1.5 pr-2 font-medium">Filled / possible w</th>
              <th className="py-1.5 pr-2 font-medium">After shrink</th>
              <th className="py-1.5 pr-2 font-medium">+ Trust</th>
              <th className="py-1.5 pr-2 font-medium">Final</th>
              <th className="py-1.5 pr-2 font-medium">Range</th>
              <th className="py-1.5 font-medium">CP tab sandbox</th>
            </tr>
          </thead>
          <tbody>
            {audit.parties.map((p) => (
              <tr
                key={p.label}
                className="border-b border-tm-border/60 align-top last:border-0"
              >
                <td className="py-1.5 pr-2 font-medium text-tm-black">
                  {p.label}
                </td>
                <td className="py-1.5 pr-2 tabular-nums">
                  {p.rawAverage == null ? "—" : p.rawAverage}
                </td>
                <td className="py-1.5 pr-2 tabular-nums">
                  {p.coveragePct}%
                  <span className="block text-[10px] font-normal text-tm-text-muted">
                    min({p.weightCoveragePct}%, {p.fieldCoveragePct}%)
                  </span>
                </td>
                <td className="py-1.5 pr-2 tabular-nums text-tm-text-muted">
                  {p.filledWeight} / {p.possibleWeight}
                </td>
                <td className="py-1.5 pr-2 tabular-nums">
                  {p.shrunkScore}
                  <span className="block text-[10px] font-normal text-tm-text-muted">
                    {p.coveragePct}%×{p.rawAverage ?? 0} +{" "}
                    {Math.round((100 - p.coveragePct) * 10) / 10}%×
                    {SANDBOX_NEUTRAL}
                  </span>
                </td>
                <td className="py-1.5 pr-2 tabular-nums">
                  {p.trustBonus > 0 ? `+${p.trustBonus}` : "0"}
                </td>
                <td className="py-1.5 pr-2">
                  <ScorePill score={p.finalScore} />
                </td>
                <td className="py-1.5 pr-2 tabular-nums text-tm-text-muted">
                  {p.rangeLow}–{p.rangeHigh}
                </td>
                <td className="py-1.5 tabular-nums text-tm-text-muted">
                  {p.publishedSandboxScore == null
                    ? "—"
                    : Math.round(p.publishedSandboxScore)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-tm-text-muted">
            Method
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] leading-snug text-tm-text-light">
            {audit.why.map((line) => (
              <li key={line.slice(0, 48)}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-tm-text-muted">
            Gaps to fill
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] leading-snug text-tm-text-light">
            {audit.improvements.map((line) => (
              <li key={line.slice(0, 48)}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function fieldRowTone(highlight?: string): {
  row: string;
  value: string;
  label: string;
} {
  // Match pre-scored Structure KpiStrip tones (primary / danger / accent).
  if (highlight === "danger") {
    return {
      row: "bg-tm-danger/10 border-tm-danger/30",
      value: "font-bold text-tm-danger-dark",
      label: "font-semibold text-tm-danger-dark",
    };
  }
  if (highlight === "primary") {
    return {
      row: "bg-tm-primary/10 border-tm-primary/25",
      value: "font-bold text-tm-primary-dark",
      label: "font-semibold text-tm-primary-dark",
    };
  }
  if (highlight === "accent") {
    return {
      row: "bg-tm-accent/10 border-tm-accent/30",
      value: "font-bold text-tm-accent-dark",
      label: "font-semibold text-tm-accent-dark",
    };
  }
  if (highlight === "call") {
    return {
      row: "bg-tm-blue/10 border-tm-blue/30",
      value: "font-bold text-tm-blue",
      label: "font-semibold text-tm-blue",
    };
  }
  return {
    row: "border-tm-border/60",
    value: "text-tm-text-light",
    label: "font-medium text-tm-black",
  };
}

function DimensionBlock({ dim }: { dim: DimensionBreakdown }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-lg border border-tm-border bg-tm-neutral-light/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {open ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-tm-text-muted" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-tm-text-muted" />
            )}
            <span className="font-semibold text-tm-black">{dim.title}</span>
            <ScorePill score={dim.score} />
            <span className="text-[10px] uppercase tracking-wide text-tm-text-muted">
              weight {(dim.weight * 100).toFixed(0)}% · contrib{" "}
              {dim.contribution.toFixed(1)}
            </span>
          </div>
          <p className="mt-1 pl-6 text-xs text-tm-text-light">{dim.why}</p>
        </div>
      </button>
      {open && (
        <div className="border-t border-tm-border px-3 pb-3 pt-2">
          <p className="mb-2 font-mono text-[11px] text-tm-text-muted">
            {dim.formula}
          </p>
          {dim.methodAudit ? (
            <CounterpartyMethodPanel audit={dim.methodAudit} />
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-xs">
              <thead>
                <tr className="border-b border-tm-border text-[10px] uppercase tracking-wide text-tm-text-muted">
                  <th className="py-1.5 pr-2 font-medium">Field</th>
                  <th className="py-1.5 pr-2 font-medium">Input value</th>
                  <th className="py-1.5 pr-2 font-medium">Pts / score</th>
                  <th className="py-1.5 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {dim.fields.map((f) => {
                  const tone = fieldRowTone(f.highlight);
                  return (
                    <tr
                      key={f.id}
                      className={`border-b align-top last:border-0 ${tone.row}`}
                    >
                      <td className={`py-2 pr-2 ${tone.label}`}>
                        {f.label}
                        {f.highlight ? (
                          <span className="ml-1.5 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide opacity-70">
                            key
                          </span>
                        ) : null}
                      </td>
                      <td className={`py-2 pr-2 tabular-nums ${tone.value}`}>
                        {f.input}
                      </td>
                      <td className="py-2 pr-2 tabular-nums text-tm-black">
                        {f.score == null ? (
                          <span className="text-tm-text-muted">—</span>
                        ) : (
                          <span className={f.highlight ? tone.value : undefined}>
                            {Math.round(f.score)}
                          </span>
                        )}
                        {f.weight > 0 ? (
                          <span className="ml-1 text-[10px] text-tm-text-muted">
                            · w{f.weight}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 text-tm-text-muted">{f.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function DealCaseCard({
  c,
  selected,
  onSelect,
}: {
  c: BlueberryCramCase;
  selected: boolean;
  onSelect: () => void;
}) {
  const colors = getTierColors(c.tier);
  const decision = getDecisionStyle(c.financing.decision);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-3 text-left transition-shadow sm:p-4 ${
        selected
          ? "border-tm-primary bg-tm-primary/5 shadow-tm-sm"
          : "border-tm-border bg-tm-surface hover:border-tm-primary/40"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[10px] text-tm-text-muted">
            {c.record.dealRef || c.mongoId.slice(0, 10)}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-tm-black">
            {c.deal.buyer.name}
          </p>
          <p className="text-xs text-tm-text-light">← {c.deal.supplier.name}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-semibold tabular-nums text-tm-black">
            {c.overall}
          </p>
          <span
            className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${colors.badge}`}
          >
            {c.tier}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        <span className="rounded-md bg-tm-neutral px-2 py-0.5 text-tm-text-muted">
          APY {c.estimatedApyPct.toFixed(1)}%
        </span>
        <span className="rounded-md bg-tm-neutral px-2 py-0.5 font-medium text-tm-text-muted">
          {c.riskReward.callLabel}
        </span>
        <span
          className={`rounded-md border px-2 py-0.5 font-medium ${decision.className}`}
        >
          {formatDecisionLabel(c.financing.decision)}
        </span>
        {c.vetoed && (
          <span className="inline-flex items-center gap-1 rounded-md bg-tm-danger/10 px-2 py-0.5 font-medium text-tm-danger-dark">
            <AlertTriangle className="h-3 w-3" /> Veto
          </span>
        )}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[10px]">
        {c.dimensions.map((d) => (
          <div key={d.key} className="rounded bg-tm-neutral-light px-1 py-1">
            <p className="text-tm-text-muted">{d.key.slice(0, 1).toUpperCase()}</p>
            <p className="font-semibold tabular-nums text-tm-black">
              {Math.round(d.score)}
            </p>
          </div>
        ))}
      </div>
    </button>
  );
}

function investmentCallStyle(call: BlueberryCramCase["riskReward"]["call"]): string {
  if (call === "fund") return "border-tm-primary/40 bg-tm-primary/10 text-tm-primary-dark";
  if (call === "fund-with-conditions")
    return "border-tm-accent/50 bg-tm-accent/10 text-tm-accent-dark";
  if (call === "restructure")
    return "border-tm-accent/60 bg-tm-accent/15 text-tm-accent-dark";
  return "border-tm-danger/40 bg-tm-danger/10 text-tm-danger-dark";
}

function StructureInvestmentPanel({ c }: { c: BlueberryCramCase }) {
  const rr = c.riskReward;
  return (
    <div
      className={`rounded-xl border px-4 py-3 sm:px-5 sm:py-4 ${investmentCallStyle(rr.call)}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
            Investment summary
          </p>
          <p className="mt-1 text-lg font-semibold text-tm-black">
            {rr.callLabel}
          </p>
          <p className="mt-1 text-sm leading-snug text-tm-black/90">
            {rr.oneLiner}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] uppercase tracking-wide opacity-70">
            Structure
          </p>
          <p className="text-2xl font-semibold tabular-nums text-tm-black">
            {Math.round(rr.structureComposite)}
            <span className="text-sm font-normal text-tm-text-muted">/100</span>
          </p>
          <p className="text-xs font-medium text-tm-black">{rr.structureTier}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-tm-border bg-white/70 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-tm-text-muted">
            Capital need
          </p>
          <p className="mt-0.5 text-base font-bold tabular-nums text-tm-accent-dark">
            {formatUSD(rr.capitalNeedUsd)}
          </p>
        </div>
        <div className="rounded-lg border border-tm-danger/30 bg-tm-danger/10 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-tm-text-muted">
            At risk after 1st
          </p>
          <p className="mt-0.5 text-base font-bold tabular-nums text-tm-danger-dark">
            {formatUSD(rr.atRiskAfterFirstUsd)}
          </p>
          <p className="text-[10px] text-tm-text-muted">
            1st covers {rr.buyerFirstCoversCapitalPct.toFixed(0)}%
          </p>
        </div>
        <div className="rounded-lg border border-tm-primary/30 bg-tm-primary/10 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-tm-text-muted">
            Margin
          </p>
          <p
            className={`mt-0.5 text-base font-bold tabular-nums ${
              rr.marginUsd < 0 ? "text-tm-danger-dark" : "text-tm-primary-dark"
            }`}
          >
            {formatUSD(rr.marginUsd)}
          </p>
          <p className="text-[10px] text-tm-danger-dark/80">
            max loss {formatUSD(Math.abs(rr.maxLossOnDefaultUsd))}
          </p>
        </div>
        <div className="rounded-lg border border-tm-primary/30 bg-tm-primary/10 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-tm-text-muted">
            Investor APY
          </p>
          <p className="mt-0.5 text-base font-bold tabular-nums text-tm-primary-dark">
            {rr.investorApyPct.toFixed(1)}%
          </p>
          <p className="text-[10px] text-tm-text-muted">
            ~{formatUSD(rr.expectedInvestorReturnUsd2m)} / 2 mo
          </p>
        </div>
      </div>

      <div
        className={`mt-3 rounded-lg border px-3 py-2.5 ${
          rr.lossCoverAlreadyMet
            ? "border-tm-primary/40 bg-tm-primary/10"
            : "border-tm-accent/50 bg-tm-accent/15"
        }`}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-tm-text-muted">
          De-risk advance (cover residual loss)
        </p>
        <p
          className={`mt-0.5 text-lg font-bold tabular-nums ${
            rr.lossCoverAlreadyMet ? "text-tm-primary-dark" : "text-tm-accent-dark"
          }`}
        >
          {formatUSD(rr.lossCoverAdvanceUsd)}
          <span className="ml-1.5 text-sm font-semibold">
            ({rr.lossCoverAdvancePct}% of deal)
          </span>
        </p>
        <p className="mt-1 text-[12px] leading-snug text-tm-black/85">
          {rr.lossCoverAlreadyMet
            ? "Already covered by recorded advance."
            : `Collect before funding. Shortfall now ${formatUSD(rr.lossCoverAdvanceShortfallUsd)}.`}
        </p>
      </div>

      {rr.bullets.length > 0 ? (
        <ul className="mt-3 list-disc space-y-0.5 pl-4 text-[12px] leading-snug text-tm-black/85">
          {rr.bullets.map((b) => (
            <li key={b.slice(0, 56)}>{b}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DealDetail({ c }: { c: BlueberryCramCase }) {
  const colors = getTierColors(c.tier);
  const decision = getDecisionStyle(c.financing.decision);
  const weightedSum = c.dimensions.reduce((s, d) => s + d.contribution, 0);

  return (
    <div className="space-y-4 rounded-xl border border-tm-border bg-tm-surface p-4 shadow-tm-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-tm-text-muted">
            {c.record.dealRef} · {c.mongoId}
          </p>
          <h2 className="mt-1 font-display text-2xl text-tm-black">
            {c.deal.product}
          </h2>
          <p className="mt-1 text-sm text-tm-text-light">
            <span className="font-medium text-tm-black">{c.deal.buyer.name}</span>
            {" ← "}
            <span className="font-medium text-tm-black">
              {c.deal.supplier.name}
            </span>
          </p>
          <p className="mt-1 text-xs text-tm-text-muted">
            {c.deal.origin} → {c.deal.destination} ·{" "}
            {formatUSD(c.deal.dealValueUSD)} · {c.deal.transportMode ?? "—"} ·{" "}
            {c.deal.paymentTerms}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] uppercase tracking-wide text-tm-text-muted">
            Overall CRAM
          </p>
          <p className="text-4xl font-semibold tabular-nums text-tm-black">
            {c.overall}
          </p>
          <span
            className={`mt-1 inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colors.badge}`}
          >
            {c.tier}
          </span>
        </div>
      </div>

      <StructureInvestmentPanel c={c} />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-tm-border bg-tm-neutral-light/50 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-tm-text-muted">
            Estimated financing APY
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-tm-black">
            {c.estimatedApyPct.toFixed(1)}%
          </p>
          <p className="text-[11px] text-tm-text-muted">
            base {c.financing.baseRate}% + risk {c.financing.riskPremium}%
            {c.financing.uncertaintyPremium > 0 && (
              <> + data-uncertainty {c.financing.uncertaintyPremium}%</>
            )}
          </p>
        </div>
        <div className="rounded-lg border border-tm-border bg-tm-neutral-light/50 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-tm-text-muted">
            Engine financing decision
          </p>
          <p
            className={`mt-1 inline-block rounded-md border px-2 py-0.5 text-sm font-semibold ${decision.className}`}
          >
            {formatDecisionLabel(c.financing.decision)}
          </p>
          <p className="mt-1 text-[11px] text-tm-text-muted">
            max {c.financing.maxFinancingPct}% · advance{" "}
            {c.financing.requiredAdvancePct}% · {c.financing.approvalLevel}
          </p>
        </div>
        <div className="rounded-lg border border-tm-border bg-tm-neutral-light/50 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-tm-text-muted">
            CRAM weighted sum
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-tm-black">
            {weightedSum.toFixed(1)}
          </p>
          <p className="text-[11px] text-tm-text-muted">
            A×0.40 + B×0.25 + C×0.20 + D×0.15 → {c.overall}
          </p>
        </div>
      </div>

      {c.vetoed && (
        <div className="rounded-lg border border-tm-danger/40 bg-tm-danger/10 px-3 py-2 text-xs text-tm-danger-dark">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5" />
            Veto — fix before funding
          </div>
          <ul className="mt-1 list-inside list-disc">
            {c.vetoReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-tm-black">
          Dimension breakdown
        </h3>
        {c.dimensions.map((dim) => (
          <DimensionBlock key={dim.key} dim={dim} />
        ))}
      </div>
    </div>
  );
}

export function BlueberryCramAnalysisTab() {
  const cases = useMemo(() => loadBlueberryCramCases(), []);
  const [activeId, setActiveId] = useState(cases[0]?.mongoId ?? "");
  const active = cases.find((c) => c.mongoId === activeId) ?? cases[0];

  const buyers = new Set(cases.map((c) => c.deal.buyer.name));
  const suppliers = new Set(cases.map((c) => c.deal.supplier.name));
  const scores = cases.map((c) => c.overall);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="font-display text-3xl text-tm-black sm:text-4xl">
          Blueberry CRAM walkthrough
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-tm-text-light">
          {cases.length} Fresh Blueberries deals · customs-matched buyers ·
          field-level CRAM + financing.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full bg-tm-primary/10 px-2.5 py-1 font-medium text-tm-primary-dark">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {buyers.size} buyers · {suppliers.size} suppliers
        </span>
        <span className="rounded-full bg-tm-neutral px-2.5 py-1 text-tm-text-muted">
          Scores {scores.join(" · ")}
        </span>
      </div>

      <div className="rounded-xl border border-tm-accent/40 bg-tm-accent/10 px-4 py-3 text-xs text-tm-accent-dark">
        Most rows veto on missing cargo insurance — scores still shown for
        audit. APY = 6% base + risk + data-uncertainty premium.
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cases.map((c) => (
          <DealCaseCard
            key={c.mongoId}
            c={c}
            selected={active?.mongoId === c.mongoId}
            onSelect={() => setActiveId(c.mongoId)}
          />
        ))}
      </div>

      {active ? <DealDetail c={active} /> : null}
    </div>
  );
}
