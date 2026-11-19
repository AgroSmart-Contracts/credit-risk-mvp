/**
 * Credit timeline: the life of the loan in money. Tranches going out, exposure
 * building up, the buyer's purchase order and the repayment coming back at
 * maturity, with today's position on it.
 */
import { Check } from "lucide-react";
import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { daysBetween, exposureCurve, moneyPosition } from "../../lib/pre-harvest/finance";
import { formatDate, formatUsd, tb } from "../../lib/pre-harvest/i18n";
import { addDays, toTime } from "../../lib/pre-harvest/monitoring";
import type { CampaignSimulation } from "../../lib/pre-harvest/timeline";
import type { Bilingual, Lang, PreHarvestDeal, TimelineFrame, TrancheState } from "../../lib/pre-harvest/types";
import { fileStatus } from "../../lib/pre-harvest/verdict";
import { CHART_COLORS as C } from "./theme";

const L = (en: string, es: string): Bilingual => ({ en, es });
const TX = {
  title: L("Credit timeline", "Línea de tiempo del crédito"),
  sub: L("Money out to the grower, exposure, and repayment back to the bank", "Dinero al productor, exposición y repago al banco"),
  approval: L("Approval", "Aprobación"),
  fruitSet: L("Fruit set", "Cuajado"),
  preHarvest: L("Pre-harvest", "Pre-cosecha"),
  m3: L("Harvest · buyer PO", "Cosecha · OC del comprador"),
  maturity: L("Repayment", "Repago"),
  out: L("out", "desembolsado"),
  planned: L("planned", "previsto"),
  held: L("held", "retenido"),
  days: L("days", "días"),
  awaiting: L("awaiting decision", "en espera de decisión"),
  stopped: L("stopped", "detenido"),
  back: L("back to the bank", "de vuelta al banco"),
  repaid: L("repaid", "repagado"),
  poSigned: L("PO signed", "OC firmada"),
  today: L("Today", "Hoy"),
  exposure: L("Exposure", "Exposición"),
  plan: L("Plan", "Plan"),
  proposed: L("proposed", "propuesto"),
};

type StepState = "done" | "current" | "problem" | "future";

const DOT: Record<StepState, string> = {
  done: "bg-tm-primary text-white border-tm-primary",
  current: "bg-tm-surface border-tm-primary",
  problem: "bg-tm-surface border-tm-accent",
  future: "bg-tm-surface border-tm-border",
};

