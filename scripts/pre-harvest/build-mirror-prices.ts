/**
 * Mirror export prices for months Peru did not report monthly to UN Comtrade
 * (May 2020 to Dec 2023): what Peru's three largest avocado markets (Spain,
 * Netherlands, United States) declared importing from Peru, HS 080440.
 *
 * Importers report CIF value, so the series is scaled to an FOB equivalent with the
 * ratio Peru FOB / mirror CIF over the months both exist (2024 onward).
 * Writes `mirrorMonthly` and `mirrorFobFactor` into src/data/pre-harvest/avocado-market.json.
 *
 * Usage: npx tsx scripts/pre-harvest/build-mirror-prices.ts [--from 2021-01] [--to 2025-04]
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const FILE = path.join(ROOT, "src/data/pre-harvest/avocado-market.json");
const REPORTERS = [
  { code: 724, name: "Spain" },
  { code: 528, name: "Netherlands" },
  { code: 842, name: "United States" },
];
const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const FROM = arg("--from", "2021-01");
const TO = arg("--to", "2025-04");

type Row = { month: string; reporters: Record<string, { kg: number; cifUsd: number }> };
const market = JSON.parse(readFileSync(FILE, "utf8"));
const existing: Row[] = market.mirrorRaw ?? [];
const byMonth = new Map(existing.map((r) => [r.month, r]));

const months: string[] = [];
for (let [y, m] = FROM.split("-").map(Number); `${y}-${String(m).padStart(2, "0")}` <= TO; m === 12 ? (y++, (m = 1)) : m++) {
  months.push(`${y}-${String(m).padStart(2, "0")}`);
}

async function fetchOne(reporter: number, month: string) {
  const url = `https://comtradeapi.un.org/public/v1/preview/C/M/HS?reporterCode=${reporter}&cmdCode=080440&flowCode=M&partnerCode=604&period=${month.replace("-", "")}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url);
      const json = JSON.parse(await res.text()) as { data?: Array<{ netWgt?: number; altQty?: number; primaryValue?: number; cifvalue?: number }> };
      if (Array.isArray(json.data)) {
        const r = json.data[0];
        if (!r) return null; // reported nothing (no trade that month, or not yet published)
        const kg = r.netWgt || r.altQty || 0;
        const cif = r.cifvalue || r.primaryValue || 0;
        return kg > 0 && cif > 0 ? { kg, cifUsd: cif } : null;
      }
    } catch {
      /* throttled: answer is not JSON */
    }
    await new Promise((r) => setTimeout(r, 8000 * (attempt + 1)));
  }
  throw new Error(`no answer for ${reporter} ${month}`);
}

for (const month of months) {
  const row = byMonth.get(month) ?? { month, reporters: {} };
  for (const rep of REPORTERS) {
    if (row.reporters[rep.name]) continue;
    try {
      const v = await fetchOne(rep.code, month);
      if (v) row.reporters[rep.name] = v;
    } catch (e) {
      console.warn(`\n${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 3500));
  }
  byMonth.set(month, row);
  process.stdout.write(`\r${month} ${Object.keys(row.reporters).join(", ")}        `);
}
process.stdout.write("\n");

const raw = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
// Only months where all three markets reported: the mix stays comparable.
const complete = raw.filter((r) => REPORTERS.every((rep) => r.reporters[rep.name]));
const cifPerKg = (r: Row) => {
  const v = Object.values(r.reporters);
  return v.reduce((s, x) => s + x.cifUsd, 0) / v.reduce((s, x) => s + x.kg, 0);
};
const peru = new Map<string, number>(market.comtradeMonthly.map((r: { month: string; usdPerKg: number }) => [r.month, r.usdPerKg]));
const overlap = complete.filter((r) => peru.has(r.month) && r.month >= "2024-01");
const ratios = overlap.map((r) => peru.get(r.month)! / cifPerKg(r)).sort((a, b) => a - b);
const factor = ratios.length ? ratios[Math.floor(ratios.length / 2)] : 0.9;
console.log(`FOB/CIF factor ${factor.toFixed(3)} from ${ratios.length} overlapping months`);

market.mirrorRaw = raw;
market.mirrorFobFactor = Math.round(factor * 1000) / 1000;
market.mirrorMonthly = complete.map((r) => {
  const v = Object.values(r.reporters);
  return {
    month: r.month,
    kg: Math.round(v.reduce((s, x) => s + x.kg, 0)),
    cifUsd: Math.round(v.reduce((s, x) => s + x.cifUsd, 0)),
    usdPerKg: Math.round(cifPerKg(r) * factor * 1000) / 1000,
  };
});
market.sources.mirror =
  "UN Comtrade public preview API: imports from Peru reported by Spain, Netherlands and United States (CIF), scaled to FOB";
writeFileSync(FILE, JSON.stringify(market, null, 1));
console.log(`mirrorMonthly: ${market.mirrorMonthly.length} complete months`);
