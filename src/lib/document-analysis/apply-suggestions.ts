import type { Deal } from "../../types";
import { PRODUCT_OPTIONS } from "../product-risk-tables";
import { ROUTE_OPTIONS } from "../route-risk-tables";
import type { DealFieldSuggestions } from "./types";

export type ReviewDealFields = {
  product: string;
  variety: string;
  origin: string;
  destination: string;
  dealValueUSD: string;
  buyerName: string;
  supplierName: string;
  incoterm: string;
  paymentTerms: string;
  advancePaymentPct: string;
  qualityGrade: string;
};

const COUNTRY_ALIASES: Record<string, string[]> = {
  peru: ["peru", "callao", "lima"],
  colombia: ["colombia", "buenaventura"],
  usa: ["usa", "united states", "philadelphia", "miami", "los angeles"],
  spain: ["spain", "valencia", "algeciras"],
  portugal: ["portugal", "lisbon", "sines"],
  netherlands: ["netherlands", "rotterdam", "holland"],
  israel: ["israel", "haifa", "ashdod"],
  egypt: ["egypt", "alexandria", "damietta"],
  jordan: ["jordan", "aqaba"],
  thailand: ["thailand", "bangkok", "laem chabang"],
  taiwan: ["taiwan", "kaohsiung", "keelung"],
  china: ["china", "shanghai", "hong kong"],
  uae: ["uae", "jebel ali", "dubai"],
};

function normalizeLocationToken(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function locationMatchesCountry(location: string, countryKey: string): boolean {
  const token = normalizeLocationToken(location);
  const aliases = COUNTRY_ALIASES[countryKey] ?? [countryKey];
  return aliases.some(
    (alias) => token === alias || token.includes(alias) || alias.includes(token),
  );
}

function countryKeyFromRouteLocation(routeLocation: string): string | null {
  const country =
    routeLocation.split(",").pop()?.trim().toLowerCase() ??
    routeLocation.toLowerCase();
  for (const [key, aliases] of Object.entries(COUNTRY_ALIASES)) {
    if (aliases.some((alias) => country.includes(alias) || alias.includes(country))) {
      return key;
    }
  }
  return normalizeLocationToken(country);
}

export function findRouteIndex(
  origin?: string,
  destination?: string,
): number {
  if (!origin && !destination) return -1;

  const idx = ROUTE_OPTIONS.findIndex((route) => {
    const originKey = countryKeyFromRouteLocation(route.origin);
    const destKey = countryKeyFromRouteLocation(route.destination);
    const originMatch =
      !origin ||
      (originKey != null && locationMatchesCountry(origin, originKey)) ||
      normalizeLocationToken(route.origin).includes(normalizeLocationToken(origin));
    const destMatch =
      !destination ||
      (destKey != null && locationMatchesCountry(destination, destKey)) ||
      normalizeLocationToken(route.destination).includes(
        normalizeLocationToken(destination),
      );
    return originMatch && destMatch;
  });

  return idx;
}

export function reviewFieldsFromSuggestions(
  suggestions: DealFieldSuggestions,
): ReviewDealFields {
  return {
    product: suggestions.product ?? "",
    variety: suggestions.variety ?? "",
    origin: suggestions.origin ?? "",
    destination: suggestions.destination ?? "",
    dealValueUSD:
      suggestions.dealValueUSD != null
        ? String(Math.round(suggestions.dealValueUSD))
        : "",
    buyerName: suggestions.buyerName ?? "",
    supplierName: suggestions.supplierName ?? "",
    incoterm: suggestions.incoterm ?? "",
    paymentTerms: suggestions.paymentTerms ?? "",
    advancePaymentPct:
      suggestions.advancePaymentPct != null
        ? String(suggestions.advancePaymentPct)
        : "",
    qualityGrade: suggestions.qualityGrade ?? "",
  };
}

export type DealFormValues = {
  product: string;
  routeIndex: number;
  variety: string;
  dealValueUSD: string;
  buyerName: string;
  supplierName: string;
  paymentTerms: string;
  advancePaymentPct: string;
  incoterm: string;
  qualityGrade: Deal["qualityGrade"] | "";
};

export function applyReviewFieldsToForm(
  review: ReviewDealFields,
): DealFormValues {
  let product = "";
  if (review.product && PRODUCT_OPTIONS.includes(review.product)) {
    product = review.product;
  }

  const routeIndex = findRouteIndex(review.origin, review.destination);

  let qualityGrade: Deal["qualityGrade"] | "" = "";
  if (
    review.qualityGrade === "Grade A / Class I" ||
    review.qualityGrade === "Grade B / Class II" ||
    review.qualityGrade === "Industrial"
  ) {
    qualityGrade = review.qualityGrade;
  }

  return {
    product,
    routeIndex,
    variety: review.variety,
    dealValueUSD: review.dealValueUSD,
    buyerName: review.buyerName,
    supplierName: review.supplierName,
    paymentTerms: review.paymentTerms,
    advancePaymentPct: review.advancePaymentPct,
    incoterm: review.incoterm,
    qualityGrade,
  };
}

export function applySuggestionsToForm(
  suggestions: DealFieldSuggestions,
): DealFormValues {
  return applyReviewFieldsToForm(reviewFieldsFromSuggestions(suggestions));
}
