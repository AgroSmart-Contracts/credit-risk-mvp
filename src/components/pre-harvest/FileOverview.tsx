/**
 * The top of a file, in the order an analyst reads it: who and where (header),
 * what needs deciding now and why (decision card), the four numbers that matter
 * (KPI row) and where the campaign stands (stepper).
 * Colour only marks what needs attention; every condition shows its evidence.
 */
import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  FileDown,
  Lightbulb,
  MapPin,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  keyRisksAndMitigants,
  recommendationFor,
  RECOMMENDATION_TEXT,
  trancheConditions,
  type Condition,
} from "../../lib/pre-harvest/credit-metrics";
import { DECISION_TEXT, saveDecision, type DecisionEntry, type DecisionKind } from "../../lib/pre-harvest/decisions";
import { formatDate, formatUsd, tb } from "../../lib/pre-harvest/i18n";
import { moneyPosition } from "../../lib/pre-harvest/finance";
import { expectedKg, toTime } from "../../lib/pre-harvest/monitoring";
import { ringAreaHa } from "../../lib/pre-harvest/application-reader";
import { type CampaignSimulation } from "../../lib/pre-harvest/timeline";
import { fileStatus, fileStatusLabel, mainTrigger } from "../../lib/pre-harvest/verdict";
import type { Bilingual, Lang, PreHarvestAssessment, PreHarvestDeal, TimelineFrame, TrancheState } from "../../lib/pre-harvest/types";
import { STATUS_STYLE } from "./file-style";
import { LiveDot } from "./motion";

const L = (en: string, es: string): Bilingual => ({ en, es });
const TX = {
  files: L("Pre-harvest files", "Expedientes pre-cosecha"),
  memo: L("Credit memo", "Memo de crédito"),
  live: L("Monitored by TruMarket", "Monitoreado por TruMarket"),
  checking: L("checking sources…", "revisando fuentes…"),
  checkedToday: L("checked today", "revisado hoy"),
  dataAsOf: L("Data as of", "Datos al"),
  closed: L("Closed campaign", "Campaña cerrada"),
  application: L("Application", "Solicitud"),
  day: L("Day", "Día"),
  of: L("of", "de"),
  declared: L("declared", "declarada"),
  measured: L("measured", "medida"),
  decisionNeeded: L("Decision needed", "Decisión pendiente"),
  due: L("due", "vence"),
  outcome: L("Campaign outcome", "Resultado de la campaña"),
  recommends: L("TruMarket recommends", "TruMarket recomienda"),
  recommended: L("Recommended", "Recomendado"),
  met: L("met", "cumplidas"),
  ofConditions: L("of", "de"),
  conditionsTitle: L("Conditions to release", "Condiciones para liberar"),
  approve: L("Approve", "Aprobar"),
  hold: L("Hold", "Retener"),
  inspect: L("Request inspection", "Solicitar inspección"),
  decline: L("Decline", "Rechazar"),
  confirm: L("Confirm", "Confirmar"),
  cancel: L("Cancel", "Cancelar"),
  analyst: L("Analyst", "Analista"),
  note: L("Note for the file (optional)", "Nota para el expediente (opcional)"),
  recorded: L("Recorded", "Registrado"),
  by: L("by", "por"),
  score: L("Credit risk score", "Puntaje de riesgo"),
  higherSafer: L("higher = safer", "mayor = más seguro"),
  sinceOrigination: L("since origination", "desde la originación"),
  atOrigination: L("at origination", "a la originación"),
  movedBy: L("Moved by", "Movido por"),
  exposure: L("Bank exposure", "Exposición del banco"),
  disbursedOf: L("disbursed of", "desembolsado de"),
  dueAtMaturity: L("Due at maturity", "Vence al cierre"),
  coverage: L("coverage", "cobertura"),
  repayment: L("Repayment", "Repago"),
  poSigned: L("PO signed", "OC firmada"),
  poPending: L("Buyer PO not yet signed", "OC del comprador aún no firmada"),
  viaTakeout: L("via M3 takeout (post-harvest advance on the PO)", "vía toma en M3 (adelanto post-cosecha sobre la OC)"),
  signals: L("Watch signals", "Señales de vigilancia"),
  allWithin: L("All within band", "Todo dentro de banda"),
  more: L("more", "más"),
  timeline: L("Campaign timeline", "Línea de tiempo de la campaña"),
  approval: L("Approval", "Aprobación"),
  fruitSet: L("Fruit set", "Cuajado"),
  preHarvest: L("Pre-harvest", "Pre-cosecha"),
  m3: L("Harvest · PO (M3)", "Cosecha · OC (M3)"),
  maturity: L("Maturity", "Vencimiento"),
  released: L("released", "liberado"),
  heldFor: L("held", "retenido"),
  days: L("days", "días"),
  awaiting: L("awaiting decision", "en espera de decisión"),
  stopped: L("stopped", "detenido"),
  planned: L("planned", "previsto"),
  today: L("Today", "Hoy"),
  repaid: L("repaid", "cancelado"),
  viewEvents: L("See what happened", "Ver qué pasó"),
  disbursed: L("Disbursed", "Desembolsado"),
  volume: L("Volume", "Volumen"),
  price: L("Price", "Precio"),
  vsDeclared: L("vs expected exportable", "vs exportable esperado"),
  vsReference: L("vs reference at approval", "vs referencia a la aprobación"),
  mainRisk: L("Main risk during the campaign", "Riesgo principal en la campaña"),
  alertsRaised: L("alerts raised", "alertas generadas"),
};

