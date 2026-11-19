/**
 * Printed reports, designed natively for A4 portrait (spec 7): the two-page
 * monthly portfolio report and the one-page exception notice. Fixed 794 × 1123
 * px pages, 1px rules, numbers right-aligned, readable in grayscale.
 */
import type { ReactNode } from "react";
import { bySeverity, cov, date, loanFunds, month, pct, pendingDecisions, portfolioFigures, range, toDisburse, usd } from "../../lib/bcp/calc";

/** The rule behind a decision, short: the part before the first colon or full stop. */
const shortBasis = (s: string) => s.split(/[:.]\s/)[0];
import type { ExceptionNotice, Portfolio } from "../../lib/bcp/types";
import { STATE_TEXT, useLang, useT } from "./shared";

function Page({ children, n, of, title, sub }: { children: ReactNode; n: number; of: number; title: string; sub: string }) {
  const t = useT();
  return (
    <div className="a4 mx-auto mb-6 shadow-[0_1px_8px_rgba(16,42,64,0.12)] text-[12.5px] leading-[1.35] text-bcp-ink print:mb-0">
      <header className="border-b-2 border-bcp-ink pb-2">
        <p className="lbl">{t("TruMarket · para BCP Riesgos · confidencial", "TruMarket · for BCP Risk · confidential")}</p>
        <div className="flex items-end justify-between gap-3">
          <h1 className="text-[20px] font-bold">{title}</h1>
          <p className="lbl">{t(`Página ${n} de ${of}`, `Page ${n} of ${of}`)}</p>
        </div>
        <p className="lbl">{sub}</p>
      </header>
      {children}
    </div>
  );
}

function H({ children }: { children: ReactNode }) {
  return <h2 className="mb-0.5 mt-2 text-[13.5px] font-bold">{children}</h2>;
}

