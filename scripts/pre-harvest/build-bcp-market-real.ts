/**
 * Builds src/data/bcp/market-real.json: the real data behind the BCP workspace's
 * El Niño and price charts (and the El Niño class written in each file).
 *
 *  - Coastal El Niño: NOAA CPC OISST monthly Niño 1+2 anomaly (keyless), from 2025-01.
 *    The workspace reads it as ENFEN's 3-month coastal index (src/data/bcp/enso.ts).
 *  - Export prices: Hass avocado FOB by month (median and middle half of shipments),
 *    taken from src/data/pre-harvest/avocado-market.json, which build-market-data.ts
 *    builds from the customs export extracts. Refresh that file first for new months.
 *
 * Months after the dataset's cut-off are harmless: the workspace only reads months
 * before its cut-off date.
 *
 * Usage: npx tsx scripts/pre-harvest/build-bcp-market-real.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fetchEnso } from "../../server/pre-harvest/sources";

const ROOT = path.resolve(import.meta.dirname, "../..");
const FROM = "2025-01";

type MarketMonth = { month: string; shipments: number; p25: number; p50: number; p75: number };

async function main() {
  const enso = await fetchEnso();
  const months = enso.filter((p) => p.month >= FROM).map((p) => ({ month: p.month, anom: p.nino12 }));

  const market = JSON.parse(readFileSync(path.join(ROOT, "src/data/pre-harvest/avocado-market.json"), "utf8")) as {
    generatedAt: string;
    veritradeMonthly: MarketMonth[];
  };
  const fob = market.veritradeMonthly
    .filter((m) => m.month >= FROM)
    .map(({ month, shipments, p25, p50, p75 }) => ({ month, shipments, p25, p50, p75 }));

  const out = {
    nino12: {
      source: "NOAA CPC, OISST v2.1 monthly Niño 1+2 anomaly (°C, 1991-2020 base), sstoi.indices",
      fetchedAt: new Date().toISOString().slice(0, 10),
      months,
    },
    fob: {
      source: "Peru export customs declarations, Hass avocado HS 0804.40, shipment level: FOB USD / net kg by month",
      generatedAt: market.generatedAt,
      months: fob,
    },
  };
  const file = path.join(ROOT, "src/data/bcp/market-real.json");
  writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`);
  console.log(`El Niño ${months[0]?.month} to ${months.at(-1)?.month} · prices ${fob[0]?.month} to ${fob.at(-1)?.month} → ${path.relative(ROOT, file)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
