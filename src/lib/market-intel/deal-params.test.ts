import { describe, expect, it } from "vitest";
import { customsDestinationCountry, customsOriginCountry } from "./deal-params";

/**
 * These labels are matched against the customs table through
 * `canonical_country()` in
 * docs/market-intel-peru-2025-2026-07-10/src/analysis.py, which strips accents,
 * bracketed alternates ("TAIWAN {FORMOSA}") and political qualifiers
 * ("TAIWÁN, PROVINCIA DE CHINA"). Emitting an accented or bracketed form here
 * would not break the comparison, but emitting a country the map has no entry
 * for does: the deal falls through to the variety-only benchmark and loses its
 * corridor. That regression cost 57 of 169 deals before 2026-07-30.
 */
describe("customsDestinationCountry", () => {
  it("maps the destinations that previously fell through to variety-only", () => {
    expect(customsDestinationCountry("Dubai, United Arab Emirates")).toBe(
      "EMIRATOS ARABES UNIDOS",
    );
    expect(customsDestinationCountry("Kaohsiung, Taiwan, Province of China")).toBe("TAIWAN");
    expect(customsDestinationCountry("Guarulhos, Brazil")).toBe("BRASIL");
    expect(customsDestinationCountry("St Petersburg, Russian Federation")).toBe(
      "FEDERACION RUSA",
    );
  });

  it("resolves Hong Kong to its own lane rather than mainland China", () => {
    expect(customsDestinationCountry("Hong Kong, Hong Kong")).toBe("HONG KONG");
    expect(customsDestinationCountry("Shanghai, China")).toBe("CHINA");
  });

  it("emits accent-free labels so both customs spellings are reachable", () => {
    // Customs holds ESPANA and ESPAÑA, PAISES BAJOS and PAÍSES BAJOS as
    // separate rows; the folded form is what unions them.
    expect(customsDestinationCountry("Valencia, Spain")).toBe("ESPANA");
    expect(customsDestinationCountry("Rotterdam, Netherlands")).toBe("PAISES BAJOS");
    expect(customsDestinationCountry("Toronto, Canada")).toBe("CANADA");
  });

  it("folds accents on the unmapped-country fallback path", () => {
    expect(customsDestinationCountry("Some Port, Panamá")).toBe("PANAMA");
  });

  it("returns null when no country can be read", () => {
    expect(customsDestinationCountry("")).toBeNull();
  });
});

describe("customsOriginCountry", () => {
  it("reads the trailing country segment", () => {
    expect(customsOriginCountry("Callao, Peru")).toBe("PERU");
    expect(customsOriginCountry("San Antonio, Chile")).toBe("CHILE");
    expect(customsOriginCountry("Puerto Bolivar, Ecuador")).toBe("ECUADOR");
  });

  it("returns null when no country can be read", () => {
    expect(customsOriginCountry("")).toBeNull();
  });
});
