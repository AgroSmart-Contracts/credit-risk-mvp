/**
 * Risk details: the layer behind the score. Why the score is where it is, the
 * counterparty checks and the loan's cash flows, then the
 * technical monitoring (satellite, crop, weather, market, repayment).
 */
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, XCircle } from "lucide-react";
import { moneyPosition } from "../../lib/pre-harvest/finance";
import { formatDate, formatUsd, tb } from "../../lib/pre-harvest/i18n";
import { addDays } from "../../lib/pre-harvest/monitoring";
import type { CampaignSimulation } from "../../lib/pre-harvest/timeline";
import type { Bilingual, Lang, NdviPoint, PreHarvestAssessment, PreHarvestDeal, TimelineFrame } from "../../lib/pre-harvest/types";
import type { LiveCheck } from "./live";
import { MonitoringPanels } from "./MonitoringPanels";
import { Card, DetailDialog, FoldCard, SectionTitle } from "./ui";
import { PD_BY_TIER } from "../../lib/pre-harvest/config";

const L = (en: string, es: string): Bilingual => ({ en, es });
const TX = {
  scoreFrom: L("Score at approval", "Score a la aprobación"),
  ensoNote: L(
    "The approval score already priced the El Niño outlook at that date; monitoring adds what has been observed since, so the two are not the same risk counted twice.",
    "El score de aprobación ya incorporó el pronóstico de El Niño a esa fecha; el monitoreo agrega lo observado desde entonces, por lo que no es el mismo riesgo contado dos veces.",
  ),
  checkedToday: L("checked today", "revisado hoy"),
  direction: L("Direction", "Dirección"),
  exposureCol: L("Exposure after", "Exposición después"),
  next: L("Next", "Siguiente"),
  full: L("Full breakdown in Credit analysis", "Detalle completo en Análisis de crédito"),
  counterparty: L("Counterparty checks", "Controles de contraparte"),
  counterpartySub: L("Registries, credit bureau and buyer cover behind this loan", "Registros, central de riesgos y cobertura del comprador de este préstamo"),
  checked: L("checked", "revisado"),
  rechecked: L("re-checked", "revisado"),
  cash: L("Cash flows", "Flujos de caja"),
  cashSub: L("Every movement of money on this loan, done and planned", "Cada movimiento de dinero del préstamo, realizado y previsto"),
  date: L("Date", "Fecha"),
  flow: L("Movement", "Movimiento"),
  amount: L("Amount", "Monto"),
  status: L("Status", "Estado"),
  done: L("Done", "Realizado"),
  planned: L("Planned", "Previsto"),
  held: L("Held", "Retenido"),
  stopped: L("Stopped", "Detenido"),
  technical: L("Technical monitoring", "Monitoreo técnico"),
};


const DIM_NAME: Record<string, Bilingual> = {
  production: L("Production", "Producción"),
  operator: L("Operator", "Operador"),
  structure: L("Structure", "Estructura"),
  counterparty: L("Buyer", "Comprador"),
};

/**
 * What changed since approval, in money first: expected loss and cushion then and
 * now. The points-and-weights breakdown is one click away.
 */
