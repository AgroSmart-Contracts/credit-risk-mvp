/**
 * Two what-ifs for the bank's risk team, both on the portfolio's Risk tab:
 * coverage at the bank's own cost of funds (rule R5), and the SBS provision if
 * loans on the watchlist were reclassified. Neither changes any other figure.
 */
import { useState } from "react";
import { BANK_COST_RATE, COVERAGE_BANDS, PROVISION_RATE, cov, daysBetween, dueAt, harvestBuild, pct, stateCause, stateFromCoverage, usd, worstOf } from "../../lib/bcp/calc";
import type { Loan, State } from "../../lib/bcp/types";
import { STATE_TEXT, useT } from "./shared";
import { Card, Lbl } from "./ui";

const INK: Record<State, string> = { verde: "text-bcp-green-text", ambar: "text-bcp-ambar-text", naranja: "text-bcp-naranja-text", rojo: "text-bcp-rojo-text", veto: "text-bcp-rojo-text" };
const PRESETS = [0.1, 0.14, 0.16, 0.18];

/** Coverage and risk level of each loan at a chosen annual cost of funds (simple, act/360). */
function atRate(l: Loan, rate: number) {
  const due = dueAt(l.lineUsd, daysBetween(l.approvalDate, l.maturityDate), rate);
  const c = harvestBuild(l, {}, due).coverage;
  // The part of the level that does not come from coverage stays as it is.
  const other: Exclude<State, "veto"> = stateCause(l) === "cobertura" ? l.controlsState : (l.state as Exclude<State, "veto">);
  return { due, coverage: c, state: worstOf(other, stateFromCoverage(c)) };
}

