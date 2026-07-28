/**
 * Data-coverage report — scans every platform deal (likely_test rows merged
 * in per decision 2026-07-28, no longer a separate excluded population) and
 * reports how much of the CRAM composite is running on real data vs. neutral
 * defaults, per dimension, plus a veto-register breakdown. Meant to be
 * re-run after every CSV refresh (`npx tsx scripts/build-platform-deals.ts`
 * first, then this) so an admin can see at a glance what's actually missing
 * without reading code — decision 2026-07-27.
 *
 * Run: npm run validate
 */
import {
  platformDeals,
  platformDealsBlocked,
  platformCounterpartiesBlocked,
} from "../src/data/platform-deals";
import { platformDealToDeal } from "../src/lib/platform-deal-mapper";
import { checkVetoRegister, computeOverallScore } from "../src/lib/scoring";
import { extractValidRuc } from "../src/lib/market-intel/ruc";
import companyMasterRaw from "../src/data/company-master.json";

interface CompanyMasterEntry {
  key: string;
  name: string;
  countries: string[];
  roles: string[];
  taxIds: string[];
  dealCount: number;
}
const companyMaster = companyMasterRaw as CompanyMasterEntry[];

function pct(n: number, total: number): string {
  if (total === 0) return "n/a";
  return `${((n / total) * 100).toFixed(0)}%`;
}

function line(label: string, n: number, total: number, note = ""): void {
  console.log(`  ${label.padEnd(46)} ${String(n).padStart(3)}/${total} (${pct(n, total)})${note ? "  — " + note : ""}`);
}

