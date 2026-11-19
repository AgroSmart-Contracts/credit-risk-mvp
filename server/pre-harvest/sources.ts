/**
 * Free, keyless data sources for the pre-harvest monitoring panels.
 * Shared by the server route (live refresh) and scripts/pre-harvest (fixtures),
 * so live data and cached fixtures always have the same shape.
 *
 *  - NASA MODIS MOD13Q1 NDVI (250 m, 16-day, 2000 onward) via the ORNL DAAC REST API
 *  - Open-Meteo ERA5 archive + forecast (daily weather, incl. reference evapotranspiration)
 *  - NOAA CPC monthly SST indices: Niño 1+2 (coastal El Niño, basis of ENFEN's ICEN) and Niño 3.4
 */
import type {
  ClimateFixture,
  EnsoPoint,
  NdviFixture,
  NdviPoint,
  WeatherDay,
} from "../../src/lib/pre-harvest/types.js";

const TIMEOUT_MS = 45_000;

async function getJson<T>(url: string, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
      return (await res.json()) as T;
    } catch (err) {
      last = err;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw last;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

// ---------------------------------------------------------------------------
// NDVI — MODIS MOD13Q1 via ORNL DAAC (max 10 composites per request)
// ---------------------------------------------------------------------------

type ModisSubset = {
  subset: Array<{ modis_date: string; calendar_date: string; band: string; data: number[] }>;
};

function modisDate(d: Date): string {
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  const doy = Math.floor((d.getTime() - start) / 86_400_000) + 1;
  return `A${d.getUTCFullYear()}${String(doy).padStart(3, "0")}`;
}

async function modisBand(lat: number, lon: number, band: string, from: Date, to: Date) {
  const dates = await getJson<{ dates: Array<{ modis_date: string; calendar_date: string }> }>(
    `https://modis.ornl.gov/rst/api/v1/MOD13Q1/dates?latitude=${lat}&longitude=${lon}`,
  );
  const wanted = dates.dates.filter(
    (d) => d.calendar_date >= iso(from) && d.calendar_date <= iso(to),
  );
  const out = new Map<string, number>();
  for (let i = 0; i < wanted.length; i += 10) {
    const chunk = wanted.slice(i, i + 10);
    const url =
      `https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset?latitude=${lat}&longitude=${lon}` +
      `&band=${band}&startDate=${chunk[0].modis_date}&endDate=${chunk.at(-1)!.modis_date}` +
      `&kmAboveBelow=0&kmLeftRight=0`;
    const json = await getJson<ModisSubset>(url);
    for (const s of json.subset) out.set(s.calendar_date, s.data[0]);
  }
  return out;
}

/** NDVI composites for one point. Cloudy / unreliable composites are dropped. */
export async function fetchNdvi(lat: number, lon: number, from: Date, to: Date): Promise<NdviPoint[]> {
  const [ndvi, reliability] = await Promise.all([
    modisBand(lat, lon, "250m_16_days_NDVI", from, to),
    modisBand(lat, lon, "250m_16_days_pixel_reliability", from, to),
  ]);
  return [...ndvi.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    // MOD13Q1 reliability: 0 good, 1 marginal, 2 snow/ice, 3 cloudy, -1 no data
    .filter(([date, v]) => v > -3000 && (reliability.get(date) ?? 0) <= 1)
    .map(([date, v]) => ({ date, ndvi: round(v / 10_000) }));
}

export async function buildNdviFixture(lat: number, lon: number, from: Date, to: Date): Promise<NdviFixture> {
  return {
    source: "NASA MODIS MOD13Q1 (250 m, 16-day) via ORNL DAAC",
    lat,
    lon,
    fetchedAt: new Date().toISOString(),
    series: await fetchNdvi(lat, lon, from, to),
  };
}

// keep modisDate exported for tests / scripts that build date windows
export { modisDate };

// ---------------------------------------------------------------------------
// Weather — Open-Meteo archive (ERA5) + forecast, Flood API
// ---------------------------------------------------------------------------

const DAILY = [
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_sum",
  "relative_humidity_2m_mean",
  "et0_fao_evapotranspiration",
] as const;

type OpenMeteoDaily = { daily: Record<(typeof DAILY)[number] | "time", Array<number | string | null>> };

function toWeatherDays(json: OpenMeteoDaily): WeatherDay[] {
  const d = json.daily;
  return (d.time as string[]).map((date, i) => ({
    date,
    tmax: d.temperature_2m_max[i] as number | null,
    tmin: d.temperature_2m_min[i] as number | null,
    precip: d.precipitation_sum[i] as number | null,
    rh: d.relative_humidity_2m_mean[i] as number | null,
    et0: d.et0_fao_evapotranspiration[i] as number | null,
  }));
}

export async function fetchWeather(lat: number, lon: number, from: Date, to: Date): Promise<WeatherDay[]> {
  const archive = await getJson<OpenMeteoDaily>(
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
      `&start_date=${iso(from)}&end_date=${iso(to)}&daily=${DAILY.join(",")}&timezone=America%2FLima`,
  );
  return toWeatherDays(archive).filter((d) => d.tmax !== null);
}

// ---------------------------------------------------------------------------
// ENSO: NOAA CPC monthly OISST indices (Niño 1+2 and Niño 3.4 anomalies)
// ---------------------------------------------------------------------------

export function parseSstIndices(text: string): EnsoPoint[] {
  // Columns: YR MON NINO1+2 ANOM NINO3 ANOM NINO4 ANOM NINO3.4 ANOM
  return text
    .split("\n")
    .map((l) => l.trim().split(/\s+/))
    .filter((c) => c.length >= 10 && /^\d{4}$/.test(c[0]))
    .map((c) => ({
      month: `${c[0]}-${c[1].padStart(2, "0")}`,
      nino12: Number(c[3]),
      nino34: Number(c[9]),
    }))
    .filter((p) => Number.isFinite(p.nino12) && Number.isFinite(p.nino34));
}

export async function fetchEnso(): Promise<EnsoPoint[]> {
  const res = await fetch("https://www.cpc.ncep.noaa.gov/data/indices/sstoi.indices", {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`SST indices ${res.status}`);
  return parseSstIndices(await res.text());
}

// ---------------------------------------------------------------------------
// Climatology (built once, used for z-scores and seasonal medians)
// ---------------------------------------------------------------------------

/** Day-of-year key that ignores leap days so every year lines up. */
export function doyKey(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const t = Date.UTC(2001, m - 1, Math.min(d, m === 2 ? 28 : d)); // 2001 is not a leap year
  void y;
  return Math.floor((t - Date.UTC(2001, 0, 1)) / 86_400_000) + 1;
}

/** Mean / std of the trailing 30-day precipitation sum for each day of year. */
export function precipClimatology(days: WeatherDay[]) {
  const sums = new Map<number, number[]>();
  for (let i = 29; i < days.length; i++) {
    let s = 0;
    for (let k = i - 29; k <= i; k++) s += days[k].precip ?? 0;
    const key = doyKey(days[i].date);
    (sums.get(key) ?? sums.set(key, []).get(key)!).push(s);
  }
  return Array.from({ length: 365 }, (_, i) => {
    const v = sums.get(i + 1) ?? [0];
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const std = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
    return { doy: i + 1, mean30: round(mean, 2), std30: round(std, 2) };
  });
}

/** Mean trailing 30-day reference evapotranspiration for each day of year (normal water demand). */
export function et0Climatology(days: WeatherDay[]) {
  const sums = new Map<number, number[]>();
  for (let i = 29; i < days.length; i++) {
    let s = 0;
    for (let k = i - 29; k <= i; k++) s += days[k].et0 ?? 0;
    const key = doyKey(days[i].date);
    (sums.get(key) ?? sums.set(key, []).get(key)!).push(s);
  }
  return Array.from({ length: 365 }, (_, i) => {
    const v = sums.get(i + 1) ?? [0];
    return { doy: i + 1, mean30: round(v.reduce((a, b) => a + b, 0) / v.length, 1) };
  });
}

export function buildClimateFixture(args: {
  lat: number;
  lon: number;
  history: WeatherDay[];
  recentFrom: string;
  enso: EnsoPoint[];
}): ClimateFixture {
  return {
    source: "Open-Meteo ERA5 archive; NOAA CPC OISST indices (Niño 1+2, Niño 3.4)",
    lat: args.lat,
    lon: args.lon,
    fetchedAt: new Date().toISOString(),
    weather: args.history.filter((d) => d.date >= args.recentFrom),
    precipClimatology: precipClimatology(args.history),
    et0Climatology: et0Climatology(args.history),
    enso: args.enso.filter((p) => p.month >= "2020-01"),
  };
}
