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
  "LIMAX SP. Z.O.O.": "LIMAX SP. Z O.O.",
  "LIMAX SP. Z.O.O": "LIMAX SP. Z O.O.",
  "LIMAX SP Z.O.O.": "LIMAX SP. Z O.O.",
  "LIMAX SP Z.O.O": "LIMAX SP. Z O.O.",
  "LIMAX SP Z O O": "LIMAX SP. Z O.O.",
  "LIMAX SP Z OO": "LIMAX SP. Z O.O.",
  "LIMAX SP. ZO.O.": "LIMAX SP. Z O.O.",
  "LIMAX SP. ZO.O": "LIMAX SP. Z O.O.",
  "LIMAX SP ZO.O": "LIMAX SP. Z O.O.",
  "LIMAX SP ZO.O.": "LIMAX SP. Z O.O.",
  "LIMAX SP. Z O.O": "LIMAX SP. Z O.O.",
  "LIMAX SP. Z O O": "LIMAX SP. Z O.O.",
  "LIMAX SP ZOO.": "LIMAX SP. Z O.O.",
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
  "HOLY FRUIT PERU S.A.C.": "Holy Fruit Peru",
  "HOLY FRUIT PERU S.A.C": "Holy Fruit Peru",
  "HOLY FRUIT PERU SAC": "Holy Fruit Peru",
  "FUNDO LAS LOMAS S.A.C.": "FUNDO LAS LOMAS SAC",
  "FUNDO LAS LOMAS S.A.C": "FUNDO LAS LOMAS SAC",
  // Ops-confirmed 2026-09-14: recorded GIDDINS is a misspelling of Giddings Berries Peru.
  "GIDDINS PERU SAC": "GIDDINGS BERRIES PERU S.A.C.",
  "GIDDINGS PERU SAC": "GIDDINGS BERRIES PERU S.A.C.",
  "GIDDINGS BERRIES PERU S.A.C.": "GIDDINGS BERRIES PERU S.A.C.",
  "GIDDINGS BERRIES PERU S.A.C": "GIDDINGS BERRIES PERU S.A.C.",
  // Ops-confirmed 2026-09-14: recorded MIKHUNA FOODS SAC is the ginger exporter
  // MIKHUNA PERUVIAN FOODS SOLUTIONS S.A.C (not asparagus).
  "MIKHUNA FOODS SAC": "MIKHUNA PERUVIAN FOODS SOLUTIONS S.A.C",
  "MIKHUNA PERUVIAN FOODS S.A.C.": "MIKHUNA PERUVIAN FOODS SOLUTIONS S.A.C",
  "MIKHUNA PERUVIAN FOODS S.A.C": "MIKHUNA PERUVIAN FOODS SOLUTIONS S.A.C",
  "MIKHUNA PERUVIAN FOODS SOLUTIONS S.A.C.": "MIKHUNA PERUVIAN FOODS SOLUTIONS S.A.C",
  "MIKHUNA PERUVIAN FOODS SOLUTIONS S.A.C": "MIKHUNA PERUVIAN FOODS SOLUTIONS S.A.C",
  // Ops-confirmed 2026-09-22: AGRICOLA MEDANO AZUL SAC is Agricola Los Medanos S.A.
  "AGRICOLA MEDANO AZUL SAC": "AGRICOLA LOS MEDANOS S.A.",
  "AGRICOLA MEDANO AZUL S.A.C.": "AGRICOLA LOS MEDANOS S.A.",
  "AGRICOLA MEDANO": "AGRICOLA LOS MEDANOS S.A.",
  "MEDANO AZUL": "AGRICOLA LOS MEDANOS S.A.",
  "AGRICOLA LOS MEDANOS S.A.": "AGRICOLA LOS MEDANOS S.A.",
  "AGRICOLA LOS MEDANOS SA": "AGRICOLA LOS MEDANOS S.A.",
  "AGRICOLA LOS MEDANOS S.A": "AGRICOLA LOS MEDANOS S.A.",
  // Ops-confirmed 2026-09-22: recorded BLUE PACIFIC FOODS SAC is Oils (ops: International I, RUC 20507873627).
  "BLUE PACIFIC FOODS SAC": "BLUE PACIFIC OILS INTERNATIONAL I S.A.C.",
  "BLUE PACIFIC OILS SAC": "BLUE PACIFIC OILS INTERNATIONAL I S.A.C.",
  "BLUE PACIFIC OILS S.A.C.": "BLUE PACIFIC OILS INTERNATIONAL I S.A.C.",
  "BLUE PACIFIC OILS S.A.C": "BLUE PACIFIC OILS INTERNATIONAL I S.A.C.",
  "BLUE PACIFIC OILS INTERNATIONAL I S.A.C.": "BLUE PACIFIC OILS INTERNATIONAL I S.A.C.",
  "BLUE PACIFIC OILS INTERNATIONAL I S.A.C": "BLUE PACIFIC OILS INTERNATIONAL I S.A.C.",
  "BLUE PACIFIC OILS INTERNATIONAL I SAC": "BLUE PACIFIC OILS INTERNATIONAL I S.A.C.",
  // Ops-confirmed 2026-09-22: recorded ICA BLUEBERRIES SAC is BerryCo S.A.C.
  "ICA BLUEBERRIES SAC": "BERRYCO S.A.C.",
  "ICA BLUEBERRIES S.A.C.": "BERRYCO S.A.C.",
  "BERRYCO S.A.C.": "BERRYCO S.A.C.",
  "BERRYCO S.A.C": "BERRYCO S.A.C.",
  "BERRYCO SAC": "BERRYCO S.A.C.",
  "MANDARINA FRESCA": "Mandarina Fresca", // not a company, guards against accidental match
  // Ops-confirmed 2026-09-22: recorded INDUSTRIAS SOLIMAR SAC is Solimar Industria EIRL.
  "INDUSTRIAS SOLIMAR SAC": "SOLIMAR INDUSTRIA E.I.R.L.",
  "SOLIMAR INDUSTRIA E.I.R.L.": "SOLIMAR INDUSTRIA E.I.R.L.",
  "SOLIMAR INDUSTRIA EIRL": "SOLIMAR INDUSTRIA E.I.R.L.",
  // Platform records carry the buyer's address in the name; customs uses the bare name.
  "DRELIFRESH SAS": "DRELIFRESH SAS VEREDA EL PORTENTO VIA RETIRO LA CEJA",
  // Windows-1252 Ñ (U+0091) mis-decoded as a control char in the source export.
  "AGRICOLA VI\u0091ASOL SAC": "AGRICOLA VIÑASOL SAC",
  "AGRICOLA VIÑASOL SAC": "AGRICOLA VIÑASOL SAC",
  "AGRICOLA VINASOL SAC": "AGRICOLA VIÑASOL SAC",
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
