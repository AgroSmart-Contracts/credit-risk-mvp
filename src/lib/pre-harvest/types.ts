import type { ParcelId } from "./site";
/** Pre-harvest CRAM types. Pure data: no React, no fetch. */

export type Lang = "en" | "es";
export type Bilingual = { en: string; es: string };

export type LetterTier = "A" | "B" | "C" | "D" | "VETO";
export type Severity = "green" | "yellow" | "red";
export type PanelId = "crop" | "weather" | "market" | "takeout";
export type BankAction = "continue" | "call_inspection" | "hold_tranche" | "stop";
export type DimensionKey = "production" | "operator" | "structure" | "counterparty";

/** Where a score input comes from, shown as a badge in the UI. */
export type SourceStatus = "live" | "cached" | "verified" | "manual";
export type SourceRef = { name: string; status: SourceStatus };

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** The bank's grower intake form (Formato). Entered by the grower / analyst. */
export interface Formato {
  growerName: string;
  ruc: string;
  crop: "avocado";
  variety: string;
  areaHa: number;
  orchardAgeYears: number;
  lastHarvestDate: string;
  declaredYieldTPerHa: number;
  /** Licensed water allocation (ANA aforo), m³ per ha per year. */
  waterAllocationM3PerHa: number;
  /** Crop water requirement, m³ per ha per year. */
  cropWaterNeedM3PerHa: number;
  /** Irrigation water salinity, electrical conductivity in dS/m. */
  salinityEcDsM: number;
  /** Revenue of the last 3 campaigns, oldest first, USD. */
  revenueLast3CampaignsUsd: [number, number, number];
  /** Projected cost of this campaign, USD. LTV is measured against it. */
  campaignCostUsd: number;
  /** Share of packing capacity already committed, %. */
  packhouseUtilizationPct: number;
  hasPackhouseContract: boolean;
  /** True when the grower exports under its own RUC (has a customs track record). */
  exportsDirectly: boolean;
}

export type CreditRating = "Normal" | "CPP" | "Deficiente" | "Dudoso" | "Perdida";

/** Third-party checks. Registry results as of the check date unless `status` says otherwise. */
export interface ThirdPartyChecks {
  ruc: { active: boolean; habido: boolean; status: SourceStatus };
  sunarp: { tenure: "owned" | "leased" | "informal"; liens: number; status: SourceStatus };
  credit: { rating: CreditRating; protestedDebts: number; bureau: string; status: SourceStatus };
  ana: { licenceValid: boolean; licenceId: string; status: SourceStatus };
  senasa: { zoneStatus: "free" | "low_prevalence" | "quarantine"; note: Bilingual; status: SourceStatus };
  inspection: {
    soilOk: boolean;
    sanitationOk: boolean;
    ipmRecords: boolean;
    globalGap: boolean;
    note: Bilingual;
    status: SourceStatus;
  };
  insurance: { catastrophic: boolean; commercial: boolean; parametric: boolean; status: SourceStatus };
  /** Exporter profile score from customs records (supplier-risk-profile), when the grower exports. */
  exporterProfile: { score: number | null; shipments: number; status: SourceStatus };
  /** Peer yield for this variety and zone (MIDAGRI), t/ha. */
  peerYieldTPerHa: { median: number; p75: number; status: SourceStatus };
}

export interface PreHarvestDeal {
  id: string;
  /** Which monitored parcel (satellite series) the deal is on. */
  parcelId: ParcelId;
  /** closed: full past campaign · application: pending approval · live: in progress, monitored to today. */
  status: "closed" | "application" | "live";
  campaign: Bilingual;
  name: Bilingual;
  lat: number;
  lon: number;
  /** Parcel boundary, [lon, lat] pairs. */
  parcel: Array<[number, number]>;
  location: Bilingual;
  envelopeUsd: number;
  tenorDays: number;
  /** Campaign milestones (ISO dates). Tranches are tied to crop stage, these are the declared dates. */
  approvalDate: string;
  fruitSetDate: string;
  preHarvestDate: string;
  m3Date: string;
  /** Date the third-party checks (SUNAT, SUNARP, bureau, ANA, SENASA) were run. */
  checksDate: string;
  inspectionDate: string;
  /** Packhouse proceeds assigned to a bank collection account (cesión de flujos). */
  packhouseAssignment: boolean;
  /** How the pre-harvest loan is repaid at M3: taken out by post-harvest trade finance. */
  takeout: TakeoutInputs;
  formato: Formato;
  checks: ThirdPartyChecks;
}

