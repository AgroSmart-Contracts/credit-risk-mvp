/**
 * Cartera (spec 6.1): Mi dinero → Control del dinero → Mi riesgo → Qué cambió,
 * then the decision waiting for the bank and the loans table.
 */
import { Fragment, useState } from "react";
import { bySeverity, cashCalendar, cov, date, month, pct, pendingDecisions, portfolioFigures, range, usd } from "../../lib/bcp/calc";
import type { Portfolio as P, State } from "../../lib/bcp/types";
import { AlertCard } from "./AlertCard";
import { ApplicationsTable } from "./Applications";
import { appKey, decisionKey, type Answer } from "./answers";
import { DecisionBlock } from "./Decision";
import { Btn, Card, Estimado, ExampleChip, Lbl, SectionTitle, StackBar, StateChip } from "./ui";
import { useDrawer, useEvidence, useLang, useT } from "./shared";
import { concentrationDetail, coverageDetail, disbursedDetail, frozenDetail, fundsDetail, maturityDetail, provisionDetail, tranchesReleasedDetail, undrawnDetail } from "./details";

export function Portfolio({ data, onOpen, onOpenApp, onReport, onDecisions, onException, answers, onAnswer }: { data: P; onOpen: (id: string) => void; onOpenApp: (id: string) => void; onReport: () => void; onDecisions: () => void; onException: (id: string) => void; answers: Record<string, Answer>; onAnswer: (k: string, a: Answer) => void }) {
  const t = useT();
  const lang = useLang();
  const F = portfolioFigures(data.loans);
  const pending = pendingDecisions(data.loans, data.cutoff);
  const [openChange, setOpenChange] = useState<string | null>(null);
  const openEvidence = useEvidence();
  const open = useDrawer();
  // Clicking a state in "exposure by state" filters the loans table.
  const [stateFilter, setStateFilter] = useState<State | null>(null);
  const filterBy = (st: State) => {
    setStateFilter(st);
    window.setTimeout(() => document.getElementById("prestamos")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const [season, setSeason] = useState(false);
  const appsOpen = data.applications.filter((a) => !answers[appKey(a)]);
  const loanChanges = data.changes.filter((c) => c.loanId);
  const toNaranja = loanChanges.filter((c) => c.to === "naranja").length;
  const toAmbar = loanChanges.filter((c) => c.to === "ambar").length;
  const ica = data.loans.filter((l) => l.id.startsWith("ICA")).reduce((s, l) => s + l.lineUsd, 0);
  const worstNaranja = data.loans.filter((l) => l.state === "naranja").sort((a, b) => b.disbursedUsd - a.disbursedUsd)[0];
  const frozenLoan = data.loans.find((l) => l.frozenUsd > 0);
  const sevenOfSeven = `${F.tranchesWithConformity} ${t("de", "of")} ${F.tranchesReleased}`;

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      {/* 1. Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <ExampleChip kind="portfolio" />
          <h1 className="mt-2 text-[28px] font-bold leading-tight">{t("Cartera pre-cosecha", "Pre-harvest portfolio")}</h1>
          <p className="text-sm text-bcp-muted">
            {data.loans.length} {t("préstamos · palta Hass · Ica y Pisco · corte", "loans · Hass avocado · Ica and Pisco · cut-off")} {date(data.cutoff, lang)}
          </p>
        </div>
        <Btn onClick={onReport}>{t("Descargar reporte mensual (PDF)", "Download monthly report (PDF)")}</Btn>
      </header>

      {/* Statement strip: the four things the bank reads first, joined like a statement. */}
      <section aria-label={t("Situación de la cartera", "Portfolio situation")} className="grid overflow-hidden rounded-xl border border-bcp-border bg-white sm:grid-cols-2 xl:grid-cols-[1.25fr_1fr_1fr_1fr]">
        <button type="button" onClick={() => open(disbursedDetail(data, t, lang))} className="group bg-bcp-ink px-5 py-4 text-left text-white hover:bg-[#15354f]">
          <p className="font-[Arial,Helvetica,sans-serif] text-[12px] text-bcp-label">{t("Desembolsado", "Disbursed")}</p>
          <p className="num mb-2 mt-1 text-[28px] font-bold">{usd(F.disbursed)}</p>
          <ul className="list-disc space-y-0.5 pl-4 text-[13px] text-white/90">
            <li>{t(`${pct((F.disbursed / F.line) * 100)} de la línea de ${usd(F.line)}`, `${pct((F.disbursed / F.line) * 100)} of the ${usd(F.line)} line`)}</li>
            <li>{t("El saldo de la línea se desembolsa solo contra hitos verificados", "The undrawn balance is disbursed only against verified milestones")}</li>
          </ul>
          <More dark />
        </button>
        <button type="button" onClick={() => open(coverageDetail(data, t, lang))} className="group border-t border-bcp-border px-5 py-4 text-left hover:bg-bcp-bg sm:border-l sm:border-t-0">
          <Lbl>{t("Cobertura de repago", "Repayment coverage")}</Lbl>
          <p className="num mb-2 mt-1 text-[28px] font-bold">{cov(F.coverage)}</p>
          <ul className="list-disc space-y-0.5 pl-4 text-[13px] text-bcp-muted">
            <li>{t(`El ingreso esperado de cosecha cubre ${F.coverage.toFixed(2)} veces el saldo adeudado`, `Expected harvest revenue covers ${F.coverage.toFixed(2)} times the amount due`)}</li>
            <li>{F.byState.rojo.n === 0 ? t("Ningún préstamo en rojo", "No loan in red") : t(`${F.byState.rojo.n} en rojo`, `${F.byState.rojo.n} in red`)}</li>
          </ul>
          <More />
        </button>
        <button type="button" onClick={() => scrollTo("cambios")} className="group border-t border-bcp-border px-5 py-4 text-left hover:bg-bcp-bg xl:border-l xl:border-t-0">
          <Lbl>{t("Cambios del mes", "Changes this month")}</Lbl>
          <p className="num mb-2 mt-1 text-[28px] font-bold">
            {loanChanges.length} {t("préstamos", "loans")}
          </p>
          <ul className="list-disc space-y-0.5 pl-4 text-[13px] text-bcp-muted">
            <li>{t(`${toNaranja} a naranja: tramo congelado`, `${toNaranja} to orange: tranche frozen`)}</li>
            <li>{t(`${toAmbar} a ámbar: seguimiento reforzado`, `${toAmbar} to amber: reinforced follow-up`)}</li>
          </ul>
          <More />
        </button>
        <button type="button" onClick={onDecisions} className="group border-t border-bcp-border px-5 py-4 text-left shadow-[inset_0_0_0_2px_#102a40] hover:bg-bcp-bg sm:border-l xl:border-t-0">
          <Lbl>{t("Decisiones pendientes", "Pending decisions")}</Lbl>
          <p className="num mb-2 mt-1 text-[28px] font-bold">{pending.filter((p) => !answers[decisionKey(p.loan, p.decision)]).length + appsOpen.length}</p>
          <ul className="list-disc space-y-0.5 pl-4 text-[13px] text-bcp-muted">
            {pending.slice(0, 1).map((p) => (
              <Fragment key={p.loan.id}>
                <li>{t(`Conformidad del T2 de ${p.loan.id} · vence ${date(p.decision.dueDate ?? p.decision.date, "es", false)}`, `T2 conformity for ${p.loan.id} · due ${date(p.decision.dueDate ?? p.decision.date, "en", false)}`)}</li>
              </Fragment>
            ))}
            {appsOpen.length > 0 && <li>{t(`${appsOpen.length} solicitudes por aprobar o rechazar`, `${appsOpen.length} applications to approve or decline`)}</li>}
          </ul>
          <More />
        </button>
      </section>

      {/* 01 Mi dinero: the line as a rail, the ledger, and the cash calendar open */}
      <SectionTitle no="01" title={t("Posición de la cartera", "Portfolio position")} sub={t(`línea total ${usd(F.line)}`, `total line ${usd(F.line)}`)} />
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
            { k: t("Desembolsado", "Disbursed"), v: usd(F.disbursed), n: t("capital vigente", "outstanding principal"), rule: "border-bcp-ink", sw: "bg-bcp-ink", go: () => open(disbursedDetail(data, t, lang)) },
            { k: t("Congelado", "Frozen"), v: usd(F.frozen), n: frozenLoan ? t(`T3 de ${frozenLoan.id}`, `T3 of ${frozenLoan.id}`) : "", rule: "border-bcp-naranja", sw: "hatch", go: () => open(frozenDetail(data, t, lang)) },
            { k: t("Por desembolsar", "Undrawn"), v: usd(F.pending), n: t("contra hitos, nov a feb", "against milestones, Nov to Feb"), rule: "border-bcp-fill-strong", sw: "bg-bcp-fill", go: () => open(undrawnDetail(data, t, lang)) },
            { k: t("Repagado", "Repaid"), v: usd(F.repaid), n: t("cosechas desde mar 2027", "harvests from Mar 2027"), rule: "border-bcp-green", sw: "", go: () => open(maturityDetail(data, t, lang)) },
            { k: t("Vencimientos de capital", "Principal maturities"), v: "", n: F.maturities.map(([m, v]) => `${month(`${m}-01`, lang)} ${usd(v)}`).join(" · "), rule: "border-bcp-green", sw: "", go: () => open(maturityDetail(data, t, lang)) },
          ].map((x) => (
            <button type="button" key={x.k} onClick={x.go} className={`group block border-l-[3px] pl-3.5 pr-4 text-left hover:bg-bcp-bg ${x.rule}`}>
              <span className="lbl block">
                {x.sw && <span className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-[-1px] ${x.sw}`} aria-hidden />}
                {x.k}
              </span>
              {x.v && <span className="num block text-[22px] font-bold">{x.v}</span>}
              {x.n && <span className={x.v ? "lbl block" : "block text-[15px] font-bold"}>{x.n}</span>}
              <More />
            </button>
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
            { big: sevenOfSeven, s: t("tramos liberados con checklist completo y conformidad del banco", "tranches released with a complete checklist and the bank's conformity"), go: () => open(tranchesReleasedDetail(data, t, lang)) },
            { big: pct(F.reconciledPct), s: t(`de los fondos con factura conciliada · ${usd(F.unexplained)} en revisión`, `of funds with a reconciled invoice · ${usd(F.unexplained)} under review`), go: () => open(fundsDetail(data, t, "reconciled")) },
            { big: pct(F.directPct), s: t(`pagado directo a proveedores · ${usd(F.cash)} retirado en efectivo`, `paid directly to suppliers · ${usd(F.cash)} withdrawn in cash`), go: () => open(fundsDetail(data, t, "direct")) },
            { big: t("Mismo día", "Same day"), s: t(`congelamiento ejecutado y reportado al detectar el desvío (${frozenLoan?.id ?? ""})`, `freeze executed and reported when the deviation was detected (${frozenLoan?.id ?? ""})`), go: () => frozenLoan && onException(frozenLoan.id) },
          ].map((c) => (
            <button type="button" key={c.s} onClick={c.go} className="group rounded-md p-1 text-left hover:bg-white/70">
              <p className="num text-[26px] font-extrabold text-bcp-green-text">{c.big}</p>
              <p className="text-sm text-bcp-ink">{c.s}</p>
              <More />
            </button>
          ))}
        </div>
        <ul className="mt-4 list-disc gap-x-8 pl-5 text-[13px] text-bcp-ink sm:columns-2">
          <li>{t(`Central de riesgos re-consultada en el mes: ${data.controls.bureauRechecked[0]} de ${data.controls.bureauRechecked[1]} deudores`, `Credit bureau re-checked this month: ${data.controls.bureauRechecked[0]} of ${data.controls.bureauRechecked[1]} borrowers`)}</li>
          <li>{t(`Cesión de cobros inscrita y sin cesiones a terceros: ${data.controls.assignmentRegistered[0]} de ${data.controls.assignmentRegistered[1]}`, `Assignment of receivables registered, no third-party assignments: ${data.controls.assignmentRegistered[0]} of ${data.controls.assignmentRegistered[1]}`)}</li>
          <li>{t(`Seguro agrícola vigente: ${data.controls.insuranceInForce[0]} de ${data.controls.insuranceInForce[1]}`, `Crop insurance in force: ${data.controls.insuranceInForce[0]} of ${data.controls.insuranceInForce[1]}`)}</li>
          {worstNaranja && <li>{t(`Mayor exposición en naranja: ${usd(worstNaranja.disbursedUsd)}, limitada a lo desembolsado`, `Largest exposure in orange: ${usd(worstNaranja.disbursedUsd)}, limited to what was disbursed`)}</li>}
        </ul>
      </Card>

      {/* 5. Mi riesgo */}
      <section>
        <SectionTitle no="02" title={t("Riesgo de la cartera", "Portfolio risk")} />
        <div className="grid gap-3 lg:grid-cols-3">
          <Card>
            <h3 className="text-[16px] font-bold">{t("Exposición por estado", "Exposure by state")}</h3>
            <Lbl>{t("USD desembolsados", "USD disbursed")}</Lbl>
            <div className="mt-3">
              <StackBar
                total={F.disbursed}
                label={(["verde", "ambar", "naranja", "rojo"] as const).map((s) => `${s} ${usd(F.byState[s].usd)}`).join(", ")}
                segments={[
                  { value: F.byState.verde.usd, className: "bg-bcp-green", label: "verde" },
                  { value: F.byState.ambar.usd, className: "bg-bcp-ambar", label: "ámbar" },
                  { value: F.byState.naranja.usd, className: "bg-bcp-naranja", label: "naranja" },
                  { value: F.byState.rojo.usd, className: "bg-bcp-rojo", label: "rojo" },
                ]}
              />
            </div>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-bcp-border">
                  <Lbl as="th" className="py-1 text-left font-normal">{t("Estado", "State")}</Lbl>
                  <Lbl as="th" className="py-1 text-right font-normal">USD</Lbl>
                  <Lbl as="th" className="py-1 text-right font-normal">{t("Préstamos", "Loans")}</Lbl>
                </tr>
              </thead>
              <tbody className="divide-y divide-bcp-divider">
                {(["verde", "ambar", "naranja", "rojo"] as const).map((s) => (
                  <tr key={s} onClick={() => F.byState[s].n && filterBy(s)} className={F.byState[s].n ? "cursor-pointer hover:bg-bcp-bg" : ""} title={F.byState[s].n ? t("Filtrar los préstamos", "Filter the loans") : undefined}>
                    <td className="py-1.5"><StateChip state={s} /></td>
                    <td className="py-1.5 text-right">{usd(F.byState[s].usd)}</td>
                    <td className="py-1.5 text-right">{F.byState[s].n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card>
            <h3 className="text-[16px] font-bold">{t("Cobertura de repago de la cartera", "Portfolio repayment coverage")}</h3>
            <button type="button" onClick={() => open(coverageDetail(data, t, lang))} className="num mt-1 block text-[36px] font-bold hover:underline">
              {cov(F.coverage)}
            </button>
            <p className="mt-2 flex flex-wrap items-start gap-2 rounded-lg bg-bcp-ambar-bg px-3 py-2 text-sm text-bcp-ambar-text">
              <Estimado />
              <span>
                {t(data.projection.text)}{" "}
                <button type="button" onClick={() => openEvidence("ICA-0188", "El Niño costero")} className="font-semibold underline underline-offset-2">
                  {t("Ver evidencia", "View evidence")}
                </button>
              </span>
            </p>
            <p className="lbl mt-3">
              {t("Ingreso neto de cosecha ÷ saldo al vencimiento, ponderado por lo desembolsado. Umbrales propuestos: ámbar bajo 1.50x, naranja bajo 1.30x, rojo bajo 1.10x.", "Net harvest revenue ÷ amount due at maturity, weighted by disbursement. Proposed thresholds: amber below 1.50x, orange below 1.30x, red below 1.10x.")}
            </p>
          </Card>
          <Card>
            <h3 className="text-[16px] font-bold">{t("Regulatorio y concentración", "Regulatory and concentration")}</h3>
            <div className="mt-2 divide-y divide-bcp-divider text-sm">
              {[
                [t("Clasificación SBS", "SBS rating"), t(`${data.loans.filter((l) => l.sbsRating === "Normal").length} de ${data.loans.length} Normal`, `${data.loans.filter((l) => l.sbsRating === "Normal").length} of ${data.loans.length} Normal`)],
                [t("Provisión requerida", "Required provision"), usd(F.provision)],
                [t("Pérdida esperada", "Expected loss"), t("por calibrar con Riesgos", "to calibrate with Risk")],
                [t("Cultivo", "Crop"), t("palta Hass 100%", "Hass avocado 100%")],
                [t("Zona", "Zone"), `Ica ${pct((ica / F.line) * 100)} · Pisco ${pct(((F.line - ica) / F.line) * 100)}`],
                [t("Packing principal", "Main packhouse"), t(`${data.mainPackhousePct}% de la línea`, `${data.mainPackhousePct}% of the line`)],
              ].map(([k, v], i) => (
                <button type="button" key={k} onClick={() => open(i < 3 ? provisionDetail(data, t) : concentrationDetail(data, t))} className="flex w-full justify-between gap-3 py-1.5 text-left hover:bg-bcp-bg">
                  <span className="lbl">{k}</span>
                  <span className="num text-right font-semibold">{v} <span aria-hidden className="text-bcp-muted">›</span></span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* 03 Qué cambió este mes */}
      <div id="cambios" className="scroll-mt-20" />
      <SectionTitle no="03" title={t("Cambios en la cartera este mes", "Portfolio changes this month")} sub={t(`${date(data.monthFrom, "es")} a ${date(data.cutoff, "es")}`, `${date(data.monthFrom, "en")} to ${date(data.cutoff, "en")}`)} />
      <Card className="py-1.5 sm:py-1.5">
        <ul className="divide-y divide-bcp-divider">
          {data.changes.map((c, i) => {
            const loan = c.loanId ? data.loans.find((l) => l.id === c.loanId) ?? null : null;
            const k = `${c.loanId}:${c.date}`;
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
                    <span className="block text-bcp-muted">
                      {t("Causa", "Cause")}: {t(c.cause)}
                    </span>
                  </p>
                  <span className="flex flex-wrap items-center gap-3">
                    {c.evidence && (
                      <button type="button" onClick={() => openEvidence(c.evidence!.loanId, c.evidence!.condition)} className="min-h-[44px] text-sm font-semibold text-bcp-green-text hover:underline">
                        {t("Evidencia", "Evidence")} ›
                      </button>
                    )}
                    {loan && (
                      <button type="button" onClick={() => setOpenChange(openChange === k ? null : k)} aria-expanded={openChange === k} className="min-h-[44px] text-sm font-semibold text-bcp-ink hover:underline">
                        {openChange === k ? t("Cerrar", "Close") : t("Ver", "View")}
                      </button>
                    )}
                  </span>
                </div>
                {loan && openChange === k && (
                  <div className="mt-3">
                    <AlertCard loan={loan} onOpen={() => onOpen(loan.id)} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {/* 04 Decisiones pendientes */}
      {pending.length > 0 && <SectionTitle no="04" title={t("Decisiones pendientes", "Pending decisions")} sub={t("conformidades del banco", "the bank's conformities")} />}
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

      {/* 05 Préstamos */}
      <div id="prestamos" className="scroll-mt-20" />
      <SectionTitle
        no={pending.length > 0 ? "05" : "04"}
        title={t("Préstamos", "Loans")}
        sub={t("ordenados por estado y exposición", "sorted by state and exposure")}
        right={
          stateFilter ? (
            <button type="button" onClick={() => setStateFilter(null)} className="inline-flex items-center gap-2 text-sm font-semibold text-bcp-ink hover:underline">
              <StateChip state={stateFilter} /> {t("quitar filtro", "clear filter")} ×
            </button>
          ) : undefined
        }
      />
      <Card>
        <LoansTable data={stateFilter ? { ...data, loans: data.loans.filter((l) => l.state === stateFilter) } : data} onOpen={onOpen} />
        <button type="button" onClick={() => setSeason((v) => !v)} aria-expanded={season} className="mt-2 min-h-[44px] text-sm font-semibold text-bcp-green-text hover:underline print:hidden">
          {season ? t("Ocultar calendario de campaña", "Hide campaign calendar") : t("Ver calendario de campaña: tramos, cosecha y vencimiento de cada préstamo", "View campaign calendar: each loan's tranches, harvest and maturity")}
        </button>
        {season && <SeasonCalendar data={data} onOpen={onOpen} />}
        <p className="lbl mt-3">
          {t(
            "Cada dato muestra su fuente y fecha en el expediente. Estado = el más severo entre cobertura de repago y los gatillos acordados (vigor, facturas, labores, cuajado, aforo, deuda).",
            "Each figure shows its source and date in the file. State = the most severe of repayment coverage and the agreed triggers (vigour, invoices, field work, fruit set, field estimate, debt).",
          )}
        </p>
      </Card>

      {/* Applications: the pipeline the bank still has to approve or decline. */}
      {data.applications.length > 0 && (
        <>
          <SectionTitle
            no={pending.length > 0 ? "06" : "05"}
            title={t("Solicitudes en evaluación", "Applications under review")}
            sub={t(`${data.applications.length} por ${usd(data.applications.reduce((s, a) => s + a.requestedUsd, 0))} · nada desembolsado hasta su aprobación`, `${data.applications.length} for ${usd(data.applications.reduce((s, a) => s + a.requestedUsd, 0))} · nothing disbursed until you approve`)}
          />
          <Card>
            <ApplicationsTable apps={data.applications} onOpen={onOpenApp} answers={answers} />
          </Card>
        </>
      )}
    </div>
  );
}

export function LoansTable({ data, onOpen }: { data: P; onOpen: (id: string) => void }) {
  const t = useT();
  const lang = useLang();
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-bcp-border text-left">
            {[t("Cliente", "Client"), t("Estado", "State"), t("Desembolsado", "Disbursed"), t("Próximo tramo", "Next tranche"), t("Cobertura", "Coverage"), t("Vence", "Due"), t("Qué está pasando", "What is happening")].map((h, i) => (
              <Lbl key={h} as="th" className={`py-2 pr-3 font-normal ${i === 2 ? "text-right" : ""}`}>
                {h}
              </Lbl>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-bcp-divider">
          {[...data.loans].sort(bySeverity).map((l) => (
            <tr key={l.id} onClick={() => onOpen(l.id)} className="cursor-pointer align-top hover:bg-bcp-bg">
              <td className="py-2.5 pr-3">
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
              <td className="py-2.5 pr-3">
                {t(l.next.label)}
                <span className="lbl block">{date(l.next.date, lang)}</span>
              </td>
              <td className="py-2.5 pr-3 whitespace-nowrap">
                {cov(l.coverageAtApproval)} → <b>{cov(l.coverageToday)}</b>
                <span className="lbl block">{l.projection ? `${t("proyección", "projection")} ${range(l.projection.low, l.projection.high, lang)}` : t("sin cambio", "no change")}</span>
              </td>
              <td className="py-2.5 pr-3 whitespace-nowrap">{date(l.maturityDate, lang)}</td>
              <td className="max-w-[18rem] py-2.5 text-bcp-ink">{t(l.summary)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
    `Calendario de caja. ${rows.map((r) => `${month(r.month, "es")}: sale ${usd(r.out)}, vuelve ${usd(r.back)}`).join("; ")}. Saldo máximo expuesto ${usd(peak)}${peakMonth ? ` en ${month(peakMonth, "es")}` : ""}.`,
    `Cash calendar. ${rows.map((r) => `${month(r.month, "en")}: out ${usd(r.out)}, back ${usd(r.back)}`).join("; ")}. Peak balance exposed ${usd(peak)}${peakMonth ? ` in ${month(peakMonth, "en")}` : ""}.`,
  );
  return (
    <div className="mt-7 grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
      <div className="min-w-0">
        <h3 className="text-[16px] font-bold">{t("Calendario de caja", "Cash calendar")}</h3>
        <p className="lbl mb-2.5">{t("desembolsos y repagos por mes, con el saldo expuesto", "disbursements and repayments by month, with the balance exposed")}</p>
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
                <td className="py-2 pr-3 text-xs text-bcp-muted">{r.items.map((x) => `${x.loanId} ${t(x.label)}`).join(" · ")}</td>
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
      </div>
    </div>
  );
}

/** "See detail" hint on clickable tiles. */
function More({ dark = false }: { dark?: boolean }) {
  const t = useT();
  return <span className={`mt-1.5 inline-block font-[Arial,Helvetica,sans-serif] text-[12px] font-bold underline-offset-2 group-hover:underline ${dark ? "text-bcp-label" : "text-bcp-green-text"}`}>{t("Ver detalle", "View detail")} ›</span>;
}
