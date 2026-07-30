/**
 * Apply Dimension A (weighted/shrink + customs enrichment) to platform deals
 * and counterparty rollups. Rewrites src/data/platform-deals.ts.
 *
 * Run:
 *   python3 scripts/aggregate-customs-companies.py   # optional refresh
 *   npx tsx scripts/recalculate-counterparty-scores.ts
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { companyGroupKey } from "./lib/company-name";
import {
  platformCounterpartiesBlocked,
  platformDeals,
} from "../src/data/platform-deals";
import {
  scoreBuyer,
  scoreSupplier,
  type GroupScoreResult,
  type SandboxBuyerInputs,
  type SandboxSupplierInputs,
} from "../src/lib/counterparty-sandbox-scoring";
import type {
  CounterpartyCustomsEnrichment,
  PlatformCounterpartyScore,
  PlatformDealRecord,
} from "../src/types/platform";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "src", "data");

interface CustomsCompany {
  key: string;
  name: string;
  roles: string[];
  rucs: string[];
  shipments: number;
  kgNet: number;
  fobUsd: number;
  volumeMt: number;
  routeCount: number;
  partnerCount: number;
  destCountries: string[];
  activityMonths: number | null;
  monthlyFobUsd: number | null;
  sources: string[];
}

interface CustomsPayload {
  generatedAt: string;
  sourceFiles: string[];
  companyCount: number;
  companies: CustomsCompany[];
}

const CUSTOMS_NAME_ALIASES: Record<string, string> = {
  "GIDDINS PERU SAC": "GIDDINGS BERRIES PERU S.A.C.",
  "GIDDINGS PERU SAC": "GIDDINGS BERRIES PERU S.A.C.",
  "GOURMET & BEVERAGE ONE GROUP (THAILAND) CO LTD":
    "GOURMET Y BEVERAGE ONE GROUP THAILAND CO LTD",
  "GOURMET & BEVERAGE ONE GROUP THAILAND CO LTD":
    "GOURMET Y BEVERAGE ONE GROUP THAILAND CO LTD",
};

function normalizeMatchKey(raw: string): string {
  return companyGroupKey(raw)
    .replace(/\([^)]*\)/g, " ")
    .replace(/&/g, " ")
    .replace(/\bY\b/g, " ")
    .replace(/\bAND\b/g, " ")
    .replace(/\b(SAC|SA|LTD|LLC|INC|CORP|BV|SL|GMBH|LDA|CO)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function loadCustoms(): Map<string, CustomsCompany> {
  const raw = JSON.parse(
    readFileSync(join(DATA, "customs-company-aggregates.json"), "utf-8"),
  ) as CustomsPayload;
  const map = new Map<string, CustomsCompany>();
  for (const c of raw.companies) map.set(c.key, c);
  return map;
}

function loadCompanyMasterRucs(): Map<string, string[]> {
  try {
    const master = JSON.parse(
      readFileSync(join(DATA, "company-master.json"), "utf-8"),
    ) as Array<{ name: string; taxIds: string[] }>;
    const map = new Map<string, string[]>();
    for (const m of master) {
      map.set(companyGroupKey(m.name), m.taxIds ?? []);
    }
    return map;
  } catch {
    return new Map();
  }
}

function buildRucIndex(customsMap: Map<string, CustomsCompany>): Map<string, CustomsCompany> {
  const byRuc = new Map<string, CustomsCompany>();
  for (const c of customsMap.values()) {
    for (const ruc of c.rucs) {
      if (ruc) byRuc.set(String(ruc).trim(), c);
    }
  }
  return byRuc;
}

function findCustoms(
  map: Map<string, CustomsCompany>,
  companyName: string,
  rucIndex: Map<string, CustomsCompany>,
  masterRucs: Map<string, string[]>,
): CustomsCompany | null {
  const key = companyGroupKey(companyName);
  for (const tax of masterRucs.get(key) ?? []) {
    const hit = rucIndex.get(String(tax).trim());
    if (hit) return hit;
  }
  const alias =
    CUSTOMS_NAME_ALIASES[key] ??
    CUSTOMS_NAME_ALIASES[companyName] ??
    CUSTOMS_NAME_ALIASES[companyGroupKey(companyName)];
  if (alias) {
    const aliasKey = companyGroupKey(alias);
    if (map.has(aliasKey)) return map.get(aliasKey)!;
    for (const [k, v] of map) {
      if (k.includes(aliasKey) || aliasKey.includes(k)) return v;
    }
  }
  if (map.has(key)) return map.get(key)!;
  const nk = normalizeMatchKey(companyName);
  if (nk.length >= 12) {
    let best: CustomsCompany | null = null;
    let bestShip = -1;
    for (const [k, v] of map) {
      const ck = normalizeMatchKey(k);
      if (ck === nk) return v;
      const shorter = ck.length <= nk.length ? ck : nk;
      const longer = ck.length > nk.length ? ck : nk;
      if (shorter.length >= 12 && longer.includes(shorter) && v.shipments > bestShip) {
        best = v;
        bestShip = v.shipments;
      }
    }
    if (best) return best;
  }
  for (const [k, v] of map) {
    if (key.length >= 14 && (k.includes(key) || key.includes(k))) return v;
  }
  return null;
}

function toEnrichment(customs: CustomsCompany | null): CounterpartyCustomsEnrichment {
  if (!customs) {
    return {
      matched: false,
      monthlyFobUsd: null,
      fobUsd: null,
      volumeMt: null,
      routeCount: null,
      roles: [],
      shipments: 0,
    };
  }
  return {
    matched: true,
    monthlyFobUsd: customs.monthlyFobUsd,
    fobUsd: customs.fobUsd,
    volumeMt: customs.volumeMt,
    routeCount: customs.routeCount,
    roles: customs.roles,
    shipments: customs.shipments,
  };
}

function isTmEntity(name: string): boolean {
  const k = companyGroupKey(name);
  return k.includes("TRU MARKET") || k.includes("TRUMARKET");
}

function buyerInputs(
  companyName: string,
  yearsInBusiness: number | null,
  platformDealCount: number,
  enrichment: CounterpartyCustomsEnrichment,
): SandboxBuyerInputs {
  const onPlatform = platformDealCount > 0;
  return {
    yearsInBusiness,
    onlineVerifiability: enrichment.matched ? 55 : null,
    importLicenseStatus: 100,
    importLicenseTm: isTmEntity(companyName) ? 100 : null,
    monthlyPurchaseVolumeUsd: enrichment.monthlyFobUsd,
    yearlySalesUsd: enrichment.fobUsd,
    annualImportVolumeMt: enrichment.roles.includes("importer")
      ? enrichment.volumeMt
      : null,
    routeDiversity: enrichment.routeCount,
    creditRating: null,
    platformTransactionCount: platformDealCount > 0 ? platformDealCount : null,
    paymentDelayDays: null,
    tmPlatformTrust: onPlatform || isTmEntity(companyName),
  };
}

function supplierInputs(
  companyName: string,
  yearsInBusiness: number | null,
  platformDealCount: number,
  finishedDealCount: number,
  enrichment: CounterpartyCustomsEnrichment,
): SandboxSupplierInputs {
  const onPlatform = platformDealCount > 0;
  const onTime =
    platformDealCount > 0
      ? Math.round((finishedDealCount / platformDealCount) * 100)
      : null;
  return {
    yearsInBusiness,
    onlineVerifiability: enrichment.matched ? 55 : null,
    exportLicenseStatus: 100,
    productionCapacityMt: enrichment.volumeMt,
    yearlySalesUsd: enrichment.fobUsd,
    annualExportVolumeMt: enrichment.roles.includes("exporter")
      ? enrichment.volumeMt
      : enrichment.volumeMt,
    routeDiversity: enrichment.routeCount,
    qualityCertifications: null,
    platformTransactionCount: platformDealCount > 0 ? platformDealCount : null,
    onTimeDeliveryRate: onTime,
    qualityRejectionRate: null,
    tmPlatformTrust: onPlatform || isTmEntity(companyName),
  };
}

interface ProfileMeta {
  dealCount: number;
  finishedCount: number;
  yearsInBusiness: number | null;
  yearsInBusinessSource: "csv" | "verified" | "default";
  enrichment: CounterpartyCustomsEnrichment;
  result: GroupScoreResult;
  product: string;
  role: "buyer" | "supplier";
  companyName: string;
}

function main() {
  const customsPayload = JSON.parse(
    readFileSync(join(DATA, "customs-company-aggregates.json"), "utf-8"),
  ) as CustomsPayload;
  const customsMap = loadCustoms();
  const rucIndex = buildRucIndex(customsMap);
  const masterRucs = loadCompanyMasterRucs();

  // Group (company, role, product) for profile counts
  type Group = {
    companyName: string;
    role: "buyer" | "supplier";
    product: string;
    records: PlatformDealRecord[];
  };
  const byGroup = new Map<string, Group>();
  for (const record of platformDeals) {
    for (const role of ["buyer", "supplier"] as const) {
      const companyName = role === "buyer" ? record.buyerName : record.supplierName;
      const yib = role === "buyer" ? record.buyerYib : record.supplierYib;
      if (yib === null) continue;
      const key = `${role}::${companyGroupKey(companyName)}::${record.product}`;
      let g = byGroup.get(key);
      if (!g) {
        g = { companyName, role, product: record.product, records: [] };
        byGroup.set(key, g);
      }
      g.records.push(record);
    }
  }

  const profileByKey = new Map<string, ProfileMeta>();
  for (const group of byGroup.values()) {
    const key = `${group.role}::${companyGroupKey(group.companyName)}::${group.product}`;
    const dealCount = group.records.length;
    const finishedCount = group.records.filter((r) => r.currentMilestone >= 7).length;
    const yib =
      group.role === "buyer"
        ? group.records[0].buyerYib
        : group.records[0].supplierYib;
    const yibSource =
      group.role === "buyer"
        ? group.records[0].buyerYibSource
        : group.records[0].supplierYibSource;
    const customs = findCustoms(
      customsMap,
      group.companyName,
      rucIndex,
      masterRucs,
    );
    const enrichment = toEnrichment(customs);
    const result =
      group.role === "buyer"
        ? scoreBuyer(
            buyerInputs(group.companyName, yib, dealCount, enrichment),
          )
        : scoreSupplier(
            supplierInputs(
              group.companyName,
              yib,
              dealCount,
              finishedCount,
              enrichment,
            ),
          );
    profileByKey.set(key, {
      dealCount,
      finishedCount,
      yearsInBusiness: yib,
      yearsInBusinessSource: yibSource,
      enrichment,
      result,
      product: group.product,
      role: group.role,
      companyName: group.companyName,
    });
  }

  // Enrich every deal record with profile counts + customs
  const records: PlatformDealRecord[] = platformDeals.map((r) => {
    const buyerKey = `buyer::${companyGroupKey(r.buyerName)}::${r.product}`;
    const supplierKey = `supplier::${companyGroupKey(r.supplierName)}::${r.product}`;
    const buyer = profileByKey.get(buyerKey);
    const supplier = profileByKey.get(supplierKey);
    const buyerCustoms = buyer?.enrichment ?? toEnrichment(
      findCustoms(customsMap, r.buyerName, rucIndex, masterRucs),
    );
    const supplierCustoms = supplier?.enrichment ?? toEnrichment(
      findCustoms(customsMap, r.supplierName, rucIndex, masterRucs),
    );
    return {
      ...r,
      buyerProfileDealCount: buyer?.dealCount ?? 1,
      buyerProfileFinishedCount: buyer?.finishedCount ?? (r.currentMilestone >= 7 ? 1 : 0),
      supplierProfileDealCount: supplier?.dealCount ?? 1,
      supplierProfileFinishedCount:
        supplier?.finishedCount ?? (r.currentMilestone >= 7 ? 1 : 0),
      buyerCustomsEnrichment: buyerCustoms.matched ? buyerCustoms : null,
      supplierCustomsEnrichment: supplierCustoms.matched ? supplierCustoms : null,
    };
  });

  const counterpartyScores: PlatformCounterpartyScore[] = [...profileByKey.values()]
    .map((p) => {
      const score = Math.round(p.result.score * 10) / 10;
      const coveragePct = Math.round(p.result.coverageFraction * 1000) / 10;
      const idKey = `${p.role}-${companyGroupKey(p.companyName)}-${p.product}`;
      const groupRecords = records.filter((r) => {
        const name = p.role === "buyer" ? r.buyerName : r.supplierName;
        return (
          companyGroupKey(name) === companyGroupKey(p.companyName) &&
          r.product === p.product
        );
      });
      return {
        id: `cp-${idKey.replace(/[^A-Z0-9]/gi, "")}`,
        companyName: p.companyName,
        role: p.role,
        product: p.product,
        yearsInBusiness: p.yearsInBusiness ?? 0,
        yearsInBusinessSource: p.yearsInBusinessSource,
        dealCount: p.dealCount,
        finishedDealCount: p.finishedCount,
        avgScore: score,
        maxScore: score,
        minScore: score,
        deals: groupRecords.map((record) => ({
          mongoId: record.mongoId,
          name: record.dealRef,
          status: record.status,
          milestone: record.currentMilestone,
          dealValue: record.dealValueUSD,
          score,
          priorDeals: record.priorDealsBetweenParties,
        })),
        missingForFullCram: [
          ...new Set(groupRecords.flatMap((r) => r.missingFields)),
        ],
        coveragePct,
        rawAverage:
          p.result.rawAverage === null
            ? null
            : Math.round(p.result.rawAverage * 10) / 10,
        trustBonus: p.result.trustBonus,
        customsMatched: p.enrichment.matched,
        customsShipments: p.enrichment.shipments,
        customsVolumeMt: p.enrichment.volumeMt,
        customsFobUsd: p.enrichment.fobUsd,
        customsRoutes: p.enrichment.routeCount,
        filledFieldIds: p.result.fields
          .filter((f) => f.score != null)
          .map((f) => f.id),
      };
    })
    .sort((a, b) => b.dealCount - a.dealCount || b.avgScore - a.avgScore);

  // Sanity: live deal scores should match rollup for same company×product
  let mismatch = 0;
  for (const record of records.filter((r) => r.counterpartyReady).slice(0, 20)) {
    const buyerKey = `buyer::${companyGroupKey(record.buyerName)}::${record.product}`;
    const profile = profileByKey.get(buyerKey);
    if (!profile) continue;
    const live = Math.round(scoreBuyer(buyerInputs(
      record.buyerName,
      record.buyerYib,
      record.buyerProfileDealCount,
      record.buyerCustomsEnrichment ?? toEnrichment(null),
    )).score);
    const expected = Math.round(profile.result.score);
    if (live !== expected) mismatch++;
  }

  writeFileSync(join(DATA, "platform-deals.generated.json"), JSON.stringify(records, null, 2) + "\n");

  const csvHeader = [
    "companyName",
    "role",
    "product",
    "status",
    "dealCount",
    "finishedDealCount",
    "yearsInBusiness",
    "yearsInBusinessSource",
    "avgScore",
    "coveragePct",
    "rawAverage",
    "trustBonus",
    "customsMatched",
    "customsShipments",
    "customsVolumeMt",
    "customsRoutes",
    "filledFields",
  ];
  const csvLines = [csvHeader.join(",")];
  const esc = (s: string | number | null | undefined) => {
    if (s === null || s === undefined) return "";
    const t = String(s);
    return t.includes(",") || t.includes('"') ? `"${t.replace(/"/g, '""')}"` : t;
  };
  for (const c of counterpartyScores) {
    csvLines.push(
      [
        esc(c.companyName),
        c.role,
        esc(c.product),
        "scored",
        c.dealCount,
        c.finishedDealCount,
        c.yearsInBusiness,
        c.yearsInBusinessSource,
        c.avgScore,
        c.coveragePct ?? "",
        c.rawAverage ?? "",
        c.trustBonus ?? "",
        c.customsMatched ? "yes" : "no",
        c.customsShipments ?? "",
        c.customsVolumeMt ?? "",
        c.customsRoutes ?? "",
        esc((c.filledFieldIds ?? []).join("|")),
      ].join(","),
    );
  }
  writeFileSync(join(DATA, "counterparty-scores.csv"), csvLines.join("\n") + "\n");

  const tsFile = `/** Auto-generated by scripts/build-platform-deals.ts / recalculate-counterparty-scores.ts — do not edit by hand. */
