/**
 * Regenerates src/data/platform-deals.generated.json + platform-deals.ts from
 * full-deals-dataset-2026-07 (1).csv (mongoId / quantity / market-intel base).
 *
 * After a full rebuild, overlay the curated export with:
 *   npm run apply-platform-defaults
 * (docs/platform-deals-with-defaults-2.csv — transit, mode, YIB, OD, priors).
 *
 * What this does that the old (undated) generator didn't:
 *  - `likely_test` rows are merged into the same scoring/aggregate pipeline as
 *    every other row — decision 2026-07-28 (reverses the 2026-07-27 decision
 *    to exclude them; see docs/cram-defaults-and-formula-2026-07.md §6 for the
 *    retracted rationale). `likelyTest` is kept on each record purely as a
 *    provenance label, not as a scoring/inclusion gate.
 *  - Pulls buyer/supplier years-in-business from the company-master (built by
 *    build-company-master.ts), not per-deal-row duplication
 *  - Computes real priorDealsBetweenParties / relationshipAgeMonths per
 *    buyer+supplier pair instead of hardcoding 0
 *  - Defaults Coface coverage to 90% of dealValueUSD, persisted literally,
 *    flagged with cofaceIsDefaulted (decision 2026-07-24)
 *  - Classifies product/route against the expanded product-risk-tables.ts /
 *    route-risk-tables.ts (see docs/product-route-table-gaps-2026-07.md for
 *    what's still a provisional/estimated match)
 *  - Scores counterparties per (company, role, product) using
 *    computeBuyerScore()/computeSupplierScore() directly — not a blended
 *    buyer+supplier pair score — matching the ERD's Counterparty entity,
 *    which is per-company-per-role, not per-pair (decision 2026-07-27)
 *
 * Run: npx tsx scripts/build-platform-deals.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsvRecords } from "./lib/csv";
import { normalizeCompanyName, companyGroupKey } from "./lib/company-name";
import { extractValidRuc, fetchMarketIntelSync } from "./lib/market-intel-cli";
import { lookupProductRisk } from "../src/lib/product-risk-tables";
import { ROUTE_OPTIONS, lookupRouteRisk } from "../src/lib/route-risk-tables";
import { normalizeDealMilestone } from "../src/lib/deal-milestone";
import { platformDealToDeal } from "../src/lib/platform-deal-mapper";
import { computeBuyerScore, computeSupplierScore } from "../src/lib/scoring";
import { hsHeading4, resolveHsProduct } from "../src/lib/hs-product-map";
import {
  customsDestinationCountry,
  customsOriginCountry,
  customsVariety,
  parseDealKg,
  dealPricePerKg,
  dealWeekFor,
} from "../src/lib/market-intel/deal-params";
import type {
  PlatformDealRecord,
  PlatformCounterpartyScore,
  PlatformCounterpartyBlocked,
  DataQualityFlag,
} from "../src/types/platform";


/**
 * Short, stable deal ids ("plat-" + first 8 hex of the Mongo id). Two Mongo ids can
 * share those 8 characters (sequential inserts: ...a0 / ...a1), so a colliding
 * deal takes its full Mongo id instead of silently sharing the first one's id.
 */
