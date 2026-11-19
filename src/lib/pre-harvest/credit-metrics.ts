/**
 * Bank-side credit metrics for the pre-harvest view: recommendation, expected
 * loss, SBS provision, break-even price, stress test, key risks and the
 * conditions each tranche must meet. Pure functions over the engine outputs.
 */
import {
  CROP_THRESHOLDS as CT,
  LGD,
  MARKET_THRESHOLDS as MT,
  PD_BY_TIER,
  RECOMMENDATION,
  SBS_PROVISION_PCT,
  STRESS_PRICE_SHOCKS,
  STRESS_YIELD_SHOCKS,
} from "./config";
import { amountDueUsd, expectedKg } from "./monitoring";
import { formatDate } from "./i18n";
import type {
  Bilingual,
  LetterTier,
  PreHarvestAssessment,
  PreHarvestDeal,
  ScoreLine,
  TimelineFrame,
  TrancheState,
} from "./types";

export type Recommendation = (typeof RECOMMENDATION)[LetterTier];

export const RECOMMENDATION_TEXT: Record<Recommendation, Bilingual> = {
  approve: { en: "Approve", es: "Aprobar" },
  approve_conditions: { en: "Approve with conditions", es: "Aprobar con condiciones" },
  committee: { en: "Refer to risk committee", es: "Elevar a comité de riesgos" },
  decline: { en: "Decline / restructure", es: "Rechazar / reestructurar" },
};

export const recommendationFor = (tier: LetterTier): Recommendation => RECOMMENDATION[tier];

export { amountDueUsd };

export function lgdPct(deal: PreHarvestDeal): number {
  const ins = deal.checks.insurance;
  const layers = [ins.catastrophic, ins.commercial, ins.parametric].filter(Boolean).length;
  const land = deal.checks.sunarp.tenure === "owned" ? LGD.landCollateralPct : 0;
  const assignment = deal.packhouseAssignment ? LGD.packhouseAssignmentPct : 0;
  return Math.max(LGD.floorPct, LGD.basePct - layers * LGD.perInsuranceLayerPct - land - assignment);
}

export function expectedLoss(deal: PreHarvestDeal, tier: LetterTier) {
  const pd = PD_BY_TIER[tier];
  const lgd = lgdPct(deal) / 100;
  const ead = deal.envelopeUsd;
  return { pdPct: pd * 100, lgdPct: lgd * 100, eadUsd: ead, elUsd: Math.round(pd * lgd * ead) };
}

export function sbsProvision(deal: PreHarvestDeal) {
  const ratePct = SBS_PROVISION_PCT[deal.checks.credit.rating];
  return { ratePct, amountUsd: Math.round((deal.envelopeUsd * ratePct) / 100) };
}

/** FOB $/kg at which expected farm-gate revenue exactly repays principal + fee. */
export function breakevenPrice(deal: PreHarvestDeal, pricingPct: number | null, yieldAdj = 1): number {
  const kg = expectedKg(deal, yieldAdj);
  return amountDueUsd(deal, pricingPct) / (kg * (MT.farmGateSharePct / 100));
}

/** Revenue coverage of principal + fee under each price × yield shock. */
export function stressMatrix(deal: PreHarvestDeal, pricingPct: number | null, basePrice: number, yieldAdj = 1) {
  const due = amountDueUsd(deal, pricingPct);
  return STRESS_YIELD_SHOCKS.map((y) => ({
    yieldShockPct: y,
    cells: STRESS_PRICE_SHOCKS.map((p) => {
      const revenue = basePrice * (1 + p / 100) * expectedKg(deal, yieldAdj * (1 + y / 100)) * (MT.farmGateSharePct / 100);
      return { priceShockPct: p, coverage: Math.round((revenue / due) * 100) / 100 };
    }),
  }));
}

/** The three weakest and three strongest score lines across active dimensions. */
export function keyRisksAndMitigants(a: PreHarvestAssessment): { risks: ScoreLine[]; mitigants: ScoreLine[] } {
  const lines = a.dimensions.filter((d) => !d.dormant).flatMap((d) => d.lines.map((l) => ({ l, w: l.points * d.weight })));
  const risks = lines.filter((x) => x.l.points < 0).sort((p, q) => p.w - q.w).slice(0, 3).map((x) => x.l);
  const mitigants = lines.filter((x) => x.l.points > 0).sort((p, q) => q.w - p.w).slice(0, 3).map((x) => x.l);
  return { risks, mitigants };
}

// ---------------------------------------------------------------------------
// Conditions precedent per tranche
// ---------------------------------------------------------------------------

export type ConditionStatus = "met" | "pending" | "failed";
export interface Condition {
  label: Bilingual;
  status: ConditionStatus;
  /** The evidence behind the status: value vs threshold, source and date. */
  detail?: Bilingual;
}

