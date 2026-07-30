/**
 * Build product × origin × destination × month "usual price" table.
 *
 * Sources (priority order used at score time):
 *   1. Peru customs FOB kg-weighted P50 — src/data/product-price-month-route-customs.json
 *      (regenerate with the Python snippet in this file's docstring / npm-less one-liner)
 *   2. docs/product-price-avg-with-spread-by-month-route-2026-07-28.csv
 *   3. docs/product-price-with-transport-mode-2026-07-29.csv (same keys + transportMode)
 *
 * Emits src/lib/product-price-month-route-tables.ts for runtime scoring.
 *
 * Refresh customs JSON:
 *   python3 - <<'PY'
 *   # see scripts/build-product-price-month-route-table.ts companion — or re-run
 *   # the export block previously used to write product-price-month-route-customs.json
 *   PY
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsvRecords } from "./lib/csv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DOCS = join(ROOT, "docs");
const DATA = join(ROOT, "src", "data");
const OUT = join(ROOT, "src", "lib", "product-price-month-route-tables.ts");

export interface ProductPriceMonthRouteRow {
  productKey: string;
  originCountry: string;
  destinationCountry: string;
  month: string; // YYYY-MM
  usualUsdPerKg: number;
  nObservations: number;
  source: "customs" | "platform-sheet" | "platform-sheet-mode";
  transportMode?: "air" | "sea" | null;
  /** Observed min/max $/kg from platform sheet (safe/observed range). */
  minUsdPerKg?: number | null;
  maxUsdPerKg?: number | null;
  spreadPct?: number | null;
  priceRangeDisplay?: string | null;
}

function foldCountry(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\{[^}]*\}/g, "")
    .replace(/,\s*(PROVINCIA DE CHINA|FEDERACION)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^RUSIA$/, "FEDERACION RUSA");
}

/** Sheet / deal product labels → canonical product key used in lookups. */
const PRODUCT_KEY: Array<[RegExp, string]> = [
  [/blueberr|arándano|arandano/i, "BLUEBERRY"],
  [/avocado|palta/i, "AVOCADO"],
  [/mango/i, "MANGO"],
  [/strawberr|fresa/i, "STRAWBERRY"],
  [/ginger|jengibre/i, "GINGER"],
  [/mandarin|mandarina|citrus|murcott/i, "MANDARIN"],
  [/asparagus|espárrago|esparrago/i, "ASPARAGUS"],
  [/grape|uva/i, "GRAPE"],
  [/mixed berries|tropical/i, "MIXED_BERRIES"],
  [/coffee|café|cafe/i, "COFFEE"],
];

export function productKeyFromLabel(label: string): string | null {
  for (const [re, key] of PRODUCT_KEY) {
    if (re.test(label)) return key;
  }
  return null;
}

const EN_DEST_TO_CANON: Array<[RegExp, string]> = [
  [/brazil|brasil/i, "BRASIL"],
  [/russia|russian/i, "FEDERACION RUSA"],
  [/netherlands|holland/i, "PAISES BAJOS"],
  [/spain/i, "ESPANA"],
  [/united states|usa\b/i, "ESTADOS UNIDOS"],
  [/israel/i, "ISRAEL"],
  [/thailand/i, "TAILANDIA"],
  [/hong kong/i, "HONG KONG"],
  [/china/i, "CHINA"],
  [/india/i, "INDIA"],
  [/canada/i, "CANADA"],
  [/chile/i, "CHILE"],
  [/germany/i, "ALEMANIA"],
  [/united arab|emirates|dubai/i, "EMIRATOS ARABES UNIDOS"],
  [/taiwan/i, "TAIWAN"],
  [/korea/i, "COREA DEL SUR"],
  [/belgium/i, "BELGICA"],
  [/united kingdom|\buk\b/i, "REINO UNIDO"],
  [/france/i, "FRANCIA"],
  [/mexico/i, "MEXICO"],
  [/japan/i, "JAPON"],
  [/malaysia/i, "MALASIA"],
  [/italy/i, "ITALIA"],
  [/portugal/i, "PORTUGAL"],
  [/saudi/i, "ARABIA SAUDITA"],
  [/turkey/i, "TURQUIA"],
  [/panama/i, "PANAMA"],
  [/peru/i, "PERU"],
  [/ecuador/i, "ECUADOR"],
];

function countryKey(label: string): string {
  for (const [re, key] of EN_DEST_TO_CANON) {
    if (re.test(label)) return key;
  }
  return foldCountry(label);
}

