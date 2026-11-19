/**
 * Pre-harvest CRAM scoring. A transparent rules engine: every point on the
 * scorecard is a line with its input value, the points it adds, and its source.
 * Rules and weights live in config.ts.
 */
import {
  BASES,
  CROP_THRESHOLDS,
  OPERATOR_RULES as OR,
  PRICING_PCT,
  PRODUCTION_RULES as PR,
  STRUCTURE_RULES as SR,
  TIERS,
  WEIGHTS,
} from "./config";
import type {
  Bilingual,
  DimensionScore,
  LetterTier,
  OriginationSignals,
  PreHarvestAssessment,
  PreHarvestDeal,
  ScoreLine,
  SourceRef,
} from "./types";

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));
const bi = (en: string, es = en): Bilingual => ({ en, es });
const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d });

type MinBand = { min: number; pts: number };
type MaxBand = { max: number; pts: number };

/** First band whose `min` the value reaches (bands ordered high → low). */
export function ptsAtLeast(value: number, bands: readonly MinBand[]): number {
  return (bands.find((b) => value >= b.min) ?? bands[bands.length - 1]).pts;
}

/** First band whose `max` the value does not exceed (bands ordered low → high). */
export function ptsAtMost(value: number, bands: readonly MaxBand[]): number {
  return (bands.find((b) => value <= b.max) ?? bands[bands.length - 1]).pts;
}

export function tierFor(composite: number): Exclude<LetterTier, "VETO"> {
  return (TIERS.find((t) => composite >= t.min) ?? TIERS[TIERS.length - 1]).tier;
}

export function ltvPct(deal: PreHarvestDeal): number {
  return deal.formato.campaignCostUsd > 0
    ? (deal.envelopeUsd / deal.formato.campaignCostUsd) * 100
    : Infinity;
}

const src = (name: string, status: SourceRef["status"]): SourceRef => ({ name, status });

function dimension(
  key: DimensionScore["key"],
  base: number,
  lines: ScoreLine[],
): DimensionScore {
  const raw = base + lines.reduce((s, l) => s + l.points, 0);
  return { key, weight: WEIGHTS[key], base, score: Math.round(clamp(raw)), dormant: false, lines };
}

// ---------------------------------------------------------------------------
// Production (50%): will the crop come in?
// ---------------------------------------------------------------------------

