import type { PreHarvestDeal } from "../../lib/pre-harvest/types";
import { PARCELS } from "../../lib/pre-harvest/site";

/**
 * Client VIR-0311 (anonymised): Hass avocado block in the Chavimochic irrigation
 * project, Virú (La Libertad). Completed 2023-24 campaign, reviewed after the fact:
 * the file is evaluated on the data that was available on each date, and the
 * campaign events (Yaku canal break, coastal El Niño alert, heat stress at
 * flowering, smaller calibre, higher export prices) come from public sources.
 */
const p = PARCELS["viru-0311"];

export const CLOSED_VIR_0311_2324: PreHarvestDeal = {
  id: "PH-VIR-0311-2324",
  parcelId: "viru-0311",
  status: "closed",
  campaign: { en: "2023-24 campaign", es: "Campaña 2023-24" },
  name: { en: "Client VIR-0311 · Hass avocado", es: "Cliente VIR-0311 · Palta Hass" },
  lat: p.site.lat,
  lon: p.site.lon,
  parcel: p.ring,
  location: { en: "Chavimochic, Virú (La Libertad)", es: "Chavimochic, Virú (La Libertad)" },
  envelopeUsd: 30_000,
  tenorDays: 180,
  approvalDate: "2023-09-15",
  fruitSetDate: "2023-11-15",
  preHarvestDate: "2024-02-15",
  m3Date: "2024-03-01",
  checksDate: "2023-09-11",
  inspectionDate: "2023-09-08",
  packhouseAssignment: true,
  takeout: {
    poSignedDate: "2024-02-26",
    buyer: "EU importer (anonymised)",
    buyerCountry: "Netherlands",
    // Declared 14 t/ha x 3.97 ha = 55.6 t; the PO was cut to 44 t after the
    // smaller calibre of the 2024 season (ProHass: -20% to -30% calibre).
    poVolumeKg: 44_000,
    poPriceUsdPerKg: 2.05,
    coface: "approved",
    cofaceCoveragePct: 90,
    advanceRatePct: 70,
  },
  formato: {
    growerName: "VIR-0311",
    ruc: "20000000011",
    crop: "avocado",
    variety: "Hass",
    // Declared on the application; the measured parcel is 3.97 ha.
    areaHa: 4.0,
    orchardAgeYears: 5,
    lastHarvestDate: "2023-07-05",
    declaredYieldTPerHa: 14,
    waterAllocationM3PerHa: 9_500,
    cropWaterNeedM3PerHa: 9_000,
    salinityEcDsM: 0.9,
    // 2022-23 is lower: the March 2023 canal break cut water during sizing.
    revenueLast3CampaignsUsd: [56_000, 61_000, 52_000],
    campaignCostUsd: 44_100,
    packhouseUtilizationPct: 82,
    hasPackhouseContract: true,
    exportsDirectly: false,
  },
  checks: {
    ruc: { active: true, habido: true, status: "verified" },
    sunarp: { tenure: "owned", liens: 0, status: "verified" },
    credit: { rating: "Normal", protestedDebts: 0, bureau: "INFOCORP / SBS RCC", status: "verified" },
    ana: { licenceValid: true, licenceId: "PECH-CHAV-0311", status: "verified" },
    senasa: {
      zoneStatus: "low_prevalence",
      note: {
        en: "La Libertad: fruit-fly control area, no active quarantine",
        es: "La Libertad: área de control de mosca de la fruta, sin cuarentena activa",
      },
      status: "verified",
    },
    inspection: {
      soilOk: true,
      sanitationOk: true,
      ipmRecords: true,
      globalGap: true,
      note: {
        en: "Canopy thinner than usual after the winter; irrigation restored since July",
        es: "Follaje más ralo que lo usual tras el invierno; riego restablecido desde julio",
      },
      status: "verified",
    },
    insurance: { catastrophic: false, commercial: true, parametric: false, status: "verified" },
    exporterProfile: { score: null, shipments: 0, status: "cached" },
    peerYieldTPerHa: { median: 12, p75: 15, status: "verified" },
  },
};
