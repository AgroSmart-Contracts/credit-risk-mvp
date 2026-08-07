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
import { platformDealsBlocked } from "../data/platform-deals";
import { platformDealToDeal } from "../lib/platform-deal-mapper";
import { buildRiskAssessment, formatUSD } from "../lib/assessment";
import { getTierColors } from "../lib/risk-colors";
import { useDataCorrections, downloadYibCorrectionsCsv } from "../lib/data-corrections";
import { CargoInsuranceSection } from "./CargoInsuranceSection";

interface DealMissingFieldsTabProps {
  onViewDeal?: (dealId: string) => void;
}

type ProductBucket = "Blueberries" | "Mandarins" | "Other";

const PRODUCT_BUCKETS: ProductBucket[] = [
  "Blueberries",
  "Mandarins",
  "Other",
];

const PRODUCT_COL_LABEL: Record<ProductBucket, string> = {
  Blueberries: "BB",
  Mandarins: "Mand",
  Other: "Other",
};

function productBucket(product: string): ProductBucket {
  if (/blueberr/i.test(product)) return "Blueberries";
  if (/mandarin/i.test(product)) return "Mandarins";
  return "Other";
}

type FieldFreqRow = {
  field: string;
  unit: "buyers" | "suppliers";
  /** Unique companies missing this field across all products. */
  total: number;
  /** Unique companies of this role in the scored set (bar denom). */
  universe: number;
  /** Unique companies missing the field on deals in each product bucket. */
  byProduct: Record<ProductBucket, number>;
};

function emptyProductSets(): Record<ProductBucket, Set<string>> {
  return {
    Blueberries: new Set(),
    Mandarins: new Set(),
    Other: new Set(),
  };
}

