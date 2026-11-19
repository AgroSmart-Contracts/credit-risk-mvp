import type { PreHarvestDeal } from "../../lib/pre-harvest/types";
import { SEED_PARCEL, SEED_PARCEL_HA, SEED_SITE } from "../../lib/pre-harvest/site";

/**
 * Seed pre-harvest deal (client code ICA-0142, anonymised as in the BCP presentation).
 * Hass avocado, 9.24 ha block in Pampa de Villacurí (Ica), USD 70K envelope, 68% LTV, 180 days.
 * Registry checks as of the check date; monitoring uses the cached satellite, weather and price data for this field.
 */
export const SEED_PRE_HARVEST_DEAL: PreHarvestDeal = {
  id: "PH-ICA-0142-2526",
  parcelId: "ica-0142",
  status: "closed",
  campaign: { en: "2025-26 campaign", es: "Campaña 2025-26" },
  name: { en: "Client ICA-0142 · Hass avocado", es: "Cliente ICA-0142 · Palta Hass" },
  lat: SEED_SITE.lat,
  lon: SEED_SITE.lon,
  parcel: SEED_PARCEL,
  location: { en: "Pampa de Villacurí, Ica Valley", es: "Pampa de Villacurí, Valle de Ica" },
  envelopeUsd: 70_000,
  tenorDays: 180,
  approvalDate: "2025-09-15",
  fruitSetDate: "2025-11-15",
  preHarvestDate: "2026-02-15",
  m3Date: "2026-03-01",
  checksDate: "2025-09-11",
  inspectionDate: "2025-09-09",
  packhouseAssignment: true,
  takeout: {
    poSignedDate: "2026-02-24",
    buyer: "EU importer (anonymised)",
    buyerCountry: "Netherlands",
    poVolumeKg: 88_000,
    poPriceUsdPerKg: 1.7,
    coface: "approved",
    cofaceCoveragePct: 90,
    advanceRatePct: 70,
  },
  formato: {
    growerName: "ICA-0142",
    ruc: "20000000001",
    crop: "avocado",
    variety: "Hass",
    areaHa: SEED_PARCEL_HA,
    orchardAgeYears: 7,
    lastHarvestDate: "2025-06-20",
    declaredYieldTPerHa: 15,
    waterAllocationM3PerHa: 10_000,
    cropWaterNeedM3PerHa: 9_000,
    salinityEcDsM: 1.2,
    revenueLast3CampaignsUsd: [131_000, 136_000, 138_000],
    campaignCostUsd: 102_900,
    packhouseUtilizationPct: 88,
    hasPackhouseContract: true,
    exportsDirectly: false,
  },
  checks: {
    ruc: { active: true, habido: true, status: "verified" },
    sunarp: { tenure: "owned", liens: 1, status: "verified" },
    credit: { rating: "Normal", protestedDebts: 0, bureau: "INFOCORP / SBS RCC", status: "verified" },
    ana: { licenceValid: true, licenceId: "RADA-ICA-0000", status: "verified" },
    senasa: {
      zoneStatus: "low_prevalence",
      note: {
        en: "Ica: fruit-fly low-prevalence zone, no active quarantine",
        es: "Ica: zona de baja prevalencia de mosca de la fruta, sin cuarentena activa",
      },
      status: "verified",
    },
    inspection: {
      soilOk: true,
      sanitationOk: true,
      ipmRecords: false,
      globalGap: true,
      note: {
        en: "Soil and canopy sound; pest records kept informally",
        es: "Suelo y follaje en buen estado; registros de plagas informales",
      },
      status: "verified",
    },
    insurance: { catastrophic: false, commercial: true, parametric: true, status: "verified" },
    exporterProfile: { score: null, shipments: 0, status: "cached" },
    peerYieldTPerHa: { median: 13, p75: 16, status: "verified" },
  },
};
