/**
 * Builds src/data/pre-harvest/avocado-market.json for the pre-harvest Market panel.
 *
 * Two sources, each used for what it is best at:
 *  - Veritrade (shipment-level Peru customs, Jan 2024 onward): the monthly FOB $/kg
 *    line the bank watches, with the shipment-price spread for each month.
 *  - UN Comtrade (national monthly totals, 2019 onward, keyless preview API):
 *    the 5+ year history that sets the seasonal P10/P25/P50 alert band.
 *
 * Usage: npx tsx scripts/pre-harvest/build-market-data.ts
 */
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
/** Peru export extracts kept locally in docs/ (git-ignored: licensed raw data). */
const VERITRADE_FILES = readdirSync(path.join(ROOT, "docs"))
  .filter((f) => /^Veritrade_.*_PE_E_\d+\.xls$/.test(f))
  .sort()
  .map((f) => `docs/${f}`);
if (VERITRADE_FILES.length === 0) throw new Error("No Peru export extracts (docs/Veritrade_*_PE_E_*.xls) found locally.");
const HS_PREFIX = "080440"; // Avocados, fresh or dried
const COMTRADE_START = { year: 2019, month: 1 };

type MonthStats = {
  month: string;
  shipments: number;
  kg: number;
  fobUsd: number;
  usdPerKg: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
};

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

async function readVeritrade(): Promise<MonthStats[]> {
  const seen = new Set<string>();
  const byMonth = new Map<string, { kg: number; fob: number; prices: number[] }>();

  for (const rel of VERITRADE_FILES) {
    const rl = createInterface({
      input: createReadStream(path.join(ROOT, rel), { encoding: "latin1" }),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      if (!line.startsWith(HS_PREFIX)) continue;
      const c = line.split("\t");
      const date = c[4];
      const kg = Number(c[9]);
      const fob = Number(c[14]);
      if (!/^\d{4}-\d{2}/.test(date) || !(kg > 0) || !(fob > 0)) continue;
      // The two extracts overlap in time; drop exact duplicate declarations.
      const key = `${c[3]}|${date}|${c[5]}|${kg}|${fob}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const price = fob / kg;
      if (price < 0.2 || price > 15) continue; // unit or keying errors
      const m = date.slice(0, 7);
      const acc = byMonth.get(m) ?? { kg: 0, fob: 0, prices: [] };
      acc.kg += kg;
      acc.fob += fob;
      acc.prices.push(price);
      byMonth.set(m, acc);
    }
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, v]) => v.prices.length >= 30) // partial trailing month
    .map(([month, v]) => {
      const s = v.prices.sort((a, b) => a - b);
      return {
        month,
        shipments: s.length,
        kg: Math.round(v.kg),
        fobUsd: Math.round(v.fob),
        usdPerKg: round(v.fob / v.kg),
        p10: round(quantile(s, 0.1)),
        p25: round(quantile(s, 0.25)),
        p50: round(quantile(s, 0.5)),
        p75: round(quantile(s, 0.75)),
        p90: round(quantile(s, 0.9)),
      };
    });
}

type ComtradeMonth = { month: string; kg: number; fobUsd: number; usdPerKg: number };

async function fetchComtrade(existing: ComtradeMonth[]): Promise<ComtradeMonth[]> {
  // Resume: keep months already fetched, only ask for the missing ones.
  const out: ComtradeMonth[] = [...existing];
  const have = new Set(existing.map((r) => r.month));
  const now = new Date();
  let { year, month } = COMTRADE_START;
  let emptyStreak = 0;
  while (year < now.getFullYear() || (year === now.getFullYear() && month <= now.getMonth() + 1)) {
    const period = `${year}${String(month).padStart(2, "0")}`;
    if (have.has(`${year}-${String(month).padStart(2, "0")}`)) {
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
      emptyStreak = 0;
      continue;
    }
    const url = `https://comtradeapi.un.org/public/v1/preview/C/M/HS?reporterCode=604&cmdCode=${HS_PREFIX}&flowCode=X&partnerCode=0&period=${period}`;
    try {
      // The keyless preview throttles silently: it answers with an empty data array
      // (or non-JSON). Retry empty answers with growing pauses before accepting them.
      let json: { count?: number; data?: Array<{ altQty?: number; altQtyUnitCode?: number; primaryValue?: number }> } = {};
      for (let attempt = 0; attempt < 4; attempt++) {
        const res = await fetch(url);
        const text = await res.text();
        try {
          json = JSON.parse(text);
        } catch {
          json = {};
        }
        if (res.ok && Array.isArray(json.data) && json.data.length > 0) break;
        await new Promise((r) => setTimeout(r, 8000 * (attempt + 1)));
      }
      const r = json.data?.[0];
      if (r && r.altQtyUnitCode === 8 && r.altQty && r.primaryValue) {
        out.push({
          month: `${year}-${String(month).padStart(2, "0")}`,
          kg: Math.round(r.altQty),
          fobUsd: Math.round(r.primaryValue),
          usdPerKg: round(r.primaryValue / r.altQty),
        });
        emptyStreak = 0;
      } else {
        emptyStreak++;
      }
    } catch (err) {
      console.warn(`Comtrade ${period} failed:`, (err as Error).message);
    }
    process.stdout.write(`\rComtrade ${period} (${out.length} months)`);
    // The keyless preview is rate limited; stay well under it.
    await new Promise((r) => setTimeout(r, 4000));
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
    // Two empty months in a row near the present = Peru reporting lag reached.
    if (emptyStreak >= 2 && year >= now.getFullYear() - 1) break;
  }
  process.stdout.write("\n");
  return out;
}

/** Seasonal band per calendar month from every year of Comtrade history. */
function seasonalBand(series: ComtradeMonth[]) {
  return Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, "0");
    const s = series
      .filter((r) => r.month.endsWith(`-${mm}`))
      .map((r) => r.usdPerKg)
      .sort((a, b) => a - b);
    return {
      calendarMonth: i + 1,
      years: s.length,
      p10: round(quantile(s, 0.1)),
      p25: round(quantile(s, 0.25)),
      p50: round(quantile(s, 0.5)),
      p75: round(quantile(s, 0.75)),
      p90: round(quantile(s, 0.9)),
    };
  });
}

const veritrade = await readVeritrade();
console.log(`Veritrade: ${veritrade.length} months (${veritrade[0]?.month} to ${veritrade.at(-1)?.month})`);
const outFile = path.join(ROOT, "src/data/pre-harvest/avocado-market.json");
const previous: ComtradeMonth[] = existsSync(outFile)
  ? (JSON.parse(readFileSync(outFile, "utf8")).comtradeMonthly ?? [])
  : [];
const comtrade = (await fetchComtrade(previous)).sort((a, b) => a.month.localeCompare(b.month));
console.log(`Comtrade: ${comtrade.length} months (${comtrade[0]?.month} to ${comtrade.at(-1)?.month})`);

const outDir = path.join(ROOT, "src/data/pre-harvest");
mkdirSync(outDir, { recursive: true });
writeFileSync(
  path.join(outDir, "avocado-market.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      hsCode: HS_PREFIX,
      sources: {
        veritrade: "Veritrade Peru export extracts (shipment level), FOB USD / net kg",
        comtrade: "UN Comtrade public preview API, Peru exports to World, monthly",
      },
      veritradeMonthly: veritrade,
      comtradeMonthly: comtrade,
      seasonalBand: seasonalBand(comtrade),
    },
    null,
    1,
  ),
);
console.log("Wrote src/data/pre-harvest/avocado-market.json");
