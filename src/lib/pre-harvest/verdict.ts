import type { TakeoutEvaluation } from "./monitoring";
/**
 * Plain-language conclusions for the bank: one per monitoring panel, and an
 * overall monitoring verdict at the cut-off date ("what do we do, and why").
 */
import { PANEL_ACTIONS } from "./config";
import { breakevenPrice } from "./credit-metrics";
import { ensoAt, ensoCategory, evaluateTakeout, yieldAdjustment } from "./monitoring";
import type { CampaignSimulation } from "./timeline";
import type { BankAction, Bilingual, PanelId, PreHarvestDeal, Severity, TimelineFrame, Trigger } from "./types";

const COFACE_ES = { approved: "aprobado", reduced: "reducido", declined: "rechazado", pending: "pendiente" } as const;

export interface PanelConclusion {
  headline: Bilingual;
  detail: Bilingual;
  severity: Severity;
  action: BankAction;
}

const pct = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(0)}%`;
const usd = (n: number) => `USD ${Math.round(n).toLocaleString("en-US")}`;
const fmtDate = (d: string, es: boolean) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString(es ? "es-PE" : "en-GB", { day: "numeric", month: "short" });

const ensoClass = ensoCategory;

export function panelConclusions(
  sim: CampaignSimulation,
  frame: TimelineFrame,
  deal: PreHarvestDeal,
): Record<PanelId, PanelConclusion> {
  const date = frame.date;

  // --- Crop ---------------------------------------------------------------
  const crop = sim.series.crop.filter((p) => p.date <= date).at(-1);
  const yieldPct = Math.round(yieldAdjustment(sim.series.crop, date) * 100);
  const fruitDue = date >= deal.fruitSetDate;
  const late = sim.fruitSetDelayDays;
  const stageEn = !fruitDue
    ? "fruit set not yet due"
    : late > 0
      ? `fruit set ${late} days late`
      : "fruit set on schedule";
  const stageEs = !fruitDue ? "cuajado aún no corresponde" : late > 0 ? `cuajado con ${late} días de retraso` : "cuajado a tiempo";
  const cropConclusion: PanelConclusion = {
    headline: {
      en: `Expected yield ${yieldPct}% of declared`,
      es: `Rendimiento estimado ${yieldPct}% de lo declarado`,
    },
    detail: crop
      ? {
          en: `NDVI ${pct(crop.pctVsMedian)} vs the field's 5-year median · ${stageEn} · last image ${fmtDate(crop.date, false)}`,
          es: `NDVI ${pct(crop.pctVsMedian)} vs la mediana de 5 años · ${stageEs} · última imagen ${fmtDate(crop.date, true)}`,
        }
      : { en: "No satellite reading yet", es: "Aún sin lectura satelital" },
    severity: frame.panels.crop.severity,
    action: PANEL_ACTIONS.crop[frame.panels.crop.severity],
  };

  // --- Weather and water ----------------------------------------------------
  const enso = ensoAt({ enso: sim.series.enso }, date);
  const water = sim.series.weather.filter((p) => p.date <= date).at(-1);
  const level: Bilingual =
    frame.panels.weather.severity === "red"
      ? { en: "High", es: "Alto" }
      : frame.panels.weather.severity === "yellow"
        ? { en: "Elevated", es: "Elevado" }
        : { en: "Normal", es: "Normal" };
  const ensoText = enso
    ? {
        en: `coastal El Niño ${ensoClass(enso.value).en} (Niño 1+2 ${enso.value >= 0 ? "+" : ""}${enso.value.toFixed(1)} °C)`,
        es: `El Niño costero ${ensoClass(enso.value).es} (Niño 1+2 ${enso.value >= 0 ? "+" : ""}${enso.value.toFixed(1)} °C)`,
      }
    : { en: "no El Niño reading", es: "sin lectura de El Niño" };
  const waterText =
    water?.waterCoverage != null
      ? {
          en: `licensed water covers ${Math.round(water.waterCoverage * 100)}% of crop demand`,
          es: `la dotación cubre ${Math.round(water.waterCoverage * 100)}% de la demanda del cultivo`,
        }
      : { en: "no water reading", es: "sin lectura hídrica" };
  const weatherConclusion: PanelConclusion = {
    headline: { en: `Climate risk: ${level.en}`, es: `Riesgo climático: ${level.es}` },
    detail: { en: `${ensoText.en} · ${waterText.en}`, es: `${ensoText.es} · ${waterText.es}` },
    severity: frame.panels.weather.severity,
    action: PANEL_ACTIONS.weather[frame.panels.weather.severity],
  };

  // --- Market -----------------------------------------------------------------
  const yieldAdj = yieldAdjustment(sim.series.crop, date);
  const be = breakevenPrice(deal, sim.origination.pricingPct, yieldAdj);
  const fwd = frame.expectedHarvestPrice;
  const headroom = fwd ? Math.round(((fwd - be) / fwd) * 100) : null;
  const marketConclusion: PanelConclusion = {
    headline:
      frame.coverageRatio === null
        ? { en: "No price reading yet", es: "Aún sin lectura de precio" }
        : {
            en: `Harvest covers principal + interest ${frame.coverageRatio.toFixed(2)}×`,
            es: `La cosecha cubre capital + intereses ${frame.coverageRatio.toFixed(2)}×`,
          },
    detail: fwd
      ? {
          en: `Expected harvest price $${fwd.toFixed(2)}/kg · break-even $${be.toFixed(2)}/kg · headroom ${headroom}%`,
          es: `Precio esperado en cosecha $${fwd.toFixed(2)}/kg · equilibrio $${be.toFixed(2)}/kg · holgura ${headroom}%`,
        }
      : { en: "", es: "" },
    severity: frame.panels.market.severity,
    action: PANEL_ACTIONS.market[frame.panels.market.severity],
  };

  // --- Repayment (M3 takeout) ------------------------------------------------------
  const tk = evaluateTakeout(sim.takeout, deal, date, sim.amountDue);
  const takeoutConclusion: PanelConclusion =
    tk.stage === "pending"
      ? {
          headline: { en: `Takeout due at M3 (${fmtDate(deal.m3Date, false)})`, es: `Toma prevista en M3 (${fmtDate(deal.m3Date, true)})` },
          detail: {
            en: `Post-harvest facility repays ${usd(sim.amountDue)} once the buyer's PO is signed and insured by Coface`,
            es: `La facilidad post-cosecha repaga ${usd(sim.amountDue)} al firmarse la OC del comprador asegurada por Coface`,
          },
          severity: "green",
          action: "continue",
        }
      : {
          headline:
            tk.coverage === null
              ? { en: "Takeout not in place", es: "Toma no disponible" }
              : { en: `Takeout covers the loan ${tk.coverage.toFixed(2)}×`, es: `La toma cubre el préstamo ${tk.coverage.toFixed(2)}×` },
          detail:
            tk.poValueUsd === null
              ? { en: "No signed purchase order yet", es: "Aún sin orden de compra firmada" }
              : {
                  en: `PO ${usd(tk.poValueUsd)} (${sim.takeout.buyerCountry}) · Coface ${sim.takeout.coface} · advance ${usd(tk.advanceUsd ?? 0)} vs due ${usd(sim.amountDue)}`,
                  es: `OC ${usd(tk.poValueUsd)} (${sim.takeout.buyerCountry}) · Coface ${COFACE_ES[sim.takeout.coface]} · adelanto ${usd(tk.advanceUsd ?? 0)} vs adeudado ${usd(sim.amountDue)}`,
                },
          severity: tk.severity,
          action: PANEL_ACTIONS.takeout[tk.severity],
        };

  return { crop: cropConclusion, weather: weatherConclusion, market: marketConclusion, takeout: takeoutConclusion };
}

