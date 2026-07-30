import { useEffect, useMemo, useState } from "react";
import type { Deal, RiskAssessment } from "../types";
import type { TransactionStructureInput } from "../lib/transaction-structure/types";
import {
  applyStructureWhatIf,
  buildTransactionStructureReport,
  defaultStructureFromDeal,
  structureForDeal,
} from "../lib/transaction-structure/compute";
import {
  KpiStrip,
  CashTimeline,
  LegComparison,
  ScoreBreakdownPanel,
  SensitivityTableView,
} from "./TransactionStructureBuilder";

interface TransactionStructureAnalysisProps {
  deal: Deal;
  assessment: RiskAssessment;
  /** Commit sandbox structure onto the deal and re-score Dimension D / overall / financing. */
  onApplyStructure?: (structure: TransactionStructureInput) => void;
}

function WhatIfSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs font-medium text-tm-text">
        <span>{label}</span>
        <span className="font-semibold text-tm-black">{format(value)}</span>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-tm-primary"
      />
    </label>
  );
}

function initialWhatIf(base: TransactionStructureInput) {
  const sourcing = base.legs.find((l) => l.legType === "sourcing");
  return {
    salePricePerKg: base.salePricePerKg ?? 0,
    collectionPct: 100,
    costShiftPerKg: 0,
    discardPct: sourcing ? Math.round(sourcing.discardPct * 100) : 0,
  };
}

