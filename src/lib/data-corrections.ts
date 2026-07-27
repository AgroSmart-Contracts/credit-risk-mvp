/**
 * Admin data-correction drafts — persisted to localStorage so an admin
 * reviewing gaps doesn't lose their work on a refresh, but deliberately
 * NOT wired into the officially-displayed scores elsewhere in the app
 * (Prescored deals / Counterparty scores tabs keep showing the checked-in
 * baseline). This app's data model is batch-generated from CSVs and
 * checked into git (scripts/build-platform-deals.ts) — that's the single
 * source of truth a financial risk tool needs. A silent localStorage
 * override of live scores would create a second, driftable source of
 * truth. Instead, this store backs a *preview* (see DealMissingFieldsTab)
 * and an export the admin merges into the real source data, matching the
 * pattern already established for years-in-business corrections before
 * this file existed — decision 2026-07-27.
 */
import { useEffect, useState } from "react";
import type { Deal } from "../types";

const STORAGE_KEY = "tm-cram-data-corrections-v1";

export interface DataCorrections {
  /** Keyed by the already-normalized company name (`deal.buyer.name` / `deal.supplier.name` — normalizeCompanyName() has already run by the time it reaches a Deal). */
  yearsInBusinessByCompany: Record<string, number>;
  /** Keyed by mongoId (stable across rebuilds, unlike the synthetic `id`). */
  insuranceCoverageByDeal: Record<string, Deal["insuranceCoverage"]>;
}

function emptyCorrections(): DataCorrections {
  return { yearsInBusinessByCompany: {}, insuranceCoverageByDeal: {} };
}

function load(): DataCorrections {
  if (typeof window === "undefined") return emptyCorrections();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyCorrections();
    const parsed = JSON.parse(raw) as Partial<DataCorrections>;
    return { ...emptyCorrections(), ...parsed };
  } catch {
    return emptyCorrections();
  }
}

function persist(next: DataCorrections): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private browsing / storage quota — edits just won't survive a refresh, not fatal.
  }
}

let state = load();
const listeners = new Set<() => void>();

function setState(next: DataCorrections): void {
  state = next;
  persist(state);
  for (const listener of listeners) listener();
}

/** React binding over the module-level store — a Context provider would be overkill for one small draft object shared across a couple of tabs. */
export function useDataCorrections() {
  const [, rerender] = useState(0);
  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    corrections: state,
    setYearsInBusiness(companyName: string, years: number | null): void {
      const next = { ...state, yearsInBusinessByCompany: { ...state.yearsInBusinessByCompany } };
      if (years === null) delete next.yearsInBusinessByCompany[companyName];
      else next.yearsInBusinessByCompany[companyName] = years;
      setState(next);
    },
    setInsuranceCoverage(mongoId: string, coverage: Deal["insuranceCoverage"] | null): void {
      const next = { ...state, insuranceCoverageByDeal: { ...state.insuranceCoverageByDeal } };
      if (coverage === null) delete next.insuranceCoverageByDeal[mongoId];
      else next.insuranceCoverageByDeal[mongoId] = coverage;
      setState(next);
    },
    clearAll(): void {
      setState(emptyCorrections());
    },
  };
}

function csvEscape(value: string | number): string {
  const s = String(value);
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename: string, header: string, rows: Array<Array<string | number>>): void {
  const body = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([header + "\n" + body + "\n"], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadYibCorrectionsCsv(corrections: DataCorrections): void {
  const rows = Object.entries(corrections.yearsInBusinessByCompany).map(([name, years]) => [name, years]);
  downloadCsv("yib-corrections.csv", "name,yearsInBusiness", rows);
}

export function downloadInsuranceCorrectionsCsv(
  corrections: DataCorrections,
  mongoIdToDealRef: Map<string, string>,
): void {
  const rows = Object.entries(corrections.insuranceCoverageByDeal).map(([mongoId, coverage]) => [
    mongoId,
    mongoIdToDealRef.get(mongoId) ?? "",
    coverage,
  ]);
  downloadCsv("insurance-corrections.csv", "mongoId,dealRef,insuranceCoverage", rows);
}
