/**
 * Recalculate platform counterparty scores with the sandbox weighted/shrink
 * formula (outline 2026-07-30), enriching volume / routes / sales from
 * customs-company-aggregates.json.
 *
 * Run:
 *   python3 scripts/aggregate-customs-companies.py
 *   npx tsx scripts/recalculate-counterparty-scores.ts
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { companyGroupKey } from "./lib/company-name";
import { parseCsvRecords } from "./lib/csv";
import {
  platformCounterparties,
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
import type { PlatformCounterpartyScore } from "../src/types/platform";
import { lookupOnlineVerifiability } from "../src/lib/counterparty-research-overrides";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "src", "data");
const DOCS = join(__dirname, "..", "docs");
const DESKTOP = join(process.env.HOME ?? "", "Desktop");
const OUTLINE = join(DESKTOP, "counterparty-risk-scoring-method-outline-2026-07-30.md");
const MATCHING_CSV_CANDIDATES = [
  join(DOCS, "Matching Company customs data.csv"),
  join(DESKTOP, "Matching Company customs data.csv"),
];

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

function parseNum(raw: string | undefined): number {
  if (!raw) return 0;
  const n = Number(String(raw).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function monthsSpan(dates: Date[]): number | null {
  if (dates.length === 0) return null;
  const ms = dates.map((d) => d.getTime());
  const days = (Math.max(...ms) - Math.min(...ms)) / (1000 * 60 * 60 * 24);
  return Math.round((days / 30.44) * 100) / 100;
}

function parseCustomsDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  for (const fmt of [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
  ]) {
    const m = s.match(fmt);
    if (!m) continue;
    const d = Number(m[1]);
    const mo = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  return null;
}

interface MutableAgg {
  name: string;
  roles: Set<string>;
  rucs: Set<string>;
  shipments: number;
  kgNet: number;
  fobUsd: number;
  destCountries: Set<string>;
  originOffices: Set<string>;
  destPorts: Set<string>;
  dates: Date[];
  sources: Set<string>;
}

/**
 * Curated platform↔customs extract. Prefer these company profiles when scoring
 * platform counterparties so volumes reflect matched rows, not the full book.
 */