function transportFromSheet(raw: string): "air" | "sea" | null {
  if (/air/i.test(raw)) return "air";
  if (/sea/i.test(raw)) return "sea";
  return null;
}

function main() {
  const rows: ProductPriceMonthRouteRow[] = [];

  const customs = JSON.parse(
    readFileSync(join(DATA, "product-price-month-route-customs.json"), "utf-8"),
  ) as Array<{
    variety: string;
    originCountry: string;
    destinationCountry: string;
    month: string;
    nShipments: number;
    p50UsdPerKg: number;
  }>;

  for (const c of customs) {
    if (!(c.nShipments >= 1) || !(c.p50UsdPerKg > 0)) continue;
    rows.push({
      productKey: c.variety,
      originCountry: foldCountry(c.originCountry),
      destinationCountry: foldCountry(c.destinationCountry),
      month: c.month,
      usualUsdPerKg: c.p50UsdPerKg,
      nObservations: c.nShipments,
      source: "customs",
    });
  }

  const avgCsv = parseCsvRecords(
    readFileSync(join(DOCS, "product-price-avg-with-spread-by-month-route-2026-07-28.csv"), "utf-8"),
  );
  for (const r of avgCsv) {
    const productKey = productKeyFromLabel(r.product ?? "");
    const usual = Number(r.weightedAvgPrice);
    if (!productKey || !(usual > 0) || !r.month) continue;
    const min = Number(r.minPrice);
    const max = Number(r.maxPrice);
    const spread = Number(String(r.spreadPct ?? "").replace(/%.*/, ""));
    rows.push({
      productKey,
      originCountry: countryKey(r.origin ?? ""),
      destinationCountry: countryKey(r.destination ?? ""),
      month: r.month,
      usualUsdPerKg: usual,
      nObservations: Number(r.n_deals) || 1,
      source: "platform-sheet",
      minUsdPerKg: Number.isFinite(min) && min > 0 ? min : null,
      maxUsdPerKg: Number.isFinite(max) && max > 0 ? max : null,
      spreadPct: Number.isFinite(spread) ? spread : null,
      priceRangeDisplay: r.priceRangeDisplay?.trim() || null,
    });
  }

  const modeCsv = parseCsvRecords(
    readFileSync(join(DOCS, "product-price-with-transport-mode-2026-07-29.csv"), "utf-8"),
  );
  for (const r of modeCsv) {
    const productKey = productKeyFromLabel(r.product ?? "");
    const usual = Number(r.weightedAvgPrice);
    if (!productKey || !(usual > 0) || !r.month) continue;
    const min = Number(r.minPrice);
    const max = Number(r.maxPrice);
    const spread = Number(String(r.spreadPct ?? "").replace(/%.*/, ""));
    rows.push({
      productKey,
      originCountry: countryKey(r.origin ?? ""),
      destinationCountry: countryKey(r.destination ?? ""),
      month: r.month,
      usualUsdPerKg: usual,
      nObservations: Number(r.n_deals) || 1,
      source: "platform-sheet-mode",
      transportMode: transportFromSheet(r.transportMode ?? ""),
      minUsdPerKg: Number.isFinite(min) && min > 0 ? min : null,
      maxUsdPerKg: Number.isFinite(max) && max > 0 ? max : null,
      spreadPct: Number.isFinite(spread) ? spread : null,
      priceRangeDisplay: r.priceRangeDisplay?.trim() || null,
    });
  }

  const jsonPath = join(DATA, "product-price-month-route-table.json");
  writeFileSync(jsonPath, JSON.stringify(rows));

  const body = `/** Auto-generated by scripts/build-product-price-month-route-table.ts — do not edit by hand. */
import tableJson from "../data/product-price-month-route-table.json";

export type ProductPriceSource = "customs" | "platform-sheet" | "platform-sheet-mode";

export interface ProductPriceMonthRouteRow {
  productKey: string;
  originCountry: string;
  destinationCountry: string;
  month: string;
  usualUsdPerKg: number;
  nObservations: number;
  source: ProductPriceSource;
  transportMode?: "air" | "sea" | null;
  minUsdPerKg?: number | null;
  maxUsdPerKg?: number | null;
  spreadPct?: number | null;
  priceRangeDisplay?: string | null;
}

export const PRODUCT_PRICE_MONTH_ROUTE_TABLE = tableJson as ProductPriceMonthRouteRow[];
`;

  writeFileSync(OUT, body);
  const bySource = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.source] = (acc[r.source] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Wrote ${rows.length} price rows → ${jsonPath}`);
  console.log(`Wrote loader → ${OUT}`);
  console.log("  by source:", bySource);
}

main();
