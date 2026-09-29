/**
 * Apply docs/platform-deals-with-defaults-2.csv onto the live platform deal book.
 *
 * The defaults CSV is the curated export (transit, mode, YIB, OD, prior deals, …)
 * but lacks mongoId / quantity / variety. We match each row onto
 * platform-deals.generated.json and overlay the curated fields, then rewrite
 * platform-deals.ts + companion CSVs.
 *
 * Run: npx tsx scripts/apply-platform-defaults-csv.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsvRecords } from "./lib/csv";
import { companyGroupKey } from "./lib/company-name";
import { lookupProductRisk } from "../src/lib/product-risk-tables";
import { lookupRouteRisk } from "../src/lib/route-risk-tables";
import {
  hsHeading4,
  normalizeHsCode,
  resolveHsProduct,
} from "../src/lib/hs-product-map";
import { platformDealToDeal } from "../src/lib/platform-deal-mapper";
import { computeBuyerScore, computeSupplierScore } from "../src/lib/scoring";
import type {
  DataQualityFlag,
  PlatformCounterpartyBlocked,
  PlatformCounterpartyScore,
  PlatformDealRecord,
} from "../src/types/platform";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "src", "data");
const DEFAULTS_CSV = join(ROOT, "docs", "platform-deals-with-defaults-2.csv");

function normName(s: string): string {
  return companyGroupKey(s);
}

function parseNum(raw: string | undefined | null): number | null {
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(String(raw).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function parseBool(raw: string | undefined | null): boolean | null {
  if (raw == null || String(raw).trim() === "") return null;
  const s = String(raw).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  return null;
}

// `new Date("21/11/2025")` is Invalid Date in V8, and `new Date("08/02/2025")`
// silently misreads it as MM/DD (day↔month swapped) — neither is caught by a
// plain Number.isNaN check on the happy path, so DD/MM/YYYY values from the
// defaults CSV must be parsed explicitly rather than handed to `new Date`.
function parseCsvDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function matchKey(dealRef: string, buyer: string, supplier: string, value: number): string {
  return `${dealRef.trim()}::${normName(buyer)}::${normName(supplier)}::${Math.round(value)}`;
}

function softKey(buyer: string, supplier: string, value: number): string {
  return `${normName(buyer)}::${normName(supplier)}::${Math.round(value)}`;
}

function loadDefaultsRows(): Record<string, string>[] {
  // File may be latin-1 / mac-roman with mojibake; decode leniently then strip NULs.
  const buf = readFileSync(DEFAULTS_CSV);
  const text = buf.toString("latin1").replace(/\u0000/g, "").replace(/^\uFEFF/, "");
  return parseCsvRecords(text);
}

function applyOverlay(
  record: PlatformDealRecord,
  row: Record<string, string>,
): PlatformDealRecord {
  const product = (row.product || record.product).trim() || record.product;
  const hsFromRow = (row.hsCode || row.hs_code || "").trim();
  const hsResolved = resolveHsProduct({
    hsCode: hsFromRow || record.hsCode,
    product,
  });
  const hsCode =
    normalizeHsCode(hsFromRow) ??
    normalizeHsCode(record.hsCode) ??
    hsResolved?.hsCode ??
    null;
  const hsHeading4Val = hsHeading4(hsCode);
  const productProfile = lookupProductRisk(product, hsCode);
  const origin = (row.origin || record.origin).trim() || record.origin;
  const destination = (row.destination || record.destination).trim() || record.destination;
  const transportRaw = (row.transportMode || "").trim().toLowerCase();
  const transportMode: "air" | "sea" | null =
    transportRaw === "air" || transportRaw === "by_air"
      ? "air"
      : transportRaw === "sea" || transportRaw === "sea_freight"
        ? "sea"
        : record.transportMode;

  const estimatedTransitDays =
    parseNum(row.estimatedTransitDays) ?? record.estimatedTransitDays;
  const numberOfTransshipments =
    parseNum(row.numberOfTransshipments) ?? record.numberOfTransshipments;

  const flagRaw = (row.routeRiskFlag || record.routeRiskFlag || "Medium").trim();
  const routeRiskFlag =
    flagRaw === "Low" || flagRaw === "Medium" || flagRaw === "High"
      ? flagRaw
      : record.routeRiskFlag;

  const perishRaw = (row.perishabilityClass || record.perishabilityClass).trim();
  const perishabilityClass =
    perishRaw === "Ultra-Perishable" ||
    perishRaw === "Perishable" ||
    perishRaw === "Semi-Perishable" ||
    perishRaw === "Non-Perishable"
      ? perishRaw
      : record.perishabilityClass;

  const coldChainRequired =
    parseBool(row.coldChainRequired) ??
    productProfile?.coldChainRequired ??
    record.coldChainRequired;

  const buyerYib = parseNum(row.buyerYearsInBusiness);
  const supplierYib = parseNum(row.supplierYearsInBusiness);
  const priorDealsBetweenParties =
    parseNum(row.priorDealsBetweenParties) ?? record.priorDealsBetweenParties;
  const relationshipAgeMonths =
    parseNum(row.relationshipAgeMonths) ?? record.relationshipAgeMonths;
  const offerUnitPriceUSD =
    parseNum(row.offerUnitPriceUSD) ?? record.offerUnitPriceUSD;
  const dealValueUSD = parseNum(row.dealValueUSD) ?? record.dealValueUSD;

  const cofaceCoverageAmountUSD =
    parseNum(row.cofaceCoverageAmountUSD) ?? record.cofaceCoverageAmountUSD;
  const cofaceCoveragePct =
    parseNum(row.cofaceCoveragePct) ?? record.cofaceCoveragePct;
  const cofaceIsDefaulted =
    parseBool(row.cofaceIsDefaulted) ?? record.cofaceIsDefaulted;

  const rowType = (row.rowType || "").trim();
  let likelyTest: DataQualityFlag = record.likelyTest;
  if (rowType === "likely_test") likelyTest = "likely_test";
  else if (rowType === "real") likelyTest = "real";
  else if (rowType === "unverified" || rowType === "likely real") {
    likelyTest = rowType as DataQualityFlag;
  }

  // Refresh route table hit after ports are known (below).

  const shippingStartDate =
    row.shipmentDate && row.shipmentDate.trim()
      ? (() => {
          const d = parseCsvDate(row.shipmentDate);
          return d ? d.toISOString() : record.shippingStartDate;
        })()
      : record.shippingStartDate;

  const presentation =
    (row.presentation || "").trim() || record.presentation || null;
  const quantityKg = parseNum(row.quantityKg) ?? record.quantityKg ?? null;
  const portOfOrigin =
    (row.portOfOrigin || "").trim() || record.portOfOrigin || null;
  const portOfDestination =
    (row.portOfDestination || "").trim() || record.portOfDestination || null;
  const shipmentCompany =
    (row.shipmentCompany || "").trim() || record.shipmentCompany || null;

  const customsNarrative =
    row.customsNarrative?.trim() === ""
      ? null
      : row.customsNarrative?.trim() || record.customsNarrative || null;

  // Prefer named ports for Dimension C when present.
  const originForRoute = portOfOrigin || origin;
  const destinationForRoute = portOfDestination || destination;

  // Refresh route table hit with overlay OD/mode/stops (Dimension C v2).
  const routeProfile = lookupRouteRisk(
    originForRoute,
    destinationForRoute,
    product,
    transportMode,
    numberOfTransshipments,
  );

  const missingFields = (record.missingFields || []).filter((f) => {
    if (
      customsNarrative &&
      f.toLowerCase().includes("customs export narrative")
    ) {
      return false;
    }
    return true;
  });

  const buyerYibSource = (row.buyerYearsInBusinessSource ||
    record.buyerYibSource) as PlatformDealRecord["buyerYibSource"];
  const supplierYibSource = (row.supplierYearsInBusinessSource ||
    record.supplierYibSource) as PlatformDealRecord["supplierYibSource"];

  return {
    ...record,
    dealRef: (row.dealRef || record.dealRef).trim() || record.dealRef,
    product,
    hsCode,
    hsHeading4: hsHeading4Val,
    dealValueUSD,
    origin,
    destination,
    portOfOrigin,
    portOfDestination,
    presentation,
    quantityKg,
    shipmentCompany,
    buyerName: (row.buyerName || record.buyerName).trim() || record.buyerName,
    supplierName:
      (row.supplierName || record.supplierName).trim() || record.supplierName,
    buyerYib: buyerYib ?? record.buyerYib,
    supplierYib: supplierYib ?? record.supplierYib,
    buyerYibSource:
      buyerYibSource === "csv" || buyerYibSource === "verified" || buyerYibSource === "default"
        ? buyerYibSource
        : record.buyerYibSource,
    supplierYibSource:
      supplierYibSource === "csv" ||
      supplierYibSource === "verified" ||
      supplierYibSource === "default"
        ? supplierYibSource
        : record.supplierYibSource,
    perishabilityClass,
    shelfLifeDays: productProfile?.shelfLifeDays ?? record.shelfLifeDays,
    coldChainRequired,
    estimatedTransitDays:
      routeProfile?.estimatedTransitDays ?? estimatedTransitDays,
    numberOfTransshipments,
    routeRiskFlag: routeProfile?.routeRiskFlag ?? routeRiskFlag,
    transportMode,
    offerUnitPriceUSD,
    shippingStartDate,
    priorDealsBetweenParties,
    relationshipAgeMonths,
    status: (row.status || record.status).trim() || record.status,
    likelyTest,
    customsNarrative,
    missingFields,
    cofaceCoverageAmountUSD,
    cofaceCoveragePct,
    cofaceIsDefaulted,
    // counterpartyReady stays driven by YIB presence
    counterpartyReady:
      (buyerYib ?? record.buyerYib) != null &&
      (supplierYib ?? record.supplierYib) != null,
  };
}

function rebuildCounterparties(records: PlatformDealRecord[]): {
  scores: PlatformCounterpartyScore[];
  blocked: PlatformCounterpartyBlocked[];
} {
  type Group = {
    companyName: string;
    role: "buyer" | "supplier";
    product: string;
    records: PlatformDealRecord[];
  };
  const byRoleGroup = new Map<string, Group>();
  const byRoleGroupBlocked = new Map<string, Group>();

  for (const r of records) {
    for (const role of ["buyer", "supplier"] as const) {
      const companyName = role === "buyer" ? r.buyerName : r.supplierName;
      const yib = role === "buyer" ? r.buyerYib : r.supplierYib;
      const key = `${role}::${companyGroupKey(companyName)}::${r.product}`;
      const target = yib == null ? byRoleGroupBlocked : byRoleGroup;
      let g = target.get(key);
      if (!g) {
        g = { companyName, role, product: r.product, records: [] };
        target.set(key, g);
      }
      g.records.push(r);
    }
  }

  const blocked: PlatformCounterpartyBlocked[] = [...byRoleGroupBlocked.values()]
    .map((group) => {
      const idKey = `${group.role}-${companyGroupKey(group.companyName)}-${group.product}`;
      return {
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

  const scores: PlatformCounterpartyScore[] = [...byRoleGroup.values()]
    .map((group) => {
      const scoreFn = group.role === "buyer" ? computeBuyerScore : computeSupplierScore;
      const scored = group.records.map((r) => ({
        record: r,
        score: Math.round(scoreFn(platformDealToDeal(r))),
      }));
      const scoreVals = scored.map((s) => s.score);
      const finishedCount = group.records.filter((r) => r.currentMilestone >= 7).length;
      const yib =
        group.role === "buyer" ? group.records[0].buyerYib : group.records[0].supplierYib;
      const yibSource =
        group.role === "buyer"
          ? group.records[0].buyerYibSource
          : group.records[0].supplierYibSource;
      const idKey = `${group.role}-${companyGroupKey(group.companyName)}-${group.product}`;
      return {
        id: `cp-${idKey.replace(/[^A-Z0-9]/gi, "")}`,
        companyName: group.companyName,
        role: group.role,
        product: group.product,
        yearsInBusiness: yib ?? 0,
        yearsInBusinessSource: yibSource,
        dealCount: group.records.length,
        finishedDealCount: finishedCount,
        avgScore: Math.round((scoreVals.reduce((a, b) => a + b, 0) / scoreVals.length) * 10) / 10,
        maxScore: Math.max(...scoreVals),
        minScore: Math.min(...scoreVals),
        deals: scored.map(({ record, score }) => ({
          mongoId: record.mongoId,
          name: record.dealRef,
          status: record.status,
          milestone: record.currentMilestone,
          dealValue: record.dealValueUSD,
          score,
          priorDeals: record.priorDealsBetweenParties,
        })),
        missingForFullCram: [...new Set(group.records.flatMap((r) => r.missingFields))],
      };
    })
    .sort((a, b) => b.dealCount - a.dealCount);

  return { scores, blocked };
}

function main() {
  const existing = JSON.parse(
    readFileSync(join(DATA, "platform-deals.generated.json"), "utf8"),
  ) as PlatformDealRecord[];

  const byHard = new Map<string, PlatformDealRecord[]>();
  const bySoft = new Map<string, PlatformDealRecord[]>();
  const byRef = new Map<string, PlatformDealRecord[]>();
  for (const r of existing) {
    const hard = matchKey(r.dealRef, r.buyerName, r.supplierName, r.dealValueUSD);
    const soft = softKey(r.buyerName, r.supplierName, r.dealValueUSD);
    const ref = r.dealRef.trim();
    if (!byHard.has(hard)) byHard.set(hard, []);
    byHard.get(hard)!.push(r);
    if (!bySoft.has(soft)) bySoft.set(soft, []);
    bySoft.get(soft)!.push(r);
    if (!byRef.has(ref)) byRef.set(ref, []);
    byRef.get(ref)!.push(r);
  }

  const defaults = loadDefaultsRows();
  const used = new Set<string>();
  const updated: PlatformDealRecord[] = [];
  let hardHits = 0;
  let softHits = 0;
  let refHits = 0;
  let misses = 0;

  for (const row of defaults) {
    const value = parseNum(row.dealValueUSD) ?? 0;
    const hard = matchKey(row.dealRef || "", row.buyerName || "", row.supplierName || "", value);
    const soft = softKey(row.buyerName || "", row.supplierName || "", value);
    const unused = (list: PlatformDealRecord[] | undefined) =>
      (list || []).filter((r) => !used.has(r.mongoId));

    // Prefer exact (ref+parties+value), then parties+value, then dealRef.
    // When the defaults CSV duplicates a lane (same key on N rows) and the
    // deal book has N twin mongoIds, take the first unused hit each pass.
    let hits = unused(byHard.get(hard));
    let how: "hard" | "soft" | "ref" | "miss" = "hard";
    if (hits.length === 0) {
      hits = unused(bySoft.get(soft)).filter(
        (r) => r.dealRef.trim() === (row.dealRef || "").trim(),
      );
      // Soft key alone can collide across different dealRefs (same buyer/
      // supplier/value); require dealRef when using soft.
      if (hits.length === 0) {
        hits = unused(bySoft.get(soft));
      }
      how = "soft";
    }
    if (hits.length === 0) {
      const ref = (row.dealRef || "").trim();
      hits = unused(byRef.get(ref)).filter(
        (r) => Math.round(r.dealValueUSD) === Math.round(value),
      );
      if (hits.length === 0) hits = unused(byRef.get(ref));
      how = "ref";
    }
    if (hits.length === 0) {
      misses += 1;
      console.warn(
        `No unique match for defaults row: ${row.dealRef} | ${row.buyerName} → ${row.supplierName} | $${value}`,
      );
      continue;
    }
    if (how === "hard") hardHits += 1;
    else if (how === "soft") softHits += 1;
    else refHits += 1;
    const base = hits[0];
    used.add(base.mongoId);
    updated.push(applyOverlay(base, row));
  }

  // Keep any existing deals that were not in the defaults CSV (should be none if complete).
  const leftovers = existing.filter((r) => !used.has(r.mongoId));
  const records = [...updated, ...leftovers];

  const { scores, blocked } = rebuildCounterparties(records);

  writeFileSync(join(DATA, "platform-deals.generated.json"), JSON.stringify(records, null, 2) + "\n");

  const tsFile = `/** Auto-generated by scripts/apply-platform-defaults-csv.ts from docs/platform-deals-with-defaults-2.csv (overlay on prior platform-deals.generated.json) — do not edit by hand. */
