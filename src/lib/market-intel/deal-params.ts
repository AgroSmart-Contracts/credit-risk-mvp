import type { Deal } from "../../types";
import type { MarketIntelRateRequest } from "./types";

/**
 * Deal destination → the customs table's Spanish country label. Values are
 * written in the accent-free form that `canonical_country()` in
 * docs/market-intel-peru-2025-2026-07-10/src/analysis.py folds both sides of
 * the comparison to, so "ESPANA" here reaches both ESPANA and ESPAÑA rows.
 *
 * Hong Kong is matched before China so "Hong Kong" doesn't fall through to the
 * mainland CHINA lane (they are separate rows in the customs data, and Hong
 * Kong is a transshipment hub with its own price level).
 *
 * The 2026-07-30 additions (UAE, Taiwan, Brazil, Russia, Korea, Belgium and
 * the rest) closed 57 of 169 platform deals that previously resolved to a
 * destination string absent from the customs table and so silently fell all
 * the way through to the variety-only benchmark — Dubai alone was 31 deals.
 */
const DESTINATION_TO_CUSTOMS: Array<[RegExp, string]> = [
  [/colombia/i, "COLOMBIA"],
  [/taiwan|formosa|kaohsiung/i, "TAIWAN"],
  [/netherlands|rotterdam|holland|países bajos|paises bajos/i, "PAISES BAJOS"],
  [/germany|alemania|hamburg/i, "ALEMANIA"],
  [/spain|españa|espana/i, "ESPANA"],
  [/united states|usa|miami|los angeles/i, "ESTADOS UNIDOS"],
  [/israel/i, "ISRAEL"],
  [/thailand|tailandia/i, "TAILANDIA"],
  [/hong kong/i, "HONG KONG"],
  [/china|shanghai/i, "CHINA"],
  [/uk|united kingdom|london/i, "REINO UNIDO"],
  [/france|francia/i, "FRANCIA"],
  [/mexico|méxico/i, "MEXICO"],
  [/canada|canadá/i, "CANADA"],
  [/united arab emirates|dubai|abu dhabi/i, "EMIRATOS ARABES UNIDOS"],
  [/brazil|brasil|guarulhos|santos/i, "BRASIL"],
  [/russia|russian federation|st petersburg|moscow/i, "FEDERACION RUSA"],
  [/korea|corea/i, "COREA DEL SUR"],
  [/belgium|bélgica|belgica|antwerp/i, "BELGICA"],
  [/india|nhava sheva|mumbai/i, "INDIA"],
  [/japan|japón|japon|tokyo|yokohama/i, "JAPON"],
  [/malaysia|malasia|port klang/i, "MALASIA"],
  [/italy|italia/i, "ITALIA"],
  [/portugal|lisbon/i, "PORTUGAL"],
  [/saudi|arabia saudita|jeddah/i, "ARABIA SAUDITA"],
  [/turkey|turquía|turquia|istanbul/i, "TURQUIA"],
  [/panama|panamá/i, "PANAMA"],
  [/chile|san antonio|valparaiso/i, "CHILE"],
];

const PRODUCT_TO_VARIETY: Array<[RegExp, string]> = [
  [/mandarin|citrus|murcott|tangerine/i, "MANDARIN"],
  [/blueberr/i, "BLUEBERRY"],
  [/avocado|palta/i, "AVOCADO"],
  [/strawberr|fresa/i, "STRAWBERRY"],
  [/grape|uva/i, "GRAPE"],
  [/mango/i, "MANGO"],
  [/asparagus|espárrago|esparrago/i, "ASPARAGUS"],
  [/ginger|jengibre/i, "GINGER"],
  [/coffee|café|cafe/i, "COFFEE"],
  [/cacao|cocoa/i, "CACAO"],
];

function normalizeRuc(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 ? digits : null;
}

