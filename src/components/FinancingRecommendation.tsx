import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  RotateCcw,
  XCircle,
} from "lucide-react";
import type { Deal, FinancingRecommendation, RiskAssessment } from "../types";
import type { TransactionStructureInput } from "../lib/transaction-structure/types";
import { formatUSD } from "../lib/assessment";
import {
  formatDecisionLabel,
  getDecisionStyle,
  getTierColors,
} from "../lib/risk-colors";
import { TransactionStructureAnalysis } from "./TransactionStructureAnalysis";

interface FinancingRecommendationPanelProps {
  deal: Deal;
  assessment: RiskAssessment;
  financing: FinancingRecommendation;
  onBack: () => void;
  onAssessAnother: () => void;
  onApplyStructure?: (structure: TransactionStructureInput) => void;
}

const decisionIcons = {
  check: CheckCircle2,
  eye: Eye,
  alert: AlertTriangle,
  x: XCircle,
};

export function FinancingRecommendationPanel({
  deal,
  assessment,
  financing,
  onBack,
  onAssessAnother,
  onApplyStructure,
}: FinancingRecommendationPanelProps) {
  const decisionStyle = getDecisionStyle(financing.decision);
  const DecisionIcon = decisionIcons[decisionStyle.icon];
  const tierColors = getTierColors(assessment.tier);

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-tm-text-light transition-colors hover:text-tm-black"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div>
        <h2 className="font-display text-2xl text-tm-black sm:text-3xl">
          Financing recommendation
        </h2>
        <p className="mt-1 text-tm-text-light">
          Risk-based pricing and approval routing per TruMarket credit policy
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-tm-border bg-tm-surface p-6 shadow-tm-md"
      >
        <div
          className={`mb-6 inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 font-semibold ${decisionStyle.className}`}
        >
          <DecisionIcon className="h-5 w-5" />
          {formatDecisionLabel(financing.decision)}
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <MetricTile
            label="Max financing"
            amount={formatUSD(financing.maxFinancingAmount)}
            caption={`${financing.maxFinancingPct}% of deal value`}
          />
          <MetricTile
            label="Required advance"
            amount={formatUSD(financing.requiredAdvanceAmount)}
            caption={`${financing.requiredAdvancePct}% of deal value`}
          />
        </div>

        <dl className="space-y-3 border-t border-tm-border pt-5">
          <DetailRow
            label="Interest rate"
            value={
              financing.uncertaintyPremium > 0
                ? `${financing.baseRate.toFixed(1)}% + ${financing.riskPremium.toFixed(1)}% risk + ${financing.uncertaintyPremium.toFixed(1)}% data-uncertainty = ${financing.interestRate.toFixed(1)}%`
                : `${financing.baseRate.toFixed(1)}% + ${financing.riskPremium.toFixed(1)}% = ${financing.interestRate.toFixed(1)}%`
            }
          />
          <DetailRow
            label="Collateral requirement"
            value={financing.collateralRequired}
          />
          <DetailRow
            label="Approval routing"
            value={financing.approvalLevel}
          />
          <DetailRow label="Deal reference" value={deal.dealRef} />
          <DetailRow
            label="Risk tier"
            value={
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${tierColors.badge}`}
              >
                {assessment.tier}
              </span>
            }
          />
        </dl>
      </motion.div>

      <TransactionStructureAnalysis
        deal={deal}
        assessment={assessment}
        onApplyStructure={onApplyStructure}
      />

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="button"
          onClick={onAssessAnother}
          className="inline-flex items-center gap-2 rounded-lg bg-tm-primary px-6 py-3 font-semibold text-white shadow-tm-md transition-colors hover:bg-tm-primary-dark"
        >
          <RotateCcw className="h-4 w-4" />
          Assess another deal
        </button>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  amount,
  caption,
}: {
  label: string;
  amount: string;
  caption: string;
}) {
  return (
    <div className="rounded-lg border border-tm-border bg-tm-neutral-light p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-tm-text-muted">
        {label}
      </p>
      <p className="font-display mt-1 text-3xl text-tm-black">{amount}</p>
      <p className="mt-1 text-sm text-tm-text-light">{caption}</p>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-sm text-tm-text-light">{label}</dt>
      <dd className="text-sm font-medium text-tm-black">{value}</dd>
    </div>
  );
}
