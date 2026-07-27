# Product & Route risk table gaps — 2026-07-24

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
| Fresh Mango | 55 | Provisional | Not in Table 1 at all. Backs 1 real deal (Kuba / MCORP, Poland). |
| Mixed Berries / Tropical Fruits (IQF) | 60 | Provisional | Not a tracked Nectora product line, not in Table 1. |
| Frozen Tropical Fruits | 60 | Provisional | Not a tracked Nectora product line, not in Table 1. Backs 0 real deals — the only referencing deal (Industrias Solimar SAC → Juhinej Ltd) is `likely_test`. |

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
transit estimate, not even a provisional corridor-specific row) after the last
regenerator run:

```
Lima, Peru -> Gdaåsk, Poland (1 deal)
Peru -> Netherlands (1 deal)
Callao, Chile -> Vancouver, Netherlands (1 deal)
```

These 3 are left unmatched deliberately rather than papered over:

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
