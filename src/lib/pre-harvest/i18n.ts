import type { BankAction, Bilingual, Lang, Severity, SourceStatus, TrancheStatus } from "./types";

const STRINGS = {
  title: { en: "Pre-harvest credit risk", es: "Riesgo crediticio pre-cosecha" },
  subtitle: {
    en: "Financing a grower before harvest: score at origination, then monitor crop, weather and market until the purchase order (M3).",
    es: "Financiamiento al productor antes de la cosecha: score en la originación y monitoreo de cultivo, clima y mercado hasta la orden de compra (M3).",
  },
  scoreAtOrigination: { en: "At origination", es: "En la originación" },
  scoreNow: { en: "Re-scored on", es: "Re-calculado al" },
  tier: { en: "Tier", es: "Tier" },
  pricing: { en: "Base pricing", es: "Pricing base" },
  manualPricing: { en: "Manual review", es: "Revisión manual" },
  ltv: { en: "LTV on campaign cost", es: "LTV sobre costo de campaña" },
  envelope: { en: "Envelope", es: "Envelope" },
  tenor: { en: "Tenor", es: "Plazo" },
  days: { en: "days", es: "días" },
  weight: { en: "weight", es: "peso" },
  dormant: { en: "Dormant until M3 (purchase order). Coface and buyer risk re-enter in the post-harvest model.", es: "Dormante hasta M3 (orden de compra). Coface y el riesgo comprador reingresan en el modelo post-cosecha." },
  showReasons: { en: "Show reasons", es: "Ver razones" },
  hideReasons: { en: "Hide reasons", es: "Ocultar razones" },
  basePts: { en: "Base", es: "Base" },
  timelineHint: {
    en: "Move the slider or press play to replay the campaign week by week and watch alerts fire.",
    es: "Mueve el control o presiona play para reproducir la campaña semana a semana y ver las alertas.",
  },
  outstanding: { en: "Disbursed", es: "Desembolsado" },
  coverage: { en: "Revenue coverage", es: "Cobertura de ingresos" },
  tranches: { en: "Disbursement schedule (tied to crop stage)", es: "Calendario de desembolso (anclado a fenología)" },
  due: { en: "Due", es: "Vence" },
  releasedOn: { en: "Released", es: "Liberado" },
  monitoring: { en: "Monitoring panels", es: "Paneles de monitoreo" },
  monitoringHint: {
    en: "Each panel compares a live signal with its band. Watch = alert and re-score. High risk = stop disbursement.",
    es: "Cada panel compara una señal viva con su banda. Vigilar = alerta y re-scoring. Riesgo alto = detener el desembolso.",
  },
  crop: { en: "1 · Crop health", es: "1 · Salud del cultivo" },
  cropSub: {
    en: "Satellite NDVI for this field vs its own 5-year median",
    es: "NDVI satelital del campo vs su propia mediana de 5 años",
  },
  weather: { en: "2 · Weather and water", es: "2 · Clima y agua" },
  weatherSub: {
    en: "Heat and cold at flowering, rainfall anomaly, coastal El Niño, water demand vs licence",
    es: "Calor y frío en floración, anomalía de lluvia, El Niño costero, demanda de agua vs dotación",
  },
  market: { en: "3 · Market", es: "3 · Mercado" },
  marketSub: {
    en: "Avocado FOB $/kg vs its seasonal band; expected harvest revenue vs principal + interest",
    es: "Palta FOB $/kg vs su banda estacional; ingreso esperado de la cosecha vs capital + intereses",
  },
  temperature: { en: "Temperature", es: "Temperatura" },
  rain: { en: "Rain", es: "Lluvia" },
  enso: { en: "Coastal El Niño", es: "El Niño costero" },
  water: { en: "Water", es: "Agua" },
  ndvi: { en: "NDVI", es: "NDVI" },
  median5y: { en: "5-yr median", es: "Mediana 5 años" },
  yellowLine: { en: "Watch", es: "Vigilar" },
  redLine: { en: "High risk", es: "Riesgo alto" },
  tmax: { en: "Max °C", es: "Máx °C" },
  tmin: { en: "Min °C", es: "Mín °C" },
  precipZ: { en: "30-day rain z-score", es: "Z-score lluvia 30 días" },
  seasonalMedian: { en: "Seasonal median", es: "Mediana estacional" },
  price: { en: "FOB $/kg", es: "FOB $/kg" },
  band: { en: "Normal band (P25–P75)", es: "Banda normal (P25–P75)" },
  expectedRevenue: { en: "Expected revenue", es: "Ingreso esperado" },
  noAlerts: { en: "No active alerts", es: "Sin alertas activas" },
  alertLog: { en: "Alert log", es: "Registro de alertas" },
  alertLogEmpty: { en: "No alerts yet in this replay.", es: "Aún no hay alertas en esta reproducción." },
  date: { en: "Date", es: "Fecha" },
  panel: { en: "Panel", es: "Panel" },
  trigger: { en: "Trigger", es: "Gatillo" },
  limit: { en: "Limit", es: "Límite" },
  severity: { en: "Severity", es: "Severidad" },
  rescored: { en: "Re-scored", es: "Re-score" },
  action: { en: "Action", es: "Acción" },
  inputs: { en: "Grower and third-party inputs", es: "Inputs del productor y de terceros" },
  inputsHint: {
    en: "Edit the intake form (Formato) to re-score live. Third-party checks show where each value comes from.",
    es: "Edita el Formato para recalcular en vivo. Los chequeos de terceros muestran de dónde viene cada valor.",
  },
  formato: { en: "Intake form (Formato)", es: "Formato del productor" },
  thirdParty: { en: "Third-party checks", es: "Chequeos de terceros" },
  dataSources: { en: "Monitoring data", es: "Datos de monitoreo" },
  m3Banner: {
    en: "M3 reached: purchase order signed. The deal moves to the post-harvest model, where Coface and buyer risk re-enter.",
    es: "M3 alcanzado: orden de compra firmada. El deal pasa al modelo post-cosecha, donde reingresan Coface y el riesgo comprador.",
  },
  openPostHarvest: { en: "Open post-harvest assessment", es: "Abrir evaluación post-cosecha" },
  milestoneApproval: { en: "Approval", es: "Aprobación" },
  milestoneFruitSet: { en: "Fruit set", es: "Cuajado" },
  milestonePreHarvest: { en: "Pre-harvest", es: "Pre-cosecha" },
  milestoneM3: { en: "M3", es: "M3" },
  uncalibrated: {
    en: "Thresholds are uncalibrated defaults (src/lib/pre-harvest/config.ts).",
    es: "Los umbrales son valores por defecto sin calibrar (src/lib/pre-harvest/config.ts).",
  },
  vetoReasons: { en: "Veto reasons", es: "Razones de veto" },
  growerName: { en: "Grower", es: "Productor" },
  variety: { en: "Variety", es: "Variedad" },
  areaHa: { en: "Area (ha)", es: "Área (ha)" },
  orchardAge: { en: "Orchard age (years)", es: "Edad del huerto (años)" },
  declaredYield: { en: "Declared yield (t/ha)", es: "Rendimiento declarado (t/ha)" },
  waterAllocation: { en: "Water allocation (m³/ha/yr)", es: "Dotación de agua (m³/ha/año)" },
  waterNeed: { en: "Crop water need (m³/ha/yr)", es: "Necesidad hídrica (m³/ha/año)" },
  salinity: { en: "Water salinity EC (dS/m)", es: "Salinidad EC (dS/m)" },
  revenue: { en: "Revenue, last 3 campaigns (USD)", es: "Ingresos, últimas 3 campañas (USD)" },
  campaignCost: { en: "Campaign cost (USD)", es: "Costo de campaña (USD)" },
  packhouseUtil: { en: "Packhouse capacity used (%)", es: "Capacidad de packing usada (%)" },
  packhouseContract: { en: "Packhouse contract", es: "Contrato con packing" },
  exportsDirectly: { en: "Exports under own RUC", es: "Exporta con RUC propio" },
  resetInputs: { en: "Reset inputs", es: "Restablecer inputs" },
  yes: { en: "Yes", es: "Sí" },
  no: { en: "No", es: "No" },
  cutoff: { en: "Cut-off date", es: "Fecha de corte" },
  analystConfirm: { en: "Tier confirmed by the credit analyst before disbursement.", es: "El tier lo confirma el analista de créditos antes del desembolso." },
  facility: { en: "Facility", es: "Facilidad" },
  facilityType: { en: "Pre-harvest campaign loan, crop-stage tranches", es: "Préstamo de campaña pre-cosecha, tramos por fenología" },
  amount: { en: "Amount", es: "Monto" },
  rate: { en: "Rate", es: "Tasa" },
  repaymentSource: { en: "Source of repayment", es: "Fuente de repago" },
  repaymentSourceText: { en: "Harvest proceeds, assigned from the packhouse to a collection account", es: "Flujos de cosecha, cedidos por el packing a cuenta recaudadora" },
  sbsRating: { en: "SBS rating", es: "Calificación SBS" },
  provision: { en: "Required provision", es: "Provisión requerida" },
  expectedLoss: { en: "Expected loss", es: "Pérdida esperada" },
  pd: { en: "PD (12m)", es: "PD (12m)" },
  lgd: { en: "LGD", es: "LGD" },
  breakeven: { en: "Break-even price", es: "Precio de equilibrio" },
  breakevenHint: {
    en: "FOB $/kg at harvest at which expected revenue repays principal plus interest.",
    es: "FOB $/kg en cosecha con el que el ingreso esperado repaga capital más intereses.",
  },
  headroom: { en: "Headroom vs expected harvest price", es: "Holgura vs precio esperado en cosecha" },
  stressTest: { en: "Stress test: revenue coverage of principal + interest", es: "Prueba de estrés: cobertura de capital + intereses" },
  stressHint: {
    en: "Rows: yield shock. Columns: price shock from the expected harvest price.",
    es: "Filas: shock de rendimiento. Columnas: shock de precio desde el precio esperado en cosecha.",
  },
  yieldShock: { en: "Yield", es: "Rendimiento" },
  priceShock: { en: "Price", es: "Precio" },
  keyRisks: { en: "Main risks", es: "Riesgos principales" },
  mitigants: { en: "Mitigants", es: "Mitigantes" },
  none: { en: "None", es: "Ninguno" },
  field: { en: "Field", es: "Parcela" },
  fieldHint: { en: "Monitored parcel (satellite basemap)", es: "Parcela monitoreada (imagen satelital)" },
  coordinates: { en: "Coordinates", es: "Coordenadas" },
  conditions: { en: "Conditions precedent", es: "Condiciones previas" },
  condMet: { en: "Met", es: "Cumplida" },
  condPending: { en: "Pending", es: "Pendiente" },
  condFailed: { en: "Not met", es: "No cumplida" },
  generatedOn: { en: "Generated", es: "Generado" },
  thresholdPolicy: { en: "Threshold policy v0.1 · quarterly review", es: "Política de umbrales v0.1 · revisión trimestral" },
  indicative: { en: "indicative", es: "indicativa" },
  score: { en: "Score", es: "Score" },
  nino12: { en: "Niño 1+2 (coastal, °C)", es: "Niño 1+2 (costero, °C)" },
  nino34: { en: "Niño 3.4 (central Pacific, ONI basis)", es: "Niño 3.4 (Pacífico central, base del ONI)" },
  waterCoverageLabel: { en: "Licensed water ÷ crop demand", es: "Dotación ÷ demanda del cultivo" },
  expectedHarvestPrice: { en: "Expected harvest price", es: "Precio esperado en cosecha" },
  reference: { en: "reference", es: "referencia" },
  tkTitle: { en: "4 · Repayment: M3 takeout", es: "4 · Repago: toma en M3" },
  tkSub: {
    en: "At M3 the buyer's purchase order, insured by Coface, funds a post-harvest advance that repays this loan",
    es: "En M3 la orden de compra del comprador, asegurada por Coface, financia un adelanto post-cosecha que repaga este préstamo",
  },
  tkPo: { en: "Purchase order signed", es: "Orden de compra firmada" },
  tkCoface: { en: "Coface buyer cover", es: "Cobertura Coface del comprador" },
  tkAdvance: { en: "Post-harvest advance", es: "Adelanto post-cosecha" },
  tkCoverage: { en: "Advance ÷ pre-harvest amount due", es: "Adelanto ÷ adeudado pre-cosecha" },
  tkDue: { en: "Due", es: "Adeudado" },
  tkExpected: { en: "Expected at M3", es: "Previsto en M3" },
  tkNotSigned: { en: "Not signed", es: "No firmada" },
  tkSource: {
    en: "Purchase order and Coface decision from the deal file; advance terms from the post-harvest facility",
    es: "Orden de compra y decisión Coface del expediente; condiciones del adelanto según la facilidad post-cosecha",
  },
  satTitle: { en: "Parcel satellite image", es: "Imagen satelital de la parcela" },
  satSub: {
    en: "Latest clear Sentinel-2 image at the cut-off date. Dashed line: the monitored parcel.",
    es: "Última imagen Sentinel-2 despejada a la fecha de corte. Línea punteada: la parcela monitoreada.",
  },
  satTrueColor: { en: "True colour", es: "Color real" },
  satNdvi: { en: "Crop vigour (NDVI)", es: "Vigor del cultivo (NDVI)" },
  satParcelNdvi: { en: "Parcel NDVI", es: "NDVI de la parcela" },
  satVsNormal: { en: "vs 5-yr normal", es: "vs normal 5 años" },
  satWeak: { en: "Weak patches", es: "Zonas débiles" },
  satClear: { en: "Clear sky", es: "Cielo despejado" },
  satHistory: { en: "Image history", es: "Historial de imágenes" },
  satSource: {
    en: "Copernicus Sentinel-2 L2A via Earth Search (AWS Open Data). Clouds masked with the scene classification layer.",
    es: "Copernicus Sentinel-2 L2A vía Earth Search (AWS Open Data). Nubes enmascaradas con la capa de clasificación de escena.",
  },
} satisfies Record<string, Bilingual>;