export function CreditTimeline({
  deal,
  sim,
  frame,
  lang,
}: {
  deal: PreHarvestDeal;
  sim: CampaignSimulation;
  frame: TimelineFrame;
  /** Kept for callers; the update count lives on the "What happened" tab. */
  updates?: number;
  onInvestigate?: () => void;
  lang: Lang;
}) {
  const m = moneyPosition(deal, sim, frame);
  const repaid = fileStatus(frame).status === "repaid";
  const curve = exposureCurve(deal, sim, frame, repaid).map((p) => ({ ...p, t: toTime(p.date) }));
  const fmt = (n: number) => formatUsd(n, lang);
  const dayWord = (n: number) => `${n} ${n === 1 ? (lang === "es" ? "día" : "day") : tb(TX.days, lang)}`;
  const tr = (id: TrancheState["id"]) => frame.tranches.find((t) => t.id === id)!;

  // An application has lent nothing: every step is a proposal, never "stopped" or "back to the bank".
  const application = deal.status === "application";
  const trancheStep = (t: TrancheState, label: Bilingual) => {
    if (application) return { label, state: "future" as StepState, sub: `${fmt(t.amountUsd)} · ${tb(TX.proposed, lang)}`, late: false };
    let state: StepState = "future";
    let sub = `${fmt(t.amountUsd)} · ${tb(TX.planned, lang)} ${formatDate(t.dueDate, lang, false)}`;
    let late = false;
    if (t.status === "released") {
      state = "done";
      const lateDays = daysBetween(t.dueDate, t.releasedOn!);
      late = lateDays > 7;
      sub = `${fmt(t.amountUsd)} ${tb(TX.out, lang)} · ${formatDate(t.releasedOn!, lang, false)}${late ? ` · ${tb(TX.held, lang)} ${dayWord(lateDays)}` : ""}`;
    } else if (t.status === "held") {
      state = "problem";
      late = true;
      sub = `${fmt(t.amountUsd)} ${tb(TX.held, lang)} ${dayWord(daysBetween(t.dueDate, frame.date))} · ${tb(TX.awaiting, lang)}`;
    } else if (t.status === "stopped") {
      state = "problem";
      late = true;
      sub = `${fmt(t.amountUsd)} ${tb(TX.stopped, lang)}`;
    } else if (frame.date >= addDays(t.dueDate, -21)) {
      state = "current";
    }
    return { label, state, sub, late };
  };

  const po = sim.takeout.poSignedDate;
  const poSeen = po !== null && po <= frame.date;
  const poValue = sim.takeout.poVolumeKg * sim.takeout.poPriceUsdPerKg;
  const steps = [
    trancheStep(tr("approval"), TX.approval),
    trancheStep(tr("fruit_set"), TX.fruitSet),
    trancheStep(tr("pre_harvest"), TX.preHarvest),
    {
      label: TX.m3,
      state: (poSeen ? "done" : frame.date >= addDays(deal.m3Date, -21) ? "current" : "future") as StepState,
      sub: poSeen ? `${tb(TX.poSigned, lang)} ${fmt(Math.round(poValue))} · ${formatDate(po!, lang, false)}` : `${tb(TX.planned, lang)} ${formatDate(deal.m3Date, lang, false)}`,
      late: false,
    },
    {
      label: TX.maturity,
      state: (repaid ? "done" : frame.date >= addDays(m.maturityDate, -21) ? "current" : "future") as StepState,
      sub: application
        ? `${fmt(m.amountDueUsd)} · ${tb(TX.proposed, lang)}`
        : repaid
        ? `${fmt(m.amountDueUsd)} ${tb(TX.repaid, lang)}`
        : `${fmt(m.amountDueUsd)} ${tb(TX.back, lang)} · ${formatDate(m.maturityDate, lang, false)}`,
      late: false,
    },
  ];
  const progress = Math.max(0, Math.min(100, (m.daysElapsed / deal.tenorDays) * 100));
  const max = Math.max(deal.envelopeUsd, 1);

  return (
    <section className="rounded-xl border border-tm-border bg-tm-surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base text-tm-black">{tb(TX.title, lang)}</h3>
          <p className="text-xs text-tm-text-light">
            {application ? (lang === "es" ? "Propuesta" : "Proposed") + ": " : ""}{formatDate(m.startDate, lang)} → {formatDate(m.maturityDate, lang)} · {tb(TX.sub, lang)}
          </p>
        </div>
      </div>

      <div className="h-28" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={curve} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
            <XAxis dataKey="t" type="number" scale="time" domain={[toTime(m.startDate), toTime(m.maturityDate)]} hide />
            <YAxis domain={[0, max * 1.08]} hide />
            <Tooltip
              cursor={{ stroke: C.muted, strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof curve)[number];
                const v = p.actual ?? p.planned;
                return (
                  <div className="rounded-lg border border-tm-border bg-tm-surface px-3 py-2 text-xs shadow-tm-md">
                    <p className="text-tm-text-muted">{formatDate(p.date, lang)}</p>
                    <p className="font-semibold text-tm-black">
                      {tb(p.actual !== null ? TX.exposure : TX.plan, lang)}: {v === null ? "–" : fmt(v)}
                    </p>
                  </div>
                );
              }}
            />
            <Area
              dataKey="actual"
              type="stepAfter"
              stroke={C.ink}
              strokeWidth={2}
              fill={C.ink}
              fillOpacity={0.1}
              connectNulls={false}
              isAnimationActive
              animationDuration={500}
              animationEasing="ease-out"
            />
            <Line dataKey="planned" type="stepAfter" stroke={C.muted} strokeDasharray="4 4" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
            {!repaid && <ReferenceLine x={toTime(frame.date)} stroke={C.ink} strokeWidth={1} label={{ value: tb(TX.today, lang), position: "insideTopRight", fontSize: 10, fill: C.ink }} />}
            <ReferenceLine x={toTime(deal.m3Date)} stroke={C.muted} strokeDasharray="2 3" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="relative mt-3">
        <div className="absolute left-[10%] right-[10%] top-3.5 h-0.5 bg-tm-border" />
        <div className="absolute left-[10%] top-3.5 h-0.5 bg-tm-primary transition-[width] duration-500" style={{ width: `${progress * 0.8}%` }} />
        <ol className="relative grid grid-cols-5">
          {steps.map((s, i) => (
            <li key={i} className="flex flex-col items-center px-1 text-center">
              <span className={`grid h-7 w-7 place-items-center rounded-full border-2 transition-colors duration-300 ${DOT[s.state]}`}>
                {s.state === "done" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : s.state === "problem" ? (
                  <span className="h-2 w-2 rounded-full bg-tm-accent" />
                ) : s.state === "current" ? (
                  <span className="h-2 w-2 rounded-full bg-tm-primary" />
                ) : null}
              </span>
              <span className={`mt-2 text-xs font-semibold sm:text-sm ${s.state === "future" ? "text-tm-text-muted" : "text-tm-black"}`}>{tb(s.label, lang)}</span>
              <span className={`text-[11px] leading-snug ${s.late || s.state === "problem" ? "font-medium text-tm-accent-dark" : "text-tm-text-light"}`}>{s.sub}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