export function scoreProduction(deal: PreHarvestDeal, signals: OriginationSignals): DimensionScore {
  const f = deal.formato;
  const c = deal.checks;
  const lines: ScoreLine[] = [];

  const coverage = f.waterAllocationM3PerHa / f.cropWaterNeedM3PerHa;
  lines.push({
    label: bi("Water allocation vs crop need", "Dotación de agua vs necesidad del cultivo"),
    value: bi(`${fmt(coverage * 100)}% covered`, `${fmt(coverage * 100)}% cubierto`),
    points: ptsAtLeast(coverage, PR.waterCoverage),
    source: src("Formato §3 · ANA", c.ana.status),
  });

  lines.push({
    label: bi("Irrigation water salinity", "Salinidad del agua de riego"),
    value: bi(`EC ${f.salinityEcDsM} dS/m`),
    points: ptsAtMost(f.salinityEcDsM, PR.salinityEc),
    source: src("Formato §3", "manual"),
  });

  const ageBand =
    PR.orchardAge.find((b) => f.orchardAgeYears >= b.min && f.orchardAgeYears < b.max) ??
    PR.orchardAge[PR.orchardAge.length - 1];
  lines.push({
    label: bi("Orchard age", "Edad del huerto"),
    value: bi(`${f.orchardAgeYears} years · ${f.variety}`, `${f.orchardAgeYears} años · ${f.variety}`),
    points: ageBand.pts,
    source: src("Formato §2", "manual"),
  });

  const yieldRatio = f.declaredYieldTPerHa / c.peerYieldTPerHa.p75;
  lines.push({
    label: bi("Declared yield vs regional peers", "Rendimiento declarado vs pares regionales"),
    value: bi(
      `${f.declaredYieldTPerHa} t/ha vs P75 ${c.peerYieldTPerHa.p75} t/ha`,
      `${f.declaredYieldTPerHa} t/ha vs P75 ${c.peerYieldTPerHa.p75} t/ha`,
    ),
    points: ptsAtMost(yieldRatio, PR.declaredYieldVsPeerP75),
    source: src("MIDAGRI SIEA", c.peerYieldTPerHa.status),
  });

  lines.push(
    signals.ndviVsMedianPct === null
      ? {
          label: bi("Satellite crop vigour at approval", "Vigor satelital del cultivo a la aprobación"),
          value: bi("No satellite reading (provisional)", "Sin lectura satelital (provisional)"),
          points: 0,
          source: src("Sentinel-2 NDVI", "cached"),
        }
      : {
          label: bi("Satellite crop vigour at approval", "Vigor satelital del cultivo a la aprobación"),
          value: bi(
            `NDVI ${signals.ndviVsMedianPct >= 0 ? "+" : ""}${fmt(signals.ndviVsMedianPct, 1)}% vs 5-yr median`,
            `NDVI ${signals.ndviVsMedianPct >= 0 ? "+" : ""}${fmt(signals.ndviVsMedianPct, 1)}% vs mediana 5 años`,
          ),
          points: ptsAtLeast(signals.ndviVsMedianPct, PR.satelliteVigorPct),
          source: src("Sentinel-2 NDVI", "cached"),
        },
  );

  lines.push(
    signals.enso === null
      ? {
          label: bi("Coastal El Niño outlook", "Perspectiva El Niño costero"),
          value: bi("No Niño 1+2 reading (provisional)", "Sin lectura Niño 1+2 (provisional)"),
          points: 0,
          source: src("NOAA CPC Niño 1+2", "cached"),
        }
      : {
          label: bi("Coastal El Niño outlook", "Perspectiva El Niño costero"),
          value: bi(
            `Niño 1+2 ${signals.enso >= 0 ? "+" : ""}${signals.enso.toFixed(2)} °C (3-month mean)`,
            `Niño 1+2 ${signals.enso >= 0 ? "+" : ""}${signals.enso.toFixed(2)} °C (promedio 3 meses)`,
          ),
          points: ptsAtMost(signals.enso, PR.enso),
          source: src("NOAA CPC Niño 1+2", "cached"),
        },
  );

  if (c.senasa.zoneStatus !== "quarantine") {
    lines.push({
      label: bi("Phytosanitary zone status", "Estatus fitosanitario de la zona"),
      value: c.senasa.note,
      points: PR.senasa[c.senasa.zoneStatus],
      source: src("SENASA", c.senasa.status),
    });
  }

  const issues = [c.inspection.soilOk, c.inspection.sanitationOk].filter((ok) => !ok).length;
  lines.push({
    label: bi("Field inspection: soil and plant health", "Inspección en campo: suelo y sanidad"),
    value: c.inspection.note,
    points: issues === 0 ? PR.inspection.bothOk : issues === 1 ? PR.inspection.oneIssue : PR.inspection.bothIssues,
    source: src("Field inspection", c.inspection.status),
  });

  return dimension("production", BASES.production, lines);
}

// ---------------------------------------------------------------------------
// Operator (35%): can this grower execute and repay?
// ---------------------------------------------------------------------------