export type StringKey = keyof typeof STRINGS;

export function t(key: StringKey, lang: Lang): string {
  return STRINGS[key][lang];
}

export const tb = (b: Bilingual, lang: Lang) => b[lang];

export const ACTION_TEXT: Record<BankAction, Bilingual> = {
  continue: { en: "Continue", es: "Continuar" },
  call_inspection: { en: "Call field inspection", es: "Solicitar inspección" },
  hold_tranche: { en: "Hold next tranche", es: "Retener siguiente tramo" },
  stop: { en: "Stop disbursement", es: "Detener desembolso" },
};

export const SEVERITY_TEXT: Record<Severity, Bilingual> = {
  green: { en: "Normal", es: "Normal" },
  yellow: { en: "Watch", es: "Vigilar" },
  red: { en: "High risk", es: "Riesgo alto" },
};

/**
 * How each input is presented to the bank: third-party registry checks show as
 * verified on the check date, grower inputs as declared, data feeds as synced.
 */
export const SOURCE_STATUS_TEXT: Record<SourceStatus, Bilingual> = {
  live: { en: "Live", es: "En vivo" },
  cached: { en: "Synced", es: "Sincronizado" },
  verified: { en: "Verified", es: "Verificado" },
  manual: { en: "Declared", es: "Declarado" },
};

