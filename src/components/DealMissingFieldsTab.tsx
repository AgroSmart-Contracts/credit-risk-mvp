import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  Download,
  Search,
} from "lucide-react";
import { prescoredPlatformDeals } from "../data/prescored-deals";
import { platformDealsBlocked, platformDealsSynthetic } from "../data/platform-deals";
import { platformDealToDeal } from "../lib/platform-deal-mapper";
import { buildRiskAssessment, formatUSD } from "../lib/assessment";
import { getTierColors } from "../lib/risk-colors";

interface DealMissingFieldsTabProps {
  onViewDeal?: (dealId: string) => void;
}

export function DealMissingFieldsTab({
  onViewDeal,
}: DealMissingFieldsTabProps) {
  const [query, setQuery] = useState("");
  /** Admin-entered years-in-business, keyed by company name — shared across every
   * deal row for that company (YIB is per-company, not per-deal). Session-only:
   * nothing here persists past a page refresh — see the CSV download below to
   * carry it into company-master.csv for real. */
  const [yibEdits, setYibEdits] = useState<Map<string, string>>(new Map());

  const setYibEdit = (companyName: string, value: string) => {
    setYibEdits((prev) => {
      const next = new Map(prev);
      if (value.trim() === "") next.delete(companyName);
      else next.set(companyName, value);
      return next;
    });
  };

  const downloadYibCorrections = () => {
    const header = "name,yearsInBusiness\n";
    const body = [...yibEdits.entries()]
      .filter(([, v]) => v.trim() !== "" && Number.isFinite(Number(v)))
      .map(([name, v]) => `"${name.replace(/"/g, '""')}",${Number(v)}`)
      .join("\n");
    const blob = new Blob([header + body + "\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "yib-corrections.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prescoredPlatformDeals
      .filter((entry) => entry.deal.fieldsNeedingConfirmation.length > 0)
      .filter((entry) => {
        if (!q) return true;
        const { deal } = entry;
        return (
          deal.dealRef.toLowerCase().includes(q) ||
          deal.product.toLowerCase().includes(q) ||
          deal.buyer.name.toLowerCase().includes(q) ||
          deal.supplier.name.toLowerCase().includes(q) ||
          deal.fieldsNeedingConfirmation.some((f) =>
            f.toLowerCase().includes(q),
          )
        );
      })
      .sort(
        (a, b) =>
          b.deal.fieldsNeedingConfirmation.length -
          a.deal.fieldsNeedingConfirmation.length,
      );
  }, [query]);

  const fieldFreq = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of prescoredPlatformDeals) {
      for (const field of entry.deal.fieldsNeedingConfirmation) {
        map.set(field, (map.get(field) ?? 0) + 1);
      }
    }
    return [...map.entries()]
      .map(([field, count]) => ({ field, count }))
      .sort((a, b) => b.count - a.count);
  }, []);

  const dealsWithGaps = prescoredPlatformDeals.filter(
    (e) => e.deal.fieldsNeedingConfirmation.length > 0,
  ).length;

  const blockedRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return platformDealsBlocked
      .map((record) => ({ record, deal: platformDealToDeal(record) }))
      .filter(({ record, deal }) => {
        if (!q) return true;
        return (
          deal.dealRef.toLowerCase().includes(q) ||
          deal.product.toLowerCase().includes(q) ||
          deal.buyer.name.toLowerCase().includes(q) ||
          deal.supplier.name.toLowerCase().includes(q) ||
          record.mongoId.toLowerCase().includes(q)
        );
      });
  }, [query]);

  const totalRows =
    prescoredPlatformDeals.length + platformDealsBlocked.length + platformDealsSynthetic.length;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="font-display text-3xl text-tm-black sm:text-4xl">
          Missing fields by deal
        </h1>
        <p className="mt-2 text-tm-text-light">
          {dealsWithGaps} of {prescoredPlatformDeals.length} pre-scored platform
          deals still have enrichment gaps. Scores already assume license valid,
          0 payment delay days, and 0% quality rejection.{" "}
          {platformDealsBlocked.length > 0 && (
            <>
              {platformDealsBlocked.length} more real deals are blocked from
              scoring entirely — missing buyer and/or supplier years-in-business
              — see below.
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-tm-text-muted">
          All {totalRows} rows from the source CSV accounted for: {prescoredPlatformDeals.length}{" "}
          scoreable + {platformDealsBlocked.length} blocked + {platformDealsSynthetic.length}{" "}
          flagged <code className="text-[10px]">likely_test</code> (synthetic seed data, excluded
          from all scoring — see the Test data tab).
        </p>
      </div>

      {fieldFreq.length > 0 && (
        <section className="rounded-xl border border-tm-border bg-tm-surface p-5 shadow-tm-sm">
          <h2 className="text-sm font-semibold text-tm-black">
            Field frequency across pre-scored deals
          </h2>
          <ul className="mt-3 space-y-2">
            {fieldFreq.map((row) => (
              <li key={row.field} className="flex items-center gap-3 text-sm">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-tm-neutral">
                  <div
                    className="h-full rounded-full bg-tm-danger/70"
                    style={{
                      width: `${Math.min(
                        100,
                        (row.count / prescoredPlatformDeals.length) * 100,
                      )}%`,
                    }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-xs font-semibold text-tm-text">
                  {row.count}
                </span>
                <span className="w-[55%] shrink-0 truncate text-xs text-tm-text-light">
                  {row.field}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tm-text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search deal, party, or field…"
          className="w-full rounded-lg border border-tm-border bg-tm-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-tm-primary"
        />
      </div>

      <div className="space-y-3">
        {rows.map(({ deal, assessment }) => (
          <article
            key={deal.id}
            className="rounded-xl border border-tm-border bg-tm-surface p-4 shadow-tm-sm sm:p-5"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tm-danger/10 text-tm-danger">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <h3 className="font-semibold text-tm-black">
                    {deal.dealRef}
                  </h3>
                  <span className="rounded-full bg-tm-primary/10 px-2 py-0.5 text-[10px] font-semibold text-tm-primary">
                    Score {Math.round(assessment.overall)}
                  </span>
                  <span className="text-xs text-tm-text-muted">
                    {formatUSD(deal.dealValueUSD)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-tm-text-light">
                  {deal.buyer.name} ← {deal.supplier.name}
                </p>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-tm-text-muted">
                  Unfilled ({deal.fieldsNeedingConfirmation.length})
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-1">
                  {deal.fieldsNeedingConfirmation.map((field) => (
                    <li
                      key={field}
                      className="rounded bg-tm-neutral px-1.5 py-0.5 text-[10px] text-tm-text-light"
                    >
                      {field}
                    </li>
                  ))}
                </ul>
                {onViewDeal && (
                  <button
                    type="button"
                    onClick={() => onViewDeal(deal.id)}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-tm-primary hover:text-tm-primary-dark"
                  >
                    View scored deal
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
        {rows.length === 0 && (
          <p className="py-8 text-center text-sm text-tm-text-muted">
            No deals with matching unfilled fields
          </p>
        )}
      </div>

      {blockedRows.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-tm-black">
                Blocked — not yet scoreable ({blockedRows.length})
              </h2>
              <p className="mt-1 text-xs text-tm-text-light">
                Missing buyer and/or supplier years-in-business, so no CRAM score
                has been computed at all for these — they don't appear on the
                Platform deals or Counterparty scores tabs. Enter a value below to
                preview the score immediately (computed live in your browser,
                same formula as the deals above) — the same company name is
                shared across every deal row it appears in, so you only need to
                enter it once per company.
              </p>
            </div>
            {yibEdits.size > 0 && (
              <button
                type="button"
                onClick={downloadYibCorrections}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-tm-primary bg-tm-primary/10 px-3 py-1.5 text-xs font-medium text-tm-primary-dark hover:bg-tm-primary/20"
              >
                <Download className="h-3.5 w-3.5" />
                Download {yibEdits.size} correction{yibEdits.size === 1 ? "" : "s"} (CSV)
              </button>
            )}
          </div>
          {blockedRows.map(({ record, deal }) => {
            const buyerMissing = deal.buyer.yearsInBusiness === null;
            const supplierMissing = deal.supplier.yearsInBusiness === null;

            const buyerEdit = yibEdits.get(deal.buyer.name) ?? "";
            const supplierEdit = yibEdits.get(deal.supplier.name) ?? "";
            const buyerEffective = buyerMissing
              ? buyerEdit.trim() !== "" && Number.isFinite(Number(buyerEdit))
                ? Number(buyerEdit)
                : null
              : deal.buyer.yearsInBusiness;
            const supplierEffective = supplierMissing
              ? supplierEdit.trim() !== "" && Number.isFinite(Number(supplierEdit))
                ? Number(supplierEdit)
                : null
              : deal.supplier.yearsInBusiness;

            const complete = buyerEffective !== null && supplierEffective !== null;
            const preview = complete
              ? buildRiskAssessment({
                  ...deal,
                  buyer: { ...deal.buyer, yearsInBusiness: buyerEffective },
                  supplier: { ...deal.supplier, yearsInBusiness: supplierEffective },
                })
              : null;
            const tierColors = preview ? getTierColors(preview.tier) : null;

            return (
              <article
                key={record.id}
                className={`rounded-xl border p-4 shadow-tm-sm sm:p-5 ${
                  complete
                    ? "border-tm-border bg-tm-surface"
                    : "border-dashed border-tm-text-muted/40 bg-tm-neutral-light"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      complete
                        ? "bg-tm-primary/10 text-tm-primary"
                        : "bg-tm-text-muted/10 text-tm-text-muted"
                    }`}
                  >
                    {complete ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Ban className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <h3 className="font-semibold text-tm-black">
                        {deal.dealRef}
                      </h3>
                      {preview && tierColors && (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tierColors.badge}`}
                        >
                          Score {Math.round(preview.overall)} ·{" "}
                          {preview.tier.replace(" Risk", "")}
                        </span>
                      )}
                      <span className="text-xs text-tm-text-muted">
                        {deal.product} · {formatUSD(deal.dealValueUSD)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-tm-text-light">
                      {deal.buyer.name} ← {deal.supplier.name} ·{" "}
                      {deal.origin} → {deal.destination}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-4">
                      {buyerMissing && (
                        <label className="text-xs">
                          <span className="mb-1 block font-medium text-tm-danger-dark">
                            Buyer years in business
                          </span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            placeholder="e.g. 5"
                            value={buyerEdit}
                            onChange={(e) => setYibEdit(deal.buyer.name, e.target.value)}
                            className="w-28 rounded-lg border border-tm-border bg-tm-surface px-2 py-1 text-sm outline-none focus:border-tm-primary"
                          />
                        </label>
                      )}
                      {supplierMissing && (
                        <label className="text-xs">
                          <span className="mb-1 block font-medium text-tm-danger-dark">
                            Supplier years in business
                          </span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            placeholder="e.g. 5"
                            value={supplierEdit}
                            onChange={(e) => setYibEdit(deal.supplier.name, e.target.value)}
                            className="w-28 rounded-lg border border-tm-border bg-tm-surface px-2 py-1 text-sm outline-none focus:border-tm-primary"
                          />
                        </label>
                      )}
                    </div>
                    {complete && (
                      <p className="mt-2 text-[10px] text-tm-text-muted">
                        Preview only — not saved. Download the correction CSV
                        above and merge it into company-master.csv, then
                        re-run <code className="text-[10px]">npx tsx scripts/build-platform-deals.ts</code>{" "}
                        to make this permanent.
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