/** Accent-free uppercase, matching `canonical_country()` on the Python side. */
function foldCountry(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

export function customsDestinationCountry(destination: string): string | null {
  for (const [pattern, country] of DESTINATION_TO_CUSTOMS) {
    if (pattern.test(destination)) return country;
  }
  const last = destination.split(",").pop()?.trim();
  if (last) {
    const folded = foldCountry(last);
    if (folded.length >= 3) return folded;
  }
  return null;
}

/**
 * Origin country, as the trailing segment of the deal's "Port, Country"
 * origin string. The customs engine holds Peru exports only, so this is a
 * guard rather than a lookup key: `build_payload` suppresses the price
 * benchmark and route intelligence for any other origin instead of pricing
 * the deal off Peru's corridor percentiles (8 Chile + 2 Ecuador deals in the
 * current book).
 */
export function customsOriginCountry(origin: string): string | null {
  const last = origin.split(",").pop()?.trim();
  if (!last) return null;
  const folded = foldCountry(last);
  return folded.length >= 3 ? folded : null;
}

export function customsVariety(product: string, variety?: string): string | null {
  const text = `${product} ${variety ?? ""}`;
  for (const [pattern, v] of PRODUCT_TO_VARIETY) {
    if (pattern.test(text)) return v;
  }
  return null;
}

/** Narrowed from `Deal` so the batch build pipeline (which works with `PlatformDealRecord`, not `Deal`) can reuse these without constructing a full Deal object — both shapes carry `quantityLabel`/`dealValueUSD`. */
type DealQuantityFields = { quantityLabel: string; dealValueUSD: number };

function unitToKg(value: number, unit: string): number | null {
  if (!Number.isFinite(value)) return null;
  switch (unit.toLowerCase()) {
    case "kg":
      return value;
    case "g":
      return value / 1000;
    case "lb":
      return value * 0.453592;
    case "oz":
      return value * 0.0283495;
    default:
      return null;
  }
}

/**
 * Per-unit weight parsed from the source CSV's free-text `presentation`
 * column (e.g. "CARTON X 1.5KG" → 1.5, "CAJAS DE 10 KG" → 10,
 * "Carton x 30 lb." → 13.6). Some presentations are themselves a nested
 * "N x M<unit>" pack description with no larger unit named (e.g. "12 x 6oz" =
 * 12 packs of 6oz = 72oz total) — checked first, but only when it's the
 * *entire* string, since the same "N x M<unit>" shape can also appear as a
 * parenthetical sub-breakdown of an already-stated outer weight (e.g.
 * "CARTON X 10KG (22 x 450g Bunches)", where 10KG is the real per-carton
 * total and the 22×450g is just how it's arranged inside, not an extra
 * multiplier).
 */
function parsePerUnitKg(text: string): number | null {
  const whole = text.trim();
  const nested = whole.match(/^(\d+)\s*x\s*([\d.]+)\s*(kg|g|lb|oz)$/i);
  if (nested) {
    const n = Number(nested[1]);
    const perPack = unitToKg(Number(nested[2]), nested[3]);
    if (Number.isFinite(n) && perPack !== null) return n * perPack;
  }
  const single = text.match(/([\d.]+)\s*(kg|g|lb|oz)\b/i);
  if (single) return unitToKg(Number(single[1]), single[2]);
  return null;
}

export function parseDealKg(deal: DealQuantityFields): number | null {
  const label = deal.quantityLabel;

  // Platform CSV convention (see scripts/build-platform-deals.ts): quantityLabel
  // is "<count> x <presentation>", where `count` is the number of packing
  // units (cartons/boxes/bags) and `presentation` is the source CSV's raw
  // per-unit weight description — total kg = count × per-unit kg. Confirmed
  // against real DUA customs records (e.g. 1,200 × "CARTON X 1.5KG" = 1,800kg,
  // matching that deal's own customs narrative exactly).
  const countMatch = label.match(/^([\d,]+(?:\.\d+)?)\s*x\s*(.+)$/i);
  if (countMatch) {
    const count = Number(countMatch[1].replace(/,/g, ""));
    const perUnitKg = parsePerUnitKg(countMatch[2]);
    if (Number.isFinite(count) && count > 0 && perUnitKg !== null && perUnitKg > 0) {
      return count * perUnitKg;
    }
  }

  // Manual/sample-deal convention (Assess Deal wizard / src/data/deals.ts):
  // a single already-total-kg figure, e.g. "4,000 kg net (~2,667 cartons)".
  const kgMatch = label.match(/([\d,]+(?:\.\d+)?)\s*kg/i);
  if (kgMatch) {
    const kg = Number(kgMatch[1].replace(/,/g, ""));
    if (Number.isFinite(kg) && kg > 0) return kg;
  }
  const cartonMatch = label.match(/([\d,]+)\s*carton/i);
  if (cartonMatch) {
    const cartons = Number(cartonMatch[1].replace(/,/g, ""));
    if (Number.isFinite(cartons) && cartons > 0) return cartons * 10;
  }
  return null;
}

export function dealPricePerKg(deal: DealQuantityFields): number | null {
  const kg = parseDealKg(deal);
  if (!kg || deal.dealValueUSD <= 0) return null;
  return deal.dealValueUSD / kg;
}

/** W-SUN week string (Monday–Sunday) containing `date` — the format the market-intel pipeline's price/route lookups expect. */
export function dealWeekFor(date: Date): string {
  const day = date.getUTCDay();
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return `${fmt(monday)}/${fmt(sunday)}`;
}

export function defaultDealWeek(): string {
  return dealWeekFor(new Date());
}

export function resolveSupplierRuc(deal: Deal): string | null {
  const explicit = normalizeRuc(deal.supplierRuc);
  if (explicit) return explicit;
  const fromAnalysis = normalizeRuc(
    deal.documentAnalysis?.suggestions?.supplierRuc,
  );
  if (fromAnalysis) return fromAnalysis;
  return null;
}

export function buildMarketIntelRequest(deal: Deal): MarketIntelRateRequest | null {
  const exporterRuc = resolveSupplierRuc(deal);
  if (!exporterRuc) return null;

  const destinationCountry = customsDestinationCountry(deal.destination);
  const originCountry = customsOriginCountry(deal.origin);
  const variety = customsVariety(deal.product, deal.variety);
  const dealKg = parseDealKg(deal);
  const dealPriceUsdPerKg = dealPricePerKg(deal);

  return {
    exporterRuc,
    importerName: deal.buyer.name,
    originCountry: originCountry ?? undefined,
    destinationCountry: destinationCountry ?? undefined,
    variety: variety ?? undefined,
/**
     * Prefer shipment-start week when known so the market-intel adaptive
     * window (and product price-vs-usual month key) align with the deal's
     * shipping season rather than "today" / createdAt.
     */
    dealWeek: deal.shippingStartDate
      ? dealWeekFor(new Date(deal.shippingStartDate))
      : deal.createdAt
        ? dealWeekFor(new Date(deal.createdAt))
        : defaultDealWeek(),
    dealKg: dealKg ?? undefined,
    dealPriceUsdPerKg: dealPriceUsdPerKg ?? undefined,
  };
}