function T({ head, rows, right = [], nowrap = [0] }: { head: string[]; rows: ReactNode[][]; right?: number[]; nowrap?: number[] }) {
  return (
    <table className="w-full border-collapse text-[11.5px]">
      <thead>
        <tr className="border-b border-bcp-ink">
          {head.map((h, i) => (
            <th key={i} className={`lbl whitespace-nowrap py-[3px] pr-2 font-bold ${right.includes(i) ? "text-right" : "text-left"}`} style={{ fontSize: 11 }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-bcp-border align-top">
            {r.map((c, j) => (
              <td key={j} className={`py-[3px] pr-2 ${right.includes(j) ? "whitespace-nowrap text-right tabular-nums" : ""} ${nowrap.includes(j) ? "whitespace-nowrap" : ""}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const stateWord = (s: keyof typeof STATE_TEXT, lang: "es" | "en") => STATE_TEXT[s][lang];

export function MonthlyReport({ data }: { data: Portfolio }) {
  const t = useT();
  const lang = useLang();
  const F = portfolioFigures(data.loans);
  const sub = t(`${"Noviembre 2026"} · corte ${date(data.cutoff, "es")} · datos de ejemplo`, `November 2026 · cut-off ${date(data.cutoff, "en")} · example data`);
  const title = t("Reporte mensual de cartera pre-cosecha", "Monthly pre-harvest portfolio report");
  const loans = [...data.loans].sort(bySeverity);
  const frozenLoan = data.loans.find((l) => l.frozenUsd > 0);
  const monthDecisions = data.loans
    .flatMap((l) => l.decisions.map((d) => ({ l, d })))
    .filter(({ d }) => d.date >= data.monthFrom && d.date <= data.cutoff)
    .sort((a, b) => b.d.date.localeCompare(a.d.date));
  const pendingBank = pendingDecisions(data.loans, data.cutoff).map(({ loan, decision }) => ({ l: loan, d: decision }));
  const footer1 = (
    <footer className="lbl absolute bottom-10 left-14 right-14 border-t border-bcp-border pt-1.5">
      {t(
        `Cobertura de repago = ingreso neto de cosecha ÷ saldo al vencimiento. Umbrales propuestos: ámbar bajo 1.50x, naranja bajo 1.30x, rojo bajo 1.10x. Motor ${data.engineVersion}.`,
        `Repayment coverage = net harvest revenue ÷ amount due at maturity. Proposed thresholds: amber below 1.50x, orange below 1.30x, red below 1.10x. Engine ${data.engineVersion}.`,
      )}
    </footer>
  );

  return (
    <div>
      <Page n={1} of={2} title={title} sub={sub}>
        <H>{t("1. Resumen", "1. Summary")}</H>
        <ul className="list-disc pl-4">
          <li>
            <b>{t("Posición", "Position")}:</b> {t(`${usd(F.disbursed)} desembolsados (${pct((F.disbursed / F.line) * 100)} de la línea de ${usd(F.line)}); ${usd(F.frozen)} congelados; ${usd(F.pending)} por desembolsar contra hitos.`, `${usd(F.disbursed)} disbursed (${pct((F.disbursed / F.line) * 100)} of the ${usd(F.line)} line); ${usd(F.frozen)} frozen; ${usd(F.pending)} to disburse against milestones.`)}
          </li>
          <li>
            <b>{t("Riesgo", "Risk")}:</b> {t(`cobertura de la cartera ${cov(F.coverage)}; proyección ${range(data.projection.low, data.projection.high, "es")} (estimado); ningún préstamo en rojo; provisión ${usd(F.provision)}.`, `portfolio coverage ${cov(F.coverage)}; projection ${range(data.projection.low, data.projection.high, "en")} (estimated); no loan in red; provision ${usd(F.provision)}.`)}
          </li>
          <li>
            <b>{t("Cambios", "Changes")}:</b> {t(`${data.changes.filter((c) => c.to === "naranja").length} a naranja con tramo congelado, ${data.changes.filter((c) => c.to === "ambar").length} a ámbar con seguimiento reforzado; El Niño costero en observación.`, `${data.changes.filter((c) => c.to === "naranja").length} to orange with a frozen tranche, ${data.changes.filter((c) => c.to === "ambar").length} to amber with reinforced follow-up; coastal El Niño under watch.`)}
          </li>
          <li>
            <b>{t("Control", "Control")}:</b> {t(`${F.tranchesWithConformity} de ${F.tranchesReleased} tramos con checklist y conformidad del banco; ${pct(F.reconciledPct)} de los fondos con factura conciliada; congelamiento ejecutado el mismo día.`, `${F.tranchesWithConformity} of ${F.tranchesReleased} tranches with checklist and the bank's conformity; ${pct(F.reconciledPct)} of funds with a reconciled invoice; freeze executed the same day.`)}
          </li>
        </ul>

        <H>{t("2. Posición de la cartera", "2. Portfolio position")}</H>
        <div className="mb-1.5 flex h-3 overflow-hidden rounded-sm border border-bcp-ink" role="img" aria-label={t(`Desembolsado ${usd(F.disbursed)}, congelado ${usd(F.frozen)}, por desembolsar ${usd(F.pending)}`, `Disbursed ${usd(F.disbursed)}, frozen ${usd(F.frozen)}, to disburse ${usd(F.pending)}`)}>
          <span className="bg-bcp-ink" style={{ width: `${(F.disbursed / F.line) * 100}%` }} />
          <span className="hatch" style={{ width: `${(F.frozen / F.line) * 100}%` }} />
          <span className="bg-bcp-fill" style={{ width: `${(F.pending / F.line) * 100}%` }} />
        </div>
        <T
          head={[t("Concepto", "Item"), "USD", t("% línea", "% line"), t("Nota", "Note")]}
          right={[1, 2]}
          rows={[
            [t("Desembolsado", "Disbursed"), usd(F.disbursed).slice(4), pct((F.disbursed / F.line) * 100), t("capital vigente", "outstanding principal")],
            [t("Congelado", "Frozen"), usd(F.frozen).slice(4), pct((F.frozen / F.line) * 100), frozenLoan ? t(`T3 de ${frozenLoan.id}`, `T3 of ${frozenLoan.id}`) : ""],
            [t("Por desembolsar", "To disburse"), usd(F.pending).slice(4), pct((F.pending / F.line) * 100), t("contra hitos, nov a feb", "against milestones, Nov to Feb")],
            [t("Repagado", "Repaid"), usd(F.repaid).slice(4), "0%", t("cosechas desde mar 2027", "harvests from Mar 2027")],
            [<b key="l">{t("Línea total", "Total line")}</b>, <b key="v">{usd(F.line).slice(4)}</b>, "100%", F.maturities.map(([m, v]) => `${t("vence", "due")} ${month(`${m}-01`, lang)} ${usd(v)}`).join("; ")],
          ]}
        />

        <H>{t("3. Riesgo de la cartera", "3. Portfolio risk")}</H>
        <div className="grid grid-cols-2 gap-4">
          <T
            head={[t("Estado", "State"), t("USD desembolsados", "USD disbursed"), t("Préstamos", "Loans")]}
            right={[1, 2]}
            rows={(["verde", "ambar", "naranja", "rojo"] as const).map((s) => [stateWord(s, lang), usd(F.byState[s].usd).slice(4), F.byState[s].n])}
          />
          <T
            head={[t("Indicador", "Indicator"), t("Valor", "Value")]}
            right={[1]}
            rows={[
              [t("Cobertura de la cartera", "Portfolio coverage"), cov(F.coverage)],
              [t("Proyección (estimado)", "Projection (estimated)"), range(data.projection.low, data.projection.high, lang)],
              [t("Clasificación SBS", "SBS rating"), t("5 de 5 Normal", "5 of 5 Normal")],
              [t("Provisión requerida", "Required provision"), usd(F.provision)],
              [t("Concentración", "Concentration"), t(`palta Hass 100% · packing ${data.mainPackhousePct}%`, `Hass avocado 100% · packhouse ${data.mainPackhousePct}%`)],
            ]}
          />
        </div>

        <H>{t("4. Cambios del mes", "4. Changes this month")}</H>
        <T
          head={[t("Préstamo", "Loan"), t("Cambio", "Change"), t("Causa", "Cause"), t("Efecto en el repago", "Effect on repayment")]}
          nowrap={[0, 1]}
          rows={data.changes.map((c) => [c.loanId ?? t("Cartera", "Portfolio"), `${c.from === "neutral" ? "Neutral" : stateWord(c.from, lang)} → ${stateWord(c.to, lang)}`, t(c.cause), t(c.impact)])}
        />

        <H>{t("5. Préstamos", "5. Loans")}</H>
        <T
          head={[t("Préstamo", "Loan"), t("Estado", "State"), t("Desembolsado", "Disbursed"), t("Línea", "Line"), t("Cobertura", "Coverage"), t("Próximo hito", "Next milestone")]}
          nowrap={[0, 1]}
          right={[2, 3, 4]}
          rows={loans.map((l) => [l.id, stateWord(l.state, lang), usd(l.disbursedUsd).slice(4), usd(l.lineUsd).slice(4), `${cov(l.coverageAtApproval)} → ${cov(l.coverageToday)}`, `${date(l.next.date, lang, false)} · ${t(l.next.label)}`])}
        />
        {footer1}
      </Page>

      <Page n={2} of={2} title={title} sub={sub}>
        <H>{t("6. Uso de fondos", "6. Use of funds")}</H>
        <T
          head={[t("Préstamo", "Loan"), t("Tramos", "Tranches"), t("Desembolsado", "Disbursed"), t("Conciliado", "Reconciled"), t("Pago directo", "Direct pay"), t("Sin sustento", "Unexplained"), t("Estado", "State")]}
          right={[2, 3, 4, 5]}
          rows={[
            ...loans.map((l) => {
              const f = loanFunds(l);
              return [l.id, f.tranches.join(" + "), usd(f.budget).slice(4), pct(f.reconciledPct), pct(f.directPct), usd(f.unexplained).slice(4), f.reconciledPct < 85 ? t("en investigación", "under investigation") : t("conforme", "in order")];
            }),
            [<b key="t">{t("Cartera", "Portfolio")}</b>, "", <b key="d">{usd(F.disbursed).slice(4)}</b>, <b key="r">{pct(F.reconciledPct)}</b>, <b key="p">{pct(F.directPct)}</b>, <b key="u">{usd(F.unexplained).slice(4)}</b>, t(`efectivo ${usd(F.cash)}`, `cash ${usd(F.cash)}`)],
          ]}
        />

        <H>{t("7. Decisiones del mes", "7. Decisions this month")}</H>
        <T
          head={[t("Fecha", "Date"), t("Préstamo", "Loan"), t("Decisión", "Decision"), t("Quién", "Who"), t("Base", "Basis")]}
          nowrap={[0, 1]}
          rows={monthDecisions.filter(({ d }) => d.lane === "tm_contract" || d.date <= data.cutoff).map(({ l, d }) => [date(d.date, lang, false), l.id, t(d.title), d.lane === "bank" ? t("BCP, pendiente", "BCP, pending") : t(d.responsible), shortBasis(t(d.basis))])}
        />
        {pendingBank.length > 0 && (
          <p className="mt-1">
            {t("Pendiente del banco:", "Pending with the bank:")} {pendingBank.map(({ l, d }) => `${l.id} · ${t(d.title)}${d.dueDate ? ` (${t("vence", "due")} ${date(d.dueDate, lang, false)})` : ""}`).join("; ")}.
          </p>
        )}

        <H>{t("8. Excepciones abiertas", "8. Open exceptions")}</H>
        <T
          head={[t("Préstamo", "Loan"), t("Desde", "Since"), t("Exposición", "Exposure"), t("Plan", "Plan"), t("Si no se cumple", "If not met")]}
          nowrap={[0, 1]}
          right={[2]}
          rows={data.exceptions.map((e) => {
            const l = data.loans.find((x) => x.id === e.loanId)!;
            return [`${e.loanId} · ${stateWord(e.state, lang)}`, date(e.since, lang, false), usd(l.disbursedUsd).slice(4), t(e.plan), t(e.ifNotMet)];
          })}
        />

        <H>{t("9. Próximos 30 días", "9. Next 30 days")}</H>
        <T
          head={[t("Fecha", "Date"), t("Préstamo", "Loan"), t("Hito", "Milestone"), t("Monto en juego", "Amount at stake")]}
          nowrap={[0, 1]}
          right={[3]}
          rows={data.upcoming.map((u) => [date(u.date, lang, false), u.loanId, t(u.milestone), usd(u.amountUsd).slice(4)])}
        />
        <p className="mt-2 text-[11.5px] text-bcp-muted">
          {t(`Por desembolsar contra hitos: ${usd(data.loans.reduce((s, l) => s + toDisburse(l), 0))}.`, `To disburse against milestones: ${usd(data.loans.reduce((s, l) => s + toDisburse(l), 0))}.`)}
        </p>

        <footer className="absolute bottom-10 left-14 right-14 border-t border-bcp-border pt-1.5">
          <p className="lbl">
            {t(
              "Cada cifra tiene su fuente, fecha y evidencia en el expediente correspondiente; el registro de auditoría es inmutable.",
              "Every figure has its source, date and evidence in the corresponding file; the audit log is immutable.",
            )}
          </p>
          <div className="mt-6 flex items-end justify-between">
            <div>
              <div className="w-56 border-t border-bcp-ink" />
              <p className="lbl">{t("Operaciones TruMarket", "TruMarket Operations")}</p>
            </div>
            <p className="lbl">{t(`Emitido el ${date(data.cutoff, "es")}`, `Issued on ${date(data.cutoff, "en")}`)}</p>
          </div>
        </footer>
      </Page>
    </div>
  );
}

export function ExceptionNoticeReport({ data, notice }: { data: Portfolio; notice: ExceptionNotice }) {
  const t = useT();
  const lang = useLang();
  const loan = data.loans.find((l) => l.id === notice.loanId)!;
  return (
    <Page n={1} of={1} title={t(`Aviso de excepción · ${loan.id}`, `Exception notice · ${loan.id}`)} sub={t(`${t(loan.crop)} · ${t(loan.zone)} · emitido el ${date(notice.since, "es")} · datos de ejemplo`, `${t(loan.crop)} · ${t(loan.zone)} · issued on ${date(notice.since, "en")} · example data`)}>
      <div className="mt-3 flex items-start gap-3">
        <span className="shrink-0 rounded border-2 border-bcp-naranja px-2 py-1 font-[Arial,Helvetica,sans-serif] text-[13px] font-bold uppercase text-bcp-naranja-text">{STATE_TEXT[notice.state][lang]}</span>
        <div className="rounded bg-bcp-naranja-bg px-3 py-2">
          <p className="lbl font-bold">{t("En una frase", "In one sentence")}</p>
          <p className="text-[13px]">{t(notice.oneLine)}</p>
        </div>
      </div>
      <H>{t("1. Qué pasó", "1. What happened")}</H>
      <ul className="list-disc space-y-0.5 pl-4">{notice.whatHappened.map((x, i) => <li key={i}>{t(x)}</li>)}</ul>
      <H>{t("2. Impacto en la exposición del banco", "2. Impact on the bank's exposure")}</H>
      <ul className="list-disc space-y-0.5 pl-4">{notice.impact.map((x, i) => <li key={i}>{t(x)}</li>)}</ul>
      <H>{t("3. Qué hizo TruMarket según contrato", "3. What TruMarket did under contract")}</H>
      <ol className="list-decimal space-y-0.5 pl-5">{notice.actions.map((x, i) => <li key={i}>{t(x)}</li>)}</ol>
      <H>{t("4. Qué debe decidir el banco y cuándo", "4. What the bank must decide, and when")}</H>
      <div className="rounded border-2 border-bcp-ink px-3 py-2">
        <ul className="list-disc space-y-0.5 pl-4">{notice.bankDecision.map((x, i) => <li key={i}>{t(x)}</li>)}</ul>
      </div>
      <H>{t("5. Evidencia adjunta", "5. Attached evidence")}</H>
      <ul className="grid list-disc grid-cols-2 gap-x-6 gap-y-0.5 pl-4">{notice.evidence.map((x, i) => <li key={i}>{t(x)}</li>)}</ul>
      <p className="mt-3">
        {t("Cobertura", "Coverage")}: {cov(loan.coverageAtApproval)} → <b>{cov(loan.coverageToday)}</b> · {t("estimado", "estimated")} {loan.projection ? range(loan.projection.low, loan.projection.high, lang) : t("n/d", "n/a")} · {t("expuesto", "exposed")} {usd(loan.disbursedUsd)} · {t("congelado", "frozen")} {usd(loan.frozenUsd)}
      </p>
      <footer className="absolute bottom-10 left-14 right-14 border-t border-bcp-border pt-1.5">
        <p className="lbl">{t(`Próxima actualización: ${date(notice.nextUpdate, "es")} (aforo adelantado). Motor ${data.engineVersion}.`, `Next update: ${date(notice.nextUpdate, "en")} (field estimate brought forward). Engine ${data.engineVersion}.`)}</p>
        <div className="mt-6 flex items-end justify-between">
          <div>
            <div className="w-56 border-t border-bcp-ink" />
            <p className="lbl">{t("Operaciones TruMarket", "TruMarket Operations")}</p>
          </div>
          <p className="lbl">{date(notice.since, lang)}</p>
        </div>
      </footer>
    </Page>
  );
}