/** likely_test rows are merged into platformDeals/platformCounterparties/scoring like every other row — decision 2026-07-28 (reverses the 2026-07-27 exclusion). \`likelyTest\` is a provenance label only. Defaults: buyer/supplier license=true (mapper); coface coverage=90% of dealValueUSD when no real cofaceRecordId (flagged cofaceIsDefaulted). See docs/cram-defaults-and-formula-2026-07.md. */
import type { PlatformCounterpartyScore, PlatformCounterpartyBlocked, PlatformDealRecord } from "../types/platform";

export const platformDeals: PlatformDealRecord[] = ${JSON.stringify(records, null, 2)};

export const platformCounterparties: PlatformCounterpartyScore[] = ${JSON.stringify(scores, null, 2)};

/** (company, role, product) groups with no YIB at all — reported here, not just Missing fields, so a buyer/supplier's absence from the scored list above is visible in this tab too (decision 2026-07-27). */
export const platformCounterpartiesBlocked: PlatformCounterpartyBlocked[] = ${JSON.stringify(blocked, null, 2)};

export const platformDealsReadyForCounterparty = platformDeals.filter((d) => d.counterpartyReady);
export const platformDealsBlocked = platformDeals.filter((d) => !d.counterpartyReady);
`;
  writeFileSync(join(DATA, "platform-deals.ts"), tsFile);

  // Refresh the in-repo defaults export copy (UTF-8) for convenience.
  writeFileSync(
    join(DATA, "platform-deals-with-defaults.csv"),
    readFileSync(DEFAULTS_CSV).toString("latin1"),
  );

  console.log(
    `Applied ${defaults.length} defaults rows → ${updated.length} overlays (hard=${hardHits}, soft=${softHits}, ref=${refHits}, miss=${misses}); leftovers=${leftovers.length}.`,
  );
  console.log(
    `Wrote ${records.length} deals, ${scores.length} counterparties, ${blocked.length} blocked.`,
  );
}

main();
