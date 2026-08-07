/**
 * Usual unit price for a product on a corridor in a shipment-start month.
 *
 * Lookup ladder (first hit wins):
 *   1. customs FOB P50 — same product × origin × destination × YYYY-MM (n ≥ 3)
 *   2. customs — same product × destination × YYYY-MM (origin dropped; Peru-engine
 *      corridors only make sense when origin is Peru anyway)
 *   3. customs — same product × destination × calendar month across years
 *      (seasonality when the deal's year is outside the customs window)
 *   4. platform sheet (docs/product-price-avg-with-spread-by-month-route-…) —
 *      product × origin × destination × month
 *   5. platform sheet with transport mode
 *   6. null → caller falls back to market-intel adaptive window or neutral
 *
 * Product risk uses this: a deal whose unit price is meaningfully above the
 * usual price for that month/route scores worse (higher product risk).
 */
import {
  PRODUCT_PRICE_MONTH_ROUTE_TABLE,
  type ProductPriceMonthRouteRow,
  type ProductPriceSource,
} from "./product-price-month-route-tables";

export type { ProductPriceMonthRouteRow, ProductPriceSource };

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

const EN_DEST_TO_CANON: Array<[RegExp, string]> = [
  [/brazil|brasil/i, "BRASIL"],
  [/russia|russian/i, "FEDERACION RUSA"],
  [/netherlands|holland|rotterdam|pa[ií]ses bajos/i, "PAISES BAJOS"],
  [/spain|espa[nñ]a/i, "ESPANA"],
  [/united states|usa\b|miami|los angeles/i, "ESTADOS UNIDOS"],
  [/israel/i, "ISRAEL"],
  [/thailand|tailandia/i, "TAILANDIA"],
  [/hong kong/i, "HONG KONG"],
  [/china|shanghai/i, "CHINA"],
  [/india/i, "INDIA"],
  [/canada|canad[aá]/i, "CANADA"],
  [/chile/i, "CHILE"],
  [/germany|alemania/i, "ALEMANIA"],
  [/united arab|emirates|dubai/i, "EMIRATOS ARABES UNIDOS"],
  [/taiwan|formosa|kaohsiung/i, "TAIWAN"],
  [/korea|corea/i, "COREA DEL SUR"],
  [/belgium|b[eé]lgica|antwerp/i, "BELGICA"],
  [/united kingdom|\buk\b|london/i, "REINO UNIDO"],
  [/france|francia/i, "FRANCIA"],
  [/mexico|m[eé]xico/i, "MEXICO"],
  [/japan|jap[oó]n/i, "JAPON"],
  [/malaysia|malasia/i, "MALASIA"],
  [/italy|italia/i, "ITALIA"],
  [/portugal/i, "PORTUGAL"],
  [/saudi|arabia saudita/i, "ARABIA SAUDITA"],
  [/turkey|turqu[ií]a/i, "TURQUIA"],
  [/panama|panam[aá]/i, "PANAMA"],
  [/peru/i, "PERU"],
  [/ecuador/i, "ECUADOR"],
];

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

export function productKeyFromLabel(label: string): string | null {
  for (const [re, key] of PRODUCT_KEY) {
    if (re.test(label)) return key;
  }
  return null;
}

export function countryKeyFromLocation(location: string): string | null {
  const text = location.trim();
  if (!text) return null;
  for (const [re, key] of EN_DEST_TO_CANON) {
    if (re.test(text)) return key;
  }
  const last = text.split(",").pop()?.trim();
  if (!last || last.length < 3) return null;
  return foldCountry(last);
}

export function shipmentMonthFromDate(isoOrEmpty: string | null | undefined): string | null {
  if (!isoOrEmpty) return null;
  const m = isoOrEmpty.match(/^(\d{4}-\d{2})/);
  return m ? m[1] : null;
}

export interface UsualPriceMatch {
  usualUsdPerKg: number;
  nObservations: number;
  source: ProductPriceSource;
  month: string;
  productKey: string;
  originCountry: string | null;
  destinationCountry: string | null;
  matchLevel:
    | "customs-origin-dest-month"
    | "customs-dest-month"
    | "customs-dest-calendar-month"
    | "sheet-origin-dest-month"
    | "sheet-mode-origin-dest-month";
  transportMode?: "air" | "sea" | null;
  /** Observed corridor min $/kg when the platform sheet has a spread. */
  minUsdPerKg?: number | null;
  /** Observed corridor max $/kg when the platform sheet has a spread. */
  maxUsdPerKg?: number | null;
  spreadPct?: number | null;
  priceRangeDisplay?: string | null;
}

function calendarMonth(ym: string): string {
  return ym.slice(5, 7);
}

