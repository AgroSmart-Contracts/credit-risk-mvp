/**
 * Expediente: the situation, then one tab per kind of data (summary, risk, use of
 * funds, decisions and history, and evidence in the internal edition).
 */
import { useMemo, useState, type ReactNode } from "react";
import { GEO, technicalSeries } from "../../data/bcp/technical";
import { FieldImages } from "./FieldImages";
import { TechChart } from "./TechCharts";
import { ScoreBreakdown, StressGrid } from "./ScoreStress";
import { CoverageBuild, DriverBridge } from "./CoverageBuild";
import { RepaymentCard } from "./Repayment";
import { COVERAGE_BANDS, cov, date, daysBetween, fundsTotals, haLabel, pct, provision, stateCause, toDisburse, usd, withDate } from "../../lib/bcp/calc";
import { BANK_EDITION } from "./edition";
import type { Condition, Loan, Portfolio } from "../../lib/bcp/types";
import { CoverageChart } from "./CoverageChart";
import { decisionKey, type Answer } from "./answers";
import { DecisionBlock } from "./Decision";
import { Btn, Card, CheckIcon, Chip, Lbl, LockedBtn, PageTabs, PilotLocked, Prov, Rich, SectionTitle, StateChip } from "./ui";
import { PILOT_NOTE } from "./nav";
import { STATE_TEXT, sourceTx, useEvidence, useLang, useT } from "./shared";

const GROUPS: Condition["group"][] = ["Prestatario", "Cultivo y volumen", "Precio y calidad", "Uso de fondos y cobranza"];
const GROUP_EN: Record<Condition["group"], string> = {
  Prestatario: "Borrower",
  "Cultivo y volumen": "Crop and volume",
  "Precio y calidad": "Price and quality",
  "Uso de fondos y cobranza": "Use of funds and collection",
};

function csvOf(loan: Loan, lang: "es" | "en") {
  const head = lang === "es" ? ["Fecha", "Evento", "Responsable", "Regla o gatillo", "Evidencia", "Versión del motor"] : ["Date", "Event", "Responsible", "Rule or trigger", "Evidence", "Engine version"];
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  return [head, ...loan.auditLog.map((a) => [a.date, a.event[lang], a.responsible[lang], a.rule[lang], a.evidence[lang], a.engineVersion])].map((r) => r.map(q).join(",")).join("\n");
}

