/**
 * The bank's view of a pre-harvest file: every monitoring signal translated into
 * money. Exposure, money at risk, when the money goes out and comes back, and
 * what each TruMarket update changes for the loan.
 */
import { PD_BY_TIER } from "./config";
import { lgdPct } from "./credit-metrics";
import { addDays, ndviBaseline, toTime, yieldAdjustment, type CropPoint } from "./monitoring";
import { PANEL_LABELS, type CampaignSimulation } from "./timeline";
import { fileStatus } from "./verdict";
import type { AlertLogEntry, Bilingual, NdviPoint, PanelId, PreHarvestDeal, TimelineFrame, TrancheState } from "./types";

const DAY = 86_400_000;
const usd = (n: number, es = false) => `USD ${Math.round(n).toLocaleString(es ? "es-PE" : "en-US")}`;
const x2 = (n: number) => `${n.toFixed(2)}×`;
export const daysBetween = (a: string, b: string) => Math.round((toTime(b) - toTime(a)) / DAY);

// ---------------------------------------------------------------------------
// Money position at a date
// ---------------------------------------------------------------------------

export interface MoneyPosition {
  startDate: string;
  maturityDate: string;
  daysElapsed: number;
  daysToMaturity: number;
  committedUsd: number;
  exposureUsd: number;
  /** Principal + interest due at maturity on the full commitment. */
  amountDueUsd: number;
  /** Indicative expected loss on what is out today: exposure × PD(tier) × LGD. */
  moneyAtRiskUsd: number;
  pdPct: number;
  lgdPct: number;
  /** What repays the loan ÷ amount due: the buyer's PO advance once signed, the expected harvest before. */
  coverage: number | null;
  coverageSource: "po" | "harvest";
  repaid: boolean;
  expectedRepaymentUsd: number | null;
  /** Coverage if the harvest sells at a 1-in-10 low price for that month. */
  downsideCoverage: number | null;
  /** What would be missing at maturity in that low-price case (0 = still covered). */
  downsideShortfallUsd: number | null;
  /** Next money out of the bank, if any. */
  nextTranche: TrancheState | null;
}

/** Low-price ratio (P10 ÷ median) for the harvest calendar month, from the seasonal band. */
function lowPriceRatio(sim: CampaignSimulation, deal: PreHarvestDeal): number | null {
  const m = deal.m3Date.slice(5, 7);
  const p = sim.series.market.filter((x) => x.month.slice(5, 7) === m && x.p50 > 0).at(-1);
  return p ? p.p10 / p.p50 : null;
}

export function moneyPosition(deal: PreHarvestDeal, sim: CampaignSimulation, frame: TimelineFrame): MoneyPosition {
  const maturityDate = addDays(deal.approvalDate, deal.tenorDays);
  const pd = PD_BY_TIER[frame.tier];
  const lgd = lgdPct(deal) / 100;
  // A repaid loan has nothing out and nothing at risk, whatever was disbursed during the campaign.
  const repaid = fileStatus(frame).status === "repaid";
  const exposure = repaid ? 0 : frame.outstandingUsd;
  // Once the buyer's PO is signed, the post-harvest advance is the repayment: its coverage
  // replaces the harvest estimate, so every view quotes the same figure.
  const tk = sim.takeout;
  const poSigned = tk.poSignedDate !== null && tk.poSignedDate <= frame.date;
  const advance = tk.coface === "declined" ? 0 : tk.poVolumeKg * tk.poPriceUsdPerKg * (tk.cofaceCoveragePct / 100) * (tk.advanceRatePct / 100);
  const coverage = poSigned && sim.amountDue > 0 ? Math.round((advance / sim.amountDue) * 100) / 100 : frame.coverageRatio;
  const low = lowPriceRatio(sim, deal);
  const downsideCoverage = !repaid && !poSigned && coverage !== null && low !== null ? Math.round(coverage * Math.min(1, low) * 100) / 100 : null;
  const downsideShortfallUsd = downsideCoverage === null ? null : Math.max(0, Math.round(sim.amountDue * (1 - downsideCoverage)));
  const nextTranche = frame.tranches.find((t) => t.status === "pending" || t.status === "held") ?? null;
  return {
    startDate: deal.approvalDate,
    maturityDate,
    daysElapsed: Math.max(0, Math.min(deal.tenorDays, daysBetween(deal.approvalDate, frame.date))),
    daysToMaturity: Math.max(0, daysBetween(frame.date, maturityDate)),
    committedUsd: deal.envelopeUsd,
    exposureUsd: exposure,
    amountDueUsd: Math.round(sim.amountDue),
    moneyAtRiskUsd: Math.round(exposure * pd * lgd),
    pdPct: pd * 100,
    lgdPct: lgd * 100,
    coverage,
    coverageSource: poSigned ? "po" : "harvest",
    repaid,
    expectedRepaymentUsd: coverage === null ? null : Math.round(coverage * sim.amountDue),
    downsideCoverage,
    downsideShortfallUsd,
    nextTranche,
  };
}