/**
 * M3 takeout: at purchase-order signing, a post-harvest facility (Coface-insured
 * buyer receivable) advances against the PO and repays the pre-harvest loan.
 */
export interface TakeoutInputs {
  /** Date the buyer's purchase order was signed; null if not yet signed. */
  poSignedDate: string | null;
  buyer: string;
  buyerCountry: string;
  poVolumeKg: number;
  poPriceUsdPerKg: number;
  /** Coface decision on the buyer limit. */
  coface: "approved" | "reduced" | "declined" | "pending";
  /** Share of the PO value the Coface limit covers, %. */
  cofaceCoveragePct: number;
  /** Post-harvest advance rate on the insured PO value, %. */
  advanceRatePct: number;
}

/** Signals measured at origination from the monitoring data. */
export interface OriginationSignals {
  /** Field NDVI vs its own 5-year median at approval, % (negative = below). */
  ndviVsMedianPct: number | null;
  /** Coastal El Niño signal known at approval (3-month mean Niño 1+2 anomaly, °C). */
  enso: number | null;
  /** Mean parcel NDVI over the weeks before approval: is there a standing crop at all? */
  cropPresenceNdvi: number | null;
  /** Second-lowest 16-day NDVI in the two years before approval: an evergreen crop never goes dormant. */
  seasonalMinNdvi: number | null;
}

// ---------------------------------------------------------------------------
// Scoring output
// ---------------------------------------------------------------------------

export interface ScoreLine {
  label: Bilingual;
  value: Bilingual;
  points: number;
  source: SourceRef;
}

export interface DimensionScore {
  key: DimensionKey;
  weight: number;
  base: number;
  score: number;
  dormant: boolean;
  lines: ScoreLine[];
}

export interface PreHarvestAssessment {
  dimensions: DimensionScore[];
  composite: number;
  tier: LetterTier;
  vetoed: boolean;
  vetoReasons: Bilingual[];
  pricingPct: number | null;
  ltvPct: number;
  /** Vetoes raised by origination data (e.g. no standing crop), carried into every re-score. */
  signalVetoes: Bilingual[];
}

// ---------------------------------------------------------------------------
// Monitoring data (fixtures and live responses share these shapes)
// ---------------------------------------------------------------------------

export interface NdviPoint {
  date: string;
  ndvi: number;
}

export interface NdviFixture {
  source: string;
  lat: number;
  lon: number;
  fetchedAt: string;
  series: NdviPoint[];
}

export interface WeatherDay {
  date: string;
  tmax: number | null;
  tmin: number | null;
  precip: number | null;
  rh: number | null;
  et0: number | null;
}

/** Monthly sea-surface temperature anomalies, °C (NOAA CPC OISST indices). */
export interface EnsoPoint {
  /** YYYY-MM */
  month: string;
  /** Niño 1+2 anomaly: the coastal region that drives Peru's coastal El Niño (basis of ENFEN's ICEN). */
  nino12: number;
  /** Niño 3.4 anomaly: the central-Pacific index behind ONI, shown for reference. */
  nino34: number;
}

export interface ClimateFixture {
  source: string;
  lat: number;
  lon: number;
  fetchedAt: string;
  weather: WeatherDay[];
  precipClimatology: Array<{ doy: number; mean30: number; std30: number }>;
  /** Mean 30-day reference evapotranspiration (mm) for each day of year: normal water demand. */
  et0Climatology: Array<{ doy: number; mean30: number }>;
  enso: EnsoPoint[];
}