const days = (a: string, b: string) => Math.round((toTime(b) - toTime(a)) / 86_400_000);
const btnBase = "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50";
const btn = `${btnBase} border-tm-border bg-tm-surface text-tm-black hover:border-tm-text-muted`;
const btnPrimary = `${btnBase} border-tm-primary bg-tm-primary text-white hover:bg-tm-primary-dark`;

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

/** Aerial image of the parcel (Esri World Imagery, keyless export) with the surveyed outline on top. */
function ParcelImage({ ring, badge }: { ring: Array<[number, number]>; badge: string | null }) {
  const W = 640;
  const H = 400;
  const lons = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  const cx = (Math.min(...lons) + Math.max(...lons)) / 2;
  const cy = (Math.min(...lats) + Math.max(...lats)) / 2;
  // Parcel takes about a third of the frame; keep the frame at 16:10 in degrees.
  let half = Math.max(Math.max(...lons) - Math.min(...lons), (Math.max(...lats) - Math.min(...lats)) * (W / H)) * 1.6;
  half = Math.max(half, 0.004);
  const [w, e] = [cx - half, cx + half];
  const halfLat = (half * H) / W;
  const [s, n] = [cy - halfLat, cy + halfLat];
  const src =
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export" +
    `?bbox=${w},${s},${e},${n}&bboxSR=4326&imageSR=4326&size=${W},${H}&format=jpg&f=image`;
  const pts = ring.map(([lon, lat]) => `${((lon - w) / (e - w)) * W},${((n - lat) / (n - s)) * H}`).join(" ");
  return (
    <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-xl bg-tm-neutral sm:w-64">
      <img src={src} alt="" className="h-full w-full object-cover" fetchPriority="high" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full">
        <polygon points={pts} fill="rgba(255,255,255,0.08)" stroke="#ffffff" strokeWidth={3} strokeLinejoin="round" />
      </svg>
      {badge && (
        <span className="absolute bottom-2 left-2 rounded-md bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-tm-black shadow-sm">{badge}</span>
      )}
      <span className="absolute bottom-2 right-2 text-[9px] text-white/80 drop-shadow">Esri, Maxar</span>
    </div>
  );
}

