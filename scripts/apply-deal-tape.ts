/**
 * Apply the ops deal tape (docs/deal-tape-CANONICAL-2026-10-15-1.csv) to the
 * CRAM deal book, then rebuild platform-deals.generated.json + platform-deals.ts.
 *
 * - `platform` rows (existing mongoIds): overlay the tape's corrected
 *   shipment date, net kg and buyer, plus the customs declaration (mode +
 *   narrative) only when the declaration is the supplier's own (platform
 *   cited, customs match L1, or re-cited). L2/L3 declarations belong to
 *   another exporter and are not used as evidence.
 * - `customs-derived` rows: new records keyed on the tape's deal id, built
 *   from the declaration itself. YIB comes from company-master only — a
 *   company with no YIB stays blocked rather than getting a default.
 * - Pair history (priorDealsBetweenParties / relationshipAgeMonths) is
 *   extended with the new deals of the same buyer+supplier pair.
 *
 * Deals in the book but not on the tape are kept unchanged.
 *
 * Run: npx tsx scripts/apply-deal-tape.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsvRecords } from "./lib/csv";
import { companyGroupKey, normalizeCompanyName } from "./lib/company-name";
import { fetchMarketIntelSync } from "./lib/market-intel-cli";
import { assignChronologicalPairHistory } from "./lib/pair-history";
import { writePlatformDeals } from "./lib/platform-deals-output";
import { TAPE_COMPANY_YIB, type CompanyYibResearch } from "./lib/tape-company-research";
import { lookupProductRisk } from "../src/lib/product-risk-tables";
import { lookupRouteRisk } from "../src/lib/route-risk-tables";
import { hsHeading4, normalizeHsCode, resolveHsProduct } from "../src/lib/hs-product-map";
import { normalizeDealMilestone } from "../src/lib/deal-milestone";
import {
  customsDestinationCountry,
  customsOriginCountry,
  customsVariety,
  dealWeekFor,
} from "../src/lib/market-intel/deal-params";
import type { PlatformDealRecord } from "../src/types/platform";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "src", "data");
const TAPE_CSV = join(ROOT, "docs", "deal-tape-CANONICAL-2026-10-15-1.csv");
const VERITRADE_CHECK_CSV = join(ROOT, "docs", "deal-tape-vs-veritrade-2026-10-15.csv");
const PRE_TAPE_JSON = join(DATA, "platform-deals.pre-tape.json");

/** Declarations that are the supplier's own shipment (see tape `dua_source`). */
const OWN_DECLARATION_SOURCES = new Set([
  "platform cited",
  "customs match L1",
  "customs evidence (re-cited 2026-10-15; platform citation was another exporter)",
  "customs (added deal)",
]);

/** Customs-derived rows held back on 2026-10-15 for a review reason other than Veritrade. */
const HELD_FOR_REVIEW: Record<string, string> = {
  "CUST-2025-131": "possible duplicate of platform deal E001-33 (shares DUA 011891)",
};

const TRANSPORT_FALLBACK = {
  air: { transitDays: 10, transshipments: 1, flag: "Medium" as const },
  sea: { transitDays: 20, transshipments: 1, flag: "Medium" as const },
};

interface CompanyMasterEntry {
  key: string;
  name: string;
  yearsInBusiness: number | null;
  yearsInBusinessSource: "csv" | "verified" | "default";
  taxIds: string[];
}