/** Dimension A = weighted/shrink formula (outline 2026-07-30) + customs enrichment. See docs/counterparty-risk-scoring-method-outline-2026-07-30.md. */
import type { PlatformCounterpartyScore, PlatformCounterpartyBlocked, PlatformDealRecord } from "../types/platform";

export const platformDeals: PlatformDealRecord[] = ${JSON.stringify(records, null, 2)};

export const platformCounterparties: PlatformCounterpartyScore[] = ${JSON.stringify(counterpartyScores, null, 2)};

/** (company, role, product) groups with no YIB at all — reported here, not just Missing fields, so a buyer/supplier's absence from the scored list above is visible in this tab too (decision 2026-07-27). */
export const platformCounterpartiesBlocked: PlatformCounterpartyBlocked[] = ${JSON.stringify(platformCounterpartiesBlocked, null, 2)};

export const platformDealsReadyForCounterparty = platformDeals.filter((d) => d.counterpartyReady);
export const platformDealsBlocked = platformDeals.filter((d) => !d.counterpartyReady);
`;
  writeFileSync(join(DATA, "platform-deals.ts"), tsFile);

  // Remove dual sandbox artifact stream
  for (const f of [
    join(DATA, "counterparty-sandbox-scores.json"),
    join(DATA, "counterparty-sandbox-scores.ts"),
  ]) {
    if (existsSync(f)) unlinkSync(f);
  }

  const matched = counterpartyScores.filter((c) => c.customsMatched).length;
  const avg =
    counterpartyScores.reduce((s, c) => s + c.avgScore, 0) /
    Math.max(1, counterpartyScores.length);
  console.log(
    `Scored ${counterpartyScores.length} counterparties (avg ${avg.toFixed(1)}); ${matched} customs-matched.`,
  );
  console.log(`Enriched ${records.length} platform deals with profile counts + customs.`);
  console.log(`Deal↔profile buyer sanity mismatches (sample): ${mismatch}`);
  console.log(`Customs aggregate generatedAt=${customsPayload.generatedAt}`);
  console.log("Wrote platform-deals.ts, counterparty-scores.csv; removed sandbox dual files.");
}

main();
