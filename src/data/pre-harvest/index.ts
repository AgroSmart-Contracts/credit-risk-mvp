/**
 * Cached monitoring data per parcel, shared by the app and the tests.
 * Crop health uses the Sentinel-2 parcel series (10 m, parcel mean) when present,
 * with NASA MODIS (250 m, one pixel) as the fallback.
 */
import ndviModis from "./ndvi-villacuri.json";
import series0142 from "./sentinel-series-ica-0142.json";
import series0177 from "./sentinel-series-ica-0177.json";
import series0188 from "./sentinel-series-ica-0188.json";
import series0311 from "./sentinel-series-viru-0311.json";
import climateFixture from "./climate-villacuri.json";
import climateChavimochic from "./climate-chavimochic.json";
import marketFixture from "./avocado-market.json";
import { sentinelComposites } from "../../lib/pre-harvest/monitoring";
import type { ParcelId } from "../../lib/pre-harvest/site";
import type { ClimateFixture, MarketFixture, MonitoringData, NdviFixture } from "../../lib/pre-harvest/types";

type SeriesFile = { fetchedAt: string; series: Array<{ date: string; ndviMean: number }> };
const SERIES: Record<ParcelId, SeriesFile> = {
  "ica-0142": series0142 as SeriesFile,
  "ica-0177": series0177 as SeriesFile,
  "ica-0188": series0188 as SeriesFile,
  "viru-0311": series0311 as SeriesFile,
};

/** Weather is fetched at each region's parcel: Villacurí/Ica and Chavimochic (Virú). */
const CLIMATE: Record<ParcelId, ClimateFixture> = {
  "ica-0142": climateFixture as ClimateFixture,
  "ica-0177": climateFixture as ClimateFixture,
  "ica-0188": climateFixture as ClimateFixture,
  "viru-0311": climateChavimochic as ClimateFixture,
};

function cropFixture(parcel: ParcelId): NdviFixture {
  const s = SERIES[parcel];
  if (s.series?.length) {
    return {
      source: "Sentinel-2 L2A parcel mean, 16-day composites (Earth Search, AWS Open Data)",
      lat: 0,
      lon: 0,
      fetchedAt: s.fetchedAt,
      series: sentinelComposites(s.series),
    };
  }
  return ndviModis as NdviFixture;
}

export function monitoringDataFor(parcel: ParcelId): MonitoringData {
  return {
    ndvi: cropFixture(parcel),
    climate: CLIMATE[parcel],
    market: marketFixture as MarketFixture,
    status: { ndvi: "cached", climate: "cached", market: "cached" },
  };
}

/** Last date the cached data covers (weather is the most recent source). */
export const DATA_UNTIL = (climateFixture as ClimateFixture).weather.at(-1)?.date ?? new Date().toISOString().slice(0, 10);

export const CACHED_MONITORING_DATA: MonitoringData = monitoringDataFor("ica-0142");