export function scoreOperator(deal: PreHarvestDeal): DimensionScore {
  const f = deal.formato;
  const c = deal.checks;
  const lines: ScoreLine[] = [];

  const [oldest, , last] = f.revenueLast3CampaignsUsd;
  const changePct = oldest > 0 ? ((last - oldest) / oldest) * 100 : -100;
  const trendPts =
    changePct > OR.revenueTrend.flatBandPct
      ? OR.revenueTrend.growingPts
      : changePct < -OR.revenueTrend.flatBandPct
        ? OR.revenueTrend.decliningPts
        : OR.revenueTrend.flatPts;
  lines.push({
    label: bi("Revenue trend, last 3 campaigns", "Tendencia de ingresos, últimas 3 campañas"),
    value: bi(`${changePct >= 0 ? "+" : ""}${fmt(changePct, 1)}%`),
    points: trendPts,
    source: src("Formato §4", "manual"),
  });

  const revRatio = last / deal.envelopeUsd;
  lines.push({
    label: bi("Last campaign revenue vs loan", "Ingresos última campaña vs préstamo"),
    value: bi(`${fmt(revRatio, 2)}×`),
    points: ptsAtLeast(revRatio, OR.revenueToEnvelope),
    source: src("Formato §4", "manual"),
  });

  if (c.credit.rating !== "Perdida") {
    lines.push({
      label: bi("Credit history", "Historial crediticio"),
      value: bi(
        `${c.credit.rating}${c.credit.protestedDebts ? `, ${c.credit.protestedDebts} protested` : ""}`,
        `${c.credit.rating}${c.credit.protestedDebts ? `, ${c.credit.protestedDebts} protestos` : ""}`,
      ),
      points: OR.credit[c.credit.rating] + (c.credit.protestedDebts > 0 ? OR.protestedDebtPts : 0),
      source: src(c.credit.bureau, c.credit.status),
    });
  }

  const t = c.sunarp;
  const tenurePts =
    t.liens > 1
      ? OR.tenure.multipleLiensPts
      : t.tenure === "owned"
        ? t.liens === 0
          ? OR.tenure.ownedClear
          : OR.tenure.ownedOneLien
        : t.tenure === "leased"
          ? OR.tenure.leased
          : OR.tenure.informal;
  const tenureLabel = {
    owned: { en: "Owned", es: "Propia" },
    leased: { en: "Leased", es: "Arrendada" },
    informal: { en: "Informal", es: "Informal" },
  }[t.tenure];
  lines.push({
    label: bi("Land tenure and liens", "Tenencia de la tierra y gravámenes"),
    value: bi(`${tenureLabel.en}, ${t.liens} lien(s)`, `${tenureLabel.es}, ${t.liens} gravamen(es)`),
    points: tenurePts,
    source: src("SUNARP", t.status),
  });

  const ep = c.exporterProfile;
  lines.push({
    label: bi("Own export track record", "Historial exportador propio"),
    value:
      f.exportsDirectly && ep.score !== null
        ? bi(`Customs profile score ${ep.score} (${fmt(ep.shipments)} shipments)`, `Puntaje perfil aduanero ${ep.score} (${fmt(ep.shipments)} embarques)`)
        : bi("Sells through a packhouse, no own export record", "Vende vía packing, sin historial exportador propio"),
    points:
      f.exportsDirectly && ep.score !== null
        ? ep.score >= OR.exporter.strongMin
          ? OR.exporter.strongPts
          : OR.exporter.weakPts
        : OR.exporter.noOwnRecordPts,
    source: src("Veritrade · supplier profiles", ep.status),
  });

  const p = OR.packhouse;
  const utilPts =
    f.packhouseUtilizationPct > p.overMax ? p.overPts : f.packhouseUtilizationPct <= p.utilizationOkMax ? p.utilizationOkPts : 0;
  lines.push({
    label: bi("Packhouse capacity", "Capacidad de packing"),
    value: bi(
      `${f.packhouseUtilizationPct}% used${f.hasPackhouseContract ? ", contract in place" : ""}`,
      `${f.packhouseUtilizationPct}% utilizado${f.hasPackhouseContract ? ", con contrato" : ""}`,
    ),
    points: (f.hasPackhouseContract ? p.contractPts : 0) + utilPts,
    source: src("Formato §5", "manual"),
  });

  const ins = c.inspection;
  lines.push({
    label: bi("Certification and pest records", "Certificación y registros de plagas"),
    value: bi(
      `${ins.globalGap ? "GLOBALG.A.P." : "No GLOBALG.A.P."} · ${ins.ipmRecords ? "IPM records" : "no IPM records"}`,
      `${ins.globalGap ? "GLOBALG.A.P." : "Sin GLOBALG.A.P."} · ${ins.ipmRecords ? "registros MIP" : "sin registros MIP"}`,
    ),
    points:
      (ins.globalGap ? OR.certification.globalGapPts : 0) +
      (ins.ipmRecords ? OR.certification.ipmRecordsPts : OR.certification.noIpmRecordsPts),
    source: src("GLOBALG.A.P. · inspection", ins.status),
  });

  return dimension("operator", BASES.operator, lines);
}

// ---------------------------------------------------------------------------
// Structure (15%): loan-to-value, tranches, insurance
// ---------------------------------------------------------------------------

export function scoreStructure(deal: PreHarvestDeal): DimensionScore {
  const ins = deal.checks.insurance;
  const lines: ScoreLine[] = [];
  const ltv = ltvPct(deal);

  lines.push({
    label: bi("Loan-to-value on campaign cost", "Loan-to-value sobre costo de campaña"),
    value: bi(`${fmt(ltv, 1)}%`),
    points: ptsAtMost(ltv, SR.ltvPct),
    source: src("Formato §4", "manual"),
  });

  lines.push({
    label: bi("Disbursement tied to crop stage", "Desembolso anclado a fenología"),
    value: bi("3 tranches: approval, fruit set, pre-harvest", "3 tramos: aprobación, cuajado, pre-cosecha"),
    points: SR.phenologyTranchesPts,
    source: src("Satellite + phenology", "cached"),
  });

  const layers = [ins.catastrophic, ins.commercial, ins.parametric].filter(Boolean).length;
  const names = [
    ins.catastrophic && "SAC",
    ins.commercial && "commercial",
    ins.parametric && "parametric",
  ].filter(Boolean);
  const namesEs = [
    ins.catastrophic && "SAC",
    ins.commercial && "comercial",
    ins.parametric && "paramétrico",
  ].filter(Boolean);
  lines.push({
    label: bi("Crop insurance layers", "Capas de seguro agrícola"),
    value: bi(
      `${layers} of 3${names.length ? ` (${names.join(", ")})` : ""}`,
      `${layers} de 3${namesEs.length ? ` (${namesEs.join(", ")})` : ""}`,
    ),
    points: SR.insuranceLayers[layers],
    source: src("Insurers", ins.status),
  });

  const tenorPts =
    deal.tenorDays <= SR.tenor.shortMaxDays ? SR.tenor.shortPts : deal.tenorDays >= SR.tenor.longMinDays ? SR.tenor.longPts : 0;
  lines.push({
    label: bi("Tenor", "Plazo"),
    value: bi(`${deal.tenorDays} days`, `${deal.tenorDays} días`),
    points: tenorPts,
    source: src("Term sheet", "manual"),
  });

  return dimension("structure", BASES.structure, lines);
}

