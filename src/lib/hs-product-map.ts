/**
 * HS / tariff code → TruMarket product + usual-price key.
 *
 * Commodity identity should be HS-driven: Dimension A customs volumes and
 * Dimension B product/price tables change when the tariff changes. Until now
 * scoring keyed only on free-text product names while customs aggregations
 * pooled all HS under a company — see aggregate-customs-companies.py.
 */

export interface HsProductMapping {
  /** Preferred 10-digit Peru partida (zeros padded). */
  hsCode: string;
  /** First 4 digits (chapter.heading), e.g. "0810". */
  hsHeading4: string;
  /** CRAM product-risk / deal display label. */
  product: string;
  /** Usual-price table key (BLUEBERRY, AVOCADO, …). */
  productKey: string;
}

/** Digits only, left-pad to 10 (Veritrade often drops the leading 0). */
export function normalizeHsCode(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length >= 10) return digits.slice(0, 10);
  return digits.padStart(10, "0");
}

export function hsHeading4(raw: string | null | undefined): string | null {
  const code = normalizeHsCode(raw);
  return code ? code.slice(0, 4) : null;
}

/**
 * Longest-prefix map. Prefer 6-digit then 4-digit headings.
 * Avocado 0804 / asparagus 0709 are standard UN headings — may not appear in
 * the current Peru blueberry/coffee customs books.
 */
const BY_PREFIX: Array<{ prefix: string; mapping: Omit<HsProductMapping, "hsCode" | "hsHeading4"> & { hsCode: string } }> = [
  {
    prefix: "081040",
    mapping: {
      hsCode: "0810400000",
      product: "Fresh Blueberries",
      productKey: "BLUEBERRY",
    },
  },
  {
    prefix: "0810",
    mapping: {
      hsCode: "0810400000",
      product: "Fresh Blueberries",
      productKey: "BLUEBERRY",
    },
  },
  {
    prefix: "0811",
    mapping: {
      hsCode: "0811900000",
      product: "Mixed Berries / Tropical Fruits (IQF)",
      productKey: "MIXED_BERRIES",
    },
  },
  {
    prefix: "0804",
    mapping: {
      hsCode: "0804400000",
      product: "Fresh Avocado",
      productKey: "AVOCADO",
    },
  },
  {
    prefix: "0805",
    mapping: {
      hsCode: "0805200000",
      product: "Fresh Mandarin",
      productKey: "MANDARIN",
    },
  },
  {
    prefix: "0806",
    mapping: {
      hsCode: "0806100000",
      product: "Fresh Grapes",
      productKey: "GRAPE",
    },
  },
  {
    prefix: "0709",
    mapping: {
      hsCode: "0709200000",
      product: "Fresh Asparagus",
      productKey: "ASPARAGUS",
    },
  },
  {
    prefix: "0901",
    mapping: {
      hsCode: "0901119000",
      product: "Green Coffee",
      productKey: "COFFEE",
    },
  },
  {
    prefix: "0910",
    mapping: {
      hsCode: "0910110000",
      product: "Fresh Ginger",
      productKey: "GINGER",
    },
  },
  {
    prefix: "1801",
    mapping: {
      hsCode: "1801000000",
      product: "Cacao Beans",
      productKey: "CACAO",
    },
  },
];

const PRODUCT_TO_HS: Record<string, string> = {
  "fresh blueberries": "0810400000",
  "fresh strawberries": "0810100000",
  "fresh avocado": "0804400000",
  "fresh mandarin": "0805200000",
  "fresh grapes": "0806100000",
  "fresh asparagus": "0709200000",
  "fresh ginger": "0910110000",
  "green coffee": "0901119000",
  "cacao beans": "1801000000",
  "mixed berries / tropical fruits (iqf)": "0811900000",
  "frozen tropical fruits": "0811900000",
};

function normalizeProductLabel(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function toMapping(
  partial: Omit<HsProductMapping, "hsHeading4"> & { hsHeading4?: string },
): HsProductMapping {
  const hsCode = normalizeHsCode(partial.hsCode)!;
  return {
    hsCode,
    hsHeading4: partial.hsHeading4 ?? hsCode.slice(0, 4),
    product: partial.product,
    productKey: partial.productKey,
  };
}

/**
 * Subheadings the 4-digit catch-alls above must not swallow: 0810.90 is
 * "other fresh fruit" (pomegranate arils in the 2026 customs book), which
 * would otherwise fall through to the 0810 → Fresh Blueberries row and be
 * priced and risk-scored as blueberries. No product table row exists for it
 * yet, so it stays unmapped (the product dimension reports it as missing).
 */
const UNMAPPED_PREFIXES = ["081090"];

/** Resolve product / price key from an HS / partida code. */
export function lookupByHsCode(raw: string | null | undefined): HsProductMapping | null {
  const code = normalizeHsCode(raw);
  if (!code) return null;
  if (UNMAPPED_PREFIXES.some((prefix) => code.startsWith(prefix))) return null;
  for (const { prefix, mapping } of BY_PREFIX) {
    if (code.startsWith(prefix)) {
      return toMapping(mapping);
    }
  }
  return null;
}

/** Default HS for a known platform product label (backfill when CSV has no partida). */
export function defaultHsForProduct(product: string | null | undefined): string | null {
  if (!product) return null;
  return PRODUCT_TO_HS[normalizeProductLabel(product)] ?? null;
}

/**
 * Resolve HS mapping from explicit code, else backfill from product name.
 * Prefer explicit hsCode when both are present.
 */
export function resolveHsProduct(args: {
  hsCode?: string | null;
  product?: string | null;
}): HsProductMapping | null {
  const fromHs = lookupByHsCode(args.hsCode ?? null);
  if (fromHs) return fromHs;
  const fallbackHs = defaultHsForProduct(args.product ?? null);
  return lookupByHsCode(fallbackHs);
}

/** Prefer HS-derived productKey for usual-price tables; fall back to caller. */
export function productKeyFromHsOrLabel(
  hsCode: string | null | undefined,
  productLabel: string,
  labelFallback: (label: string) => string | null,
): string | null {
  const mapped = resolveHsProduct({ hsCode, product: productLabel });
  if (mapped) return mapped.productKey;
  return labelFallback(productLabel);
}
