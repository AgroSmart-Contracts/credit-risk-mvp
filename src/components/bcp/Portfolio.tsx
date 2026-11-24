/**
 * Cartera: the four headline figures, then one tab per kind of data
 * (summary, position and funds, risk, loans, applications).
 */
import { useCallback, useState } from "react";
import { bySeverity, cashCalendar, cov, date, month, pct, pendingDecisions, portfolioFigures, range, usd, withDate } from "../../lib/bcp/calc";
import type { Loan, Portfolio as P, State } from "../../lib/bcp/types";
import { ApplicationsTable } from "./Applications";
import { appKey, decisionKey, type Answer } from "./answers";
import { DecisionBlock } from "./Decision";
import { BANK_EDITION } from "./edition";
import { Btn, Card, Estimado, ExampleChip, Lbl, Modal, PageTabs, SectionTitle, StackBar, StateChip } from "./ui";
import { useEvidence, useLang, useT } from "./shared";

type PortfolioTab = "resumen" | "posicion" | "riesgo" | "prestamos" | "solicitudes";
/** Survives opening a file, so Back returns to the same tab. */
let lastTab: PortfolioTab = "resumen";

export function Portfolio({ data, onOpen, onOpenApp, onReport, onDecisions, answers, onAnswer }: { data: P; onOpen: (id: string) => void; onOpenApp: (id: string) => void; onReport: () => void; onDecisions: () => void; answers: Record<string, Answer>; onAnswer: (k: string, a: Answer) => void }) {
  const t = useT();
  const lang = useLang();
  const F = portfolioFigures(data.loans);
  const pending = pendingDecisions(data.loans, data.cutoff);
  const [page, setPageState] = useState<PortfolioTab>(lastTab);
  const setPage = (tab: PortfolioTab) => {
    lastTab = tab;
    setPageState(tab);
  };
  const openEvidence = useEvidence();
  // Clicking a state in "exposure by state" filters the loans table.
  const [stateFilter, setStateFilter] = useState<State | null>(null);
  const [causeOf, setCauseOf] = useState<P["changes"][number] | null>(null);
  const closeCause = useCallback(() => setCauseOf(null), []);
  const [season, setSeason] = useState(false);
  const appsOpen = data.applications.filter((a) => !answers[appKey(a)]);
  const openConformities = pending.filter((p) => !answers[decisionKey(p.loan, p.decision)]).length;
  const loanChanges = data.changes.filter((c) => c.loanId);
  const toNaranja = loanChanges.filter((c) => c.to === "naranja").length;
  const toAmbar = loanChanges.filter((c) => c.to === "ambar").length;
  const ica = data.loans.filter((l) => l.id.startsWith("ICA")).reduce((s, l) => s + l.lineUsd, 0);
  const frozenLoan = data.loans.find((l) => l.frozenUsd > 0);
  const sevenOfSeven = `${F.tranchesWithConformity} ${t("de", "of")} ${F.tranchesReleased}`;

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <ExampleChip kind="portfolio" />
          <p className="text-sm text-bcp-muted">
            {t("Palta Hass · Ica y Pisco", "Hass avocado · Ica and Pisco")}
          </p>
        </div>
        <Btn onClick={onReport}>{t("Descargar reporte mensual (PDF)", "Download monthly report (PDF)")}</Btn>
      </header>

      {/* Headline figures: same structure in every tile, so labels, values and notes line up. */}
      <section aria-label={t("Situación de la cartera", "Portfolio situation")} className="grid gap-px overflow-hidden rounded-xl border border-bcp-border bg-bcp-border sm:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1fr_1fr]">
        {[
          { k: t("Línea total", "Total line"), v: usd(F.line), s: `${data.loans.length} ${t("préstamos", "loans")}`, go: () => setPage("posicion"), dark: true },
          { k: t("Desembolsado", "Disbursed"), v: usd(F.disbursed), s: t(`${pct((F.disbursed / F.line) * 100)} de la línea`, `${pct((F.disbursed / F.line) * 100)} of the line`), go: () => setPage("posicion") },
          { k: t("Cobertura de repago", "Repayment coverage"), v: cov(F.coverage), s: F.byState.rojo.n === 0 ? t("Ningún préstamo en rojo", "No loan in red") : t(`${F.byState.rojo.n} en rojo`, `${F.byState.rojo.n} in red`), go: () => setPage("riesgo") },
          { k: t("Cambios del mes", "Changes this month"), v: `${loanChanges.length} ${t("préstamos", "loans")}`, s: t(`${toNaranja} a naranja · ${toAmbar} a ámbar`, `${toNaranja} to orange · ${toAmbar} to amber`), go: () => setPage("resumen") },
          { k: t("Decisiones pendientes", "Pending decisions"), v: String(openConformities + appsOpen.length), s: t(`${openConformities} conformidad · ${appsOpen.length} solicitudes`, `${openConformities} conformity · ${appsOpen.length} applications`), go: onDecisions },
        ].map((x, i) => (
          <button key={x.k} type="button" onClick={x.go} className={`flex flex-col items-start justify-start px-4 py-4 text-left ${i === 0 ? "sm:col-span-2 xl:col-span-1" : ""} ${x.dark ? "bg-bcp-ink text-white hover:bg-[#15354f]" : "bg-white hover:bg-bcp-bg"}`}>
            <span className={`font-[Arial,Helvetica,sans-serif] text-[12px] ${x.dark ? "text-bcp-label" : "text-bcp-muted"}`}>{x.k}</span>
            <span className="num mt-1 whitespace-nowrap text-[24px] font-bold leading-tight">{x.v}</span>
            <span className={`mt-1 text-[13px] ${x.dark ? "text-white/90" : "text-bcp-muted"}`}>{x.s}</span>
          </button>
        ))}
      </section>

      <PageTabs
        label={t("Secciones de la cartera", "Portfolio sections")}
        value={page}
        onChange={setPage}
        tabs={[
          { id: "resumen", label: t("Resumen", "Summary") },
          { id: "posicion", label: t("Posición y fondos", "Position and funds") },
          { id: "riesgo", label: t("Riesgo", "Risk") },
          { id: "prestamos", label: t("Préstamos", "Loans"), count: data.loans.length },
          { id: "solicitudes", label: t("Solicitudes", "Applications"), count: data.applications.length },
        ]}
      />

      {page === "posicion" && <>
      <Card>
        <StackBar
          height="h-[22px]"
          total={F.line}
          label={t(`Línea de ${usd(F.line)}: desembolsado ${usd(F.disbursed)}, congelado ${usd(F.frozen)}, por desembolsar ${usd(F.pending)}`, `Line of ${usd(F.line)}: disbursed ${usd(F.disbursed)}, frozen ${usd(F.frozen)}, to disburse ${usd(F.pending)}`)}
          segments={[
            { value: F.disbursed, className: "bg-bcp-ink", label: "desembolsado" },
            { value: F.frozen, className: "hatch", label: "congelado" },
            { value: F.pending, className: "bg-bcp-fill", label: "por desembolsar" },
          ]}
        />
        <div className="mt-4 grid gap-y-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { k: t("Desembolsado", "Disbursed"), v: usd(F.disbursed), n: "", rule: "border-bcp-ink", sw: "bg-bcp-ink" },
            { k: t("Congelado", "Frozen"), v: usd(F.frozen), n: frozenLoan ? t(`T3 de ${frozenLoan.id}`, `T3 of ${frozenLoan.id}`) : "", rule: "border-bcp-naranja", sw: "hatch" },
            { k: t("Por desembolsar", "Undrawn"), v: usd(F.pending), n: t("nov a feb", "Nov to Feb"), rule: "border-bcp-fill-strong", sw: "bg-bcp-fill" },
            { k: t("Repagado", "Repaid"), v: usd(F.repaid), n: t("cosechas desde mar 2027", "harvests from Mar 2027"), rule: "border-bcp-green", sw: "" },
            { k: t("Vencimientos de capital", "Principal maturities"), v: "", n: F.maturities.map(([m, v]) => `${month(`${m}-01`, lang)} ${usd(v)}`).join(" · "), rule: "border-bcp-green", sw: "" },
          ].map((x) => (
            <div key={x.k} className={`border-l-[3px] pl-3.5 pr-4 ${x.rule}`}>
              <span className="lbl block">
                {x.sw && <span className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-[-1px] ${x.sw}`} aria-hidden />}
                {x.k}
              </span>
              {x.v && <span className="num block text-[22px] font-bold">{x.v}</span>}
              {x.n && <span className={x.v ? "lbl block" : "block text-[15px] font-bold"}>{x.n}</span>}
            </div>
          ))}
        </div>
        <CashCalendar data={data} F={F} />
      </Card>

      <Card tone="control">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[20px] font-bold">{t("Control de fondos", "Control of funds")}</h2>
          <Lbl>{t(`controles verificados al ${date(data.cutoff, "es")}`, `controls verified at ${date(data.cutoff, "en")}`)}</Lbl>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { big: sevenOfSeven, s: t("tramos liberados con checklist completo y conformidad del banco", "tranches released with a complete checklist and the bank's conformity") },
            { big: pct(F.reconciledPct), s: t(`de los fondos con factura conciliada · ${usd(F.unexplained)} en revisión`, `of funds with a reconciled invoice · ${usd(F.unexplained)} under review`) },
            { big: pct(F.directPct), s: t(`pagado directo a proveedores · ${usd(F.cash)} retirado en efectivo`, `paid directly to suppliers · ${usd(F.cash)} withdrawn in cash`) },
            { big: t("Mismo día", "Same day"), s: t(`congelamiento ejecutado y reportado al detectar el desvío (${frozenLoan?.id ?? ""})`, `freeze executed and reported when the deviation was detected (${frozenLoan?.id ?? ""})`) },
          ].map((c) => (
            <div key={c.s} className="p-1">
              <p className="num text-[26px] font-extrabold text-bcp-green-text">{c.big}</p>
              <p className="text-sm text-bcp-ink">{c.s}</p>
            </div>
          ))}
        </div>
        <ul className="mt-4 list-disc gap-x-8 pl-5 text-[13px] text-bcp-ink sm:columns-2">
          <li>{t(`Central de riesgos re-consultada en el mes: ${data.controls.bureauRechecked[0]} de ${data.controls.bureauRechecked[1]} deudores`, `Credit bureau re-checked this month: ${data.controls.bureauRechecked[0]} of ${data.controls.bureauRechecked[1]} borrowers`)}</li>
          <li>{t(`Cesión de cobros inscrita y sin cesiones a terceros: ${data.controls.assignmentRegistered[0]} de ${data.controls.assignmentRegistered[1]}`, `Assignment of receivables registered, no third-party assignments: ${data.controls.assignmentRegistered[0]} of ${data.controls.assignmentRegistered[1]}`)}</li>
          <li>{t(`Seguro agrícola vigente: ${data.controls.insuranceInForce[0]} de ${data.controls.insuranceInForce[1]}`, `Crop insurance in force: ${data.controls.insuranceInForce[0]} of ${data.controls.insuranceInForce[1]}`)}</li>
        </ul>
      </Card>


      <Card>
        <h3 className="text-[16px] font-bold">{t("Posición por préstamo", "Position by loan")}</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-bcp-border">{[t("Préstamo", "Loan"), t("Línea", "Line"), t("Desembolsado", "Disbursed"), t("Congelado", "Frozen"), t("Por desembolsar", "Undrawn"), t("Vence", "Maturity")].map((h, i) => <Lbl key={h} as="th" className={`py-1.5 font-normal ${i ? "text-right" : "text-left"}`}>{h}</Lbl>)}</tr></thead>
            <tbody className="divide-y divide-bcp-divider">
              {[...data.loans].sort(bySeverity).map((l) => (
                <tr key={l.id} onClick={() => onOpen(l.id)} className="cursor-pointer hover:bg-bcp-bg">
                  <td className="py-2 font-semibold">{l.id}</td>
                  <td className="py-2 text-right">{usd(l.lineUsd)}</td>
                  <td className="py-2 text-right font-semibold">{usd(l.disbursedUsd)}</td>
                  <td className="py-2 text-right">{usd(l.frozenUsd)}</td>
                  <td className="py-2 text-right">{usd(l.lineUsd - l.disbursedUsd - l.frozenUsd)}</td>
                  <td className="py-2 text-right">{date(l.maturityDate, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      </>}

      {page === "riesgo" && <>
      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="col-span-2 lg:col-span-1">
            <Lbl>{t("Proyección", "Projection")}</Lbl>
            <p className="num mt-1 flex flex-wrap items-center gap-2 text-[22px] font-bold">{range(data.projection.low, data.projection.high, lang)} <Estimado /></p>
          </Card>
          {[
            [t("Clasificación SBS", "SBS rating"), t(`${data.loans.filter((l) => l.sbsRating === "Normal").length} de ${data.loans.length} Normal`, `${data.loans.filter((l) => l.sbsRating === "Normal").length} of ${data.loans.length} Normal`)],
            [t("Provisión requerida", "Required provision"), usd(F.provision)],
            [t("Pérdida esperada", "Expected loss"), t("Por calibrar", "To be calibrated")],
          ].map(([k, v]) => (
            <Card key={k}>
              <Lbl>{k}</Lbl>
              <p className="num mt-1 text-[22px] font-bold">{v}</p>
            </Card>
          ))}
        </div>
        <p className="text-sm text-bcp-muted">
          <b className="font-semibold text-bcp-ink">{t("Concentración", "Concentration")}:</b> {t("palta Hass 100%", "Hass avocado 100%")} · Ica {pct((ica / F.line) * 100)} · Pisco {pct(((F.line - ica) / F.line) * 100)} · {t(`packing principal ${data.mainPackhousePct}% de la línea`, `main packhouse ${data.mainPackhousePct}% of the line`)}
        </p>
      </section>


      <Card>
        <h3 className="text-[16px] font-bold">{t("Cobertura por préstamo", "Coverage by loan")}</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead><tr className="border-b border-bcp-border">{[t("Préstamo", "Loan"), t("Estado", "State"), t("Aprobación", "Approval"), t("Hoy", "Today"), t("Proyección", "Projection")].map((h, i) => <Lbl key={h} as="th" className={`py-1.5 font-normal ${i > 1 ? "text-right" : "text-left"}`}>{h}</Lbl>)}</tr></thead>
            <tbody className="divide-y divide-bcp-divider">
              {[...data.loans].sort(bySeverity).map((l) => (
                <tr key={l.id} onClick={() => onOpen(l.id)} className="cursor-pointer hover:bg-bcp-bg">
                  <td className="py-2 font-semibold">{l.id}</td>
                  <td className="py-2"><StateChip state={l.state} /></td>
                  <td className="py-2 text-right">{cov(l.coverageAtApproval)}</td>
                  <td className="py-2 text-right font-semibold">{cov(l.coverageToday)}</td>
                  <td className="py-2 text-right">{l.projection ? range(l.projection.low, l.projection.high, lang) : t("sin cambio proyectado", "no projected change")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="lbl mt-2">
          {t("Cobertura = ingreso neto de cosecha ÷ saldo al vencimiento. Umbrales propuestos: ámbar bajo 1.50x, naranja bajo 1.30x, rojo bajo 1.10x.", "Coverage = net harvest revenue ÷ amount due at maturity. Proposed thresholds: amber below 1.50x, orange below 1.30x, red below 1.10x.")}{" "}
          {t(data.projection.text).replace(/^(Proyección|Projection) \S+ (a|to) \S+ /, (m) => (m.startsWith("P") && lang === "es" ? "Proyección " : "Projection "))}
        </p>
      </Card>
      </>}

      {page === "resumen" && <>
      <SectionTitle title={t("Cambios del mes", "Changes this month")} sub={t(`${date(data.monthFrom, "es")} a ${date(data.cutoff, "es")}`, `${date(data.monthFrom, "en")} to ${date(data.cutoff, "en")}`)} />
      <Card className="py-1.5 sm:py-1.5">
        <ul className="divide-y divide-bcp-divider">
          {data.changes.map((c, i) => {
            const loan = c.loanId ? data.loans.find((l) => l.id === c.loanId) ?? null : null;
            return (
              <li key={i} className="py-3">
                <div className="grid gap-2 md:grid-cols-[11rem_13rem_1fr_auto] md:items-start">
                  <div>
                    <p className="font-semibold">{c.loanId ?? t("Toda la cartera", "Whole portfolio")}</p>
                    <p className="lbl">{date(c.date, lang)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <StateChip state={c.from} />
                    <span aria-hidden>→</span>
                    <StateChip state={c.to} />
                  </div>
                  <p className="text-sm">
                    <b className="font-semibold">{t(c.impact)}</b>
                  </p>
                  <span className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => setCauseOf(c)} className="min-h-[44px] text-sm font-semibold text-bcp-green-text underline-offset-2 hover:underline">
                      {t("Ver causa", "View cause")}
                    </button>
                    {!BANK_EDITION && c.evidence && (
                      <button type="button" onClick={() => openEvidence(c.evidence!.loanId, c.evidence!.condition)} className="min-h-[44px] text-sm font-semibold text-bcp-green-text hover:underline">
                        {t("Evidencia", "Evidence")} ›
                      </button>
                    )}
                    {loan && (
                      <button type="button" onClick={() => onOpen(loan.id)} className="min-h-[44px] text-sm font-semibold text-bcp-ink hover:underline">
                        {t("Abrir expediente", "Open file")} →
                      </button>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
      {causeOf && (
        <Modal
          title={t(`Causa · ${causeOf.loanId ?? "Toda la cartera"}`, `Cause · ${causeOf.loanId ?? "Whole portfolio"}`)}
          onClose={closeCause}
          footer={
            <>
              <Btn onClick={closeCause}>{t("Cerrar", "Close")}</Btn>
              {causeOf.loanId && <Btn primary onClick={() => onOpen(causeOf.loanId!)}>{t("Abrir expediente", "Open file")}</Btn>}
            </>
          }
        >
          <div className="flex flex-wrap items-center gap-1">
            <StateChip state={causeOf.from} />
            <span aria-hidden>→</span>
            <StateChip state={causeOf.to} />
          </div>
          <p className="mt-3 text-sm font-semibold text-bcp-ink">{t(causeOf.impact)}</p>
          <p className="mt-2 text-sm text-bcp-ink">{t(causeOf.cause).replace(/^./, (x) => x.toUpperCase())}</p>
        </Modal>
      )}

      {pending.length > 0 && <SectionTitle title={t("Decisiones pendientes", "Pending decisions")} />}
      {pending.map((p) => (
        <DecisionBlock
          key={decisionKey(p.loan, p.decision)}
          loan={p.loan}
          decision={p.decision}
          cutoff={data.cutoff}
          answer={answers[decisionKey(p.loan, p.decision)]}
          onAnswer={(a) => onAnswer(decisionKey(p.loan, p.decision), a)}
          onOpen={() => onOpen(p.loan.id)}
        />
      ))}

      </>}

      {page === "prestamos" && <>
      <section aria-label={t("Exposición por estado", "Exposure by state")} className="mt-2">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[20px] font-bold leading-tight">{t("Exposición por estado", "Exposure by state")}</h2>
          <Lbl>{t(`${usd(F.disbursed)} desembolsados · seleccione un estado para filtrar`, `${usd(F.disbursed)} disbursed · select a state to filter`)}</Lbl>
        </div>
        <StackBar
          total={F.disbursed}
          label={(["verde", "ambar", "naranja", "rojo"] as const).map((x) => `${x} ${usd(F.byState[x].usd)}`).join(", ")}
          segments={[
            { value: F.byState.verde.usd, className: "bg-bcp-green", label: "verde" },
            { value: F.byState.ambar.usd, className: "bg-bcp-ambar", label: "ámbar" },
            { value: F.byState.naranja.usd, className: "bg-bcp-naranja", label: "naranja" },
            { value: F.byState.rojo.usd, className: "bg-bcp-rojo", label: "rojo" },
          ]}
        />
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(["verde", "ambar", "naranja", "rojo"] as const).map((x) => {
            const { usd: amount, n } = F.byState[x];
            const on = stateFilter === x;
            return (
              <button key={x} type="button" disabled={!n} aria-pressed={on} onClick={() => setStateFilter(on ? null : x)} className={`rounded-xl border bg-white p-4 text-left ${on ? "border-bcp-ink shadow-[inset_0_0_0_1px_#102a40]" : "border-bcp-border"} ${n ? "hover:border-bcp-ink" : "cursor-default"}`}>
                <StateChip state={x} />
                <span className="num mt-2 block text-[22px] font-bold">{usd(amount)}</span>
                <span className="lbl block">
                  {n} {n === 1 ? t("préstamo", "loan") : t("préstamos", "loans")} · {pct(F.disbursed ? (amount / F.disbursed) * 100 : 0)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <Card>
        <LoansTable data={stateFilter ? { ...data, loans: data.loans.filter((l) => l.state === stateFilter) } : data} onOpen={onOpen} />
        <button type="button" onClick={() => setSeason((v) => !v)} aria-expanded={season} className="mt-2 min-h-[44px] text-sm font-semibold text-bcp-green-text hover:underline print:hidden">
          {season ? t("Ocultar calendario de campaña", "Hide campaign calendar") : t("Ver calendario de campaña: tramos, cosecha y vencimiento de cada préstamo", "View campaign calendar: each loan's tranches, harvest and maturity")}
        </button>
        {season && <SeasonCalendar data={data} onOpen={onOpen} />}
        {!BANK_EDITION && (
        <p className="lbl mt-3">
          {t(
            "Cada dato muestra su fuente y fecha en el expediente. Estado = el más severo entre cobertura de repago y los gatillos acordados (vigor, facturas, labores, cuajado, aforo, deuda).",
            "Each figure shows its source and date in the file. State = the most severe of repayment coverage and the agreed triggers (vigour, invoices, field work, fruit set, field estimate, debt).",
          )}
        </p>
        )}
      </Card>

      </>}

      {page === "solicitudes" && <>
      {data.applications.length > 0 && (
        <>
          <Card>
            <ApplicationsTable apps={data.applications} onOpen={onOpenApp} answers={answers} />
          </Card>
        </>
      )}
      </>}
    </div>
  );
}

export function LoansTable({ data, onOpen }: { data: P; onOpen: (id: string) => void }) {
  const t = useT();
  const lang = useLang();
  const [situationOf, setSituationOf] = useState<Loan | null>(null);
  const closeSituation = useCallback(() => setSituationOf(null), []);
  // The next tranche in figures: which one, how much, and when (or that it is frozen).
  const nextTranche = (l: Loan) => {
    const tr = l.tranches.find((x) => x.status !== "liberado");
    if (!tr) return { main: t(l.next.label), note: date(l.next.date, lang) };
    const upTo = /hasta|up to/i.test(t(l.next.label)) ? `${t("hasta", "up to")} ` : "";
    return {
      main: `${tr.id} · ${upTo}${usd(l.next.amountUsd)}`,
      note: tr.status === "congelado" ? t(`Congelado · revisión ${date(l.next.date, "es", false)}`, `Frozen · review ${date(l.next.date, "en", false)}`) : date(l.next.date, lang),
    };
  };
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-bcp-border text-left">
            {[t("Cliente", "Client"), t("Estado", "State"), t("Desembolsado", "Disbursed"), t("Próximo tramo", "Next tranche"), t("Cobertura", "Coverage"), t("Vence", "Due"), ""].map((h, i) => (
              <Lbl key={h} as="th" className={`py-2 pr-3 font-normal ${i === 2 ? "text-right" : ""}`}>
                {h}
              </Lbl>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-bcp-divider">
          {[...data.loans].sort(bySeverity).map((l) => (
            <tr key={l.id} onClick={() => onOpen(l.id)} className="cursor-pointer align-top hover:bg-bcp-bg">
              <td className="whitespace-nowrap py-2.5 pr-3">
                <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(l.id); }} className="text-left font-semibold text-bcp-ink hover:underline">
                  {l.id}
                </button>
                <span className="lbl block">{t(l.zone)}</span>
              </td>
              <td className="py-2.5 pr-3"><StateChip state={l.state} /></td>
              <td className="whitespace-nowrap py-2.5 pr-3 text-right">
                <span className="font-semibold">{usd(l.disbursedUsd)}</span>
                <span className="lbl block">{t("de", "of")} {usd(l.lineUsd)}</span>
              </td>
              <td className="whitespace-nowrap py-2.5 pr-3">
                {nextTranche(l).main}
                <span className="lbl block">{nextTranche(l).note}</span>
              </td>
              <td className="py-2.5 pr-3 whitespace-nowrap">
                {cov(l.coverageAtApproval)} → <b>{cov(l.coverageToday)}</b>
                <span className="lbl block">{l.projection ? `${t("proyección", "projection")} ${range(l.projection.low, l.projection.high, lang)}` : t("sin cambio proyectado", "no projected change")}</span>
              </td>
              <td className="py-2.5 pr-3 whitespace-nowrap">{date(l.maturityDate, lang)}</td>
              <td className="whitespace-nowrap py-2.5 text-right">
                <button type="button" onClick={(e) => { e.stopPropagation(); setSituationOf(l); }} className="min-h-[28px] text-xs font-semibold text-bcp-green-text underline-offset-2 hover:underline">
                  {t("Ver situación", "View situation")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {situationOf && (
        <Modal
          title={t(`Situación · ${situationOf.id}`, `Situation · ${situationOf.id}`)}
          onClose={closeSituation}
          footer={
            <>
              <Btn onClick={closeSituation}>{t("Cerrar", "Close")}</Btn>
              <Btn primary onClick={() => onOpen(situationOf.id)}>{t("Abrir expediente", "Open file")}</Btn>
            </>
          }
        >
          <StateChip state={situationOf.state} />
          <p className="mt-3 text-sm text-bcp-ink">{t(situationOf.summary)}</p>
          <p className="mt-3 border-t border-bcp-divider pt-3 text-sm">
            <span className="lbl block">{t("Próximo hito", "Next milestone")}</span>
            <b className="font-semibold">{withDate(t(situationOf.next.label), situationOf.next.date, lang, true)}</b>
          </p>
        </Modal>
      )}
    </div>
  );
}

/** Each loan across the season: tranches (released, planned, frozen), maturity and today. */
function SeasonCalendar({ data, onOpen }: { data: P; onOpen: (id: string) => void }) {
  const t = useT();
  const lang = useLang();
  const loans = [...data.loans].sort(bySeverity);
  const start = loans.reduce((m, l) => (l.approvalDate < m ? l.approvalDate : m), data.cutoff);
  const end = loans.reduce((m, l) => (l.maturityDate > m ? l.maturityDate : m), data.cutoff);
  const span = Date.parse(end) - Date.parse(start);
  const pos = (d: string) => `${((Date.parse(d) - Date.parse(start)) / span) * 100}%`;
  const months: string[] = [];
  for (let d = new Date(`${start.slice(0, 7)}-01T00:00:00Z`); d.toISOString().slice(0, 10) <= end; d.setUTCMonth(d.getUTCMonth() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    if (iso >= start) months.push(iso);
  }
  return (
    <div className="-mx-4 mt-2 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
      <div className="min-w-[760px]" role="img" aria-label={t("Calendario de campaña de los préstamos", "Campaign calendar of the loans")}>
        <div className="relative ml-36 h-5 border-b border-bcp-border">
          {months.map((m) => (
            <span key={m} className="lbl absolute -translate-x-1/2" style={{ left: pos(m) }}>
              {month(m, lang).split(" ")[0]}
            </span>
          ))}
        </div>
        <ul className="divide-y divide-bcp-divider">
          {loans.map((l) => (
            <li key={l.id} className="flex items-center py-2">
              <button type="button" onClick={() => onOpen(l.id)} className="w-36 shrink-0 pr-2 text-left text-sm font-semibold hover:underline">
                {l.id}
              </button>
              <div className="relative h-7 flex-1">
                <span className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-bcp-fill" style={{ left: pos(l.approvalDate), width: `calc(${pos(l.maturityDate)} - ${pos(l.approvalDate)})` }} />
                {l.tranches.map((tr) => (
                  <span
                    key={tr.id}
                    title={`${tr.id} · ${usd(tr.amountUsd)} · ${date(tr.milestoneDate, lang)}`}
                    className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded px-1 font-[Arial,Helvetica,sans-serif] text-[10px] font-bold leading-5 ${
                      tr.status === "liberado" ? "bg-bcp-ink text-white" : tr.status === "congelado" ? "hatch text-bcp-ink" : "border border-bcp-fill-strong bg-white text-bcp-ink"
                    }`}
                    style={{ left: pos(tr.milestoneDate) }}
                  >
                    {tr.id}
                  </span>
                ))}
                <span title={`${t("Vence", "Due")} ${usd(l.dueAtMaturityUsd)}`} className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 bg-bcp-green-text" style={{ left: pos(l.maturityDate) }} />
                <span className="absolute -bottom-1 -top-1 w-px bg-bcp-rojo" style={{ left: pos(data.cutoff) }} />
              </div>
            </li>
          ))}
        </ul>
        <p className="lbl ml-36 mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <span><b className="rounded bg-bcp-ink px-1 text-white">T</b> {t("liberado", "released")}</span>
          <span><b className="rounded border border-bcp-fill-strong px-1">T</b> {t("previsto o pendiente", "planned or pending")}</span>
          <span><b className="hatch rounded px-1">T</b> {t("congelado", "frozen")}</span>
          <span><span className="inline-block h-3 w-0.5 bg-bcp-green-text align-middle" /> {t("vencimiento", "maturity")}</span>
          <span><span className="inline-block h-3 w-px bg-bcp-rojo align-middle" /> {t("hoy", "today")} · {date(data.cutoff, lang)}</span>
        </p>
      </div>
    </div>
  );
}

