import { useMemo } from "react";
import { Download, ShieldAlert } from "lucide-react";
import { platformDeals } from "../data/platform-deals";
import { platformDealToDeal } from "../lib/platform-deal-mapper";
import { buildRiskAssessment, formatUSD } from "../lib/assessment";
import { getTierColors } from "../lib/risk-colors";
import { useDataCorrections, downloadInsuranceCorrectionsCsv } from "../lib/data-corrections";
import type { Deal } from "../types";

const INSURANCE_OPTIONS: Deal["insuranceCoverage"][] = ["None", "Basic", "Comprehensive", "All Risk"];

interface CargoInsuranceSectionProps {
  query: string;
}

/**
 * Every platform deal defaults insuranceCoverage to "None" (no source in any
 * CSV) — and since the veto register went live, "None" is a mandatory spec
 * §6 hard stop, so every real deal is currently forced to the "Veto" tier
 * regardless of its actual score (confirmed via `npm run validate`). This is
 * the single highest-impact gap in the whole pipeline — surfaced as its own
 * section, not folded into the generic "missing fields" list below, so it
 * isn't easy to miss — decision 2026-07-27.
 */
export function CargoInsuranceSection({ query }: CargoInsuranceSectionProps) {
  const { corrections, setInsuranceCoverage } = useDataCorrections();

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return platformDeals
      .map((record) => ({ record, deal: platformDealToDeal(record) }))
      .filter(({ deal, record }) => {
        if (!q) return true;
        return (
          deal.dealRef.toLowerCase().includes(q) ||
          deal.buyer.name.toLowerCase().includes(q) ||
          deal.supplier.name.toLowerCase().includes(q) ||
          record.mongoId.toLowerCase().includes(q)
        );
      });
  }, [query]);

  const previews = useMemo(
    () =>
      rows.map(({ record, deal }) => {
        const override = corrections.insuranceCoverageByDeal[record.mongoId];
        const effectiveDeal: Deal = override ? { ...deal, insuranceCoverage: override } : deal;
        return { record, deal, preview: buildRiskAssessment(effectiveDeal), override };
      }),
    [rows, corrections],
  );

  const vetoedCount = previews.filter((p) => p.preview.vetoed).length;
  const correctionCount = Object.keys(corrections.insuranceCoverageByDeal).length;

  return (
    <section className="rounded-xl border border-tm-danger/30 bg-tm-surface shadow-tm-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tm-danger/10 text-tm-danger">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-tm-black">
              Cargo insurance — {vetoedCount} of {rows.length} deals currently vetoed
            </h2>
            <p className="mt-1 text-xs text-tm-text-light">
              No platform deal has a real cargo-insurance value on file — every one defaults to
              "None", which is a mandatory spec §6 veto (hard stop, overriding the composite score
              regardless of what it computes to). Set a real coverage level per deal to preview the
              corrected outcome — computed live in your browser, same formula used everywhere else.
            </p>
          </div>
        </div>
        {correctionCount > 0 && (
          <button
            type="button"
            onClick={() =>
              downloadInsuranceCorrectionsCsv(
                corrections,
                new Map(platformDeals.map((r) => [r.mongoId, r.dealRef])),
              )
            }
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-tm-primary bg-tm-primary/10 px-3 py-1.5 text-xs font-medium text-tm-primary-dark hover:bg-tm-primary/20"
          >
            <Download className="h-3.5 w-3.5" />
            Download {correctionCount} correction{correctionCount === 1 ? "" : "s"} (CSV)
          </button>
        )}
      </div>

      <div className="max-h-[28rem] overflow-y-auto overflow-x-auto border-t border-tm-border">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-tm-surface">
            <tr className="text-[10px] uppercase tracking-wide text-tm-text-muted">
              <th className="px-4 py-2 sm:px-5">Deal ref</th>
              <th className="px-2 py-2">Buyer ← Supplier</th>
              <th className="px-2 py-2 text-right">Value</th>
              <th className="px-2 py-2">Coverage</th>
              <th className="px-4 py-2 sm:px-5">Preview</th>
            </tr>
          </thead>
          <tbody>
            {previews.map(({ record, deal, preview, override }) => {
              const tierColors = getTierColors(preview.tier);
              return (
                <tr key={record.id} className="border-t border-tm-border/60">
                  <td className="px-4 py-2 font-medium text-tm-text sm:px-5">{deal.dealRef}</td>
                  <td className="px-2 py-2 text-tm-text-light">
                    {deal.buyer.name} ← {deal.supplier.name}
                  </td>
                  <td className="px-2 py-2 text-right text-tm-text-light">{formatUSD(deal.dealValueUSD)}</td>
                  <td className="px-2 py-2">
                    <select
                      value={override ?? "None"}
                      onChange={(e) => {
                        const value = e.target.value as Deal["insuranceCoverage"];
                        setInsuranceCoverage(record.mongoId, value === "None" ? null : value);
                      }}
                      className="rounded-lg border border-tm-border bg-tm-surface px-2 py-1 text-xs outline-none focus:border-tm-primary"
                    >
                      {INSURANCE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 sm:px-5">
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tierColors.badge}`}
                    >
                      {preview.vetoed ? "Veto" : `${Math.round(preview.overall)} · ${preview.tier.replace(" Risk", "")}`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-tm-border p-3 text-[10px] text-tm-text-muted">
        Preview only — not saved. Download the correction CSV above and merge it into the source
        data (a new `insuranceCoverage` column, or a per-deal override table per the target ERD's
        Transaction Structure entity), then re-run{" "}
        <code className="text-[10px]">npx tsx scripts/build-platform-deals.ts</code> to make it permanent.
      </p>
    </section>
  );
}