// ---------------------------------------------------------------------------
// Vetoes and composite
// ---------------------------------------------------------------------------

export function vetoReasons(deal: PreHarvestDeal): Bilingual[] {
  const c = deal.checks;
  const out: Bilingual[] = [];
  if (!c.ruc.active || !c.ruc.habido)
    out.push(bi("SUNAT RUC not active / not 'habido'", "RUC SUNAT no activo / no habido"));
  if (c.credit.rating === "Perdida")
    out.push(bi("Credit rating 'Pérdida' (loss) in the SBS registry", "Calificación 'Pérdida' en la Central de Riesgos SBS"));
  if (!c.ana.licenceValid)
    out.push(bi("No valid ANA water-use licence", "Sin licencia de uso de agua ANA vigente"));
  if (c.senasa.zoneStatus === "quarantine")
    out.push(bi("SENASA quarantine active in the zone", "Cuarentena SENASA activa en la zona"));
  return out;
}

export function scorePreHarvest(
  deal: PreHarvestDeal,
  signals: OriginationSignals,
): PreHarvestAssessment {
  const dims: DimensionScore[] = [
    scoreProduction(deal, signals),
    scoreOperator(deal),
    scoreStructure(deal),
    {
      key: "counterparty",
      weight: 0,
      base: 0,
      score: 0,
      dormant: true,
      lines: [],
    },
  ];
  return assess(dims, deal, plantingVeto(signals));
}

/**
 * Satellite checks before approval:
 *  - planting validation: a standing crop on the parcel at all;
 *  - crop-type validation: an evergreen crop (Hass) never goes dormant during the year.
 */
export function plantingVeto(signals: OriginationSignals): Bilingual[] {
  const v = signals.cropPresenceNdvi;
  const out: Bilingual[] = [];
  const low = signals.seasonalMinNdvi;
  if (v !== null && v >= CROP_THRESHOLDS.plantingMinNdvi && low !== null && low < CROP_THRESHOLDS.evergreenMinNdvi) {
    out.push(
      bi(
        `Satellite seasonal pattern does not match the declared Hass avocado: NDVI falls to ${low.toFixed(2)} at its low point of the year (a dormant or pruned crop, e.g. vineyard). Field verification required`,
        `El patrón satelital no coincide con la palta Hass declarada: el NDVI cae a ${low.toFixed(2)} en su punto más bajo del año (cultivo en dormancia o poda, p. ej. vid). Requiere verificación en campo`,
      ),
    );
  }
  if (v === null || v >= CROP_THRESHOLDS.plantingMinNdvi) return out;
  return [
    bi(
      `Satellite shows no standing crop on the parcel (NDVI ${v.toFixed(2)} over the last ${CROP_THRESHOLDS.plantingWindowDays} days)`,
      `El satélite no muestra cultivo en pie en la parcela (NDVI ${v.toFixed(2)} en los últimos ${CROP_THRESHOLDS.plantingWindowDays} días)`,
    ),
  ];
}

/** Composite, tier and pricing from (possibly re-scored) dimensions. */
export function assess(dims: DimensionScore[], deal: PreHarvestDeal, signalVetoes: Bilingual[] = []): PreHarvestAssessment {
  const composite = Math.round(dims.reduce((s, d) => s + d.score * d.weight, 0));
  const vetoes = [...vetoReasons(deal), ...signalVetoes];
  const tier: LetterTier = vetoes.length ? "VETO" : tierFor(composite);
  return {
    dimensions: dims,
    composite,
    tier,
    vetoed: vetoes.length > 0,
    vetoReasons: vetoes,
    pricingPct: tier === "VETO" ? null : PRICING_PCT[tier],
    ltvPct: ltvPct(deal),
    signalVetoes,
  };
}