/** Cash calendar: what leaves the bank against milestones and what comes back as principal, by month, with the balance exposed. */
function CashCalendar({ data, F }: { data: P; F: ReturnType<typeof portfolioFigures> }) {
  const t = useT();
  const lang = useLang();
  const rows = cashCalendar(data.loans, data.cutoff);
  const [movesOf, setMovesOf] = useState<(typeof rows)[number] | null>(null);
  const closeMoves = useCallback(() => setMovesOf(null), []);
  let bal = F.disbursed;
  const pts = rows.map((r) => (bal = bal + r.out - r.back));
  const peak = Math.max(F.disbursed, ...pts);
  const peakMonth = rows[pts.indexOf(peak)]?.month;
  const W = 620, H = 260, L = 48, R = 12, T = 14, B = 32;
  const max = Math.ceil(Math.max(peak, ...rows.map((r) => r.back)) / 50_000) * 50_000;
  const min = -Math.ceil(Math.max(...rows.map((r) => r.out), 1) / 50_000) * 50_000;
  const Y = (v: number) => T + ((H - T - B) * (max - v)) / (max - min);
  const bw = (W - L - R) / rows.length;
  const k = (n: number) => `${Math.round(n / 1000)}k`;
  const ticks: number[] = [];
  for (let v = min; v <= max; v += 50_000) ticks.push(v);
  const line = [[L + 4, Y(F.disbursed)], ...pts.map((p, i) => [L + bw * i + bw / 2, Y(p)])];
  const aria = t(
    `Calendario de caja. ${rows.map((r) => `${month(r.month, "es")}: desembolsos ${usd(r.out)}, repagos ${usd(r.back)}`).join("; ")}. Saldo máximo expuesto ${usd(peak)}${peakMonth ? ` en ${month(peakMonth, "es")}` : ""}.`,
    `Cash calendar. ${rows.map((r) => `${month(r.month, "en")}: out ${usd(r.out)}, back ${usd(r.back)}`).join("; ")}. Peak balance exposed ${usd(peak)}${peakMonth ? ` in ${month(peakMonth, "en")}` : ""}.`,
  );
  return (
    <div className="mt-7 grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
      <div className="min-w-0">
        <h3 className="text-[16px] font-bold">{t("Calendario de caja", "Cash calendar")}</h3>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria} className="h-auto w-full">
          {ticks.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke={v === 0 ? "#102a40" : "#eef2f5"} />
              <text x={L - 6} y={Y(v) + 4} textAnchor="end" fontFamily="Arial" fontSize="11" fill="#4a5b6c">{k(v)}</text>
            </g>
          ))}
          {rows.map((r, i) => {
            const cx = L + bw * i + bw / 2;
            return (
              <g key={r.month}>
                {r.out > 0 && (
                  <>
                    <rect x={cx - 16} y={Y(0)} width={32} height={Y(-r.out) - Y(0)} fill="#102a40" />
                    <text x={cx} y={Y(-r.out) + 14} textAnchor="middle" fontFamily="Arial" fontSize="11" fill="#102a40">-{k(r.out)}</text>
                  </>
                )}
                {r.back > 0 && (
                  <>
                    <rect x={cx - 16} y={Y(r.back)} width={32} height={Y(0) - Y(r.back)} fill="#0f9d6b" />
                    <text x={cx} y={Y(r.back) - 6} textAnchor="middle" fontFamily="Arial" fontSize="11" fontWeight="700" fill="#0b6b48">+{k(r.back)}</text>
                  </>
                )}
                <text x={cx} y={H - 10} textAnchor="middle" fontFamily="Arial" fontSize="11" fill="#4a5b6c">{month(r.month, lang)}</text>
              </g>
            );
          })}
          <polyline fill="none" stroke="#d9a93b" strokeWidth={2} points={line.map((p) => p.join(",")).join(" ")} />
          {line.slice(1).map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={3.5} fill="#fff" stroke="#d9a93b" strokeWidth={2} />
          ))}
        </svg>
        <p className="lbl mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
          <span><span className="mr-1 inline-block h-2.5 w-2.5 bg-bcp-ink align-[-1px]" />{t("desembolso contra hito", "disbursement against a milestone")}</span>
          <span><span className="mr-1 inline-block h-2.5 w-2.5 bg-bcp-green align-[-1px]" />{t("repago de capital al vencimiento", "principal repaid at maturity")}</span>
          <span><span className="mr-1 inline-block h-0.5 w-3 bg-bcp-ambar align-middle" />{t("saldo expuesto", "balance exposed")}</span>
        </p>
      </div>
      <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5 lg:mx-0 lg:px-0">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-bcp-border">
              {[t("Mes", "Month"), t("Desembolsos", "Disbursements"), t("Repagos", "Repayments"), t("Movimientos", "Movements")].map((h, i) => (
                <Lbl key={h} as="th" className={`py-2 pr-3 font-normal ${i === 1 || i === 2 ? "text-right" : "text-left"}`}>
                  {h}
                </Lbl>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-bcp-divider">
            {rows.map((r) => (
              <tr key={r.month} className="align-top">
                <td className="whitespace-nowrap py-2 pr-3 font-semibold">{month(r.month, lang)}</td>
                <td className="whitespace-nowrap py-2 pr-3 text-right">{r.out ? usd(r.out) : "0"}</td>
                <td className="whitespace-nowrap py-2 pr-3 text-right font-semibold text-bcp-green-text">{r.back ? usd(r.back) : "0"}</td>
                <td className="whitespace-nowrap py-2 pr-3">
                  <button type="button" onClick={() => setMovesOf(r)} className="min-h-[28px] text-xs font-semibold text-bcp-green-text underline-offset-2 hover:underline">
                    {t(`Ver (${r.items.length})`, `View (${r.items.length})`)}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="lbl mt-2">
          {t(
            `El congelado de ${usd(F.frozen)} no entra al calendario hasta verificar la remediación. El costo del banco se cobra con el capital al vencimiento.`,
            `The ${usd(F.frozen)} frozen stays out of the calendar until remediation is verified. The bank's cost is collected with the principal at maturity.`,
          )}
        </p>
        {movesOf && (
          <Modal title={t(`Movimientos · ${month(movesOf.month, "es")}`, `Movements · ${month(movesOf.month, "en")}`)} onClose={closeMoves} footer={<Btn onClick={closeMoves}>{t("Cerrar", "Close")}</Btn>}>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-bcp-divider">
                {movesOf.items.map((x, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-3 font-semibold">{x.loanId}</td>
                    <td className="py-2 pr-3 text-bcp-muted">{x.dir === "out" ? `${t("Desembolso", "Disbursement")} ${t(x.label)}` : t("Repago de capital", "Principal repayment")}</td>
                    <td className={`whitespace-nowrap py-2 text-right font-semibold ${x.dir === "back" ? "text-bcp-green-text" : ""}`}>{usd(x.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Modal>
        )}
      </div>
    </div>
  );
}

