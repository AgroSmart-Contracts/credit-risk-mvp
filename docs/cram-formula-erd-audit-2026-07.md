# CRAM formula ↔ ERD/spec audit and fixes — 2026-07-25

Follow-up to `docs/cram-defaults-and-formula-2026-07.md`. That earlier pass only synced
Dimension A (Counterparty). This audit cross-checked all four dimensions' actual point
tables in `tm-cram-engine-spec-2026-06.md` §4 against the ERD entities
(`trumarket-database-erd-final.drawio`: `Counterparty`, `CofaceRecord`,
`CRAM Assessment`, `Product`, `Route(T2)`, `Transaction Structure`) and `scoring.ts`'s
actual implementation. Found and fixed real gaps in three of the four dimensions plus a
completely unimplemented veto register.

## Dimension D (Transaction Structure) — full resync

Was never synced to spec at all (only Dimension A got that treatment previously). In
`src/lib/scoring.ts`:

- **Advance-payment-% no longer drives the base score.** It previously produced a
  20–90 point swing as the base, which isn't a spec concept — spec §4.D treats advance
  payment as a minor 10%-weight adjustment (`advancePaymentPoints`: ≥50% +10 / ≥25% +7
  / ≥10% +5). Base is now a flat 60, per spec.
- **Collateral** (`collateralPoints`): LC +25 / Bank Guarantee +20 / Warehouse Receipt
  +15 / Inventory Pledge +10 / Personal Guarantee +5 / **None −5** (was 0 — "no
  collateral" is now correctly a penalty, not neutral), +5 more if collateral value
  fully covers the deal value (new — wasn't checked before at all).
- **Insurance** (`insurancePoints`): All-Risk +5 / Comprehensive +3 / Basic +1 (was
  15/10/5 — roughly 3x too generous). **None is no longer a point value at all** — see
  veto register below, spec treats it as a hard stop, not a −N penalty.
- **Payment terms** (`paymentTermsAdjustment`, shared with the narrative layer):
  Cash-in-advance +25 / LC +20 / CAD +15 / 30d +10 / 60d 0 / 90d −10 / 120d+ −18 (was
  roughly half these magnitudes).
- **Relationship history** (`structureRelationshipAdjustment`): ≥10 +15 / ≥5 +12 / ≥1 +8
  / 0 −12 (was missing the ≥10 tier entirely and used unrelated point values — this is
  a *different* variable from Dimension A's cross-applied relationship signal, which
  spec explicitly calls for both: §4.A "cross-applied within Counterparty" +
  §4.D "Relationship history 25%").

## Dimension C (Route) — incoterm bug + spec magnitudes + freight-mode split

- **Bug fix: incoterms were never applied to any deal with a matched route-table row**
  (`if (tableMatch) return tableMatch.score;` returned immediately, skipping the 20%-
  weight incoterm variable entirely). Now incoterm + cold-chain-requirement are applied
  as per-deal adjustments on top of the structural score (table match or fallback)
  uniformly for every deal — same reasoning as Product below.
- Incoterm magnitudes corrected to spec: EXW −8 / FCA,FAS 0 / FOB +8 / CFR,CPT +5 /
  CIF,CIP +12 / DAP,DPU,DDP +15 (was running ~60–70% of these values).
- Fallback structural formula rebuilt on spec's base-70 shape, and now differentiates
  transit-time and transshipment points by **freight mode** (new `transportMode` field,
  air vs. sea) per spec §4.C's air/ocean-reefer/ocean-non-perishable split — previously
  one universal transit-day ladder regardless of mode.
- Cold-chain requirement (15%wt): `coldChainRequired ? −5 : 0`, assuming "documented"
  (spec's less-severe case) since nothing distinguishes documented vs. incomplete
  protocol — same optimistic-default pattern used elsewhere (license validity, payment
  delay).
- **Not implemented — no data source**: "Customs clearance time" (5%wt, ≤3d +5/>7d −8).
  `customsNarrative` is unparsed free text, not a structured date. Left out of the
  formula entirely rather than guessed at.
- **ERD gap, not a formula bug**: `numberOfTransshipments` has no backing field
  anywhere in the ERD (`Route(T2)` has no such column, `deals` doesn't either) despite
  being a real scoring input and a veto condition. Worth flagging to whoever owns the
  schema — this audit doesn't touch the ERD itself.

## Dimension B (Product) — price-vs-market implemented for one product

- **Bug fix: quality grade was never applied to any deal with a matched product-table
  row** — same class of bug as Route's incoterm miss. Now layered on top of the
  structural score for every deal: A/Class I +18 / B/Class II +5 / Industrial +8 (spec
  magnitudes; previous fallback-only version used ±10).
- **"Price vs market" (30% of Product weight, spec §3's own "single highest-signal
  fraud variable") is now implemented for Fresh Blueberries** — the one product with
  real benchmark data available. `docs/pricing-intelligence.xlsx` is a real 2025 Peru
  customs export dataset (36,288 declarations, tariff 0810400000, fresh blueberries
  only) with a genuine `US$ FOB UNIT` column. Computed median: $5.56/kg (n=35,491,
  rows filtered to KILOGRAMO unit, $0.50–$50/kg to exclude data-entry errors). New
  `src/lib/price-benchmarks.ts`: within ±15% of benchmark +20 / >+30% −22 / <−30% −18,
  reading spec's "±5–15%" band as the safe zone. New `Deal.offerUnitPriceUSD` /
  `PlatformDealRecord.offerUnitPriceUSD`, sourced from the CSV's `offerUnitPrice`
  column (previously not captured anywhere in the type system at all).
- **No benchmark for the other 11 products** — fabricating one would mean presenting
  invented market data as real. `priceVsMarketPoints` returns 0 (neutral) for anything
  not in the table, same pattern as the other NEEDS_DATA spec variables.
- Fallback structural formula (no table match) rebuilt on spec's actual base-70 +
  perishability-class shape (Non-perishable +18/Semi +9/Perishable −4/Ultra −12) —
  previously used an unrelated 30/50/70/90 direct-base scale.
- **`productCategory` was hardcoded `"Fresh Produce"` for every platform deal**,
  including "Frozen Tropical Fruits" and the IQF mixed-berries product — now sourced
  from a new `ProductRiskProfile.productCategory` field (ERD `Product.productCategory`)
  set correctly per product (Fresh Produce / Dried for coffee & cacao / Frozen for the
  two frozen-tropical rows).

## Single-veto register — implemented (spec §6)

Was mentioned only in code comments before — no function checked any of it, and
`getTier` could never return a veto outcome. New `checkVetoRegister(deal)` in
`scoring.ts`, wired into `computeOverallScore` (new `ScoreBreakdown.vetoed` /
`vetoReasons`, `RiskAssessment.vetoed` / `vetoReasons`, new `RiskTier` value `"Veto"`
that overrides the composite-based tier). Surfaced as a red banner on the Assess Deal
risk dashboard and as a tier-colored badge on the Platform Deals list (previously that
badge was hardcoded to the "primary" green color regardless of tier — a pre-existing
display bug, fixed alongside since a green badge on a vetoed deal would actively
mislead).

Checks implemented (real data sources):
- Buyer import license invalid / supplier export license invalid
- No cargo insurance on file
- ≥2 transshipments by air (needs the new `transportMode` field)

**Not implemented — no data source**: "Ultra-perishable + cold-chain execution
deficient" needs a per-shipment "protocol documented vs. incomplete" signal that
doesn't exist anywhere in the CSV or document pipeline. Not faked.

### Important consequence: every currently-scoreable platform deal is vetoed

`insuranceCoverage` is hardcoded `"None"` in `platform-deal-mapper.ts` for every
platform CSV deal (no insurance-certificate source exists anywhere in the CSV). Per
spec, no cargo insurance is a **mandatory-floor hard stop** — so all 52
counterparty-ready platform deals now show `tier: "Veto"`.

This is *not* treated as a bug to soften with an optimistic default (unlike license
validity, where TruMarket's own KYC process gives a reasonable basis to assume
validity absent contrary evidence). There is no equivalent basis for assuming cargo
insurance exists — a real underwriter would treat "unconfirmed" and "none" identically
for veto purposes, since both mean the deal can't be verified as protected. Composite
scores and the four dimension sub-scores are still computed and shown underneath the
veto (matching spec §7's scorecard format, which lists the veto check as a separate
line, not a replacement for the dimension breakdown) — this is arguably the single
most consequential finding of this whole audit: cargo insurance evidence is a total
gap across every real deal in the platform, more structurally important than any of
the softer NEEDS_DATA gaps documented earlier.

## All 170 source rows now reported (2026-07-27 follow-up)

Previously `build-platform-deals.ts` excluded the 86 `likely_test` (synthetic/seed)
rows from the generated dataset entirely — they never became `PlatformDealRecord`
objects, so nothing in the app could report on them. Combined with the fact that
`platformDealsBlocked` (32 real deals missing buyer/supplier years-in-business) was
computed but never rendered anywhere, this meant only 52 of the CSV's 170 rows were
ever visible in the UI, with no accounting for the other 118.

Fixed: the generator now builds full records for **every** row, real or synthetic —
`platformDealsSynthetic` (86) is a new export, kept completely separate from
`platformDeals` (still real-only, 84) so no existing scoring, aggregation, or
dashboard count is affected. Synthetic rows are always `counterpartyReady: false`
(explicitly, regardless of YIB — protects against a fake company name coincidentally
matching a real one in `company-master.json`), never enter `pairAgg` or
`platformCounterparties`, and are excluded from the product/route miss-counters in the
generator's console summary. They're listed in a new collapsible table at the bottom
of the Missing Fields tab, clearly labeled as synthetic and excluded from scoring —
visible, not hidden, matching the pattern used for provisional product/route rows and
blocked deals.

Full accounting, all three now visible in the app: **52 scoreable + 32 blocked + 86
synthetic = 170.**

## Counterparty Scores tab restructured to per-(company, role, product) (2026-07-27 follow-up)

The Counterparty Scores tab previously grouped by **buyer↔supplier pair**, scoring each
pair with the blended `computeCounterpartyScore()` (buyer×0.5 + supplier×0.5 +
relationship). This doesn't match the ERD: `Counterparty` is a per-company-per-role
entity (`role`, `riskScore` fields — a buyer and a supplier are two separate
Counterparty records, each with their own score), and `CRAM Assessment` references
`buyerCounterpartyId` and `supplierCounterpartyId` as two distinct FKs, never a merged
one. A company's own standing shouldn't be entangled with whichever specific
counterparty it happened to trade with in the source CSV.

Fixed: `PlatformCounterpartyScore` is now keyed by **(company name, role, product)** —
scored directly with `computeBuyerScore()` or `computeSupplierScore()` (whichever
matches the row's role), not the blended pair formula. Product is included in the key
because a company's real track record can plausibly differ by commodity, and the user
asked for exactly that framing. The Counterparty Scores tab now shows two sections
(Buyers / Suppliers, filterable), each card labeled with company + role + product,
84 real deals → 13 (company, role, product) rows (7 buyer, 6 supplier) across the
8 buyer↔supplier pairs that previously existed.

**The blended pair formula (`computeCounterpartyScore`) still exists and is still
correct** — it's Dimension A of a single deal's own overall CRAM composite
(`computeOverallScore`), where combining both parties into one number genuinely is
what spec §4.A calls for. Only the *standalone counterparty directory* (this tab) was
wrong to use it.

**Buyer credit rating already considers Coface company/country risk** — this was
already wired in the earlier `creditRatingPoints()` fix (§9 above): `computeBuyerScore`
reads `deal.cofaceCompanyRiskGrade` (preferred) or `deal.cofaceCountryRiskGrade`. Since
this tab now calls `computeBuyerScore` directly per buyer row, that's automatically
reflected here too — no separate change needed, just confirming it flows through.

## Blocked counterparties now reported in the Counterparty tab, not just Missing fields (2026-07-27 follow-up)

Raised by the user: if a deal's CRAM is blocked because of a counterparty gap
(missing years-in-business), that gap should be visible in the tab about
counterparties, not only in the generic Missing fields tab.

While implementing this, found and fixed a related bug: inclusion in a buyer or
supplier group was still gated on `record.counterpartyReady`, which requires **both**
parties' YIB to be known — a leftover from the old pair-based model. Since buyer and
supplier are now scored independently (previous section), a buyer with perfectly known
YIB could still be invisible from this tab just because the *specific supplier* they
were paired with in some deal had a gap. Fixed: inclusion is now gated per-role
(`buyerYib !== null` for buyer groups, `supplierYib !== null` for supplier groups),
independent of the other party. Result: scored (company, role, product) profiles went
from 13 → 17 once buyers/suppliers were no longer wrongly excluded by their
counterparty's gap.

The `PlatformCounterpartyBlocked` groups (13 of them) that remain — genuinely missing
their own YIB — are now rendered in the Counterparty Scores tab as a distinct
dashed-border section per role, with a "Fill in years in business" button that jumps to
the Missing fields tab (the single place where the actual correction/live-preview
happens — not duplicated here, to avoid two out-of-sync editing surfaces for the same
data).

## Two bugs found via user screenshot review (2026-07-27 follow-up)

1. **Duplicate React keys from truncated IDs.** `counterpartyScores`/`counterpartyBlocked`
   ids were built as `` `cp-${idKey.replace(/[^A-Z0-9]/gi, "").slice(0, 32)}` `` — for a
   long company name like "TRU MARKET BLOCKCHAIN S.A.C.", the company-name portion alone
   consumed the full 32-char cap, so the product suffix never survived truncation.
   Confirmed: 3 of TRU MARKET BLOCKCHAIN S.A.C.'s 4 supplier-role product rows (Fresh
   Blueberries, Fresh Asparagus, Frozen Tropical Fruits — all happen to start with "Fr")
   collided into the identical id `cp-supplierTRUMARKETBLOCKCHAINSACFr`, used as the React
   `key` in `CounterpartyScoresTab.tsx`. Duplicate keys make list reconciliation
   undefined, which is why filtering to "Buyers" could still show a stale Supplier card.
   Fixed by dropping the length cap entirely — ids aren't user-facing, so there's no
   reason to keep them short at the cost of collisions.
2. **Filter-pill counts only reflected scored profiles.** "Buyers (7)" didn't include the
   12 blocked buyer profiles (vs. only 1 blocked supplier) — a very lopsided split that
   was invisible from the pill alone. Pills now show combined totals (`Buyers (19)`,
   `Suppliers (11)`, `All (30)`), and the header paragraph spells out the scored/blocked
   split per role.

## Files touched

`src/lib/scoring.ts` (Product/Route/Structure formulas, veto register),
`src/lib/price-benchmarks.ts` (new), `src/types.ts` (`transportMode`,
`offerUnitPriceUSD`, `ProductRiskProfile.productCategory`, `RiskTier: "Veto"`,
`RiskAssessment.vetoed/vetoReasons`), `src/types/platform.ts` (same two new fields on
`PlatformDealRecord`), `src/lib/product-risk-tables.ts` (`productCategory` on all 12
entries), `src/lib/platform-deal-mapper.ts`, `src/lib/deal-builder.ts`,
`src/lib/assessment.ts`, `src/lib/risk-colors.ts` (Veto tier colors),
`src/components/RiskDashboard.tsx` (veto banner), `src/components/PrescoredDealsTab.tsx`
(tier-colored badge), `src/data/deals.ts` (new required fields on the 3 sample deals),
`scripts/build-platform-deals.ts` (`transportMode`/`offerUnitPriceUSD` sourcing +
defaults-CSV columns). Regenerated `src/data/platform-deals.ts` /
`platform-deals.generated.json` / `platform-deals-with-defaults.csv`. Typecheck and
build both pass clean.
