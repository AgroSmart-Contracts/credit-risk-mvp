/**
 * Builds public/pre-harvest/sentinel-villacuri.json: Sentinel-2 (10 m) imagery for
 * the seed parcel, from Earth Search (AWS Open Data, keyless).
 *   - series: parcel-mean NDVI for every mostly-clear scene since 2017 (baseline and VCI range)
 *   - scenes: true-colour + NDVI images, up to 2 clear scenes per month, campaign
 *     window and the last 90 days
 * Served as a static file and fetched on demand, so it is not in the JS bundle.
 *
 * Usage: npx tsx scripts/pre-harvest/build-sentinel-fixture.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { processScene, searchScenes } from "../../server/pre-harvest/sentinel";
import { PARCELS, type ParcelId } from "../../src/lib/pre-harvest/site";
import type { SentinelFixture, SentinelScene } from "../../src/lib/pre-harvest/types";

const ROOT = path.resolve(import.meta.dirname, "../..");
// Usage: npx tsx scripts/pre-harvest/build-sentinel-fixture.ts --parcel ica-0177
const arg = process.argv.indexOf("--parcel");
const parcelId = (arg > 0 ? process.argv[arg + 1] : "ica-0142") as ParcelId;
const PARCEL = PARCELS[parcelId];
if (!PARCEL) throw new Error(`Unknown parcel ${parcelId}`);
const OUT = path.join(ROOT, `public/pre-harvest/sentinel-${parcelId}.json`);
const CONCURRENCY = 6;
const SERIES_FROM = "2017-01-01";
// --gallery 2023-06-01:2024-08-31 picks the image window (default: last campaign to today).
const gArg = process.argv.indexOf("--gallery");
const GALLERY_WINDOWS: Array<[string, string]> =
  gArg > 0
    ? [process.argv[gArg + 1].split(":") as [string, string]]
    : [["2025-06-01", new Date().toISOString().slice(0, 10)]];
const MIN_CLEAR_SERIES = 80;
const MIN_CLEAR_GALLERY = 95;
const PER_MONTH = 2;

const today = new Date().toISOString().slice(0, 10);
const last90 = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
if (gArg < 0) GALLERY_WINDOWS.push([last90, today]);

async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < items.length) {
        const i = next++;
        try {
          // Retry transient network failures (COG range requests occasionally drop).
          let attempt = 0;
          for (;;) {
            try {
              out[i] = await fn(items[i], i);
              break;
            } catch (err) {
              if (++attempt >= 3) throw err;
              await new Promise((r) => setTimeout(r, 1500 * attempt));
            }
          }
        } catch (err) {
          console.warn(`\n  skip ${i}: ${(err as Error).message}`);
          out[i] = null as R;
        }
        done++;
        process.stdout.write(`\r  ${done}/${items.length}`);
      }
    }),
  );
  process.stdout.write("\n");
  return out;
}

const { lat, lon } = PARCEL.site;
console.log(`Searching scenes ${SERIES_FROM} → ${today}…`);
const items = await searchScenes(lon, lat, SERIES_FROM, today, 40);
console.log(`  ${items.length} scenes under 40% tile cloud`);

console.log("Parcel NDVI series…");
const seriesScenes = (await pool(items, CONCURRENCY, (it) => processScene(it, PARCEL.ring, { images: false }))).filter(
  (s): s is SentinelScene => !!s && s.ndviMean !== null && s.parcelClearPct >= MIN_CLEAR_SERIES,
);
console.log(`  ${seriesScenes.length} scenes with ≥ ${MIN_CLEAR_SERIES}% of the parcel clear`);

// Gallery: best (clearest, then least tile cloud) scenes per month inside the windows.
const inWindow = (d: string) => GALLERY_WINDOWS.some(([a, b]) => d >= a && d <= b);
const candidates = seriesScenes.filter((s) => inWindow(s.date) && s.parcelClearPct >= MIN_CLEAR_GALLERY);
const byMonth = new Map<string, SentinelScene[]>();
for (const s of candidates) {
  const m = s.date.slice(0, 7);
  (byMonth.get(m) ?? byMonth.set(m, []).get(m)!).push(s);
}
const chosenIds = new Set(
  [...byMonth.values()].flatMap((list) =>
    list
      .sort((a, b) => b.parcelClearPct - a.parcelClearPct || a.sceneCloudPct - b.sceneCloudPct)
      .slice(0, PER_MONTH)
      .map((s) => s.id),
  ),
);
const galleryItems = items.filter((it) => chosenIds.has(it.id));
console.log(`Gallery images for ${galleryItems.length} scenes…`);
const gallery = (await pool(galleryItems, CONCURRENCY, (it) => processScene(it, PARCEL.ring, { images: true, size: 64 }))).filter(
  (s): s is SentinelScene => !!s,
);

const fixture: SentinelFixture = {
  source: "Sentinel-2 L2A (10 m) via Earth Search, AWS Open Data; NDVI over clear pixels (SCL mask)",
  fetchedAt: new Date().toISOString(),
  parcel: PARCEL.ring,
  series: seriesScenes.map((s) => ({ date: s.date, ndviMean: s.ndviMean!, parcelClearPct: s.parcelClearPct, weakPct: s.weakPct })),
  scenes: gallery.sort((a, b) => a.date.localeCompare(b.date)),
};
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(fixture));
console.log(`Wrote ${path.relative(ROOT, OUT)}: ${fixture.series.length} series points, ${fixture.scenes.length} images`);

// The parcel NDVI series (small) also goes into the app bundle, so the crop panel can
// score on the 10 m parcel data synchronously; the images stay in public/ and load lazily.
const SERIES_OUT = path.join(ROOT, `src/data/pre-harvest/sentinel-series-${parcelId}.json`);
writeFileSync(
  SERIES_OUT,
  JSON.stringify({ source: fixture.source, fetchedAt: fixture.fetchedAt, parcel: fixture.parcel, series: fixture.series }),
);
console.log(`Wrote ${path.relative(ROOT, SERIES_OUT)}`);