/** The most important open trigger: reds first, then crop → market → weather. */
export function mainTrigger(frame: TimelineFrame): Trigger | null {
  const order: PanelId[] = ["takeout", "crop", "market", "weather"];
  const all = order.flatMap((p) => frame.panels[p].triggers);
  return all.find((t) => t.severity === "red") ?? all[0] ?? null;
}

/** One-paragraph monitoring verdict at the cut-off date, in the bank's terms. */
export function monitoringVerdict(frame: TimelineFrame): { action: BankAction; text: Bilingual } {
  const next = frame.tranches.find((t) => t.status === "pending" || t.status === "held");
  const trig = mainTrigger(frame);
  const tranche = next
    ? {
        en: `tranche ${next.pct}% (${usd(next.amountUsd)}, ${next.label.en.toLowerCase()}, ${fmtDate(next.dueDate, false)})`,
        es: `el tramo ${next.pct}% (${usd(next.amountUsd)}, ${next.label.es.toLowerCase()}, ${fmtDate(next.dueDate, true)})`,
      }
    : null;

  let text: Bilingual;
  switch (frame.action) {
    case "continue":
      text = tranche
        ? { en: `Continue. Release ${tranche.en} once its conditions are met.`, es: `Mantener. Liberar ${tranche.es} al cumplirse sus condiciones.` }
        : frame.m3Reached
          ? {
              en: `Continue. M3 reached: the post-harvest facility takes out the loan (${usd(frame.outstandingUsd)} disbursed).`,
              es: `Mantener. M3 alcanzado: la facilidad post-cosecha toma el préstamo (${usd(frame.outstandingUsd)} desembolsados).`,
            }
          : {
              en: `Continue. Fully disbursed (${usd(frame.outstandingUsd)}); follow the crop until the M3 takeout.`,
              es: `Mantener. Desembolso completo (${usd(frame.outstandingUsd)}); seguimiento del cultivo hasta la toma en M3.`,
            };
      break;
    case "call_inspection":
      text = tranche
        ? { en: `Continue with a field inspection before ${tranche.en}.`, es: `Mantener con inspección de campo antes de ${tranche.es}.` }
        : { en: "Continue with a field inspection; no tranches pending.", es: "Mantener con inspección de campo; sin tramos pendientes." };
      break;
    case "hold_tranche":
      text = tranche
        ? { en: `Hold ${tranche.en} until the signal returns to band.`, es: `Retener ${tranche.es} hasta que la señal vuelva a banda.` }
        : { en: "Hold: no further disbursement until the signal returns to band.", es: "Retener: sin nuevos desembolsos hasta que la señal vuelva a banda." };
      break;
    default:
      text = {
        en: `Stop disbursements and refer to the risk committee. Current exposure ${usd(frame.outstandingUsd)}.`,
        es: `Detener desembolsos y elevar a comité de riesgos. Exposición actual ${usd(frame.outstandingUsd)}.`,
      };
  }
  if (trig) {
    text = { en: `${text.en} Main risk: ${trig.message.en}.`, es: `${text.es} Riesgo principal: ${trig.message.es}.` };
  }
  return { action: frame.action, text };
}


