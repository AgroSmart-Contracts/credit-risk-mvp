import { motion } from "framer-motion";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import type { Deal, RiskAssessment } from "../types";
import { formatUSDDetailed } from "../lib/assessment";
import { DIMENSION_LABELS } from "../lib/scoring-constants";
import { ScoreGauge } from "./ScoreGauge";
import { SubScoreBar } from "./SubScoreBar";
import { KeyRiskFactors } from "./KeyRiskFactors";
import { getTierColors } from "../lib/risk-colors";
import {
  KpiStrip,
  CashTimeline,
  LegComparison,
  ScoreBreakdownPanel,
  SensitivityTableView,
} from "./TransactionStructureBuilder";

interface RiskDashboardProps {
  deal: Deal;
  assessment: RiskAssessment;
  onBack: () => void;
  onContinue: () => void;
}

export function RiskDashboard({
  deal,
  assessment,
  onBack,
  onContinue,
}: RiskDashboardProps) {
  const tierColors = getTierColors(assessment.tier);
  const dimensions = [
    { key: "counterparty" as const, data: assessment.counterparty },
    { key: "product" as const, data: assessment.product },
    { key: "route" as const, data: assessment.route },
    { key: "structure" as const, data: assessment.structure },
  ];

  return (
    <div className="space-y-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-tm-text-light transition-colors hover:text-tm-black"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="rounded-xl border border-tm-border bg-tm-surface px-5 py-4 shadow-tm-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-tm-text-muted">
          Deal credit risk assessment
        </p>
        <h2 className="font-display mt-1 text-2xl text-tm-black sm:text-3xl">
          {deal.product} — {deal.variety}
        </h2>
        <p className="mt-1 text-sm text-tm-text-light">
          {deal.origin} → {deal.destination} · {deal.dealRef} ·{" "}
          {formatUSDDetailed(deal.dealValueUSD)}
        </p>
      </div>

      {assessment.vetoed && (
        <div className="flex items-start gap-3 rounded-xl border border-tm-danger-dark bg-tm-danger-dark/10 px-5 py-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-tm-danger-dark" />
          <div>
            <p className="text-sm font-semibold text-tm-danger-dark">
              Veto — spec §6 hard stop, does not auto-proceed regardless of composite score
            </p>
            <ul className="mt-1 list-inside list-disc text-xs text-tm-danger-dark/90">
              {assessment.vetoReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-8 rounded-xl border border-tm-border bg-tm-surface p-6 shadow-tm-sm lg:flex-row lg:items-start">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center lg:w-56"
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-tm-text-muted">
            Overall risk score
          </p>
          <ScoreGauge score={assessment.overall} tier={assessment.tier} />
          <span
            className={`mt-4 inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${tierColors.badge}`}
          >
            {assessment.tier}
          </span>
        </motion.div>

        <div className="flex-1 space-y-6">
          <p className="text-xs text-tm-text-muted">
            Four independent dimensions aggregated by weighted methodology —
            counterparty risk is the primary default driver.
          </p>

          {dimensions.map((dim, index) => (
            <motion.div
              key={dim.key}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + index * 0.1 }}
            >
              <SubScoreBar
                label={DIMENSION_LABELS[dim.key].title}
                score={dim.data.score}
                why={dim.data.why}
                weight={dim.data.weight}
              >
                {dim.key === "counterparty" && (
                  <div className="mt-2 space-y-1 rounded-lg bg-tm-neutral-light px-3 py-2">
                    <SubScoreBar.Party
                      label="Buyer"
                      score={assessment.buyer.score}
                    />
                    <SubScoreBar.Party
                      label="Supplier"
                      score={assessment.supplier.score}
                    />
                  </div>
                )}
              </SubScoreBar>
            </motion.div>
          ))}
        </div>
      </div>

      {assessment.structureReport && (
        <div className="space-y-6 rounded-xl border border-tm-border bg-tm-surface p-6 shadow-tm-sm">
          <div>
            <h3 className="font-display text-xl text-tm-black">Transaction structure analysis</h3>
            <p className="mt-1 text-xs text-tm-text-light">
              Cash-flow, capital-need, and sensitivity results driving the Deal Structure score above —
              deal-sensitivity-playbook.md Module 4.
            </p>
          </div>
          <KpiStrip report={assessment.structureReport} />
          <div className="grid gap-6 lg:grid-cols-2">
            <CashTimeline report={assessment.structureReport} />
            <ScoreBreakdownPanel report={assessment.structureReport} />
          </div>
          {assessment.structureReport.legResults.length > 0 && (
            <LegComparison report={assessment.structureReport} />
          )}
          {assessment.structureReport.sensitivity.length > 0 && (
            <div className="space-y-6">
              <SensitivityTableView table={assessment.structureReport.sensitivity[0]} />
            </div>
          )}
        </div>
      )}

      <KeyRiskFactors
        concerns={assessment.concerns}
        mitigating={assessment.mitigating}
      />

      {deal.fieldsNeedingConfirmation.length > 0 && (
        <div className="rounded-xl border border-dashed border-tm-border bg-tm-surface p-5 shadow-tm-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-tm-text-muted">
            Unfilled fields for this deal
          </p>
          <p className="mt-1 text-sm text-tm-text-light">
            Still missing from platform enrichment — scoring used assumed
            defaults where noted (license valid, 0 payment delay, 0% quality
            rejection).
          </p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {deal.fieldsNeedingConfirmation.map((field) => (
              <li
                key={field}
                className="rounded-md bg-tm-neutral px-2 py-1 text-xs text-tm-text"
              >
                {field}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          className="rounded-lg bg-tm-primary px-6 py-3 font-semibold text-white shadow-tm-md transition-colors hover:bg-tm-primary-dark"
        >
          View financing recommendation
        </button>
      </div>
    </div>
  );
}
