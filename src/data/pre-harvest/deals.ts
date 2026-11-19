import type { PreHarvestDeal } from "../../lib/pre-harvest/types";
import { PARCELS } from "../../lib/pre-harvest/site";
import { SEED_PRE_HARVEST_DEAL } from "./seed-deal";

/**
 * Demo deal book. Third-party checks are fixtures; monitoring uses real cached
 * satellite, weather and price data for each parcel.
 *   ICA-0142 2025-26  closed campaign, the full replay
 *   ICA-0188 2026-27  live campaign on a standing evergreen orchard (lower Ica valley), monitored to today
 *   ICA-0142 2026-27  new application on the same parcel: the orchard was cleared
 *                     in May 2026, so planting validation vetoes it
 *   ICA-0177 2026-27  application declaring Hass avocado on a block whose satellite
 *                     pattern is a vineyard (pruned bare every June): crop-type check
 */
const p0177 = PARCELS["ica-0177"];
const p0188 = PARCELS["ica-0188"];

export const APPLICATION_0142_2627: PreHarvestDeal = {
  ...SEED_PRE_HARVEST_DEAL,
  id: "PH-ICA-0142-2627",
  status: "application",
  campaign: { en: "2026-27 application", es: "Solicitud 2026-27" },
  approvalDate: "2026-09-15",
  fruitSetDate: "2026-11-15",
  preHarvestDate: "2027-02-15",
  m3Date: "2027-03-01",
  checksDate: "2026-09-10",
  inspectionDate: "2026-09-08",
  formato: {
    ...SEED_PRE_HARVEST_DEAL.formato,
    lastHarvestDate: "2026-05-10",
    revenueLast3CampaignsUsd: [136_000, 138_000, 141_000],
  },
  takeout: { ...SEED_PRE_HARVEST_DEAL.takeout, poSignedDate: null, coface: "pending" },
};

export const LIVE_0188_2627: PreHarvestDeal = {
  ...SEED_PRE_HARVEST_DEAL,
  id: "PH-ICA-0188-2627",
  parcelId: "ica-0188",
  status: "live",
  campaign: { en: "2026-27 campaign (live)", es: "Campaña 2026-27 (en curso)" },
  name: { en: "Client ICA-0188 · Hass avocado", es: "Cliente ICA-0188 · Palta Hass" },
  lat: p0188.site.lat,
  lon: p0188.site.lon,
  parcel: p0188.ring,
  location: { en: "Lower Ica Valley", es: "Valle bajo de Ica" },
  envelopeUsd: 36_000,
  approvalDate: "2026-09-15",
  fruitSetDate: "2026-11-15",
  preHarvestDate: "2027-02-15",
  m3Date: "2027-03-01",
  checksDate: "2026-09-10",
  inspectionDate: "2026-09-08",
  formato: {
    ...SEED_PRE_HARVEST_DEAL.formato,
    growerName: "ICA-0188",
    ruc: "20000000003",
    areaHa: p0188.areaHa,
    orchardAgeYears: 9,
    lastHarvestDate: "2026-06-05",
    revenueLast3CampaignsUsd: [70_000, 72_000, 74_000],
    campaignCostUsd: 52_940,
  },
  takeout: { ...SEED_PRE_HARVEST_DEAL.takeout, poSignedDate: null, coface: "pending", poVolumeKg: 46_000 },
};

export const APPLICATION_0177_2627: PreHarvestDeal = {
  ...SEED_PRE_HARVEST_DEAL,
  id: "PH-ICA-0177-2627",
  parcelId: "ica-0177",
  status: "application",
  campaign: { en: "2026-27 application", es: "Solicitud 2026-27" },
  name: { en: "Client ICA-0177 · Hass avocado (declared)", es: "Cliente ICA-0177 · Palta Hass (declarada)" },
  lat: p0177.site.lat,
  lon: p0177.site.lon,
  parcel: p0177.ring,
  envelopeUsd: 66_000,
  approvalDate: "2026-09-15",
  fruitSetDate: "2026-11-15",
  preHarvestDate: "2027-02-15",
  m3Date: "2027-03-01",
  checksDate: "2026-09-10",
  inspectionDate: "2026-09-08",
  formato: {
    ...SEED_PRE_HARVEST_DEAL.formato,
    growerName: "ICA-0177",
    ruc: "20000000002",
    areaHa: p0177.areaHa,
    orchardAgeYears: 9,
    lastHarvestDate: "2026-06-05",
    revenueLast3CampaignsUsd: [128_000, 131_000, 134_000],
    campaignCostUsd: 97_060,
  },
  takeout: { ...SEED_PRE_HARVEST_DEAL.takeout, poSignedDate: null, coface: "pending", poVolumeKg: 84_000 },
};

export const DEALS: PreHarvestDeal[] = [SEED_PRE_HARVEST_DEAL, LIVE_0188_2627, APPLICATION_0142_2627, APPLICATION_0177_2627];