function loadMatchingCompanyMap(): {
  map: Map<string, CustomsCompany>;
  path: string | null;
  rowCount: number;
} {
  const path = MATCHING_CSV_CANDIDATES.find((p) => existsSync(p)) ?? null;
  if (!path) return { map: new Map(), path: null, rowCount: 0 };

  const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  const records = parseCsvRecords(text);
  const store = new Map<string, MutableAgg>();

  const touch = (rawName: string, role: "exporter" | "importer", row: Record<string, string>) => {
    const name = (rawName || "").trim();
    if (!name) return;
    const key = companyGroupKey(name);
    let a = store.get(key);
    if (!a) {
      a = {
        name,
        roles: new Set(),
        rucs: new Set(),
        shipments: 0,
        kgNet: 0,
        fobUsd: 0,
        destCountries: new Set(),
        originOffices: new Set(),
        destPorts: new Set(),
        dates: [],
        sources: new Set(),
      };
      store.set(key, a);
    }
    a.roles.add(role);
    a.shipments += 1;
    a.kgNet += parseNum(row["Kg Neto"]);
    a.fobUsd += parseNum(row["U$ FOB Tot"]);
    const dest = (row["Pais de Destino"] || "").trim().toUpperCase();
    const port = (row["Puerto de destino"] || "").trim().toUpperCase();
    const office = (row["Aduana"] || "").trim().toUpperCase();
    if (dest) a.destCountries.add(dest);
    if (port) a.destPorts.add(port);
    if (office) a.originOffices.add(office);
    if (role === "exporter") {
      const ruc = String(row["Cod. Tributario"] || "").trim();
      if (ruc) a.rucs.add(ruc);
    }
    const dt = parseCustomsDate(row["Fecha"]);
    if (dt) a.dates.push(dt);
    a.sources.add("Matching Company customs data.csv");
  };

  for (const row of records) {
    touch(row["Exportador"] || "", "exporter", row);
    touch(row["Importador"] || "", "importer", row);
  }

  const map = new Map<string, CustomsCompany>();
  for (const [key, a] of store) {
    const activeMonths = monthsSpan(a.dates);
    const volumeMt = a.kgNet / 1000;
    const routeCount =
      a.roles.has("exporter")
        ? a.destCountries.size
        : a.originOffices.size || a.destPorts.size || a.destCountries.size;
    let monthlyFobUsd: number | null = null;
    if (activeMonths != null && activeMonths >= 1) monthlyFobUsd = a.fobUsd / activeMonths;
    else if (a.fobUsd > 0) monthlyFobUsd = a.fobUsd / 12;
    map.set(key, {
      key,
      name: a.name,
      roles: [...a.roles].sort(),
      rucs: [...a.rucs].sort(),
      shipments: a.shipments,
      kgNet: Math.round(a.kgNet * 100) / 100,
      fobUsd: Math.round(a.fobUsd * 100) / 100,
      volumeMt: Math.round(volumeMt * 1000) / 1000,
      routeCount,
      partnerCount: 0,
      destCountries: [...a.destCountries].sort(),
      activityMonths: activeMonths,
      monthlyFobUsd:
        monthlyFobUsd != null ? Math.round(monthlyFobUsd * 100) / 100 : null,
      sources: [...a.sources],
    });
  }

  return { map, path, rowCount: records.length };
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

/** Extra platform ↔ customs name aliases (hand-verified against Veritrade). */
const CUSTOMS_NAME_ALIASES: Record<string, string> = {
  "GIDDINS PERU SAC": "GIDDINGS BERRIES PERU S.A.C.",
  "GIDDINGS PERU SAC": "GIDDINGS BERRIES PERU S.A.C.",
  "GOURMET & BEVERAGE ONE GROUP (THAILAND) CO LTD":
    "GOURMET Y BEVERAGE ONE GROUP THAILAND CO LTD",
  "GOURMET & BEVERAGE ONE GROUP THAILAND CO LTD":
    "GOURMET Y BEVERAGE ONE GROUP THAILAND CO LTD",
  "HOLY FRUIT PERU S.A.C.": "Holy Fruit Peru",
  "HOLY FRUIT PERU S.A.C": "Holy Fruit Peru",
  "HOLY FRUIT PERU SAC": "Holy Fruit Peru",
  "FUNDO LAS LOMAS S.A.C.": "FUNDO LAS LOMAS SAC",
  "FUNDO LAS LOMAS S.A.C": "FUNDO LAS LOMAS SAC",
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

function findCustoms(
  map: Map<string, CustomsCompany>,
  companyName: string,
  rucIndex: Map<string, CustomsCompany>,
  masterRucs: Map<string, string[]>,
  preferredMap?: Map<string, CustomsCompany>,
): CustomsCompany | null {
  // Prefer curated Matching Company profiles when available.
  if (preferredMap && preferredMap.size > 0) {
    const preferred = findCustoms(preferredMap, companyName, buildRucIndex(preferredMap), masterRucs);
    if (preferred) return preferred;
  }

  const key = companyGroupKey(companyName);

  // 1) RUC join via company-master
  const taxIds = masterRucs.get(key) ?? [];
  for (const tax of taxIds) {
    const hit = rucIndex.get(String(tax).trim());
    if (hit) return hit;
  }

  // 2) Explicit aliases
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
      if (ck === nk) {
        return v;
      }
      // Require the shorter key to be a substantial substring (≥12 chars)
      const shorter = ck.length <= nk.length ? ck : nk;
      const longer = ck.length > nk.length ? ck : nk;
      if (shorter.length >= 12 && longer.includes(shorter)) {
        if (v.shipments > bestShip) {
          best = v;
          bestShip = v.shipments;
        }
      }
    }
    if (best) return best;
  }

  for (const [k, v] of map) {
    if (key.length >= 14 && (k.includes(key) || key.includes(k))) return v;
  }
  return null;
}

function isTmEntity(name: string): boolean {
  const k = companyGroupKey(name);
  return k.includes("TRU MARKET") || k.includes("TRUMARKET");
}

function buyerInputs(
  companyName: string,
  yearsInBusiness: number | null,
  platformDealCount: number,
  customs: CustomsCompany | null,
): SandboxBuyerInputs {
  const onPlatform = platformDealCount > 0;
  return {
    yearsInBusiness,
    // Found in customs as importer → less_authoritative online presence signal
    onlineVerifiability: customs?.roles.includes("importer")
      ? 55
      : customs
        ? 55
        : lookupOnlineVerifiability(companyName),
    importLicenseStatus: 100, // platform default: valid (same as production mapper)
    importLicenseTm: isTmEntity(companyName) ? 100 : null,
    monthlyPurchaseVolumeUsd: customs?.monthlyFobUsd ?? null,
    yearlySalesUsd: customs?.fobUsd ?? null,
    annualImportVolumeMt: customs?.roles.includes("importer")
      ? customs.volumeMt
      : null,
    routeDiversity: customs?.routeCount ?? null,
    creditRating: null,
    platformTransactionCount: platformDealCount > 0 ? platformDealCount : null,
    paymentDelayDays: null, // no measured source yet → excluded from raw average & coverage
    tmPlatformTrust: onPlatform || isTmEntity(companyName),
  };
}

