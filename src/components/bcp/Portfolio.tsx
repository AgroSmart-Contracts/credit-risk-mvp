/**
 * Cartera: five headline figures (exposure, coverage, watchlist, controls, next
 * 30 days), then one tab per kind of data (summary, position and funds, risk,
 * loans, applications). Every figure can be recomputed from the loan files.
 */
import { useCallback, useState } from "react";
import { COVERAGE_BANDS, STANDARD_STRESS, bySeverity, cashCalendar, cov, coverageUnder, date, daysBetween, harvestBuild, month, pct, portfolioFigures, range, stateCause, stateFromCoverage, usd, withDate } from "../../lib/bcp/calc";
import type { Loan, Portfolio as P, State } from "../../lib/bcp/types";
import { ApplicationsTable } from "./Applications";
import { appKey, type Answer } from "./answers";
import { BANK_EDITION } from "./edition";
import { Btn, Card, Estimado, ExampleChip, Lbl, Modal, PageTabs, SectionTitle, StackBar, StateChip } from "./ui";
import { useEvidence, useLang, useT } from "./shared";

type PortfolioTab = "resumen" | "posicion" | "riesgo" | "prestamos" | "solicitudes";
/** Survives opening a file, so Back returns to the same tab. */
let lastTab: PortfolioTab = "resumen";

