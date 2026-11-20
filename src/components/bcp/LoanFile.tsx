/**
 * Expediente (spec 6.2): situation, Mi dinero with the tranche ladder, Mi riesgo
 * (coverage over time), what changed since approval with provenance, use of
 * funds, decisions in two lanes, audit log, and the evidence tabs (the only place
 * technical readings live).
 */
import { useMemo, useState } from "react";
import { GEO, technicalSeries } from "../../data/bcp/technical";
import { FieldImages } from "./FieldImages";
import { TechChart } from "./TechCharts";
import { ScoreBreakdown, StressGrid } from "./ScoreStress";
import { COVERAGE_BANDS, DRIVERS, DRIVER_TEXT, cov, date, daysBetween, fundsTotals, pct, provision, range, scenarios, signedCov, toDisburse, usd } from "../../lib/bcp/calc";
import type { Condition, Loan, Portfolio } from "../../lib/bcp/types";
import { CoverageChart } from "./CoverageChart";
import { decisionKey, type Answer } from "./answers";
import { DecisionBlock } from "./Decision";
import { Btn, Card, CheckIcon, Chip, Dialog, Estimado, ExampleChip, Lbl, Prov, Rich, SectionTitle, StateChip } from "./ui";
import { sourceTx, useDrawer, useEvidence, useLang, useT } from "./shared";
import { loanMoneyDetail, trancheDetail } from "./details";

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
  const openPanel = useDrawer();
  const geo = GEO[loan.id];
  // Progressive disclosure: what matters for the money is open, the rest one click away.
  const [openTr, setOpenTr] = useState<Set<string>>(() => new Set(loan.tranches.filter((x) => x.status === "pendiente" || x.status === "congelado").map((x) => x.id)));
  const [allConds, setAllConds] = useState(false);
  const [showLines, setShowLines] = useState(false);
  const [allAudit, setAllAudit] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
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
      {/* 1. Header */}
      <header className="space-y-2">
        <button type="button" onClick={onBack} className="min-h-[44px] text-sm font-semibold text-bcp-ink hover:underline print:hidden">
          ← {t("Cartera", "Portfolio")}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <StateChip state={loan.state} suffix={` ${t("desde", "since")} ${date(loan.stateSince, lang)}`} />
          <ExampleChip kind="file" />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-bold leading-tight">
              {t("Cliente", "Client")} {loan.id} · {t(loan.crop)}
            </h1>
            <p className="text-sm text-bcp-muted">
              {t(loan.zone)} · {loan.areaHa.toFixed(2)} {t("ha medidas", "ha measured")} · {t("campaña", "campaign")} {loan.campaign} · {t("día", "day")} {loan.dayOfCycle} {t("de", "of")} {loan.cycleDays}
            </p>
            {/* Freshness without animation: the last reading and the next one expected. */}
            <p className="lbl mt-0.5">
              {t(`Última lectura ${date(data.cutoff, "es")} · próxima: ${loan.next.label.es} (${date(loan.next.date, "es", false)})`, `Last reading ${date(data.cutoff, "en")} · next: ${loan.next.label.en} (${date(loan.next.date, "en", false)})`)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Btn onClick={onMemo}>{t("Memorando de crédito (PDF)", "Credit memo (PDF)")}</Btn>
            <Btn onClick={exportCsv}>{t("Exportar registro (CSV)", "Export log (CSV)")}</Btn>
            <Btn onClick={onMap}>{t("Ver en el mapa", "View on the map")}</Btn>
          </div>
        </div>
      </header>

      {/* 2. Situation */}
      <Card tone="dark">
        <ul className="grid gap-x-8 gap-y-2 text-[15px] md:grid-cols-2">
          {loan.situation.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-bcp-label" />
              <span>
                <Rich text={t(s)} />
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {/* 3. Mi dinero */}
      <section>
        <SectionTitle no="01" title={t("Posición financiera", "Financial position")} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { k: t("Línea aprobada", "Approved line"), v: usd(loan.lineUsd), s: t(`${loan.cycleDays} días · 3 tramos`, `${loan.cycleDays} days · 3 tranches`), kind: "line" as const },
            { k: t("Desembolsado", "Disbursed"), v: usd(loan.disbursedUsd), s: loan.tranches.filter((x) => x.status === "liberado").map((x) => `${x.id} · ${date(x.milestoneDate, lang)}`).join(" · "), kind: "disbursed" as const },
            { k: loan.frozenUsd ? t("Congelado", "Frozen") : t("Por desembolsar", "Undrawn"), v: usd(loan.frozenUsd || toDisburse(loan)), s: loan.frozenUsd ? t(`por desembolsar ${usd(toDisburse(loan))}`, `undrawn ${usd(toDisburse(loan))}`) : t("contra hitos verificados", "against verified milestones"), kind: "undrawn" as const },
            { k: t("Saldo al vencimiento", "Due at maturity"), v: usd(loan.dueAtMaturityUsd), s: t("capital más costo del banco", "principal plus bank cost"), kind: "due" as const },
            { k: t("Vence", "Maturity"), v: date(loan.maturityDate, lang), s: t(`${daysLeft} días`, `${daysLeft} days`), kind: "maturity" as const },
          ].map((c) => (
            <button type="button" key={c.k} onClick={() => openPanel(loanMoneyDetail(loan, c.kind, t, lang, data.cutoff))} className="group rounded-xl border border-bcp-border bg-white p-4 text-left hover:border-bcp-ink sm:p-5">
              <Lbl>{c.k}</Lbl>
              <p className="num text-[22px] font-bold">{c.v}</p>
              <p className="text-sm text-bcp-muted">{c.s}</p>
              <span className="mt-1.5 inline-block font-[Arial,Helvetica,sans-serif] text-[12px] font-bold text-bcp-green-text underline-offset-2 group-hover:underline">{t("Ver detalle", "View detail")} ›</span>
            </button>
          ))}
        </div>

        <Card className="mt-3">
          <h3 className="text-[16px] font-bold">{t("Tramos: cada desembolso solo contra un hito verificado", "Tranches: each disbursement only against a verified milestone")}</h3>
          <Lbl>{t("checklist firmado por TruMarket + conformidad del banco", "checklist signed by TruMarket + the bank's conformity")}</Lbl>
          <div role="img" aria-label={t(`${released}% de la línea desembolsado`, `${released}% of the line disbursed`)} className="mt-3 h-1.5 overflow-hidden rounded-full bg-bcp-fill">
            <span className="block h-full bg-bcp-ink" style={{ width: `${released}%` }} />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
                  {openTr.has(tr.id) ? (
                    <ul className="space-y-1 text-sm">
                      {tr.checklist.map((c, i) => (
                        <li key={i} className="flex gap-1.5">
                          <CheckIcon status={c.status} />
                          <span>{t(c.label)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm">
                      <CheckIcon status={tr.checklist.every((c) => c.status === "ok") ? "ok" : "pending"} /> {t("Checklist", "Checklist")} {tr.checklist.filter((c) => c.status === "ok").length} {t("de", "of")} {tr.checklist.length}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpenTr((s0) => { const n = new Set(s0); if (n.has(tr.id)) n.delete(tr.id); else n.add(tr.id); return n; })}
                    aria-expanded={openTr.has(tr.id)}
                    className="mt-1 min-h-[32px] text-xs font-semibold text-bcp-green-text hover:underline print:hidden"
                  >
                    {openTr.has(tr.id) ? t("Ocultar checklist", "Hide checklist") : t("Ver checklist", "View checklist")}
                  </button>
                  <button type="button" onClick={() => openPanel(trancheDetail(loan, tr, t, lang))} className="mt-1 block min-h-[32px] text-xs font-semibold text-bcp-ink underline-offset-2 hover:underline print:hidden">
                    {t("Detalle del tramo", "Tranche detail")} ›
                  </button>
                  {tr.bankConformityDate && <p className="lbl mt-2">{t(`Conformidad del banco ${date(tr.bankConformityDate, "es", false)}`, `Bank conformity ${date(tr.bankConformityDate, "en", false)}`)}</p>}
                  {tr.note && <p className="lbl mt-2">{t(tr.note)}</p>}
                </div>
              );
            })}
            <div className="rounded-lg border-2 border-dashed border-bcp-fill-strong p-3">
              <p className="lbl">{t("Repago", "Repayment")}</p>
              <p className="num text-[20px] font-bold">{usd(loan.dueAtMaturityUsd)}</p>
              <div className="my-1.5">
                <Chip>{date(loan.maturityDate, lang)}</Chip>
              </div>
              <p className="text-sm">{t("Desde los cobros del comprador, antes que cualquier pago al productor.", "From the buyer's payments, before any payment to the grower.")}</p>
            </div>
          </div>
        </Card>
      </section>

      {/* 4. Mi riesgo */}
      <section>
        <SectionTitle no="02" title={t("Evaluación de riesgo", "Risk assessment")} />
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
          <Card>
            <h3 className="text-[16px] font-bold">{t("Cobertura de repago en el tiempo", "Repayment coverage over time")}</h3>
            <Lbl>{t("ingreso neto de cosecha ÷ saldo al vencimiento", "net harvest revenue ÷ amount due at maturity")}</Lbl>
            <div className="mt-2">
              <CoverageChart loan={loan} cutoff={data.cutoff} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DRIVERS.map((d) => (
                <span key={d} className="rounded-full border border-bcp-border px-2.5 py-[3px] font-[Arial,Helvetica,sans-serif] text-[12px] font-bold">
                  {t(DRIVER_TEXT[d])} {signedCov(loan.driverDeltas[d]).replace(/^0/, "0")}
                </span>
              ))}
            </div>
            <p className="lbl mt-2">{t("Línea sólida: confirmado · línea punteada: estimado", "Solid line: confirmed · dotted line: estimated")}</p>
          </Card>
          <Card>
            <Lbl>{t("Cobertura hoy", "Coverage today")}</Lbl>
            <p className="num text-[36px] font-bold leading-tight">{cov(loan.coverageToday)}</p>
            {loan.projection && (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                {t("proyección", "projection")} {range(loan.projection.low, loan.projection.high, lang)} <Estimado />
              </p>
            )}
            <dl className="mt-3 divide-y divide-bcp-divider text-sm">
              {[
                [t("Precio de equilibrio", "Break-even price"), `USD ${loan.breakEvenPriceUsdKg.toFixed(2)}/kg`],
                [t("Precio esperado a cosecha", "Expected harvest price"), `USD ${loan.expectedPriceUsdKg.toFixed(2)}/kg`],
                ...scenarios(loan).map((s) => [t(s.label), cov(s.coverage)]),
                [t("Clasificación SBS", "SBS rating"), loan.sbsRating],
                [t("Provisión requerida", "Required provision"), usd(provision(loan))],
                ["Score", t(`${loan.scoreAtApproval} → ${loan.scoreToday} · tier aprobado ${loan.approvedTier}`, `${loan.scoreAtApproval} → ${loan.scoreToday} · approved tier ${loan.approvedTier}`)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 py-1.5">
                  <dt className="lbl">{k}</dt>
                  <dd className="num text-right font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="lbl mt-3">
              {t(
                "Ingreso neto = volumen verificado × % exportable × precio, menos packing, flete y comisiones. El tier aprobado solo cambia con revisión humana registrada.",
                "Net revenue = verified volume × exportable share × price, less packing, freight and fees. The approved tier only changes with a recorded human review.",
              )}
            </p>
            <button type="button" onClick={() => setScoreOpen(true)} className="mt-3 min-h-[44px] text-sm font-semibold text-bcp-green-text hover:underline print:hidden">
              {t("Ver detalle del score y prueba de estrés", "View score detail and stress test")} →
            </button>
            <p className="lbl mt-1">{t(`Umbral ámbar ${cov(COVERAGE_BANDS.ambar)} · naranja ${cov(COVERAGE_BANDS.naranja)} · rojo ${cov(COVERAGE_BANDS.rojo)}`, `Amber threshold ${cov(COVERAGE_BANDS.ambar)} · orange ${cov(COVERAGE_BANDS.naranja)} · red ${cov(COVERAGE_BANDS.rojo)}`)}</p>
          </Card>
        </div>
      </section>

      {/* 5. Qué cambió desde la aprobación */}
      <SectionTitle
        no="03"
        title={t("Cambios desde la aprobación", "Changes since approval")}
        sub={t(`aprobación ${date(loan.approvalDate, "es")} · hoy ${date(data.cutoff, "es")}`, `approval ${date(loan.approvalDate, "en")} · today ${date(data.cutoff, "en")}`)}
      />
      <Card>
        <p className="mb-2 text-sm text-bcp-ink">
          {allConds
            ? t(`Las ${loan.conditions.length} condiciones del expediente.`, `All ${loan.conditions.length} conditions on the file.`)
            : t(
                `Se muestran las ${keyConds.length} que afectan el repago. Las otras ${loan.conditions.length - keyConds.length} están en verde y sin efecto.`,
                `Showing the ${keyConds.length} that affect repayment. The other ${loan.conditions.length - keyConds.length} are green with no effect.`,
              )}
        </p>
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-bcp-border text-left">
                {[t("Condición", "Condition"), t("Aprobación", "Approval"), t("Hoy", "Today"), t("Umbral", "Threshold"), t("Estado", "State"), t("Efecto en el repago", "Effect on repayment"), t("Fuente y fecha", "Source and date"), ""].map((h) => (
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
                      <td className="py-2 pr-3 text-bcp-muted">{t(c.threshold)}</td>
                      <td className="py-2 pr-3"><StateChip state={c.state} /></td>
                      <td className={`py-2 pr-3 ${c.state === "verde" ? "text-bcp-muted" : "font-semibold"}`}>{t(c.effectOnRepayment)}</td>
                      <td className="py-2 pr-3">
                        <Prov p={c.provenance} />
                        <span className="lbl block">{t(sourceTx(c))}</span>
                      </td>
                      <td className="py-2 pr-1 text-right">
                        <button type="button" onClick={() => openEvidence(loan.id, c.label.es)} className="min-h-[36px] whitespace-nowrap text-xs font-semibold text-bcp-green-text underline-offset-2 hover:underline print:hidden">
                          {t("Evidencia", "Evidence")} ›
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            ))}
          </table>
        </div>
        <button type="button" onClick={() => setAllConds((v) => !v)} aria-expanded={allConds} className="mt-2 min-h-[44px] text-sm font-semibold text-bcp-green-text hover:underline print:hidden">
          {allConds ? t("Mostrar solo lo que afecta el repago", "Show only what affects repayment") : t(`Ver las ${loan.conditions.length} condiciones`, `View all ${loan.conditions.length} conditions`)}
        </button>
      </Card>

      {/* 6. Uso de fondos */}
      {funds && ft && (
        <>
        <SectionTitle
            no="04"
            title={`${t("Uso de fondos", "Use of funds")} · ${funds.tranche}`}
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
              {!showLines && (() => {
                const worst = [...funds.lines].sort((a, b) => b.budgetUsd - b.reconciledUsd - (a.budgetUsd - a.reconciledUsd))[0];
                return (
                  <div className="space-y-2 text-sm">
                    <p>
                      {t(`${funds.lines.length} partidas por ${usd(ft.budget)}: ${usd(ft.reconciled)} con factura conciliada y ${usd(ft.unexplained)} sin sustento.`, `${funds.lines.length} items for ${usd(ft.budget)}: ${usd(ft.reconciled)} with a reconciled invoice and ${usd(ft.unexplained)} unexplained.`)}
                    </p>
                    {worst && worst.budgetUsd > worst.reconciledUsd && (
                      <p className="text-bcp-muted">
                        {t(`Mayor brecha: ${worst.item.es}, ${usd(worst.budgetUsd - worst.reconciledUsd)} sin sustento.`, `Largest gap: ${worst.item.en}, ${usd(worst.budgetUsd - worst.reconciledUsd)} unexplained.`)}
                      </p>
                    )}
                  </div>
                );
              })()}
              {showLines && (
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b border-bcp-border">
                    {[t("Partida", "Item"), t("Presupuesto", "Budget"), t("Facturas conciliadas", "Reconciled invoices"), t("Pago directo", "Direct pay"), t("Concuerda con campo", "Matches the field")].map((h, i) => (
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
                      <td className="py-2 pr-3 text-right">{pct(x.reconciledUsd ? (x.directPayUsd / x.reconciledUsd) * 100 : 0)}</td>
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
              )}
              <button type="button" onClick={() => setShowLines((v) => !v)} aria-expanded={showLines} className="mt-2 min-h-[44px] text-sm font-semibold text-bcp-green-text hover:underline print:hidden">
                {showLines ? t("Ocultar partidas", "Hide items") : t(`Ver partidas (${funds.lines.length})`, `View items (${funds.lines.length})`)}
              </button>
            </div>
            <div className="rounded-lg bg-bcp-bg p-4">
              <Lbl>{t("Conciliado", "Reconciled")}</Lbl>
              <p className="num text-[36px] font-bold leading-tight">{pct(ft.reconciledPct)}</p>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between"><dt>{t("Sin sustento", "Unexplained")}</dt><dd className="num font-semibold">{usd(ft.unexplained)}</dd></div>
                <div className="flex justify-between"><dt>{t("Pagado directo a proveedores", "Paid directly to suppliers")}</dt><dd className="num font-semibold">{pct(ft.directPct)}</dd></div>
                <div className="flex justify-between"><dt>{t("Retirado en efectivo", "Withdrawn in cash")}</dt><dd className="num font-semibold">{usd(funds.cashWithdrawnUsd)}</dd></div>
              </dl>
              <p className="mt-3 text-sm font-semibold">{t(`Tres fuentes deben concordar antes del siguiente tramo`, `Three sources must agree before the next tranche`)}</p>
              <ul className="mt-1 space-y-1 text-sm">
                <li className="flex gap-1.5"><CheckIcon status={funds.threeSources.facturas ? "ok" : "fail"} />{t("Facturas", "Invoices")}</li>
                <li className="flex gap-1.5"><CheckIcon status={funds.threeSources.satelite ? "ok" : "fail"} />{t("Satélite: labores visibles", "Satellite: field work visible")}</li>
                <li className="flex gap-1.5"><CheckIcon status={funds.threeSources.aforo === "ok" ? "ok" : funds.threeSources.aforo === "fail" ? "fail" : "pending"} />{t(`Aforo en campo · ${date(funds.threeSources.aforoDate, "es", false)}`, `Field estimate · ${date(funds.threeSources.aforoDate, "en", false)}`)}</li>
              </ul>
              <p className="lbl mt-3">{t("Brecha de facturas vs presupuesto de la fase: 15% ámbar, 30% naranja.", "Invoice gap vs phase budget: 15% amber, 30% orange.")}</p>
            </div>
          </div>
        </Card>
        </>
      )}

      {/* 7. Decisiones */}
      <section>
        <SectionTitle no="05" title={t("Decisiones", "Decisions")} />
        <div className="grid gap-3 lg:grid-cols-2">
          {bankDecision ? (
            <DecisionBlock loan={loan} decision={bankDecision} cutoff={data.cutoff} answer={answers[decisionKey(loan, bankDecision)]} onAnswer={(a) => onAnswer(decisionKey(loan, bankDecision), a)} />
          ) : (
            <Card tone="decision">
              <Lbl>{t("Decisiones pendientes", "Pending decisions")}</Lbl>
              <p className="text-[16px] font-bold">{t("Ninguna hoy", "None today")}</p>
              <p className="text-sm text-bcp-muted">{t(loan.next.label)}</p>
            </Card>
          )}
          <Card>
            <Lbl>{t("Ejecutado por TruMarket según contrato · informativo", "Executed by TruMarket under contract · for information")}</Lbl>
            <ul className="mt-2 divide-y divide-bcp-divider">
              {tmDecisions.map((d, i) => (
                <li key={i} className="py-2 text-sm">
                  <p className="font-semibold">
                    {date(d.date, lang)} · {t(d.title)}
                  </p>
                  <p className="text-bcp-muted">{t(d.basis)}</p>
                  <p className="lbl">{t(d.responsible)} · {d.engineVersion}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      {/* 8. Registro de auditoría */}
      <SectionTitle no="06" title={t("Registro de auditoría", "Audit log")} sub={t("entradas inmutables; las correcciones son nuevas entradas vinculadas", "entries are immutable; corrections are new linked entries")} />
      <Card>
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-bcp-border text-left">
                {[t("Fecha", "Date"), t("Evento", "Event"), t("Responsable", "Responsible"), t("Regla o gatillo", "Rule or trigger"), t("Evidencia", "Evidence"), t("Versión del motor", "Engine version")].map((h) => (
                  <Lbl key={h} as="th" className="py-2 pr-3 font-normal">
                    {h}
                  </Lbl>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-bcp-divider">
              {(allAudit ? loan.auditLog : loan.auditLog.slice(0, 1)).map((a, i) => (
                <tr key={i} className="align-top">
                  <td className="whitespace-nowrap py-2 pr-3">{date(a.date, lang)}</td>
                  <td className="py-2 pr-3 font-semibold">{t(a.event)}</td>
                  <td className="py-2 pr-3">{t(a.responsible)}</td>
                  <td className="py-2 pr-3">{t(a.rule)}</td>
                  <td className="py-2 pr-3">
                    <a href="#evidencia" className="text-bcp-green-text underline-offset-2 hover:underline">{t(a.evidence)}</a>
                  </td>
                  <td className="py-2 pr-3">{a.engineVersion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loan.auditLog.length > 1 && (
          <button type="button" onClick={() => setAllAudit((v) => !v)} aria-expanded={allAudit} className="mt-2 min-h-[44px] text-sm font-semibold text-bcp-green-text hover:underline print:hidden">
            {allAudit ? t("Ver solo la última entrada", "Show only the latest entry") : t(`Ver registro completo (${loan.auditLog.length})`, `View full log (${loan.auditLog.length})`)}
          </button>
        )}
      </Card>

      {/* 9. Evidence tabs */}
      <SectionTitle no="07" title={t("Evidencia", "Evidence")} />
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
                        t("Fotos georreferenciadas y laboratorio de suelo y agua", "Geotagged photos and soil and water lab"),
                        geo?.parcelId ? t("Histórico de cosechas verificado", "Verified harvest history") : t("Imagen del predio e histórico de cosechas verificado", "Parcel image and verified harvest history"),
                      ]
                    : [t("Instrumentos firmados e inscritos", "Signed and registered instruments"), t("Facturas electrónicas conciliadas", "Reconciled e-invoices"), t("Póliza de seguro agrícola y cesión de cobros", "Crop insurance policy and assignment of receivables")]
                  ).map((x) => (
                    <div key={x} className="rounded-lg border border-bcp-border p-3 text-sm">
                      {x}
                      <p className="lbl mt-1">{t(`Actualizado al ${date(data.cutoff, "es")}`, `Updated to ${date(data.cutoff, "en")}`)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Dialog open={scoreOpen} onClose={() => setScoreOpen(false)} title={t("Detalle del score y prueba de estrés", "Score detail and stress test")} sub={`${loan.id} · ${t("análisis de crédito", "credit analysis")}`} closeLabel={t("Cerrar", "Close")}>
        <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          <ScoreBreakdown dims={loan.scoreDims} />
          <StressGrid coverage={loan.coverageToday} />
        </div>
      </Dialog>

    </div>
  );
}