const usedDealIds = new Set<string>();
function uniqueDealId(mongoId: string): string {
  const short = `plat-${mongoId.slice(0, 8)}`;
  const id = usedDealIds.has(short) ? `plat-${mongoId}` : short;
  usedDealIds.add(id);
  return id;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DESKTOP = join(process.env.HOME ?? "", "Desktop");
const SOURCE_CSV = join(DESKTOP, "full-deals-dataset-2026-07 (1).csv");
const OUT_DIR = join(__dirname, "..", "src", "data");

interface CompanyMasterEntry {
  key: string;
  name: string;
  countries: string[];
  yearsInBusiness: number | null;
  yearsInBusinessSource: "csv" | "verified" | "default";
  taxIds: string[];
}

function safeJsonParse(raw: string): Record<string, unknown> | null {
  if (!raw || raw.trim() === "" || raw.trim() === "[]") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseNumber(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

// --- Product classification -------------------------------------------------

/** One-off overrides for deals whose `name`/`description` don't carry any product keyword at all
 * (e.g. "EUROPE BULK") but the counterparty is a known single-product trader — see
 * company-trade-profiles-2026-07-21.csv. Keyed by the first 8 chars of the Mongo _id. */
const PRODUCT_OVERRIDE_BY_ID: Record<string, string> = {
  "6917a58b": "Fresh Blueberries", // "EUROPE BULK" — Limax Sp. Z O.O. is a blueberries-only buyer
};

const PRODUCT_KEYWORD_MAP: Array<{ keywords: string[]; product: string }> = [
  { keywords: ["blueberr", "ndano"], product: "Fresh Blueberries" }, // "ndano" catches mojibake variants of "arándano"
  { keywords: ["avocado", "palta"], product: "Fresh Avocado" },
  { keywords: ["mandarin"], product: "Fresh Mandarin" },
  { keywords: ["ginger", "kion"], product: "Fresh Ginger" },
  { keywords: ["asparagus", "esparrago"], product: "Fresh Asparagus" },
  { keywords: ["mango"], product: "Fresh Mango" },
  { keywords: ["grape"], product: "Fresh Grapes" },
  { keywords: ["strawberr"], product: "Fresh Strawberries" },
  { keywords: ["coffee", "cafe"], product: "Green Coffee" },
  { keywords: ["cacao", "cocoa"], product: "Cacao Beans" },
  { keywords: ["iqf", "tropical fruit", "mixed berries"], product: "Mixed Berries / Tropical Fruits (IQF)" },
  { keywords: ["frozen"], product: "Frozen Tropical Fruits" },
];

function classifyProduct(mongoId: string, name: string, description: string): string {
  const override = PRODUCT_OVERRIDE_BY_ID[mongoId.slice(0, 8)];
  if (override) return override;
  const text = `${name} ${description}`.toLowerCase();
  for (const { keywords, product } of PRODUCT_KEYWORD_MAP) {
    if (keywords.some((k) => text.includes(k))) return product;
  }
  return name.trim() || "Unclassified";
}

// --- Route classification ---------------------------------------------------

/** Full country name as it appears in the source CSV's `destination`/`origin` columns. */
function titleCasePort(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w[0]?.toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

/**
 * Canonical `Port, Country` for every port in the route-risk table. Port names
 * are unique across the table, so a port alone identifies its country.
 */
const CANONICAL_LOCATION_BY_PORT = new Map<string, string>(
  ROUTE_OPTIONS.flatMap((entry) => [entry.origin, entry.destination])
    .filter((location) => location.includes(","))
    .map((location) => [
      location.slice(0, location.lastIndexOf(",")).trim().toLowerCase(),
      location,
    ]),
);

/** `"Malaga, China" -> "Malaga, Spain"` → deal count, reported at the end of the run. */
const locationCountryFixes = new Map<string, number>();

function buildLocationString(port: string, country: string): string {
  const p = titleCasePort(port || "");
  const c = country.trim();
  if (!p) return c;
  const asGiven = `${p}, ${c}`;
  const canonical = CANONICAL_LOCATION_BY_PORT.get(p.toLowerCase());
  if (!canonical) return asGiven;
  // Source rows sometimes pair a real port with the wrong country
  // ("Malaga, China", "Callao, Chile"), which silently misses the route lookup
  // and drops the deal onto the generic transport fallback.
  if (canonical.toLowerCase() !== asGiven.toLowerCase()) {
    const key = `${asGiven} -> ${canonical}`;
    locationCountryFixes.set(key, (locationCountryFixes.get(key) ?? 0) + 1);
  }
  return canonical;
}

const TRANSPORT_FALLBACK: Record<string, { transitDays: number; transshipments: number; flag: "Low" | "Medium" | "High" }> = {
  // Air defaults to one hub, not a direct flight: in Peru 2025 customs
  // (Datasur), 53.5% of air export lines clear through a third-country port —
  // Los Angeles, Miami, Madrid, Panama City, Paris, Atlanta. One hub still
  // resolves to the ≤2-stop table; the ≥3-stop table only applies once a real
  // stop count above 2 is supplied on the deal.
  by_air: { transitDays: 10, transshipments: 1, flag: "Medium" },
  sea_freight: { transitDays: 20, transshipments: 1, flag: "Medium" },
};

// --- Coface / milestone helpers ---------------------------------------------

function monthsBetween(a: Date, b: Date): number {
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.round(ms / (1000 * 60 * 60 * 24 * 30));
}

// --- Defaults-applied CSV export ---------------------------------------------

/**
 * A values worksheet for filling deal-level CRAM gaps by hand — NOT a
 * database-ready export (no `mongoId`/`_id` column; those get assigned once
 * these values are actually loaded into a real database — decision
 * 2026-07-28). Company-level fields (RUC, YIB, license, country) live only
 * in company-master.csv — cross-reference by buyerName/supplierName — so
 * they aren't repeated across every deal row a company appears in. One row
 * per real deal, every CRAM-scored field: real value where one exists, the
 * exact default the scoring engine substitutes where it doesn't, and a
 * `*Source` column next to any field with more than one possible
 * provenance so nothing is hidden at runtime. Column groups are labeled
 * with their target ERD v4 entity (`docs/trumarket-database-erd-v4.drawio`).
 * "source" values used throughout: csv | verified | default | sunat |
 * market-intel | table-confirmed | table-provisional | no-data-source.
 *
 * Includes all source rows — `rowType` still distinguishes "real" from
 * "likely_test" as a provenance label (from the raw CSV's `likely_test`
 * column), but since the 2026-07-28 merge decision that label no longer
 * gates scoring/aggregation/market-intel: every row is treated the same.
 */
const DEFAULTS_CSV_HEADER = [
  // --- ERD v4: deals ---
  "rowType",
  "dealRef",
  "product",
  "origin",
  "destination",
  "dealValueUSD",
  "status",
  // --- ERD v4: kybverifications(buyer) + Counterparty(buyer×product) + CofaceBuyerRating/CountryRisk — see company-master.csv for buyer identity/RUC/YIB ---
  "buyerName",
  "buyerYearsInBusiness",
  "buyerYearsInBusinessSource",
  "buyerLicenseValid",
  "buyerLicenseValidSource",
  "buyerCapacityFlag",
  "buyerCapacityFlagSource",
  "cofaceCompanyRiskGrade",
  "cofaceCountryRiskGrade",
  "creditRatingSource",
  // --- ERD v4: kybverifications(supplier) + Counterparty(supplier×product) — see company-master.csv for supplier identity/RUC/YIB ---
  "supplierName",
  "supplierYearsInBusiness",
  "supplierYearsInBusinessSource",
  "supplierLicenseValid",
  "supplierLicenseValidSource",
  "supplierCapacityFlag",
  "supplierCapacityFlagSource",
  "supplierQualityCertifications",
  "supplierQualityCertificationsSource",
  "priorDealsBetweenParties",
  "relationshipAgeMonths",
  // --- ERD v4: Product (reference table) + deal-specific product fields ---
  "offerUnitPriceUSD",
  "shippingStartDate",
  "qualityGrade",
  "qualityGradeSource",
  "perishabilityClass",
  "productRiskTableSource",
  // --- ERD v4: Route(T2) (reference table) + deal-specific route/customs fields ---
  "transportMode",
  "estimatedTransitDays",
  "numberOfTransshipments",
  "routeRiskFlag",
  "routeRiskTableSource",
  "incoterm",
  "incotermSource",
  "coldChainRequired",
  "coldChainProtocolStatus",
  "coldChainProtocolStatusSource",
  "customsClearanceDays",
  "customsClearanceDaysSource",
  "customsNarrative",
  // --- ERD v4: TxStructure ---
  "collateralType",
  "collateralTypeSource",
  "collateralValueUSD",
  "paymentTerms",
  "paymentTermsSource",
  "advancePaymentPct",
  "advancePaymentPctSource",
  "insuranceCoverage",
  "insuranceCoverageSource",
  "insuranceValueUSD",
  // --- ERD v4: CofaceDealDecision (Gate 1 pre-check, not a scored dimension) ---
  "cofaceCoverageAmountUSD",
  "cofaceCoveragePct",
  "cofaceIsDefaulted",
];

function csvEscape(value: string | number | boolean | null): string {
  const s = value === null ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function capacityFlagOf(intel: PlatformDealRecord["marketIntel"], side: "buyer" | "supplier"): string | null {
  if (!intel) return null;
  const profile = side === "buyer" ? intel.dim_a_buyer : intel.dim_a_supplier;
  if (!("capacity_check" in profile)) return null;
  return profile.capacity_check?.flag ?? null;
}

/**
 * ERD v4's `Counterparty` entity is grained by (companyId, productId) — NOT
 * by company alone (that's `companies`, in company-master.csv). 19 scored +
 * 11 blocked = 30 rows total — this is what "30 counterparty rows" refers
 * to; it's a different entity/grain than company-master.csv, not a subset
 * of it. Decision 2026-07-28, after company-master.csv's 19-row count (one
 * per unique company) was mistaken for an incomplete version of this.
 */
function buildCounterpartyCsv(
  scored: PlatformCounterpartyScore[],
  blocked: PlatformCounterpartyBlocked[],
): string {
  const header = [
    "companyName",
    "role",
    "product",
    "status",
    "dealCount",
    "finishedDealCount",
    "yearsInBusiness",
    "yearsInBusinessSource",
    "avgScore",
    "maxScore",
    "minScore",
    "missingForFullCram",
  ];
  const lines = [header.join(",")];
  for (const c of scored) {
    lines.push(
      [
        c.companyName,
        c.role,
        c.product,
        "scored",
        c.dealCount,
        c.finishedDealCount,
        c.yearsInBusiness,
        c.yearsInBusinessSource,
        c.avgScore,
        c.maxScore,
        c.minScore,
        c.missingForFullCram.join(" | "),
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  for (const c of blocked) {
    lines.push(
      [
        c.companyName,
        c.role,
        c.product,
        "blocked",
        c.dealCount,
        c.finishedDealCount,
        "", // no YIB at all — that's why it's blocked
        "default",
        "", // no score computed
        "",
        "",
        `${c.role}.yearsInBusiness`,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\n") + "\n";
}

function buildDefaultsCsv(records: PlatformDealRecord[]): string {
  const lines = [DEFAULTS_CSV_HEADER.join(",")];
  const hasCofaceDoc = records.filter((r) => !r.cofaceIsDefaulted).length;
  for (const r of records) {
    const rowType = r.likelyTest === "likely_test" ? "likely_test" : "real";
    const supplierSunatResolved = r.marketIntel?.dim_a_supplier.sunat?.resolved ?? false;
    const supplierSunat = r.marketIntel?.dim_a_supplier.sunat;
    const buyerCapacityFlag = capacityFlagOf(r.marketIntel, "buyer");
    const supplierCapacityFlag = capacityFlagOf(r.marketIntel, "supplier");
    const productTableConfirmed = !r.missingFields.some((f) => f.startsWith("product risk table"));
    const routeTableConfirmed = !r.missingFields.some((f) => f.startsWith("route risk table"));

    lines.push(
      [
        rowType,
        r.dealRef,
        r.product,
        r.origin,
        r.destination,
        r.dealValueUSD,
        r.status,
        // kybverifications(buyer) + Counterparty + CofaceBuyerRating/CountryRisk
        r.buyerName,
        r.buyerYib,
        r.buyerYibSource,
        true, // DEFAULT (decision 2026-07-24): no license/KYC source for buyers anywhere — always assumed valid
        "default",
        buyerCapacityFlag,
        buyerCapacityFlag ? "market-intel" : "no-data-source (quantity has no kg/carton unit — see docs)",
        null, // DEFAULT: Coface grades never populated by the CSV pipeline (only via manual document-upload flow)
        null,
        `no-data-source (${hasCofaceDoc} of ${records.length} deals have a Coface document on file)`,
        // kybverifications(supplier) + Counterparty
        r.supplierName,
        r.supplierYib,
        r.supplierYibSource,
        supplierSunatResolved
          ? (supplierSunat?.estado === "ACTIVO" || !supplierSunat?.estado) &&
            (supplierSunat?.condicion === "HABIDO" || !supplierSunat?.condicion)
          : true, // DEFAULT when SUNAT didn't resolve: assumed valid
        supplierSunatResolved ? "sunat" : "default",
        supplierCapacityFlag,
        supplierCapacityFlag ? "market-intel" : "no-data-source (quantity has no kg/carton unit — see docs)",
        null, // DEFAULT: no certification data source exists anywhere (CSV, docs, or market-intel)
        "no-data-source",
        r.priorDealsBetweenParties,
        r.relationshipAgeMonths,
        // Dimension B
        r.offerUnitPriceUSD,
        r.shippingStartDate,
        "Grade A / Class I", // DEFAULT (platform-deal-mapper.ts): no per-deal quality-grade source
        "default",
        r.perishabilityClass,
        productTableConfirmed ? "table-confirmed" : "table-provisional (perishability-bucket fallback)",
        // Dimension C
        r.transportMode,
        r.estimatedTransitDays,
        r.numberOfTransshipments,
        r.routeRiskFlag,
        routeTableConfirmed ? "table-confirmed" : "table-provisional (transport-mode fallback)",
        "FOB", // DEFAULT (platform-deal-mapper.ts): no incoterm column in the source CSV
        "default",
        r.coldChainRequired,
        r.coldChainRequired ? "documented" : null, // DEFAULT: optimistic default whenever cold-chain is required — no source distinguishes documented vs incomplete
        r.coldChainRequired ? "default (optimistic — no per-shipment signal exists)" : null,
        null, // DEFAULT: customsNarrative is unparsed free text, not a structured day count
        "no-data-source",
        r.customsNarrative,
        // Dimension D
        "None", // DEFAULT (platform-deal-mapper.ts): no collateral source in any CSV
        "default",
        0,
        "Documentary / against BL (platform default)",
        "default",
        0,
        "default",
        "None", // DEFAULT — also the spec §6 veto trigger. See CargoInsuranceSection.tsx / npm run validate.
        "default (⚠ triggers mandatory veto)",
        0,
        // Coface Gate 1
        r.cofaceCoverageAmountUSD,
        r.cofaceCoveragePct,
        r.cofaceIsDefaulted,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\n") + "\n";
}

function main() {
  const csvText = readFileSync(SOURCE_CSV, "utf-8");
  const allRows = parseCsvRecords(csvText);

  const companyMaster: CompanyMasterEntry[] = JSON.parse(
    readFileSync(join(OUT_DIR, "company-master.json"), "utf-8"),
  );
  const companyByKey = new Map(companyMaster.map((c) => [c.key, c]));

  // Group by buyer+supplier pair (all rows — merged per decision 2026-07-28)
  // for relationship signals.
  interface PairAgg {
    dealCount: number;
    createdAtDates: Date[];
  }
  const pairAgg = new Map<string, PairAgg>();
  function pairKeyFor(row: Record<string, string>): string {
    const buyerCompany = safeJsonParse(row.buyerCompany);
    const supplierCompany = safeJsonParse(row.supplierCompany);
    const buyerName = (buyerCompany?.name as string) || row.buyerCompanyNames?.split("|")[0] || "";
    const supplierName = (supplierCompany?.name as string) || row.supplierCompanyNames?.split("|")[0] || "";
    return `${companyGroupKey(buyerName)}::${companyGroupKey(supplierName)}`;
  }
  for (const row of allRows) {
    const key = pairKeyFor(row);
    let agg = pairAgg.get(key);
    if (!agg) {
      agg = { dealCount: 0, createdAtDates: [] };
      pairAgg.set(key, agg);
    }
    agg.dealCount += 1;
    const d = new Date(row.createdAt);
    if (row.createdAt && !Number.isNaN(d.getTime())) agg.createdAtDates.push(d);
  }

  const records: PlatformDealRecord[] = [];
  const productMissCount = new Map<string, number>();
  const routeMissCount = new Map<string, number>();
  let airStopsDefaulted = 0;

  for (const row of allRows) {
    const buyerCompany = safeJsonParse(row.buyerCompany);
    const supplierCompany = safeJsonParse(row.supplierCompany);

    const buyerRawName = (buyerCompany?.name as string) || row.buyerCompanyNames?.split("|")[0] || "";
    const supplierRawName = (supplierCompany?.name as string) || row.supplierCompanyNames?.split("|")[0] || "";
    const buyerName = normalizeCompanyName(buyerRawName) || "Unknown buyer";
    const supplierName = normalizeCompanyName(supplierRawName) || "Unknown supplier";
    const buyerMaster = companyByKey.get(companyGroupKey(buyerRawName));
    const supplierMaster = companyByKey.get(companyGroupKey(supplierRawName));

    const product = classifyProduct(row._id, row.name, row.description);
    const hsResolved = resolveHsProduct({ product });
    const hsCode = hsResolved?.hsCode ?? null;
    const hsHeading4Val = hsHeading4(hsCode) ?? hsResolved?.hsHeading4 ?? null;
    const productProfile = lookupProductRisk(product, hsCode);
    if (!productProfile) productMissCount.set(product, (productMissCount.get(product) ?? 0) + 1);

    const originStr = buildLocationString(row.portOfOrigin, row.origin);
    const destStr = buildLocationString(row.portOfDestination, row.destination);
    const transportMode: "air" | "sea" | null =
      row.transport === "by_air" ? "air" : row.transport === "sea_freight" ? "sea" : null;
    const transportFallback = TRANSPORT_FALLBACK[row.transport] ?? TRANSPORT_FALLBACK.sea_freight;
    // Air stop counts aren't in the source CSV — assume one hub (see
    // TRANSPORT_FALLBACK). Sea adopts corridor facts from the matched ocean
    // table row after lookup.
    const provisionalStops =
      transportMode === "air" ? transportFallback.transshipments : 0;
    if (transportMode === "air") airStopsDefaulted += 1;
    const routeProfile = lookupRouteRisk(
      originStr,
      destStr,
      product,
      transportMode,
      provisionalStops,
    );
    if (!routeProfile) routeMissCount.set(`${originStr} -> ${destStr}`, (routeMissCount.get(`${originStr} -> ${destStr}`) ?? 0) + 1);

    const pairKey = pairKeyFor(row);
    const agg = pairAgg.get(pairKey) ?? { dealCount: 0, createdAtDates: [] };
    // Simplification (documented in docs/product-route-table-gaps-2026-07.md):
    // every deal within a pair gets the same priorDealsBetweenParties value
    // (pairTotal - 1) — real per-row deal sequencing isn't reliable enough
    // (many createdAt values are blank) to assign a distinct "N prior" count
    // per row within the pair.
    const priorDealsBetweenParties = Math.max(0, agg.dealCount - 1);
    let relationshipAgeMonths = 0;
    if (agg.createdAtDates.length >= 2) {
      const sorted = [...agg.createdAtDates].sort((a, b) => a.getTime() - b.getTime());
      relationshipAgeMonths = monthsBetween(sorted[0], sorted[sorted.length - 1]);
    }

    const offerUnitPriceUSD = row.offerUnitPrice ? parseNumber(row.offerUnitPrice) : null;

    const dealValueUSD = parseNumber(row.investmentAmount) || parseNumber(row.dealValue);
    const hasRealCoface = row.cofaceRecordId.trim() !== "";
    const cofaceCoverageAmountUSD = hasRealCoface ? dealValueUSD : Math.round(dealValueUSD * 0.9 * 100) / 100;
    const cofaceCoveragePct = hasRealCoface ? 100 : 90;
    const cofaceIsDefaulted = !hasRealCoface;

    const buyerYib = buyerMaster?.yearsInBusiness ?? null;
    const supplierYib = supplierMaster?.yearsInBusiness ?? null;

    // Market-intel (Peru customs + SUNAT) enrichment — applied to every row
    // (merged per decision 2026-07-28), only gated on the supplier resolving
    // to a valid Peru RUC. See scripts/lib/market-intel-cli.ts. Feeds
    // buyer/supplier capacity points in computeBuyerScore()/computeSupplierScore()
    // (src/lib/scoring.ts).
    // Fixed 2026-07-28: was always "<quantity> units", which parseDealKg()
    // could never match (no "kg"/"carton" token), so dealKg/dealPriceUsdPerKg
    // were null for 100% of deals. `quantity` is a pack count (cartons/boxes),
    // not a weight — the real per-pack weight lives in the CSV's free-text
    // `presentation` column (e.g. "CARTON X 1.5KG"). Embedding both lets
    // parseDealKg() recover total kg — verified against real DUA customs
    // records for several deals (e.g. 1,200 × "CARTON X 1.5KG" = 1,800kg,
    // matching that deal's own customs narrative exactly).
    const quantityLabel = row.quantity
      ? row.presentation
        ? `${row.quantity} x ${row.presentation}`
        : `${row.quantity} units`
      : "";
    let marketIntel = null;
    const supplierRuc = supplierMaster ? extractValidRuc(supplierMaster.taxIds) : null;
    if (supplierRuc) {
      const dealKg = parseDealKg({ quantityLabel, dealValueUSD }) ?? undefined;
      marketIntel = fetchMarketIntelSync({
        exporterRuc: supplierRuc,
        importerName: buyerName,
        originCountry: customsOriginCountry(originStr) ?? undefined,
        destinationCountry: customsDestinationCountry(destStr) ?? undefined,
        variety: customsVariety(product, row.variety) ?? undefined,
        dealWeek: row.shippingStartDate
          ? dealWeekFor(new Date(row.shippingStartDate))
          : row.createdAt
            ? dealWeekFor(new Date(row.createdAt))
            : undefined,
        dealKg,
        dealPriceUsdPerKg: dealPricePerKg({ quantityLabel, dealValueUSD }) ?? undefined,
      });
    }

    const missingFields: string[] = [];
    if (buyerYib === null) missingFields.push("buyer.yearsInBusiness");
    if (supplierYib === null) missingFields.push("supplier.yearsInBusiness");
    if (!row.customs) missingFields.push("customs export narrative");
    // Coface coverage is never null/zero — it's always a real, persisted value (either
    // a real record's or the 90%-of-dealValue default) — so it's not a "missing field"
    // gap. cofaceIsDefaulted still distinguishes the two cases on the record itself.
    if (!productProfile?.scoreConfirmed) missingFields.push("product risk table row (provisional, not AC-confirmed)");
    if (!routeProfile) missingFields.push("route risk table row (transport-mode fallback used)");
    // No source anywhere in the CSV — platform-deal-mapper.ts hardcodes
    // "None", which is also a spec §6 veto trigger (mandatory insurance
    // floor). Surfaced here (not just cofaceIsDefaulted-style silent
    // default) since it forces every deal to the "Veto" tier — decision
    // 2026-07-27, see npm run validate.
    missingFields.push("cargo insurance coverage (defaults to None — triggers veto)");
    // PlatformDealRecord has no field for this at all — cofaceCompanyRiskGrade/
    // cofaceCountryRiskGrade only ever get set via the manual Assess Deal
    // wizard's Coface document-upload flow, never by the CSV pipeline. Same
    // class of gap as cargo insurance above, just missed when that entry was
    // added — decision 2026-07-28. Buyer-only: creditRatingPoints() is read
    // inside computeBuyerScore(), not computeSupplierScore() — Coface is
    // buyer-default credit insurance.
    missingFields.push("buyer credit rating (Coface CRA/DRA — no document uploaded)");

    const status = row.status;
    const currentMilestone = normalizeDealMilestone(status, parseNumber(row.currentMilestone));

    const record: PlatformDealRecord = {
      id: uniqueDealId(row._id),
      mongoId: row._id,
      dealRef: row.name || row._id,
      product,
      hsCode,
      hsHeading4: hsHeading4Val,
      variety: row.variety || "",
      quantityLabel,
      presentation: row.presentation?.trim() || null,
      quantityKg: parseDealKg({ quantityLabel, dealValueUSD }),
      dealValueUSD,
      origin: originStr,
      destination: destStr,
      portOfOrigin: row.portOfOrigin?.trim() || null,
      portOfDestination: row.portOfDestination?.trim() || null,
      shipmentCompany: null,
      buyerName,
      supplierName,
      buyerYib,
      supplierYib,
      buyerYibSource: buyerMaster?.yearsInBusinessSource ?? "default",
      supplierYibSource: supplierMaster?.yearsInBusinessSource ?? "default",
      perishabilityClass: productProfile?.perishabilityClass ?? "Perishable",
      shelfLifeDays: productProfile?.shelfLifeDays ?? null,
      coldChainRequired: productProfile?.coldChainRequired ?? true,
      estimatedTransitDays: routeProfile?.estimatedTransitDays ?? transportFallback.transitDays,
      numberOfTransshipments:
        transportMode === "air"
          ? provisionalStops
          : (routeProfile?.numberOfTransshipments ?? transportFallback.transshipments),
      routeRiskFlag: routeProfile?.routeRiskFlag ?? transportFallback.flag,
      transportMode,
      offerUnitPriceUSD,
      shippingStartDate: row.shippingStartDate?.trim() || null,
      priorDealsBetweenParties,
      relationshipAgeMonths,
      status,
      likelyTest: (row.likely_test as DataQualityFlag) || "unverified",
      currentMilestone,
      customsNarrative: row.customs || null,
      cofaceCoverageAmountUSD,
      cofaceCoveragePct,
      cofaceIsDefaulted,
      counterpartyReady: buyerYib !== null && supplierYib !== null,
      marketIntel,
      // Retired 2026-07-24: the old "HTML formula tester" pre-computation
      // this fed is gone. Real counterparty/overall scores are computed live
      // via computeCounterpartyScore()/computeOverallScore() through
      // platformDealToDeal() — see PlatformCounterpartyScore below for the
      // pair-level aggregate built the same way.
      htmlFormulaScore: null,
      htmlFormulaBase: null,
      htmlFormulaBonus: null,
      missingFields: [...new Set(missingFields)],
      createdAt: row.createdAt || "",
    };

    records.push(record);
  }

  // --- PlatformCounterpartyScore aggregation — per (company, role, product),
  // not per buyer+supplier pair. Matches the ERD: `Counterparty` is a
  // per-company-per-role entity with its own `riskScore`, and `CRAM
  // Assessment` references buyerCounterpartyId/supplierCounterpartyId as two
  // separate Counterparty records, not a merged pair (decision 2026-07-27).
  // computeBuyerScore()/computeSupplierScore() directly — the blended
  // buyer×0.5+supplier×0.5+relationship score (computeCounterpartyScore) is
  // still used, but only inside a single deal's own overall CRAM composite
  // (see computeOverallScore), not for this per-counterparty rollup.
  //
  // Inclusion is gated per-role, not by `counterpartyReady` (which requires
  // BOTH parties' YIB known — a deal-level concept for the composite score).
  // A buyer with known YIB belongs here regardless of whether the specific
  // supplier they were paired with in some deal happens to be missing YIB —
  // decision 2026-07-27, fixing a case where a fully-known buyer could be
  // invisible from this tab just because of their counterparty's gap.
  interface RoleGroup {
    companyName: string;
    role: "buyer" | "supplier";
    product: string;
    records: PlatformDealRecord[];
  }
  const byRoleGroup = new Map<string, RoleGroup>();
  const byRoleGroupBlocked = new Map<string, RoleGroup>();
  for (const record of records) {
    for (const role of ["buyer", "supplier"] as const) {
      const companyName = role === "buyer" ? record.buyerName : record.supplierName;
      const yib = role === "buyer" ? record.buyerYib : record.supplierYib;
      const key = `${role}::${companyGroupKey(companyName)}::${record.product}`;
      const targetMap = yib !== null ? byRoleGroup : byRoleGroupBlocked;
      let group = targetMap.get(key);
      if (!group) {
        group = { companyName, role, product: record.product, records: [] };
        targetMap.set(key, group);
      }
      group.records.push(record);
    }
  }

  const counterpartyBlocked: PlatformCounterpartyBlocked[] = [...byRoleGroupBlocked.values()]
    .map((group) => {
      const idKey = `${group.role}-${companyGroupKey(group.companyName)}-${group.product}`;
      return {
        // No length cap — a cap here previously truncated long company names
        // before the product suffix ever appeared, colliding multiple
        // (company, product) rows for the same long-named company into one
        // id (React key), which corrupts list rendering. IDs aren't
        // user-facing, so there's no reason to keep them short.
        id: `cpb-${idKey.replace(/[^A-Z0-9]/gi, "")}`,
        companyName: group.companyName,
        role: group.role,
        product: group.product,
        dealCount: group.records.length,
        finishedDealCount: group.records.filter((r) => r.currentMilestone >= 7).length,
        deals: group.records.map((r) => ({
          mongoId: r.mongoId,
          name: r.dealRef,
          status: r.status,
          milestone: r.currentMilestone,
          dealValue: r.dealValueUSD,
        })),
      };
    })
    .sort((a, b) => b.dealCount - a.dealCount);

  const counterpartyScores: PlatformCounterpartyScore[] = [...byRoleGroup.values()]
    .map((group) => {
      const scoreFn = group.role === "buyer" ? computeBuyerScore : computeSupplierScore;
      const scored = group.records.map((r) => ({
        record: r,
        score: Math.round(scoreFn(platformDealToDeal(r))),
      }));
      const scores = scored.map((s) => s.score);
      const finishedCount = group.records.filter((r) => r.currentMilestone >= 7).length;
      const yib = group.role === "buyer" ? group.records[0].buyerYib : group.records[0].supplierYib;
      const yibSource =
        group.role === "buyer" ? group.records[0].buyerYibSource : group.records[0].supplierYibSource;
      const idKey = `${group.role}-${companyGroupKey(group.companyName)}-${group.product}`;
      return {
        // No length cap — see note on counterpartyBlocked's id above; same
        // bug applied here (confirmed: TRU MARKET BLOCKCHAIN S.A.C.'s
        // supplier rows for 3 different products collided into one id).
        id: `cp-${idKey.replace(/[^A-Z0-9]/gi, "")}`,
        companyName: group.companyName,
        role: group.role,
        product: group.product,
        yearsInBusiness: yib ?? 0,
        yearsInBusinessSource: yibSource,
        dealCount: group.records.length,
        finishedDealCount: finishedCount,
        avgScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
        maxScore: Math.max(...scores),
        minScore: Math.min(...scores),
        deals: scored.map(({ record, score }) => ({
          mongoId: record.mongoId,
          name: record.dealRef,
          status: record.status,
          milestone: record.currentMilestone,
          dealValue: record.dealValueUSD,
          score,
          priorDeals: record.priorDealsBetweenParties,
        })),
        missingForFullCram: [
          ...new Set(group.records.flatMap((r) => r.missingFields)),
        ],
      };
    })
    .sort((a, b) => b.dealCount - a.dealCount);

  writeFileSync(join(OUT_DIR, "platform-deals.generated.json"), JSON.stringify(records, null, 2) + "\n");
  writeFileSync(join(OUT_DIR, "platform-deals-with-defaults.csv"), buildDefaultsCsv(records));
  writeFileSync(
    join(OUT_DIR, "counterparty-scores.csv"),
    buildCounterpartyCsv(counterpartyScores, counterpartyBlocked),
  );

  const tsFile = `/** Auto-generated by scripts/build-platform-deals.ts from full-deals-dataset-2026-07 (1).csv — do not edit by hand. */
/** likely_test rows are merged into platformDeals/platformCounterparties/scoring like every other row — decision 2026-07-28 (reverses the 2026-07-27 exclusion). \`likelyTest\` on each record is a provenance label only. Defaults: buyer/supplier license=true (mapper); coface coverage=90% of dealValueUSD when no real cofaceRecordId (flagged cofaceIsDefaulted). See docs/cram-defaults-and-formula-2026-07.md. */
import type { PlatformCounterpartyScore, PlatformCounterpartyBlocked, PlatformDealRecord } from "../types/platform";

export const platformDeals: PlatformDealRecord[] = ${JSON.stringify(records, null, 2)};

export const platformCounterparties: PlatformCounterpartyScore[] = ${JSON.stringify(counterpartyScores, null, 2)};

/** (company, role, product) groups with no YIB at all — reported here, not just Missing fields, so a buyer/supplier's absence from the scored list above is visible in this tab too (decision 2026-07-27). */
export const platformCounterpartiesBlocked: PlatformCounterpartyBlocked[] = ${JSON.stringify(counterpartyBlocked, null, 2)};

export const platformDealsReadyForCounterparty = platformDeals.filter((d) => d.counterpartyReady);
export const platformDealsBlocked = platformDeals.filter((d) => !d.counterpartyReady);
`;
  writeFileSync(join(OUT_DIR, "platform-deals.ts"), tsFile);

  const readyCount = records.filter((r) => r.counterpartyReady).length;
  const marketIntelCount = records.filter((r) => r.marketIntel !== null).length;
  const supplierCapacityKnown = records.filter(
    (r) => r.marketIntel?.dim_a_supplier.capacity_check,
  ).length;
  const likelyTestCount = records.filter((r) => r.likelyTest === "likely_test").length;
  console.log(`Built ${records.length} deals (${likelyTestCount} likely_test-labeled, merged into scoring per decision 2026-07-28).`);
  console.log(`${readyCount} counterparty-ready.`);
  console.log(`${counterpartyScores.length} scored (company, role, product) counterparty profiles; ${counterpartyBlocked.length} blocked (missing YIB).`);
  console.log(`Market-intel: ${marketIntelCount}/${records.length} deals got a response (valid Peru supplier RUC resolved); ${supplierCapacityKnown} of those have a usable supplier capacity_check (shipment history in this data bundle).`);
  console.log(`Products with no confirmed table row (deal count): ${[...productMissCount.entries()].map(([p, n]) => `${p}=${n}`).join(", ") || "none"}`);
  console.log(`Air deals with an assumed stop count (${airStopsDefaulted}) — none reach the ≥3-stop table until a real count is supplied.`);
  console.log(`Port/country conflicts reconciled against the route table (${locationCountryFixes.size}):`);
  for (const [fix, n] of locationCountryFixes) console.log(`  ${fix} (${n} deals)`);
  console.log(`Distinct unmatched routes (${routeMissCount.size}):`);
  for (const [route, n] of routeMissCount) console.log(`  ${route} (${n} deals)`);
  console.log(
    "NOTE: Dimension A scores above are from deal-level computeBuyerScore without customs enrichment. Run `npm run recalc-counterparties` to apply weighted/shrink + customs and rewrite platformCounterparties.",
  );
}

main();