function ScoreDrivers({
  deal,
  sim,
  frame,
  current,
  origination,
  application,
  lang,
  onCredit,
}: {
  deal: PreHarvestDeal;
  sim: CampaignSimulation;
  frame: TimelineFrame;
  current: PreHarvestAssessment;
  origination: PreHarvestAssessment;
  application: boolean;
  lang: Lang;
  onCredit: () => void;
}) {
  const es = lang === "es";
  const fmt = (n: number) => formatUsd(Math.round(n), lang);
  const since: Bilingual = application ? L("since the application", "desde la solicitud") : L("since approval", "desde la aprobación");
  const now = moneyPosition(deal, sim, frame);
  const then = moneyPosition(deal, sim, sim.frames[0] ?? frame);
  // Expected loss on the full line, so the two dates compare like for like.
  const line = deal.envelopeUsd;
  const lgd = now.lgdPct / 100;
  const elThen = line * PD_BY_TIER[origination.tier] * lgd;
  const elNow = line * PD_BY_TIER[current.tier] * lgd;
  const cushion = (m: typeof now) => (m.expectedRepaymentUsd === null ? null : m.expectedRepaymentUsd - m.amountDueUsd);
  const cThen = cushion(then);
  const cNow = cushion(now);
  const changes = current.dimensions
    .filter((d) => !d.dormant)
    .flatMap((d) => {
      const before = new Map((origination.dimensions.find((o) => o.key === d.key)?.lines ?? []).map((l) => [l.label.en, l.points]));
      return d.lines.map((l) => ({ line: l, dim: d, diff: l.points - (before.get(l.label.en) ?? 0) })).filter((x) => x.diff !== 0);
    })
    .sort((x, y) => x.diff * x.dim.weight - y.diff * y.dim.weight);
  const delta = current.composite - origination.composite;
  const rows: Array<{ label: string; then: string; now: string; worse: boolean }> = [
    { label: es ? "Pérdida esperada (línea completa)" : "Expected loss (full line)", then: fmt(elThen), now: fmt(elNow), worse: elNow > elThen },
    ...(cThen !== null && cNow !== null ? [{ label: es ? "Holgura al vencimiento" : "Cushion at maturity", then: fmt(cThen), now: fmt(cNow), worse: cNow < cThen }] : []),
    { label: "Score", then: `${origination.composite} · ${origination.tier}`, now: `${current.composite} · ${current.tier}`, worse: delta < 0 },
  ];
  return (
    <Card>
      <SectionTitle title={es ? `Qué cambió ${since.es}, en dinero` : `What changed ${since.en}, in money`} />
      <table className="w-full text-sm">
        <thead className="border-b border-tm-border text-[11px] uppercase tracking-wide text-tm-text-muted">
          <tr>
            <th className="py-1.5 text-left font-semibold"></th>
            <th className="py-1.5 text-right font-semibold">{application ? (es ? "Solicitud" : "Application") : es ? "Aprobación" : "Approval"}</th>
            <th className="py-1.5 text-right font-semibold">{es ? "Hoy" : "Today"}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-tm-border">
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="py-2 text-tm-black">{r.label}</td>
              <td className="py-2 text-right text-tm-text-light">{r.then}</td>
              <td className={`py-2 text-right font-semibold ${r.worse ? "text-tm-danger-dark" : "text-tm-black"}`}>{r.now}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-tm-text-light">
        {changes.length === 0
          ? es
            ? `Nada ha cambiado ${since.es}.`
            : `Nothing has changed ${since.en}.`
          : `${es ? "Por qué" : "Why"}: ${changes
              .slice(0, 2)
              .map((c) => tb(c.line.label, lang).replace(/^(Monitoring|Monitoreo): /, ""))
              .join(" · ")}`}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <DetailDialog label={es ? "Ver desglose del score" : "View score breakdown"} title={es ? "Desglose del score" : "Score breakdown"} lang={lang}>
          <ScoreBreakdown changes={changes} delta={delta} since={since} lang={lang} />
        </DetailDialog>
        <button type="button" onClick={onCredit} className="inline-flex items-center gap-1 text-xs font-semibold text-tm-black hover:underline">
          {tb(TX.full, lang)} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </Card>
  );
}

type Change = { line: PreHarvestAssessment["dimensions"][number]["lines"][number]; dim: PreHarvestAssessment["dimensions"][number]; diff: number };

/** The technical layer: each scoring line that moved, its points and weight. */
function ScoreBreakdown({ changes, delta, since, lang }: { changes: Change[]; delta: number; since: Bilingual; lang: Lang }) {
  return (
    <div>
      <ul className="space-y-2.5">
        {changes.map(({ line, dim, diff }, i) => {
          const effect = Math.round(diff * dim.weight * 10) / 10;
          return (
            <li key={i} className="flex items-start justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="font-medium text-tm-black">{tb(line.label, lang).replace(/^(Monitoring|Monitoreo): /, "")}</span>
                <span className="text-tm-text-light"> · {tb(line.value, lang)}</span>
                <span className="block text-xs text-tm-text-muted">
                  {diff > 0 ? "+" : ""}
                  {diff} {lang === "es" ? "pts en" : "pts in"} {tb(DIM_NAME[dim.key], lang)} × {Math.round(dim.weight * 100)}%
                </span>
              </span>
              <span className={`shrink-0 font-semibold tabular-nums ${effect < 0 ? "text-tm-danger-dark" : "text-tm-primary-dark"}`}>
                {effect > 0 ? "+" : ""}
                {effect}
              </span>
            </li>
          );
        })}
        <li className="flex justify-between border-t border-tm-border pt-2 text-sm font-semibold text-tm-black">
          <span>{lang === "es" ? `Cambio ${since.es}` : `Change ${since.en}`}</span>
          <span className="tabular-nums">
            {delta > 0 ? "+" : ""}
            {delta}
          </span>
        </li>
      </ul>
      <p className="mt-3 text-xs text-tm-text-light">{tb(TX.ensoNote, lang)}</p>
    </div>
  );
}

