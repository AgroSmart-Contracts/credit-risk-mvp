/**
 * What stands behind each figure the bank sees: opened in the side drawer when a
 * tile, a ledger figure or a tranche is clicked. Every drawer starts with the
 * money point, then the per-loan breakdown, and its totals reconcile with the
 * figure that was clicked.
 */
import { bySeverity, cov, date, daysBetween, loanFunds, pct, portfolioFigures, provision, PROVISION_RATE, range, toDisburse, usd } from "../../lib/bcp/calc";
import type { Lang, Loan, Portfolio, Tranche, Tx } from "../../lib/bcp/types";
import type { DrawerContent } from "./shared";
import { CheckIcon, DrawerTable, ImpactBox, StateChip } from "./ui";

type T = (t: Tx | string, en?: string) => string;
const sorted = (d: Portfolio) => [...d.loans].sort(bySeverity);
const trancheStatus = (tr: Tranche, t: T) =>
  ({ liberado: t("Liberado", "Released"), pendiente: t("Pendiente", "Pending"), congelado: t("Congelado", "Frozen"), previsto: t("Previsto", "Planned") })[tr.status];

export function disbursedDetail(d: Portfolio, t: T, lang: Lang): DrawerContent {
  const F = portfolioFigures(d.loans);
  return {
    eyebrow: t("Posición de la cartera", "Portfolio position"),
    title: t("Desembolsado por préstamo", "Disbursed by loan"),
    sub: t(`corte ${date(d.cutoff, "es")}`, `cut-off ${date(d.cutoff, "en")}`),
    body: (
      <>
        <ImpactBox label={t("Capital vigente", "Outstanding principal")} value={`${usd(F.disbursed)} · ${pct((F.disbursed / F.line) * 100)} ${t("de la línea", "of the line")}`} note={t("Cada tramo salió contra su checklist verificado y la conformidad del banco.", "Every tranche went out against its verified checklist and the bank's conformity.")} />
        <DrawerTable
          head={[t("Préstamo", "Loan"), t("Línea", "Line"), t("Desembolsado", "Disbursed"), t("% línea", "% line"), t("Tramos liberados", "Tranches released")]}
          right={[1, 2, 3]}
          rows={sorted(d).map((l) => [
            <span key="l" className="font-semibold">{l.id}</span>,
            usd(l.lineUsd),
            usd(l.disbursedUsd),
            pct((l.disbursedUsd / l.lineUsd) * 100),
            l.tranches.filter((x) => x.status === "liberado").map((x) => `${x.id} ${date(x.milestoneDate, lang, false)}`).join(" · "),
          ])}
          foot={[t("Cartera", "Portfolio"), usd(F.line), usd(F.disbursed), pct((F.disbursed / F.line) * 100), ""]}
        />
      </>
    ),
  };
}

export function frozenDetail(d: Portfolio, t: T, lang: Lang): DrawerContent {
  const frozen = d.loans.filter((l) => l.frozenUsd > 0);
  const F = portfolioFigures(d.loans);
  return {
    eyebrow: t("Posición de la cartera", "Portfolio position"),
    title: t("Fondos congelados", "Frozen funds"),
    body: (
      <>
        <ImpactBox label={t("Congelado", "Frozen")} value={usd(F.frozen)} note={t("No se desembolsa hasta verificar la remediación. La exposición queda limitada a lo desembolsado.", "Not released until remediation is verified. Exposure stays limited to what was disbursed.")} />
        <DrawerTable
          head={[t("Préstamo", "Loan"), t("Tramo", "Tranche"), t("Monto", "Amount"), t("Desde", "Since"), t("Motivo y plan", "Reason and plan")]}
          right={[2]}
          rows={frozen.flatMap((l) => {
            const ex = d.exceptions.find((e) => e.loanId === l.id);
            return l.tranches
              .filter((x) => x.status === "congelado")
              .map((x) => [<span key="l" className="font-semibold">{l.id}</span>, x.id, usd(x.amountUsd), date(l.stateSince, lang, false), `${x.note ? t(x.note) : ""}${ex ? ` · ${t(ex.plan)}` : ""}`]);
          })}
        />
      </>
    ),
  };
}

