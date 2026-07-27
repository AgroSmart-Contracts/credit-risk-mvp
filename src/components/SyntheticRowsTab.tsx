import { useMemo, useState } from "react";
import { FlaskConical, Search } from "lucide-react";
import { platformDealsSynthetic } from "../data/platform-deals";
import { platformDealToDeal } from "../lib/platform-deal-mapper";
import { formatUSD } from "../lib/assessment";

export function SyntheticRowsTab() {
  const [query, setQuery] = useState("");

  const syntheticRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return platformDealsSynthetic
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

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="font-display text-3xl text-tm-black sm:text-4xl">
          Synthetic / test rows
        </h1>
        <p className="mt-2 text-tm-text-light">
          Flagged <code className="text-xs">likely_test</code> in the source CSV
          (round seed timestamps, impossible-year Mongo IDs). Never scored, never
          counted toward any real-deal stat elsewhere in the app — kept in their own
          tab, separate from genuine data gaps, so reviewing real missing fields
          isn't mixed in with seed/test noise.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tm-text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search deal, party, or Mongo ID…"
          className="w-full rounded-lg border border-tm-border bg-tm-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-tm-primary"
        />
      </div>

      <section className="rounded-xl border border-tm-border bg-tm-surface shadow-tm-sm">
        <div className="flex items-center gap-3 p-4 sm:p-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tm-neutral text-tm-text-muted">
            <FlaskConical className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-tm-black">
              {syntheticRows.length} of {platformDealsSynthetic.length} rows
            </h2>
            <p className="mt-0.5 text-xs text-tm-text-light">
              Excluded from scoring and from the Platform deals / Counterparty
              scores / Missing fields tabs entirely.
            </p>
          </div>
        </div>

        {syntheticRows.length > 0 && (
          <div className="overflow-x-auto border-t border-tm-border">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-tm-text-muted">
                  <th className="px-4 py-2 sm:px-5">Deal ref</th>
                  <th className="px-2 py-2">Product</th>
                  <th className="px-2 py-2">Buyer ← Supplier</th>
                  <th className="px-2 py-2">Route</th>
                  <th className="px-2 py-2 text-right">Value</th>
                  <th className="px-4 py-2 text-right sm:px-5">Mongo ID</th>
                </tr>
              </thead>
              <tbody>
                {syntheticRows.map(({ record, deal }) => (
                  <tr
                    key={record.id}
                    className="border-t border-tm-border/60 text-tm-text-light"
                  >
                    <td className="px-4 py-2 font-medium text-tm-text sm:px-5">
                      {deal.dealRef}
                    </td>
                    <td className="px-2 py-2">{deal.product}</td>
                    <td className="px-2 py-2">
                      {deal.buyer.name} ← {deal.supplier.name}
                    </td>
                    <td className="px-2 py-2">
                      {deal.origin} → {deal.destination}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {formatUSD(deal.dealValueUSD)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-[10px] text-tm-text-muted sm:px-5">
                      {record.mongoId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {syntheticRows.length === 0 && (
          <p className="border-t border-tm-border py-8 text-center text-sm text-tm-text-muted">
            No rows match your search
          </p>
        )}
      </section>
    </div>
  );
}
