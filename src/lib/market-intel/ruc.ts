/**
 * Shared between the Node build pipeline (scripts/lib/market-intel-cli.ts)
 * and the browser UI (CompanyTaxIdSection.tsx) so both agree on exactly
 * what counts as a usable Peru RUC — moved here 2026-07-27 so the two
 * didn't drift into checking this differently.
 *
 * company-master.json's `taxIds` mixes formats from every country in the
 * deal book (Russian, Indian, Portuguese IDs alongside real Peru RUCs) —
 * only an 11-digit numeric string is a plausible Peru RUC. One entry
 * (`MCORP`) carries an obvious placeholder (`123123123123`, 12 digits),
 * confirming this filter is load-bearing, not decorative.
 */
export function extractValidRuc(taxIds: string[]): string | null {
  return taxIds.find((id) => /^\d{11}$/.test(id)) ?? null;
}
