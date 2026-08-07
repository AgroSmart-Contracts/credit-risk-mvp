/**
 * Hand-researched online-presence findings for counterparties with no
 * customs match (2026-08-06 research pass on the 5 Blueberries CRAM deals —
 * see docs/blueberry-deals-research-2026-08-06.md for full sourcing and the
 * identity-verification flags found alongside this research).
 *
 * Only covers fields with no in-repo source; never overrides a real
 * customs-derived signal — callers should apply this as a fallback only.
 * Keyed by the canonical company name used on Deal.buyer.name /
 * Deal.supplier.name, matching the same normalization dimension-a.ts's
 * isTmEntity() uses.
 */

export type VerifiabilityTier = "verified" | "less_authoritative" | "not_found";

interface OnlineVerifiabilityOverride {
  tier: VerifiabilityTier;
  note: string;
}

function normalizeKey(name: string): string {
  return name
    .toUpperCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// src/data/platform-deals.ts has "AGRICOLA VIÑASOL SAC" double-mis-encoded as
// "AGRICOLA VI" + U+00C2 + a raw C1 control byte (U+0091, standing in for the
// lost Ñ) + "ASOL SAC" — the same known corruption already handled in
// scripts/lib/company-name.ts's ALIAS_MAP for the company-master build. Built
// from escapes (not a literal string) so the corrupted bytes are unambiguous.
const MANGLED_AGRICOLA_VINASOL_KEY =
  "AGRICOLA VI" + "Â" + "" + "ASOL SAC";

/**
 * Known raw-data spelling variants that don't normalize to the canonical key
 * below via simple normalizeKey() — mapped to the canonical name before
 * lookup. Add entries here rather than guessing at generic encoding fixes:
 * some corruption (e.g. a lost byte replaced by a control character) can't
 * be recovered algorithmically, only recognized by its known exact form.
 */
const KNOWN_ALIASES: Record<string, string> = {
  [MANGLED_AGRICOLA_VINASOL_KEY]: "AGRICOLA VIÑASOL SAC",
};

const ONLINE_VERIFIABILITY_OVERRIDE: Record<string, OnlineVerifiabilityOverride> = {
  "ALLIED TRADE GLOBAL": {
    tier: "less_authoritative",
    note: "Official site alliedtradeglobal.com found (address matches a real Taipei business), but the taxId on file (54354228) doesn't resolve to any registered Taiwan company — identity unconfirmed, see research doc.",
  },
  "AGRICOLA VIÑASOL SAC": {
    tier: "less_authoritative",
    note: "Official site avsa.com.pe + LinkedIn found trading as 'AVSA', but the RUC on file (20534208008) fails SUNAT's checksum — exact legal-entity match to this name is unconfirmed, see research doc.",
  },
  "GUANGZHOU FRESH LINK IMPORT CO LTD": {
    tier: "not_found",
    note: "No registry entry, official website, or trade-directory listing found under this name or tax ID after an extensive multi-source search (2026-08-06).",
  },
  "ICA BLUEBERRIES SAC": {
    tier: "less_authoritative",
    note: "Found via SUNAT-mirror registry aggregators (ruc.pe, datosperu.org) with an exact legal-name match at a corrected RUC (20601463971); the RUC on file (20601449837) fails checksum. No dedicated company website found.",
  },
  "FRESH EXPRESS LLC": {
    tier: "verified",
    note: "Official site freshexpressint.com + LinkedIn + Facebook page; founded 1993, consistent identity (name, address, history) across multiple independent sources.",
  },
  "AGRO SMART CONTRACTS LDA": {
    tier: "less_authoritative",
    note: "NIF match confirmed via racius.com/kompass.com registry aggregators; no official website or LinkedIn found.",
  },
};

const TIER_SCORE: Record<VerifiabilityTier, number> = {
  verified: 90,
  less_authoritative: 55,
  not_found: 15,
};

/** Researched online-verifiability score for `companyName`, or null if nothing on file. */
export function lookupOnlineVerifiability(companyName: string): number | null {
  const canonical = KNOWN_ALIASES[companyName] ?? companyName;
  const entry = ONLINE_VERIFIABILITY_OVERRIDE[normalizeKey(canonical)];
  return entry ? TIER_SCORE[entry.tier] : null;
}
