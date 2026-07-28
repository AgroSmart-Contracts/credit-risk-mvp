# Product & Route risk table gaps — 2026-07-24

> **2026-07-28 update**: `likely_test` rows are now merged into scoring like every
> other deal (see `docs/cram-defaults-and-formula-2026-07.md` §6). Every "real
> (non-`likely_test`) deal book" phrase below now effectively means "the whole deal
> book" — the distinction no longer changes which deals count toward a table row's
> confidence. This also surfaced new route gaps not present when synthetic rows were
> excluded — see the end of the Route risk table section below.

Per decision ("add a tab for product risk table... report those missing fields/table" /
"expand it yes... report them"), the app now has two dedicated nav tabs — **Product risk
table** and **Route risk table** (`src/components/ProductRiskTableTab.tsx`,
`src/components/RouteRiskTableTab.tsx`) — that render every table row with a visible
**AC-confirmed** or **Provisional** badge, so gaps are surfaced in the UI rather than
silently defaulted. This doc is the backing reference for those badges and for the
`scoreConfirmed: false` rationale strings in `src/lib/product-risk-tables.ts` and
`src/lib/route-risk-tables.ts`.

`scoreConfirmed: true` = sourced directly from an AC-reviewed reference table
(`tm-cram-reference-tables-2026-07.md` Table 1/2). `scoreConfirmed: false` = a row that
exists so a real deal isn't silently unscored, but whose score is a provisional
estimate (either extrapolated from the fallback formula in `scoring.ts`, or a regional
analogue) — treat these as **needs-review**, not final.

## Product risk table (Dimension B)

8 of 12 rows are AC-confirmed, unchanged from the original table (Fresh Avocado,
Fresh Mandarin, Fresh Blueberries, Fresh Strawberries, Fresh Grapes, Fresh Ginger,
Green Coffee, Cacao Beans). Regenerating the dataset confirms **every product in the
real (non-`likely_test`) deal book now has a table row** — "Products with no confirmed
table row (deal count): none" — but 4 of those 12 rows are provisional:

| Product | Score | Status | Gap |
|---|---|---|---|
| Fresh Asparagus | 38 | Provisional | Table 1 lists it as Group 1 with a `NEEDS_CONFIRM ❓` on Ultra- vs. Perishable classification. |
| Fresh Mango | 55 | Provisional | Not in Table 1 at all. Backs 0 deals as of 2026-07-28 — its only backing deal (buyer "Kuba" / MCORP, Poland) was removed as a test entry; kept as a table row in case a real Fresh Mango deal appears later. |
| Mixed Berries / Tropical Fruits (IQF) | 60 | Provisional | Not a tracked Nectora product line, not in Table 1. |
| Frozen Tropical Fruits | 60 | Provisional | Not a tracked Nectora product line, not in Table 1. Backs 1 real deal (Frozen Berries from Chile, AGRO SMART CONTRACTS LDA → TRU MARKET BLOCKCHAIN S.A.C.) — as of the 2026-07-28 merge decision, `likely_test` rows are scored the same as any other deal, so this row's confidence is no longer conditioned on real-vs-synthetic provenance either way. |

