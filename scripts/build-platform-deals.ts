/**
 * Regenerates src/data/platform-deals.generated.json + platform-deals.ts from
 * full-deals-dataset-2026-07 (1).csv (the CSV of record as of 2026-07-24 —
 * all future regenerations should point at whichever file supersedes this one).
 *
 * What this does that the old (undated) generator didn't:
 *  - Excludes `likely_test` rows from scoring/aggregates (synthetic/seeded data),
 *    but still builds and exports them separately (`platformDealsSynthetic`) so
 *    all 170 source rows are reported somewhere — decision 2026-07-27
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
import { lookupRouteRisk } from "../src/lib/route-risk-tables";
import { normalizeDealMilestone } from "../src/lib/deal-milestone";
import { platformDealToDeal } from "../src/lib/platform-deal-mapper";
import { computeBuyerScore, computeSupplierScore } from "../src/lib/scoring";
import {
  customsDestinationCountry,
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const DESKTOP = join(process.env.HOME ?? "", "Desktop");
const SOURCE_CSV = join(DESKTOP, "full-deals-dataset-2026-07 (1).csv");
const OUT_DIR = join(__dirname, "..", "src", "data");

interface CompanyMasterEntry {
  key: string;
  name: string;
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

function buildLocationString(port: string, country: string): string {
  const p = titleCasePort(port || "");
  const c = country.trim();
  if (!p) return c;
  return `${p}, ${c}`;
}

const TRANSPORT_FALLBACK: Record<string, { transitDays: number; transshipments: number; flag: "Low" | "Medium" | "High" }> = {
  by_air: { transitDays: 10, transshipments: 0, flag: "Medium" },
  sea_freight: { transitDays: 20, transshipments: 1, flag: "Medium" },
};

// --- Coface / milestone helpers ---------------------------------------------

function monthsBetween(a: Date, b: Date): number {
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.round(ms / (1000 * 60 * 60 * 24 * 30));
}

// --- Defaults-applied CSV export ---------------------------------------------

/**
 * Every CRAM-scored field, per deal — real value where one exists, the exact
 * default the scoring engine substitutes where it doesn't, and a `*Source`
 * column next to any field with more than one possible provenance so nothing
 * is hidden at runtime. Expanded 2026-07-27 from an 18-column partial export
 * (Dimension A/some-of-C/D only) to cover all four dimensions + the veto
 * register, once the insurance-coverage veto finding made clear that a
 * narrower export could hide the single biggest gap in the whole pipeline.
 * "source" values used throughout: csv | default | sunat | market-intel |
 * table-confirmed | table-provisional | no-data-source.
 */
