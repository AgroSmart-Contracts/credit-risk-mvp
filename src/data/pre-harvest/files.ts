/**
 * The bank's file book: files already in the system plus the ones registered from an
 * uploaded application. Registry results (SUNAT, SUNARP, bureau, ANA, SENASA) and the
 * buyer's PO are looked up by RUC; the satellite history by the surveyed parcel.
 */
import type { MonitoringData, PreHarvestDeal } from "../../lib/pre-harvest/types";
import { simulateCampaign, type CampaignSimulation } from "../../lib/pre-harvest/timeline";
import { DATA_UNTIL, monitoringDataFor } from "./index";
import { PARCELS, type ParcelId } from "../../lib/pre-harvest/site";
import { centroid, distanceM, type ExtractedApplication } from "../../lib/pre-harvest/application-reader";
import { addDays } from "../../lib/pre-harvest/monitoring";
import { DEALS } from "./deals";
import { CLOSED_VIR_0311_2324 } from "./deal-viru-0311";
import { FINDINGS_VIR_0311, type ResearchFinding } from "./findings-viru-0311";

export type { ResearchFinding };

export const FINDINGS: Record<string, ResearchFinding[]> = {
  [CLOSED_VIR_0311_2324.id]: FINDINGS_VIR_0311,
};

/** Bank-side records per client RUC. */
const RECORDS = new Map<string, PreHarvestDeal>([[CLOSED_VIR_0311_2324.formato.ruc, CLOSED_VIR_0311_2324]]);

/** Parcels with a satellite history on record: a surveyed ring within 30 m of one of them. */
export function matchParcel(ring: Array<[number, number]>): ParcelId | null {
  const c = centroid(ring);
  for (const p of Object.values(PARCELS)) if (distanceM(c, centroid(p.ring)) < 30) return p.id;
  return null;
}

export type BuildResult = { ok: true; deal: PreHarvestDeal } | { ok: false; reason: "no_records" | "no_parcel" | "missing" };

export function dealFromApplication(app: ExtractedApplication, today = new Date().toISOString().slice(0, 10)): BuildResult {
  const v = <T,>(f: { value: T } | undefined) => f?.value;
  const ruc = v(app.ruc);
  const ring = v(app.vertices)?.ring;
  const approval = v(app.approvalDate);
  if (!ruc || !ring || !approval || !v(app.amountUsd) || !v(app.tenorDays)) return { ok: false, reason: "missing" };
  const base = RECORDS.get(ruc);
  if (!base) return { ok: false, reason: "no_records" };
  const parcelId = matchParcel(ring);
  if (!parcelId) return { ok: false, reason: "no_parcel" };

  const tenorDays = v(app.tenorDays)!;
  const end = addDays(approval, tenorDays);
  const [lon, lat] = centroid(ring);
  const f = base.formato;
  return {
    ok: true,
    deal: {
      ...base,
      parcelId,
      status: end < today ? "closed" : approval > today ? "application" : "live",
      lat,
      lon,
      parcel: ring,
      envelopeUsd: v(app.amountUsd)!,
      tenorDays,
      approvalDate: approval,
      fruitSetDate: v(app.fruitSetDate) ?? base.fruitSetDate,
      preHarvestDate: v(app.preHarvestDate) ?? base.preHarvestDate,
      m3Date: v(app.m3Date) ?? base.m3Date,
      packhouseAssignment: v(app.packhouseAssignment) ?? base.packhouseAssignment,
      formato: {
        ...f,
        growerName: v(app.growerName) ?? f.growerName,
        ruc,
        areaHa: v(app.areaHa) ?? f.areaHa,
        variety: v(app.variety) ?? f.variety,
        orchardAgeYears: v(app.orchardAgeYears) ?? f.orchardAgeYears,
        lastHarvestDate: v(app.lastHarvestDate) ?? f.lastHarvestDate,
        declaredYieldTPerHa: v(app.declaredYieldTPerHa) ?? f.declaredYieldTPerHa,
        waterAllocationM3PerHa: v(app.waterAllocationM3PerHa) ?? f.waterAllocationM3PerHa,
        cropWaterNeedM3PerHa: v(app.cropWaterNeedM3PerHa) ?? f.cropWaterNeedM3PerHa,
        salinityEcDsM: v(app.salinityEcDsM) ?? f.salinityEcDsM,
        revenueLast3CampaignsUsd: v(app.revenueLast3CampaignsUsd) ?? f.revenueLast3CampaignsUsd,
        campaignCostUsd: v(app.campaignCostUsd) ?? f.campaignCostUsd,
        packhouseUtilizationPct: v(app.packhouseUtilizationPct) ?? f.packhouseUtilizationPct,
        hasPackhouseContract: v(app.hasPackhouseContract) ?? f.hasPackhouseContract,
        exportsDirectly: v(app.exportsDirectly) ?? f.exportsDirectly,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Registered files (this browser): kept so the file stays in the inbox after a reload.
// ---------------------------------------------------------------------------

const KEY = "tm-pre-harvest-files";

export function loadRegistered(): PreHarvestDeal[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? (raw as PreHarvestDeal[]).filter((d) => d && d.id && d.parcelId in PARCELS) : [];
  } catch {
    return [];
  }
}

export function saveRegistered(deals: PreHarvestDeal[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(deals));
  } catch {
    /* storage unavailable: the file stays for this session only */
  }
}

export function allFiles(registered: PreHarvestDeal[]): PreHarvestDeal[] {
  const ids = new Set(registered.map((d) => d.id));
  return [...registered, ...DEALS.filter((d) => !ids.has(d.id))];
}

/** The file's campaign on its cached data: a closed campaign in full, others up to the last date with data. */
export function simulateFile(deal: PreHarvestDeal, data: MonitoringData = monitoringDataFor(deal.parcelId)): CampaignSimulation {
  const until = deal.status === "closed" ? undefined : (data.climate.weather.at(-1)?.date ?? DATA_UNTIL);
  return simulateCampaign(deal, data, until);
}
