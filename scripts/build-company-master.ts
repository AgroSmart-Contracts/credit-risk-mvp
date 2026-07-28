/**
 * Builds a company-level master table (one row per company, including
 * likely_test rows since the 2026-07-28 merge decision — see
 * build-platform-deals.ts) from full-deals-dataset-2026-07 (1).csv —
 * decision 2026-07-24: years-in-business and license validity belong on the
 * company, not repeated/duplicated per deal.
 *
 * Source of truth for company identity: the embedded `buyerCompany` /
 * `supplierCompany` JSON objects (name+country+taxId), not the flatter
 * `buyerCompanyNames` / `supplierCompanyNames` account-level fields — the
 * latter are documented as unreliable (e.g. Open Markets Corp vs Agro Smart
 * Contracts sharing one Mongo account on the US Mandarina rows).
 *
 * Run: npx tsx scripts/build-company-master.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsvRecords } from "./lib/csv";
import { normalizeCompanyName, companyGroupKey } from "./lib/company-name";
import { extractValidRuc } from "../src/lib/market-intel/ruc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DESKTOP = join(process.env.HOME ?? "", "Desktop");
const SOURCE_CSV = join(DESKTOP, "full-deals-dataset-2026-07 (1).csv");
const OUT_DIR = join(__dirname, "..", "src", "data");

interface CompanyRecord {
  key: string;
  name: string;
  countries: Set<string>;
  roles: Set<"buyer" | "supplier">;
  yearsInBusinessSamples: number[];
  taxIds: Set<string>;
  dealCount: number;
  namesSeen: Set<string>;
}

function safeJsonParse(raw: string): Record<string, unknown> | null {
  if (!raw || raw.trim() === "" || raw.trim() === "[]") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseYib(raw: string): number | null {
  const n = Number(raw);
  return raw !== "" && Number.isFinite(n) ? n : null;
}

/**
 * Externally-verified years-in-business for companies the source CSV never
 * recorded a value for — found via public company-registry lookups
 * (2026-07-27) when the internal SUNAT/market-intel path couldn't reach them
 * (non-Peru companies; market-intel is Peru-only). `years` computed against
 * 2026-07-27. Keyed by companyGroupKey(name). Only applied when the CSV
 * itself has zero samples — never overrides a real CSV-observed value.
 */
const YIB_OVERRIDE_BY_KEY: Record<string, { years: number; source: string }> = {
  // CIF B11882909, incorporated 2010-04-16 (Cadiz, Spain commercial registry).
  // https://www.iberinform.es/empresa/5021230/bc-nature-quality-fruits · https://www.empresia.es/empresa/bc-nature-quality-fruits/
  "BC NATURE QUALITY FRUITS SL": { years: 16, source: "verified" },
  // NIP 9231585471 / KRS 0000125530, founded 2002 (Wolsztyn, Poland).
  // https://polskiedane.pl/limax-sp-z-o-o-nip-9231585471-krs-0000125530/ · https://www.bizraport.pl/krs/0000125530/limax-spolka-z-ograniczona-odpowiedzialnoscia
  "LIMAX SP Z OO": { years: 24, source: "verified" },
  // User-provided figure (2026-07-28), no public registry citation on file.
  "AGRICOLA Y COMERCIAL VALLES DEL NUBLE": { years: 8, source: "verified" },
  // User-provided figure (2026-07-28), no public registry citation on file.
  "ASM INTERNATIONAL": { years: 5, source: "verified" },
  // User-provided figure (2026-07-28), no public registry citation on file.
  "TRADE CULTIVATORS LLC": { years: 2, source: "verified" },
  // User-provided figure (2026-07-28), no public registry citation on file.
  "KHI INTERNATIONAL CORP": { years: 12, source: "verified" },
  // User-provided figure (2026-07-28), no public registry citation on file.
  "NATURAL SOUTH FRUIT LTD": { years: 8, source: "verified" },
  // Filled by admin in ~/Desktop/platform-deals-with-defaults.csv (2026-07-28).
  // Repo regenerations from company-master were wiping these because the Desktop
  // source CSV never had buyersYearsinBusiness/suppliersYearsinBusiness for them
  // — promoting into this override table so rebuilds keep them.
  "AGRICOLA MEDANO AZUL SAC": { years: 5, source: "verified" },
  "AGRICOLA VIÑASOL SAC": { years: 15, source: "verified" },
  "AGRO SMART CONTRACTS LDA": { years: 2, source: "verified" },
  "ALBORAN COMEX SL": { years: 2, source: "verified" },
  "ANTERRA FARMS GMBH": { years: 4, source: "verified" },
  "ALLIED TRADE GLOBAL": { years: 14, source: "verified" },
  "BIOFRESHI BV": { years: 17, source: "verified" },
  "BLUE PACIFIC FOODS SAC": { years: 22, source: "verified" },
  "DAVIS GLOBAL BV": { years: 6, source: "verified" },
  "FRESH EXPRESS LLC": { years: 33, source: "verified" },
  "HACIENDA SOTOMAYOR SL": { years: 5, source: "verified" },
  "JUHINEJ LTD": { years: 19, source: "verified" },
  "XARKI SL": { years: 66, source: "verified" },
};

function pickCanonicalYib(samples: number[]): number | null {
  if (samples.length === 0) return null;
  // Most frequent value wins; ties broken by the largest (more conservative
  // to under- than over-claim years in business is debatable, so we take the
  // most-repeated observation as the best signal of the "real" figure).
  const counts = new Map<number, number>();
  for (const s of samples) counts.set(s, (counts.get(s) ?? 0) + 1);
  let best = samples[0];
  let bestCount = 0;
  for (const [val, count] of counts) {
    if (count > bestCount || (count === bestCount && val > best)) {
      best = val;
      bestCount = count;
    }
  }
  return best;
}