export function undrawnDetail(d: Portfolio, t: T, lang: Lang): DrawerContent {
  const rows = sorted(d).flatMap((l) => l.tranches.filter((x) => x.status === "pendiente" || x.status === "previsto").map((x) => ({ l, x })));
  const total = rows.reduce((s, r) => s + r.x.amountUsd, 0);
  return {
    eyebrow: t("Posición de la cartera", "Portfolio position"),
    title: t("Por desembolsar contra hitos", "Undrawn, against milestones"),
    body: (
      <>
        <ImpactBox label={t("Compromiso no desembolsado", "Undrawn commitment")} value={usd(total)} note={t("Cada tramo se desembolsa solo con su checklist completo y la conformidad del banco. El tramo de cuajado se calcula sobre el volumen verificado.", "Each tranche is disbursed only with its checklist complete and the bank's conformity. The fruit-set tranche is sized on the verified volume.")} />
        <DrawerTable
          head={[t("Préstamo", "Loan"), t("Tramo", "Tranche"), t("Monto máx.", "Max amount"), t("Hito", "Milestone"), t("Checklist", "Checklist")]}
          right={[2]}
          rows={rows.map(({ l, x }) => [
            <span key="l" className="font-semibold">{l.id}</span>,
            `${x.id} · ${trancheStatus(x, t)}`,
            usd(x.amountUsd),
            date(x.milestoneDate, lang),
            `${x.checklist.filter((c) => c.status === "ok").length} ${t("de", "of")} ${x.checklist.length}`,
          ])}
          foot={[t("Total", "Total"), "", usd(total), "", ""]}
        />
      </>
    ),
  };
}

export function maturityDetail(d: Portfolio, t: T, lang: Lang): DrawerContent {
  const rows = [...d.loans].sort((a, b) => a.maturityDate.localeCompare(b.maturityDate));
  const principal = rows.reduce((s, l) => s + l.lineUsd - l.frozenUsd, 0);
  const due = rows.reduce((s, l) => s + l.dueAtMaturityUsd, 0);
  return {
    eyebrow: t("Posición de la cartera", "Portfolio position"),
    title: t("Vencimientos y repago", "Maturities and repayment"),
    body: (
      <>
        <ImpactBox
          label={t("Repago esperado", "Expected repayment")}
          value={t(`Capital ${usd(principal)} · saldo total ${usd(due)}`, `Principal ${usd(principal)} · total due ${usd(due)}`)}
          note={t("Repago único al vencimiento, desde los cobros del comprador a la cuenta de recaudo, antes que cualquier pago al productor. Aún no hay repagos: las cosechas empiezan en marzo.", "A single repayment at maturity, from the buyer's payments into the collection account, before any payment to the grower. No repayments yet: harvests start in March.")}
        />
        <DrawerTable
          head={[t("Préstamo", "Loan"), t("Vence", "Due"), t("Días", "Days"), t("Capital", "Principal"), t("Saldo al vencimiento", "Due at maturity")]}
          right={[2, 3, 4]}
          rows={rows.map((l) => [<span key="l" className="font-semibold">{l.id}</span>, date(l.maturityDate, lang), daysBetween(d.cutoff, l.maturityDate), usd(l.lineUsd - l.frozenUsd), usd(l.dueAtMaturityUsd)])}
          foot={[t("Cartera", "Portfolio"), "", "", usd(principal), usd(due)]}
        />
        <p className="lbl">{t("Capital = línea menos lo congelado. El saldo incluye el costo del banco. Si el congelado se libera, entra al capital del vencimiento.", "Principal = line less what is frozen. The amount due includes the bank's cost. If the frozen amount is released, it joins the principal due.")}</p>
      </>
    ),
  };
}