// ---------------------------------------------------------------------------
// Financial reading of a TruMarket update
// ---------------------------------------------------------------------------

export interface FinancialImpact {
  /** One line a credit officer reads first. */
  headline: Bilingual;
  /** Supporting figures: coverage, money at risk, score. */
  details: Bilingual[];
  /** Did this update cost the bank something (coverage or risk moved the wrong way)? */
  adverse: boolean;
}

function trancheEffect(frame: TimelineFrame, es: boolean): string {
  const next = frame.tranches.find((t) => t.status === "pending" || t.status === "held");
  const remaining = frame.tranches.filter((t) => t.status !== "released").reduce((s, t) => s + t.amountUsd, 0);
  switch (frame.action) {
    case "stop":
      return es ? `desembolsos detenidos: ${usd(remaining, true)} no se libera` : `disbursements stopped: ${usd(remaining)} stays with the bank`;
    case "hold_tranche":
      return next
        ? es
          ? `tramo de ${usd(next.amountUsd, true)} retenido hasta que se normalice`
          : `${usd(next.amountUsd)} tranche on hold until it normalises`
        : es
          ? "sin tramos pendientes"
          : "no tranche left to hold";
    case "call_inspection":
      return next
        ? es
          ? `inspección de campo antes de liberar ${usd(next.amountUsd, true)}`
          : `field inspection before releasing ${usd(next.amountUsd)}`
        : es
          ? "inspección de campo recomendada"
          : "field inspection recommended";
    default:
      return es ? "sin cambio en los desembolsos" : "no change to disbursements";
  }
}