export function FileHeader({
  deal,
  sim,
  frame,
  lang,
  onBack,
  onPrint,
  atEnd = true,
  monitored = false,
  checking = false,
}: {
  deal: PreHarvestDeal;
  sim: CampaignSimulation;
  frame: TimelineFrame;
  lang: Lang;
  onBack: () => void;
  onPrint: () => void;
  /** False while replaying an earlier week: the header shows that week's day, not "Closed". */
  atEnd?: boolean;
  /** Live files: TruMarket is monitoring this file (the pulsing dot), and whether it is running its checks right now. */
  monitored?: boolean;
  checking?: boolean;
}) {
  const fs = fileStatus(frame);
  const style = STATUS_STYLE[fs.status];
  const measured = ringAreaHa(deal.parcel);
  const areaDiff = ((deal.formato.areaHa - measured) / measured) * 100;
  const day = Math.max(0, Math.min(deal.tenorDays, days(deal.approvalDate, frame.date)));
  void sim;
  const stage =
    deal.status === "closed" && atEnd
      ? tb(TX.closed, lang)
      : deal.status === "application"
        ? tb(TX.application, lang)
        : `${tb(TX.day, lang)} ${day} ${tb(TX.of, lang)} ${deal.tenorDays}`;

  return (
    <header className="space-y-3">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm text-tm-text-light hover:text-tm-black print:hidden">
        <ArrowLeft className="h-4 w-4" />
        {tb(TX.files, lang)}
      </button>
      <div className="flex flex-col gap-5 rounded-2xl border border-tm-border bg-tm-surface p-4 shadow-tm-sm sm:flex-row sm:items-center">
        <ParcelImage ring={deal.parcel} badge={null} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {/* While replaying an earlier week the verdict below is that week's; the status pill is only for the replay. */}
            {!atEnd && (
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-semibold ${style.pill}`}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: style.dot }} />
                {tb(fileStatusLabel(fs.status, deal.status), lang)}
              </span>
            )}
            <span className="rounded-full bg-tm-neutral px-2.5 py-0.5 text-tm-text-light">{tb(deal.campaign, lang)}</span>
            {/* Applications and closed files: the status pill already says it. */}
            {deal.status === "live" || !atEnd ? <span className="rounded-full bg-tm-neutral px-2.5 py-0.5 text-tm-text-light">{stage}</span> : null}
          </div>
          <h2 className="mt-2 font-display text-[26px] leading-tight text-tm-black sm:text-[32px]">{tb(deal.name, lang)}</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-sm text-tm-text-light">
            <MapPin className="h-3.5 w-3.5" />
            {tb(deal.location, lang)} · {deal.formato.areaHa.toFixed(2)} ha {tb(TX.declared, lang)} · {measured.toFixed(2)} ha {tb(TX.measured, lang)}
            {Math.abs(areaDiff) > 5 && (
              <span className="inline-flex items-center gap-1 font-medium text-tm-accent-dark">
                <AlertTriangle className="h-3.5 w-3.5" />
                {areaDiff > 0 ? "+" : ""}
                {areaDiff.toFixed(0)}%
              </span>
            )}
          </p>
          {monitored ? (
            <p className="mt-1.5 inline-flex flex-wrap items-center gap-x-2 text-xs font-medium text-tm-black">
              <LiveDot />
              {tb(TX.live, lang)} · {tb(TX.dataAsOf, lang).toLowerCase()} {formatDate(frame.date, lang)} · {tb(checking ? TX.checking : TX.checkedToday, lang)}
            </p>
          ) : (
            <p className="mt-1 text-xs text-tm-text-muted">
              {tb(TX.dataAsOf, lang)} {formatDate(frame.date, lang)}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 print:hidden">
            <button type="button" onClick={onPrint} className={btn}>
              <FileDown className="h-4 w-4" />
              {tb(TX.memo, lang)}
            </button>
        </div>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Decision / outcome card
// ---------------------------------------------------------------------------

const ORDER: Record<Condition["status"], number> = { failed: 0, pending: 1, met: 2 };

function ConditionChip({ c, lang }: { c: Condition; lang: Lang }) {
  const Icon = c.status === "met" ? CheckCircle2 : c.status === "failed" ? XCircle : Circle;
  const tone =
    c.status === "failed" ? "border-tm-danger/40 bg-tm-danger/5" : c.status === "pending" ? "border-tm-border bg-tm-surface" : "border-tm-border bg-tm-neutral-light";
  void tone;
  return (
    <li className="flex max-w-md gap-1.5 text-sm">
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${c.status === "met" ? "text-tm-primary" : c.status === "failed" ? "text-tm-danger-dark" : "text-tm-text-muted"}`}
        aria-label={c.status}
      />
      <span className="min-w-0">
        <span className={c.status === "failed" ? "font-medium text-tm-danger-dark" : "text-tm-black"}>{tb(c.label, lang)}</span>
        {c.detail && <span className="text-xs text-tm-text-light"> · {tb(c.detail, lang)}</span>}
      </span>
    </li>
  );
}

const ANALYST_KEY = "tm-pre-harvest-analyst";
const readAnalyst = () => {
  try {
    return localStorage.getItem(ANALYST_KEY) ?? "";
  } catch {
    return "";
  }
};

function DecisionActions({
  deal,
  subject,
  amountUsd,
  kinds,
  primary,
  decisions,
  onDecisions,
  lang,
}: {
  deal: PreHarvestDeal;
  subject: string;
  amountUsd: number | null;
  kinds: DecisionKind[];
  primary: DecisionKind;
  decisions: DecisionEntry[];
  onDecisions: (d: DecisionEntry[]) => void;
  lang: Lang;
}) {
  const [pending, setPending] = useState<DecisionKind | null>(null);
  const [analyst, setAnalyst] = useState(readAnalyst);
  const [note, setNote] = useState("");
  const last = [...decisions].reverse().find((d) => d.subject === subject);
  const label: Record<DecisionKind, Bilingual> = { approve: TX.approve, hold: TX.hold, inspect: TX.inspect, decline: TX.decline };

  const confirm = () => {
    if (!pending || !analyst.trim()) return;
    try {
      localStorage.setItem(ANALYST_KEY, analyst.trim());
    } catch {
      /* ignore */
    }
    onDecisions(
      saveDecision(deal.id, { at: new Date().toISOString(), kind: pending, subject, amountUsd, analyst: analyst.trim(), note: note.trim() }),
    );
    setPending(null);
    setNote("");
  };

  return (
    <div className="print:hidden">
      {last && (
        <p className="mb-2 inline-flex items-center gap-1.5 rounded-md bg-tm-neutral px-2 py-1 text-xs text-tm-text-light">
          <Check className="h-3.5 w-3.5" />
          {tb(TX.recorded, lang)}: <b className="text-tm-black">{tb(DECISION_TEXT[last.kind], lang)}</b> {tb(TX.by, lang)} {last.analyst} ·{" "}
          {formatDate(last.at.slice(0, 10), lang)}
        </p>
      )}
      {pending ? (
        <div className="space-y-2 rounded-lg border border-tm-border bg-tm-neutral-light p-3">
          <p className="text-sm font-medium text-tm-black">
            {tb(label[pending], lang)} · {subject}
            {amountUsd !== null && ` · ${formatUsd(amountUsd, lang)}`}
          </p>
          <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
            <input
              value={analyst}
              onChange={(e) => setAnalyst(e.target.value)}
              placeholder={tb(TX.analyst, lang)}
              aria-label={tb(TX.analyst, lang)}
              className="rounded-md border border-tm-border bg-tm-surface px-2.5 py-1.5 text-sm"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={tb(TX.note, lang)}
              aria-label={tb(TX.note, lang)}
              className="rounded-md border border-tm-border bg-tm-surface px-2.5 py-1.5 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={confirm} disabled={!analyst.trim()} className={btnPrimary}>
              {tb(TX.confirm, lang)}
            </button>
            <button type="button" onClick={() => setPending(null)} className={btn}>
              {tb(TX.cancel, lang)}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-2">
          {/* Every option starts neutral: the analyst decides; TruMarket's suggestion is only tagged. */}
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setPending(k)}
              className={k === primary ? "inline-flex items-center gap-2 rounded-lg border border-tm-black bg-tm-black px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90" : btn}
            >
              {tb(label[k], lang)}
              {k === primary && <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">{tb(TX.recommended, lang)}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function nextTranche(frame: TimelineFrame): TrancheState | undefined {
  return frame.tranches.find((tr) => tr.status === "held" || tr.status === "pending");
}

export function DecisionCard({
  deal,
  sim,
  frame,
  current,
  yieldAdj,
  atEnd = true,
  decisions,
  onDecisions,
  onInvestigate,
  lang,
}: {
  deal: PreHarvestDeal;
  sim: CampaignSimulation;
  frame: TimelineFrame;
  current: PreHarvestAssessment;
  yieldAdj: number;
  /** False while replaying an earlier week: the card shows the decision of that week, read-only. */
  atEnd?: boolean;
  decisions: DecisionEntry[];
  onDecisions: (d: DecisionEntry[]) => void;
  onInvestigate: () => void;
  lang: Lang;
}) {
  const fs = fileStatus(frame);
  const trig = mainTrigger(frame);

  if (deal.status === "closed" && atEnd) return <OutcomeCard deal={deal} sim={sim} frame={frame} onInvestigate={onInvestigate} lang={lang} />;

  const veto = sim.origination.tier === "VETO";
  const isApplication = (deal.status === "application" && atEnd) || veto;
  const tranche = isApplication ? frame.tranches[0] : nextTranche(frame);
  if (!tranche && !veto) {
    // Between the last release and maturity: nothing to decide, show where the file stands.
    return (
      <section className="rounded-xl border-2 border-tm-border bg-tm-surface p-4 shadow-tm-sm sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-tm-text-muted">{formatDate(frame.date, lang)}</p>
        <h3 className="text-lg font-semibold text-tm-black">{tb(fs.action, lang)}</h3>
      </section>
    );
  }

  const subject = veto
    ? lang === "es"
      ? "Solicitud de préstamo"
      : "Loan application"
    : isApplication
      ? `${tb(TX.approval, lang)} · ${formatUsd(deal.envelopeUsd, lang)}`
      : `${lang === "es" ? "Tramo" : "Tranche"} ${tranche!.pct}% · ${tb(tranche!.label, lang)}`;
  const title = veto
    ? lang === "es"
      ? "Rechazar la solicitud"
      : "Decline the application"
    : isApplication
      ? lang === "es"
        ? `Aprobar el préstamo · ${formatUsd(deal.envelopeUsd, lang)} · ${deal.tenorDays} días`
        : `Approve the loan · ${formatUsd(deal.envelopeUsd, lang)} · ${deal.tenorDays} days`
      : lang === "es"
        ? `Liberar tramo ${tranche!.pct}% · ${formatUsd(tranche!.amountUsd, lang)}`
        : `Release tranche ${tranche!.pct}% · ${formatUsd(tranche!.amountUsd, lang)}`;

  const conditions: Condition[] = veto
    ? sim.origination.vetoReasons.map((r) => ({ label: r, status: "failed" as const }))
    : [...trancheConditions(deal, tranche!, frame, sim.fruitSetDelayDays, yieldAdj)].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const failed = conditions.filter((c) => c.status === "failed").length;
  const met = conditions.filter((c) => c.status === "met").length;

  const { risks } = keyRisksAndMitigants(current);
  const rec: Bilingual = veto
    ? {
        en: "Decline: no money is lent. If the grower disputes the finding, request a field inspection before reconsidering.",
        es: "Rechazar: no se presta dinero. Si el productor objeta el hallazgo, solicitar una inspección de campo antes de reconsiderar.",
      }
    : isApplication
      ? {
          en: `${RECOMMENDATION_TEXT[recommendationFor(sim.origination.tier as Exclude<typeof sim.origination.tier, "VETO">)].en}. ${met} of ${conditions.length} conditions met${risks[0] ? `; main risk: ${risks[0].label.en.toLowerCase()} (${risks[0].value.en})` : ""}.`,
          es: `${RECOMMENDATION_TEXT[recommendationFor(sim.origination.tier as Exclude<typeof sim.origination.tier, "VETO">)].es}. ${met} de ${conditions.length} condiciones cumplidas${risks[0] ? `; riesgo principal: ${risks[0].label.es.toLowerCase()} (${risks[0].value.es})` : ""}.`,
        }
      : {
          en: `${fs.action.en}${trig ? ` Driven by: ${trig.message.en}.` : ""}`,
          es: `${fs.action.es}${trig ? ` Motivo: ${trig.message.es}.` : ""}`,
        };

  const tone = veto || failed ? "border-tm-danger/40" : fs.status === "watch" || fs.status === "followup" ? "border-tm-accent/50" : "border-tm-primary/40";

  // The decision in money: what moves, and what it does to exposure and expected loss.
  const mp = moneyPosition(deal, sim, frame);
  const el = (outUsd: number) => Math.round(outUsd * (mp.pdPct / 100) * (mp.lgdPct / 100));
  const fmt = (n: number) => formatUsd(n, lang);
  const money: Bilingual | null = veto
    ? {
        en: `Declining moves no money. Approving would put ${fmt(deal.envelopeUsd)} out over ${deal.tenorDays} days, ${fmt(frame.tranches[0].amountUsd)} at signing.`,
        es: `Rechazar no mueve dinero. Aprobar pondría ${fmt(deal.envelopeUsd)} durante ${deal.tenorDays} días, ${fmt(frame.tranches[0].amountUsd)} a la firma.`,
      }
    : isApplication
      ? {
          en: `Approving puts ${fmt(frame.tranches[0].amountUsd)} out at signing and ${fmt(deal.envelopeUsd)} over the campaign; ${fmt(mp.amountDueUsd)} comes back in ${deal.tenorDays} days. Expected loss on the full line: ${fmt(el(deal.envelopeUsd))}.`,
          es: `Aprobar desembolsa ${fmt(frame.tranches[0].amountUsd)} a la firma y ${fmt(deal.envelopeUsd)} en la campaña; vuelven ${fmt(mp.amountDueUsd)} en ${deal.tenorDays} días. Pérdida esperada sobre la línea: ${fmt(el(deal.envelopeUsd))}.`,
        }
      : tranche
        ? {
            en: `Releasing takes what is out from ${fmt(mp.exposureUsd)} to ${fmt(mp.exposureUsd + tranche.amountUsd)} and expected loss from ${fmt(el(mp.exposureUsd))} to ${fmt(el(mp.exposureUsd + tranche.amountUsd))}. Holding keeps ${fmt(tranche.amountUsd)} with the bank.`,
            es: `Liberar lleva lo desembolsado de ${fmt(mp.exposureUsd)} a ${fmt(mp.exposureUsd + tranche.amountUsd)} y la pérdida esperada de ${fmt(el(mp.exposureUsd))} a ${fmt(el(mp.exposureUsd + tranche.amountUsd))}. Retener mantiene ${fmt(tranche.amountUsd)} en el banco.`,
          }
        : null;

  return (
    <section id="decision-card" className={`scroll-mt-4 rounded-xl border-2 bg-tm-surface p-4 shadow-tm-sm sm:p-5 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-tm-text-muted">
              {tb(TX.decisionNeeded, lang)}
              {tranche && !veto && ` · ${tb(TX.due, lang)} ${formatDate(tranche.dueDate, lang)}`}
              {tranche && !veto && tranche.dueDate < frame.date && (
                <span className="text-tm-danger-dark">
                  {" · "}
                  {(() => {
                    const n = Math.round((Date.parse(frame.date) - Date.parse(tranche.dueDate)) / 86_400_000);
                    return lang === "es" ? `${n} ${n === 1 ? "día" : "días"} vencida` : `${n} ${n === 1 ? "day" : "days"} overdue`;
                  })()}
                </span>
              )}

            </p>
            <h3 className="text-lg font-semibold text-tm-black sm:text-xl">{title}</h3>
          </div>
        </div>
        {atEnd ? (
        <DecisionActions
          deal={deal}
          subject={subject}
          amountUsd={veto ? null : isApplication ? deal.envelopeUsd : tranche!.amountUsd}
          kinds={veto ? ["decline", "inspect"] : ["hold", "inspect", "approve"]}
          primary={
            veto
              ? "decline"
              : failed || frame.action === "hold_tranche" || frame.action === "stop"
                ? "hold"
                : frame.action === "call_inspection"
                  ? "inspect"
                  : "approve"
          }
          decisions={decisions}
          onDecisions={onDecisions}
          lang={lang}
        />
        ) : (
          <span className="rounded-md bg-tm-neutral px-2 py-1 text-xs text-tm-text-light">
            {lang === "es" ? `Situación al ${formatDate(frame.date, lang)}` : `As of ${formatDate(frame.date, lang)}`}
          </span>
        )}
      </div>
      {/* What the decision does to the money, before the conditions behind it. */}
      {money && <p className="mt-3 text-[15px] leading-snug text-tm-black">{tb(money, lang)}</p>}
      <div className="mt-3 border-t border-tm-border pt-2.5">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-tm-text-muted">
          {veto ? (lang === "es" ? "Motivo" : "Reason") : `${tb(TX.conditionsTitle, lang)} · ${met}/${conditions.length}`}
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
          {conditions.map((c, i) => (
            <ConditionChip key={i} c={c} lang={lang} />
          ))}
        </ul>
      </div>
      {/* A red condition already says why; the line is only for files where nothing failed. */}
      {failed === 0 && (
        <p className="mt-3 flex gap-2 rounded-lg bg-tm-neutral-light px-3 py-2 text-sm text-tm-black">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-tm-text-light" />
          <span>
            <b>{tb(TX.recommends, lang)}:</b> {tb(rec, lang)}
          </span>
        </p>
      )}
    </section>
  );
}

function OutcomeCard({
  deal,
  sim,
  frame,
  onInvestigate,
  lang,
}: {
  deal: PreHarvestDeal;
  sim: CampaignSimulation;
  frame: TimelineFrame;
  onInvestigate: () => void;
  lang: Lang;
}) {
  const fs = fileStatus(frame);
  const tk = sim.takeout;
  const declaredKg = expectedKg(deal, 1);
  const volPct = Math.round((tk.poVolumeKg / declaredKg - 1) * 100);
  const pricePct = sim.referencePrice ? Math.round((tk.poPriceUsdPerKg / sim.referencePrice - 1) * 100) : null;
  const red = sim.alerts.find((a) => a.severity === "red") ?? sim.alerts[0];
  // Monitoring steps weekly: a release within a week of its due date is on time.
  const held = frame.tranches.filter((t) => t.releasedOn && days(t.dueDate, t.releasedOn) > 7);

  const Fact = ({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) => (
    <div className="rounded-lg bg-tm-neutral-light px-3 py-2">
      <p className="text-[11px] text-tm-text-muted">{label}</p>
      <p className="text-sm font-semibold text-tm-black">{value}</p>
      {sub && <p className="text-xs text-tm-text-light">{sub}</p>}
    </div>
  );

  return (
    <section className="rounded-xl border-2 border-tm-border bg-tm-surface p-4 shadow-tm-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-tm-neutral">
            <ShieldCheck className="h-5 w-5 text-tm-black" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-tm-text-muted">{tb(TX.outcome, lang)}</p>
            <h3 className="text-lg font-semibold text-tm-black sm:text-xl">{tb(fs.action, lang)}</h3>
          </div>
        </div>
        <button type="button" onClick={onInvestigate} className={`${btn} print:hidden`}>
          {tb(TX.viewEvents, lang)} →
        </button>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Fact
          label={tb(TX.disbursed, lang)}
          value={`${formatUsd(frame.outstandingUsd, lang)} / ${formatUsd(deal.envelopeUsd, lang)}`}
          sub={held.map((t) => `${t.pct}% ${tb(TX.heldFor, lang)} ${days(t.dueDate, t.releasedOn!)} ${tb(TX.days, lang)}`).join(" · ") || undefined}
        />
        <Fact
          label={`${tb(TX.poSigned, lang)} · ${tk.poSignedDate ? formatDate(tk.poSignedDate, lang) : "–"}`}
          value={`${(tk.poVolumeKg / 1000).toFixed(1)} t · USD ${tk.poPriceUsdPerKg.toFixed(2)}/kg`}
          sub={`Coface ${tk.cofaceCoveragePct}% · ${tk.buyerCountry}`}
        />
        <Fact label={tb(TX.volume, lang)} value={`${volPct >= 0 ? "+" : ""}${volPct}%`} sub={`${(tk.poVolumeKg / 1000).toFixed(1)} t ${tb(TX.vsDeclared, lang)} ${(declaredKg / 1000).toFixed(1)} t`} />
        <Fact
          label={tb(TX.price, lang)}
          value={pricePct === null ? "–" : `${pricePct >= 0 ? "+" : ""}${pricePct}%`}
          sub={`USD ${tk.poPriceUsdPerKg.toFixed(2)} ${tb(TX.vsReference, lang)} ${sim.referencePrice.toFixed(2)}`}
        />
      </div>
      {red && (
        <p className="mt-3 flex gap-2 rounded-lg bg-tm-neutral-light px-3 py-2 text-sm text-tm-black">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-tm-accent-dark" />
          <span>
            <b>{tb(TX.mainRisk, lang)}:</b> {tb(red.message, lang)} ({formatDate(red.date, lang)}) · {sim.alerts.length} {tb(TX.alertsRaised, lang)}
          </span>
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Decision log
// ---------------------------------------------------------------------------

export function DecisionLog({ decisions, lang }: { decisions: DecisionEntry[]; lang: Lang }) {
  return (
    <section className="rounded-xl border border-tm-border bg-tm-surface p-4 shadow-tm-sm sm:p-5">
      <h3 className="mb-3 font-display text-base text-tm-black">{lang === "es" ? "Decisiones del analista" : "Analyst decisions"}</h3>
      {decisions.length === 0 ? (
        <p className="text-sm text-tm-text-light">{lang === "es" ? "Aún no hay decisiones registradas." : "No decisions recorded yet."}</p>
      ) : (
        <ul className="divide-y divide-tm-border text-sm">
          {[...decisions].reverse().map((d, i) => (
            <li key={i} className="flex flex-wrap justify-between gap-2 py-2">
              <span>
                <b className="text-tm-black">{tb(DECISION_TEXT[d.kind], lang)}</b> · {d.subject}
                {d.amountUsd !== null && ` · ${formatUsd(d.amountUsd, lang)}`}
                {d.note && <span className="text-tm-text-light"> · “{d.note}”</span>}
              </span>
              <span className="text-xs text-tm-text-muted">
                {d.analyst} · {new Date(d.at).toLocaleString(lang === "es" ? "es-PE" : "en-GB")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