export function coverageDetail(d: Portfolio, t: T, lang: Lang): DrawerContent {
  const F = portfolioFigures(d.loans);
  return {
    eyebrow: t("Riesgo de la cartera", "Portfolio risk"),
    title: t("Cobertura de repago por préstamo", "Repayment coverage by loan"),
    body: (
      <>
        <ImpactBox label={t("Cobertura de la cartera", "Portfolio coverage")} value={`${cov(F.coverage)} · ${t("proyección", "projection")} ${range(d.projection.low, d.projection.high, lang)}`} note={t("Ingreso neto de cosecha ÷ saldo al vencimiento, ponderado por lo desembolsado. La proyección es estimada.", "Net harvest revenue ÷ amount due at maturity, weighted by what is disbursed. The projection is estimated.")} />
        <DrawerTable
          head={[t("Préstamo", "Loan"), t("Estado", "State"), t("Aprobación", "Approval"), t("Hoy", "Today"), t("Proyección", "Projection"), t("Peso", "Weight")]}
          right={[2, 3, 5]}
          rows={sorted(d).map((l) => [
            <span key="l" className="font-semibold">{l.id}</span>,
            <StateChip key="s" state={l.state} />,
            cov(l.coverageAtApproval),
            <b key="c">{cov(l.coverageToday)}</b>,
            l.projection ? range(l.projection.low, l.projection.high, lang) : t("sin cambio", "no change"),
            pct((l.disbursedUsd / F.disbursed) * 100),
          ])}
          foot={[t("Cartera", "Portfolio"), "", "", cov(F.coverage), range(d.projection.low, d.projection.high, lang), "100%"]}
        />
        <p className="lbl">{t("Umbrales propuestos: ámbar bajo 1.50x, naranja bajo 1.30x, rojo bajo 1.10x. Cobertura de repago no es cobertura de garantía ni de seguro.", "Proposed thresholds: amber below 1.50x, orange below 1.30x, red below 1.10x. Repayment coverage is not collateral or insurance cover.")}</p>
      </>
    ),
  };
}

export function provisionDetail(d: Portfolio, t: T): DrawerContent {
  const F = portfolioFigures(d.loans);
  return {
    eyebrow: t("Regulatorio", "Regulatory"),
    title: t("Provisión requerida (SBS)", "Required provision (SBS)"),
    body: (
      <>
        <ImpactBox label={t("Provisión requerida", "Required provision")} value={usd(F.provision)} note={t("Desembolsado × tasa por clasificación SBS del deudor, Res. SBS 11356-2008, sin garantía preferida.", "Disbursed × rate by the borrower's SBS rating, Res. SBS 11356-2008, no preferred guarantee.")} />
        <DrawerTable
          head={[t("Préstamo", "Loan"), t("Clasificación", "Rating"), t("Tasa", "Rate"), t("Desembolsado", "Disbursed"), t("Provisión", "Provision")]}
          right={[2, 3, 4]}
          rows={sorted(d).map((l) => [<span key="l" className="font-semibold">{l.id}</span>, l.sbsRating, pct(PROVISION_RATE[l.sbsRating] * 100), usd(l.disbursedUsd), usd(provision(l))])}
          foot={[t("Cartera", "Portfolio"), "", "", usd(F.disbursed), usd(F.provision)]}
        />
        <p className="lbl">{t("Pérdida esperada: por calibrar con BCP Riesgos.", "Expected loss: to be calibrated with BCP Risk.")}</p>
      </>
    ),
  };
}

export function fundsDetail(d: Portfolio, t: T, kind: "reconciled" | "direct"): DrawerContent {
  const F = portfolioFigures(d.loans);
  return {
    eyebrow: t("Control de fondos", "Control of funds"),
    title: kind === "reconciled" ? t("Facturas conciliadas por préstamo", "Reconciled invoices by loan") : t("Pago directo a proveedores por préstamo", "Direct payment to suppliers by loan"),
    body: (
      <>
        <ImpactBox
          label={kind === "reconciled" ? t("Conciliado", "Reconciled") : t("Pagado directo", "Paid direct")}
          value={kind === "reconciled" ? `${pct(F.reconciledPct)} · ${usd(F.unexplained)} ${t("sin sustento", "unexplained")}` : `${pct(F.directPct)} · ${usd(F.cash)} ${t("retirado en efectivo", "withdrawn in cash")}`}
          note={kind === "reconciled" ? t("Brecha de facturas vs presupuesto de la fase: 15% ámbar, 30% naranja.", "Invoice gap against the phase budget: 15% amber, 30% orange.") : t("TruMarket paga a los proveedores contra factura; la mano de obra se paga al productor con tope por fase.", "TruMarket pays suppliers against invoices; labour is paid to the grower, capped per phase.")}
        />
        <DrawerTable
          head={[t("Préstamo", "Loan"), t("Tramos", "Tranches"), t("Desembolsado", "Disbursed"), t("Conciliado", "Reconciled"), t("Sin sustento", "Unexplained"), t("Pago directo", "Direct pay")]}
          right={[2, 3, 4, 5]}
          rows={sorted(d).map((l) => {
            const f = loanFunds(l);
            return [<span key="l" className="font-semibold">{l.id}</span>, f.tranches.join(" + "), usd(f.budget), pct(f.reconciledPct), usd(f.unexplained), pct(f.directPct)];
          })}
          foot={[t("Cartera", "Portfolio"), "", usd(F.disbursed), pct(F.reconciledPct), usd(F.unexplained), pct(F.directPct)]}
        />
      </>
    ),
  };
}