const DEFAULTS_CSV_HEADER = [
  "dealRef",
  "mongoId",
  "product",
  "origin",
  "destination",
  "dealValueUSD",
  "status",
  // --- Dimension A: Counterparty (40%) ---
  "buyerName",
  "buyerYearsInBusiness",
  "buyerYearsInBusinessSource",
  "buyerLicenseValid",
  "buyerLicenseValidSource",
  "buyerCapacityFlag",
  "buyerCapacityFlagSource",
  "supplierName",
  "supplierYearsInBusiness",
  "supplierYearsInBusinessSource",
  "supplierLicenseValid",
  "supplierLicenseValidSource",
  "supplierCapacityFlag",
  "supplierCapacityFlagSource",
  "supplierQualityCertifications",
  "supplierQualityCertificationsSource",
  "cofaceCompanyRiskGrade",
  "cofaceCountryRiskGrade",
  "creditRatingSource",
  "priorDealsBetweenParties",
  "relationshipAgeMonths",
  // --- Dimension B: Product (25%) ---
  "offerUnitPriceUSD",
  "qualityGrade",
  "qualityGradeSource",
  "perishabilityClass",
  "productRiskTableSource",
  // --- Dimension C: Route (20%) ---
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
  // --- Dimension D: Transaction Structure (15%) ---
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
  // --- Coface Gate 1 (pre-check, not a scored dimension) ---
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

function buildDefaultsCsv(records: PlatformDealRecord[]): string {
  const lines = [DEFAULTS_CSV_HEADER.join(",")];
  for (const r of records) {
    const supplierSunatResolved = r.marketIntel?.dim_a_supplier.sunat?.resolved ?? false;
    const supplierSunat = r.marketIntel?.dim_a_supplier.sunat;
    const buyerCapacityFlag = capacityFlagOf(r.marketIntel, "buyer");
    const supplierCapacityFlag = capacityFlagOf(r.marketIntel, "supplier");
    const productTableConfirmed = !r.missingFields.some((f) => f.startsWith("product risk table"));
    const routeTableConfirmed = !r.missingFields.some((f) => f.startsWith("route risk table"));

    lines.push(
      [
        r.dealRef,
        r.mongoId,
        r.product,
        r.origin,
        r.destination,
        r.dealValueUSD,
        r.status,
        // Dimension A
        r.buyerName,
        r.buyerYib,
        r.buyerYibSource,
        true, // DEFAULT (decision 2026-07-24): no license/KYC source for buyers anywhere — always assumed valid
        "default",
        buyerCapacityFlag,
        buyerCapacityFlag ? "market-intel" : "no-data-source (quantity has no kg/carton unit — see docs)",
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
        null, // DEFAULT: Coface grades never populated by the CSV pipeline (only via manual document-upload flow)
        null,
        "no-data-source (0 of 84 real deals have a Coface document on file)",
        r.priorDealsBetweenParties,
        r.relationshipAgeMonths,
        // Dimension B
        r.offerUnitPriceUSD,
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

  const excludedTestCount = allRows.filter((r) => r.likely_test === "likely_test").length;
  const rows = allRows.filter((r) => r.likely_test !== "likely_test");

  // Group by buyer+supplier pair (real rows only) for relationship signals.
  // Synthetic/test rows are still built into full records below (so all 170
  // rows are reported somewhere, per decision 2026-07-27) but never enter
  // this aggregation, never get counterpartyReady=true, and never appear in
  // platformDeals/platformCounterparties — only in the separate
  // platformDealsSynthetic export.
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
  for (const row of rows) {
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
  const syntheticRecords: PlatformDealRecord[] = [];
  const productMissCount = new Map<string, number>();
  const routeMissCount = new Map<string, number>();

  for (const row of allRows) {
    const isSynthetic = row.likely_test === "likely_test";
    const buyerCompany = safeJsonParse(row.buyerCompany);
    const supplierCompany = safeJsonParse(row.supplierCompany);

    const buyerRawName = (buyerCompany?.name as string) || row.buyerCompanyNames?.split("|")[0] || "";
    const supplierRawName = (supplierCompany?.name as string) || row.supplierCompanyNames?.split("|")[0] || "";
    const buyerName = normalizeCompanyName(buyerRawName) || "Unknown buyer";
    const supplierName = normalizeCompanyName(supplierRawName) || "Unknown supplier";
    const buyerMaster = companyByKey.get(companyGroupKey(buyerRawName));
    const supplierMaster = companyByKey.get(companyGroupKey(supplierRawName));

    const product = classifyProduct(row._id, row.name, row.description);
    const productProfile = lookupProductRisk(product);
    // Miss-counters only track real rows — synthetic gaps shouldn't skew what looks worth building a table row for.
    if (!productProfile && !isSynthetic) productMissCount.set(product, (productMissCount.get(product) ?? 0) + 1);

    const originStr = buildLocationString(row.portOfOrigin, row.origin);
    const destStr = buildLocationString(row.portOfDestination, row.destination);
    const routeProfile = lookupRouteRisk(originStr, destStr);
    if (!routeProfile && !isSynthetic) routeMissCount.set(`${originStr} -> ${destStr}`, (routeMissCount.get(`${originStr} -> ${destStr}`) ?? 0) + 1);
    const transportFallback = TRANSPORT_FALLBACK[row.transport] ?? TRANSPORT_FALLBACK.sea_freight;

    const pairKey = pairKeyFor(row);
    // Synthetic rows' pairs usually aren't in pairAgg at all (built from real
    // rows only) — default to 0 rather than asserting non-null.
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

    const transportMode: "air" | "sea" | null =
      row.transport === "by_air" ? "air" : row.transport === "sea_freight" ? "sea" : null;
    const offerUnitPriceUSD = row.offerUnitPrice ? parseNumber(row.offerUnitPrice) : null;

    const dealValueUSD = parseNumber(row.investmentAmount) || parseNumber(row.dealValue);
    const hasRealCoface = row.cofaceRecordId.trim() !== "";
    const cofaceCoverageAmountUSD = hasRealCoface ? dealValueUSD : Math.round(dealValueUSD * 0.9 * 100) / 100;
    const cofaceCoveragePct = hasRealCoface ? 100 : 90;
    const cofaceIsDefaulted = !hasRealCoface;

    const buyerYib = buyerMaster?.yearsInBusiness ?? null;
    const supplierYib = supplierMaster?.yearsInBusiness ?? null;

    // Market-intel (Peru customs + SUNAT) enrichment — real rows only, and
    // only when the supplier resolves to a valid Peru RUC. See
    // scripts/lib/market-intel-cli.ts. Feeds buyer/supplier capacity points
    // in computeBuyerScore()/computeSupplierScore() (src/lib/scoring.ts).
    const quantityLabel = row.quantity ? `${row.quantity} units` : "";
    let marketIntel = null;
    if (!isSynthetic) {
      const supplierRuc = supplierMaster ? extractValidRuc(supplierMaster.taxIds) : null;
      if (supplierRuc) {
        const dealKg = parseDealKg({ quantityLabel, dealValueUSD }) ?? undefined;
        marketIntel = fetchMarketIntelSync({
          exporterRuc: supplierRuc,
          importerName: buyerName,
          destinationCountry: customsDestinationCountry(destStr) ?? undefined,
          variety: customsVariety(product, row.variety) ?? undefined,
          dealWeek: row.createdAt ? dealWeekFor(new Date(row.createdAt)) : undefined,
          dealKg,
          dealPriceUsdPerKg: dealPricePerKg({ quantityLabel, dealValueUSD }) ?? undefined,
        });
      }
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
    // default) since it forces every real deal to the "Veto" tier — decision
    // 2026-07-27, see npm run validate.
    if (!isSynthetic) missingFields.push("cargo insurance coverage (defaults to None — triggers veto)");

    const status = row.status;
    const currentMilestone = normalizeDealMilestone(status, parseNumber(row.currentMilestone));

    const record: PlatformDealRecord = {
      id: `plat-${row._id.slice(0, 8)}`,
      mongoId: row._id,
      dealRef: row.name || row._id,
      product,
      variety: row.variety || "",
      quantityLabel,
      dealValueUSD,
      origin: originStr,
      destination: destStr,
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
      numberOfTransshipments: routeProfile?.numberOfTransshipments ?? transportFallback.transshipments,
      routeRiskFlag: routeProfile?.routeRiskFlag ?? transportFallback.flag,
      transportMode,
      offerUnitPriceUSD,
      priorDealsBetweenParties,
      relationshipAgeMonths,
      status,
      likelyTest: (row.likely_test as DataQualityFlag) || "unverified",
      currentMilestone,
      customsNarrative: row.customs || null,
      cofaceCoverageAmountUSD,
      cofaceCoveragePct,
      cofaceIsDefaulted,
      // Synthetic/test rows are never counterparty-ready, regardless of YIB —
      // keeps them out of platformDealsReadyForCounterparty/Blocked entirely
      // even if a fake company name happens to collide with a real one.
      counterpartyReady: !isSynthetic && buyerYib !== null && supplierYib !== null,
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

    if (isSynthetic) {
      syntheticRecords.push(record);
    } else {
      records.push(record);
    }
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

  const tsFile = `/** Auto-generated by scripts/build-platform-deals.ts from full-deals-dataset-2026-07 (1).csv — do not edit by hand. */
/** likely_test rows are still fully built (see platformDealsSynthetic below) but never enter platformDeals/platformCounterparties/scoring — decision 2026-07-27. Defaults: buyer/supplier license=true (mapper); coface coverage=90% of dealValueUSD when no real cofaceRecordId (flagged cofaceIsDefaulted). See docs/cram-defaults-and-formula-2026-07.md. */
import type { PlatformCounterpartyScore, PlatformCounterpartyBlocked, PlatformDealRecord } from "../types/platform";

export const platformDeals: PlatformDealRecord[] = ${JSON.stringify(records, null, 2)};

export const platformCounterparties: PlatformCounterpartyScore[] = ${JSON.stringify(counterpartyScores, null, 2)};

/** (company, role, product) groups with no YIB at all — reported here, not just Missing fields, so a buyer/supplier's absence from the scored list above is visible in this tab too (decision 2026-07-27). */
export const platformCounterpartiesBlocked: PlatformCounterpartyBlocked[] = ${JSON.stringify(counterpartyBlocked, null, 2)};

export const platformDealsReadyForCounterparty = platformDeals.filter((d) => d.counterpartyReady);
export const platformDealsBlocked = platformDeals.filter((d) => !d.counterpartyReady);

/** The ${syntheticRecords.length} \`likely_test\` rows (synthetic/seed data) — reported for full 170-row transparency (decision 2026-07-27), excluded from all scoring/aggregates. Never counterpartyReady. */
export const platformDealsSynthetic: PlatformDealRecord[] = ${JSON.stringify(syntheticRecords, null, 2)};
`;
  writeFileSync(join(OUT_DIR, "platform-deals.ts"), tsFile);

  const readyCount = records.filter((r) => r.counterpartyReady).length;
  const marketIntelCount = records.filter((r) => r.marketIntel !== null).length;
  const supplierCapacityKnown = records.filter(
    (r) => r.marketIntel?.dim_a_supplier.capacity_check,
  ).length;
  console.log(`Excluded ${excludedTestCount} likely_test rows out of ${allRows.length} total (still built into platformDealsSynthetic).`);
  console.log(`Kept ${records.length} real/unverified deals; ${readyCount} counterparty-ready.`);
  console.log(`${counterpartyScores.length} scored (company, role, product) counterparty profiles; ${counterpartyBlocked.length} blocked (missing YIB).`);
  console.log(`Market-intel: ${marketIntelCount}/${records.length} deals got a response (valid Peru supplier RUC resolved); ${supplierCapacityKnown} of those have a usable supplier capacity_check (shipment history in this data bundle).`);
  console.log(`Products with no confirmed table row (deal count): ${[...productMissCount.entries()].map(([p, n]) => `${p}=${n}`).join(", ") || "none"}`);
  console.log(`Distinct unmatched routes (${routeMissCount.size}):`);
  for (const [route, n] of routeMissCount) console.log(`  ${route} (${n} deals)`);
}

main();