export function DealMissingFieldsTab({
  onViewDeal,
}: DealMissingFieldsTabProps) {
  const [query, setQuery] = useState("");
  /** Admin-entered years-in-business, keyed by company name — shared across every
   * deal row for that company (YIB is per-company, not per-deal). Persisted to
   * localStorage (survives a refresh) via the shared corrections store — see
   * lib/data-corrections.ts — but still preview-only: the officially displayed
   * scores elsewhere don't read this until it's merged into company-master.csv
   * and rebuilt. */
  const { corrections, setYearsInBusiness } = useDataCorrections();

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

  /** Unique buyers / suppliers missing each Dimension A field, split by product. */
  const fieldFreq = useMemo(() => {
    const allBuyers = new Set<string>();
    const allSuppliers = new Set<string>();
    const buyersByField = new Map<
      string,
      { all: Set<string>; by: Record<ProductBucket, Set<string>> }
    >();
    const suppliersByField = new Map<
      string,
      { all: Set<string>; by: Record<ProductBucket, Set<string>> }
    >();

    for (const entry of prescoredPlatformDeals) {
      const { deal } = entry;
      const bucket = productBucket(deal.product);
      allBuyers.add(deal.buyer.name);
      allSuppliers.add(deal.supplier.name);
      for (const field of deal.fieldsNeedingConfirmation) {
        if (field.startsWith("Buyer ")) {
          let row = buyersByField.get(field);
          if (!row) {
            row = { all: new Set(), by: emptyProductSets() };
            buyersByField.set(field, row);
          }
          row.all.add(deal.buyer.name);
          row.by[bucket].add(deal.buyer.name);
        } else if (field.startsWith("Supplier ")) {
          let row = suppliersByField.get(field);
          if (!row) {
            row = { all: new Set(), by: emptyProductSets() };
            suppliersByField.set(field, row);
          }
          row.all.add(deal.supplier.name);
          row.by[bucket].add(deal.supplier.name);
        }
      }
    }

    const toRows = (
      map: Map<string, { all: Set<string>; by: Record<ProductBucket, Set<string>> }>,
      unit: "buyers" | "suppliers",
      universe: number,
    ): FieldFreqRow[] =>
      [...map.entries()]
        .map(([field, row]) => ({
          field,
          unit,
          total: row.all.size,
          universe,
          byProduct: {
            Blueberries: row.by.Blueberries.size,
            Mandarins: row.by.Mandarins.size,
            Other: row.by.Other.size,
          },
        }))
        .sort(
          (a, b) => b.total - a.total || a.field.localeCompare(b.field),
        );

    return {
      buyers: toRows(buyersByField, "buyers", allBuyers.size),
      suppliers: toRows(suppliersByField, "suppliers", allSuppliers.size),
    };
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

  const totalRows = prescoredPlatformDeals.length + platformDealsBlocked.length;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="font-display text-3xl text-tm-black sm:text-4xl">
          Missing fields by deal
        </h1>
        <p className="mt-2 text-tm-text-light">
          {dealsWithGaps} of {prescoredPlatformDeals.length} pre-scored platform
          deals still have enrichment gaps, including the full Dimension A
          counterparty field list (credit rating, payment delay, quality
          rejection, volumes, route diversity, certifications) — these are
          excluded from each party's raw average, not assumed, so a gap here
          lowers coverage rather than faking a score. License is still
          assumed valid (no KYC source on file).{" "}
          {platformDealsBlocked.length > 0 && (
            <>
              {platformDealsBlocked.length} more deals are blocked from
              scoring entirely — missing buyer and/or supplier years-in-business
              — see below.
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-tm-text-muted">
          All {totalRows} rows from the source CSV accounted for: {prescoredPlatformDeals.length}{" "}
          scoreable + {platformDealsBlocked.length} blocked. (<code className="text-[10px]">likely_test</code>{" "}
          rows are merged into scoring like every other deal, not tracked separately.)
        </p>
      </div>

      {(fieldFreq.buyers.length > 0 || fieldFreq.suppliers.length > 0) && (
        <section className="rounded-xl border border-tm-border bg-tm-surface p-5 shadow-tm-sm">
          <h2 className="text-sm font-semibold text-tm-black">
            Field frequency across buyers &amp; suppliers
          </h2>
          <p className="mt-1 text-xs text-tm-text-muted">
            Unique companies missing each field, by product. A company can
            appear in more than one product (counts may not sum to total).
            Other = avocado, asparagus, ginger, IQF, etc.
          </p>

          {(
            [
              ["Buyers", fieldFreq.buyers],
              ["Suppliers", fieldFreq.suppliers],
            ] as const
          ).map(([title, group]) =>
            group.length === 0 ? null : (
              <div key={title} className="mt-5">
                <h3 className="mb-2 text-xs font-semibold text-tm-black">
                  {title}
                  <span className="ml-1.5 font-normal text-tm-text-muted">
                    ({group[0]?.universe ?? 0} unique)
                  </span>
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-tm-border text-xs text-tm-text-muted">
                        <th className="py-2 pr-3 font-medium">Field</th>
                        <th
                          className="px-2 py-2 text-right font-medium"
                          title="Unique companies missing this field (all products)"
                        >
                          Total
                        </th>
                        {PRODUCT_BUCKETS.map((bucket) => (
                          <th
                            key={bucket}
                            className="px-2 py-2 text-right font-medium"
                            title={bucket}
                          >
                            {PRODUCT_COL_LABEL[bucket]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.map((row) => (
                        <tr
                          key={row.field}
                          className="border-b border-tm-border/60 last:border-0"
                        >
                          <td className="py-2.5 pr-3 text-tm-text">
                            {row.field.replace(/^(Buyer|Supplier)\s+/, "")}
                          </td>
                          <td
                            className="px-2 py-2.5 text-right font-medium tabular-nums text-tm-black"
                            title={`${row.total} of ${row.universe} ${row.unit}`}
                          >
                            {row.total}
                          </td>
                          {PRODUCT_BUCKETS.map((bucket) => (
                            <td
                              key={bucket}
                              className="px-2 py-2.5 text-right tabular-nums text-tm-text-light"
                            >
                              {row.byProduct[bucket] || "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ),
          )}
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

      <CargoInsuranceSection query={query} />

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
            {Object.keys(corrections.yearsInBusinessByCompany).length > 0 && (
              <button
                type="button"
                onClick={() => downloadYibCorrectionsCsv(corrections)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-tm-primary bg-tm-primary/10 px-3 py-1.5 text-xs font-medium text-tm-primary-dark hover:bg-tm-primary/20"
              >
                <Download className="h-3.5 w-3.5" />
                Download {Object.keys(corrections.yearsInBusinessByCompany).length} correction
                {Object.keys(corrections.yearsInBusinessByCompany).length === 1 ? "" : "s"} (CSV)
              </button>
            )}
          </div>
          {blockedRows.map(({ record, deal }) => {
            const buyerMissing = deal.buyer.yearsInBusiness === null;
            const supplierMissing = deal.supplier.yearsInBusiness === null;

            const buyerEdit = corrections.yearsInBusinessByCompany[deal.buyer.name];
            const supplierEdit = corrections.yearsInBusinessByCompany[deal.supplier.name];
            const buyerEffective = buyerMissing ? buyerEdit ?? null : deal.buyer.yearsInBusiness;
            const supplierEffective = supplierMissing ? supplierEdit ?? null : deal.supplier.yearsInBusiness;

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
                            value={buyerEdit ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              setYearsInBusiness(
                                deal.buyer.name,
                                v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null,
                              );
                            }}
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
                            value={supplierEdit ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              setYearsInBusiness(
                                deal.supplier.name,
                                v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null,
                              );
                            }}
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
