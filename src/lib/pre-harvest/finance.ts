/**
 * The bank's view of a pre-harvest file: every monitoring signal translated into
 * money. Exposure, money at risk, when the money goes out and comes back, and
 * what each TruMarket update changes for the loan.
 */
import { PD_BY_TIER } from "./config";
import { lgdPct } from "./credit-metrics";
import { addDays, ndviBaseline, toTime, type CropPoint } from "./monitoring";
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

  // The cushion: what the repayment leaves over the amount due, in USD (coverage in brackets).
  const due = sim.amountDue;
  const cushion = (c: number) => Math.round(c * due - due);
  const signed = (n: number, es = false) => (n < 0 ? `−${usd(-n, es)}` : usd(n, es));
  const details: Bilingual[] = [];
  if (covTo !== null) {
    const moved = covFrom !== null && Math.abs(covTo - covFrom) >= 0.01;
    details.push(
      moved
        ? {
            en: `Cushion ${signed(cushion(covFrom!))} → ${signed(cushion(covTo))} (${x2(covFrom!)} → ${x2(covTo)})`,
            es: `Holgura ${signed(cushion(covFrom!), true)} → ${signed(cushion(covTo), true)} (${x2(covFrom!)} → ${x2(covTo)})`,
          }
        : { en: `Cushion unchanged at ${signed(cushion(covTo))} (${x2(covTo)})`, es: `Holgura sin cambio en ${signed(cushion(covTo), true)} (${x2(covTo)})` },
    );
  }
  if (riskTo !== riskFrom) {
    details.push({
      en: `Expected loss on the full line ${usd(riskFrom)} → ${usd(riskTo)}`,
      es: `Pérdida esperada sobre la línea completa ${usd(riskFrom, true)} → ${usd(riskTo, true)}`,
    });
  }
  if (scoreDelta !== 0) {
    details.push({
      en: `Risk score ${scoreDelta > 0 ? "+" : ""}${scoreDelta} (now ${frame.composite} · ${frame.tier})`,
      es: `Score de riesgo ${scoreDelta > 0 ? "+" : ""}${scoreDelta} (ahora ${frame.composite} · ${frame.tier})`,
    });
  }

  const adverse = (covFrom !== null && covTo !== null && covTo < covFrom - 0.005) || riskTo > riskFrom || scoreDelta < 0 || frame.action !== "continue";
  // An application has no disbursements to stop or hold: the update weighs on the approval instead.
  if (deal.status === "application") {
    return {
      headline:
        frame.tier === "VETO"
          ? { en: `Counts against approval: TruMarket recommends declining the ${usd(deal.envelopeUsd)} request`, es: `Pesa contra la aprobación: TruMarket recomienda rechazar los ${usd(deal.envelopeUsd, true)} solicitados` }
          : { en: `Weighs on the approval of ${usd(deal.envelopeUsd)}; nothing is lent yet`, es: `Pesa en la aprobación de ${usd(deal.envelopeUsd, true)}; aún no se presta nada` },
      details,
      adverse,
    };
  }
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
  // The cushion: harvest value minus the amount due. Each panel says what it does to it, once.
  const cushion = rev !== null ? rev - due : null;
  const signed = (n: number, es = false) => (n < 0 ? `−${usd(-n, es)}` : usd(n, es));
  switch (panel) {
    case "crop":
      return rev !== null && cushion !== null
        ? {
            en: `the harvest is worth about ${usd(rev)} against ${usd(due)} due: ${signed(cushion)} cushion (${x2(cov!)}).`,
            es: `la cosecha vale unos ${usd(rev, true)} frente a ${usd(due, true)} adeudados: ${signed(cushion, true)} de holgura (${x2(cov!)}).`,
          }
        : { en: "no harvest value yet.", es: "aún sin valor de cosecha." };
    case "weather": {
      if (sev === "green") return { en: "no weather cost so far; the harvest outlook is unchanged.", es: "sin costo climático por ahora; la proyección de cosecha no cambia." };
      return rev !== null && cushion !== null
        ? {
            en: `every 10% of harvest lost takes about ${usd(rev * 0.1)} off the ${signed(cushion)} cushion.`,
            es: `cada 10% de cosecha perdida resta unos ${usd(rev * 0.1, true)} a la holgura de ${signed(cushion, true)}.`,
          }
        : { en: "weather stress puts the harvest at risk.", es: "el estrés climático pone en riesgo la cosecha." };
    }
    case "market": {
      const p = frame.expectedHarvestPrice;
      if (p === null || rev === null || cushion === null || p <= 0) return { en: "no price yet to value the harvest.", es: "aún sin precio para valorar la cosecha." };
      const per10c = (rev / p) * 0.1;
      return {
        en: `each USD 0.10/kg lower price takes about ${usd(per10c)} off the cushion; the loan is short below USD ${(p / cov!).toFixed(2)}/kg.`,
        es: `cada USD 0,10/kg menos resta unos ${usd(per10c, true)} a la holgura; falta para el repago bajo USD ${(p / cov!).toFixed(2)}/kg.`,
      };
    }
    case "takeout": {
      const tk = sim.takeout;
      const signedPo = tk.poSignedDate !== null && tk.poSignedDate <= frame.date;
      const advance = tk.coface === "declined" ? 0 : tk.poVolumeKg * tk.poPriceUsdPerKg * (tk.cofaceCoveragePct / 100) * (tk.advanceRatePct / 100);
      return signedPo
        ? {
            en: `the buyer's PO funds a ${usd(advance)} advance against ${usd(due)} due: ${signed(advance - due)} cushion.`,
            es: `la OC del comprador financia un adelanto de ${usd(advance, true)} frente a ${usd(due, true)} adeudados: ${signed(advance - due, true)} de holgura.`,
          }
        : {
            en: `repayment comes from the buyer's PO at harvest (${formatShort(deal.m3Date)}); until then the harvest value is the only cover.`,
            es: `el repago sale de la OC del comprador en cosecha (${formatShort(deal.m3Date, true)}); hasta entonces el valor de la cosecha es la única cobertura.`,
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

// ---------------------------------------------------------------------------
// The bank's bottom line: how to feel about this file, in money
// ---------------------------------------------------------------------------

/** How the bank should feel about a file, from its money position. */
export type BankMood = "comfortable" | "watch" | "act" | "decide" | "settled";

export interface BadCase {
  /** What the bad case assumes, in one line. */
  label: Bilingual;
  /** Repayment ÷ amount due in the bad case. */
  coverage: number;
  /** Money the repayment would leave over (positive) or be short (negative). */
  cushionUsd: number;
}

export interface BankView {
  mood: BankMood;
  /** The one sentence the bank reads first. */
  headline: Bilingual;
  /** Expected repayment − amount due: what the bank has to spare. Null with no harvest value yet. */
  cushionUsd: number | null;
  /** How far the harvest value (yield or price) can fall before the repayment is short, %. */
  maxDropPct: number | null;
  badCase: BadCase | null;
  /** The next money decision, if one is coming. */
  nextMove: Bilingual | null;
}

/** Yield cut the realistic bad case assumes: the stress test's moderate (Watch) or severe (High risk) harvest loss. */
function yieldCutFor(frame: TimelineFrame): number {
  const sev = [frame.panels.crop.severity, frame.panels.weather.severity];
  return sev.includes("red") ? 0.3 : sev.includes("yellow") ? 0.15 : 0;
}

export function bankView(deal: PreHarvestDeal, sim: CampaignSimulation, frame: TimelineFrame): BankView {
  const m = moneyPosition(deal, sim, frame);
  const fs = fileStatus(frame);
  const due = m.amountDueUsd;
  const cushionUsd = m.expectedRepaymentUsd === null ? null : m.expectedRepaymentUsd - due;
  const maxDropPct = m.coverage !== null && m.coverage > 0 ? Math.max(0, Math.round((1 - 1 / m.coverage) * 100)) : null;
  const maturity = formatShort(m.maturityDate);
  const maturityEs = formatShort(m.maturityDate, true);

  // Bad case: before the PO, the harvest sells at a 1-in-10 low price for its month, and if
  // crop or weather is off, the harvest is also 15% (Watch) or 30% (High risk) smaller.
  let badCase: BadCase | null = null;
  if (m.coverage !== null && !m.repaid && m.coverageSource === "harvest") {
    const low = lowPriceRatio(sim, deal);
    const cut = yieldCutFor(frame);
    const factor = Math.min(1, low ?? 1) * (1 - cut);
    if (factor < 1) {
      const coverage = Math.round(m.coverage * factor * 100) / 100;
      const pct = (n: number) => Math.round(n * 100);
      badCase = {
        label:
          low !== null && cut > 0
            ? { en: `price at a 1-in-10 low (−${pct(1 - low)}%) and a ${pct(cut)}% smaller harvest`, es: `precio en un mínimo de 1 en 10 años (−${pct(1 - low)}%) y una cosecha ${pct(cut)}% menor` }
            : cut > 0
              ? { en: `a ${pct(cut)}% smaller harvest`, es: `una cosecha ${pct(cut)}% menor` }
              : { en: `price at a 1-in-10 low (−${pct(1 - (low ?? 1))}%)`, es: `precio en un mínimo de 1 en 10 años (−${pct(1 - (low ?? 1))}%)` },
        coverage,
        cushionUsd: Math.round(m.expectedRepaymentUsd! * factor) - due,
      };
    }
  }

  // Next money decision.
  let nextMove: Bilingual | null = null;
  const t = m.nextTranche;
  if (deal.status === "live" && t && frame.action !== "stop") {
    const verb =
      frame.action === "hold_tranche" || t.status === "held"
        ? { en: "TruMarket says hold it", es: "TruMarket recomienda retenerlo" }
        : frame.action === "call_inspection"
          ? { en: "inspect the field first", es: "inspeccionar el campo antes" }
          : { en: "on track to release", es: "en camino a liberarse" };
    nextMove = {
      en: `Next money out: ${usd(t.amountUsd)} on ${formatShort(t.dueDate)} (${verb.en}).`,
      es: `Próximo desembolso: ${usd(t.amountUsd, true)} el ${formatShort(t.dueDate, true)} (${verb.es}).`,
    };
  } else if (deal.status === "live" && frame.action === "stop") {
    const left = frame.tranches.filter((x) => x.status !== "released").reduce((s, x) => s + x.amountUsd, 0);
    if (left > 0) nextMove = { en: `Disbursements stopped: ${usd(left)} stays with the bank.`, es: `Desembolsos detenidos: ${usd(left, true)} se quedan en el banco.` };
  }

  // Settled files: nothing at stake.
  if (m.repaid) {
    return {
      mood: "settled",
      headline: {
        en: `Repaid in full: ${usd(due)} came back by ${maturity}, including ${usd(due - deal.envelopeUsd)} interest. Nothing is at stake.`,
        es: `Cancelado: volvieron ${usd(due, true)} al ${maturityEs}, con ${usd(due - deal.envelopeUsd, true)} de intereses. Nada en juego.`,
      },
      cushionUsd: null,
      maxDropPct: null,
      badCase: null,
      nextMove: null,
    };
  }
  if (deal.status === "closed") {
    return { mood: "settled", headline: { en: "Campaign closed; nothing is at stake.", es: "Campaña cerrada; nada en juego." }, cushionUsd: null, maxDropPct: null, badCase: null, nextMove: null };
  }

  // Applications: nothing is lent yet; say what approving would put at stake.
  if (deal.status === "application") {
    const stake = `${usd(deal.envelopeUsd)} for ${deal.tenorDays} days`;
    const stakeEs = `${usd(deal.envelopeUsd, true)} por ${deal.tenorDays} días`;
    if (fs.status === "declined") {
      // The reason is on the decision card; here only what is at stake.
      return {
        mood: "decide",
        headline: {
          en: `Nothing is lent yet. TruMarket recommends declining: approving would put ${stake} on a harvest it cannot verify.`,
          es: `Aún no se presta nada. TruMarket recomienda rechazar: aprobar pondría ${stakeEs} sobre una cosecha que no puede verificar.`,
        },
        cushionUsd: null,
        maxDropPct: null,
        badCase: null,
        nextMove: null,
      };
    }
    return {
      mood: "decide",
      headline:
        cushionUsd !== null
          ? {
              en: `Nothing is lent yet. Approving puts ${stake}; the expected harvest repays the ${usd(due)} due with ${usd(cushionUsd)} to spare.`,
              es: `Aún no se presta nada. Aprobar pone ${stakeEs}; la cosecha esperada repaga los ${usd(due, true)} con ${usd(cushionUsd, true)} de holgura.`,
            }
          : { en: `Nothing is lent yet. Approving puts ${stake}.`, es: `Aún no se presta nada. Aprobar pone ${stakeEs}.` },
      cushionUsd,
      maxDropPct,
      badCase,
      nextMove: null,
    };
  }

  // Live loans.
  const panels = Object.values(frame.panels).map((p) => p.severity);
  const short = (badCase && badCase.cushionUsd < 0) || (m.coverage !== null && m.coverage < 1);
  // Act now = disbursements stopped or the repayment no longer covered; anything off-normal is Watch.
  const mood: BankMood =
    frame.action === "stop" || (m.coverage !== null && m.coverage < 1)
      ? "act"
      : panels.includes("red") || panels.includes("yellow") || frame.action !== "continue" || short || (m.coverage !== null && m.coverage < 1.2)
        ? "watch"
        : "comfortable";
  const out = { en: `BCP has ${usd(m.exposureUsd)} out`, es: `BCP tiene ${usd(m.exposureUsd, true)} desembolsados` };
  const back =
    cushionUsd === null
      ? { en: `${usd(due)} is due on ${maturity}`, es: `vencen ${usd(due, true)} el ${maturityEs}` }
      : cushionUsd >= 0
        ? {
            en: `${m.coverageSource === "po" ? "the buyer's PO" : "the expected harvest"} repays the ${usd(due)} due on ${maturity} with ${usd(cushionUsd)} to spare`,
            es: `${m.coverageSource === "po" ? "la OC del comprador" : "la cosecha esperada"} repaga los ${usd(due, true)} del ${maturityEs} con ${usd(cushionUsd, true)} de holgura`,
          }
        : {
            en: `the expected repayment is ${usd(-cushionUsd)} short of the ${usd(due)} due on ${maturity}`,
            es: `al repago esperado le faltan ${usd(-cushionUsd, true)} de los ${usd(due, true)} del ${maturityEs}`,
          };
  // Watch and Act say why, in one phrase: the worst monitoring area, or the money itself.
  const worstPanel = (["weather", "crop", "market", "takeout"] as const)
    .filter((p) => frame.panels[p].severity !== "green")
    .sort((a, b) => Number(frame.panels[b].severity === "red") - Number(frame.panels[a].severity === "red"))[0];
  const why = worstPanel
    ? {
        en: `${PANEL_LABELS[worstPanel].en} ${frame.panels[worstPanel].severity === "red" ? "at high risk" : "on watch"}`,
        es: `${PANEL_LABELS[worstPanel].es} ${frame.panels[worstPanel].severity === "red" ? "en riesgo alto" : "en vigilancia"}`,
      }
    : { en: "thin cover", es: "cobertura ajustada" };
  // The mood pill already says "Watch closely" / "Act now": the sentence starts with the reason.
  const lead: Record<Exclude<BankMood, "decide" | "settled">, Bilingual> = {
    comfortable: { en: "On track.", es: "En curso." },
    watch: { en: `${capital(why.en)}.`, es: `${capital(why.es)}.` },
    act: { en: `${capital(why.en)}.`, es: `${capital(why.es)}.` },
  };
  const bad =
    badCase && badCase.cushionUsd < 0 && (cushionUsd ?? 0) >= 0
      ? { en: ` In a bad case it would be ${usd(-badCase.cushionUsd)} short.`, es: ` En un mal escenario faltarían ${usd(-badCase.cushionUsd, true)}.` }
      : { en: "", es: "" };
  return {
    mood,
    headline: {
      en: `${lead[mood as keyof typeof lead].en} ${out.en}; ${back.en}.${bad.en}`,
      es: `${lead[mood as keyof typeof lead].es} ${out.es}; ${back.es}.${bad.es}`,
    },
    cushionUsd,
    maxDropPct,
    badCase,
    nextMove,
  };
}


/**
 * What one outside signal does to the money: the cushion in USD under the
 * harvest cut it implies, or how far the price can fall before the loan is short.
 */
export function signalMoney(kind: "enso" | "price" | "water", severity: "green" | "yellow" | "red", deal: PreHarvestDeal, sim: CampaignSimulation, frame: TimelineFrame): Bilingual | null {
  const m = moneyPosition(deal, sim, frame);
  // Nothing to say in money for a settled file or an application TruMarket would decline.
  if (m.repaid || deal.status === "closed" || (deal.status === "application" && sim.origination.tier === "VETO")) return null;
  if (m.expectedRepaymentUsd === null || m.coverage === null) return null;
  const due = m.amountDueUsd;
  const cushion = m.expectedRepaymentUsd - due;
  if (kind === "price") {
    if (m.coverageSource === "po") return { en: "Price fixed by the buyer's PO: no effect now", es: "Precio fijado por la OC: sin efecto ahora" };
    const p = frame.expectedHarvestPrice;
    const drop = Math.max(0, Math.round((1 - 1 / m.coverage) * 100));
    return p !== null
      ? { en: `Can fall to USD ${(p / m.coverage).toFixed(2)}/kg (−${drop}%) before the loan is short`, es: `Puede caer a USD ${(p / m.coverage).toFixed(2)}/kg (−${drop}%) antes de que falte para el repago` }
      : null;
  }
  if (severity === "green") return { en: "No cost to the loan", es: "Sin costo para el préstamo" };
  if (m.coverageSource === "po") return { en: "Repayment now rests on the buyer's PO", es: "El repago ya depende de la OC del comprador" };
  const cut = severity === "red" ? 0.3 : 0.15;
  const after = Math.round(m.expectedRepaymentUsd * (1 - cut)) - due;
  return after >= 0
    ? {
        en: `A ${cut * 100}% smaller harvest cuts the cushion from ${usd(cushion)} to ${usd(after)}`,
        es: `Una cosecha ${cut * 100}% menor reduce la holgura de ${usd(cushion, true)} a ${usd(after, true)}`,
      }
    : {
        en: `A ${cut * 100}% smaller harvest leaves the loan ${usd(-after)} short`,
        es: `Una cosecha ${cut * 100}% menor deja al préstamo ${usd(-after, true)} corto`,
      };
}