function main() {
  const csvText = readFileSync(SOURCE_CSV, "utf-8");
  const rows = parseCsvRecords(csvText);

  const companies = new Map<string, CompanyRecord>();

  function upsert(
    rawName: string,
    country: string,
    taxId: string,
    yib: number | null,
    role: "buyer" | "supplier",
  ) {
    const canonical = normalizeCompanyName(rawName);
    if (!canonical) return;
    const key = companyGroupKey(canonical);
    let rec = companies.get(key);
    if (!rec) {
      rec = {
        key,
        name: canonical,
        countries: new Set(),
        roles: new Set(),
        yearsInBusinessSamples: [],
        taxIds: new Set(),
        dealCount: 0,
        namesSeen: new Set(),
      };
      companies.set(key, rec);
    }
    if (country) rec.countries.add(country);
    if (taxId) rec.taxIds.add(taxId);
    rec.roles.add(role);
    rec.namesSeen.add(rawName.trim());
    rec.dealCount += 1;
    if (yib !== null) rec.yearsInBusinessSamples.push(yib);
  }

  for (const row of rows) {
    // 2026-07-28 decision: likely_test rows are no longer excluded — merged
    // in with the rest so their companies get real YIB/license treatment too.

    const buyerCompany = safeJsonParse(row.buyerCompany);
    const supplierCompany = safeJsonParse(row.supplierCompany);
    const buyerYib = parseYib(row.buyersYearsinBusiness);
    const supplierYib = parseYib(row.suppliersYearsinBusiness);

    const buyerName =
      (buyerCompany?.name as string | undefined) ||
      row.buyerCompanyNames?.split("|")[0] ||
      "";
    const buyerCountry = (buyerCompany?.country as string | undefined) ?? "";
    const buyerTaxId = (buyerCompany?.taxId as string | undefined) ?? "";
    if (buyerName) upsert(buyerName, buyerCountry, buyerTaxId, buyerYib, "buyer");

    const supplierName =
      (supplierCompany?.name as string | undefined) ||
      row.supplierCompanyNames?.split("|")[0] ||
      "";
    const supplierCountry =
      (supplierCompany?.country as string | undefined) ?? "";
    const supplierTaxId = (supplierCompany?.taxId as string | undefined) ?? "";
    if (supplierName)
      upsert(supplierName, supplierCountry, supplierTaxId, supplierYib, "supplier");
  }

  const master = [...companies.values()]
    .map((c) => {
      const csvYib = pickCanonicalYib(c.yearsInBusinessSamples);
      const override = c.yearsInBusinessSamples.length === 0 ? YIB_OVERRIDE_BY_KEY[c.key] : undefined;
      return {
        key: c.key,
        name: c.name,
        countries: [...c.countries],
        roles: [...c.roles],
        taxIds: [...c.taxIds],
        dealCount: c.dealCount,
        yearsInBusiness: csvYib ?? override?.years ?? null,
        yearsInBusinessSource:
          csvYib !== null ? "csv" : override ? (override.source as "verified") : ("default" as const),
        /** Decision 2026-07-24: license validity defaults to true (no KYC/license source in any CSV). */
        licenseValid: true,
        licenseValidSource: "default" as const,
        nameVariantsSeen: [...c.namesSeen].filter((n) => n !== c.name),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  writeFileSync(
    join(OUT_DIR, "company-master.json"),
    JSON.stringify(master, null, 2) + "\n",
  );

  // ERD v4: companies.taxId / companies.taxIdType / companies.country —
  // "valid-ruc" | "peru-no-valid-ruc" | "not-peru-na" mirrors
  // CompanyTaxIdSection.tsx's RucStatus so the CSV and the app UI never
  // disagree. No `key`/`_id` column — this is a values worksheet for
  // filling gaps by hand, not a DB-ready export (that comes later, once
  // these values are actually loaded and get real IDs).
  const csvHeader = [
    "name",
    "roles",
    "countries",
    "taxId",
    "taxIdStatus",
    "allTaxIdsOnFile",
    "dealCount",
    "yearsInBusiness",
    "yearsInBusinessSource",
    "licenseValid",
    "licenseValidSource",
    "nameVariantsSeen",
  ];
  const csvLines = [csvHeader.join(",")];
  for (const c of master) {
    const country = c.countries[0] ?? "";
    const validRuc = extractValidRuc(c.taxIds);
    const taxId = validRuc ?? c.taxIds[0] ?? "";
    const taxIdStatus = validRuc ? "valid-ruc" : country === "Peru" ? "peru-no-valid-ruc" : "not-peru-na";
    csvLines.push(
      [
        `"${c.name}"`,
        `"${c.roles.join("|")}"`,
        `"${c.countries.join("|")}"`,
        taxId,
        taxIdStatus,
        `"${c.taxIds.join(" | ")}"`,
        c.dealCount,
        c.yearsInBusiness ?? "",
        c.yearsInBusinessSource,
        c.licenseValid,
        c.licenseValidSource,
        `"${c.nameVariantsSeen.join(" | ")}"`,
      ].join(","),
    );
  }
  writeFileSync(join(OUT_DIR, "company-master.csv"), csvLines.join("\n") + "\n");

  const missingYib = master.filter((c) => c.yearsInBusiness === null);
  console.log(`Company master: ${master.length} companies.`);
  console.log(
    `Missing years-in-business: ${missingYib.length} companies — ${missingYib
      .map((c) => c.name)
      .join(", ")}`,
  );
}

main();
