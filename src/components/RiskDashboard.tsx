import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import type { Deal, RiskAssessment } from "../types";
import { formatUSDDetailed } from "../lib/assessment";
import { DIMENSION_LABELS } from "../lib/scoring-constants";
import { ScoreGauge } from "./ScoreGauge";
import { SubScoreBar } from "./SubScoreBar";
import { KeyRiskFactors } from "./KeyRiskFactors";
import { getTierColors } from "../lib/risk-colors";

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
          {import.meta.env.DEV && (
            <p className="mt-2 text-center text-[11px] text-tm-text-muted">
              raw {assessment.overallRaw.toFixed(2)} → display {assessment.overall}
            </p>
          )}
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
                headroom={dim.data.headroom}
                breakdown={dim.data.breakdown}
              >
                {dim.key === "counterparty" && (
                  <div className="mt-2 space-y-1 rounded-lg bg-tm-neutral-light px-3 py-2">
                    <SubScoreBar.Party
                      label="Buyer"
                      score={assessment.buyer.score}
                      headroom={assessment.buyer.headroom}
                      breakdown={assessment.buyer.breakdown}
                    />
                    <SubScoreBar.Party
                      label="Supplier"
                      score={assessment.supplier.score}
                      headroom={assessment.supplier.headroom}
                      breakdown={assessment.supplier.breakdown}
                    />
                  </div>
                )}
              </SubScoreBar>
            </motion.div>
          ))}
        </div>
      </div>

      <KeyRiskFactors
        concerns={assessment.concerns}
        mitigating={assessment.mitigating}
      />

      {import.meta.env.DEV && (
        <details className="rounded-lg border border-dashed border-tm-border bg-tm-surface px-4 py-3 text-xs">
          <summary className="cursor-pointer font-medium text-tm-text">
            Dev: full score breakdown
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-[11px] text-tm-text-muted">
            {JSON.stringify(
              {
                overallRaw: assessment.overallRaw,
                overallDisplay: assessment.overall,
                tier: assessment.tier,
                dimensions: {
                  counterparty: assessment.counterparty.breakdown,
                  product: assessment.product.breakdown,
                  route: assessment.route.breakdown,
                  structure: assessment.structure.breakdown,
                },
              },
              null,
              2,
            )}
          </pre>
        </details>
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
