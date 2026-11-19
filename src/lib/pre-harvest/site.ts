/**
 * Monitored parcels, digitised from Sentinel-2 imagery in Pampa de Villacurí (Ica).
 * Both were picked as evergreen orchard blocks (NDVI high in every season, no shade
 * netting): the signature of an evergreen tree crop such as avocado. Citrus looks
 * similar from space; only a field visit can confirm the crop.
 *
 * Villacurí irrigates from groundwater (Ica-Villacurí aquifer), so water risk is
 * measured as licensed allocation vs climate-driven crop demand, not river flow.
 */

export type ParcelId = "ica-0142" | "ica-0177" | "ica-0188" | "viru-0311";

export interface Parcel {
  id: ParcelId;
  /** Boundary as [lon, lat] pairs (closed ring without the repeated first point). */
  ring: Array<[number, number]>;
  areaHa: number;
  /** Centroid: the point used for weather and the MODIS fallback series. */
  site: { lat: number; lon: number };
}

export const PARCELS: Record<ParcelId, Parcel> = {
  // Orchard until May 2026, then cleared (NDVI 0.72 → ~0.11, bare ground).
  "ica-0142": {
    id: "ica-0142",
    ring: [
      [-75.858509, -13.920896],
      [-75.855919, -13.92147],
      [-75.856091, -13.924318],
      [-75.858705, -13.923924],
    ],
    areaHa: 9.24,
    site: { lat: -13.92265, lon: -75.85731 },
  },
  // Standing in Oct 2026, but its NDVI drops to ~0.2 every June: the pruning cycle of
  // table grapes, not an evergreen avocado orchard. Kept as a crop-mismatch example.
  "ica-0177": {
    id: "ica-0177",
    ring: [
      [-75.848511, -13.927011],
      [-75.845272, -13.927113],
      [-75.845303, -13.929373],
      [-75.848566, -13.929272],
    ],
    areaHa: 8.79,
    site: { lat: -13.92819, lon: -75.84691 },
  },
  // Lower Ica valley (east side). Green in every sampled month of 2024-25 (no pruning
  // dip from May to September, unlike the Villacurí vineyards) and standing in Oct 2026.
  "ica-0188": {
    id: "ica-0188",
    ring: [
      [-75.67056, -14.128866],
      [-75.666608, -14.12945],
      [-75.666672, -14.130203],
      [-75.670502, -14.130192],
    ],
    areaHa: 4.83,
    site: { lat: -14.12968, lon: -75.66859 },
  },
  // Chavimochic, Virú (La Libertad). Canal-irrigated orchard block: parcel NDVI never
  // below 0.43 in 49 clear Sentinel-2 scenes from Oct 2022 to Jul 2024 (no pruning or
  // cutting dip, unlike the asparagus blocks around it, which drop to ~0.08 every cut).
  "viru-0311": {
    id: "viru-0311",
    ring: [
      [-78.75964, -8.42695],
      [-78.757643, -8.426939],
      [-78.757634, -8.428565],
      [-78.759631, -8.428577],
    ],
    areaHa: 3.96,
    site: { lat: -8.42776, lon: -78.75864 },
  },
};

// Seed (closed 2025-26 campaign) parcel, kept for existing imports.
export const SEED_PARCEL = PARCELS["ica-0142"].ring;
export const SEED_PARCEL_HA = PARCELS["ica-0142"].areaHa;
export const SEED_SITE = PARCELS["ica-0142"].site;
