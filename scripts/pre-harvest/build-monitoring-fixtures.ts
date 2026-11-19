/**
 * Builds the cached monitoring fixtures for the seed deal (Villacurí, Ica):
 *   src/data/pre-harvest/ndvi-villacuri.json    NASA MODIS NDVI, 2003 onward
 *   src/data/pre-harvest/climate-villacuri.json Open-Meteo weather and ET0, NOAA Niño 1+2 / 3.4
 *
 * The app uses these when the live sources are slow or unreachable.
 * Usage: npx tsx scripts/pre-harvest/build-monitoring-fixtures.ts [--climate-only]
 *        npx tsx scripts/pre-harvest/build-monitoring-fixtures.ts --region chavimochic
 *        (climate only, for another region: weather at that region's parcel)
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  buildClimateFixture,
  buildNdviFixture,
  fetchEnso,
  fetchWeather,
} from "../../server/pre-harvest/sources";
import { PARCELS, SEED_SITE } from "../../src/lib/pre-harvest/site";

const REGIONS = { villacuri: { site: SEED_SITE, recentFrom: "2024-01-01" }, chavimochic: { site: PARCELS["viru-0311"].site, recentFrom: "2022-06-01" } };
const rArg = process.argv.indexOf("--region");
const region = (rArg > 0 ? process.argv[rArg + 1] : "villacuri") as keyof typeof REGIONS;
if (!REGIONS[region]) throw new Error(`Unknown region ${region}`);

const ROOT = path.resolve(import.meta.dirname, "../..");
const outDir = path.join(ROOT, "src/data/pre-harvest");
mkdirSync(outDir, { recursive: true });

const today = new Date();
const { lat, lon } = REGIONS[region].site;
const climateOnly = process.argv.includes("--climate-only") || region !== "villacuri";

if (!climateOnly || !existsSync(path.join(outDir, "ndvi-villacuri.json"))) {
  console.log("NDVI (MODIS) 2003 onward…");
  const ndvi = await buildNdviFixture(lat, lon, new Date("2003-01-01"), today);
  writeFileSync(path.join(outDir, "ndvi-villacuri.json"), JSON.stringify(ndvi, null, 1));
  console.log(`  ${ndvi.series.length} composites`);
}

console.log("Weather (Open-Meteo ERA5) 1995 onward…");
const history = await fetchWeather(lat, lon, new Date("1995-01-01"), today);
console.log(`  ${history.length} days`);

console.log("ENSO (NOAA CPC Niño 1+2 / 3.4)…");
const enso = await fetchEnso();
console.log(`  ${enso.length} months, last ${enso.at(-1)?.month}`);

const climate = buildClimateFixture({ lat, lon, history, recentFrom: REGIONS[region].recentFrom, enso });
writeFileSync(path.join(outDir, `climate-${region}.json`), JSON.stringify(climate));
console.log(`Wrote climate-${region}.json`);
