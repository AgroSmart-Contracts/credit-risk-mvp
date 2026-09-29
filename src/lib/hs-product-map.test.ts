import { describe, expect, it } from "vitest";
import {
  defaultHsForProduct,
  hsHeading4,
  lookupByHsCode,
  normalizeHsCode,
  resolveHsProduct,
} from "./hs-product-map";

describe("normalizeHsCode", () => {
  it("pads Veritrade-style codes to 10 digits", () => {
    expect(normalizeHsCode("810400000")).toBe("0810400000");
    expect(normalizeHsCode("0810400000")).toBe("0810400000");
  });
});

describe("lookupByHsCode", () => {
  it("maps blueberry partida to Fresh Blueberries", () => {
    const m = lookupByHsCode("0810400000");
    expect(m?.product).toBe("Fresh Blueberries");
    expect(m?.productKey).toBe("BLUEBERRY");
    expect(m?.hsHeading4).toBe("0810");
  });

  it("maps coffee heading 0901", () => {
    expect(lookupByHsCode("0901119000")?.productKey).toBe("COFFEE");
  });
});

describe("resolveHsProduct", () => {
  it("backfills HS from product label when code missing", () => {
    const m = resolveHsProduct({ product: "Fresh Avocado" });
    expect(m?.hsCode).toBe("0804400000");
    expect(defaultHsForProduct("Fresh Blueberries")).toBe("0810400000");
    expect(hsHeading4(m?.hsCode)).toBe("0804");
  });

  it("prefers explicit HS over product label", () => {
    const m = resolveHsProduct({
      hsCode: "0901119000",
      product: "Fresh Blueberries",
    });
    expect(m?.productKey).toBe("COFFEE");
  });
});