function pickBest(candidates: ProductPriceMonthRouteRow[]): ProductPriceMonthRouteRow | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    if (b.nObservations !== a.nObservations) return b.nObservations - a.nObservations;
    return b.usualUsdPerKg - a.usualUsdPerKg;
  })[0];
}

function matchFromRow(
  hit: ProductPriceMonthRouteRow,
  meta: {
    productKey: string;
    originCountry: string | null;
    destinationCountry: string | null;
    matchLevel: UsualPriceMatch["matchLevel"];
  },
): UsualPriceMatch {
  return {
    usualUsdPerKg: hit.usualUsdPerKg,
    nObservations: hit.nObservations,
    source: hit.source,
    month: hit.month,
    productKey: meta.productKey,
    originCountry: meta.originCountry,
    destinationCountry: meta.destinationCountry,
    matchLevel: meta.matchLevel,
    transportMode: hit.transportMode ?? null,
    minUsdPerKg: hit.minUsdPerKg ?? null,
    maxUsdPerKg: hit.maxUsdPerKg ?? null,
    spreadPct: hit.spreadPct ?? null,
    priceRangeDisplay: hit.priceRangeDisplay ?? null,
  };
}

export function lookupUsualUnitPrice(args: {
  product: string;
  origin: string;
  destination: string;
  shipmentMonth: string | null;
  transportMode?: "air" | "sea" | null;
}): UsualPriceMatch | null {
  const productKey = productKeyFromLabel(args.product);
  const originCountry = countryKeyFromLocation(args.origin);
  const destinationCountry = countryKeyFromLocation(args.destination);
  const month = args.shipmentMonth;
  if (!productKey || !destinationCountry || !month) return null;

  const customs = PRODUCT_PRICE_MONTH_ROUTE_TABLE.filter(
    (r) => r.source === "customs" && r.productKey === productKey,
  );
  const sheets = PRODUCT_PRICE_MONTH_ROUTE_TABLE.filter(
    (r) => r.source === "platform-sheet" && r.productKey === productKey,
  );
  const modes = PRODUCT_PRICE_MONTH_ROUTE_TABLE.filter(
    (r) => r.source === "platform-sheet-mode" && r.productKey === productKey,
  );

  // 1. customs origin × dest × month (n ≥ 3)
  if (originCountry) {
    const hit = pickBest(
      customs.filter(
        (r) =>
          r.originCountry === originCountry &&
          r.destinationCountry === destinationCountry &&
          r.month === month &&
          r.nObservations >= 3,
      ),
    );
    if (hit) {
      return matchFromRow(hit, {
        productKey,
        originCountry,
        destinationCountry,
        matchLevel: "customs-origin-dest-month",
      });
    }
  }

  // 2. customs dest × month (Peru-origin engine; n ≥ 3)
  {
    const hit = pickBest(
      customs.filter(
        (r) =>
          r.destinationCountry === destinationCountry &&
          r.month === month &&
          r.nObservations >= 3,
      ),
    );
    if (hit) {
      return matchFromRow(hit, {
        productKey,
        originCountry,
        destinationCountry,
        matchLevel: "customs-dest-month",
      });
    }
  }

  // 3. platform avg sheet — origin × dest × month
  // Prefers exact platform corridor-month peers over cross-year customs
  // seasonality (many platform deals ship in 2024; customs window is 2025).
  if (originCountry) {
    const hit = pickBest(
      sheets.filter(
        (r) =>
          r.originCountry === originCountry &&
          r.destinationCountry === destinationCountry &&
          r.month === month,
      ),
    );
    if (hit) {
      return matchFromRow(hit, {
        productKey,
        originCountry,
        destinationCountry,
        matchLevel: "sheet-origin-dest-month",
      });
    }
  }

  // 4. platform mode sheet — prefer matching transport when known
  if (originCountry) {
    const modePool = modes.filter(
      (r) =>
        r.originCountry === originCountry &&
        r.destinationCountry === destinationCountry &&
        r.month === month,
    );
    const preferred =
      args.transportMode != null
        ? pickBest(modePool.filter((r) => r.transportMode === args.transportMode))
        : null;
    const hit = preferred ?? pickBest(modePool);
    if (hit) {
      return matchFromRow(hit, {
        productKey,
        originCountry,
        destinationCountry,
        matchLevel: "sheet-mode-origin-dest-month",
      });
    }
  }

  // 5. customs dest × same calendar month any year (seasonality)
  {
    const mm = calendarMonth(month);
    const hit = pickBest(
      customs.filter(
        (r) =>
          r.destinationCountry === destinationCountry &&
          calendarMonth(r.month) === mm &&
          r.nObservations >= 3,
      ),
    );
    if (hit) {
      return matchFromRow(hit, {
        productKey,
        originCountry,
        destinationCountry,
        matchLevel: "customs-dest-calendar-month",
      });
    }
  }

  return null;
}
