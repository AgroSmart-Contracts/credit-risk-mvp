import { PRODUCT_OPTIONS } from '../src/lib/product-risk-tables';

/** Map extracted product text to CRAM Table 1 product names */
const PRODUCT_ALIASES: Array<[RegExp, string]> = [
  [/mandarin|mandarina|tangerine|clementine|murcott|tango/i, 'Mandarin'],
  [/avocado|palta|hass|aguacate/i, 'Avocado'],
  [/blueberr|arándano|arandano|strawberr|fresa/i, 'Blueberries'],
  [/grape|uva|uvas/i, 'Grapes'],
  [/asparagus|espárrago|esparrago/i, 'Asparagus'],
  [/ginger|jengibre|kion/i, 'Ginger'],
  [/coffee|café|cafe|arabica/i, 'Coffee'],
  [/cacao|cocoa|chocolate\s+bean/i, 'Cacao'],
];

export function inferProductFromText(
  value?: string | null,
): string | undefined {
  if (!value?.trim()) return undefined;
  const text = value.trim();

  for (const [pattern, product] of PRODUCT_ALIASES) {
    if (pattern.test(text) && PRODUCT_OPTIONS.includes(product)) {
      return product;
    }
  }

  const direct = PRODUCT_OPTIONS.find((product) =>
    text.toLowerCase().includes(product.toLowerCase()),
  );
  return direct;
}
