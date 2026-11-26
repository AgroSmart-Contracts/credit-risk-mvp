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
/** "label · date", unless the label already names that date (no "aforo 15 nov (15 nov)"). */
export function withDate(label: string, d: string, lang: Lang, withYear = false): string {
  return label.includes(date(d, lang, false)) ? label : `${label} · ${date(d, lang, withYear)}`;
}

export function month(d: string, lang: Lang): string {
  const [y, m] = d.split("-").map(Number);
  return `${(lang === "es" ? MES : MON)[m - 1]} ${y}`;
}
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

// ---------------------------------------------------------------------------
// The bank's cost, by tenor
// ---------------------------------------------------------------------------

/**
 * Reference annual rate for the bank's cost, act/360. Estimated until pricing is
 * agreed with BCP: shown only inside the amount due, never as a rate. At 10% a
 * 180-day line costs 5%; longer tenors cost proportionally more.
 */
export const BANK_COST_RATE = 0.1;
/** Amount due at maturity: the full line plus the estimated cost for its tenor. */
export const dueAt = (lineUsd: number, tenorDays: number, rate: number = BANK_COST_RATE) => Math.round(lineUsd * (1 + (rate * tenorDays) / 360));
/** Estimated cost accrued to date on what has been disbursed, tranche by tranche. */
export const accruedCost = (l: { tranches: { status: string; amountUsd: number; milestoneDate: string }[] }, cutoff: string) =>
  l.tranches.filter((x) => x.status === "liberado" && x.milestoneDate <= cutoff).reduce((s, x) => s + Math.round((x.amountUsd * BANK_COST_RATE * daysBetween(x.milestoneDate, cutoff)) / 360), 0);

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
export const worstOf = <S extends State>(a: S, b: S): S => (SEVERITY[a] >= SEVERITY[b] ? a : b);

// ---------------------------------------------------------------------------
// Loan figures (5.3)
// ---------------------------------------------------------------------------

export const toDisburse = (l: Loan) => l.lineUsd - l.disbursedUsd - l.frozenUsd;

// ---------------------------------------------------------------------------
// Coverage build (net revenue) and stress
// ---------------------------------------------------------------------------

/**
 * Cost per exportable kg: packing, harvest, transport to port and fees. Estimated
 * until calibrated. No ocean freight: the price is FOB, which already excludes it.
 */
export const COST_USD_KG = 0.57;
/** The one standard stress, applied everywhere: price −20% and volume −30%, each on its own. */
export const STANDARD_STRESS = { price: -0.2, volume: -0.3 } as const;

/** What a coverage figure is built from: a loan or an application. */
export interface HarvestInput {
  volumeKg: number;
  exportablePct: number;
  expectedPriceUsdKg: number;
  dueAtMaturityUsd: number;
}

const r2 = (n: number) => Math.round(n * 100 + 1e-9) / 100;

/**
 * Coverage = net revenue ÷ amount due. A price shock moves the price, not the cost
 * per kg; a volume shock moves kg, so revenue and cost fall together.
 */
export function harvestBuild(x: HarvestInput, shock: { price?: number; volume?: number } = {}, dueUsd = x.dueAtMaturityUsd) {
  const exportKg = Math.round((x.volumeKg * x.exportablePct) / 100 * (1 + (shock.volume ?? 0)));
  const priceUsdKg = x.expectedPriceUsdKg * (1 + (shock.price ?? 0));
  const grossUsd = Math.round(exportKg * priceUsdKg);
  const costUsd = Math.round(exportKg * COST_USD_KG);
  const netUsd = grossUsd - costUsd;
  return { volumeKg: x.volumeKg, exportablePct: x.exportablePct, exportKg, priceUsdKg, grossUsd, costUsd, netUsd, dueUsd, coverage: r2(netUsd / dueUsd), breakEvenUsdKg: r2(COST_USD_KG + dueUsd / exportKg) };
}

export const coverageUnder = (x: HarvestInput, price = 0, volume = 0, dueUsd?: number) => harvestBuild(x, { price, volume }, dueUsd).coverage;

/** The two standard stress cases (loan today, or an application at an amount due). */
export function stressCases(x: HarvestInput, dueUsd?: number): { label: Tx; coverage: number }[] {
  return [
    { label: L("Si el precio cae 20%", "If the price falls 20%"), coverage: coverageUnder(x, STANDARD_STRESS.price, 0, dueUsd) },
    { label: L("Si el volumen cae 30%", "If the volume falls 30%"), coverage: coverageUnder(x, 0, STANDARD_STRESS.volume, dueUsd) },
  ];
}

export const scenarios = (l: Loan) => stressCases(l);

/** Why a loan has its colour: the coverage band, a contractual control, or a technical signal (pending ruling). */
export type StateCause = "cobertura" | "control" | "tecnica";
export function stateCause(l: Loan): StateCause | null {
  if (l.state === "verde" || l.state === "veto") return null;
  if (SEVERITY[stateFromCoverage(l.coverageToday)] >= SEVERITY[l.state]) return "cobertura";
  if (SEVERITY[l.controlsState] >= SEVERITY[l.state]) return "control";
  return "tecnica";
}
export const CAUSE_TEXT: Record<StateCause, Tx> = {
  cobertura: L("por cobertura", "on coverage"),
  control: L("por control", "on a control"),
  tecnica: L("por señal técnica", "on a technical signal"),
};