/** Live what-if sandbox for transaction structure — KPIs, cash timeline, Dimension D, sensitivity. */
export function TransactionStructureAnalysis({
  deal,
  assessment,
  onApplyStructure,
}: TransactionStructureAnalysisProps) {
  const [sandboxBase, setSandboxBase] = useState(() => structureForDeal(deal));
  const [whatIf, setWhatIf] = useState(() => initialWhatIf(structureForDeal(deal)));

  useEffect(() => {
    const next = structureForDeal(deal);
    setSandboxBase(next);
    setWhatIf(initialWhatIf(next));
  }, [deal]);

  const hasSourcingLeg = sandboxBase.legs.some((l) => l.legType === "sourcing");

  const liveInput = useMemo(
    () =>
      applyStructureWhatIf(sandboxBase, {
        salePricePerKg: whatIf.salePricePerKg,
        costShiftPerKg: whatIf.costShiftPerKg,
        discardPct: hasSourcingLeg ? whatIf.discardPct : undefined,
      }),
    [sandboxBase, whatIf.salePricePerKg, whatIf.costShiftPerKg, whatIf.discardPct, hasSourcingLeg],
  );

  const liveReport = useMemo(
    () =>
      buildTransactionStructureReport(
        liveInput,
        deal.dealValueUSD,
        deal.advancePaymentPct,
        deal.contractType,
      ),
    [liveInput, deal.dealValueUSD, deal.advancePaymentPct, deal.contractType],
  );

  const displayReport = useMemo(() => {
    if (whatIf.collectionPct === 100) return liveReport;
    const cashCollected =
      liveReport.score.cashFlow.buyerFirstAmount +
      liveReport.score.cashFlow.buyerFinalAmount * (whatIf.collectionPct / 100);
    const margin = cashCollected - liveReport.resolved.purchaseTotal;
    return {
      ...liveReport,
      kpis: { ...liveReport.kpis, cashCollected, margin },
    };
  }, [liveReport, whatIf.collectionPct]);

  const structureApplied = Boolean(assessment.structureReport);
  const isDefaultSeed = sandboxBase.structureSource === "default";

  const handleReset = () => {
    const defaults = defaultStructureFromDeal(deal);
    setSandboxBase(defaults);
    setWhatIf(initialWhatIf(defaults));
  };

  const handleApply = () => {
    if (!onApplyStructure) return;
    onApplyStructure({ ...liveInput, structureSource: "user" });
  };

  const baseSalePrice = sandboxBase.salePricePerKg ?? 5;
  const priceStep = Math.max(0.05, Math.round(baseSalePrice * 0.02 * 100) / 100);
  const priceMin = Math.max(0.1, Number((baseSalePrice * 0.5).toFixed(2)));
  const priceMax = Math.max(priceMin + 1, Number((baseSalePrice * 1.5).toFixed(2)));

  return (
    <div className="space-y-6 rounded-xl border border-tm-border bg-tm-surface p-6 shadow-tm-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-display text-xl text-tm-black">Transaction structure analysis</h3>
          <p className="mt-1 text-xs text-tm-text-light">
            Live what-if sandbox — exploring does not change Dimension D or financing until you Apply
            to score.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-tm-border px-3 py-1.5 text-xs font-medium text-tm-text transition-colors hover:border-tm-primary hover:text-tm-primary"
          >
            Reset to defaults
          </button>
          {onApplyStructure && (
            <button
              type="button"
              onClick={handleApply}
              className="rounded-lg bg-tm-primary px-3 py-1.5 text-xs font-semibold text-white shadow-tm-sm transition-colors hover:bg-tm-primary-dark"
            >
              Apply to score
            </button>
          )}
        </div>
      </div>

      {isDefaultSeed && (
        <div className="rounded-lg border border-tm-accent/40 bg-tm-accent/10 px-3 py-2 text-xs text-tm-accent-dark">
          Structure from exploration defaults — not verified deal economics
          {!structureApplied &&
            " · overall Deal Structure score still uses category estimate until Apply"}
          {structureApplied &&
            deal.transactionStructure?.structureSource === "default" &&
            " · scored from these defaults (Run assessment)"}
        </div>
      )}

      <div className="grid gap-4 rounded-lg border border-tm-border bg-tm-neutral-light/60 p-4 sm:grid-cols-2">
        <WhatIfSlider
          label="Sale price ($/kg)"
          value={Math.min(priceMax, Math.max(priceMin, whatIf.salePricePerKg))}
          onChange={(v) => setWhatIf((w) => ({ ...w, salePricePerKg: v }))}
          min={priceMin}
          max={priceMax}
          step={priceStep}
          format={(v) => `$${v.toFixed(2)}`}
        />
        <WhatIfSlider
          label="Final-collection %"
          value={whatIf.collectionPct}
          onChange={(v) => setWhatIf((w) => ({ ...w, collectionPct: v }))}
          min={0}
          max={100}
          step={5}
          format={(v) => `${v}%`}
        />
        <WhatIfSlider
          label="Cost shift ($/kg)"
          value={whatIf.costShiftPerKg}
          onChange={(v) => setWhatIf((w) => ({ ...w, costShiftPerKg: v }))}
          min={-1}
          max={1}
          step={0.05}
          format={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`}
        />
        {hasSourcingLeg && (
          <WhatIfSlider
            label="Discard % (sourcing)"
            value={whatIf.discardPct}
            onChange={(v) => setWhatIf((w) => ({ ...w, discardPct: v }))}
            min={0}
            max={40}
            step={1}
            format={(v) => `${v}%`}
          />
        )}
      </div>

      <KpiStrip report={displayReport} />
      <div className="grid gap-6 lg:grid-cols-2">
        <CashTimeline report={liveReport} />
        <div className="space-y-2">
          <ScoreBreakdownPanel report={liveReport} />
          <p className="text-[11px] text-tm-text-muted">
            Sandbox Dimension D {liveReport.score.composite}/100 ({liveReport.score.tier})
            {structureApplied
              ? ` · scored Dimension D ${assessment.structure.score}/100`
              : " · not yet applied to overall score"}
            {whatIf.collectionPct < 100 &&
              " · collection % stresses cash collected / margin only (preview)"}
          </p>
        </div>
      </div>
      {displayReport.legResults.length > 0 && <LegComparison report={displayReport} />}
      {liveReport.sensitivity.length > 0 && (
        <div className="space-y-6">
          {liveReport.sensitivity.slice(0, 2).map((table, i) => (
            <SensitivityTableView key={i} table={table} />
          ))}
        </div>
      )}
    </div>
  );
}