export function Portfolio({ data, onOpen, onOpenApp, onReport, onDecisions, answers }: { data: P; onOpen: (id: string) => void; onOpenApp: (id: string) => void; onReport: () => void; onDecisions: () => void; answers: Record<string, Answer>; onAnswer: (k: string, a: Answer) => void }) {
  const t = useT();
  const lang = useLang();
  const F = portfolioFigures(data.loans);
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
  const ica = data.loans.filter((l) => l.id.startsWith("ICA")).reduce((s, l) => s + l.lineUsd, 0);
  // Watchlist: every loan not in green, by why it has its colour.
  const watch = [...data.loans].filter((l) => l.state !== "verde").sort(bySeverity);
  const byCause = (c: ReturnType<typeof stateCause>) => watch.filter((l) => stateCause(l) === c).length;
  // Next 30 days: tranches against milestones and the bank's own decisions.
  const within30 = (d: string) => daysBetween(data.cutoff, d) <= 30;
  const nextTranches = data.loans.flatMap((l) => l.tranches.filter((x) => x.status === "pendiente" && within30(x.milestoneDate)));
  const bankDecisions = data.loans.flatMap((l) => l.decisions.filter((d) => d.lane === "bank" && !d.conformityDate && within30(d.dueDate ?? d.date))).length + data.applications.filter((a) => !answers[appKey(a)] && within30(a.decisionDueDate)).length;
  const appsOpen = data.applications.filter((a) => !answers[appKey(a)]);
  const portfolioWatch = data.changes.find((c) => c.loanId === null);
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
          { k: t("Exposición hoy", "Exposure today"), v: usd(F.disbursed), s: t(`${pct((F.disbursed / F.line) * 100)} de ${usd(F.line)} · máximo ${usd(F.due)} con todos los tramos`, `${pct((F.disbursed / F.line) * 100)} of ${usd(F.line)} · at most ${usd(F.due)} with every tranche`), go: () => setPage("posicion"), dark: true },
          { k: t("Cobertura de repago", "Repayment coverage"), v: cov(F.coverage), s: t(`proyectada ${range(data.projection.low, data.projection.high, "es")} · precio −20%: ${cov(F.stress.price.coverage)}`, `projected ${range(data.projection.low, data.projection.high, "en")} · price −20%: ${cov(F.stress.price.coverage)}`), go: () => setPage("riesgo") },
          { k: t("En seguimiento", "On the watchlist"), v: `${watch.length} ${t("de", "of")} ${data.loans.length}`, s: t(`${byCause("control")} por control · ${byCause("tecnica")} por señal técnica · ${byCause("cobertura")} por cobertura`, `${byCause("control")} on a control · ${byCause("tecnica")} on a technical signal · ${byCause("cobertura")} on coverage`), go: () => setPage("resumen") },
          { k: t("Control del dinero", "Control of funds"), v: pct(F.reconciledPct), s: t(`conciliado · ${pct(F.directPct)} pagado directo · ${usd(F.unexplained)} sin sustento`, `reconciled · ${pct(F.directPct)} paid direct · ${usd(F.unexplained)} unexplained`), go: () => setPage("posicion") },
          { k: t("Próximos 30 días", "Next 30 days"), v: usd(nextTranches.reduce((s, x) => s + x.amountUsd, 0)), s: t(`${nextTranches.length} tramos contra hitos · ${bankDecisions} decisiones del banco`, `${nextTranches.length} tranches against milestones · ${bankDecisions} bank decisions`), go: onDecisions },
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
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
      </section>

      <div className="grid gap-3 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <h3 className="text-[16px] font-bold">{t("Estrés de la cartera", "Portfolio stress")}</h3>
          <p className="lbl">{t("Sobre ingreso neto: packing, cosecha, transporte a puerto y comisiones no bajan con el precio.", "On net revenue: packing, harvest, transport to port and fees do not fall with the price.")}</p>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b border-bcp-border">
                {[t("Escenario", "Scenario"), t("Cobertura", "Coverage"), t(`Bajo ${cov(COVERAGE_BANDS.ambar)}`, `Below ${cov(COVERAGE_BANDS.ambar)}`), t(`Bajo ${cov(COVERAGE_BANDS.naranja)}`, `Below ${cov(COVERAGE_BANDS.naranja)}`), t(`Bajo ${cov(COVERAGE_BANDS.rojo)}`, `Below ${cov(COVERAGE_BANDS.rojo)}`)].map((h, i) => (
                  <Lbl key={h} as="th" className={`py-1.5 font-normal ${i ? "text-right" : "text-left"}`}>{h}</Lbl>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-bcp-divider">
              {([
                [t("Hoy", "Today"), F.stress.today],
                [t("Precio −20%", "Price −20%"), F.stress.price],
                [t("Volumen −30%", "Volume −30%"), F.stress.volume],
                [t("Ambos a la vez", "Both at once"), F.stress.both],
              ] as const).map(([k, x]) => (
                <tr key={k}>
                  <td className="py-2">{k}</td>
                  <td className="num py-2 text-right"><StateChip state={stateFromCoverage(x.coverage)} suffix={` ${cov(x.coverage)}`} /></td>
                  <td className="num py-2 text-right">{x.below.ambar}</td>
                  <td className="num py-2 text-right">{x.below.naranja}</td>
                  <td className="num py-2 text-right">{x.below.rojo}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="lbl mt-2">{t(`Estándar: precio −20% y volumen −30%, cada uno por separado; "ambos" es el caso severo. Cobertura de la cartera = ${usd(F.netRevenue)} de ingreso neto ÷ ${usd(F.due)} de saldos.`, `Standard: price −20% and volume −30%, each on its own; "both" is the severe case. Portfolio coverage = ${usd(F.netRevenue)} net revenue ÷ ${usd(F.due)} amounts due.`)}</p>
        </Card>
        <Card>
          <h3 className="text-[16px] font-bold">{t("Concentración", "Concentration")}</h3>
          <Concentration data={data} lines={F.line} ica={ica} />
        </Card>
      </div>

      <Card>
        <h3 className="text-[16px] font-bold">{t("Cobertura por préstamo: cómo se llega a cada cifra", "Coverage by loan: how each figure is reached")}</h3>
        <div className="-mx-4 mt-2 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <table className="w-full min-w-[980px] text-sm">
            <thead><tr className="border-b border-bcp-border">{[t("Préstamo", "Loan"), t("Estado", "State"), t("Ingreso neto", "Net revenue"), t("Saldo al vencimiento", "Due at maturity"), t("Aprobación → hoy", "Approval → today"), t("Precio −20%", "Price −20%"), t("Volumen −30%", "Volume −30%"), t("Equilibrio", "Break-even"), t("Proyección", "Projection")].map((h, i) => <Lbl key={h} as="th" className={`py-1.5 pr-3 font-normal ${i > 1 ? "text-right" : "text-left"}`}>{h}</Lbl>)}</tr></thead>
            <tbody className="divide-y divide-bcp-divider">
              {[...data.loans].sort(bySeverity).map((l) => {
                const b = harvestBuild(l);
                const [p, v] = [coverageUnder(l, STANDARD_STRESS.price), coverageUnder(l, 0, STANDARD_STRESS.volume)];
                return (
                  <tr key={l.id} onClick={() => onOpen(l.id)} className="cursor-pointer hover:bg-bcp-bg">
                    <td className="py-2 pr-3 font-semibold">{l.id}</td>
                    <td className="py-2 pr-3"><StateChip state={l.state} cause={stateCause(l)} /></td>
                    <td className="num py-2 pr-3 text-right">{usd(b.netUsd)}</td>
                    <td className="num py-2 pr-3 text-right">{usd(l.dueAtMaturityUsd)}</td>
                    <td className="num whitespace-nowrap py-2 pr-3 text-right">{cov(l.coverageAtApproval)} → <b>{cov(l.coverageToday)}</b></td>
                    <td className={`num py-2 pr-3 text-right ${p < COVERAGE_BANDS.ambar ? "font-semibold text-bcp-naranja-text" : ""}`}>{cov(p)}</td>
                    <td className={`num py-2 pr-3 text-right ${v < COVERAGE_BANDS.ambar ? "font-semibold text-bcp-naranja-text" : ""}`}>{cov(v)}</td>
                    <td className="num whitespace-nowrap py-2 pr-3 text-right">USD {l.breakEvenPriceUsdKg.toFixed(2)}/kg</td>
                    <td className="num whitespace-nowrap py-2 text-right">{l.projection ? range(l.projection.low, l.projection.high, lang) : t("sin cambio", "no change")}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-bcp-ink font-bold">
                <td className="py-2 pr-3">{t("Cartera", "Portfolio")}</td>
                <td />
                <td className="num py-2 pr-3 text-right">{usd(F.netRevenue)}</td>
                <td className="num py-2 pr-3 text-right">{usd(F.due)}</td>
                <td className="num py-2 pr-3 text-right">{cov(F.coverage)}</td>
                <td className="num py-2 pr-3 text-right">{cov(F.stress.price.coverage)}</td>
                <td className="num py-2 pr-3 text-right">{cov(F.stress.volume.coverage)}</td>
                <td />
                <td className="num whitespace-nowrap py-2 text-right">{range(data.projection.low, data.projection.high, lang)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="lbl mt-2">
          {t("Cobertura = ingreso neto de cosecha ÷ saldo al vencimiento (línea completa más costo estimado). Umbrales propuestos: ámbar bajo 1.50x, naranja bajo 1.30x, rojo bajo 1.10x. Cada fila abre el expediente con la construcción completa.", "Coverage = net harvest revenue ÷ amount due at maturity (full line plus estimated cost). Proposed thresholds: amber below 1.50x, orange below 1.30x, red below 1.10x. Each row opens the file with the full build.")}{" "}
          {t(data.projection.text).replace(/^(Proyección|Projection) \S+ (a|to) \S+ /, (m) => (m.startsWith("P") && lang === "es" ? "Proyección " : "Projection "))}
        </p>
      </Card>
      </>}

      {page === "resumen" && <>
      <SectionTitle title={t("En seguimiento", "On the watchlist")} sub={t("Estado = el peor entre la banda de cobertura de hoy y los controles del contrato. La proyección anticipa; no fija el estado.", "State = the worse of today's coverage band and the contract controls. The projection anticipates; it does not set the state.")} />
      <Card>
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-bcp-border text-left">
                {[t("Préstamo", "Loan"), t("Estado y causa", "State and cause"), t("Cobertura hoy", "Coverage today"), t("Banda", "Band"), t("Proyección", "Projection"), t("Precio −20%", "Price −20%"), t("Qué sigue", "What is next")].map((h, i) => (
                  <Lbl key={h} as="th" className={`py-2 pr-3 font-normal ${i === 2 || i === 4 || i === 5 ? "text-right" : ""}`}>{h}</Lbl>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-bcp-divider">
              {watch.map((l) => {
                const p20 = coverageUnder(l, STANDARD_STRESS.price);
                return (
                  <tr key={l.id} onClick={() => onOpen(l.id)} className="cursor-pointer align-top hover:bg-bcp-bg">
                    <td className="py-2.5 pr-3">
                      <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(l.id); }} className="text-left font-semibold hover:underline">{l.id}</button>
                      <span className="lbl block">{t(l.zone)}</span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <StateChip state={l.state} cause={stateCause(l)} />
                      {l.alert && <span className="lbl block max-w-[280px]">{t(l.alert.text)}</span>}
                    </td>
                    <td className="num py-2.5 pr-3 text-right font-semibold">{cov(l.coverageToday)}</td>
                    <td className="py-2.5 pr-3"><StateChip state={stateFromCoverage(l.coverageToday)} /></td>
                    <td className="num whitespace-nowrap py-2.5 pr-3 text-right">{l.projection ? range(l.projection.low, l.projection.high, lang) : t("sin cambio", "no change")}</td>
                    <td className={`num py-2.5 pr-3 text-right font-semibold ${p20 < COVERAGE_BANDS.ambar ? "text-bcp-naranja-text" : ""}`}>{cov(p20)}</td>
                    <td className="py-2.5 pr-3">{withDate(t(l.next.label), l.next.date, lang)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {portfolioWatch && (
          <p className="mt-3 border-t border-bcp-divider pt-3 text-sm">
            <StateChip state={portfolioWatch.to} /> <b className="font-semibold">{t("Toda la cartera", "Whole portfolio")}:</b> {t(portfolioWatch.impact)}{" "}
            <button type="button" onClick={() => setCauseOf(portfolioWatch)} className="min-h-[44px] font-semibold text-bcp-green-text underline-offset-2 hover:underline">{t("Ver causa", "View cause")}</button>
            {!BANK_EDITION && portfolioWatch.evidence && (
              <button type="button" onClick={() => openEvidence(portfolioWatch.evidence!.loanId, portfolioWatch.evidence!.condition)} className="ml-3 min-h-[44px] font-semibold text-bcp-green-text hover:underline">{t("Evidencia", "Evidence")} ›</button>
            )}
          </p>
        )}
      </Card>
      {causeOf && (
        <Modal title={t("Causa · Toda la cartera", "Cause · Whole portfolio")} onClose={closeCause} footer={<Btn onClick={closeCause}>{t("Cerrar", "Close")}</Btn>}>
          <p className="text-sm font-semibold text-bcp-ink">{t(causeOf.impact)}</p>
          <p className="mt-2 text-sm text-bcp-ink">{t(causeOf.cause).replace(/^./, (x) => x.toUpperCase())}</p>
        </Modal>
      )}
      {bankDecisions > 0 && (
        <Card tone="decision">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <b className="font-semibold">{t(`${bankDecisions} decisiones del banco en los próximos 30 días`, `${bankDecisions} bank decisions in the next 30 days`)}</b>
              <span className="lbl block">{t(`${appsOpen.length} solicitudes y las conformidades de tramo`, `${appsOpen.length} applications and the tranche conformities`)}</span>
            </p>
            <Btn primary onClick={onDecisions}>{t("Ir a Decisiones", "Go to Decisions")}</Btn>
          </div>
        </Card>
      )}
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
            "Cada dato muestra su fuente y fecha en el expediente. Estado = el peor entre la banda de cobertura y los controles del contrato; las señales técnicas (vigor, clima) mueven la cobertura y no fijan el color por sí solas.",
            "Each figure shows its source and date in the file. State = the worse of the coverage band and the contract controls; technical signals (vigour, weather) move coverage and do not set the colour on their own.",
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

/** Largest borrower, maturity month, buyer, packhouse and zone, as shares of the lines. */
function Concentration({ data, lines, ica }: { data: P; lines: number; ica: number }) {
  const t = useT();
  const lang = useLang();
  const largest = data.loans.reduce((m, l) => (l.lineUsd > m.lineUsd ? l : m), data.loans[0]);
  const byMonth = new Map<string, { usd: number; ids: string[] }>();
  for (const l of data.loans) {
    const m = byMonth.get(l.maturityDate.slice(0, 7)) ?? { usd: 0, ids: [] };
    byMonth.set(l.maturityDate.slice(0, 7), { usd: m.usd + l.lineUsd, ids: [...m.ids, l.id] });
  }
  const [topMonth, top] = [...byMonth.entries()].sort((a, b) => b[1].usd - a[1].usd)[0];
  const rows: [string, string, string][] = [
    [t("Mayor prestatario", "Largest borrower"), pct((largest.lineUsd / lines) * 100), t(`${largest.id} · ${usd(largest.lineUsd)} de ${usd(lines)}`, `${largest.id} · ${usd(largest.lineUsd)} of ${usd(lines)}`)],
    [t("Mes de vencimiento", "Maturity month"), pct((top.usd / lines) * 100), `${month(`${topMonth}-01`, lang)} · ${usd(top.usd)} (${top.ids.join(", ")})`],
    [t("Comprador", "Buyer"), t("por informar", "to be provided"), t("se completa con los contratos de venta", "completed with the sale contracts")],
    [t("Packing principal", "Main packhouse"), `${data.mainPackhousePct}%`, t("de las líneas", "of the lines")],
    [t("Zona", "Zone"), `Ica ${pct((ica / lines) * 100)}`, `Pisco ${pct(((lines - ica) / lines) * 100)} · ${t("palta Hass 100%", "Hass avocado 100%")}`],
  ];
  return (
    <table className="mt-2 w-full text-sm">
      <tbody className="divide-y divide-bcp-divider">
        {rows.map(([k, v, n]) => (
          <tr key={k} className="align-top">
            <td className="py-2 pr-3">{k}</td>
            <td className="num whitespace-nowrap py-2 pr-3 text-right font-bold">{v}</td>
            <td className="py-2 text-bcp-muted">{n}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
              <td className="py-2.5 pr-3"><StateChip state={l.state} cause={stateCause(l)} /></td>
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
          <StateChip state={situationOf.state} cause={stateCause(situationOf)} />
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
  const pts = rows.map((r) => (bal = bal + r.out - r.principal));
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
          <span><span className="mr-1 inline-block h-2.5 w-2.5 bg-bcp-green align-[-1px]" />{t("repago al vencimiento: capital más costo estimado", "repaid at maturity: principal plus estimated cost")}</span>
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
            `Misma base que la cobertura: el congelado de ${usd(F.frozen)} figura como si se liberara y cada vencimiento es el saldo completo (capital más costo estimado). El saldo expuesto sigue el capital.`,
            `Same basis as coverage: the ${usd(F.frozen)} frozen is shown as if released and each maturity is the full amount due (principal plus estimated cost). The balance exposed follows principal.`,
          )}
        </p>
        {movesOf && (
          <Modal title={t(`Movimientos · ${month(movesOf.month, "es")}`, `Movements · ${month(movesOf.month, "en")}`)} onClose={closeMoves} footer={<Btn onClick={closeMoves}>{t("Cerrar", "Close")}</Btn>}>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-bcp-divider">
                {movesOf.items.map((x, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-3 font-semibold">{x.loanId}</td>
                    <td className="py-2 pr-3 text-bcp-muted">{x.dir === "out" ? `${t("Desembolso", "Disbursement")} ${t(x.label)}` : `${t("Repago", "Repayment")}: ${t(x.label)}`}</td>
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

