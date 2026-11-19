/**
 * Printed reports, designed natively for A4 portrait (spec 7): the two-page
 * monthly portfolio report, the one-page exception notice, the three-page
 * credit memo of a loan and the one-page assessment memo of an application. Fixed 794 × 1123
 * px pages, 1px rules, numbers right-aligned, readable in grayscale.
 */
import type { ReactNode } from "react";
import { DRIVERS, DRIVER_TEXT, bySeverity, cov, date, daysBetween, driverSum, fundsTotals, loanFunds, month, pct, pendingDecisions, portfolioFigures, provision, range, scenarios, signedCov, stressCases, toDisburse, usd } from "../../lib/bcp/calc";
import type { Application, ExceptionNotice, Loan, Portfolio } from "../../lib/bcp/types";
import { STATE_TEXT, useLang, useT } from "./shared";
import { Rich } from "./ui";

/** The rule behind a decision, short: the part before the first colon or full stop. */
const shortBasis = (s: string) => s.split(/[:.]\s/)[0];

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

// ---------------------------------------------------------------------------
// Credit memo (one loan) and assessment memo (one application)
// ---------------------------------------------------------------------------

/** Two-column key/value list for terms and indicators. */
function KV({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <table className="w-full border-collapse text-[11.5px]">
      <tbody>
        {rows.map(([k, v], i) => (
          <tr key={i} className="border-b border-bcp-border">
            <td className="py-[3px] pr-2 text-bcp-muted">{k}</td>
            <td className="whitespace-nowrap py-[3px] text-right font-semibold tabular-nums">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Signature lines for the committee. */
function Signatures({ left, right, when }: { left: string; right: string; when: string }) {
  return (
    <div className="mt-6 grid grid-cols-3 items-end gap-6">
      {[left, right].map((s) => (
        <div key={s}>
          <div className="border-t border-bcp-ink" />
          <p className="lbl">{s}</p>
        </div>
      ))}
      <p className="lbl text-right">{when}</p>
    </div>
  );
}

const CHECK_MARK = { ok: "✓", warn: "!", fail: "✕", pending: "○" } as const;

export function CreditMemo({ data, loan }: { data: Portfolio; loan: Loan }) {
  const t = useT();
  const lang = useLang();
  const title = t(`Memorando de crédito · ${loan.id}`, `Credit memo · ${loan.id}`);
  const sub = t(
    `${t(loan.crop)} · ${t(loan.zone)} · ${loan.areaHa.toFixed(2)} ha · campaña ${loan.campaign} · corte ${date(data.cutoff, "es")} · datos de ejemplo`,
    `${t(loan.crop)} · ${t(loan.zone)} · ${loan.areaHa.toFixed(2)} ha · campaign ${loan.campaign} · cut-off ${date(data.cutoff, "en")} · example data`,
  );
  const daysLeft = daysBetween(data.cutoff, loan.maturityDate);
  const groups = [...new Set(loan.conditions.map((c) => c.group))];
  const groupText: Record<string, string> = {
    Prestatario: t("Prestatario", "Borrower"),
    "Cultivo y volumen": t("Cultivo y volumen", "Crop and volume"),
    "Precio y calidad": t("Precio y calidad", "Price and quality"),
    "Uso de fondos y cobranza": t("Uso de fondos y cobranza", "Use of funds and collection"),
  };
  const notGreen = loan.conditions.filter((c) => c.state !== "verde").length;
  const footer = (
    <footer className="lbl absolute bottom-10 left-14 right-14 border-t border-bcp-border pt-1.5">
      {t(
        `Cobertura de repago = ingreso neto de cosecha ÷ saldo al vencimiento. Umbrales: ámbar bajo 1.50x, naranja bajo 1.30x, rojo bajo 1.10x. Motor ${data.engineVersion}.`,
        `Repayment coverage = net harvest revenue ÷ amount due at maturity. Thresholds: amber below 1.50x, orange below 1.30x, red below 1.10x. Engine ${data.engineVersion}.`,
      )}
    </footer>
  );

  return (
    <div>
      <Page n={1} of={3} title={title} sub={sub}>
        <div className="mt-3 flex items-start gap-3">
          <div className="shrink-0 rounded border-2 border-bcp-ink px-2 py-1 text-center">
            <p className="font-[Arial,Helvetica,sans-serif] text-[13px] font-bold uppercase">{stateWord(loan.state, lang)}</p>
            <p className="lbl">{t("desde", "since")} {date(loan.stateSince, lang, false)}</p>
          </div>
          <ul className="list-disc space-y-0.5 pl-4 text-[12.5px]">
            {loan.situation.map((s, i) => (
              <li key={i}>
                <Rich text={t(s)} />
              </li>
            ))}
          </ul>
        </div>

        <H>{t("1. Términos del crédito", "1. Loan terms")}</H>
        <div className="grid grid-cols-2 items-start gap-6">
          <KV
            rows={[
              [t("Línea aprobada", "Approved line"), usd(loan.lineUsd)],
              [t("Desembolsado (expuesto)", "Disbursed (exposed)"), usd(loan.disbursedUsd)],
              [t("Congelado", "Frozen"), usd(loan.frozenUsd)],
              [t("Por desembolsar", "Undrawn"), usd(toDisburse(loan))],
            ]}
          />
          <KV
            rows={[
              [t("Saldo al vencimiento", "Due at maturity"), usd(loan.dueAtMaturityUsd)],
              [t("Aprobación", "Approval"), date(loan.approvalDate, lang)],
              [t("Vencimiento", "Maturity"), `${date(loan.maturityDate, lang)} · ${daysLeft} ${t("días", "days")}`],
              [t("Ciclo", "Cycle"), t(`día ${loan.dayOfCycle} de ${loan.cycleDays}`, `day ${loan.dayOfCycle} of ${loan.cycleDays}`)],
            ]}
          />
        </div>
        <p className="mt-1 text-[11.5px] text-bcp-muted">{t("Repago desde los pagos del comprador a la cuenta de recaudo, antes de cualquier pago al productor.", "Repaid from the buyer's payments into the collection account, before any payment to the grower.")}</p>

        <H>{t("2. Tramos", "2. Tranches")}</H>
        <T
          head={[t("Tramo", "Tranche"), "USD", t("Estado", "Status"), t("Fecha", "Date"), t("Checklist", "Checklist"), t("Conformidad BCP", "BCP conformity")]}
          right={[1]}
          nowrap={[0, 2, 3]}
          rows={loan.tranches.map((tr) => {
            const ok = tr.checklist.filter((c) => c.status === "ok").length;
            const statusText = { liberado: t("Liberado", "Released"), pendiente: t("Pendiente", "Pending"), congelado: t("Congelado", "Frozen"), previsto: t("Previsto", "Planned") }[tr.status];
            const open = tr.checklist.filter((c) => c.status !== "ok");
            return [
              `${tr.id} · ${tr.pct}%`,
              usd(tr.amountUsd).slice(4),
              statusText,
              date(tr.milestoneDate, lang, false),
              <span key="c">
                {ok} {t("de", "of")} {tr.checklist.length}
                {open.length > 0 && <span className="text-bcp-muted">: {open.map((c) => `${CHECK_MARK[c.status]} ${t(c.label)}`).join("; ")}</span>}
              </span>,
              tr.bankConformityDate ? date(tr.bankConformityDate, lang, false) : "",
            ];
          })}
        />

        <H>{t("3. Evaluación de riesgo", "3. Risk assessment")}</H>
        <div className="grid grid-cols-2 items-start gap-6">
          <KV
            rows={[
              [t("Cobertura en la aprobación", "Coverage at approval"), cov(loan.coverageAtApproval)],
              [t("Cobertura hoy (confirmada)", "Coverage today (confirmed)"), cov(loan.coverageToday)],
              [t("Proyección (estimado)", "Projection (estimated)"), loan.projection ? range(loan.projection.low, loan.projection.high, lang) : t("sin cambio", "no change")],
              ...scenarios(loan).map((s) => [t(s.label), cov(s.coverage)] as [string, string]),
              [t("Precio de equilibrio", "Break-even price"), `USD ${loan.breakEvenPriceUsdKg.toFixed(2)}/kg`],
              [t("Precio esperado a cosecha", "Expected harvest price"), `USD ${loan.expectedPriceUsdKg.toFixed(2)}/kg`],
            ]}
          />
          <KV
            rows={[
              [t("Clasificación SBS", "SBS rating"), loan.sbsRating],
              [t("Provisión requerida", "Required provision"), usd(provision(loan))],
              [t("Pérdida esperada", "Expected loss"), t("por calibrar", "to be calibrated")],
              [t("Score aprobación → hoy", "Score approval → today"), `${loan.scoreAtApproval} → ${loan.scoreToday}`],
              [t("Tramo de riesgo aprobado", "Approved risk tier"), loan.approvedTier],
            ]}
          />
        </div>
        {loan.projection && <p className="mt-1 text-[11.5px] text-bcp-muted">{t("Proyección", "Projection")}: {t(loan.projection.cause)}.</p>}
        <T
          head={[t("Factor", "Driver"), t("Cambio en la cobertura", "Change in coverage")]}
          right={[1]}
          rows={[
            ...DRIVERS.map((d) => [t(DRIVER_TEXT[d]), signedCov(loan.driverDeltas[d])]),
            [<b key="t">{t("Total desde la aprobación", "Total since approval")}</b>, <b key="v">{signedCov(driverSum(loan))}</b>],
          ]}
        />
        {footer}
      </Page>

      <Page n={2} of={3} title={title} sub={sub}>
        <H>{t("4. Cambios desde la aprobación", "4. Changes since approval")}</H>
        <p className="mb-1 text-[11.5px] text-bcp-muted">
          {t(
            `${loan.conditions.length} condiciones monitoreadas; ${notGreen} fuera de verde. Aprobación ${date(loan.approvalDate, "es")} · hoy ${date(data.cutoff, "es")}.`,
            `${loan.conditions.length} conditions monitored; ${notGreen} not green. Approval ${date(loan.approvalDate, "en")} · today ${date(data.cutoff, "en")}.`,
          )}
        </p>
        <T
          head={[t("Condición", "Condition"), t("Aprobación", "Approval"), t("Hoy", "Today"), t("Umbral", "Threshold"), t("Estado", "State"), t("Efecto en el repago", "Effect on repayment")]}
          nowrap={[4]}
          rows={groups.flatMap((g) => [
            [<b key="g">{groupText[g]}</b>, "", "", "", "", ""],
            ...loan.conditions
              .filter((c) => c.group === g)
              .map((c) => [
                <span key="l" className={c.state !== "verde" ? "font-bold" : ""}>{t(c.label)}</span>,
                t(c.atApproval),
                t(c.today),
                <span key="u" className="text-bcp-muted">{t(c.threshold)}</span>,
                <span key="s" className={c.state !== "verde" ? "font-bold" : ""}>{stateWord(c.state, lang)}</span>,
                t(c.effectOnRepayment),
              ]),
          ])}
        />
        <p className="mt-1 text-[11px] text-bcp-muted">{t("Cada fila tiene su fuente y fecha en el expediente.", "Every row has its source and date in the file.")}</p>
        {footer}
      </Page>

      <Page n={3} of={3} title={title} sub={sub}>
        <H>{t("5. Uso de fondos", "5. Use of funds")}</H>
        <T
          head={[t("Tramo", "Tranche"), t("Partida", "Item"), t("Presupuesto", "Budget"), t("Conciliado", "Reconciled"), t("Pago directo", "Direct pay"), t("Sin sustento", "Unexplained"), t("Campo", "Field")]}
          right={[2, 3, 4, 5]}
          nowrap={[0]}
          rows={loan.useOfFunds.flatMap((u) => {
            const tot = fundsTotals(u.lines);
            return [
              ...u.lines.map((x, i) => [i === 0 ? u.tranche : "", t(x.item), usd(x.budgetUsd).slice(4), usd(x.reconciledUsd).slice(4), usd(x.directPayUsd).slice(4), usd(x.budgetUsd - x.reconciledUsd).slice(4), t(x.fieldMatch)]),
              [
                "",
                <b key="t">{t(`Total ${u.tranche}`, `${u.tranche} total`)}</b>,
                <b key="b">{usd(tot.budget).slice(4)}</b>,
                <b key="r">{pct(tot.reconciledPct)}</b>,
                <b key="d">{pct(tot.directPct)}</b>,
                <b key="u">{usd(tot.unexplained).slice(4)}</b>,
                t(`efectivo ${usd(u.cashWithdrawnUsd)}`, `cash ${usd(u.cashWithdrawnUsd)}`),
              ],
            ];
          })}
        />

        <H>{t("6. Decisiones", "6. Decisions")}</H>
        <T
          head={[t("Fecha", "Date"), t("Decisión", "Decision"), t("Base", "Basis"), t("Responsable", "Responsible")]}
          nowrap={[0]}
          rows={[...loan.decisions].sort((a, b) => b.date.localeCompare(a.date)).map((d) => [date(d.date, lang, false), <b key="d">{t(d.title)}</b>, t(d.basis), d.lane === "bank" && !d.conformityDate ? t("BCP, pendiente", "BCP, pending") : t(d.responsible)])}
        />

        <H>{t("7. Registro de auditoría", "7. Audit log")}</H>
        <T
          head={[t("Fecha", "Date"), t("Evento", "Event"), t("Responsable", "Responsible"), t("Regla", "Rule"), t("Evidencia", "Evidence")]}
          nowrap={[0]}
          rows={loan.auditLog.map((a) => [date(a.date, lang, false), t(a.event), t(a.responsible), t(a.rule), t(a.evidence)])}
        />
        <p className="mt-1 text-[11px] text-bcp-muted">{t("Las entradas son inmutables; las correcciones son entradas nuevas vinculadas.", "Entries are immutable; corrections are new linked entries.")}</p>

        <footer className="absolute bottom-10 left-14 right-14 border-t border-bcp-border pt-1.5">
          <p className="lbl">{t(`Próximo hito: ${date(loan.next.date, "es")} · ${loan.next.label.es}. Motor ${data.engineVersion}.`, `Next milestone: ${date(loan.next.date, "en")} · ${loan.next.label.en}. Engine ${data.engineVersion}.`)}</p>
          <Signatures left={t("Analista de riesgos TruMarket", "TruMarket risk analyst")} right={t("BCP Riesgos", "BCP Risk")} when={t(`Emitido el ${date(data.cutoff, "es")}`, `Issued on ${date(data.cutoff, "en")}`)} />
        </footer>
      </Page>
    </div>
  );
}

export function AssessmentMemo({ data, app }: { data: Portfolio; app: Application }) {
  const t = useT();
  const lang = useLang();
  const title = t(`Memorando de evaluación · ${app.id}`, `Assessment memo · ${app.id}`);
  const sub = t(
    `${t(app.crop)} · ${t(app.zone)} · ${app.areaHa.toFixed(2)} ha · campaña ${app.campaign} · recibida ${date(app.receivedDate, "es")} · datos de ejemplo`,
    `${t(app.crop)} · ${t(app.zone)} · ${app.areaHa.toFixed(2)} ha · campaign ${app.campaign} · received ${date(app.receivedDate, "en")} · example data`,
  );
  const rec = app.recommendation === "aprobar" ? t("Aprobar", "Approve") : t("Rechazar", "Decline");
  return (
    <Page n={1} of={1} title={title} sub={sub}>
      <div className="mt-3 flex items-start gap-3">
        <div className="shrink-0 rounded border-2 border-bcp-ink px-2 py-1 text-center">
          <p className="lbl">{t("Recomendación", "Recommendation")}</p>
          <p className="font-[Arial,Helvetica,sans-serif] text-[13px] font-bold uppercase">{rec}</p>
        </div>
        <div>
          <p className="text-[13px] font-medium">{t(app.summary)}</p>
          <p className="lbl mt-0.5">{t(`Decidir antes del ${date(app.decisionDueDate, "es")}`, `Decide by ${date(app.decisionDueDate, "en")}`)}</p>
        </div>
      </div>

      <H>{t("1. Términos solicitados", "1. Requested terms")}</H>
      <div className="grid grid-cols-2 items-start gap-6">
        <KV
          rows={[
            [t("Monto solicitado", "Amount requested"), usd(app.requestedUsd)],
            [t("Plazo", "Tenor"), `${app.tenorDays} ${t("días", "days")}`],
            [t("Saldo al vencimiento", "Due at maturity"), usd(app.dueAtMaturityUsd)],
          ]}
        />
        <T
          head={[t("Tramo", "Tranche"), "USD", t("Hito", "Milestone")]}
          right={[1]}
          rows={app.tranches.map((x) => [`${x.id} · ${x.pct}%`, usd(x.amountUsd).slice(4), t(x.milestone)])}
        />
      </div>

      <H>{t("2. Evaluación de riesgo", "2. Risk assessment")}</H>
      <div className="grid grid-cols-2 items-start gap-6">
        <KV
          rows={[
            [t("Cobertura de repago", "Repayment coverage"), app.coverage === null ? t("no medible (veto)", "not measurable (veto)") : cov(app.coverage)],
            ...(app.coverage === null ? [] : stressCases(app.coverage).map((s) => [t(s.label), cov(s.coverage)] as [string, string])),
            [t("Precio de equilibrio", "Break-even price"), app.breakEvenPriceUsdKg === null ? t("n/d", "n/a") : `USD ${app.breakEvenPriceUsdKg.toFixed(2)}/kg`],
            [t("Precio esperado a cosecha", "Expected harvest price"), `USD ${app.expectedPriceUsdKg.toFixed(2)}/kg`],
          ]}
        />
        <KV
          rows={[
            [t("Score", "Score"), `${app.score} · ${t("tramo", "tier")} ${app.tier}`],
            [t("Veto", "Veto"), app.veto ? t("Sí", "Yes") : t("No", "No")],
            [t("Pérdida esperada", "Expected loss"), t("por calibrar", "to be calibrated")],
          ]}
        />
      </div>
      <T
        head={[t("Dimensión", "Dimension"), t("Peso", "Weight"), t("Puntos", "Points"), t("Motivo", "Reason")]}
        right={[1, 2]}
        rows={app.scoreDims.map((d) => [t(d.dim), pct(d.weight * 100), d.today, d.why ? t(d.why) : ""])}
      />

      <H>{t("3. Fundamentos de la recomendación", "3. Basis for the recommendation")}</H>
      <ul className="list-disc space-y-0.5 pl-4">{app.reasons.map((r, i) => <li key={i}>{t(r)}</li>)}</ul>

      <H>{t("4. Verificaciones", "4. Checks")}</H>
      <T
        head={[t("Verificación", "Check"), t("Resultado", "Result"), t("Estado", "State"), t("Efecto", "Effect"), t("Fuente", "Source")]}
        nowrap={[2]}
        rows={app.checks.map((c) => [<span key="l" className={c.state !== "verde" ? "font-bold" : ""}>{t(c.label)}</span>, t(c.value), stateWord(c.state, lang), t(c.effect), <span key="s" className="text-bcp-muted">{t(c.source)}</span>])}
      />

      <footer className="absolute bottom-10 left-14 right-14 border-t border-bcp-border pt-1.5">
        <p className="lbl">{t("Decisión del comité:", "Committee decision:")} ☐ {t("Aprobar", "Approve")} &nbsp; ☐ {t("Rechazar", "Decline")} &nbsp; ☐ {t("Pedir información", "Request information")}</p>
        <p className="lbl mt-1">{t(`La decisión es discrecional del banco. Motor ${data.engineVersion}.`, `The decision is at the bank's discretion. Engine ${data.engineVersion}.`)}</p>
        <Signatures left={t("Analista de riesgos TruMarket", "TruMarket risk analyst")} right={t("BCP Riesgos", "BCP Risk")} when={t(`Emitido el ${date(data.cutoff, "es")}`, `Issued on ${date(data.cutoff, "en")}`)} />
      </footer>
    </Page>
  );
}
