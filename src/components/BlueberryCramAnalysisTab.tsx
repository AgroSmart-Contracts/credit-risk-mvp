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
            Why this calculation
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-tm-text-light">
            {audit.why.map((line) => (
              <li key={line.slice(0, 48)}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-tm-text-muted">
            Ways to improve
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-tm-text-light">
            {audit.improvements.map((line) => (
              <li key={line.slice(0, 48)}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
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
                {dim.fields.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-tm-border/60 align-top last:border-0"
                  >
                    <td className="py-1.5 pr-2 font-medium text-tm-black">
                      {f.label}
                    </td>
                    <td className="py-1.5 pr-2 text-tm-text-light">{f.input}</td>
                    <td className="py-1.5 pr-2 tabular-nums text-tm-black">
                      {f.score == null ? (
                        <span className="text-tm-text-muted">—</span>
                      ) : (
                        Math.round(f.score)
                      )}
                      {f.weight > 0 ? (
                        <span className="ml-1 text-[10px] text-tm-text-muted">
                          · w{f.weight}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1.5 text-tm-text-muted">{f.note}</td>
                  </tr>
                ))}
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
            {c.financing.counterpartyCoveragePct != null && (
              <> ({c.financing.counterpartyCoveragePct}% counterparty coverage)</>
            )}
          </p>
        </div>
        <div className="rounded-lg border border-tm-border bg-tm-neutral-light/50 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-tm-text-muted">
            Financing decision
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
            Weighted sum check
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-tm-black">
            {weightedSum.toFixed(1)}
          </p>
          <p className="text-[11px] text-tm-text-muted">
            A×0.40 + B×0.25 + C×0.20 + D×0.15 → round → {c.overall}
          </p>
        </div>
      </div>

      {c.vetoed && (
        <div className="rounded-lg border border-tm-danger/40 bg-tm-danger/10 px-3 py-2 text-xs text-tm-danger-dark">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5" />
            Veto register fired — overall still computed for analysis
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
          Five Fresh Blueberries deals with distinct customs-matched buyers,
          scored end-to-end so you can inspect every field that feeds A–D and
          the estimated financing APY. (Platform blueberry lanes with matched
          buyers only use two suppliers — TM and Holy Fruit — so TM appears on
          more than one deal.)
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full bg-tm-primary/10 px-2.5 py-1 font-medium text-tm-primary-dark">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {buyers.size} unique buyers · all customs-matched ·{" "}
          {suppliers.size} suppliers
        </span>
        <span className="rounded-full bg-tm-neutral px-2.5 py-1 text-tm-text-muted">
          Overalls {scores.join(" · ")}
        </span>
        <span className="rounded-full bg-tm-neutral px-2.5 py-1 text-tm-text-muted">
          APYs {cases.map((c) => `${c.estimatedApyPct}%`).join(" · ")}
        </span>
      </div>

      <div className="rounded-xl border border-tm-accent/40 bg-tm-accent/10 px-4 py-3 text-xs text-tm-accent-dark">
        Most platform blueberry rows still veto on missing cargo insurance;
        the numeric overall and APY are shown anyway so the engine math is
        auditable. APY = financing engine{" "}
        <code className="rounded bg-white/50 px-1">interestRate</code> (6% base
        + risk premium from overall + data-uncertainty premium from
        counterparty coverage, 2026-08-06).
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
