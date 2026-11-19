import { CheckCircle2, AlertTriangle } from "lucide-react";
import { MARKET_THRESHOLDS as MT } from "../../lib/pre-harvest/config";
import {
  breakevenPrice,
  expectedLoss,
  keyRisksAndMitigants,
  sbsProvision,
  stressMatrix,
} from "../../lib/pre-harvest/credit-metrics";
import { marketAt } from "../../lib/pre-harvest/monitoring";
import type { CampaignSimulation } from "../../lib/pre-harvest/timeline";
import { formatRate, formatUsd, t, tb } from "../../lib/pre-harvest/i18n";
import type { Lang, PreHarvestAssessment, PreHarvestDeal, TimelineFrame } from "../../lib/pre-harvest/types";
import { FieldMap } from "./FieldMap";
import { Card, SectionTitle } from "./ui";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-tm-border py-1.5 last:border-0">
      <dt className="text-tm-text-light">{label}</dt>
      <dd className="text-right font-medium text-tm-black">{value}</dd>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-tm-neutral-light px-3 py-2.5">
      <p className="text-xs text-tm-text-muted">{label}</p>
      <p className="mt-0.5 font-display text-lg text-tm-black">{value}</p>
      {sub && <p className="text-[11px] text-tm-text-light">{sub}</p>}
    </div>
  );
}

/** Price the harvest is expected to fetch (reference adjusted since approval); falls back to the latest FOB. */
function currentPrice(sim: CampaignSimulation, frame: TimelineFrame): number | null {
  if (frame.expectedHarvestPrice !== null) return frame.expectedHarvestPrice;
  const date = frame.date;
  return marketAt(sim.series.market, date)?.usdPerKg ?? null;
}

// ---------------------------------------------------------------------------