function parseNum(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function isoDate(raw: string | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return `${s}T00:00:00.000Z`;
}


function transportOf(raw: string): "air" | "sea" | null {
  const s = raw.trim().toLowerCase();
  if (s === "air") return "air";
  if (s === "sea") return "sea";
  return null;
}

/**
 * Tape HS → 10-digit partida. Peru codes drop the leading 0 (9 digits);
 * Chile codes are 8-digit national codes with the leading 0 dropped
 * (e.g. 8112011 = 0811.2011), so they pad left to 8 then right to 10.
 * Multi-code cells ("0910110000|0910300000") take the first code.
 */
function tapeHs(raw: string, originCountry: string): string | null {
  const first = raw.split("|")[0].replace(/\D/g, "");
  if (!first) return null;
  if (originCountry === "Chile" && first.length <= 8) {
    return first.padStart(8, "0").padEnd(10, "0");
  }
  return normalizeHsCode(first);
}


function narrativeFor(row: Record<string, string>): string {
  const fob = parseNum(row.fob_usd);
  const kg = parseNum(row.kg);
  return [
    `DUA ${row.DUA}`,
    row["DUA date"],
    row.customs_mode || row.shipment_mode.toUpperCase(),
    fob != null ? `FOB $${fob.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null,
    kg != null ? `${kg.toLocaleString("en-US")}kg` : null,
    row.dest_country.toUpperCase(),
  ]
    .filter(Boolean)
    .join(" | ");
}

function loadMaster(): Map<string, CompanyMasterEntry> {
  const entries = JSON.parse(readFileSync(join(DATA, "company-master.json"), "utf8")) as CompanyMasterEntry[];
  return new Map(entries.map((e) => [companyGroupKey(e.name), e]));
}

/** Customs names quote parts of the name ('"LA PROSPERIDAD"'); ignore quotes when matching. */
const researchKey = (name: string): string => companyGroupKey(name).replace(/"/g, "").replace(/\s+/g, " ").trim();

const RESEARCH_BY_KEY = new Map<string, CompanyYibResearch>(
  Object.entries(TAPE_COMPANY_YIB).map(([name, r]) => [researchKey(name), r]),
);

/** company-master first (curated), then the 2026-10-16 web research for tape-only companies. */
function yibFor(
  name: string,
  master: Map<string, CompanyMasterEntry>,
): { yib: number | null; source: PlatformDealRecord["buyerYibSource"]; research: CompanyYibResearch | null } {
  const m = master.get(companyGroupKey(name));
  if (m?.yearsInBusiness != null) return { yib: m.yearsInBusiness, source: m.yearsInBusinessSource, research: null };
  const r = RESEARCH_BY_KEY.get(researchKey(name));
  if (r) return { yib: r.years, source: "verified", research: r };
  return { yib: null, source: "default", research: null };
}

function loadVeritradeCheck(): Map<string, string> {
  const rows = parseCsvRecords(readFileSync(VERITRADE_CHECK_CSV, "utf8"));
  return new Map(rows.map((r) => [r["deal id"].toLowerCase(), r.veritrade_result]));
}

/**
 * Country of each port that appears in the tape's `customs_dest_port`. For
 * Peru, Veritrade's "Puerto de destino" is usually the first foreign port of
 * call (Balboa, Rodman, Posorja, Guayaquil, Valparaíso …), not where the
 * cargo lands, and "Último Puerto Embarque" is always N/A. A port only counts
 * as the destination when it is in the destination country.
 */
const PORT_COUNTRY: Record<string, string> = {
  MIAMI: "United States", "LOS ANGELES": "United States", PHILADELPHIA: "United States",
  NORFOLK: "United States", HOUSTON: "United States", SAVANNAH: "United States",
  ROTTERDAM: "Netherlands", AMSTERDAM: "Netherlands", HAMBURG: "Germany",
  SHANGHAI: "China", DALIAN: "China", MEDELLIN: "Colombia", MADRID: "Spain",
  VALPARAISO: "Chile", ANTOFAGASTA: "Chile", MEJILLONES: "Chile",
  "CHARLES-DE-GAULLE APT/PARIS": "France", QUITO: "Ecuador", POSORJA: "Ecuador",
  GUAYAQUIL: "Ecuador", BALBOA: "Panama", RODMAN: "Panama", "OTROS PUERTOS DE PANAMA": "Panama",
};

/**
 * Typical arrival port when the declaration only shows a transshipment hub
 * and the counterparties have no platform history to that country.
 * US mandarins: Philadelphia and Port Hueneme are the main entry ports
 * (MSC Peru citrus, freshfruitportal 2024-01-30). Spain avocados: Algeciras
 * (freshplaza). Netherlands: Rotterdam. Air: the country's main hub the
 * platform book already uses.
 */
const TYPICAL_PORT: Record<string, string> = {
  "Spain::sea": "Algeciras",
  "Netherlands::sea": "Rotterdam",
  "United States::sea::Fresh Mandarin": "Philadelphia",
  "Taiwan::sea": "Kaohsiung",
  // Not plain "Manzanillo": the route model also aliases Colón/Manzanillo, Panama.
  "Mexico::sea": "Manzanillo, Mexico",
  "Colombia::sea": "Buenaventura",
  "India::air": "Mumbai Chhatrapati Shivaji",
  "Israel::air": "Tel Aviv Ben Gurion",
};

type PortHistory = Map<string, Map<string, number>>;

/** Destination ports the platform book already records, per company × country × mode. */
function buildPortHistory(records: PlatformDealRecord[]): PortHistory {
  const history: PortHistory = new Map();
  for (const r of records) {
    if (!r.portOfDestination || !r.transportMode) continue;
    for (const name of [r.buyerName, r.supplierName]) {
      const key = `${companyGroupKey(name)}::${r.destination}::${r.transportMode}`;
      const ports = history.get(key) ?? new Map<string, number>();
      ports.set(r.portOfDestination, (ports.get(r.portOfDestination) ?? 0) + 1);
      history.set(key, ports);
    }
  }
  return history;
}

function destinationPortFor(
  row: Record<string, string>,
  mode: "air" | "sea" | null,
  product: string,
  history: PortHistory,
): { port: string; basis: string } | null {
  const country = row.dest_country;
  for (const raw of row.customs_dest_port.split("|")) {
    const port = raw.trim();
    if (port && PORT_COUNTRY[port.toUpperCase()] === country) {
      return { port, basis: "declaration" };
    }
  }
  if (!mode) return null;
  for (const name of [row.buyer, row.customs_exporter, row.supplier]) {
    if (!name || name === "Unknown buyer" || name === "X") continue;
    const prefix = `${companyGroupKey(normalizeCompanyName(name))}::`;
    const tally = new Map<string, number>();
    for (const [key, ports] of history) {
      if (!key.startsWith(prefix) || !key.endsWith(`::${mode}`) || !key.includes(country)) continue;
      for (const [port, n] of ports) tally.set(port, (tally.get(port) ?? 0) + n);
    }
    const best = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) return { port: best[0], basis: "platform history" };
  }
  const typical = TYPICAL_PORT[`${country}::${mode}::${product}`] ?? TYPICAL_PORT[`${country}::${mode}`];
  return typical ? { port: typical, basis: "typical port" } : null;
}

function buildCustomsRecord(
  row: Record<string, string>,
  master: Map<string, CompanyMasterEntry>,
  veritrade: Map<string, string>,
  portHistory: PortHistory,
): PlatformDealRecord {
  const mongoId = row["deal id"].toLowerCase();
  const [originRaw, destRaw] = row.corridor.split("→").map((s) => s.trim());
  const originCountry = (originRaw.split(",").pop() ?? "").trim();
  const isPomegranate = /GRANAD/i.test(row.customs_description);
  const hsCode = tapeHs(row.HS, originCountry);
  const hsResolved = resolveHsProduct({ hsCode, product: row.crop });
  const product = isPomegranate ? "Fresh Pomegranate" : (hsResolved?.product ?? row.crop);
  const productProfile = lookupProductRisk(product, hsCode);
  const transportMode = transportOf(row.shipment_mode);
  // Air declarations clear at "Callao (air)", i.e. Lima Jorge Chávez airport.
  const portOfOrigin =
    transportMode === "air" && /\(air\)/i.test(row.customs_office)
      ? "Lima Jorge Chavez"
      : row.customs_office.trim() || null;
  const destPort = destinationPortFor(row, transportMode, product, portHistory);
  const portOfDestination = destPort?.port ?? null;
  const destination = portOfDestination ? `${portOfDestination}, ${row.dest_country}` : destRaw || row.dest_country;

  const fallback = TRANSPORT_FALLBACK[transportMode ?? "sea"];
  const provisionalStops = transportMode === "air" ? fallback.transshipments : 0;
  const routeProfile = lookupRouteRisk(
    portOfOrigin ?? originRaw,
    portOfDestination ?? destination,
    product,
    transportMode,
    provisionalStops,
  );

  // The declaration's legal exporter name resolves through the ops-confirmed
  // aliases more often than the tape's short supplier label (e.g. "MIKHUNA
  // PERUVIAN FOODS"), so try it first; "X" means Chile hid the exporter.
  const supplierCandidates = [row.customs_exporter, row.supplier]
    .map((s) => s.trim())
    .filter((s) => s && s !== "X")
    .map(normalizeCompanyName);
  const supplierMatch = supplierCandidates.find((s) => master.has(companyGroupKey(s)));
  const supplierName = supplierMatch ?? supplierCandidates[0] ?? normalizeCompanyName(row.supplier);
  const buyerUnknown = !row.buyer.trim() || row.buyer.trim() === "Unknown buyer";
  const buyerName = buyerUnknown ? "Unknown buyer" : normalizeCompanyName(row.buyer);
  const supplierMaster = master.get(companyGroupKey(supplierName));
  const supplierFacts = yibFor(supplierName, master);
  const buyerFacts = buyerUnknown
    ? { yib: null, source: "default" as const, research: null }
    : yibFor(buyerName, master);
  const supplierYib = supplierFacts.yib;
  const buyerYib = buyerFacts.yib;

  const kg = parseNum(row.kg);
  const dealValueUSD = parseNum(row.GMV) ?? 0;
  const shippingStartDate = isoDate(row.date);
  const exporterRuc = row.customs_exporter_ruc.trim() || null;

  const missingFields: string[] = [];
  if (buyerUnknown) missingFields.push("buyer identity (tape: Unknown buyer)");
  if (buyerYib === null) missingFields.push("buyer.yearsInBusiness");
  if (supplierYib === null) missingFields.push("supplier.yearsInBusiness");
  if (!productProfile?.scoreConfirmed) missingFields.push("product risk table row (provisional, not AC-confirmed)");
  if (!routeProfile) missingFields.push("route risk table row (transport-mode fallback used)");
  missingFields.push("cargo insurance coverage (defaults to None — triggers veto)");
  missingFields.push("buyer credit rating (Coface CRA/DRA — no document uploaded)");
  if (row.customs_exporter.trim() === "X") {
    missingFields.push("exporter hidden in Chile customs (shown as X) — supplier attribution unconfirmed");
  }
  if (exporterRuc && supplierMaster && !supplierMaster.taxIds.includes(exporterRuc)) {
    missingFields.push(
      `supplier RUC conflict: declaration ${exporterRuc} vs company-master ${supplierMaster.taxIds.join("/")}`,
    );
  }
  for (const [role, facts] of [["buyer", buyerFacts], ["supplier", supplierFacts]] as const) {
    if (facts.research && facts.research.basis !== "registry" && facts.research.basis !== "published") {
      missingFields.push(`${role}.yearsInBusiness is a ${facts.research.basis} estimate (since ${facts.research.since})`);
    }
  }
  if (destPort && destPort.basis !== "declaration") {
    missingFields.push(`destination port ${destPort.port} inferred from ${destPort.basis} (declaration shows ${row.customs_dest_port || "none"})`);
  }
  if (isPomegranate) missingFields.push("tape crop says Fresh Blueberries; customs description is pomegranate");

  const verified = veritrade.get(mongoId) === "found, same exporter" && !HELD_FOR_REVIEW[row.ref_tmp];
  if (HELD_FOR_REVIEW[row.ref_tmp]) missingFields.push(HELD_FOR_REVIEW[row.ref_tmp]);

  let marketIntel: PlatformDealRecord["marketIntel"] = null;
  if (exporterRuc && originCountry === "Peru") {
    marketIntel = fetchMarketIntelSync({
      exporterRuc,
      importerName: buyerName,
      originCountry: customsOriginCountry(originRaw) ?? undefined,
      destinationCountry: customsDestinationCountry(destination) ?? undefined,
      variety: customsVariety(product, "") ?? undefined,
      dealWeek: shippingStartDate ? dealWeekFor(new Date(shippingStartDate)) : undefined,
      dealKg: kg ?? undefined,
      dealPriceUsdPerKg: parseNum(row.usd_per_kg) ?? undefined,
    });
  }

  return {
    id: `cust-${mongoId.slice(-8)}`,
    mongoId,
    dealRef: row.dealRef,
    product,
    hsCode,
    hsHeading4: hsHeading4(hsCode),
    variety: "",
    quantityLabel: kg != null ? `${kg} kg` : "",
    presentation: null,
    quantityKg: kg,
    dealValueUSD,
    origin: originRaw,
    destination,
    portOfOrigin,
    portOfDestination,
    shipmentCompany: null,
    buyerName,
    supplierName,
    buyerYib,
    supplierYib,
    buyerYibSource: buyerFacts.source,
    supplierYibSource: supplierFacts.source,
    perishabilityClass: productProfile?.perishabilityClass ?? "Perishable",
    shelfLifeDays: productProfile?.shelfLifeDays ?? null,
    coldChainRequired: productProfile?.coldChainRequired ?? true,
    estimatedTransitDays: routeProfile?.estimatedTransitDays ?? fallback.transitDays,
    numberOfTransshipments:
      transportMode === "air"
        ? provisionalStops
        : (routeProfile?.numberOfTransshipments ?? fallback.transshipments),
    routeRiskFlag: routeProfile?.routeRiskFlag ?? fallback.flag,
    transportMode,
    offerUnitPriceUSD: parseNum(row.usd_per_kg),
    shippingStartDate,
    priorDealsBetweenParties: 0,
    relationshipAgeMonths: 0,
    status: "finished",
    likelyTest: verified ? "likely real" : "unverified",
    currentMilestone: normalizeDealMilestone("finished", 7),
    customsNarrative: narrativeFor(row),
    cofaceCoverageAmountUSD: Math.round(dealValueUSD * 0.9 * 100) / 100,
    cofaceCoveragePct: 90,
    cofaceIsDefaulted: true,
    counterpartyReady: buyerYib !== null && supplierYib !== null,
    marketIntel,
    htmlFormulaScore: null,
    htmlFormulaBase: null,
    htmlFormulaBonus: null,
    missingFields: [...new Set(missingFields)],
    // No platform createdAt exists yet; the shipment date stands in so
    // relationship age and year filters place the deal correctly.
    createdAt: shippingStartDate ?? "",
  };
}

function overlayPlatform(record: PlatformDealRecord, row: Record<string, string>): PlatformDealRecord {
  const ownDeclaration = Boolean(row.DUA) && OWN_DECLARATION_SOURCES.has(row.dua_source);
  const tapeBuyer = normalizeCompanyName(row.buyer);
  const tapeSupplier = normalizeCompanyName(row.supplier);
  return {
    ...record,
    shippingStartDate: isoDate(row.date) ?? record.shippingStartDate,
    quantityKg: parseNum(row.kg) ?? record.quantityKg,
    // Keep the record's spelling when the tape names the same company, so
    // encoding variants don't split a counterparty group.
    buyerName:
      tapeBuyer && companyGroupKey(tapeBuyer) !== companyGroupKey(record.buyerName) ? tapeBuyer : record.buyerName,
    supplierName:
      tapeSupplier && companyGroupKey(tapeSupplier) !== companyGroupKey(record.supplierName)
        ? tapeSupplier
        : record.supplierName,
    // Mixed declarations ("AEREO|MARITIMO") don't settle the mode; keep the platform's.
    transportMode:
      ownDeclaration && !row.customs_mode.includes("|")
        ? (transportOf(row.shipment_mode) ?? record.transportMode)
        : record.transportMode,
    customsNarrative: ownDeclaration ? narrativeFor(row) : record.customsNarrative,
    missingFields: ownDeclaration
      ? record.missingFields.filter((f) => !f.toLowerCase().includes("customs export narrative"))
      : record.missingFields,
  };
}

/** Refresh YIB for platform records whose buyer/supplier changed via the tape. */
function refreshYib(record: PlatformDealRecord, master: Map<string, CompanyMasterEntry>, before: PlatformDealRecord): PlatformDealRecord {
  const out = { ...record };
  if (record.buyerName !== before.buyerName) {
    const m = master.get(companyGroupKey(record.buyerName));
    out.buyerYib = m?.yearsInBusiness ?? null;
    out.buyerYibSource = m?.yearsInBusinessSource ?? "default";
  }
  if (record.supplierName !== before.supplierName) {
    const m = master.get(companyGroupKey(record.supplierName));
    out.supplierYib = m?.yearsInBusiness ?? null;
    out.supplierYibSource = m?.yearsInBusinessSource ?? "default";
  }
  out.counterpartyReady = out.buyerYib != null && out.supplierYib != null;
  return out;
}

/**
 * The book as it was before the tape. Written once on the first run and read
 * on every later one, so re-running doesn't stack pair counts or re-add the
 * customs-derived deals.
 */
function loadPreTapeBook(): PlatformDealRecord[] {
  if (existsSync(PRE_TAPE_JSON)) {
    return JSON.parse(readFileSync(PRE_TAPE_JSON, "utf8")) as PlatformDealRecord[];
  }
  const current = readFileSync(join(DATA, "platform-deals.generated.json"), "utf8");
  writeFileSync(PRE_TAPE_JSON, current);
  return JSON.parse(current) as PlatformDealRecord[];
}

function main() {
  const existing = loadPreTapeBook();
  const byId = new Map(existing.map((r) => [r.mongoId.toLowerCase(), r]));
  const tape = parseCsvRecords(readFileSync(TAPE_CSV, "utf8").replace(/^﻿/, ""));
  const master = loadMaster();
  const veritrade = loadVeritradeCheck();
  const portHistory = buildPortHistory(existing);

  const overlaid = new Map<string, PlatformDealRecord>();
  const created: PlatformDealRecord[] = [];
  const missingPlatform: string[] = [];
  let changedParties = 0;

  for (const row of tape) {
    const id = row["deal id"].toLowerCase();
    if (!id) throw new Error(`Tape row without deal id: ${row.dealRef}`);
    if (row.record_type === "platform") {
      const base = byId.get(id);
      if (!base) {
        missingPlatform.push(`${id} ${row.dealRef}`);
        continue;
      }
      const next = refreshYib(overlayPlatform(base, row), master, base);
      if (next.buyerName !== base.buyerName || next.supplierName !== base.supplierName) changedParties++;
      overlaid.set(id, next);
    } else if (row.record_type === "customs-derived") {
      if (byId.has(id)) throw new Error(`Customs-derived id already in the book: ${id}`);
      created.push(buildCustomsRecord(row, master, veritrade, portHistory));
    }
  }
  if (missingPlatform.length) {
    throw new Error(`Platform tape rows not in the deal book:\n${missingPlatform.join("\n")}`);
  }

  const kept = existing.map((r) => overlaid.get(r.mongoId.toLowerCase()) ?? r);

  // Pair history, counted in time order: a deal's prior deals are the
  // same buyer+supplier pair's shipments dated strictly before it, and its
  // relationship age runs from the pair's first shipment to this one. The
  // old rule (pair total − 1 on every deal, age = first-to-last) credited a
  // 2024 deal with shipments that only happened in 2026.
  const records = assignChronologicalPairHistory([...kept, ...created]);

  const { scores, blocked } = writePlatformDeals(
    DATA,
    records,
    "scripts/apply-deal-tape.ts from docs/deal-tape-CANONICAL-2026-10-15-1.csv (overlay + customs-derived deals on prior platform-deals.generated.json)",
  );

  const ready = records.filter((r) => r.counterpartyReady).length;
  const createdReady = created.filter((r) => r.counterpartyReady).length;
  const withIntel = created.filter((r) => r.marketIntel !== null).length;
  console.log(`Platform rows overlaid: ${overlaid.size} (party names changed on ${changedParties}).`);
  console.log(`Customs-derived deals added: ${created.length} (${createdReady} score-ready, ${withIntel} with market intel).`);
  console.log(`Kept unchanged (not on tape): ${existing.length - overlaid.size}.`);
  console.log(`Wrote ${records.length} deals (${ready} score-ready), ${scores.length} counterparties, ${blocked.length} blocked.`);
}

main();
