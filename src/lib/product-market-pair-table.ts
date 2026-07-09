/**
 * CRAM Table 3 — Product×Market pair table (C4 route-risk flag overrides).
 * Source: tm-cram-reference-tables-2026-07.md
 *
 * Rule: if a (commodity-group × market) row exists → its flag replaces the corridor default.
 */
import type { CorridorRiskFlag } from "./route-risk-tables";
import { lookupProductRisk } from "./product-risk-tables";
import type { PerishabilityClass } from "./product-risk-tables";

export type PairRiskFlag = CorridorRiskFlag | "Low + EUDR gate";

export interface ProductMarketPairEntry {
  /** AC risk groups covered, e.g. "G1" */
  commodityGroups: number[];
  /** Product name substrings (normalized matching) */
  productMatchers: string[];
  marketMatchers: string[];
  pairFlag: PairRiskFlag;
  rationale: string;
}

export const PRODUCT_MARKET_PAIR_TABLE: ProductMarketPairEntry[] = [
  {
    commodityGroups: [1],
    productMatchers: ["blueberr", "grape", "asparagus"],
    marketMatchers: ["israel"],
    pairFlag: "High",
    rationale:
      "Long transit eats shelf life; thin resale market on rejection",
  },
  {
    commodityGroups: [1],
    productMatchers: ["asparagus"],
    marketMatchers: ["spain"],
    pairFlag: "Low-Med",
    rationale: "Air-dominant; deep resale/re-export market",
  },
  {
    commodityGroups: [1],
    productMatchers: ["asparagus"],
    marketMatchers: ["germany", "netherlands", "rotterdam"],
    pairFlag: "High",
    rationale:
      "Ocean transit consumes asparagus shelf life; strict quality culture",
  },
  {
    commodityGroups: [1],
    productMatchers: ["blueberr"],
    marketMatchers: ["usa", "philadelphia", "miami", "los angeles"],
    pairFlag: "Low-Med",
    rationale: "Fruit-fly protocol compliance is binding",
  },
  {
    commodityGroups: [1],
    productMatchers: ["blueberr", "grape"],
    marketMatchers: ["thailand", "taiwan", "bangkok", "kaohsiung"],
    pairFlag: "Med-High",
    rationale: "28–38d transit near CA ceiling; quality claims frequent",
  },
  {
    commodityGroups: [2],
    productMatchers: ["avocado"],
    marketMatchers: [
      "spain",
      "portugal",
      "netherlands",
      "germany",
      "eu",
      "valencia",
      "rotterdam",
    ],
    pairFlag: "Low-Med",
    rationale: "Robust EU demand; dry-matter/maturity claims main friction",
  },
  {
    commodityGroups: [3],
    productMatchers: ["mandarin"],
    marketMatchers: ["colombia", "buenaventura"],
    pairFlag: "Medium",
    rationale: "TM-2026-012; short transit but thin market depth",
  },
  {
    commodityGroups: [3],
    productMatchers: ["mandarin"],
    marketMatchers: ["usa", "philadelphia", "miami", "los angeles"],
    pairFlag: "Medium",
    rationale: "Cold-treatment protocol mandatory PE→USA",
  },
  {
    commodityGroups: [3],
    productMatchers: ["ginger"],
    marketMatchers: ["spain", "portugal", "netherlands", "usa", "germany"],
    pairFlag: "Low",
    rationale: "Semi-perishable + deep spot market",
  },
  {
    commodityGroups: [4],
    productMatchers: ["coffee", "cacao"],
    marketMatchers: [
      "spain",
      "portugal",
      "netherlands",
      "germany",
      "eu",
      "valencia",
      "rotterdam",
      "lisbon",
    ],
    pairFlag: "Low + EUDR gate",
    rationale: "Physically low-risk; EUDR DDS compliance gate for EU",
  },
  {
    commodityGroups: [4],
    productMatchers: ["coffee", "cacao"],
    marketMatchers: ["usa", "uae", "china", "thailand", "taiwan", "jordan"],
    pairFlag: "Low",
    rationale: "Non-perishable, standard dry logistics",
  },
  {
    commodityGroups: [1, 2, 3],
    productMatchers: [],
    marketMatchers: ["egypt", "jordan", "alexandria", "aqaba"],
    pairFlag: "High",
    rationale:
      "Long transshipped transit + customs variability + payment-rail friction",
  },
];

const FRESH_PERISHABILITY: PerishabilityClass[] = [
  "Ultra-Perishable",
  "Perishable",
  "Semi-Perishable",
];

function normalizeMarket(destination: string): string {
  return destination.toLowerCase();
}

function matchesMarket(destination: string, matchers: string[]): boolean {
  const market = normalizeMarket(destination);
  return matchers.some(
    (m) => market.includes(m) || m.includes(market.split(",")[0]?.trim() ?? ""),
  );
}

function matchesProduct(productName: string, matchers: string[]): boolean {
  if (matchers.length === 0) return true;
  const normalized = productName.toLowerCase().replace(/^fresh\s+/i, "");
  return matchers.some((m) => normalized.includes(m));
}

export interface ResolvedRouteRisk {
  flag: CorridorRiskFlag;
  source: "pair-override" | "corridor-default" | "35-day-rule";
  rationale?: string;
  eudrGate?: boolean;
}

/**
 * Resolves C4 route-risk flag per CRAM integration contract:
 * 1. Pair table override if row matches
 * 2. Else corridor default
 * 3. 35-day rule floors perishables at High when transit > 35d
 */
export function resolveRouteRiskFlag(
  productName: string,
  destination: string,
  corridorDefault: CorridorRiskFlag,
  estimatedTransitDays: number,
  perishabilityClass: PerishabilityClass,
): ResolvedRouteRisk {
  const productEntry = lookupProductRisk(productName);
  const acGroup = productEntry?.acRiskGroup ?? 3;

  for (const pair of PRODUCT_MARKET_PAIR_TABLE) {
    if (!pair.commodityGroups.includes(acGroup)) continue;
    if (!matchesMarket(destination, pair.marketMatchers)) continue;
    if (!matchesProduct(productName, pair.productMatchers)) continue;

    const flag =
      pair.pairFlag === "Low + EUDR gate" ? "Low" : pair.pairFlag;
    return {
      flag,
      source: "pair-override",
      rationale: pair.rationale,
      eudrGate: pair.pairFlag === "Low + EUDR gate",
    };
  }

  let flag = corridorDefault;
  let source: ResolvedRouteRisk["source"] = "corridor-default";
  let rationale: string | undefined;

  if (
    FRESH_PERISHABILITY.includes(perishabilityClass) &&
    estimatedTransitDays > 35
  ) {
    flag = "High";
    source = "35-day-rule";
    rationale =
      "Ocean transit >35d exceeds perishables ceiling (AC 2026-07-09)";
  }

  return { flag, source, rationale };
}
