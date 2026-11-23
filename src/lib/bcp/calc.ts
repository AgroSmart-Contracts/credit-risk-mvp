/**
 * BCP workspace formulas (spec section 5.2 and 5.3) and number formatting.
 * Everything a screen shows is derived here from the dataset, so totals always
 * reconcile: disbursed by state, use of funds, driver deltas, portfolio coverage.
 */
import type { Driver, Lang, Loan, ScoreDim, State, Tx, UseOfFundsLine } from "./types";

// ---------------------------------------------------------------------------
// Formatting (no em or en dashes anywhere; ranges use "a" / "to")
// ---------------------------------------------------------------------------

export const tx = (t: Tx, lang: Lang) => t[lang];
export const L = (es: string, en: string): Tx => ({ es, en });

export const usd = (n: number) => `USD ${Math.round(n).toLocaleString("en-US")}`;
export const cov = (n: number) => `${n.toFixed(2)}x`;
/** Signed coverage change; a true minus sign (U+2212) keeps figures aligned. */
export const signedCov = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(2)}x`;
/** Hectares: exact, or "~9" when the bank edition has rounded the area. */
export const haLabel = (n: number) => (Number.isInteger(n) ? `~${n}` : n.toFixed(2));
export const pct = (n: number) => `${Math.round(n)}%`;
export const range = (lo: number, hi: number, lang: Lang) => `${cov(lo)} ${lang === "es" ? "a" : "to"} ${cov(hi)}`;

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "10 nov 2026" / "10 Nov 2026"; withYear=false gives "10 nov". */
export function date(d: string, lang: Lang, withYear = true): string {
  const [y, m, day] = d.split("-").map(Number);
  const mon = (lang === "es" ? MES : MON)[m - 1];
  return `${String(day).padStart(2, "0")} ${mon}${withYear ? ` ${y}` : ""}`;
}
/** "mar 2027" / "Mar 2027". */
export function month(d: string, lang: Lang): string {
  const [y, m] = d.split("-").map(Number);
  return `${(lang === "es" ? MES : MON)[m - 1]} ${y}`;
}
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

// ---------------------------------------------------------------------------
// States (5.2)
// ---------------------------------------------------------------------------

export const COVERAGE_BANDS = { ambar: 1.5, naranja: 1.3, rojo: 1.1 } as const;

export function stateFromCoverage(c: number): Exclude<State, "veto"> {
  if (c < COVERAGE_BANDS.rojo) return "rojo";
  if (c < COVERAGE_BANDS.naranja) return "naranja";
  if (c < COVERAGE_BANDS.ambar) return "ambar";
  return "verde";
}

export const SEVERITY: Record<State, number> = { verde: 0, ambar: 1, naranja: 2, rojo: 3, veto: 4 };
export const worstState = (a: State, b: State): State => (SEVERITY[a] >= SEVERITY[b] ? a : b);

// ---------------------------------------------------------------------------
// Loan figures (5.3)
// ---------------------------------------------------------------------------

export const toDisburse = (l: Loan) => l.lineUsd - l.disbursedUsd - l.frozenUsd;

/** Coverage under a shock: coverage × (1 + shock). */
// Half-up rounding to two decimals (1.75 × 0.7 = 1.225 → 1.23), robust to binary float error.
export const shocked = (c: number, shock: number) => Math.round(c * (1 + shock) * 100 + 1e-6) / 100;

/** The two standard stress cases on a coverage figure (loan today, or an application). */
export function stressCases(c: number): { label: Tx; coverage: number }[] {
  return [
    { label: L("Si el precio cae 20%", "If the price falls 20%"), coverage: shocked(c, -0.2) },
    { label: L("Si el volumen cae 30%", "If the volume falls 30%"), coverage: shocked(c, -0.3) },
  ];
}

export const scenarios = (l: Loan) => stressCases(l.coverageToday);

export const DRIVERS: Driver[] = ["volumen", "precio", "calidad", "cobranza", "prestatario"];
export const DRIVER_TEXT: Record<Driver, Tx> = {
  volumen: L("Volumen", "Volume"),
  precio: L("Precio", "Price"),
  calidad: L("Calidad", "Quality"),
  cobranza: L("Cobranza", "Collection"),
  prestatario: L("Prestatario", "Borrower"),
};
export const driverSum = (l: Loan) => Math.round(DRIVERS.reduce((s, d) => s + l.driverDeltas[d], 0) * 100) / 100;

/** SBS provision rates by rating, Res. SBS 11356-2008, no preferred guarantee. */
export const PROVISION_RATE: Record<Loan["sbsRating"], number> = { Normal: 0.01, CPP: 0.05, Deficiente: 0.25, Dudoso: 0.6, Pérdida: 1 };
export const provision = (l: Loan) => Math.round(l.disbursedUsd * PROVISION_RATE[l.sbsRating]);

// ---------------------------------------------------------------------------
// Use of funds
// ---------------------------------------------------------------------------

export function fundsTotals(lines: UseOfFundsLine[]) {
  const budget = lines.reduce((s, x) => s + x.budgetUsd, 0);
  const reconciled = lines.reduce((s, x) => s + x.reconciledUsd, 0);
  const direct = lines.reduce((s, x) => s + x.directPayUsd, 0);
  return { budget, reconciled, direct, unexplained: budget - reconciled, reconciledPct: budget ? (reconciled / budget) * 100 : 0, directPct: budget ? (direct / budget) * 100 : 0 };
}

/** One loan across all its released tranches. */
export function loanFunds(l: Loan) {
  const all = l.useOfFunds.flatMap((u) => u.lines);
  const t = fundsTotals(all);
  return { ...t, cash: l.useOfFunds.reduce((s, u) => s + u.cashWithdrawnUsd, 0), tranches: l.useOfFunds.map((u) => u.tranche) };
}

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------

export function portfolioFigures(loans: Loan[]) {
  const line = loans.reduce((s, l) => s + l.lineUsd, 0);
  const disbursed = loans.reduce((s, l) => s + l.disbursedUsd, 0);
  const frozen = loans.reduce((s, l) => s + l.frozenUsd, 0);
  const pending = loans.reduce((s, l) => s + toDisburse(l), 0);
  const repaid = 0;
  // Portfolio coverage = Σ(coverage × disbursed) ÷ Σ disbursed.
  const coverage = disbursed ? Math.round((loans.reduce((s, l) => s + l.coverageToday * l.disbursedUsd, 0) / disbursed) * 100) / 100 : 0;
  const byState: Record<Exclude<State, "veto">, { usd: number; n: number }> = { verde: { usd: 0, n: 0 }, ambar: { usd: 0, n: 0 }, naranja: { usd: 0, n: 0 }, rojo: { usd: 0, n: 0 } };
  for (const l of loans) if (l.state !== "veto") {
    byState[l.state].usd += l.disbursedUsd;
    byState[l.state].n += 1;
  }
  // Principal maturities by month: the line less any frozen tranche (as in the cash calendar).
  const maturities = new Map<string, number>();
  for (const l of loans) maturities.set(l.maturityDate.slice(0, 7), (maturities.get(l.maturityDate.slice(0, 7)) ?? 0) + l.lineUsd - l.frozenUsd);
  const funds = loans.map(loanFunds);
  const fundsDisbursed = funds.reduce((s, f) => s + f.budget, 0);
  const reconciled = funds.reduce((s, f) => s + f.reconciled, 0);
  const direct = funds.reduce((s, f) => s + f.direct, 0);
  const tranchesReleased = loans.flatMap((l) => l.tranches).filter((t) => t.status === "liberado");
  const withConformity = tranchesReleased.filter((t) => t.bankConformityDate && t.checklist.every((c) => c.status === "ok"));
  return {
    line,
    disbursed,
    frozen,
    pending,
    repaid,
    coverage,
    byState,
    maturities: [...maturities.entries()].sort(([a], [b]) => a.localeCompare(b)),
    provision: loans.reduce((s, l) => s + provision(l), 0),
    reconciledPct: fundsDisbursed ? (reconciled / fundsDisbursed) * 100 : 0,
    unexplained: fundsDisbursed - reconciled,
    directPct: fundsDisbursed ? (direct / fundsDisbursed) * 100 : 0,
    cash: funds.reduce((s, f) => s + f.cash, 0),
    tranchesReleased: tranchesReleased.length,
    tranchesWithConformity: withConformity.length,
  };
}

/** Sort for the loans table: state severity, then exposure. */
export const bySeverity = (a: Loan, b: Loan) => SEVERITY[b.state] - SEVERITY[a.state] || b.disbursedUsd - a.disbursedUsd;

/** Bank conformities open at the cut-off and not yet given, soonest due first. One that opens later (e.g. after a field estimate) is not pending yet. */
export function pendingDecisions(loans: Loan[], cutoff: string) {
  return loans
    .flatMap((l) => l.decisions.filter((d) => d.lane === "bank" && !d.conformityDate && d.date <= cutoff).map((d) => ({ loan: l, decision: d })))
    .sort((a, b) => (a.decision.dueDate ?? a.decision.date).localeCompare(b.decision.dueDate ?? b.decision.date));
}

/**
 * Cash calendar: by month from the cut-off to the last maturity, what leaves the
 * bank (tranches against milestones; frozen money is not counted) and what comes
 * back (amount due at maturity).
 */
export function cashCalendar(loans: Loan[], cutoff: string) {
  const ym = (d: string) => d.slice(0, 7);
  const start = ym(cutoff);
  const rows = new Map<string, { out: number; back: number; items: { loanId: string; label: Tx; amount: number; dir: "out" | "back" }[] }>();
  const row = (m: string) => rows.get(m) ?? rows.set(m, { out: 0, back: 0, items: [] }).get(m)!;
  for (const l of loans) {
    for (const t of l.tranches.filter((x) => x.status === "pendiente" || x.status === "previsto")) {
      const m = ym(t.milestoneDate) < start ? start : ym(t.milestoneDate);
      const r = row(m);
      r.out += t.amountUsd;
      r.items.push({ loanId: l.id, label: L(`${t.id} contra hito`, `${t.id} against milestone`), amount: t.amountUsd, dir: "out" });
    }
    // Principal back at maturity: what was and will be disbursed (frozen money is not lent).
    const principal = l.lineUsd - l.frozenUsd;
    const r = row(ym(l.maturityDate));
    r.back += principal;
    r.items.push({ loanId: l.id, label: L("capital al vencimiento", "principal at maturity"), amount: principal, dir: "back" });
  }
  return [...rows.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([m, r]) => ({ month: `${m}-01`, ...r }));
}

/** Score = Σ weight × points, at approval or today. */
export const scoreOf = (dims: ScoreDim[], at: "approval" | "today") => Math.round(dims.reduce((s, d) => s + d.weight * d[at], 0));

export const STRESS_PRICE = [0, -0.1, -0.2, -0.3] as const;
export const STRESS_VOLUME = [0, -0.15, -0.3] as const;
/** Coverage under a price shock and a volume shock together. */
export function stressGrid(c: number) {
  return STRESS_VOLUME.map((v) => ({ volume: v, cells: STRESS_PRICE.map((p) => ({ price: p, coverage: Math.round(c * (1 + v) * (1 + p) * 100 + 1e-6) / 100 })) }));
}