type CheckState = "ok" | "watch" | "pending" | "fail";

function StateIcon({ state }: { state: CheckState }) {
  if (state === "ok") return <CheckCircle2 className="h-4 w-4 shrink-0 text-tm-primary" />;
  if (state === "fail") return <XCircle className="h-4 w-4 shrink-0 text-tm-danger-dark" />;
  if (state === "watch") return <AlertTriangle className="h-4 w-4 shrink-0 text-tm-accent-dark" />;
  return <Clock className="h-4 w-4 shrink-0 text-tm-text-muted" />;
}

function CounterpartyChecks({ deal, sim, checks, lang }: { deal: PreHarvestDeal; sim: CampaignSimulation; checks: LiveCheck[]; lang: Lang }) {
  const c = deal.checks;
  const tk = sim.takeout;
  const today = checks.length > 0;
  const es = lang === "es";
  const lien = (n: number) => `${n} ${es ? (n === 1 ? "carga" : "cargas") : n === 1 ? "lien" : "liens"}`;
  const groups: Array<[Bilingual, Array<{ name: string; detail: string; state: CheckState; when: string }>]> = [
    [
      L("Registry", "Registros"),
      [
        { name: "SUNAT · RUC", detail: `${c.ruc.active ? (es ? "activo" : "active") : es ? "inactivo" : "inactive"} · ${c.ruc.habido ? "habido" : "no habido"}`, state: c.ruc.active && c.ruc.habido ? "ok" : "fail", when: deal.checksDate },
        {
          name: "SUNARP",
          detail: `${c.sunarp.tenure === "owned" ? (es ? "propio" : "owned") : c.sunarp.tenure === "leased" ? (es ? "arrendado" : "leased") : "informal"} · ${lien(c.sunarp.liens)}`,
          state: c.sunarp.tenure === "informal" ? "fail" : c.sunarp.liens > 0 ? "watch" : "ok",
          when: deal.checksDate,
        },
        { name: "ANA", detail: `${c.ana.licenceId} · ${c.ana.licenceValid ? (es ? "vigente" : "valid") : es ? "no vigente" : "invalid"}`, state: c.ana.licenceValid ? "ok" : "fail", when: deal.checksDate },
        { name: "SENASA", detail: tb(c.senasa.note, lang), state: c.senasa.zoneStatus === "quarantine" ? "fail" : "ok", when: deal.checksDate },
        { name: es ? "Inspección en campo" : "Field inspection", detail: tb(c.inspection.note, lang), state: c.inspection.soilOk && c.inspection.sanitationOk ? "ok" : "watch", when: deal.inspectionDate },
      ],
    ],
    [
      L("Credit", "Crédito"),
      [
        {
          name: `${c.credit.bureau} · SBS`,
          detail: `${c.credit.rating} · ${c.credit.protestedDebts} ${es ? "protestos" : "protested debts"}`,
          state: c.credit.rating === "Normal" && c.credit.protestedDebts === 0 ? "ok" : c.credit.rating === "CPP" ? "watch" : "fail",
          when: deal.checksDate,
        },
      ],
    ],
    [
      L("Buyer and insurance", "Comprador y seguro"),
      [
        {
          name: `Coface · ${es ? "comprador" : "buyer"} (${tk.buyerCountry})`,
          detail: `${{ approved: es ? "aprobada" : "approved", reduced: es ? "reducida" : "reduced", declined: es ? "rechazada" : "declined", pending: es ? "pendiente" : "pending" }[tk.coface]} · ${tk.cofaceCoveragePct}%`,
          state: tk.coface === "approved" ? "ok" : tk.coface === "declined" ? "fail" : tk.coface === "reduced" ? "watch" : "pending",
          when: tk.poSignedDate ?? deal.checksDate,
        },
        {
          name: es ? "Seguros (3 capas)" : "Insurance (3 layers)",
          detail: [c.insurance.catastrophic && "SAC", c.insurance.commercial && (es ? "comercial" : "commercial"), c.insurance.parametric && (es ? "paramétrico" : "parametric")].filter(Boolean).join(" · ") || (es ? "ninguno" : "none"),
          state: c.insurance.catastrophic || c.insurance.commercial || c.insurance.parametric ? "ok" : "watch",
          when: deal.checksDate,
        },
      ],
    ],
  ];
  const allRows = groups.flatMap(([, rows]) => rows);
  const okCount = allRows.filter((r) => r.state === "ok").length;
  return (
    <FoldCard
      title={tb(TX.counterparty, lang)}
      hint={tb(TX.counterpartySub, lang)}
      lang={lang}
      // Open by default only when a check failed.
      defaultOpen={allRows.some((r) => r.state === "fail")}
      summary={
        es
          ? `${okCount} de ${allRows.length} verificaciones en orden${allRows.length - okCount ? ` · ${allRows.length - okCount} por revisar` : ""}`
          : `${okCount} of ${allRows.length} checks clear${allRows.length - okCount ? ` · ${allRows.length - okCount} to review` : ""}`
      }
    >
      <div className="space-y-3">
        {groups.map(([title, rows]) => (
          <div key={title.en}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-tm-text-muted">{tb(title, lang)}</p>
            <ul className="divide-y divide-tm-border">
              {rows.map((r) => (
                <li key={r.name} className="flex items-start gap-2.5 py-2 text-sm">
                  <StateIcon state={r.state} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-tm-black">{r.name}</p>
                    <p className="text-xs text-tm-text-light">{r.detail}</p>
                  </div>
                  <span className="shrink-0 text-right text-[11px] leading-snug text-tm-text-muted">
                    {formatDate(r.when, lang)}
                    {today && <span className="block">{tb(TX.checkedToday, lang)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </FoldCard>
  );
}

function CashFlows({ deal, sim, frame, lang }: { deal: PreHarvestDeal; sim: CampaignSimulation; frame: TimelineFrame; lang: Lang }) {
  const es = lang === "es";
  const m = moneyPosition(deal, sim, frame);
  const tk = sim.takeout;
  const poValue = tk.poVolumeKg * tk.poPriceUsdPerKg;
  const advance = tk.coface === "declined" ? 0 : poValue * (tk.cofaceCoveragePct / 100) * (tk.advanceRatePct / 100);
  // An application has moved no money: every row is a proposal.
  const application = deal.status === "application";
  const stateText: Record<string, Bilingual> = { done: TX.done, planned: TX.planned, held: TX.held, stopped: TX.stopped, proposed: L("Proposed", "Propuesto") };
  type Row = { date: string; flow: Bilingual; note?: Bilingual; direction: Bilingual; principal: number; amount: number; state: "done" | "planned" | "held" | "stopped" | "proposed" };
  const repaid = frame.m3Reached && tk.poSignedDate !== null && tk.poSignedDate <= frame.date && frame.date >= addDays(m.maturityDate, -7);
  const rows: Row[] = [
    ...frame.tranches.map(
      (t): Row => ({
        date: t.releasedOn ?? t.dueDate,
        flow: { en: `Tranche ${t.pct}% · ${t.label.en}`, es: `Tramo ${t.pct}% · ${t.label.es}` },
        direction: L("Bank → Grower", "Banco → Productor"),
        principal: application || t.status === "stopped" ? 0 : t.amountUsd,
        amount: -t.amountUsd,
        state: application ? "proposed" : t.status === "released" ? "done" : t.status === "pending" ? "planned" : t.status,
      }),
    ),
    {
      date: m.maturityDate,
      flow: L("Repayment: principal + interest", "Repago: capital + intereses"),
      note: {
        en: `Funded by the post-harvest advance on the buyer's PO: ${formatUsd(Math.round(advance), "en")} (${tk.advanceRatePct}% × Coface ${tk.cofaceCoveragePct}% × PO ${formatUsd(Math.round(poValue), "en")})`,
        es: `Financiado con el adelanto post-cosecha sobre la OC: ${formatUsd(Math.round(advance), "es")} (${tk.advanceRatePct}% × Coface ${tk.cofaceCoveragePct}% × OC ${formatUsd(Math.round(poValue), "es")})`,
      },
      direction: L("Grower → Bank", "Productor → Banco"),
      principal: -Infinity,
      amount: m.amountDueUsd,
      state: application ? "proposed" : repaid ? "done" : "planned",
    },
  ];
  rows.sort((a, b) => a.date.localeCompare(b.date));
  let running = 0;
  const withExposure = rows.map((r) => {
    running = r.principal === -Infinity ? 0 : running + r.principal;
    return { ...r, exposure: running };
  });
  // "Next" marks the next money that will actually move: never a stopped or proposed row.
  const nextIdx = withExposure.findIndex((r) => r.state === "planned" || r.state === "held");
  return (
    <FoldCard
      title={tb(TX.cash, lang)}
      hint={tb(TX.cashSub, lang)}
      lang={lang}
      summary={
        nextIdx >= 0
          ? `${es ? "Próximo" : "Next"}: ${formatDate(withExposure[nextIdx].date, lang)} · ${tb(withExposure[nextIdx].flow, lang)} · ${withExposure[nextIdx].amount < 0 ? "−" : "+"}${formatUsd(Math.abs(withExposure[nextIdx].amount), lang)}`
          : `${withExposure.length} ${es ? "movimientos" : "movements"}`
      }
    >
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-tm-text-muted">
            <tr>
              <th className="py-1.5 pr-3 font-semibold">{tb(TX.date, lang)}</th>
              <th className="py-1.5 pr-3 font-semibold">{tb(TX.flow, lang)}</th>
              <th className="py-1.5 pr-3 font-semibold">{tb(TX.direction, lang)}</th>
              <th className="py-1.5 pr-3 text-right font-semibold">{tb(TX.amount, lang)}</th>
              <th className="py-1.5 pr-3 text-right font-semibold">{tb(TX.exposureCol, lang)}</th>
              <th className="py-1.5 font-semibold">{tb(TX.status, lang)}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-tm-border">
            {withExposure.map((r, i) => (
              <tr key={i} className={`align-top ${i === nextIdx ? "bg-tm-neutral-light" : ""}`}>
                <td className="whitespace-nowrap py-2 pr-3 text-tm-text-light">
                  {formatDate(r.date, lang)}
                  {i === nextIdx && <span className="block text-[11px] font-semibold text-tm-black">{tb(TX.next, lang)}</span>}
                </td>
                <td className="py-2 pr-3 text-tm-black">
                  {tb(r.flow, lang)}
                  {r.note && <span className="block text-xs text-tm-text-light">{tb(r.note, lang)}</span>}
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-xs text-tm-text-light">{tb(r.direction, lang)}</td>
                <td className={`whitespace-nowrap py-2 pr-3 text-right font-semibold tabular-nums ${r.amount < 0 ? "text-tm-black" : "text-tm-primary-dark"}`}>
                  {r.amount < 0 ? "−" : "+"}
                  {formatUsd(Math.abs(r.amount), lang)}
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums text-tm-text-light">{formatUsd(r.exposure, lang)}</td>
                <td className="py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.state === "done" ? "bg-tm-neutral text-tm-black" : r.state === "planned" || r.state === "proposed" ? "text-tm-text-muted" : r.state === "held" ? "bg-tm-accent/15 text-tm-accent-dark" : "bg-tm-danger/15 text-tm-danger-dark"
                    }`}
                  >
                    {tb(stateText[r.state], lang)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </FoldCard>
  );
}

export function RiskDetails({
  deal,
  sim,
  frame,
  current,
  checks,
  ndviSeries,
  lang,
  onCredit,
}: {
  deal: PreHarvestDeal;
  sim: CampaignSimulation;
  frame: TimelineFrame;
  current: PreHarvestAssessment;
  checks: LiveCheck[];
  ndviSeries?: NdviPoint[];
  lang: Lang;
  onCredit: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <ScoreDrivers deal={deal} sim={sim} frame={frame} current={current} origination={sim.origination} application={deal.status === "application"} lang={lang} onCredit={onCredit} />
        <CounterpartyChecks deal={deal} sim={sim} checks={checks} lang={lang} />
      </div>
      <CashFlows deal={deal} sim={sim} frame={frame} lang={lang} />
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-tm-text-muted">{tb(TX.technical, lang)}</p>
        <MonitoringPanels sim={sim} deal={deal} frame={frame} lang={lang} ndviSeries={ndviSeries} />
      </div>
    </div>
  );
}
