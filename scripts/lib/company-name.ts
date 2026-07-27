/**
 * Company-name normalization for the company-master build.
 * Resolves the spelling/encoding variants observed in
 * full-deals-dataset-2026-07 (1).csv so one real company doesn't get
 * split into 3-4 "different" companies with inconsistent YIB fills.
 */

/** Known alias clusters, hand-verified while reading the source CSV. Left = raw variant seen in data, right = canonical name. */
const ALIAS_MAP: Record<string, string> = {
  "AGRO SMART CONTRACTS LDA": "AGRO SMART CONTRACTS LDA",
  "AGRO SMART CONTRACTS, LDA.": "AGRO SMART CONTRACTS LDA",
  "AGRO SMART CONTRACTS": "AGRO SMART CONTRACTS LDA",
  "AGROSMART CONTRACTS LDA": "AGRO SMART CONTRACTS LDA",
  "TRU MARKET BLOCKCHAIN S.A.C.": "TRU MARKET BLOCKCHAIN S.A.C.",
  "TRU MARKET BLOCKCHAIN S.A.C": "TRU MARKET BLOCKCHAIN S.A.C.",
  "TRU MARKET BLOCKCHAIN": "TRU MARKET BLOCKCHAIN S.A.C.",
  "BIO FARMING PERU S.A.C.": "BIO FARMING PERU S.A.C.",
  "BIO FARMING PERU S.A.C": "BIO FARMING PERU S.A.C.",
  "BIO FARMIN PERU S.A.C": "BIO FARMING PERU S.A.C.",
  "LIMAX SP. Z O.O.": "LIMAX SP. Z O.O.",
  "LIMAX SP ZOO": "LIMAX SP. Z O.O.",
  "EAGLE TRADING AGRICULTURE MARKETING LTD": "Eagle Trading Agriculture Marketing Ltd",
  "EAGLE TRADING AGRICULTURE MARKETING LTD.": "Eagle Trading Agriculture Marketing Ltd",
  "A.S.M INTERNATIONAL": "A.S.M International",
  "ASM INTERNATIONAL FSSAI": "A.S.M International",
  "VILLAVENTURA PERU SAC": "Villaventura Peru SAC",
  "VILLAVENTURA PRODUCE SAC": "Villaventura Peru SAC",
  // Mangled UTF-8 encodings of «Ardzhies» LLC seen in the raw export.
  "ÇARDZHIESÈ LLC": "«Ardzhies» LLC",
  "ÃÂ«ARDZHIESÃÂ» LLC": "«Ardzhies» LLC",
  "Â«ARDZHIESÂ» LLC": "«Ardzhies» LLC",
  "«ARDZHIES» LLC": "«Ardzhies» LLC",
  "ALLIED TRADE GLOBAL CORP": "Allied Trade Global",
  "ALLIED TRADE GLOBAL": "Allied Trade Global",
  "HOLY FRUIT PERU": "Holy Fruit Peru",
  "MANDARINA FRESCA": "Mandarina Fresca", // not a company, guards against accidental match
};

function stripDiacriticGarbage(value: string): string {
  // The raw export has double/triple UTF-8 mis-decodes that surface as stray
  // Ã / Â characters interspersed with otherwise-readable text (e.g.
  // "Â«ARDZHIESÂ» LLC" for "«ARDZHIES» LLC"). Strip just those stray
  // characters rather than whole tokens, so real text around them survives.
  return value.replace(/[ÃÂ]/g, "").trim();
}

export function normalizeCompanyName(raw: string): string {
  const trimmed = stripDiacriticGarbage((raw ?? "").trim());
  if (!trimmed) return "";
  const upper = trimmed.toUpperCase();
  if (ALIAS_MAP[upper]) return ALIAS_MAP[upper];
  if (ALIAS_MAP[trimmed]) return ALIAS_MAP[trimmed];
  // Generic normalization: collapse whitespace, drop a single trailing period.
  return trimmed.replace(/\s+/g, " ").replace(/\.$/, "");
}

/** Grouping key — case/punctuation-insensitive, used only for bucketing rows together. */
export function companyGroupKey(raw: string): string {
  return normalizeCompanyName(raw)
    .toUpperCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