/** Spanish names for score-line sources (registry names stay as they are). */
const SOURCE_NAME_ES: Record<string, string> = {
  "Field inspection": "Inspección de campo",
  Insurers: "Aseguradoras",
  "Term sheet": "Term sheet",
  "Satellite + phenology": "Satelital + fenología",
  Monitoring: "Monitoreo",
  "Veritrade · supplier profiles": "Veritrade · perfiles de exportadores",
  "GLOBALG.A.P. · inspection": "GLOBALG.A.P. · inspección",
};

export const sourceName = (name: string, lang: Lang) => (lang === "es" ? (SOURCE_NAME_ES[name] ?? name) : name);

export const TRANCHE_STATUS_TEXT: Record<TrancheStatus, Bilingual> = {
  pending: { en: "Pending", es: "Pendiente" },
  released: { en: "Released", es: "Liberado" },
  held: { en: "Held", es: "Retenido" },
  stopped: { en: "Stopped", es: "Detenido" },
};

export function formatUsd(n: number, lang: Lang): string {
  return `USD ${n.toLocaleString(lang === "es" ? "es-PE" : "en-US", { maximumFractionDigits: 0 })}`;
}

const MONTHS: Record<Lang, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"],
};

/** "15 Sep 2026" / "15 set 2026": one format everywhere, whatever the browser's locale data. */
export function formatDate(d: string, lang: Lang, withYear = true): string {
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return `${day} ${MONTHS[lang][m - 1]}${withYear ? ` ${y}` : ""}`;
}

/** "Oct 2026" / "oct 2026" from "2026-10" (or a full date): monthly data never gets a fake day. */
export function formatMonth(ym: string, lang: Lang): string {
  const [y, m] = ym.slice(0, 7).split("-").map(Number);
  return `${MONTHS[lang][m - 1]} ${y}`;
}

/** Loan rate: "8.5% effective annual" in English, "TEA 8.5%" in Spanish. */
export function formatRate(pct: number, lang: Lang): string {
  return lang === "es" ? `TEA ${pct.toFixed(1)}%` : `${pct.toFixed(1)}% effective annual`;
}