export function LoanFile({ loan, data, onBack, onMap, onMemo, answers, onAnswer }: { loan: Loan; data: Portfolio; onBack: () => void; onMap: () => void; onMemo: () => void; answers: Record<string, Answer>; onAnswer: (k: string, a: Answer) => void }) {
  const t = useT();
  const lang = useLang();
  const [fundsIdx, setFundsIdx] = useState(loan.useOfFunds.length - 1);
  const [tab, setTab] = useState<"campo" | "docs" | "tecnicos">("campo");
  // Technical history: one click away from a condition row, all of it under "Datos técnicos".
  const series = useMemo(() => technicalSeries(loan, data.cutoff), [loan, data.cutoff]);
  const openEvidence = useEvidence();
  const geo = GEO[loan.id];
  const [page, setPage] = useState<"resumen" | "riesgo" | "fondos" | "historial" | "evidencia">("resumen");
  const [allConds, setAllConds] = useState(false);
  const matters = (c: Condition) => c.state !== "verde" || c.effectOnRepayment.es !== "Ninguno";
  const keyConds = loan.conditions.filter(matters);
  const shownConds = allConds ? loan.conditions : keyConds;
  const daysLeft = daysBetween(data.cutoff, loan.maturityDate);
  const released = loan.tranches.filter((x) => x.status === "liberado").reduce((s, x) => s + x.pct, 0);
  const bankDecision = loan.decisions.find((d) => d.lane === "bank" && !d.conformityDate);
  const tmDecisions = loan.decisions.filter((d) => d.lane === "tm_contract");
  const funds = loan.useOfFunds[fundsIdx];
  const ft = funds ? fundsTotals(funds.lines) : null;

  const exportCsv = () => {
    const blob = new Blob([csvOf(loan, lang)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${loan.id}-registro.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <header className="space-y-2">
        <button type="button" onClick={onBack} className="min-h-[44px] text-sm font-semibold text-bcp-ink hover:underline print:hidden">
          ← {t("Cartera", "Portfolio")}
        </button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-bold leading-tight">
              {t("Cliente", "Client")} {loan.id} · {t(loan.crop)}
            </h1>
            <p className="text-sm text-bcp-muted">
              {t(loan.zone)} · {haLabel(loan.areaHa)} {t("ha medidas", "ha measured")} · {t("campaña", "campaign")} {loan.campaign} · {t("día", "day")} {loan.dayOfCycle} {t("de", "of")} {loan.cycleDays}
            </p>
            {/* Freshness without animation: the last reading and the next one expected. */}
            <p className="lbl mt-0.5">
              {t("Próximo hito", "Next milestone")}: {withDate(t(loan.next.label), loan.next.date, lang)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Btn onClick={onMemo}>{t("Memorando de crédito (PDF)", "Credit memo (PDF)")}</Btn>
            {!BANK_EDITION && <Btn onClick={exportCsv}>{t("Exportar registro (CSV)", "Export log (CSV)")}</Btn>}
            {BANK_EDITION ? <LockedBtn note={t(PILOT_NOTE)}>{t("Ver en el mapa", "View on the map")}</LockedBtn> : <Btn onClick={onMap}>{t("Ver en el mapa", "View on the map")}</Btn>}
          </div>
        </div>
      </header>

      <PageTabs
        label={t("Secciones del expediente", "File sections")}
        value={page}
        onChange={setPage}
        tabs={[
          { id: "resumen", label: t("Resumen", "Summary") },
          { id: "riesgo", label: t("Riesgo", "Risk") },
          { id: "fondos", label: t("Uso de fondos", "Use of funds") },
          { id: "historial", label: t("Decisiones e historial", "Decisions and history") },
          // Field evidence and satellite images open with the pilot.
          { id: "evidencia" as const, label: t("Evidencia", "Evidence"), pilot: BANK_EDITION },
        ]}
      />

      {page === "resumen" && <>
      <FileSummary loan={loan} />
      <RepaymentCard
        input={loan}
        cutoff={data.cutoff}
        approval={loan.coverageAtApproval}
        low={loan.projection?.low}
        high={loan.projection?.high}
        lowHighLabel={loan.controlsState !== "verde" ? t("Si no se remedia", "If not remedied") : undefined}
        areaHa={BANK_EDITION ? undefined : loan.areaHa}
        yieldTHa={BANK_EDITION ? undefined : loan.yieldTHa}
        controls={loan.controlsState}
        drivers={{
          volume: loan.conditions.filter((c) => c.group === "Cultivo y volumen").map((c) => ({ label: t(c.label), value: t(c.today), effect: t(c.effectOnRepayment), state: c.state, provenance: c.provenance, source: t(sourceTx(c)) })),
          price: loan.conditions.filter((c) => c.group === "Precio y calidad").map((c) => ({ label: t(c.label), value: t(c.today), effect: t(c.effectOnRepayment), state: c.state, provenance: c.provenance, source: t(sourceTx(c)) })),
        }}
        onCalc={() => { setPage("riesgo"); requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" })); }}
      />
      <Card>
        <h3 className="text-[16px] font-bold">{t("Situación", "Situation")}</h3>
        {/* What happened and what is needed: coverage and exposure are already in the summary above. */}
        <ul className="mt-2 space-y-1.5 text-[15px]">
          {[loan.situation[0], loan.situation[loan.situation.length - 1]].map((s, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-bcp-fill-strong" />
              <span>
                <Rich text={t(s)} />
              </span>
            </li>
          ))}
        </ul>
      </Card>
      {bankDecision && <DecisionBlock loan={loan} decision={bankDecision} cutoff={data.cutoff} answer={answers[decisionKey(loan, bankDecision)]} onAnswer={(a) => onAnswer(decisionKey(loan, bankDecision), a)} />}
      <section>
        <SectionTitle title={t("Posición financiera", "Financial position")} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { k: t("Línea aprobada", "Approved line"), v: usd(loan.lineUsd), s: t(`${loan.cycleDays} días · 3 tramos`, `${loan.cycleDays} days · 3 tranches`), kind: "line" as const },
            { k: t("Desembolsado", "Disbursed"), v: usd(loan.disbursedUsd), s: t(`${loan.tranches.filter((x) => x.status === "liberado").length} de ${loan.tranches.length} tramos`, `${loan.tranches.filter((x) => x.status === "liberado").length} of ${loan.tranches.length} tranches`), kind: "disbursed" as const },
            { k: loan.frozenUsd ? t("Congelado", "Frozen") : t("Por desembolsar", "Undrawn"), v: usd(loan.frozenUsd || toDisburse(loan)), s: loan.frozenUsd ? t(`por desembolsar ${usd(toDisburse(loan))}`, `undrawn ${usd(toDisburse(loan))}`) : t("contra hitos verificados", "against verified milestones"), kind: "undrawn" as const },
            { k: t("Vence", "Maturity"), v: date(loan.maturityDate, lang), s: t(`${daysLeft} días`, `${daysLeft} days`), kind: "maturity" as const },
          ].map((c) => (
            <div key={c.k} className="rounded-xl border border-bcp-border bg-white p-4 sm:p-5">
              <Lbl>{c.k}</Lbl>
              <p className="num text-[22px] font-bold">{c.v}</p>
              {c.s && <p className="text-sm text-bcp-muted">{c.s}</p>}
            </div>
          ))}
        </div>

        <Card className="mt-3">
          <h3 className="text-[16px] font-bold">{t("Tramos", "Tranches")}</h3>
          <div role="img" aria-label={t(`${released}% de la línea desembolsada`, `${released}% of the line disbursed`)} className="mt-3 h-1.5 overflow-hidden rounded-full bg-bcp-fill">
            <span className="block h-full bg-bcp-ink" style={{ width: `${released}%` }} />
          </div>
          {/* One column per tranche, so the row is always full (every line has three). */}
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {loan.tranches.map((tr) => {
              const top = tr.status === "congelado" ? "border-t-bcp-naranja" : tr.checklist.some((c) => c.status === "warn") ? "border-t-bcp-ambar" : tr.status === "liberado" ? "border-t-bcp-green" : "border-t-bcp-border";
              const chip =
                tr.status === "liberado" ? <Chip tone="green">{t(`Liberado ${date(tr.milestoneDate, "es", false)}`, `Released ${date(tr.milestoneDate, "en", false)}`)}</Chip>
                : tr.status === "congelado" ? <Chip tone="naranja">{t("Congelado", "Frozen")}</Chip>
                : tr.status === "pendiente" ? <Chip tone="ambar">{t(`Hito ${date(tr.milestoneDate, "es", false)}`, `Milestone ${date(tr.milestoneDate, "en", false)}`)}</Chip>
                : <Chip>{t(`Previsto ${date(tr.milestoneDate, "es", false)}`, `Planned ${date(tr.milestoneDate, "en", false)}`)}</Chip>;
              return (
                <div key={tr.id} className={`rounded-lg border border-bcp-border border-t-4 p-3 ${top}`}>
                  <p className="lbl">
                    {tr.id} · {tr.pct}%
                  </p>
                  <p className="num text-[20px] font-bold">
                    {usd(tr.amountUsd)}
                    {tr.status === "pendiente" && <span className="ml-1 text-xs font-normal text-bcp-muted">{t("máximo", "maximum")}</span>}
                  </p>
                  <div className="my-1.5">{chip}</div>
                  <ul className="space-y-1 text-sm">
                    {tr.checklist.map((c, i) => (
                      <li key={i} className="flex gap-1.5">
                        <CheckIcon status={c.status} />
                        <span>{t(c.label)}</span>
                      </li>
                    ))}
                  </ul>
                  {tr.bankConformityDate && <p className="lbl mt-2">{t(`Conformidad del banco ${date(tr.bankConformityDate, "es", false)}`, `Bank sign-off ${date(tr.bankConformityDate, "en", false)}`)}</p>}
                  {tr.note && <p className="lbl mt-2">{t(tr.note)}</p>}
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      </>}

      {page === "riesgo" && <>
      <section>
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
          <Card>
            <h3 className="text-[16px] font-bold">{t("Cobertura de repago en el tiempo", "Repayment coverage over time")}</h3>
            <Lbl>{t("ingreso neto de cosecha ÷ saldo al vencimiento", "net harvest revenue ÷ amount due at maturity")}</Lbl>
            <div className="mt-2">
              <CoverageChart loan={loan} cutoff={data.cutoff} />
            </div>
            <p className="lbl mt-2">{t("Línea sólida: confirmado · línea punteada: estimado", "Solid line: confirmed · dotted line: estimated")}</p>
          </Card>
          <Card>
<dl className="divide-y divide-bcp-divider text-sm">
              {[
                [t("Precio de equilibrio", "Break-even price"), `USD ${loan.breakEvenPriceUsdKg.toFixed(2)}/kg`],
                [t("Precio esperado a cosecha", "Expected harvest price"), `USD ${loan.expectedPriceUsdKg.toFixed(2)}/kg`],
                [t("Clasificación SBS", "SBS rating"), loan.sbsRating],
                [t("Provisión requerida", "Required provision"), usd(provision(loan))],
                // The score is internal: unexplained to the bank and not what sets the state.
                ...(BANK_EDITION ? [] : [["Score", t(`${loan.scoreAtApproval} → ${loan.scoreToday} · tier aprobado ${loan.approvedTier}`, `${loan.scoreAtApproval} → ${loan.scoreToday} · approved tier ${loan.approvedTier}`)]]),
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 py-1.5">
                  <dt className="lbl">{k}</dt>
                  <dd className="num text-right font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            {!BANK_EDITION && <p className="lbl mt-3">{t("El tier aprobado solo cambia con revisión humana registrada.", "The approved tier only changes with a recorded human review.")}</p>}
          </Card>
        </div>
      </section>

      <Card>
        <h3 className="text-[16px] font-bold">{t(`Qué movió la cobertura: ${cov(loan.coverageAtApproval)} a la aprobación → ${cov(loan.coverageToday)} hoy`, `What moved coverage: ${cov(loan.coverageAtApproval)} at approval → ${cov(loan.coverageToday)} today`)}</h3>
        <div className="mt-2"><DriverBridge loan={loan} /></div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2 [&>*]:min-w-0">
        <Card><CoverageBuild input={loan} areaHa={loan.areaHa} yieldTHa={loan.yieldTHa} /></Card>
        <Card><StressGrid input={loan} state={loan.state} /></Card>
      </div>

      {/* El Niño is one series for the whole portfolio: its chart is on the portfolio's risk tab; here it is one row of the conditions. */}
      {!BANK_EDITION && (
        <div className="grid gap-3 lg:grid-cols-2 [&>*]:min-w-0">
          <Card><ScoreBreakdown dims={loan.scoreDims} scores={{ approval: loan.scoreAtApproval, today: loan.scoreToday }} /></Card>
        </div>
      )}

      <SectionTitle title={t("Cambios desde la aprobación", "Changes since approval")} />
      <Card>
        {!BANK_EDITION && <p className="mb-2 text-sm text-bcp-ink">
          {allConds
            ? t(`Las ${loan.conditions.length} condiciones del expediente.`, `All ${loan.conditions.length} conditions on the file.`)
            : t(
                `Se muestran las ${keyConds.length} que afectan el repago. Las otras ${loan.conditions.length - keyConds.length} están en orden y sin efecto.`,
                `Showing the ${keyConds.length} that affect repayment. The other ${loan.conditions.length - keyConds.length} are in order with no effect.`,
              )}
        </p>}
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-bcp-border text-left">
                {[t("Condición", "Condition"), t("Aprobación", "Approval"), t("Hoy", "Today"), ...(BANK_EDITION ? [] : [t("Umbral", "Threshold")]), t("Estado", "State"), t("Efecto en el repago", "Effect on repayment"), t("Fuente y fecha", "Source and date"), ""].map((h) => (
                  <Lbl key={h} as="th" className="py-2 pr-3 font-normal">
                    {h}
                  </Lbl>
                ))}
              </tr>
            </thead>
            {GROUPS.filter((g) => shownConds.some((c) => c.group === g)).map((g) => (
              <tbody key={g} className="divide-y divide-bcp-divider">
                <tr>
                  <td colSpan={8} className="bg-bcp-bg px-2 py-1.5 font-[Arial,Helvetica,sans-serif] text-[12px] font-bold text-bcp-ink">
                    {lang === "es" ? g : GROUP_EN[g]}
                  </td>
                </tr>
                {shownConds
                  .filter((c) => c.group === g)
                  .map((c, i) => (
                    <tr key={i} className="align-top">
                      <td className="py-2 pr-3 font-semibold">{t(c.label)}</td>
                      <td className="py-2 pr-3 text-bcp-muted">{t(c.atApproval)}</td>
                      <td className="py-2 pr-3">{t(c.today)}</td>
                      {!BANK_EDITION && <td className="py-2 pr-3 text-bcp-muted">{t(c.threshold)}</td>}
                      <td className="py-2 pr-3"><StateChip state={c.state} /></td>
                      <td className={`py-2 pr-3 ${c.state === "verde" ? "text-bcp-muted" : "font-semibold"}`}>{t(c.effectOnRepayment)}</td>
                      <td className="py-2 pr-3">
                        <Prov p={c.provenance} />
                        <span className="lbl block">{t(sourceTx(c))}</span>
                      </td>
                      {!BANK_EDITION && <td className="py-2 pr-1 text-right">
                        <button type="button" onClick={() => openEvidence(loan.id, c.label.es)} className="min-h-[36px] whitespace-nowrap text-xs font-semibold text-bcp-green-text underline-offset-2 hover:underline print:hidden">
                          {t("Evidencia", "Evidence")} ›
                        </button>
                      </td>}
                    </tr>
                  ))}
              </tbody>
            ))}
          </table>
        </div>
        {!BANK_EDITION && <button type="button" onClick={() => setAllConds((v) => !v)} aria-expanded={allConds} className="mt-2 min-h-[44px] text-sm font-semibold text-bcp-green-text hover:underline print:hidden">
          {allConds ? t("Mostrar solo lo que afecta el repago", "Show only what affects repayment") : t(`Ver las ${loan.conditions.length} condiciones`, `View all ${loan.conditions.length} conditions`)}
        </button>}
      </Card>

      </>}

      {page === "fondos" && <>
      {funds && ft && (
        <>
        <SectionTitle title={`${t("Uso de fondos", "Use of funds")} · ${funds.tranche}`}
            right={
              loan.useOfFunds.length > 1 ? (
                <div role="tablist" className="flex gap-1">
                  {loan.useOfFunds.map((u, i) => (
                    <button key={u.tranche} type="button" role="tab" aria-selected={i === fundsIdx} onClick={() => setFundsIdx(i)} className={`min-h-[36px] rounded-md border px-3 text-sm font-semibold ${i === fundsIdx ? "border-bcp-ink bg-bcp-ink text-white" : "border-bcp-border"}`}>
                      {u.tranche}
                    </button>
                  ))}
                </div>
              ) : undefined
            }
          />
        <Card>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5 lg:mx-0 lg:px-0">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b border-bcp-border">
                    {[t("Partida", "Item"), t("Presupuesto", "Budget"), t("Facturas conciliadas", "Reconciled invoices"), t("Pago directo (% del presupuesto)", "Direct pay (% of budget)"), t("Concuerda con el campo", "Matches the field")].map((h, i) => (
                      <Lbl key={h} as="th" className={`py-2 pr-3 font-normal ${i > 0 && i < 4 ? "text-right" : "text-left"}`}>
                        {h}
                      </Lbl>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-bcp-divider">
                  {funds.lines.map((x, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-3">{t(x.item)}</td>
                      <td className="py-2 pr-3 text-right">{usd(x.budgetUsd)}</td>
                      <td className="py-2 pr-3 text-right">{usd(x.reconciledUsd)}</td>
                      <td className="py-2 pr-3 text-right">{pct(x.budgetUsd ? (x.directPayUsd / x.budgetUsd) * 100 : 0)}</td>
                      <td className="py-2 pr-3">{t(x.fieldMatch)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-bcp-ink font-bold">
                    <td className="py-2 pr-3">Total</td>
                    <td className="py-2 pr-3 text-right">{usd(ft.budget)}</td>
                    <td className="py-2 pr-3 text-right">{usd(ft.reconciled)}</td>
                    <td className="py-2 pr-3 text-right">{pct(ft.directPct)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="rounded-lg bg-bcp-bg p-4">
              <Lbl>{t(`Conciliado · ${funds.tranche}`, `Reconciled · ${funds.tranche}`)}</Lbl>
              <p className="num text-[36px] font-bold leading-tight">{pct(ft.reconciledPct)}</p>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between"><dt>{t(`Sin sustento · ${funds.tranche}`, `Unexplained · ${funds.tranche}`)}</dt><dd className="num font-semibold">{usd(ft.unexplained)}</dd></div>
                <div className="flex justify-between"><dt>{t("Pagado directo a proveedores", "Paid directly to suppliers")}</dt><dd className="num font-semibold">{pct(ft.directPct)}</dd></div>
                <div className="flex justify-between"><dt>{t("Retirado en efectivo", "Withdrawn in cash")}</dt><dd className="num font-semibold">{usd(funds.cashWithdrawnUsd)}</dd></div>
              </dl>
              <p className="mt-3 text-sm font-semibold">{t(`Tres fuentes deben concordar antes del siguiente tramo`, `Three sources must agree before the next tranche`)}</p>
              <ul className="mt-1 space-y-1 text-sm">
                <li className="flex gap-1.5"><CheckIcon status={funds.threeSources.facturas ? "ok" : "fail"} />{t("Facturas", "Invoices")}</li>
                <li className="flex gap-1.5"><CheckIcon status={funds.threeSources.satelite ? "ok" : "fail"} />{t("Satélite: labores visibles", "Satellite: field work visible")}</li>
                <li className="flex gap-1.5"><CheckIcon status={funds.threeSources.aforo === "ok" ? "ok" : funds.threeSources.aforo === "fail" ? "fail" : "pending"} />{t(`Aforo en campo · ${date(funds.threeSources.aforoDate, "es", false)}`, `Field estimate · ${date(funds.threeSources.aforoDate, "en", false)}`)}</li>
              </ul>
              {!BANK_EDITION && <p className="lbl mt-3">{t("Brecha de facturas frente al presupuesto de la fase: 15% riesgo medio, 30% riesgo elevado.", "Invoice gap vs phase budget: 15% medium risk, 30% elevated risk.")}</p>}
            </div>
          </div>
        </Card>
        </>
      )}

      </>}

      {page === "historial" && (
        <Card>
          <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-bcp-border text-left">
                  {[t("Fecha", "Date"), t("Decisión o evento", "Decision or event"), t("Base", "Basis"), t("Responsable", "Responsible"), t("Evidencia", "Evidence")].map((h) => (
                    <Lbl key={h} as="th" className="py-2 pr-3 font-normal">
                      {h}
                    </Lbl>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-bcp-divider">
                {[...loan.auditLog].sort((x, y) => y.date.localeCompare(x.date)).map((a, i) => {
                  const decision = tmDecisions.find((d) => d.date === a.date);
                  return (
                    <tr key={i} className="align-top">
                      <td className="whitespace-nowrap py-2.5 pr-3">{date(a.date, lang)}</td>
                      <td className="py-2.5 pr-3 font-semibold">{t(a.event)}</td>
                      <td className="py-2.5 pr-3 text-bcp-muted">{t(decision?.basis ?? a.rule)}</td>
                      <td className="py-2.5 pr-3">{t(a.responsible)}</td>
                      <td className="py-2.5 pr-3">{t(a.evidence)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {BANK_EDITION && page === "evidencia" && (
        <PilotLocked
          title={t("Evidencia del expediente: disponible en el piloto", "File evidence: available in the pilot")}
          note={t("Fotos georreferenciadas de las visitas, imágenes satelitales del predio, laboratorio de suelo y agua, facturas y documentos firmados. Se habilitan para los expedientes del piloto.", "Geotagged visit photos, satellite images of the parcel, soil and water lab results, invoices and signed documents. They open for pilot files.")}
        />
      )}
      {!BANK_EDITION && page === "evidencia" && <>
      <SectionTitle title={t("Evidencia", "Evidence")} />
      <Card>
        <div id="evidencia" className="scroll-mt-6">
          <div role="tablist" className="flex flex-wrap gap-1 border-b border-bcp-border">
            {(
              [
                ["campo", t("Campo y satélite", "Field and satellite")],
                ["docs", t("Documentos", "Documents")],
                ["tecnicos", t("Datos técnicos", "Technical data")],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`-mb-px min-h-[44px] border-b-2 px-3 text-sm font-semibold ${tab === id ? "border-bcp-ink text-bcp-ink" : "border-transparent text-bcp-muted hover:text-bcp-ink"}`}>
                {label}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="mt-3">
            {tab === "tecnicos" ? (
              <>
                <p className="lbl mb-3">
                  {t(
                    "Lecturas técnicas detrás del expediente. Historia real: temperatura y lluvia de Ica, El Niño costero (NOAA, clases de ENFEN) y precios de exportación de palta Hass (aduanas). Vigor y agua: series de ejemplo calibradas a los valores del expediente.",
                    "Technical readings behind the file. Real history: Ica temperature and rain, coastal El Niño (NOAA, ENFEN classes) and Hass avocado export prices (customs). Vigour and water: example series calibrated to the file's values.",
                  )}
                </p>
                <div className="grid gap-3 lg:grid-cols-2">
                  {(["vigor", "clima", "agua", "enso", "precio"] as const).map((id) => (
                    <TechChart key={id} id={id} s={series} loan={loan} cutoff={data.cutoff} />
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                {tab === "campo" && geo?.parcelId && geo.ring && (
                  <div className="rounded-lg border border-bcp-border p-3">
                    <p className="mb-2 text-[15px] font-bold">{t("Imagen del predio", "Parcel image")}</p>
                    <FieldImages parcelId={geo.parcelId} ring={geo.ring} cutoff={data.cutoff} />
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-3">
                  {(tab === "campo"
                    ? [
                        t("Informe de visita, Formato JRA-AGRIND y memorando de evaluación", "Visit report, JRA-AGRIND form and assessment memo"),
                        t("Fotos georreferenciadas y laboratorio de suelo y agua", "Geotagged photos and soil and water lab results"),
                        geo?.parcelId || BANK_EDITION ? t("Histórico de cosechas verificado", "Verified harvest history") : t("Imagen del predio e histórico de cosechas verificado", "Parcel image and verified harvest history"),
                      ]
                    : [t("Instrumentos firmados e inscritos", "Signed and registered instruments"), t("Facturas electrónicas conciliadas", "Reconciled e-invoices"), t("Póliza de seguro agrícola y cesión de cobros", "Crop insurance policy and assignment of receivables")]
                  ).map((x) => (
                    <div key={x} className="rounded-lg border border-bcp-border p-3 text-sm">
                      {x}
                      <p className="lbl mt-1">{t(`Actualizado al ${date(data.cutoff, "es")}`, `Updated as of ${date(data.cutoff, "en")}`)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      </>}

    </div>
  );
}

/**
 * The file at a glance: the state and why (with both signals), what is exposed,
 * coverage today, and where coverage goes if nothing changes.
 */
function FileSummary({ loan }: { loan: Loan }) {
  const t = useT();
  const lang = useLang();
  const cause = stateCause(loan);
  const WHY = {
    control: t("Por un control del contrato", "On a contract control"),
    tecnica: t("Por una señal técnica", "On a technical signal"),
    cobertura: t("Por la cobertura", "On coverage"),
    none: t("Controles en orden", "Controls in order"),
  };
  const DOT: Record<string, string> = { verde: "bg-bcp-green", ambar: "bg-bcp-ambar", naranja: "bg-bcp-naranja", rojo: "bg-bcp-rojo", veto: "bg-bcp-rojo" };
  const TEXT: Record<string, string> = { verde: "text-bcp-green-text", ambar: "text-bcp-ambar-text", naranja: "text-bcp-naranja-text", rojo: "text-bcp-rojo-text", veto: "text-bcp-rojo-text" };
  const RULE: Record<string, string> = { verde: "border-l-bcp-green", ambar: "border-l-bcp-ambar", naranja: "border-l-bcp-naranja", rojo: "border-l-bcp-rojo", veto: "border-l-bcp-rojo" };
  const cells: { k: string; v: ReactNode; s: string }[] = [
    {
      k: t("Estado", "State"),
      v: (
        <span className={`flex items-center gap-2 ${TEXT[loan.state]}`}>
          <span aria-hidden className={`h-3 w-3 shrink-0 rounded-full ${DOT[loan.state]}`} />
          {t(STATE_TEXT[loan.state])}
        </span>
      ),
      s: `${WHY[cause ?? "none"]} · ${loan.coverageToday >= COVERAGE_BANDS.ambar ? t("cobertura sobre el umbral", "coverage above the threshold") : t("cobertura bajo el umbral", "coverage below the threshold")} · ${t("desde", "since")} ${date(loan.stateSince, lang, false)}`,
    },
    {
      k: t("Exposición hoy", "Exposure today"),
      v: usd(loan.disbursedUsd),
      s: loan.frozenUsd ? t(`máximo ${usd(loan.dueAtMaturityUsd)} si se libera el congelado`, `at most ${usd(loan.dueAtMaturityUsd)} if the frozen tranche is released`) : t(`máximo ${usd(loan.dueAtMaturityUsd)} con todos los tramos`, `at most ${usd(loan.dueAtMaturityUsd)} with every tranche`),
    },
  ];
  return (
    <section aria-label={t("Resumen del expediente", "File summary")} className={`grid gap-px overflow-hidden rounded-lg border border-l-4 border-bcp-border bg-bcp-border sm:grid-cols-2 ${RULE[loan.state]}`}>
      {cells.map((c) => (
        <div key={c.k} className="bg-white px-5 py-4">
          <p className="lbl">{c.k}</p>
          <div className="num mt-1 text-[22px] font-bold leading-tight text-bcp-ink">{c.v}</div>
          <p className="mt-1 text-[13px] text-bcp-muted">{c.s}</p>
        </div>
      ))}
    </section>
  );
}