function main() {
  const deals = platformDeals.map((record) => ({ record, deal: platformDealToDeal(record) }));
  const total = deals.length;

  console.log(`\n=== CRAM data-coverage report ===`);
  console.log(`${total} deals (${platformDealsBlocked.length} of them blocked from scoring entirely — missing YIB). likely_test rows are merged in, not excluded — decision 2026-07-28.\n`);

  // --- Dimension A: Counterparty ---------------------------------------
  console.log("Dimension A — Counterparty (40% weight)");
  const buyerYibKnown = deals.filter((d) => d.deal.buyer.yearsInBusiness !== null).length;
  const supplierYibKnown = deals.filter((d) => d.deal.supplier.yearsInBusiness !== null).length;
  const cofaceReal = deals.filter((d) => !d.record.cofaceIsDefaulted).length;
  const creditGradeKnown = deals.filter((d) => d.deal.cofaceCompanyRiskGrade || d.deal.cofaceCountryRiskGrade).length;
  const supplierLicenseFromSunat = deals.filter((d) => d.record.marketIntel?.dim_a_supplier.sunat?.resolved).length;
  const buyerCapacityKnown = deals.filter((d) => {
    const buyerIntel = d.record.marketIntel?.dim_a_buyer;
    return buyerIntel && "capacity_check" in buyerIntel && !!buyerIntel.capacity_check;
  }).length;
  const supplierCapacityKnown = deals.filter((d) => !!d.record.marketIntel?.dim_a_supplier.capacity_check).length;

  line("Buyer years-in-business known", buyerYibKnown, total);
  line("Supplier years-in-business known", supplierYibKnown, total);
  line("Coface credit rating known (vs 0-pt neutral)", creditGradeKnown, total, "requires an uploaded Coface document per deal");
  line("Coface coverage is a real record (vs 90% default)", cofaceReal, total, "not scored — Gate 1 pre-check only");
  line("Supplier license status from real SUNAT lookup", supplierLicenseFromSunat, total, "else defaults to valid=true");
  line("Buyer capacity-vs-volume known", buyerCapacityKnown, total, "blocked repo-wide: quantity has no kg/carton unit");
  line("Supplier capacity-vs-volume known", supplierCapacityKnown, total, "blocked repo-wide: quantity has no kg/carton unit");
  console.log(`  Supplier quality certifications known                0/${total} (0%)  — no data source exists anywhere (CSV, docs, or market-intel)`);
  console.log(`  ${platformCounterpartiesBlocked.length} (company, role, product) counterparty rows have no YIB at all and are excluded from the Counterparty scores tab.\n`);

  // --- Dimension B: Product ----------------------------------------------
  console.log("Dimension B — Product (25% weight)");
  const priceKnown = deals.filter((d) => d.deal.offerUnitPriceUSD !== null).length;
  const tableConfirmed = deals.filter((d) => d.deal.productRiskProfile?.scoreConfirmed).length;
  line("Offer unit price known (price-vs-market variable)", priceKnown, total);
  line("Product risk table row is AC-confirmed (vs provisional)", tableConfirmed, total);
  console.log();

  // --- Dimension C: Route -------------------------------------------------
  console.log("Dimension C — Route (20% weight)");
  const transportModeKnown = deals.filter((d) => d.deal.transportMode !== null).length;
  const routeConfirmed = deals.filter((d) => d.deal.routeRiskProfile?.scoreConfirmed).length;
  line("Transport mode known (air/sea)", transportModeKnown, total);
  line("Route risk table row is AC-confirmed (vs transport-mode fallback)", routeConfirmed, total);
  console.log(`  Customs clearance time (spec §4.C, 5%wt)             0/${total} (0%)  — customsNarrative is unparsed free text, not a structured day count`);
  console.log(`  Cold-chain protocol documented vs incomplete         0/${total} (0%)  — always assumes "documented" (optimistic default), no per-shipment signal exists\n`);

  // --- Dimension D: Transaction Structure ---------------------------------
  console.log("Dimension D — Transaction Structure (15% weight)");
  console.log(`  Insurance coverage                                   0/${total} (0%)  — hardcoded "None" for every deal (no source) — see veto breakdown below`);
  console.log(`  Payment terms / advance % / collateral               0/${total} (0%)  — hardcoded platform defaults, no per-deal source\n`);

  // --- Veto register -------------------------------------------------------
  console.log("Veto register (spec §6 — hard stop, overrides the composite score regardless of value)");
  const reasonCounts = new Map<string, number>();
  let vetoedCount = 0;
  for (const { deal } of deals) {
    const v = checkVetoRegister(deal);
    if (v.vetoed) vetoedCount++;
    for (const r of v.reasons) reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1);
  }
  line("Deals forced to Veto tier", vetoedCount, total, vetoedCount === total ? "⚠ EVERY deal — see reason below" : "");
  for (const [reason, count] of reasonCounts) {
    console.log(`    - ${reason}: ${count}/${total}`);
  }
  console.log();

  // --- Composite score sanity --------------------------------------------
  let scored = 0;
  for (const { deal } of deals) {
    computeOverallScore(deal); // throws on a real bug — never on missing data (everything defaults neutral)
    scored++;
  }
  console.log(`Composite score computed successfully for ${scored}/${total} deals (no exceptions).\n`);

  if (vetoedCount === total) {
    console.log(
      "⚠ ACTION NEEDED: every deal is currently non-actionable (forced Veto tier) because cargo insurance\n" +
        "  has no data source anywhere in the pipeline. This is the single highest-priority gap to close —\n" +
        "  see docs/cram-defaults-and-formula-2026-07.md for what's already wired vs still missing.\n",
    );
  }

  // --- Tax ID / RUC coverage (company-master.json) -------------------------
  // Not itself a CRAM scoring input, but a valid Peru RUC is the sole gate
  // for market-intel enrichment (buyer/supplier capacity + real SUNAT
  // license status) — see scripts/lib/market-intel-cli.ts. ERD v4's
  // `companies` entity also keys company identity on
  // UNIQUE(taxIdType, taxId, country), so completeness matters for DB
  // standardization independent of scoring.
  console.log("Tax ID / RUC coverage (company-master.json)");
  const companiesTotal = companyMaster.length;
  const validRucCount = companyMaster.filter((c) => extractValidRuc(c.taxIds)).length;
  const peruNoValidRuc = companyMaster.filter(
    (c) => !extractValidRuc(c.taxIds) && c.countries.includes("Peru"),
  );
  const notPeruCount = companyMaster.filter(
    (c) => !extractValidRuc(c.taxIds) && !c.countries.includes("Peru"),
  ).length;
  const duplicateTaxIds = companyMaster.filter((c) => c.taxIds.length > 1);

  line("Companies with a valid Peru RUC", validRucCount, companiesTotal);
  console.log(
    `  Peru-based companies with NO valid RUC          ${String(peruNoValidRuc.length).padStart(3)}/${companiesTotal}` +
      (peruNoValidRuc.length > 0
        ? `  — ⚠ ${peruNoValidRuc.map((c) => `${c.name} (taxIds: ${JSON.stringify(c.taxIds)})`).join(", ")}`
        : ""),
  );
  console.log(
    `  Non-Peru companies (RUC not applicable)          ${String(notPeruCount).padStart(3)}/${companiesTotal}  — already carry their own country's tax ID instead; unverified against that country's format`,
  );
  if (duplicateTaxIds.length > 0) {
    console.log(
      `  Companies with >1 tax ID on file (needs reconciliation): ${duplicateTaxIds.map((c) => `${c.name} ${JSON.stringify(c.taxIds)}`).join("; ")}`,
    );
  }
  console.log();
}

main();
