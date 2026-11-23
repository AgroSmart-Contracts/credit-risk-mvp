/**
 * GET /api/pre-harvest-data?parcel=ica-0177
 * Refreshes the monitoring data for one parcel from the live sources and merges it
 * into the cached history. Every source is keyless; any that fails falls back to
 * the cached fixture, and the response says which one did.
 *   - crop: new Sentinel-2 scenes over the parcel since the last cached reading
 *   - climate: Open-Meteo weather (ERA5) and NOAA Niño 1+2 / 3.4
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import climateFixture from "../../src/data/pre-harvest/climate-villacuri.json" with { type: "json" };
import series0142 from "../../src/data/pre-harvest/sentinel-series-ica-0142.json" with { type: "json" };
import series0177 from "../../src/data/pre-harvest/sentinel-series-ica-0177.json" with { type: "json" };
import series0188 from "../../src/data/pre-harvest/sentinel-series-ica-0188.json" with { type: "json" };
import series0311 from "../../src/data/pre-harvest/sentinel-series-viru-0311.json" with { type: "json" };
import climateChavimochic from "../../src/data/pre-harvest/climate-chavimochic.json" with { type: "json" };
import { PARCELS, type ParcelId } from "../../src/lib/pre-harvest/site.js";
import type { ClimateFixture, SourceStatus } from "../../src/lib/pre-harvest/types.js";
import { processScene, searchScenes } from "./sentinel.js";
import { fetchEnso, fetchWeather } from "./sources.js";

type SeriesPoint = { date: string; ndviMean: number; parcelClearPct: number; weakPct: number | null };
type SeriesFile = { fetchedAt: string; series: SeriesPoint[] };
const SERIES: Record<ParcelId, SeriesFile> = {
  "ica-0142": series0142 as SeriesFile,
  "ica-0177": series0177 as SeriesFile,
  "ica-0188": series0188 as SeriesFile,
  "viru-0311": series0311 as SeriesFile,
};

const CACHE_MS = 6 * 60 * 60 * 1000;
const MAX_NEW_SCENES = 10;
const cache = new Map<ParcelId, { at: number; body: string }>();

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

function mergeByDate<T extends { date: string }>(base: T[], fresh: T[]): T[] {
  const map = new Map(base.map((p) => [p.date, p]));
  for (const p of fresh) map.set(p.date, p);
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

async function freshSentinel(parcelId: ParcelId): Promise<SeriesPoint[]> {
  const parcel = PARCELS[parcelId];
  const base = SERIES[parcelId].series;
  const since = base.at(-1)?.date ?? "2024-01-01";
  const from = iso(new Date(Date.parse(since) + 86_400_000));
  const items = (await searchScenes(parcel.site.lon, parcel.site.lat, from, iso(new Date()), 40)).slice(-MAX_NEW_SCENES);
  const scenes = await Promise.all(items.map((it) => processScene(it, parcel.ring, { images: false }).catch(() => null)));
  return scenes
    .filter((s) => s && s.ndviMean !== null && s.parcelClearPct >= 80)
    .map((s) => ({ date: s!.date, ndviMean: s!.ndviMean!, parcelClearPct: s!.parcelClearPct, weakPct: s!.weakPct }));
}

export async function buildLiveData(parcelId: ParcelId) {
  const climateBase = (parcelId === "viru-0311" ? climateChavimochic : climateFixture) as ClimateFixture;
  const status: Record<"ndvi" | "climate", SourceStatus> = { ndvi: "cached", climate: "cached" };
  const errors: string[] = [];
  const lastWeather = climateBase.weather.at(-1)?.date ?? "2024-01-01";
  const from = (d: string, back: number) => new Date(Date.parse(d) - back * 86_400_000);
  const { site } = PARCELS[parcelId];

  const [sentinel, weather, enso] = await Promise.allSettled([
    freshSentinel(parcelId),
    // ERA5 archive runs ~5 days behind real time.
    fetchWeather(site.lat, site.lon, from(lastWeather, 5), daysAgo(5)),
    fetchEnso(),
  ]);

  let series = SERIES[parcelId].series;
  if (sentinel.status === "fulfilled") {
    series = mergeByDate(series, sentinel.value);
    status.ndvi = "live";
  } else errors.push(`sentinel: ${String(sentinel.reason)}`);

  let climateOut = climateBase;
  if (weather.status === "fulfilled" && enso.status === "fulfilled") {
    climateOut = {
      ...climateBase,
      fetchedAt: new Date().toISOString(),
      weather: mergeByDate(climateBase.weather, weather.value),
      enso: enso.value.filter((p) => p.month >= "2020-01"),
    };
    status.climate = "live";
  } else {
    for (const r of [weather, enso]) if (r.status === "rejected") errors.push(`climate: ${String(r.reason)}`);
  }

  return { asOf: iso(new Date()), parcel: parcelId, status, errors, sentinelSeries: series, climate: climateOut };
}

export async function handlePreHarvestData(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    if (req.method && req.method !== "GET") {
      res.statusCode = 405;
      res.setHeader("Allow", "GET");
      res.end();
      return;
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    const requested = url.searchParams.get("parcel");
    // Never fall back to another parcel: data for the wrong field is worse than none.
    if (!requested || !Object.hasOwn(PARCELS, requested)) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "unknown parcel" }));
      return;
    }
    const parcelId = requested as ParcelId;
    const hit = cache.get(parcelId);
    if (!hit || Date.now() - hit.at > CACHE_MS) {
      cache.set(parcelId, { at: Date.now(), body: JSON.stringify(await buildLiveData(parcelId)) });
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
    res.end(cache.get(parcelId)!.body);
  } catch (err) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    console.error("pre-harvest-data error", (err as Error).message);
    res.end(JSON.stringify({ error: "Data unavailable" }));
  }
}
