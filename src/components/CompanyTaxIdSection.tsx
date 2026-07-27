import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, IdCard } from "lucide-react";
import companyMaster from "../data/company-master.json";
import { extractValidRuc } from "../lib/market-intel/ruc";
import { useDataCorrections, downloadCompanyCorrectionsCsv } from "../lib/data-corrections";

interface CompanyMasterEntry {
  key: string;
  name: string;
  countries: string[];
  roles: string[];
  taxIds: string[];
  dealCount: number;
  yearsInBusiness: number | null;
  yearsInBusinessSource: "csv" | "default";
}

type RucStatus = "valid" | "peru-invalid" | "not-peru";

function statusFor(countries: string[], effectiveTaxIds: string[]): RucStatus {
  if (extractValidRuc(effectiveTaxIds)) return "valid";
  if (countries.includes("Peru")) return "peru-invalid";
  return "not-peru";
}

const STATUS_LABEL: Record<RucStatus, string> = {
  valid: "Valid Peru RUC",
  "peru-invalid": "⚠ Peru company, no valid RUC",
  "not-peru": "Not Peru — RUC N/A",
};

const STATUS_BADGE: Record<RucStatus, string> = {
  valid: "border-tm-primary/30 bg-tm-primary/10 text-tm-primary-dark",
  "peru-invalid": "border-tm-danger/30 bg-tm-danger/10 text-tm-danger",
  "not-peru": "border-tm-border bg-tm-neutral text-tm-text-muted",
};

/**
 * Tax ID / RUC + years-in-business completeness across every counterparty in
 * company-master.json — surfaced together because both are company-level
 * (not deal-level) gaps: ERD v4's `companies` entity keys identity on
 * `UNIQUE(taxIdType, taxId, country)` and carries `yearsInBusiness` directly.
 * A valid Peru RUC is also the sole gate for market-intel enrichment
 * (capacity + SUNAT license checks — see scripts/lib/market-intel-cli.ts).
 *
 * Both fields are editable here, backed by the shared localStorage
 * corrections store (preview-only, same rationale as CargoInsuranceSection —
 * see lib/data-corrections.ts) — decision 2026-07-27.
 */