export interface MarketMonth {
  month: string;
  shipments: number;
  kg: number;
  fobUsd: number;
  usdPerKg: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface MarketFixture {
  generatedAt: string;
  hsCode: string;
  veritradeMonthly: MarketMonth[];
  comtradeMonthly: Array<{ month: string; kg: number; fobUsd: number; usdPerKg: number }>;
  /** Imports from Peru reported by Spain, Netherlands and the US, CIF scaled to FOB. Fills Comtrade gaps. */
  mirrorMonthly?: Array<{ month: string; kg: number; cifUsd: number; usdPerKg: number }>;
  mirrorFobFactor?: number;
  seasonalBand: Array<{ calendarMonth: number; years: number; p10: number; p25: number; p50: number; p75: number; p90: number }>;
}

export interface MonitoringData {
  ndvi: NdviFixture;
  climate: ClimateFixture;
  market: MarketFixture;
  /** Where each dataset came from in this session. */
  status: Record<"ndvi" | "climate" | "market", SourceStatus>;
}

// ---------------------------------------------------------------------------
// Monitoring output
// ---------------------------------------------------------------------------

export interface Trigger {
  panel: PanelId;
  metric: string;
  date: string;
  value: number;
  /** Human readable band or threshold the value broke. */
  limit: string;
  severity: Exclude<Severity, "green">;
  message: Bilingual;
}

export interface PanelState {
  panel: PanelId;
  severity: Severity;
  triggers: Trigger[];
}

export type TrancheStatus = "pending" | "released" | "held" | "stopped";

export interface TrancheState {
  id: "approval" | "fruit_set" | "pre_harvest";
  label: Bilingual;
  pct: number;
  amountUsd: number;
  dueDate: string;
  status: TrancheStatus;
  releasedOn: string | null;
  condition: Bilingual;
}

export interface TimelineFrame {
  date: string;
  panels: Record<PanelId, PanelState>;
  composite: number;
  tier: LetterTier;
  action: BankAction;
  tranches: TrancheState[];
  outstandingUsd: number;
  coverageRatio: number | null;
  /** Current FOB price carried to the harvest window with the usual seasonal pattern. */
  expectedHarvestPrice: number | null;
  expectedRevenueUsd: number | null;
  priceDropPct: number | null;
  m3Reached: boolean;
}

export interface AlertLogEntry {
  date: string;
  panel: PanelId;
  metric: string;
  value: number;
  limit: string;
  severity: Exclude<Severity, "green">;
  composite: number;
  tier: LetterTier;
  action: BankAction;
  message: Bilingual;
}


// ---------------------------------------------------------------------------
// Sentinel-2 parcel imagery (10 m)
// ---------------------------------------------------------------------------

export interface SentinelScene {
  id: string;
  date: string;
  /** Cloud cover of the whole 100 km tile, %. */
  sceneCloudPct: number;
  /** Share of the parcel's pixels that are clear (SCL mask), %. */
  parcelClearPct: number;
  /** Mean NDVI over the parcel's clear pixels. */
  ndviMean: number | null;
  /** Share of clear parcel pixels more than 20% below the parcel mean (weak patches), %. */
  weakPct: number | null;
  /** Image side in pixels (square). */
  size: number;
  /** Image extent [west, south, east, north] in lon/lat. */
  bboxLonLat: [number, number, number, number] | null;
  /** Base64 RGBA bytes (size × size × 4). */
  trueColor: string | null;
  ndviImage: string | null;
}

export interface SentinelFixture {
  source: string;
  fetchedAt: string;
  parcel: Array<[number, number]>;
  /** Parcel NDVI time series (all clear-enough scenes). */
  series: Array<{ date: string; ndviMean: number; parcelClearPct: number; weakPct: number | null }>;
  /** Scenes with images for the gallery (campaign window, mostly clear). */
  scenes: SentinelScene[];
}
