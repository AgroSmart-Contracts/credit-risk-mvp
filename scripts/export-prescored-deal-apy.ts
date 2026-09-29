/**
 * Export live CRAM overall → investor APY (10–18% band) for the deals
 * analytics dashboard (`prescored-deal-apy.json`).
 *
 * Usage (from credit-risk-mvp/):
 *   npx tsx scripts/export-prescored-deal-apy.ts
 *   npx tsx scripts/export-prescored-deal-apy.ts --out ../deals-analytics-dashboard/src/data/prescored-deal-apy.json
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { platformDeals } from "../src/data/platform-deals";
import { buildRiskAssessment } from "../src/lib/assessment";
import { recommendFinancingTerms } from "../src/lib/financing";
import { platformDealToDeal } from "../src/lib/platform-deal-mapper";

type ApyEntry = {
  overall: number;
  apyPct: number;
  uncertaintyPremium: number;
  counterpartyCoveragePct: number;
  dealRef: string;
  createdAt: string | null;
};

function parseOutPath(): string {
  const idx = process.argv.indexOf("--out");
  if (idx >= 0 && process.argv[idx + 1]) {
    return resolve(process.argv[idx + 1]);
  }
  return resolve(
    process.cwd(),
    "../deals-analytics-dashboard/src/data/prescored-deal-apy.json",
  );
}

function main(): void {
  const byMongoId: Record<string, ApyEntry> = {};
  let scored = 0;
  let skipped = 0;

  for (const record of platformDeals) {
    if (!record.counterpartyReady) {
      skipped++;
      continue;
    }
    const deal = platformDealToDeal(record);
    const assessment = buildRiskAssessment(deal);
    const financing = recommendFinancingTerms(
      assessment.overall,
      deal.dealValueUSD,
      assessment.counterpartyCoveragePct,
    );
    byMongoId[record.mongoId.toLowerCase()] = {
      overall: assessment.overall,
      apyPct: assessment.investorApyPct,
      uncertaintyPremium: financing.uncertaintyPremium,
      counterpartyCoveragePct: assessment.counterpartyCoveragePct,
      dealRef: record.dealRef,
      createdAt: record.createdAt,
    };
    scored++;
  }

  const payload = {
    generatedAt: new Date().toISOString().slice(0, 10),
    source:
      "credit-risk-mvp live CRAM overall + uncertaintyPremium → investor APY 10–18%",
    note:
      "Investor APY paid to LPs (not TruMarket 8% volume fee). Higher CRAM overall → lower APY. Uncertainty premium lifts APY when counterparty data is thin.",
    band: { min: 10, max: 18 },
    scored,
    skippedNotReady: skipped,
    byMongoId,
  };

  const outPath = parseOutPath();
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(
    `Wrote ${scored} deals (${skipped} skipped) → ${outPath}`,
  );

  // Quick 2025 summary
  let cap = 0;
  let wApy = 0;
  let n2025 = 0;
  for (const record of platformDeals) {
    if (!(record.createdAt || "").startsWith("2025")) continue;
    const entry = byMongoId[record.mongoId.toLowerCase()];
    if (!entry) continue;
    n2025++;
    cap += record.dealValueUSD;
    wApy += record.dealValueUSD * entry.apyPct;
  }
  if (n2025 > 0) {
    const weighted = wApy / cap;
    const investor2m = cap * (weighted / 100) * (2 / 12);
    const platform8 = cap * 0.08;
    console.log(
      `2025 scored: ${n2025} | capital $${Math.round(cap).toLocaleString()} | ` +
        `weighted APY ${weighted.toFixed(2)}% | ` +
        `investor @2mo $${Math.round(investor2m).toLocaleString()} | ` +
        `platform 8% $${Math.round(platform8).toLocaleString()}`,
    );
  }
}

main();