export const DRIVERS: Driver[] = ["volumen", "precio", "calidad", "cobranza", "prestatario"];
export const DRIVER_TEXT: Record<Driver, Tx> = {
  volumen: L("Volumen", "Volume"),
  precio: L("Precio", "Price"),
  calidad: L("Calidad", "Quality"),
  cobranza: L("Uso de fondos y cobranza", "Use of funds and collection"),
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
  // Portfolio coverage = Σ net revenue ÷ Σ amount due (the full committed line plus estimated cost).
  const due = loans.reduce((s, l) => s + l.dueAtMaturityUsd, 0);
  const netAt = (price = 0, volume = 0) => loans.reduce((s, l) => s + harvestBuild(l, { price, volume }).netUsd, 0);
  const netRevenue = netAt();
  const coverage = due ? r2(netRevenue / due) : 0;
  /** Portfolio coverage under a scenario, and how many loans land in each risk level (each loan counted once). */
  const scenario = (price: number, volume: number) => {
    const levels: Record<Exclude<State, "veto">, number> = { verde: 0, ambar: 0, naranja: 0, rojo: 0 };
    for (const l of loans) levels[stateFromCoverage(coverageUnder(l, price, volume))] += 1;
    return { coverage: due ? r2(netAt(price, volume) / due) : 0, levels };
  };
  const byState: Record<Exclude<State, "veto">, { usd: number; n: number }> = { verde: { usd: 0, n: 0 }, ambar: { usd: 0, n: 0 }, naranja: { usd: 0, n: 0 }, rojo: { usd: 0, n: 0 } };
  for (const l of loans) if (l.state !== "veto") {
    byState[l.state].usd += l.disbursedUsd;
    byState[l.state].n += 1;
  }
  // Principal maturities by month, on the full committed line (as coverage and the cash calendar).
  const maturities = new Map<string, number>();
  for (const l of loans) maturities.set(l.maturityDate.slice(0, 7), (maturities.get(l.maturityDate.slice(0, 7)) ?? 0) + l.lineUsd);
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
    due,
    netRevenue,
    coverage,
    stress: { today: scenario(0, 0), price: scenario(STANDARD_STRESS.price, 0), volume: scenario(0, STANDARD_STRESS.volume), both: scenario(STANDARD_STRESS.price, STANDARD_STRESS.volume) },
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
 * bank (tranches against milestones; a frozen tranche counted as if released, the
 * conservative basis) and what comes back (the amount due: principal plus estimated cost).
 */
export function cashCalendar(loans: Loan[], cutoff: string) {
  const ym = (d: string) => d.slice(0, 7);
  const start = ym(cutoff);
  const rows = new Map<string, { out: number; back: number; principal: number; items: { loanId: string; label: Tx; amount: number; dir: "out" | "back" }[] }>();
  const row = (m: string) => rows.get(m) ?? rows.set(m, { out: 0, back: 0, principal: 0, items: [] }).get(m)!;
  for (const l of loans) {
    for (const t of l.tranches.filter((x) => x.status !== "liberado")) {
      const m = ym(t.milestoneDate) < start ? start : ym(t.milestoneDate);
      const r = row(m);
      r.out += t.amountUsd;
      r.items.push({ loanId: l.id, label: t.status === "congelado" ? L(`${t.id} congelado, si se libera`, `${t.id} frozen, if released`) : L(t.id, t.id), amount: t.amountUsd, dir: "out" });
    }
    // Back at maturity: the amount due on the full line (principal plus estimated cost).
    const r = row(ym(l.maturityDate));
    r.back += l.dueAtMaturityUsd;
    r.principal += l.lineUsd;
    r.items.push({ loanId: l.id, label: L("capital más costo estimado", "principal plus estimated cost"), amount: l.dueAtMaturityUsd, dir: "back" });
  }
  return [...rows.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([m, r]) => ({ month: `${m}-01`, ...r }));
}

/** Score = Σ weight × points, at approval or today. */
export const scoreOf = (dims: ScoreDim[], at: "approval" | "today") => Math.round(dims.reduce((s, d) => s + d.weight * d[at], 0));

export const STRESS_PRICE = [0, -0.1, -0.2, -0.3] as const;
export const STRESS_VOLUME = [0, -0.15, -0.3] as const;
/** Coverage under a price shock and a volume shock together, on net revenue. */
export function stressGrid(x: HarvestInput) {
  return STRESS_VOLUME.map((v) => ({ volume: v, cells: STRESS_PRICE.map((p) => ({ price: p, coverage: coverageUnder(x, p, v) })) }));
}

/** Coverage effect of a change in expected price, at today's exportable volume. */
export const priceEffect = (x: HarvestInput, fromUsdKg: number) => r2((harvestBuild(x).exportKg * (x.expectedPriceUsdKg - fromUsdKg)) / x.dueAtMaturityUsd);
