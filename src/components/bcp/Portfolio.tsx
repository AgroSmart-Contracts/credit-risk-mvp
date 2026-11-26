/**
 * Cartera: five headline figures (exposure, coverage, watchlist, controls, next
 * 30 days), then one tab per kind of data (summary, position and funds, risk,
 * loans, applications). Every figure can be recomputed from the loan files.
 */
import { useCallback, useState, type ReactNode } from "react";
import { ChevronRight, FilterX } from "lucide-react";
import { COVERAGE_BANDS, STANDARD_STRESS, bySeverity, cashCalendar, cov, coverageUnder, date, daysBetween, harvestBuild, month, pct, portfolioFigures, range, stateCause, stateFromCoverage, usd, withDate } from "../../lib/bcp/calc";
import type { Loan, Portfolio as P, State } from "../../lib/bcp/types";
import { ApplicationsTable } from "./Applications";
import { appKey, type Answer } from "./answers";
import { BANK_EDITION } from "./edition";
import { Btn, Card, Estimado, Lbl, Modal, PageTabs, SectionTitle, StackBar, StateChip } from "./ui";
import { CoverageLegend, CoverageTrend, SourceStrip } from "./Repayment";
import { BankCostCard, SbsSimulator } from "./RiskTools";
import { useEvidence, useLang, useT } from "./shared";

const STRESS_LEVELS = ["verde", "ambar", "naranja", "rojo"] as const;
const WATCH_EDGE: Record<State, string> = { verde: "border-l-bcp-green", ambar: "border-l-bcp-ambar", naranja: "border-l-bcp-naranja", rojo: "border-l-bcp-rojo", veto: "border-l-bcp-rojo" };
const LEVEL_SHORT = { verde: { es: "Bajo", en: "Low" }, ambar: { es: "Medio", en: "Medium" }, naranja: { es: "Elevado", en: "Elevated" }, rojo: { es: "Alto", en: "High" } } as const;
const LEVEL_INK: Record<State, string> = { verde: "text-bcp-green-text", ambar: "text-bcp-ambar-text", naranja: "text-bcp-naranja-text", rojo: "text-bcp-rojo-text", veto: "text-bcp-rojo-text" };

type PortfolioTab = "resumen" | "posicion" | "riesgo" | "prestamos" | "solicitudes";
type Tile = "exposicion" | "cobertura" | "seguimiento" | "control" | "proximos";
/** Each headline figure opens a tab (and, for two of them, a section in it). */
const TILE_TAB: Record<Tile, { tab: PortfolioTab; section?: string }> = {
  exposicion: { tab: "posicion" },
  cobertura: { tab: "riesgo" },
  seguimiento: { tab: "resumen" },
  control: { tab: "posicion", section: "control-de-fondos" },
  proximos: { tab: "resumen", section: "proximos-30-dias" },
};
/** Survive opening a file, so Back returns to the same tab and figure. */
let lastTab: PortfolioTab = "resumen";
let lastTile: Tile | null = "seguimiento";

