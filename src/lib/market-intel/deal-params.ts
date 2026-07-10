import type { Deal } from "../../types";
import type { MarketIntelRateRequest } from "./types";

const DESTINATION_TO_CUSTOMS: Array<[RegExp, string]> = [
  [/colombia/i, "COLOMBIA"],
  [/taiwan|formosa/i, "TAIWAN"],
  [/netherlands|rotterdam|holland|países bajos|paises bajos/i, "PAISES BAJOS"],
  [/germany|alemania/i, "ALEMANIA"],
  [/spain|españa|espana/i, "ESPANA"],
  [/united states|usa|miami|los angeles/i, "ESTADOS UNIDOS"],
  [/israel/i, "ISRAEL"],
  [/thailand/i, "TAILANDIA"],
  [/china|shanghai/i, "CHINA"],
  [/uk|united kingdom|london/i, "REINO UNIDO"],
  [/france|francia/i, "FRANCIA"],
  [/mexico|méxico/i, "MEXICO"],
  [/canada|canadá/i, "CANADA"],
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

export function customsDestinationCountry(destination: string): string | null {
  for (const [pattern, country] of DESTINATION_TO_CUSTOMS) {
    if (pattern.test(destination)) return country;
  }
  const last = destination.split(",").pop()?.trim();
  if (last) {
    const upper = last.toUpperCase();
    if (upper.length >= 3) return upper;
  }
  return null;
}

export function customsVariety(product: string, variety?: string): string | null {
  const text = `${product} ${variety ?? ""}`;
  for (const [pattern, v] of PRODUCT_TO_VARIETY) {
    if (pattern.test(text)) return v;
  }
  return null;
}

export function parseDealKg(deal: Deal): number | null {
  const label = deal.quantityLabel;
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

export function dealPricePerKg(deal: Deal): number | null {
  const kg = parseDealKg(deal);
  if (!kg || deal.dealValueUSD <= 0) return null;
  return deal.dealValueUSD / kg;
}

export function defaultDealWeek(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return `${fmt(monday)}/${fmt(sunday)}`;
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
  const variety = customsVariety(deal.product, deal.variety);
  const dealKg = parseDealKg(deal);
  const dealPriceUsdPerKg = dealPricePerKg(deal);

  return {
    exporterRuc,
    importerName: deal.buyer.name,
    destinationCountry: destinationCountry ?? undefined,
    variety: variety ?? undefined,
    dealWeek: defaultDealWeek(),
    dealKg: dealKg ?? undefined,
    dealPriceUsdPerKg: dealPriceUsdPerKg ?? undefined,
  };
}
