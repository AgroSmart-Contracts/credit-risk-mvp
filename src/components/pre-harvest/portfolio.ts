/**
 * The bank's book of pre-harvest files, computed once for the whole workspace:
 * each file's latest week, its money position, the decision it is waiting on and
 * its active TruMarket alerts. Feeds the dashboard, inbox, decisions and alerts.
 */
import { simulateFile } from "../../data/pre-harvest/files";
import { trancheConditions } from "../../lib/pre-harvest/credit-metrics";
import { moneyPosition, type MoneyPosition } from "../../lib/pre-harvest/finance";
import { addDays, yieldAdjustment } from "../../lib/pre-harvest/monitoring";
import type { CampaignSimulation } from "../../lib/pre-harvest/timeline";
import type { PreHarvestDeal, Severity, TimelineFrame, TrancheState, Trigger } from "../../lib/pre-harvest/types";
import { fileStatus, type FileStatus } from "../../lib/pre-harvest/verdict";
import type { Bilingual } from "../../lib/pre-harvest/types";

export interface PendingDecision {
  kind: "approval" | "tranche";
  tranche: TrancheState | null;
  amountUsd: number;
  dueDate: string;
  daysLeft: number;
  met: number;
  total: number;
}

export interface ActiveAlert {
  trigger: Trigger;
  /** When TruMarket will next look at this signal. */
  recheckBy: string;
}

export interface FileRow {
  deal: PreHarvestDeal;
  sim: CampaignSimulation;
  frame: TimelineFrame;
  status: FileStatus;
  action: Bilingual;
  money: MoneyPosition;
  worst: Severity;
  decision: PendingDecision | null;
  alerts: ActiveAlert[];
}

const DAY = 86_400_000;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

const nextMonthDay = (date: string, day: number) => {
  const [y, m] = date.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-${String(day).padStart(2, "0")}` : `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

/**
 * When TruMarket next gets new data for a signal, counted from the latest data on
 * file (not the weekly step): the next satellite pass, tomorrow's weather, NOAA's
 * monthly El Niño release, next month's export prices.
 */
function recheck(t: Trigger, sim: CampaignSimulation, dataDate: string): string {
  if (t.panel === "crop") {
    const lastPass = sim.series.crop.filter((p) => p.date <= dataDate).at(-1)?.date ?? dataDate;
    const next = addDays(lastPass, 5);
    return next > dataDate ? next : addDays(dataDate, 1);
  }
  if (t.panel === "weather") return t.metric === "enso" ? nextMonthDay(dataDate, 10) : addDays(dataDate, 1);
  return nextMonthDay(dataDate, 15);
}

export function buildRow(deal: PreHarvestDeal): FileRow {
  const sim = simulateFile(deal);
  const frame = sim.frames.at(-1)!;
  const fs = fileStatus(frame);
  // The latest data on file (daily weather): "today" for due dates and re-checks.
  const dataDate = deal.status === "live" ? (sim.series.weather.filter((p) => p.tmax !== null).at(-1)?.date ?? frame.date) : frame.date;
  const sev = Object.values(frame.panels).map((p) => p.severity);
  const worst: Severity = sev.includes("red") ? "red" : sev.includes("yellow") ? "yellow" : "green";
  const open = deal.status !== "closed" && sim.origination.tier !== "VETO";
  let decision: PendingDecision | null = null;
  if (open) {
    const yieldAdj = yieldAdjustment(sim.series.crop, frame.date);
    if (deal.status === "application") {
      const t = frame.tranches[0];
      const conds = trancheConditions(deal, t, frame, sim.fruitSetDelayDays, yieldAdj);
      decision = { kind: "approval", tranche: null, amountUsd: deal.envelopeUsd, dueDate: deal.approvalDate, daysLeft: daysBetween(dataDate, deal.approvalDate), met: conds.filter((c) => c.status === "met").length, total: conds.length };
    } else {
      const t = frame.tranches.find((x) => x.status === "pending" || x.status === "held");
      if (t && (t.status === "held" || daysBetween(dataDate, t.dueDate) <= 45)) {
        const conds = trancheConditions(deal, t, frame, sim.fruitSetDelayDays, yieldAdj);
        decision = { kind: "tranche", tranche: t, amountUsd: t.amountUsd, dueDate: t.dueDate, daysLeft: daysBetween(dataDate, t.dueDate), met: conds.filter((c) => c.status === "met").length, total: conds.length };
      }
    }
  }
  const alerts: ActiveAlert[] =
    deal.status === "live" ? Object.values(frame.panels).flatMap((p) => p.triggers.map((trigger) => ({ trigger, recheckBy: recheck(trigger, sim, dataDate) }))) : [];
  return { deal, sim, frame, status: fs.status, action: fs.action, money: moneyPosition(deal, sim, frame), worst: deal.status === "live" ? worst : "green", decision, alerts };
}