export function trancheConditions(
  deal: PreHarvestDeal,
  tranche: TrancheState,
  frame: TimelineFrame,
  fruitSetDelayDays: number,
  yieldAdj: number,
): Condition[] {
  const due = frame.date >= tranche.dueDate;
  const crop = frame.panels.crop.severity;
  const anyRed = Object.values(frame.panels).some((p) => p.severity === "red");
  const PANEL_NAME: Record<string, Bilingual> = {
    crop: { en: "crop health", es: "salud del cultivo" },
    weather: { en: "weather and water", es: "clima y agua" },
    market: { en: "market", es: "mercado" },
    takeout: { en: "repayment", es: "repago" },
  };
  const red = Object.values(frame.panels).filter((p) => p.severity === "red").map((p) => PANEL_NAME[p.panel]);
  const redPanels = { en: red.map((r) => r.en), es: red.map((r) => r.es) };
  const c = deal.checks;
  const gate = (ok: boolean): ConditionStatus => (ok ? "met" : due ? "failed" : "pending");

  if (tranche.id === "approval") {
    return [
      {
        label: { en: "Loan agreement signed", es: "Contrato de préstamo firmado" },
        status: "met",
        detail: { en: `Contract on file · ${formatDate(deal.approvalDate, "en")}`, es: `Contrato en expediente · ${formatDate(deal.approvalDate, "es")}` },
      },
      {
        label: { en: "Crop insurance endorsed to the bank", es: "Póliza de seguro agrícola endosada al banco" },
        status: c.insurance.commercial ? "met" : "failed",
        detail: c.insurance.commercial
          ? { en: "Commercial crop policy endorsed", es: "Póliza comercial endosada" }
          : { en: "No commercial crop policy on file", es: "Sin póliza comercial en expediente" },
      },
      {
        label: { en: "Assignment of packhouse proceeds to a collection account", es: "Cesión de flujos del packing a cuenta recaudadora" },
        status: deal.packhouseAssignment ? "met" : "failed",
        detail: deal.packhouseAssignment
          ? { en: "Declared in the application, section 6", es: "Declarada en la solicitud, sección 6" }
          : { en: "Not offered in the application", es: "No ofrecida en la solicitud" },
      },
      {
        label: { en: "Initial field inspection", es: "Inspección inicial de campo" },
        status: c.inspection.soilOk && c.inspection.sanitationOk ? "met" : "failed",
        detail: {
          en: `Visit ${formatDate(deal.inspectionDate, "en")}${c.inspection.note.en ? ` · ${c.inspection.note.en}` : ""}`,
          es: `Visita ${formatDate(deal.inspectionDate, "es")}${c.inspection.note.es ? ` · ${c.inspection.note.es}` : ""}`,
        },
      },
    ];
  }
  if (tranche.id === "fruit_set") {
    return [
      {
        label: { en: "Fruit set verified in the field", es: "Cuajado verificado en campo" },
        status: due ? (fruitSetDelayDays > CT.fruitSetLateRedDays ? "failed" : "met") : "pending",
        detail: { en: `Field visit due ${formatDate(tranche.dueDate, "en")}`, es: `Visita de campo prevista ${formatDate(tranche.dueDate, "es")}` },
      },
      {
        label: { en: "Satellite crop health not at high risk", es: "Salud satelital del cultivo sin riesgo alto" },
        status: gate(crop !== "red"),
        detail: { en: `Sentinel-2 parcel NDVI vs own norm · ${formatDate(frame.date, "en")}`, es: `NDVI Sentinel-2 del predio vs su norma · ${formatDate(frame.date, "es")}` },
      },
      {
        label: { en: "No open high-risk alerts", es: "Sin alertas de riesgo alto abiertas" },
        // An open red alert blocks the tranche now, not only once it falls due.
        status: anyRed ? "failed" : gate(true),
        detail: anyRed
          ? { en: `High risk: ${redPanels.en.join(", ")}`, es: `Riesgo alto: ${redPanels.es.join(", ")}` }
          : { en: "No monitoring area at high risk", es: "Ningún área de monitoreo en riesgo alto" },
      },
    ];
  }
  return [
    {
      label: { en: "Satellite composite within band", es: "Compuesto satelital dentro de banda" },
      status: gate(crop === "green"),
      detail: { en: `Sentinel-2 16-day composite · ${formatDate(frame.date, "en")}`, es: `Compuesto Sentinel-2 de 16 días · ${formatDate(frame.date, "es")}` },
    },
    {
      label: { en: "Harvest estimate ≥ 85% of declared", es: "Estimado de cosecha ≥ 85% de lo declarado" },
      status: gate(yieldAdj >= 0.85),
      detail: { en: `Estimate ${Math.round(yieldAdj * 100)}% · min 85% · from canopy vigour`, es: `Estimado ${Math.round(yieldAdj * 100)}% · mín. 85% · según vigor del follaje` },
    },
    {
      label: { en: "Packing / sale agreement in force", es: "Contrato de packing / venta vigente" },
      status: gate(deal.formato.hasPackhouseContract),
      detail: { en: `Packhouse ${deal.formato.packhouseUtilizationPct}% committed`, es: `Packing ${deal.formato.packhouseUtilizationPct}% comprometido` },
    },
    {
      label: { en: `Revenue coverage ≥ ${MT.coverageYellow}×`, es: `Cobertura de ingresos ≥ ${MT.coverageYellow}×` },
      status: gate(frame.coverageRatio === null || frame.coverageRatio >= MT.coverageYellow),
      detail:
        frame.coverageRatio === null
          ? { en: "No harvest price yet", es: "Aún sin precio de cosecha" }
          : {
              en: `${frame.coverageRatio.toFixed(2)}× principal + interest · export price data`,
              es: `${frame.coverageRatio.toFixed(2)}× capital + intereses · precios de exportación`,
            },
    },
  ];
}