export function tranchesReleasedDetail(d: Portfolio, t: T, lang: Lang): DrawerContent {
  const rows = sorted(d).flatMap((l) => l.tranches.filter((x) => x.status === "liberado").map((x) => ({ l, x })));
  return {
    eyebrow: t("Control de fondos", "Control of funds"),
    title: t("Tramos liberados", "Tranches released"),
    body: (
      <>
        <ImpactBox label={t("Con checklist completo y conformidad del banco", "With a complete checklist and the bank's conformity")} value={`${rows.filter((r) => r.x.bankConformityDate).length} ${t("de", "of")} ${rows.length}`} />
        <DrawerTable
          head={[t("Préstamo", "Loan"), t("Tramo", "Tranche"), t("Monto", "Amount"), t("Checklist", "Checklist"), t("Conformidad BCP", "BCP conformity"), t("Liberado", "Released")]}
          right={[2]}
          rows={rows.map(({ l, x }) => [
            <span key="l" className="font-semibold">{l.id}</span>,
            x.id,
            usd(x.amountUsd),
            `${x.checklist.filter((c) => c.status === "ok").length} ${t("de", "of")} ${x.checklist.length}`,
            x.bankConformityDate ? date(x.bankConformityDate, lang) : t("pendiente", "pending"),
            date(x.milestoneDate, lang),
          ])}
        />
      </>
    ),
  };
}

export function concentrationDetail(d: Portfolio, t: T): DrawerContent {
  const F = portfolioFigures(d.loans);
  const zones = new Map<string, number>();
  for (const l of d.loans) {
    const z = l.id.startsWith("PIS") ? "Pisco" : "Ica";
    zones.set(z, (zones.get(z) ?? 0) + l.lineUsd);
  }
  return {
    eyebrow: t("Riesgo de la cartera", "Portfolio risk"),
    title: t("Concentración", "Concentration"),
    body: (
      <>
        <ImpactBox label={t("Exposición correlacionada", "Correlated exposure")} value={t("Palta Hass 100% · Ica 81%", "Hass avocado 100% · Ica 81%")} note={t("Un mismo evento de clima o precio en Ica afecta a la mayor parte de la línea a la vez.", "A single weather or price event in Ica affects most of the line at once.")} />
        <DrawerTable
          head={[t("Zona", "Zone"), t("Línea", "Line"), t("% de la línea", "% of line")]}
          right={[1, 2]}
          rows={[...zones.entries()].map(([z, v]) => [z, usd(v), pct((v / F.line) * 100)])}
          foot={[t("Total", "Total"), usd(F.line), "100%"]}
        />
        <DrawerTable
          head={[t("Dimensión", "Dimension"), t("Concentración", "Concentration")]}
          rows={[
            [t("Cultivo", "Crop"), t("palta Hass 100%", "Hass avocado 100%")],
            [t("Packing principal", "Main packhouse"), t(`${d.mainPackhousePct}% de la línea`, `${d.mainPackhousePct}% of the line`)],
            [t("Deudores", "Borrowers"), t(`${d.loans.length}; mayor ${pct((Math.max(...d.loans.map((l) => l.lineUsd)) / F.line) * 100)} de la línea`, `${d.loans.length}; largest ${pct((Math.max(...d.loans.map((l) => l.lineUsd)) / F.line) * 100)} of the line`)],
          ]}
        />
      </>
    ),
  };
}