// ---------------------------------------------------------------------------
// One status per credit file
// ---------------------------------------------------------------------------

export type FileStatus = "normal" | "followup" | "watch" | "stopped" | "declined" | "repaid";

export const FILE_STATUS_TEXT: Record<FileStatus, Bilingual> = {
  normal: { en: "Normal", es: "Normal" },
  followup: { en: "Follow-up", es: "Seguimiento" },
  watch: { en: "Watch list", es: "Vigilancia" },
  stopped: { en: "Stopped · committee", es: "Detenido · comité" },
  declined: { en: "Declined", es: "Rechazada" },
  repaid: { en: "Repaid", es: "Cancelado" },
};

/** A file's status as the bank reads it: an application TruMarket would decline is a recommendation until the analyst decides. */
export function fileStatusLabel(status: FileStatus, dealStatus: string): Bilingual {
  if (status === "declined" && dealStatus === "application") return { en: "Decline recommended", es: "Rechazo recomendado" };
  return FILE_STATUS_TEXT[status];
}

/**
 * The single status the bank sees for a file, with one next action and one reason.
 * Everything on the file's header reads from here, so the page cannot show
 * contradictory decisions.
 */
export function fileStatus(frame: TimelineFrame): { status: FileStatus; action: Bilingual; why: Bilingual | null } {
  const v = monitoringVerdict(frame);
  const trig = mainTrigger(frame);
  const actionOnly: Bilingual = {
    en: v.text.en.split(" Main risk:")[0],
    es: v.text.es.split(" Riesgo principal:")[0],
  };
  const status: FileStatus =
    frame.tier === "VETO"
      ? "declined"
      : frame.action === "stop"
        ? "stopped"
        : frame.action === "hold_tranche"
          ? "watch"
          : frame.action === "call_inspection"
            ? "followup"
            : "normal";
  // Past M3 with the takeout done and covered: the loan was repaid from the PO advance.
  const tk = frame.panels.takeout as TakeoutEvaluation;
  if (status !== "declined" && status !== "stopped" && frame.m3Reached && tk.stage === "done" && tk.severity === "green") {
    return {
      status: "repaid",
      action: {
        en: `Campaign closed. Loan repaid from the M3 takeout (PO covers principal + interest ${tk.coverage?.toFixed(2)}×).`,
        es: `Campaña cerrada. Préstamo cancelado con la toma en M3 (la OC cubre capital + intereses ${tk.coverage?.toFixed(2)}×).`,
      },
      why: null,
    };
  }
  if (status === "declined") {
    return {
      status,
      action: { en: "Decline the application; no disbursement.", es: "Rechazar la solicitud; sin desembolso." },
      why: trig?.message ?? null,
    };
  }
  return { status, action: actionOnly, why: trig?.message ?? null };
}