export function CompanyTaxIdSection() {
  const [expanded, setExpanded] = useState(true);
  const entries = companyMaster as CompanyMasterEntry[];
  const { corrections, setYearsInBusiness, setTaxId } = useDataCorrections();

  const rows = useMemo(
    () =>
      entries
        .map((entry) => {
          const taxIdOverride = corrections.taxIdByCompany[entry.name];
          const effectiveTaxIds = taxIdOverride ? [taxIdOverride, ...entry.taxIds] : entry.taxIds;
          const yibOverride = corrections.yearsInBusinessByCompany[entry.name];
          return {
            entry,
            status: statusFor(entry.countries, effectiveTaxIds),
            hasMultiple: entry.taxIds.length > 1,
            taxIdOverride,
            yibOverride,
          };
        })
        .sort((a, b) => {
          const order: Record<RucStatus, number> = { "peru-invalid": 0, valid: 1, "not-peru": 2 };
          return order[a.status] - order[b.status];
        }),
    [entries, corrections],
  );

  const peruInvalidCount = rows.filter((r) => r.status === "peru-invalid").length;
  const validCount = rows.filter((r) => r.status === "valid").length;
  const duplicateCount = rows.filter((r) => r.hasMultiple).length;
  const correctionCount =
    Object.keys(corrections.taxIdByCompany).length + Object.keys(corrections.yearsInBusinessByCompany).length;

  return (
    <section className="rounded-xl border border-tm-border bg-tm-surface shadow-tm-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 items-start gap-3 text-left"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tm-neutral text-tm-text-muted">
            <IdCard className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-tm-black">
              Tax ID / RUC & years in business — {validCount} of {entries.length} companies have a valid Peru RUC
            </h2>
            <p className="mt-0.5 text-xs text-tm-text-light">
              A valid Peru RUC is the only gate for market-intel enrichment (capacity checks + real
              SUNAT license status). {peruInvalidCount > 0 && (
                <span className="font-medium text-tm-danger">
                  {peruInvalidCount} Peru-based {peruInvalidCount === 1 ? "company has" : "companies have"} no
                  valid RUC on file —
                </span>
              )}{" "}
              non-Peru companies show "N/A" because RUC is a Peru-specific tax ID; they already carry
              their own country's ID instead.
              {duplicateCount > 0 && (
                <> {duplicateCount} {duplicateCount === 1 ? "company lists" : "companies list"} more than
                one tax ID value on file — needs reconciliation before matching ERD v4's
                one-value-per-company constraint.</>
              )}{" "}
              Enter a real tax ID or years-in-business below where either is missing — computed live
              wherever it changes a badge/score elsewhere in the app, but not saved until exported.
            </p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {correctionCount > 0 && (
            <button
              type="button"
              onClick={() => downloadCompanyCorrectionsCsv(corrections)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-tm-primary bg-tm-primary/10 px-3 py-1.5 text-xs font-medium text-tm-primary-dark hover:bg-tm-primary/20"
            >
              <Download className="h-3.5 w-3.5" />
              Download {correctionCount} correction{correctionCount === 1 ? "" : "s"} (CSV)
            </button>
          )}
          <button type="button" onClick={() => setExpanded((v) => !v)} className="shrink-0">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-tm-text-muted" />
            ) : (
              <ChevronRight className="h-4 w-4 text-tm-text-muted" />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="overflow-x-auto border-t border-tm-border">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-tm-text-muted">
                <th className="px-4 py-2 sm:px-5">Company</th>
                <th className="px-2 py-2">Role</th>
                <th className="px-2 py-2">Country</th>
                <th className="px-2 py-2">Deals</th>
                <th className="px-2 py-2">Years in business</th>
                <th className="px-2 py-2">Tax ID / RUC</th>
                <th className="px-4 py-2 sm:px-5">RUC status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ entry, status, hasMultiple, taxIdOverride, yibOverride }) => (
                <tr key={entry.key} className="border-t border-tm-border/60">
                  <td className="px-4 py-2 font-medium text-tm-text sm:px-5">{entry.name}</td>
                  <td className="px-2 py-2 text-tm-text-light">{entry.roles.join(", ")}</td>
                  <td className="px-2 py-2 text-tm-text-light">{entry.countries.join(", ")}</td>
                  <td className="px-2 py-2 text-tm-text-light">{entry.dealCount}</td>
                  <td className="px-2 py-2">
                    {entry.yearsInBusinessSource === "csv" ? (
                      <span className="text-tm-text-light">{entry.yearsInBusiness}</span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        step={1}
                        placeholder="e.g. 5"
                        value={yibOverride ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setYearsInBusiness(
                            entry.name,
                            v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null,
                          );
                        }}
                        className="w-20 rounded-lg border border-tm-border bg-tm-surface px-2 py-1 text-xs outline-none focus:border-tm-primary"
                      />
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-tm-text-light">
                        {entry.taxIds.join(", ") || "—"}
                      </span>
                      {hasMultiple && (
                        <span className="rounded bg-tm-danger/10 px-1 py-0.5 text-[10px] text-tm-danger">
                          {entry.taxIds.length} values
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Enter correct tax ID…"
                      value={taxIdOverride ?? ""}
                      onChange={(e) => setTaxId(entry.name, e.target.value || null)}
                      className="mt-1 w-40 rounded-lg border border-tm-border bg-tm-surface px-2 py-1 font-mono text-[10px] outline-none focus:border-tm-primary"
                    />
                  </td>
                  <td className="px-4 py-2 sm:px-5">
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[status]}`}
                    >
                      {STATUS_LABEL[status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t border-tm-border p-3 text-[10px] text-tm-text-muted">
        Preview only — not saved. Download the correction CSV above and merge it into
        company-master.csv (or the target ERD v4 `companies` table), then re-run{" "}
        <code className="text-[10px]">npx tsx scripts/build-company-master.ts &amp;&amp; npx tsx scripts/build-platform-deals.ts</code>{" "}
        to make it permanent.
      </p>
    </section>
  );
}
