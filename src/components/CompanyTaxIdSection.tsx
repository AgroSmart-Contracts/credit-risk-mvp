import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, IdCard } from "lucide-react";
import companyMaster from "../data/company-master.json";
import { extractValidRuc } from "../lib/market-intel/ruc";

interface CompanyMasterEntry {
  key: string;
  name: string;
  countries: string[];
  roles: string[];
  taxIds: string[];
  dealCount: number;
}

type RucStatus = "valid" | "peru-invalid" | "not-peru";

function statusFor(entry: CompanyMasterEntry): RucStatus {
  if (extractValidRuc(entry.taxIds)) return "valid";
  if (entry.countries.includes("Peru")) return "peru-invalid";
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
 * Tax ID / RUC completeness across every counterparty in company-master.json
 * — surfaced on its own because ERD v4's `companies` entity keys company
 * identity by `UNIQUE(taxIdType, taxId, country)`, and because a valid Peru
 * RUC is the sole gate for market-intel enrichment (capacity + SUNAT license
 * checks — see scripts/lib/market-intel-cli.ts). Read-only report: RUC isn't
 * itself a CRAM scoring input, so there's no live-preview here the way
 * CargoInsuranceSection has one — decision 2026-07-27.
 */
export function CompanyTaxIdSection() {
  const [expanded, setExpanded] = useState(true);
  const entries = companyMaster as CompanyMasterEntry[];

  const rows = useMemo(
    () =>
      entries
        .map((entry) => ({
          entry,
          status: statusFor(entry),
          hasMultiple: entry.taxIds.length > 1,
        }))
        .sort((a, b) => {
          const order: Record<RucStatus, number> = { "peru-invalid": 0, valid: 1, "not-peru": 2 };
          return order[a.status] - order[b.status];
        }),
    [entries],
  );

  const peruInvalidCount = rows.filter((r) => r.status === "peru-invalid").length;
  const validCount = rows.filter((r) => r.status === "valid").length;
  const duplicateCount = rows.filter((r) => r.hasMultiple).length;

  return (
    <section className="rounded-xl border border-tm-border bg-tm-surface shadow-tm-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left sm:p-5"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tm-neutral text-tm-text-muted">
            <IdCard className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-tm-black">
              Tax ID / RUC coverage — {validCount} of {entries.length} companies have a valid Peru RUC
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
              )}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-tm-text-muted" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-tm-text-muted" />
        )}
      </button>

      {expanded && (
        <div className="overflow-x-auto border-t border-tm-border">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-tm-text-muted">
                <th className="px-4 py-2 sm:px-5">Company</th>
                <th className="px-2 py-2">Role</th>
                <th className="px-2 py-2">Country</th>
                <th className="px-2 py-2">Deals</th>
                <th className="px-2 py-2">Tax ID(s) on file</th>
                <th className="px-4 py-2 sm:px-5">RUC status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ entry, status, hasMultiple }) => (
                <tr key={entry.key} className="border-t border-tm-border/60">
                  <td className="px-4 py-2 font-medium text-tm-text sm:px-5">{entry.name}</td>
                  <td className="px-2 py-2 text-tm-text-light">{entry.roles.join(", ")}</td>
                  <td className="px-2 py-2 text-tm-text-light">{entry.countries.join(", ")}</td>
                  <td className="px-2 py-2 text-tm-text-light">{entry.dealCount}</td>
                  <td className="px-2 py-2 font-mono text-[10px] text-tm-text-light">
                    {entry.taxIds.join(", ") || "—"}
                    {hasMultiple && (
                      <span className="ml-1.5 rounded bg-tm-danger/10 px-1 py-0.5 text-tm-danger">
                        {entry.taxIds.length} values
                      </span>
                    )}
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
    </section>
  );
}