export function BankCostCard({ loans }: { loans: Loan[] }) {
  const t = useT();
  const [rate, setRate] = useState(BANK_COST_RATE);
  const [custom, setCustom] = useState("");
  const rows = loans.map((l) => ({ l, base: atRate(l, BANK_COST_RATE), now: atRate(l, rate) }));
  const net = rows.reduce((s, r) => s + harvestBuild(r.l, {}, r.now.due).netUsd, 0);
  const due = rows.reduce((s, r) => s + r.now.due, 0);
  const portfolio = due ? Math.round((net / due) * 100) / 100 : 0;
  const pickCustom = (v: string) => {
    setCustom(v);
    const n = Number(v.replace(",", "."));
    if (Number.isFinite(n) && n > 0 && n <= 60) setRate(n / 100);
  };
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-bold">{t("Costo del banco", "Bank cost of funds")}</h3>
          <p className="text-[13px] text-bcp-muted">{t(`Tasa de referencia anual (simple, act/360). Las cifras de la cartera usan ${pct(BANK_COST_RATE * 100)}; reemplácela por la tasa de BCP.`, `Annual reference rate (simple, act/360). Portfolio figures use ${pct(BANK_COST_RATE * 100)}; replace it with BCP's rate.`)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("Tasa anual", "Annual rate")}>
          <div className="flex overflow-hidden rounded-lg border border-bcp-border text-sm font-semibold">
            {PRESETS.map((r) => (
              <button key={r} type="button" aria-pressed={rate === r && !custom} onClick={() => { setRate(r); setCustom(""); }} className={`min-h-[36px] px-3 ${rate === r && !custom ? "bg-bcp-ink text-white" : "bg-white text-bcp-ink hover:bg-bcp-bg"}`}>
                {Math.round(r * 100)}%
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1 text-sm text-bcp-muted">
            <input type="text" inputMode="decimal" value={custom} onChange={(e) => pickCustom(e.target.value)} placeholder={t("otra", "other")} aria-label={t("Otra tasa anual (%)", "Other annual rate (%)")} className="min-h-[36px] w-16 rounded-lg border border-bcp-border px-2 text-right text-bcp-ink focus:border-bcp-ink focus:outline-none" />%
          </label>
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-bcp-border">
              {[t("Préstamo", "Loan"), t("Saldo al vencimiento", "Due at maturity"), t(`Cobertura a ${pct(BANK_COST_RATE * 100)}`, `Coverage at ${pct(BANK_COST_RATE * 100)}`), t(`Cobertura a ${pct(rate * 100)}`, `Coverage at ${pct(rate * 100)}`), t("Nivel de riesgo", "Risk level")].map((h, i) => (
                <Lbl key={h} as="th" className={`py-1.5 pr-3 font-normal ${i === 0 || i === 4 ? "text-left" : "text-right"}`}>{h}</Lbl>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-bcp-divider">
            {rows.map(({ l, base, now }) => (
              <tr key={l.id}>
                <td className="py-2 pr-3 font-semibold">{l.id}</td>
                <td className="num py-2 pr-3 text-right">{usd(now.due)}</td>
                <td className="num py-2 pr-3 text-right text-bcp-muted">{cov(base.coverage)}</td>
                <td className={`num py-2 pr-3 text-right font-semibold ${INK[stateFromCoverage(now.coverage)]}`}>{cov(now.coverage)}</td>
                <td className="py-2 pr-3">
                  {t(STATE_TEXT[now.state])}
                  {now.state !== base.state && <span className="ml-1.5 text-[12px] font-semibold text-bcp-naranja-text">{t(`antes ${t(STATE_TEXT[base.state]).toLowerCase()}`, `was ${t(STATE_TEXT[base.state]).toLowerCase()}`)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-bcp-ink font-bold">
              <td className="py-2 pr-3">{t("Cartera", "Portfolio")}</td>
              <td className="num py-2 pr-3 text-right">{usd(due)}</td>
              <td />
              <td className={`num py-2 pr-3 text-right ${INK[stateFromCoverage(portfolio)]}`}>{cov(portfolio)}</td>
              <td className="py-2 pr-3 text-[13px] font-normal text-bcp-muted">
                {t(`${rows.filter((r) => r.now.coverage < COVERAGE_BANDS.ambar).length} bajo ${cov(COVERAGE_BANDS.ambar)}`, `${rows.filter((r) => r.now.coverage < COVERAGE_BANDS.ambar).length} below ${cov(COVERAGE_BANDS.ambar)}`)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

type SbsMode = "actual" | "cpp" | "deficiente";

export function SbsSimulator({ loans }: { loans: Loan[] }) {
  const t = useT();
  const [mode, setMode] = useState<SbsMode>("cpp");
  const rating = (l: Loan): Loan["sbsRating"] =>
    mode === "actual" || l.state === "verde" ? l.sbsRating : mode === "deficiente" && (l.state === "naranja" || l.state === "rojo") ? "Deficiente" : "CPP";
  const current = loans.reduce((s, l) => s + Math.round(l.disbursedUsd * PROVISION_RATE[l.sbsRating]), 0);
  const simulated = loans.reduce((s, l) => s + Math.round(l.disbursedUsd * PROVISION_RATE[rating(l)]), 0);
  const MODES: [SbsMode, string][] = [
    ["actual", t("Clasificación actual", "Current rating")],
    ["cpp", t("En seguimiento → CPP (5%)", "Watchlist → CPP (5%)")],
    ["deficiente", t("Riesgo elevado → Deficiente (25%)", "Elevated risk → Deficiente (25%)")],
  ];
  return (
    <Card>
      <h3 className="text-[16px] font-bold">{t("Provisión SBS si los préstamos en seguimiento se reclasificaran", "SBS provision if watchlist loans were reclassified")}</h3>
      <p className="text-[13px] text-bcp-muted">
        {t(
          "Supuesto, no pronóstico: la SBS clasifica sobre todo por días de atraso, y estos préstamos pagan una sola vez al vencimiento. Tasas para pequeña empresa sin garantía preferida; sobre lo desembolsado.",
          "A what-if, not a forecast: SBS classifies mainly by days past due, and these loans pay once at maturity. Small-business rates without a preferred guarantee; on the amount disbursed.",
        )}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold" role="group" aria-label={t("Escenario de clasificación", "Rating scenario")}>
        {MODES.map(([m, label]) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`min-h-[38px] rounded-lg border px-3 text-left ${mode === m ? "border-bcp-ink bg-bcp-ink text-white" : "border-bcp-border bg-white text-bcp-ink hover:border-bcp-ink"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-end sm:gap-8">
        <div>
          <Lbl>{t("Provisión requerida", "Required provision")}</Lbl>
          <p className="num text-[28px] font-bold leading-tight">{usd(simulated)}</p>
          <p className={`num text-sm font-semibold ${simulated > current ? "text-bcp-naranja-text" : "text-bcp-muted"}`}>
            {simulated > current ? t(`+${usd(simulated - current)} frente a hoy (${usd(current)})`, `+${usd(simulated - current)} vs today (${usd(current)})`) : t("igual a hoy", "same as today")}
          </p>
        </div>
        <ul className="divide-y divide-bcp-divider text-sm">
          {loans.filter((l) => l.state !== "verde").map((l) => (
            <li key={l.id} className="flex flex-wrap justify-between gap-x-3 py-1.5">
              <span><b className="font-semibold">{l.id}</b> · {t(STATE_TEXT[l.state])}</span>
              <span className="num">{rating(l)} · {usd(Math.round(l.disbursedUsd * PROVISION_RATE[rating(l)]))}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