/** One tranche: what the operation verified (TruMarket) and what the bank authorised (BCP), kept apart. */
export function trancheDetail(loan: Loan, tr: Tranche, t: T, lang: Lang): DrawerContent {
  const ok = tr.checklist.filter((c) => c.status === "ok").length;
  const missing = tr.checklist.filter((c) => c.status !== "ok");
  const history = loan.auditLog.filter((a) => a.event.es.includes(tr.id) || a.rule.es.includes(tr.id));
  const decisions = loan.decisions.filter((x) => x.title.es.includes(tr.id));
  return {
    eyebrow: t("Tramo", "Tranche"),
    title: `${loan.id} · ${tr.id} · ${usd(tr.amountUsd)}`,
    sub: `${tr.pct}% ${t("de la línea", "of the line")} · ${trancheStatus(tr, t)} · ${t("hito", "milestone")} ${date(tr.milestoneDate, lang)}`,
    body: (
      <>
        <ImpactBox
          label={t("Fondos", "Funds")}
          value={tr.status === "liberado" ? t(`${usd(tr.amountUsd)} liberados`, `${usd(tr.amountUsd)} released`) : tr.status === "congelado" ? t(`${usd(tr.amountUsd)} retenidos`, `${usd(tr.amountUsd)} withheld`) : t(`${usd(tr.amountUsd)} por liberar`, `${usd(tr.amountUsd)} to be released`)}
          note={tr.note ? t(tr.note) : undefined}
        />
        <section>
          <h3 className="text-[15px] font-bold">{t("1. Verificación operativa · TruMarket", "1. Operational verification · TruMarket")}</h3>
          <p className="lbl mb-1">{t(`${ok} de ${tr.checklist.length} condiciones verificadas${missing.length ? ` · faltan ${missing.length}` : ""}`, `${ok} of ${tr.checklist.length} conditions verified${missing.length ? ` · ${missing.length} missing` : ""}`)}</p>
          <ul className="space-y-1.5 text-sm">
            {tr.checklist.map((c, i) => (
              <li key={i} className="flex gap-2">
                <CheckIcon status={c.status} />
                <span>{t(c.label)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="text-[15px] font-bold">{t("2. Autorización del banco · BCP", "2. Bank authorisation · BCP")}</h3>
          <p className="mt-1 text-sm">
            {tr.bankConformityDate
              ? t(`Conformidad del banco el ${date(tr.bankConformityDate, "es")}.`, `Bank conformity on ${date(tr.bankConformityDate, "en")}.`)
              : tr.status === "congelado"
                ? t("Sin conformidad: el tramo está congelado hasta verificar la remediación.", "No conformity: the tranche is frozen until remediation is verified.")
                : t("Pendiente: la conformidad se solicita cuando el checklist está completo.", "Pending: conformity is requested once the checklist is complete.")}
          </p>
          {decisions.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {decisions.map((x, i) => (
                <li key={i}>
                  <b>{date(x.date, lang)}</b> · {t(x.title)} · <span className="text-bcp-muted">{t(x.responsible)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3 className="text-[15px] font-bold">{t("3. Historial y evidencia", "3. History and evidence")}</h3>
          {history.length === 0 ? (
            <p className="mt-1 text-sm text-bcp-muted">{t("Sin movimientos registrados todavía.", "No recorded events yet.")}</p>
          ) : (
            <DrawerTable
              head={[t("Fecha", "Date"), t("Evento", "Event"), t("Responsable", "Responsible"), t("Evidencia", "Evidence")]}
              rows={history.map((a) => [date(a.date, lang, false), t(a.event), t(a.responsible), t(a.evidence)])}
            />
          )}
        </section>
      </>
    ),
  };
}

/** The loan's money figures, explained. */
export function loanMoneyDetail(loan: Loan, kind: "line" | "disbursed" | "undrawn" | "due" | "maturity", t: T, lang: Lang, cutoff: string): DrawerContent {
  const released = loan.tranches.filter((x) => x.status === "liberado");
  const rest = loan.tranches.filter((x) => x.status !== "liberado");
  const cost = loan.dueAtMaturityUsd - loan.lineUsd;
  const table = (list: Tranche[]) => (
    <DrawerTable
      head={[t("Tramo", "Tranche"), t("Monto", "Amount"), t("Estado", "Status"), t("Hito", "Milestone"), t("Conformidad", "Conformity")]}
      right={[1]}
      rows={list.map((x) => [`${x.id} · ${x.pct}%`, usd(x.amountUsd), trancheStatus(x, t), date(x.milestoneDate, lang), x.bankConformityDate ? date(x.bankConformityDate, lang) : t("pendiente", "pending")])}
      foot={[t("Total", "Total"), usd(list.reduce((s, x) => s + x.amountUsd, 0)), "", "", ""]}
    />
  );
  const base = { eyebrow: `${loan.id} · ${t("posición financiera", "financial position")}` };
  if (kind === "disbursed")
    return { ...base, title: t("Desembolsado", "Disbursed"), body: <><ImpactBox label={t("Capital vigente", "Outstanding principal")} value={usd(loan.disbursedUsd)} note={t("Cada tramo salió contra su checklist verificado y la conformidad del banco.", "Each tranche went out against its verified checklist and the bank's conformity.")} />{table(released)}</> };
  if (kind === "undrawn")
    return { ...base, title: loan.frozenUsd ? t("Congelado y por desembolsar", "Frozen and undrawn") : t("Por desembolsar", "Undrawn"), body: <><ImpactBox label={t("Aún no desembolsado", "Not yet disbursed")} value={usd(loan.frozenUsd + toDisburse(loan))} note={loan.frozenUsd ? t(`${usd(loan.frozenUsd)} congelados hasta verificar la remediación.`, `${usd(loan.frozenUsd)} frozen until remediation is verified.`) : t("Se desembolsa solo contra hitos verificados y la conformidad del banco.", "Disbursed only against verified milestones and the bank's conformity.")} />{table(rest)}</> };
  if (kind === "due")
    return {
      ...base,
      title: t("Saldo al vencimiento", "Due at maturity"),
      body: (
        <>
          <ImpactBox label={t("Saldo al vencimiento", "Due at maturity")} value={usd(loan.dueAtMaturityUsd)} note={t("Capital de la línea más el costo del banco por el plazo.", "The line's principal plus the bank's cost for the tenor.")} />
          <DrawerTable head={[t("Concepto", "Item"), t("USD", "USD")]} right={[1]} rows={[[t("Capital (línea aprobada)", "Principal (approved line)"), usd(loan.lineUsd)], [t("Costo del banco", "Bank cost"), usd(cost)]]} foot={[t("Saldo", "Due"), usd(loan.dueAtMaturityUsd)]} />
          <p className="lbl">{loan.frozenUsd ? t(`Si el tramo congelado no se libera, el capital adeudado baja a ${usd(loan.lineUsd - loan.frozenUsd)}.`, `If the frozen tranche is not released, principal due falls to ${usd(loan.lineUsd - loan.frozenUsd)}.`) : ""}</p>
        </>
      ),
    };
  if (kind === "maturity")
    return {
      ...base,
      title: t("Vencimiento y repago", "Maturity and repayment"),
      body: (
        <>
          <ImpactBox label={t("Vence", "Due")} value={`${date(loan.maturityDate, lang)} · ${daysBetween(cutoff, loan.maturityDate)} ${t("días", "days")}`} note={t("Repago único desde los cobros del comprador a la cuenta de recaudo, antes que cualquier pago al productor.", "A single repayment from the buyer's payments into the collection account, before any payment to the grower.")} />
          <DrawerTable
            head={[t("Concepto", "Item"), t("Valor", "Value")]}
            right={[1]}
            rows={[
              [t("Saldo al vencimiento", "Due at maturity"), usd(loan.dueAtMaturityUsd)],
              [t("Cobertura de repago hoy", "Repayment coverage today"), cov(loan.coverageToday)],
              [t("Proyección", "Projection"), loan.projection ? range(loan.projection.low, loan.projection.high, lang) : t("sin cambio", "no change")],
              [t("Día del ciclo", "Day of cycle"), `${loan.dayOfCycle} ${t("de", "of")} ${loan.cycleDays}`],
            ]}
          />
        </>
      ),
    };
  return { ...base, title: t("Línea aprobada", "Approved line"), body: <><ImpactBox label={t("Línea aprobada", "Approved line")} value={`${usd(loan.lineUsd)} · ${loan.cycleDays} ${t("días", "days")}`} note={t(`Tier aprobado ${loan.approvedTier} · aprobación ${date(loan.approvalDate, "es")}`, `Approved tier ${loan.approvedTier} · approval ${date(loan.approvalDate, "en")}`)} />{table(loan.tranches)}</> };
}