export function Portfolio({ data, onOpen, onOpenApp, onReport, onDecisions, answers }: { data: P; onOpen: (id: string) => void; onOpenApp: (id: string) => void; onReport: () => void; onDecisions: () => void; answers: Record<string, Answer>; onAnswer: (k: string, a: Answer) => void }) {
  const t = useT();
  const lang = useLang();
  const F = portfolioFigures(data.loans);
  const [page, setPageState] = useState<PortfolioTab>(lastTab);
  const [tile, setTileState] = useState<Tile | null>(lastTile);
  // One way only: a figure opens its tab, but choosing a tab leaves the figure highlight as it is.
  const setPage = (tab: PortfolioTab) => {
    lastTab = tab;
    setPageState(tab);
  };
  const openTile = (k: Tile) => {
    const { tab, section } = TILE_TAB[k];
    lastTab = tab;
    lastTile = k;
    setPageState(tab);
    setTileState(k);
    if (section) requestAnimationFrame(() => document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const openEvidence = useEvidence();
  // Clicking a state in "exposure by state" filters the loans table.
  const [stateFilter, setStateFilter] = useState<State | null>(null);
  const [causeOf, setCauseOf] = useState<P["changes"][number] | null>(null);
  const closeCause = useCallback(() => setCauseOf(null), []);
  const [tierBy, setTierBy] = useState<"count" | "volume">("count");
  // Watchlist: every loan not in green, by why it has its colour.
  const watch = [...data.loans].filter((l) => l.state !== "verde").sort(bySeverity);
  // Next 30 days: tranches against milestones and the bank's own decisions.
  const within30 = (d: string) => daysBetween(data.cutoff, d) <= 30;
  const nextTranches = data.loans.flatMap((l) => l.tranches.filter((x) => x.status === "pendiente" && within30(x.milestoneDate)));
  const appsDue = data.applications.filter((a) => !answers[appKey(a)] && within30(a.decisionDueDate));
  const portfolioWatch = data.changes.find((c) => c.loanId === null);
  const frozenLoan = data.loans.find((l) => l.frozenUsd > 0);
  const sevenOfSeven = `${F.tranchesWithConformity} ${t("de", "of")} ${F.tranchesReleased}`;

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <Btn onClick={onReport}>{t("Descargar reporte mensual (PDF)", "Download monthly report (PDF)")}</Btn>
      </header>

      <SourceStrip cutoff={data.cutoff} />

      {/* Headline figures: label and figure; the one in view is highlighted. */}
      <section aria-label={t("Situación de la cartera", "Portfolio situation")} className="grid gap-px overflow-hidden rounded-xl border border-bcp-border bg-bcp-border sm:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1fr_1fr]">
        {([
          {
            id: "exposicion",
            k: t("Exposición hoy", "Exposure today"),
            v: usd(F.disbursed),
            // The approved line is the reference for everything else: it gets its own line and a bar.
            line: (
              <span className="mt-1 block w-full">
                <span className="block text-[15px] font-semibold">{t(`de una línea de ${usd(F.line)}`, `of a ${usd(F.line)} line`)}</span>
                <span className="mt-1.5 flex items-center gap-2">
                  <span aria-hidden className="block h-1.5 flex-1 overflow-hidden rounded-full bg-current/20">
                    <span className="block h-full rounded-full bg-current" style={{ width: `${(F.disbursed / F.line) * 100}%` }} />
                  </span>
                  <span className="num text-[12px] font-semibold">{pct((F.disbursed / F.line) * 100)}</span>
                </span>
              </span>
            ),
          },
          { id: "cobertura", k: t("Cobertura de repago", "Repayment coverage"), v: cov(F.coverage) },
          { id: "seguimiento", k: t("Préstamos en seguimiento", "Loans on the watchlist"), v: `${watch.length} ${t("de", "of")} ${data.loans.length}` },
          { id: "control", k: t("Fondos conciliados", "Funds reconciled"), v: pct(F.reconciledPct) },
          { id: "proximos", k: t("Tramos en los próximos 30 días", "Tranches in the next 30 days"), v: usd(nextTranches.reduce((s, x) => s + x.amountUsd, 0)) },
        ] as { id: Tile; k: string; v: string; line?: ReactNode }[]).map((x, i) => {
          const on = tile === x.id;
          return (
            <button key={x.id} type="button" aria-pressed={on} onClick={() => openTile(x.id)} className={`flex flex-col items-start justify-start px-4 py-4 text-left transition-colors ${i === 0 ? "sm:col-span-2 xl:col-span-1" : ""} ${on ? "bg-bcp-ink text-white" : "bg-white text-bcp-ink hover:bg-bcp-bg"}`}>
              <span className={`font-[Arial,Helvetica,sans-serif] text-[12px] ${on ? "text-bcp-label" : "text-bcp-muted"}`}>{x.k}</span>
              <span className="num mt-1 whitespace-nowrap text-[24px] font-bold leading-tight">{x.v}</span>
              {x.line}
            </button>
          );
        })}
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
        <div className="mt-4 grid gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { k: t("Desembolsado", "Disbursed"), v: usd(F.disbursed), n: "", rule: "border-bcp-ink", sw: "bg-bcp-ink" },
            { k: t("Congelado", "Frozen"), v: usd(F.frozen), n: "", rule: "border-bcp-naranja", sw: "hatch" },
            { k: t("Por desembolsar", "Undrawn"), v: usd(F.pending), n: "", rule: "border-bcp-fill-strong", sw: "bg-bcp-fill" },
            { k: t("Vencimientos de capital", "Principal maturities"), v: "", n: F.maturities.map(([m, v]) => `${month(`${m}-01`, lang)} · ${usd(v)}`).join("\n"), rule: "border-bcp-green", sw: "" },
          ].map((x) => (
            <div key={x.k} className={`border-l-[3px] pl-3.5 pr-4 ${x.rule}`}>
              <span className="lbl block">
                {x.sw && <span className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-[-1px] ${x.sw}`} aria-hidden />}
                {x.k}
              </span>
              {x.v && <span className="num block text-[22px] font-bold">{x.v}</span>}
              {x.n && <span className={x.v ? "lbl block" : "block whitespace-pre-line text-[15px] font-bold"}>{x.n}</span>}
            </div>
          ))}
        </div>
        <CashCalendar data={data} F={F} />
      </Card>

      <Card tone="control">
        <div id="control-de-fondos" className="mb-3 scroll-mt-40">
          <h2 className="text-[20px] font-bold">{t("Control de fondos", "Control of funds")}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { big: sevenOfSeven, s: t("tramos liberados con checklist completo y conformidad del banco", "tranches released with a complete checklist and the bank's sign-off") },
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
          <li>{t(`Central de riesgos reconsultada en el mes: ${data.controls.bureauRechecked[0]} de ${data.controls.bureauRechecked[1]} deudores`, `Credit bureau rechecked this month: ${data.controls.bureauRechecked[0]} of ${data.controls.bureauRechecked[1]} borrowers`)}</li>
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
            <tfoot>
              <tr className="border-t-2 border-bcp-ink font-bold">
                <td className="py-2">{t("Total", "Total")}</td>
                <td className="py-2 text-right">{usd(F.line)}</td>
                <td className="py-2 text-right">{usd(F.disbursed)}</td>
                <td className="py-2 text-right">{usd(F.frozen)}</td>
                <td className="py-2 text-right">{usd(F.pending)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
      </>}

      {page === "riesgo" && <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card className="col-span-2 lg:col-span-1">
          <Lbl>{t("Proyección", "Projection")}</Lbl>
          <p className="num mt-1 flex flex-wrap items-center gap-2 text-[22px] font-bold">{range(data.projection.low, data.projection.high, lang)} <Estimado /></p>
        </Card>
        {[
          [t("Clasificación SBS", "SBS rating"), t(`${data.loans.filter((l) => l.sbsRating === "Normal").length} de ${data.loans.length} Normal`, `${data.loans.filter((l) => l.sbsRating === "Normal").length} of ${data.loans.length} Normal`)],
          [t("Pérdida esperada", "Expected loss"), t("Por calibrar", "To be calibrated")],
        ].map(([k, v]) => (
          <Card key={k}>
            <Lbl>{k}</Lbl>
            <p className="num mt-1 text-[22px] font-bold">{v}</p>
          </Card>
        ))}
      </section>

      <div className="grid gap-3 xl:grid-cols-2 [&>*]:min-w-0">
        <BankCostCard loans={data.loans} />
        <SbsSimulator loans={data.loans} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <h3 className="text-[16px] font-bold">{t("Estrés de la cartera", "Portfolio stress")}</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[440px] text-sm">
              <thead>
                <tr className="border-b border-bcp-border align-bottom">
                  <Lbl as="th" className="py-1.5 pr-2 text-left font-normal">{t("Escenario", "Scenario")}</Lbl>
                  <Lbl as="th" className="py-1.5 pr-2 text-right font-normal">{t("Cobertura", "Coverage")}</Lbl>
                  {/* Loans by risk level: each loan in exactly one column, so a row adds up to the portfolio. */}
                  {([
                    ["verde", `≥${cov(COVERAGE_BANDS.ambar)}`],
                    ["ambar", t(`${COVERAGE_BANDS.naranja.toFixed(2)} a ${cov(COVERAGE_BANDS.ambar)}`, `${COVERAGE_BANDS.naranja.toFixed(2)} to ${cov(COVERAGE_BANDS.ambar)}`)],
                    ["naranja", t(`${COVERAGE_BANDS.rojo.toFixed(2)} a ${cov(COVERAGE_BANDS.naranja)}`, `${COVERAGE_BANDS.rojo.toFixed(2)} to ${cov(COVERAGE_BANDS.naranja)}`)],
                    ["rojo", `<${cov(COVERAGE_BANDS.rojo)}`],
                  ] as const).map(([lv, r]) => (
                    <Lbl key={lv} as="th" className="whitespace-nowrap py-1.5 pl-2 text-right font-normal">
                      <span className="block">{t(LEVEL_SHORT[lv])}</span>
                      <span className="num">{r}</span>
                    </Lbl>
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
                    <td className="whitespace-nowrap py-2 pr-2">{k}</td>
                    <td className={`num py-2 pr-2 text-right font-semibold ${LEVEL_INK[stateFromCoverage(x.coverage)]}`}>{cov(x.coverage)}</td>
                    {STRESS_LEVELS.map((lv) => (
                      <td key={lv} className={`num py-2 pl-2 text-right ${x.levels[lv] ? "font-semibold" : "text-bcp-muted/50"}`}>{x.levels[lv]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Lbl className="mt-2">{t("Número de préstamos en cada nivel de riesgo.", "Number of loans at each risk level.")}</Lbl>
        </Card>
        <Card>
          <h3 className="text-[16px] font-bold">{t("Concentración", "Concentration")}</h3>
          <Concentration data={data} lines={F.line} />
        </Card>
      </div>

      <Card>
        <h3 className="text-[16px] font-bold">{t("Cobertura por préstamo: cómo se llega a cada cifra", "Coverage by loan: how each figure is reached")}</h3>
        <div className="-mx-4 mt-2 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <table className="w-full min-w-[820px] text-sm">
            <thead><tr className="border-b border-bcp-border">{[t("Préstamo", "Loan"), t("Estado", "State"), t("Ingreso neto", "Net revenue"), t("Saldo al vencimiento", "Due at maturity"), t("Aprobación → hoy", "Approval → today"), t("Equilibrio", "Break-even"), t("Proyección", "Projection")].map((h, i) => <Lbl key={h} as="th" className={`py-1.5 pr-3 font-normal ${i > 1 ? "text-right" : "text-left"}`}>{h}</Lbl>)}</tr></thead>
            <tbody className="divide-y divide-bcp-divider">
              {[...data.loans].sort(bySeverity).map((l) => {
                const b = harvestBuild(l);
                return (
                  <tr key={l.id} onClick={() => onOpen(l.id)} className="cursor-pointer hover:bg-bcp-bg">
                    <td className="py-2 pr-3 font-semibold">{l.id}</td>
                    <td className="py-2 pr-3"><StateChip state={l.state} cause={stateCause(l)} /></td>
                    <td className="num py-2 pr-3 text-right">{usd(b.netUsd)}</td>
                    <td className="num py-2 pr-3 text-right">{usd(l.dueAtMaturityUsd)}</td>
                    <td className="num whitespace-nowrap py-2 pr-3 text-right">{cov(l.coverageAtApproval)} → <b>{cov(l.coverageToday)}</b></td>
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
                <td />
                <td className="num whitespace-nowrap py-2 text-right">{range(data.projection.low, data.projection.high, lang)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
      </>}

      {page === "resumen" && <>
      {/* Capital and repayment at a glance; the detail sits in Position and Risk. */}
      <div className="grid gap-3 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[16px] font-bold">{t("Capital y vencimientos", "Capital and maturities")}</h3>
            <button type="button" onClick={() => setPage("posicion")} className="min-h-[36px] text-sm font-semibold text-bcp-green-text hover:underline">{t("Ver calendario", "View calendar")} ›</button>
          </div>
          <div className="mt-3">
            <StackBar
              height="h-[14px]"
              total={F.line}
              label={t(`Línea de ${usd(F.line)}: desembolsado ${usd(F.disbursed)}, congelado ${usd(F.frozen)}, por desembolsar ${usd(F.pending)}`, `Line of ${usd(F.line)}: disbursed ${usd(F.disbursed)}, frozen ${usd(F.frozen)}, to disburse ${usd(F.pending)}`)}
              segments={[
                { value: F.disbursed, className: "bg-bcp-ink", label: "desembolsado" },
                { value: F.frozen, className: "hatch", label: "congelado" },
                { value: F.pending, className: "bg-bcp-fill", label: "por desembolsar" },
              ]}
            />
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-3">
            {[
              [t("Desembolsado", "Disbursed"), usd(F.disbursed), ""],
              [t("Congelado", "Frozen"), usd(F.frozen), "text-bcp-naranja-text"],
              [t("Por desembolsar", "Undrawn"), usd(F.pending), ""],
            ].map(([k, v, c]) => (
              <div key={k}>
                <dt className="lbl">{k}</dt>
                <dd className={`num text-[17px] font-bold ${c}`}>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 border-t border-bcp-divider pt-3 text-sm">
            <span className="text-bcp-muted">{t("Vencimientos de capital", "Principal maturities")}:</span>{" "}
            <b className="num font-semibold">{F.maturities.map(([m, v]) => `${month(`${m}-01`, lang)} ${usd(v)}`).join(" · ")}</b>
          </p>
        </Card>
        <Card>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[16px] font-bold">{t("Cobertura y estrés estándar", "Coverage and standard stress")}</h3>
            <button type="button" onClick={() => setPage("riesgo")} className="min-h-[36px] text-sm font-semibold text-bcp-green-text hover:underline">{t("Ver riesgo", "View risk")} ›</button>
          </div>
          <table className="mt-2 w-full text-sm">
            <tbody className="divide-y divide-bcp-divider">
              {([
                [t("Hoy", "Today"), F.stress.today],
                [t("Precio −20%", "Price −20%"), F.stress.price],
                [t("Volumen −30%", "Volume −30%"), F.stress.volume],
                [t("Ambos a la vez", "Both at once"), F.stress.both],
              ] as const).map(([k, x]) => {
                const below = data.loans.length - x.levels.verde;
                return (
                  <tr key={k}>
                    <td className="whitespace-nowrap py-2 pr-3">{k}</td>
                    <td className={`num py-2 pr-3 text-right font-semibold ${LEVEL_INK[stateFromCoverage(x.coverage)]}`}>{cov(x.coverage)}</td>
                    <td className="py-2 text-right text-[13px] text-bcp-muted">
                      {below ? t(`${below} de ${data.loans.length} préstamos bajo ${cov(COVERAGE_BANDS.ambar)}`, `${below} of ${data.loans.length} loans below ${cov(COVERAGE_BANDS.ambar)}`) : t(`todos sobre ${cov(COVERAGE_BANDS.ambar)}`, `all above ${cov(COVERAGE_BANDS.ambar)}`)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[13px] text-bcp-muted">{t(`Proyección ${range(data.projection.low, data.projection.high, "es")} (estimado)`, `Projection ${range(data.projection.low, data.projection.high, "en")} (estimate)`)}</p>
        </Card>
      </div>

      <SectionTitle
        title={t("En seguimiento", "On the watchlist")}
        sub={t(`${watch.length} préstamos · ${usd(watch.reduce((a, l) => a + l.disbursedUsd, 0))} de exposición`, `${watch.length} loans · ${usd(watch.reduce((a, l) => a + l.disbursedUsd, 0))} exposed`)}
        right={<CoverageLegend />}
      />
      <div className="overflow-hidden rounded-xl border border-bcp-border bg-white">
        {/* One header for every row (wide screens); on phones each row is its own card. */}
        <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,0.85fr)_minmax(0,0.7fr)_minmax(0,1.2fr)_minmax(0,0.75fr)_minmax(0,1.9fr)_20px] gap-x-5 border-b border-bcp-border px-5 py-2.5 lg:grid">
          {[t("Préstamo y causa", "Loan and cause"), t("Exposición", "Exposure"), t("Cobertura", "Coverage"), t("Aprobación → hoy → vencimiento", "Approval → today → maturity"), t("Peor estrés", "Worst stress"), t("Qué sigue", "What's next"), ""].map((h, k) => (
            <Lbl key={k} as="span">{h}</Lbl>
          ))}
        </div>
        <ul className="divide-y divide-bcp-divider">
          {watch.map((l) => {
            const price = coverageUnder(l, STANDARD_STRESS.price);
            const volume = coverageUnder(l, 0, STANDARD_STRESS.volume);
            const worst = Math.min(price, volume);
            const delta = Math.round((l.coverageToday - l.coverageAtApproval) * 100) / 100;
            // A change worth flagging: a large drop, or one that crossed the threshold.
            const flagDelta = delta <= -0.2 || (l.coverageAtApproval >= COVERAGE_BANDS.ambar && l.coverageToday < COVERAGE_BANDS.ambar);
            const RANK: Record<string, number> = { verde: 0, observacion: 1, ambar: 2, naranja: 3, rojo: 4, veto: 5 };
            const why = [...l.conditions].filter((c) => c.state !== "verde" && c.state !== "observacion").sort((a, b) => RANK[b.state] - RANK[a.state])[0];
            const frozen = l.tranches.find((x) => x.status === "congelado");
            const pending = l.tranches.find((x) => x.status === "pendiente");
            const deadline = data.upcoming.find((u) => u.loanId === l.id && /remedia/i.test(u.milestone.es));
            const tmStep = data.upcoming.find((u) => u.loanId === l.id && u.date === l.next.date && !/conformidad|remedia/i.test(u.milestone.es));
            const steps: { date: string; who: "tm" | "bank"; text: string }[] = [
              { date: l.next.date, who: "tm", text: tmStep ? t(tmStep.milestone).split(" · ")[0] : t(l.next.label).split(" · ")[0] },
              ...(frozen && deadline
                ? [{ date: deadline.date, who: "bank" as const, text: t(`${frozen.id} congelado · ${usd(frozen.amountUsd).replace(" ", "\u00a0")}`, `Frozen ${frozen.id} · ${usd(frozen.amountUsd).replace(" ", "\u00a0")}`) }]
                : pending
                  ? [{ date: pending.milestoneDate, who: "bank" as const, text: t(`Conformidad ${pending.id} hasta ${usd(pending.amountUsd).replace(" ", "\u00a0")}`, `${pending.id} sign-off up to ${usd(pending.amountUsd).replace(" ", "\u00a0")}`) }]
                  : []),
            ];
            return (
              <li key={l.id}>
                <button type="button" onClick={() => onOpen(l.id)} aria-label={`${t("Abrir expediente", "Open file")} ${l.id}`} className={`group grid w-full grid-cols-2 gap-x-5 gap-y-3 border-l-4 px-4 py-3.5 text-left transition-colors hover:bg-bcp-bg/70 sm:px-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.85fr)_minmax(0,0.7fr)_minmax(0,1.2fr)_minmax(0,0.75fr)_minmax(0,1.9fr)_20px] lg:items-center ${WATCH_EDGE[l.state]}`}>
                  <div className="col-span-2 min-w-0 lg:col-span-1">
                    <p className="flex flex-wrap items-baseline gap-x-2"><span className="text-[15px] font-bold text-bcp-ink">{l.id}</span><span className="text-[12px] text-bcp-muted">{t(l.zone)}</span></p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <StateChip state={l.state} cause={stateCause(l)} />
                    </div>
                    {why && <p className="mt-1 line-clamp-2 text-[12px] text-bcp-muted">{t(why.label)} · <span className="text-bcp-ink">{t(why.today)}</span></p>}
                  </div>
                  <div>
                    <Lbl as="span" className="lg:hidden">{t("Exposición", "Exposure")} </Lbl>
                    <p className="num text-[16px] font-bold text-bcp-ink">{usd(l.disbursedUsd)}</p>
                    <p className="num text-[12px] text-bcp-muted">{t(`de ${usd(l.lineUsd)}`, `of ${usd(l.lineUsd)}`)}</p>
                  </div>
                  <div>
                    <Lbl as="span" className="lg:hidden">{t("Cobertura", "Coverage")} </Lbl>
                    <p className="num text-[16px] font-bold text-bcp-ink">{cov(l.coverageToday)}</p>
                    <p className={`num text-[12px] ${flagDelta ? "font-semibold text-bcp-naranja-text" : "text-bcp-muted"}`}>{delta < 0 ? "▼" : delta > 0 ? "▲" : "="} {Math.abs(delta).toFixed(2)}<span className="lg:hidden"> {t("desde aprob.", "since appr.")}</span></p>
                  </div>
                  <div className="col-span-2 min-w-0 lg:col-span-1">
                    <CoverageTrend history={l.coverageHistory} today={l.coverageToday} low={l.projection?.low} high={l.projection?.high} from={l.approvalDate} to={l.maturityDate} cutoff={data.cutoff} />
                    {l.projection && <p className="num text-[11px] text-bcp-muted">{l.controlsState !== "verde" ? t("si no se remedia", "if not remedied") : t("al vencimiento", "at maturity")} {range(l.projection.low, l.projection.high, lang)}</p>}
                  </div>
                  <div>
                    <Lbl as="span" className="lg:hidden">{t("Peor estrés", "Worst stress")} </Lbl>
                    <p className={`num text-[16px] font-bold ${worst < COVERAGE_BANDS.ambar ? "text-bcp-naranja-text" : "text-bcp-ink"}`}>{cov(worst)}</p>
                    <p className="text-[12px] text-bcp-muted">{volume < price ? t("volumen −30%", "volume −30%") : t("precio −20%", "price −20%")}</p>
                  </div>
                  <ol className="col-span-2 min-w-0 space-y-1 text-[13px] lg:col-span-1">
                    {steps.map((st, k) => (
                      <li key={k} className="flex items-baseline gap-2">
                        <span className={`num w-[3.25rem] shrink-0 whitespace-nowrap font-semibold ${k > 0 && st.date === steps[k - 1].date ? "text-transparent" : "text-bcp-ink"}`}>{date(st.date, lang, false)}</span>
                        <span className="min-w-0">
                          {st.who === "bank"
                            ? <span className="mr-1.5 rounded bg-bcp-ink px-1.5 py-px text-[11px] font-semibold text-white">{t("Su decisión", "Your decision")}</span>
                            : <span className="mr-1.5 rounded bg-bcp-fill px-1.5 py-px text-[11px] font-semibold text-bcp-ink">TruMarket</span>}
                          {st.text}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <span aria-hidden className="hidden text-[20px] text-bcp-muted transition-transform group-hover:translate-x-0.5 group-hover:text-bcp-ink lg:block">›</span>
                  <span className="col-span-2 text-right text-[13px] font-semibold text-bcp-green-text lg:hidden">{t("Abrir expediente", "Open file")} ›</span>
                </button>
              </li>
            );
          })}
        </ul>
        {portfolioWatch && (
          <p className="border-t border-bcp-divider px-4 py-3 text-sm sm:px-5">
            <StateChip state={portfolioWatch.to} /> <b className="font-semibold">{t("Toda la cartera", "Whole portfolio")} · {t(portfolioWatch.cause).split(":")[0]}.</b> {t(portfolioWatch.impact)}{" "}
            <button type="button" onClick={() => setCauseOf(portfolioWatch)} className="inline font-semibold text-bcp-green-text underline-offset-2 hover:underline">{t("Ver causa", "View cause")}</button>
            {!BANK_EDITION && portfolioWatch.evidence && (
              <button type="button" onClick={() => openEvidence(portfolioWatch.evidence!.loanId, portfolioWatch.evidence!.condition)} className="ml-3 inline font-semibold text-bcp-green-text hover:underline">{t("Evidencia", "Evidence")} ›</button>
            )}
          </p>
        )}
      </div>
      {causeOf && (
        <Modal title={t("Causa · Toda la cartera", "Cause · Whole portfolio")} onClose={closeCause} footer={<Btn onClick={closeCause}>{t("Cerrar", "Close")}</Btn>}>
          <p className="text-sm font-semibold text-bcp-ink">{t(causeOf.impact)}</p>
          <p className="mt-2 text-sm text-bcp-ink">{t(causeOf.cause).replace(/^./, (x) => x.toUpperCase())}</p>
        </Modal>
      )}
      <div id="proximos-30-dias" className="scroll-mt-40">
        <SectionTitle title={t("Próximos 30 días", "Next 30 days")} right={<Btn onClick={onDecisions}>{t("Ir a Decisiones", "Go to Decisions")}</Btn>} />
      </div>
      <Card>
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-bcp-border text-left">
                {[t("Fecha", "Date"), t("Préstamo o solicitud", "Loan or application"), t("Hito", "Milestone"), t("Monto en juego", "Amount at stake")].map((h, i) => (
                  <Lbl key={h} as="th" className={`py-2 pr-3 font-normal ${i === 3 ? "text-right" : ""}`}>{h}</Lbl>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-bcp-divider">
              {[
                ...data.upcoming.filter((u) => within30(u.date)).map((u) => ({ date: u.date, id: u.loanId, what: t(u.milestone), usd: u.amountUsd, open: () => onOpen(u.loanId) })),
                ...appsDue.map((a) => ({ date: a.decisionDueDate, id: a.id, what: t("Decisión de la solicitud", "Application decision"), usd: a.requestedUsd, open: () => onOpenApp(a.id) })),
              ]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((r, i) => (
                  <tr key={i} onClick={r.open} className="cursor-pointer hover:bg-bcp-bg">
                    <td className="whitespace-nowrap py-2.5 pr-3">{date(r.date, lang, false)}</td>
                    <td className="py-2.5 pr-3 font-semibold">{r.id}</td>
                    <td className="py-2.5 pr-3">{r.what}</td>
                    <td className="num whitespace-nowrap py-2.5 pr-3 text-right font-semibold">{usd(r.usd)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
      </>}

      {page === "prestamos" && <>
      <RiskTiers F={F} n={data.loans.length} by={tierBy} setBy={setTierBy} filter={stateFilter} setFilter={setStateFilter} />

      <Card>
        <LoansTable data={stateFilter ? { ...data, loans: data.loans.filter((l) => l.state === stateFilter) } : data} onOpen={onOpen} />
        <h3 className="mt-6 text-[16px] font-bold">{t("Calendario de campaña", "Campaign calendar")}</h3>
        <SeasonCalendar data={data} onOpen={onOpen} />
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

/** Largest borrower, crop and zones, as shares of the lines. */
function Concentration({ data, lines }: { data: P; lines: number }) {
  const t = useT();
  const largest = data.loans.reduce((m, l) => (l.lineUsd > m.lineUsd ? l : m), data.loans[0]);
  const rows: [string, string, string][] = [
    [t("Mayor prestatario", "Largest borrower"), pct((largest.lineUsd / lines) * 100), t(`${largest.id} · ${usd(largest.lineUsd)} de ${usd(lines)}`, `${largest.id} · ${usd(largest.lineUsd)} of ${usd(lines)}`)],
    [t("Cultivo", "Crop"), t("palta Hass 100%", "Hass avocado 100%"), ""],
  ];
  // Exposure by region (what the bank's regional view used to show).
  const regions = (["Ica", "Pisco"] as const).map((r) => {
    const ls = data.loans.filter((l) => (r === "Pisco" ? /Pisco/.test(l.zone.es) : !/Pisco/.test(l.zone.es)));
    return { r, ls, line: ls.reduce((s, l) => s + l.lineUsd, 0), out: ls.reduce((s, l) => s + l.disbursedUsd, 0) };
  });
  return (
    <div className="mt-2 overflow-x-auto">
    <table className="w-full text-sm">
      <tbody className="divide-y divide-bcp-divider">
        {rows.map(([k, v, n]) => (
          <tr key={k} className="align-top">
            <td className="py-2 pr-3">{k}</td>
            <td className="num whitespace-nowrap py-2 pr-3 text-right font-bold">{v}</td>
            <td className="py-2 text-bcp-muted">{n}</td>
          </tr>
        ))}
        {regions.map((g) => (
          <tr key={g.r} className="align-top">
            <td className="py-2 pr-3">{t(`Zona ${g.r}`, `${g.r} zone`)}</td>
            <td className="num whitespace-nowrap py-2 pr-3 text-right font-bold">{pct((g.line / lines) * 100)}</td>
            <td className="py-2 text-bcp-muted">
              {t(`${usd(g.out)} desembolsados`, `${usd(g.out)} disbursed`)} ·{" "}
              {g.ls.map((l) => (
                <span key={l.id} className="mr-1 inline-flex flex-wrap items-center gap-1">
                  {l.id} <StateChip state={l.state} />
                </span>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

/** Loans by risk level: count or volume, with the share of the portfolio; a tier filters the table. */
const TIERS: { state: Exclude<State, "veto">; label: { es: string; en: string }; bar: string; chip: string }[] = [
  { state: "verde", label: { es: "Riesgo bajo", en: "Low risk" }, bar: "bg-bcp-green", chip: "bg-bcp-verde-bg text-bcp-green-text" },
  { state: "ambar", label: { es: "Riesgo medio", en: "Medium risk" }, bar: "bg-bcp-ambar", chip: "bg-bcp-ambar-bg text-bcp-ambar-text" },
  { state: "naranja", label: { es: "Riesgo elevado", en: "Elevated risk" }, bar: "bg-bcp-naranja", chip: "bg-bcp-naranja-bg text-bcp-naranja-text" },
  { state: "rojo", label: { es: "Riesgo alto", en: "High risk" }, bar: "bg-bcp-rojo", chip: "bg-bcp-rojo-bg text-bcp-rojo-text" },
];
function RiskTiers({ F, n, by, setBy, filter, setFilter }: { F: ReturnType<typeof portfolioFigures>; n: number; by: "count" | "volume"; setBy: (b: "count" | "volume") => void; filter: State | null; setFilter: (s: State | null) => void }) {
  const t = useT();
  const share = (x: { usd: number; n: number }) => (by === "count" ? (n ? (x.n / n) * 100 : 0) : F.disbursed ? (x.usd / F.disbursed) * 100 : 0);
  return (
    <section aria-label={t("Préstamos por nivel de riesgo", "Loans by risk level")} className="mt-2 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[20px] font-bold leading-tight">{t("Préstamos por nivel de riesgo", "Loans by risk level")}</h2>
          <div role="group" aria-label={t("Medir por", "Measure by")} className="inline-flex overflow-hidden rounded-md border border-bcp-border text-sm font-semibold">
            {(["count", "volume"] as const).map((b) => (
              <button key={b} type="button" aria-pressed={by === b} onClick={() => setBy(b)} className={`min-h-[36px] px-3 ${by === b ? "bg-bcp-ink text-white" : "bg-white text-bcp-ink hover:bg-bcp-bg"}`}>
                {b === "count" ? t("Cantidad", "Count") : t("Volumen (USD)", "Volume (USD)")}
              </button>
            ))}
          </div>
        </div>
        {filter && (
          <button type="button" onClick={() => setFilter(null)} className="inline-flex min-h-[36px] items-center gap-1.5 text-sm font-semibold text-bcp-ink hover:underline">
            <FilterX className="h-4 w-4" aria-hidden /> {t("Quitar filtro", "Clear filter")}
          </button>
        )}
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-bcp-fill" role="img" aria-label={TIERS.map((x) => `${t(x.label)} ${Math.round(share(F.byState[x.state]))}%`).join(", ")}>
        {TIERS.map((x) => <span key={x.state} className={x.bar} style={{ width: `${share(F.byState[x.state])}%` }} />)}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((x) => {
          const b = F.byState[x.state];
          const on = filter === x.state;
          const empty = b.n === 0;
          return (
            <button key={x.state} type="button" disabled={empty} aria-pressed={on} onClick={() => setFilter(on ? null : x.state)} className={`relative rounded-xl border bg-white p-4 text-left ${empty ? "cursor-default border-dashed border-bcp-border opacity-60" : on ? "border-bcp-ink shadow-[inset_0_0_0_1px_#102a40]" : "border-bcp-border hover:border-bcp-ink"}`}>
              <span className="flex items-center justify-between gap-2">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-2.5 py-[3px] text-[12px] font-bold ${x.chip}`}>{t(x.label)}</span>
                </span>
                {!empty && <ChevronRight className="h-4 w-4 text-bcp-muted" aria-hidden />}
              </span>
              <span className="mt-3 flex items-baseline justify-between gap-2">
                <span className="num text-[28px] font-bold leading-none">{b.n} {b.n === 1 ? t("préstamo", "loan") : t("préstamos", "loans")}</span>
                <span className="num text-[15px] font-semibold text-bcp-muted">{pct(share(b))}</span>
              </span>
              <span className="num mt-2 block text-sm text-bcp-ink">
                {usd(b.usd)} ({F.disbursed ? (Math.round((b.usd / F.disbursed) * 1000) / 10).toFixed(1) : "0.0"}% {t("del desembolsado", "of disbursed")})
              </span>
            </button>
          );
        })}
      </div>
    </section>
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
      <div className="mb-2 flex justify-end"><CoverageLegend /></div>
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
              <td className="w-[230px] py-2.5 pr-4">
                <CoverageTrend history={l.coverageHistory} today={l.coverageToday} low={l.projection?.low} high={l.projection?.high} from={l.approvalDate} to={l.maturityDate} cutoff={data.cutoff} />
                <span className="lbl mt-1.5 block whitespace-nowrap">
                  <b className="font-semibold text-bcp-ink">{cov(l.coverageToday)}</b> · {t("aprob.", "appr.")} {cov(l.coverageAtApproval)}
                  {l.projection && <> · {t("proy.", "proj.")} {range(l.projection.low, l.projection.high, lang)}</>}
                </span>
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
  // The balance point under the pointer (or keyboard focus): its exact value in a tooltip.
  const [hover, setHover] = useState<number | null>(null);
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
            <g key={i}>
              <circle cx={x} cy={y} r={hover === i ? 5 : 3.5} fill="#fff" stroke="#d9a93b" strokeWidth={2} />
              {/* A larger invisible target, so the point is easy to hover or tab to. */}
              <circle
                cx={x}
                cy={y}
                r={12}
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={`${month(rows[i].month, lang)}: ${t("saldo expuesto", "balance exposed")} ${usd(pts[i])}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="cursor-pointer outline-none"
              />
            </g>
          ))}
          {hover !== null && (() => {
            const [x, y] = line[hover + 1];
            const label = `${month(rows[hover].month, lang)} · ${usd(pts[hover])}`;
            const w = label.length * 6.6 + 16;
            const bx = Math.min(Math.max(x - w / 2, L), W - R - w);
            const by = y - 34 < T ? y + 12 : y - 34;
            return (
              <g pointerEvents="none">
                <rect x={bx} y={by} width={w} height={24} rx={4} fill="#102a40" />
                <text x={bx + w / 2} y={by + 16} textAnchor="middle" fontFamily="Arial" fontSize="12" fontWeight="700" fill="#fff">{label}</text>
              </g>
            );
          })()}
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