**To close this gap:** get AC sign-off on Ultra- vs. Perishable for asparagus, and get
Table 1 rows added for mango and the two frozen/IQF categories (or confirm they should
inherit an existing category's score).

## Route risk table (Dimension C)

9 of 28 corridor rows are AC-confirmed from Table 2 (the 6 original entries plus 2
newly-added ones — Tel Aviv/Israel and Dubai/UAE — plus Amsterdam/Netherlands). The
other **19 are provisional** — added 2026-07-24 to cover corridors that appear in the
real deal book but have no Table 2 entry, scored via the generic transit-time/flag
fallback formula rather than an AC-reviewed figure:

Lisbon (Portugal), Madrid (Spain), Malaga (Spain), Mumbai (India), Gdansk (Poland),
Guarulhos (Brazil), San Antonio (Chile), Vienna (Austria), Bangkok (Thailand, both sea
and air legs), St Petersburg (Russian Federation, both Callao and Puerto Bolivar
origins), Port Hueneme / Hueneme (United States, alias pair), Chancay (Peru, alternate
origin port to Kaohsiung), Frankurt Am Main (Germany — source-CSV typo preserved
deliberately so lookups keep matching the raw data), Algeciras (Spain), San Vicente
(Chile), Vancouver (Canada).

**Distinct routes still unmatched entirely** (fall back to the generic by_air/sea_freight
transit estimate, not even a provisional corridor-specific row), as of the 2026-07-24
regenerator run:

```
Lima, Peru -> Gdaåsk, Poland (1 deal)
Peru -> Netherlands (1 deal)
Callao, Chile -> Vancouver, Netherlands (1 deal)
```

**Updated after the 2026-07-28 merge** (the `Gdaåsk` row above is gone — that deal, a
test buyer named "Kuba," was removed entirely as a test entry, not fixed as a mojibake
match. But merging `likely_test` rows into scoring surfaced 5 new unmatched routes that
were previously invisible while synthetic rows were excluded):

```
Peru -> Netherlands (1 deal)
Callao, Chile -> Vancouver, Netherlands (1 deal)
SAN Antonio, Chile -> Shanghai, China (7 deals)
Callao, Peru -> Malaga, China (3 deals)
Callao, Peru -> Shanghai, China (1 deal)
Callao, Chile -> Hong Kong, Hong Kong (3 deals)
SAN Antonio, Chile -> Hong Kong, Hong Kong (1 deal)
```

The three China/Hong Kong corridors (15 deals total) are new gaps worth AC review —
they weren't a known gap before the merge because their backing deals were entirely
`likely_test` rows excluded from the generator's miss-counters. `Callao, Peru ->
Malaga, China` in particular looks like the same class of data inconsistency flagged
below for Vancouver/Netherlands (Malaga is a Spanish port, not Chinese) — worth
checking at the source before building a table row for it.

The original 3 are left unmatched deliberately rather than papered over:

- `Lima, Peru -> Gdaåsk, Poland` — mojibake in the destination city name (`Gdaåsk`
  instead of `Gdansk`) from the source CSV; a real "Gdansk, Poland" row already exists
  and would match if the source string were clean.
- `Peru -> Netherlands` — country-only origin/destination with no city/port, can't be
  matched to a specific corridor without guessing.
- `Callao, Chile -> Vancouver, Netherlands` — this is the "Frozen Berries from Chile"
  deal referenced in a code comment in `route-risk-tables.ts`: **Callao is a Peruvian
  port, not Chilean, and Vancouver is Canadian, not Dutch** — the origin/destination
  pairing itself is internally inconsistent in the source data. Fabricating a corridor
  row for this combination would encode bad data as if it were a real route; it's left
  unmatched so the fallback formula (not a false table match) scores it, and the
  inconsistency is flagged here for follow-up with whoever owns that CSV row.

**To close this gap:** get Table 2 rows AC-reviewed for the 19 provisional corridors
above (particularly Port Hueneme, which is the single largest-volume gap at 20 deals),
and get the 3 unmatched rows' source data corrected at origin (customs/logistics
system) rather than patched here.

## How "provisional" reaches the running app

Both `ProductRiskProfile` and `RouteRiskProfile` (see `src/types.ts`) carry the new
`scoreConfirmed: boolean` field. `src/lib/assessment.ts`'s `productWhy()` / `routeWhy()`
append `" (provisional, not AC-confirmed)"` to a deal's narrative whenever its matched
table row has `scoreConfirmed: false`, and the two new nav tabs render an explicit
badge per row — so a provisional score is visible both in an individual deal's
assessment and in the standalone reference tables, never silently presented as
AC-confirmed.