function supplierInputs(
  companyName: string,
  yearsInBusiness: number | null,
  platformDealCount: number,
  finishedDealCount: number,
  customs: CustomsCompany | null,
): SandboxSupplierInputs {
  const onPlatform = platformDealCount > 0;
  const onTime =
    platformDealCount > 0
      ? Math.round((finishedDealCount / platformDealCount) * 100)
      : null;
  return {
    yearsInBusiness,
    onlineVerifiability: customs?.roles.includes("exporter")
      ? 55
      : customs
        ? 55
        : lookupOnlineVerifiability(companyName),
    exportLicenseStatus: 100,
    productionCapacityMt: customs?.volumeMt ?? null,
    yearlySalesUsd: customs?.fobUsd ?? null,
    annualExportVolumeMt: customs?.roles.includes("exporter")
      ? customs.volumeMt
      : customs?.volumeMt ?? null,
    routeDiversity: customs?.routeCount ?? null,
    qualityCertifications: null,
    platformTransactionCount: platformDealCount > 0 ? platformDealCount : null,
    onTimeDeliveryRate: onTime,
    qualityRejectionRate: null, // no measured source yet → excluded from raw average & coverage
    tmPlatformTrust: onPlatform || isTmEntity(companyName),
  };
}

interface ScoredRow {
  counterparty: PlatformCounterpartyScore;
  result: GroupScoreResult;
  customsMatch: CustomsCompany | null;
  coveragePct: number;
}

function scoreGroup(
  group: PlatformCounterpartyScore,
  customsMap: Map<string, CustomsCompany>,
  rucIndex: Map<string, CustomsCompany>,
  masterRucs: Map<string, string[]>,
  matchingMap: Map<string, CustomsCompany>,
): ScoredRow {
  const customs = findCustoms(
    customsMap,
    group.companyName,
    rucIndex,
    masterRucs,
    matchingMap,
  );
  const result =
    group.role === "buyer"
      ? scoreBuyer(
          buyerInputs(
            group.companyName,
            group.yearsInBusiness,
            group.dealCount,
            customs,
          ),
        )
      : scoreSupplier(
          supplierInputs(
            group.companyName,
            group.yearsInBusiness,
            group.dealCount,
            group.finishedDealCount,
            customs,
          ),
        );
  return {
    counterparty: group,
    result,
    customsMatch: customs,
    coveragePct: Math.round(result.coverageFraction * 1000) / 10,
  };
}