export function SummaryPanel({
  deal,
  sim,
  frame,
  current,
  yieldAdj,
  lang,
}: {
  deal: PreHarvestDeal;
  sim: CampaignSimulation;
  frame: TimelineFrame;
  current: PreHarvestAssessment;
  yieldAdj: number;
  lang: Lang;
}) {
  const { risks, mitigants } = keyRisksAndMitigants(current);
  const el = expectedLoss(deal, current.tier);
  const prov = sbsProvision(deal);
  // The loan rate is contractual: fixed at origination, not re-priced by monitoring.
  const be = breakevenPrice(deal, sim.origination.pricingPct, yieldAdj);
  const price = currentPrice(sim, frame);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <SectionTitle title={t("facility", lang)} hint={t("analystConfirm", lang)} />
          <dl className="text-sm">
            <Fact label={t("facility", lang)} value={t("facilityType", lang)} />
            <Fact label={t("amount", lang)} value={`${formatUsd(deal.envelopeUsd, lang)} · ${deal.tenorDays} ${t("days", lang)}`} />
            <Fact label={t("rate", lang)} value={sim.origination.pricingPct === null ? t("manualPricing", lang) : formatRate(sim.origination.pricingPct, lang)} />
            <Fact label={t("ltv", lang)} value={`${current.ltvPct.toFixed(0)}%`} />
            <Fact label={t("repaymentSource", lang)} value={t("repaymentSourceText", lang)} />
          </dl>
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle title={t("field", lang)} hint={t("fieldHint", lang)} />
          <div className="relative z-0">
            <FieldMap lat={deal.lat} lon={deal.lon} areaHa={deal.formato.areaHa} ring={deal.parcel} severity={frame.panels.crop.severity} />
          </div>
          <p className="mt-2 text-xs text-tm-text-light">
            {tb(deal.location, lang)} · {t("coordinates", lang)} {deal.lat.toFixed(4)}, {deal.lon.toFixed(4)}
          </p>
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <SectionTitle title={t("keyRisks", lang)} />
          <ul className="space-y-2">
            {risks.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-tm-accent-dark" />
                <span>
                  <span className="font-medium text-tm-black">{tb(r.label, lang).replace(/^(Monitoring|Monitoreo): /, "")}</span>
                  <span className="text-tm-text-light"> · {tb(r.value, lang)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <SectionTitle title={t("mitigants", lang)} />
          <ul className="space-y-2">
            {mitigants.map((m, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-tm-primary" />
                <span>
                  <span className="font-medium text-tm-black">{tb(m.label, lang)}</span>
                  <span className="text-tm-text-light"> · {tb(m.value, lang)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={t("sbsRating", lang)} value={deal.checks.credit.rating} sub={deal.checks.credit.bureau} />
        <Metric label={t("provision", lang)} value={formatUsd(prov.amountUsd, lang)} sub={`${prov.ratePct}% · Res. SBS 11356-2008`} />
        <Metric
          label={`${t("expectedLoss", lang)} (${t("indicative", lang)})`}
          value={formatUsd(el.elUsd, lang)}
          sub={`${t("pd", lang)} ${el.pdPct.toFixed(1)}% · ${t("lgd", lang)} ${el.lgdPct.toFixed(0)}%`}
        />
        <Metric
          label={t("breakeven", lang)}
          value={`$${be.toFixed(2)}/kg`}
          sub={price ? `${t("headroom", lang)}: ${(((price - be) / price) * 100).toFixed(0)}%` : undefined}
        />
      </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function StressPanel({
  deal,
  sim,
  frame,
  yieldAdj,
  lang,
}: {
  deal: PreHarvestDeal;
  sim: CampaignSimulation;
  frame: TimelineFrame;
  /** Accepted for prop-spread symmetry with SummaryPanel; the stress test uses the contract rate. */
  current?: PreHarvestAssessment;
  yieldAdj: number;
  lang: Lang;
}) {
  const price = currentPrice(sim, frame);
  if (!price) return null;
  const be = breakevenPrice(deal, sim.origination.pricingPct, yieldAdj);
  const grid = stressMatrix(deal, sim.origination.pricingPct, price, yieldAdj);
  const cellClass = (c: number) =>
    c < MT.coverageRed
      ? "bg-tm-danger/15 text-tm-danger-dark"
      : c < MT.coverageYellow
        ? "bg-tm-accent/15 text-tm-accent-dark"
        : "bg-tm-primary/10 text-tm-primary-dark";

  return (
    <Card>
      <SectionTitle title={t("stressTest", lang)} hint={t("stressHint", lang)} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="-mx-5 overflow-x-auto px-5 lg:col-span-2">
          <table className="w-full min-w-[420px] text-center text-sm">
            <thead>
              <tr className="text-xs text-tm-text-muted">
                <th className="py-1.5 text-left font-medium">
                  {t("yieldShock", lang)} \ {t("priceShock", lang)}
                </th>
                {grid[0].cells.map((c) => (
                  <th key={c.priceShockPct} className="py-1.5 font-medium">
                    {c.priceShockPct === 0 ? `$${price.toFixed(2)}` : `${c.priceShockPct}%`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((row) => (
                <tr key={row.yieldShockPct}>
                  <td className="py-1 text-left text-xs text-tm-text-light">
                    {row.yieldShockPct === 0 ? `${(deal.formato.declaredYieldTPerHa * yieldAdj).toFixed(1)} t/ha` : `${row.yieldShockPct}%`}
                  </td>
                  {row.cells.map((c) => (
                    <td key={c.priceShockPct} className="p-1">
                      <span className={`block rounded-md py-1.5 font-semibold ${cellClass(c.coverage)}`}>{c.coverage.toFixed(2)}×</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-3">
          <Metric
            label={t("breakeven", lang)}
            value={`$${be.toFixed(2)}/kg FOB`}
            sub={t("breakevenHint", lang)}
          />
          <Metric label={t("headroom", lang)} value={`${(((price - be) / price) * 100).toFixed(0)}%`} sub={`FOB $${price.toFixed(2)}/kg`} />
        </div>
      </div>
    </Card>
  );
}