/** What changed for the money between the week before an update and the week of it. */
export function financialImpact(deal: PreHarvestDeal, sim: CampaignSimulation, alert: Pick<AlertLogEntry, "date">): FinancialImpact {
  const i = sim.frames.findIndex((f) => f.date === alert.date);
  const frame = sim.frames[i] ?? sim.frames.at(-1)!;
  const prev = i > 0 ? sim.frames[i - 1] : null;
  const now = moneyPosition(deal, sim, frame);
  const before = prev ? moneyPosition(deal, sim, prev) : null;

  const covFrom = before?.coverage ?? sim.frames[0]?.coverageRatio ?? null;
  const covTo = now.coverage;
  const scoreFrom = prev?.composite ?? sim.origination.composite;
  const scoreDelta = frame.composite - scoreFrom;
  // Money at risk as if the full line were drawn: comparable across weeks whatever was released.
  const pd = (t: TimelineFrame["tier"]) => PD_BY_TIER[t];
  const lgd = lgdPct(deal) / 100;
  const riskFrom = Math.round(deal.envelopeUsd * pd(prev?.tier ?? sim.origination.tier) * lgd);
  const riskTo = Math.round(deal.envelopeUsd * pd(frame.tier) * lgd);

  const details: Bilingual[] = [];
  if (covTo !== null) {
    const moved = covFrom !== null && Math.abs(covTo - covFrom) >= 0.01;
    details.push(
      moved
        ? { en: `Repayment coverage ${x2(covFrom!)} → ${x2(covTo)}`, es: `Cobertura del repago ${x2(covFrom!)} → ${x2(covTo)}` }
        : { en: `Repayment coverage holds at ${x2(covTo)}`, es: `Cobertura del repago se mantiene en ${x2(covTo)}` },
    );
  }
  if (riskTo !== riskFrom) {
    details.push({
      en: `Money at risk on the full line ${usd(riskFrom)} → ${usd(riskTo)}`,
      es: `Dinero en riesgo sobre la línea completa ${usd(riskFrom, true)} → ${usd(riskTo, true)}`,
    });
  }
  if (scoreDelta !== 0) {
    details.push({
      en: `Risk score ${scoreDelta > 0 ? "+" : ""}${scoreDelta} (now ${frame.composite} · ${frame.tier})`,
      es: `Score de riesgo ${scoreDelta > 0 ? "+" : ""}${scoreDelta} (ahora ${frame.composite} · ${frame.tier})`,
    });
  }

  const adverse = (covFrom !== null && covTo !== null && covTo < covFrom - 0.005) || riskTo > riskFrom || scoreDelta < 0 || frame.action !== "continue";
  return {
    headline: { en: capital(trancheEffect(frame, false)), es: capital(trancheEffect(frame, true)) },
    details,
    adverse,
  };
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------------------------------------------------------------------------
// Who did what
// ---------------------------------------------------------------------------

export type Actor = "trumarket" | "bank" | "analyst" | "buyer" | "insurer" | "public";

export const ACTOR_TEXT: Record<Actor, Bilingual> = {
  trumarket: { en: "TruMarket", es: "TruMarket" },
  bank: { en: "BCP credit", es: "Crédito BCP" },
  analyst: { en: "Analyst", es: "Analista" },
  buyer: { en: "Buyer", es: "Comprador" },
  insurer: { en: "Coface", es: "Coface" },
  public: { en: "Public source", es: "Fuente pública" },
};

/** "TruMarket · Weather and water": who raised an update and on what. */
export function updateTitle(alert: Pick<AlertLogEntry, "panel">): Bilingual {
  return { en: `TruMarket update · ${PANEL_LABELS[alert.panel].en}`, es: `Actualización TruMarket · ${PANEL_LABELS[alert.panel].es}` };
}

// ---------------------------------------------------------------------------
// Credit timeline: money out, money back
// ---------------------------------------------------------------------------

export interface CashPoint {
  date: string;
  /** Exposure actually outstanding (observed weeks). */
  actual: number | null;
  /** Planned exposure for weeks not reached yet. */
  planned: number | null;
}

/** Weekly exposure: what has gone out so far, then the plan to maturity (tranches out, repayment back). */
export function exposureCurve(deal: PreHarvestDeal, sim: CampaignSimulation, frame: TimelineFrame, repaid = false): CashPoint[] {
  const maturity = addDays(deal.approvalDate, deal.tenorDays);
  const out: CashPoint[] = [];
  for (const f of sim.frames) {
    if (f.date > frame.date) break;
    out.push({ date: f.date, actual: f.outstandingUsd, planned: null });
  }
  if (repaid) {
    out.push({ date: maturity, actual: 0, planned: null });
    return out;
  }
  const last = out.at(-1);
  if (last) last.planned = last.actual;
  if (frame.action === "stop") return out;
  const pending = frame.tranches.filter((t) => t.status === "pending" || t.status === "held");
  let level = frame.outstandingUsd;
  for (let d = addDays(frame.date, 7); d <= maturity; d = addDays(d, 7)) {
    for (const t of pending) {
      const due = t.dueDate > frame.date ? t.dueDate : addDays(frame.date, 7);
      if (due <= d && due > addDays(d, -7)) level += t.amountUsd;
    }
    out.push({ date: d, actual: null, planned: level });
  }
  out.push({ date: maturity, actual: null, planned: 0 });
  return out;
}

// ---------------------------------------------------------------------------
// Expected path (outlook to harvest)
// ---------------------------------------------------------------------------

export interface CropOutlookPoint {
  date: string;
  expected: number;
  low: number;
  high: number;
}

/**
 * The parcel's expected NDVI from the cut-off to harvest: its own same-season
 * median, carrying today's anomaly and fading it out over four weeks, inside the
 * range seen in previous years.
 */
export function cropOutlook(series: NdviPoint[], crop: CropPoint[], asOf: string, until: string): CropOutlookPoint[] {
  const last = crop.filter((p) => p.date <= asOf).at(-1);
  if (!last || !(last.median > 0)) return [];
  const anomaly = last.ndvi / last.median - 1;
  const out: CropOutlookPoint[] = [{ date: last.date, expected: last.ndvi, low: last.ndvi, high: last.ndvi }];
  for (let d = addDays(last.date, 16); d <= until; d = addDays(d, 16)) {
    const b = ndviBaseline(series, d);
    if (!Number.isFinite(b.median)) continue;
    const weeks = daysBetween(last.date, d) / 7;
    const fade = Math.max(0, 1 - weeks / 4);
    const expected = b.median * (1 + anomaly * fade);
    const spread = Number.isFinite(b.min) && Number.isFinite(b.max) ? (b.max - b.min) / 2 : b.median * 0.08;
    out.push({
      date: d,
      expected: round3(expected),
      low: round3(Math.min(expected, Math.max(0, expected - spread))),
      high: round3(Math.max(expected, expected + spread)),
    });
  }
  return out;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

// ---------------------------------------------------------------------------
// What each monitoring area means for the loan
// ---------------------------------------------------------------------------

/** One sentence per monitoring area, in money: what TruMarket's reading does to repayment. */
export function panelMoneyReading(panel: PanelId, deal: PreHarvestDeal, sim: CampaignSimulation, frame: TimelineFrame): Bilingual {
  const due = sim.amountDue;
  const cov = frame.coverageRatio;
  const rev = frame.expectedRevenueUsd;
  const sev = frame.panels[panel].severity;
  switch (panel) {
    case "crop": {
      const y = Math.round(yieldAdjustment(sim.series.crop, frame.date) * 100);
      return rev !== null && cov !== null
        ? {
            en: `Expected harvest ${y}% of declared: about ${usd(rev)} for the grower, ${x2(cov)} the ${usd(due)} due.`,
            es: `Cosecha esperada ${y}% de lo declarado: unos ${usd(rev, true)} para el productor, ${x2(cov)} los ${usd(due, true)} adeudados.`,
          }
        : { en: `Expected harvest ${y}% of declared.`, es: `Cosecha esperada ${y}% de lo declarado.` };
    }
    case "weather": {
      if (sev === "green") return { en: "No weather cost to the loan so far: the yield outlook is unchanged.", es: "Sin costo climático para el préstamo: la proyección de rendimiento no cambia." };
      const perTen = cov !== null ? cov * 0.1 : null;
      return {
        en: `Weather stress puts yield at risk${perTen !== null ? `: every 10% of harvest lost takes about ${perTen.toFixed(2)}× off the ${x2(cov!)} coverage` : ""}.`,
        es: `El estrés climático pone en riesgo el rendimiento${perTen !== null ? `: cada 10% de cosecha perdida resta ~${perTen.toFixed(2)}× a la cobertura de ${x2(cov!)}` : ""}.`,
      };
    }
    case "market": {
      const p = frame.expectedHarvestPrice;
      return p !== null && rev !== null && cov !== null
        ? {
            en: `At USD ${p.toFixed(2)}/kg the harvest brings about ${usd(rev)} to the grower: ${x2(cov)} principal + interest.`,
            es: `A USD ${p.toFixed(2)}/kg la cosecha deja unos ${usd(rev, true)} al productor: ${x2(cov)} capital + intereses.`,
          }
        : { en: "No price yet to value the harvest.", es: "Aún sin precio para valorar la cosecha." };
    }
    case "takeout": {
      const tk = sim.takeout;
      const signed = tk.poSignedDate !== null && tk.poSignedDate <= frame.date;
      const advance = tk.coface === "declined" ? 0 : tk.poVolumeKg * tk.poPriceUsdPerKg * (tk.cofaceCoveragePct / 100) * (tk.advanceRatePct / 100);
      return signed
        ? {
            en: `The buyer's PO funds a ${usd(advance)} advance against ${usd(due)} due: ${x2(advance / due)}.`,
            es: `La OC del comprador financia un adelanto de ${usd(advance, true)} frente a ${usd(due, true)} adeudados: ${x2(advance / due)}.`,
          }
        : {
            en: `Repayment depends on the buyer's PO at harvest (${formatShort(deal.m3Date)}); until then the harvest outlook is the only cover.`,
            es: `El repago depende de la OC del comprador en cosecha (${formatShort(deal.m3Date, true)}); hasta entonces la proyección de cosecha es la única cobertura.`,
          };
    }
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];
const formatShort = (d: string, es = false) => `${Number(d.slice(8, 10))} ${(es ? MESES : MONTHS)[Number(d.slice(5, 7)) - 1]}`;

const nextMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
};

export interface PriceOutlookPoint {
  month: string;
  expected: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
}

/**
 * Expected export price from the last observed month to `untilMonth`: each future
 * month takes its seasonal band from the latest year with that calendar month, and
 * the price follows the band's median, carrying half of today's gap to it.
 */
export function priceOutlook(sim: CampaignSimulation, asOf: string, untilMonth: string): PriceOutlookPoint[] {
  const seen = sim.series.market.filter((p) => p.month < asOf.slice(0, 7));
  const last = seen.at(-1);
  if (!last || !(last.p50 > 0)) return [];
  const ratio = last.usdPerKg / last.p50;
  const out: PriceOutlookPoint[] = [{ month: last.month, expected: last.usdPerKg, p10: last.p10, p25: last.p25, p50: last.p50, p75: last.p75 }];
  for (let m = nextMonth(last.month); m <= untilMonth; m = nextMonth(m)) {
    const band = sim.series.market.filter((p) => p.month.slice(5, 7) === m.slice(5, 7) && p.p50 > 0).at(-1);
    if (!band) continue;
    out.push({ month: m, expected: Math.round(band.p50 * (1 + (ratio - 1) * 0.5) * 100) / 100, p10: band.p10, p25: band.p25, p50: band.p50, p75: band.p75 });
  }
  return out;
}