function buildCsv(rows: ScoredRow[], blocked: typeof platformCounterpartiesBlocked): string {
  const header = [
    "companyName",
    "role",
    "product",
    "status",
    "dealCount",
    "finishedDealCount",
    "yearsInBusiness",
    "yearsInBusinessSource",
    "sandboxScore",
    "coveragePct",
    "rawAverage",
    "trustBonus",
    "customsShipments",
    "customsVolumeMt",
    "customsFobUsd",
    "customsRoutes",
    "customsMatch",
    "filledFields",
  ];
  const lines = [header.join(",")];
  const esc = (s: string | number | null | undefined) => {
    if (s === null || s === undefined) return "";
    const t = String(s);
    return t.includes(",") || t.includes('"') ? `"${t.replace(/"/g, '""')}"` : t;
  };
  for (const row of rows) {
    const c = row.counterparty;
    const filled = row.result.fields
      .filter((f) => f.score !== null && f.score !== undefined)
      .map((f) => f.id)
      .join("|");
    lines.push(
      [
        esc(c.companyName),
        c.role,
        esc(c.product),
        "scored",
        c.dealCount,
        c.finishedDealCount,
        c.yearsInBusiness,
        c.yearsInBusinessSource,
        Math.round(row.result.score * 10) / 10,
        row.coveragePct,
        row.result.rawAverage === null
          ? ""
          : Math.round(row.result.rawAverage * 10) / 10,
        row.result.trustBonus,
        row.customsMatch?.shipments ?? "",
        row.customsMatch?.volumeMt ?? "",
        row.customsMatch?.fobUsd ?? "",
        row.customsMatch?.routeCount ?? "",
        row.customsMatch ? "yes" : "no",
        esc(filled),
      ].join(","),
    );
  }
  for (const b of blocked) {
    lines.push(
      [
        esc(b.companyName),
        b.role,
        esc(b.product),
        "blocked_missing_yib",
        b.dealCount,
        b.finishedDealCount,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}

function buildHtml(rows: ScoredRow[], customsMeta: CustomsPayload): string {
  const outlineNote = OUTLINE;
  const top = [...rows].sort((a, b) => b.result.score - a.result.score);
  const withCustoms = rows.filter((r) => r.customsMatch).length;
  const tr = top
    .map((r) => {
      const c = r.counterparty;
      const filled = r.result.fields
        .filter((f) => f.score != null)
        .map((f) => `${f.label}=${Math.round(f.score!)}`)
        .join("; ");
      return `<tr>
  <td>${escapeHtml(c.companyName)}</td>
  <td>${c.role}</td>
  <td>${escapeHtml(c.product)}</td>
  <td class="score-range">${(Math.round(r.result.score * 10) / 10).toFixed(1)}</td>
  <td>${r.coveragePct}%</td>
  <td>${r.customsMatch ? r.customsMatch.shipments : "—"}</td>
  <td>${r.customsMatch ? r.customsMatch.volumeMt.toFixed(1) : "—"}</td>
  <td>${r.customsMatch ? r.customsMatch.routeCount : "—"}</td>
  <td style="font-size:11px;color:#555">${escapeHtml(filled)}</td>
</tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Counterparty risk formula — sandbox results (2026-07-30)</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    max-width: 1200px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.5; }
  h1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; }
  .subtitle { color: #666; font-size: 14px; margin-bottom: 24px; }
  .methodology { background: #f7f7f5; border: 1px solid #e3e2dd; border-radius: 8px;
    padding: 16px 20px; font-size: 14px; margin-bottom: 28px; }
  .methodology h2 { font-size: 15px; margin: 0 0 8px 0; }
  .methodology ul { margin: 0; padding-left: 20px; }
  .methodology li { margin-bottom: 6px; }
  code { background: #eeeee9; padding: 1px 5px; border-radius: 4px; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px; }
  th, td { border: 1px solid #e3e2dd; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #f7f7f5; font-weight: 600; }
  tr:nth-child(even) { background: #fbfbfa; }
  .score-range { font-weight: 600; white-space: nowrap; }
  .note { font-size: 13px; color: #555; }
</style>
</head>
<body>
<h1>Counterparty risk formula — sandbox results</h1>
<p class="subtitle">Weighted-average + coverage shrink toward 50 (outline 2026-07-30).
Scored ${rows.length} platform (company, role, product) profiles;
${withCustoms} matched to customs aggregates.
Customs sources: ${customsMeta.sourceFiles.map(escapeHtml).join(", ")}.</p>

<div class="methodology">
  <h2>Methodology</h2>
  <ul>
    <li><strong>Group raw average</strong> = Σ(score × weight) / Σ(filled weights); blanks excluded</li>
    <li><strong>Coverage fraction</strong> = filled weight ÷ possible weight</li>
    <li><strong>Shrink</strong> = coverage × raw + (1 − coverage) × 50</li>
    <li><strong>TM platform trust</strong> = +3 flat after shrink (platform counterparties + TM affiliates)</li>
    <li><strong>Customs enrichment</strong> fills annual volume (MT), yearly FOB sales proxy, monthly FOB, route diversity, online verifiability (less-authoritative = 55 when found in Veritrade/Datasur)</li>
    <li>Sandbox only — not wired into live CRAM Dimension A. Spec: <code>${escapeHtml(outlineNote)}</code></li>
  </ul>
</div>

<table>
  <thead>
    <tr>
      <th>Company</th>
      <th>Role</th>
      <th>Product</th>
      <th>Sandbox score</th>
      <th>Coverage</th>
      <th>Customs shipments</th>
      <th>Volume MT</th>
      <th>Routes</th>
      <th>Filled field scores</th>
    </tr>
  </thead>
  <tbody>
${tr}
  </tbody>
</table>
<p class="note">Generated ${new Date().toISOString()}. Customs aggregate generatedAt=${escapeHtml(customsMeta.generatedAt)}.</p>
</body>
</html>
`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function main() {
  const customsPayload = JSON.parse(
    readFileSync(join(DATA, "customs-company-aggregates.json"), "utf-8"),
  ) as CustomsPayload;
  const customsMap = loadCustoms();
  const rucIndex = buildRucIndex(customsMap);
  const masterRucs = loadCompanyMasterRucs();
  const matching = loadMatchingCompanyMap();
  if (matching.path) {
    console.log(
      `Matching Company overlay: ${matching.rowCount} rows → ${matching.map.size} companies (${matching.path})`,
    );
  } else {
    console.warn("Matching Company customs data.csv not found — using full aggregates only");
  }

  const scored = platformCounterparties
    .map((g) => scoreGroup(g, customsMap, rucIndex, masterRucs, matching.map))
    .sort((a, b) => b.result.score - a.result.score || b.counterparty.dealCount - a.counterparty.dealCount);

  // Patch avg/min/max on a serializable copy for the app (sandbox scores)
  const sandboxCounterparties = scored.map((row) => {
    const score = Math.round(row.result.score * 10) / 10;
    return {
      ...row.counterparty,
      avgScore: score,
      maxScore: score,
      minScore: score,
      deals: row.counterparty.deals.map((d) => ({ ...d, score })),
      sandbox: {
        score,
        coveragePct: row.coveragePct,
        rawAverage:
          row.result.rawAverage === null
            ? null
            : Math.round(row.result.rawAverage * 10) / 10,
        trustBonus: row.result.trustBonus,
        scoreLow: Math.round(row.result.pessimisticScore),
        scoreHigh: Math.round(row.result.optimisticScore),
        customsMatched: Boolean(row.customsMatch),
        customsShipments: row.customsMatch?.shipments ?? 0,
        customsVolumeMt: row.customsMatch?.volumeMt ?? null,
        customsFobUsd: row.customsMatch?.fobUsd ?? null,
        customsMonthlyFobUsd: row.customsMatch?.monthlyFobUsd ?? null,
        customsRoutes: row.customsMatch?.routeCount ?? null,
        filledFieldIds: row.result.fields
          .filter((f) => f.score != null)
          .map((f) => f.id),
      },
    };
  });

  const customsSources = [
    ...(matching.path ? ["Matching Company customs data.csv"] : []),
    ...customsPayload.sourceFiles.filter((s) => s !== "Matching Company customs data.csv"),
  ];

  writeFileSync(
    join(DATA, "counterparty-sandbox-scores.json"),
    JSON.stringify(
      {
        formula: "sandbox-weighted-shrink-2026-07-30",
        generatedAt: new Date().toISOString(),
        customsGeneratedAt: customsPayload.generatedAt,
        customsSources,
        counterparties: sandboxCounterparties,
      },
      null,
      2,
    ) + "\n",
  );

  writeFileSync(join(DATA, "counterparty-scores.csv"), buildCsv(scored, platformCounterpartiesBlocked));

  const htmlPayload: CustomsPayload = {
    ...customsPayload,
    sourceFiles: customsSources,
  };
  const html = buildHtml(scored, htmlPayload);
  writeFileSync(join(DESKTOP, "counterparty-risk-formula-test-results.html"), html);
  writeFileSync(join(__dirname, "..", "docs", "counterparty-sandbox-results.html"), html);

  // Also copy outline into repo docs for reference
  try {
    const outline = readFileSync(OUTLINE, "utf-8");
    writeFileSync(
      join(__dirname, "..", "docs", "counterparty-risk-scoring-method-outline-2026-07-30.md"),
      outline,
    );
  } catch {
    console.warn("Could not copy outline from Desktop — skipped");
  }

  const matched = scored.filter((r) => r.customsMatch).length;
  const matchedViaOverlay = scored.filter(
    (r) =>
      r.customsMatch?.sources.includes("Matching Company customs data.csv") ?? false,
  ).length;
  const avg =
    scored.reduce((s, r) => s + r.result.score, 0) / Math.max(1, scored.length);
  console.log(
    `Scored ${scored.length} counterparties (avg ${avg.toFixed(1)}); ${matched} customs-matched (${matchedViaOverlay} via Matching Company overlay).`,
  );
  console.log(`Platform deals on file: ${platformDeals.length}`);
  console.log("Wrote counterparty-sandbox-scores.json, counterparty-scores.csv, Desktop HTML.");
}

main();
