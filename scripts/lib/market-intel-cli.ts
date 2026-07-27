/**
 * Batch bridge into docs/market-intel-peru-2025-2026-07-10 (Peru customs +
 * SUNAT enrichment pipeline) — invoked once per real deal during
 * build-platform-deals.ts so the CRAM buyer/supplier-capacity variables
 * (spec §4.A, previously NEEDS_DATA_* neutral-0 placeholders) get real data
 * wherever a supplier resolves to a valid Peru RUC. Decision 2026-07-27.
 *
 * scripts/rate-json.py is a stdin/stdout JSON CLI purpose-built for exactly
 * this (its own docstring: "Node/Vercel integration") — it resolves its own
 * marts path from `Path(__file__)`, so no cwd/env setup is needed here.
 */
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { MarketIntelPayload, MarketIntelRateRequest } from "../../src/lib/market-intel/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MI_DIR = join(__dirname, "..", "..", "docs", "market-intel-peru-2025-2026-07-10");
const RATE_JSON_SCRIPT = join(MI_DIR, "scripts", "rate-json.py");

/**
 * company-master.json's `taxIds` mixes formats from every country in the
 * deal book (Russian, Indian, Portuguese IDs alongside real Peru RUCs) —
 * only an 11-digit numeric string is a plausible Peru RUC. One entry
 * (`MCORP`) carries an obvious placeholder (`123123123123`, 12 digits),
 * confirming this filter is load-bearing, not decorative.
 */
export function extractValidRuc(taxIds: string[]): string | null {
  return taxIds.find((id) => /^\d{11}$/.test(id)) ?? null;
}

/**
 * Only ENOENT (no python3 binary on PATH at all) is a permanent condition —
 * every subsequent call would fail the exact same way, so it's worth
 * bailing out entirely rather than eating a fresh process-spawn attempt per
 * deal. ETIMEDOUT is NOT permanent: it fires per-call whenever a RUC isn't
 * already in sunat_lookup.py's cache and the live SUNAT API is slow to
 * respond (confirmed cause of a real regression — one slow network call
 * incorrectly silenced market-intel for every remaining deal in the batch,
 * dropping 11/82 responses that should have succeeded). Any other error
 * (bad request, non-zero exit, bad JSON) is deal-specific and shouldn't
 * trip any bail-out either.
 */
let spawnUnavailable = false;
let warnedUnavailable = false;

/**
 * Shells out once per call — rate-json.py reloads fact_shipments.parquet
 * fresh each invocation (no server/cache to keep warm), so this is safe to
 * call in a loop but costs ~1-2s per call (or longer on a SUNAT cache miss —
 * see the 30s timeout below). Fails safe: any spawn/parse error returns
 * null (deal just gets no market-intel enrichment) rather than aborting the
 * whole build, matching the pipeline's own NEEDS_INPUT philosophy of never
 * fabricating data it doesn't have.
 */
export function fetchMarketIntelSync(
  request: MarketIntelRateRequest,
): MarketIntelPayload | null {
  if (spawnUnavailable) return null;

  const result = spawnSync("python3", [RATE_JSON_SCRIPT], {
    input: JSON.stringify(request),
    encoding: "utf-8",
    timeout: 30_000,
    maxBuffer: 16 * 1024 * 1024,
    // sunat_lookup.py's cache path (`Path("marts/sunat_cache")`) is relative
    // to cwd, not to the script's own location — same reason
    // api/market-intel-rate.py does `os.chdir(MI_DIR)` before invoking this
    // pipeline. Without this, the cache (and any relative path the pipeline
    // ever adds) would land wherever the Node process happened to be run
    // from instead of inside the pipeline's own directory.
    cwd: MI_DIR,
  });

  if (result.error) {
    const isPermanent = (result.error as NodeJS.ErrnoException).code === "ENOENT";
    if (isPermanent) {
      spawnUnavailable = true;
      console.warn(
        `[market-intel] python3 unavailable (${result.error.message}) — skipping market-intel enrichment for all remaining deals.`,
      );
    } else {
      console.warn(
        `[market-intel] spawn error for RUC ${request.exporterRuc} (${result.error.message}) — skipping this deal only.`,
      );
    }
    return null;
  }

  if (result.status !== 0) {
    if (!warnedUnavailable) {
      console.warn(
        `[market-intel] rate-json.py exited ${result.status} for RUC ${request.exporterRuc} — stderr: ${(result.stderr ?? "").toString().slice(0, 300)}`,
      );
      warnedUnavailable = true;
    }
    return null;
  }

  try {
    return JSON.parse(result.stdout) as MarketIntelPayload;
  } catch {
    console.warn(`[market-intel] failed to parse output for RUC ${request.exporterRuc}`);
    return null;
  }
}
