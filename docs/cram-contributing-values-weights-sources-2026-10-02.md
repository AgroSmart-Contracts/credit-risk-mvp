# CRAM — contributing values, weights, and data sources

**As of:** 2026-10-02. Verified against live code (`src/lib/scoring.ts`,
`scoring-constants.ts`, `dimension-a.ts`, `counterparty-sandbox-scoring.ts`,
`price-benchmarks.ts`, `route-risk-tables.ts`,
`transaction-structure/compute.ts`), not just prior docs — several existing
CRAM docs (notably `customs-veritrade-erd-and-counterparty-use.md`'s
`counterparty = buyer×0.5 + supplier×0.5 + relationship` claim) have drifted
from what the code now does. Cross-referenced against
`trumarket/docs/trumarket-database-erd-v4.drawio`.

🚩 marks a value sourced from **Veritrade** (Peru customs/DUA data).

<details>
<summary>Internal: change history & background</summary>

**Update 2026-10-02:** Two Dimension A removals, both verified against code
(not just visual similarity) before cutting:

1. **"Platform transaction history"** (buyer weight 4, supplier weight 4) —
   a TruMarket-platform deal count that duplicated signal already captured
   by the platform-trust bonus and, for suppliers, the on-time-delivery-rate
   fallback, without adding independent information.
2. **Supplier "Production capacity (MT)"** (weight 4) — confirmed
   mathematically identical to "Annual export volume (MT)" in every code
   path (both read `customsEnrichment.volumeMt`, scored through the same
   `scoreVolumeMt()` band, in both `dimension-a.ts` and
   `recalculate-counterparty-scores.ts`). Kept "Annual export volume"
   (matches the buyer side's "Annual import volume" naming; more directly
   trade-finance-relevant framing of the same number). The ERD itself never
   had this redundancy — its `Counterparty` entity only ever modeled one
   aggregated volume field (`totalNetWeightKg`); the duplication was purely
   a code-level artifact in how the two weighted fields were independently
   built.

Buyer weight sum 40→36. Supplier weight sum 42→38→34. Code: removed
`scorePlatformTransactionCount()`, `platformTransactionCount`, and
`productionCapacityMt` from `counterparty-sandbox-scoring.ts`,
`dimension-a.ts`, and `scripts/recalculate-counterparty-scores.ts`;
`counterparty-sandbox-scores.json` regenerated under formula tag
`sandbox-weighted-shrink-2026-10-02b` (avg counterparty score shifted
57.4→58.1, confirming the duplicate field had been pulling real weight).

**Also found, not yet acted on:** `qualityRejectionRate` (supplier, weight
4) is in the same state as the already-flagged `qualityCertifications` —
hardcoded to `null` at every call site (`platform-deal-mapper.ts`,
`deal-builder.ts`, `src/data/deals.ts`) and absent from the real platform
deal dataset entirely (zero occurrences in `platform-deals.ts`). Unlike the
two removals above, this isn't a redundancy — on-time delivery rate (timeliness/logistics)
and quality rejection rate (product/QC conformance) are genuinely different
risk signals and both belong in the model in principle. The problem is
purely that no system anywhere writes a real value for it — there's no
claims/QC-tracking pipeline backing it, same gap already noted on
`qualityCertifications`. Flagged for a decision, not removed.

</details>

## Architecture note

The ERD v4 describes a **target** normalized schema (`Counterparty`,
`CRAM Assessment`, `routes`, `TxStructure`, `CofaceDealDecision`,
`CountryRisk` as proper Mongo collections — the diagram's own legend says
"orange = planned CRAM/CRM, not all in API models yet"). The **live**
`credit-risk-mvp` engine doesn't query these collections directly — it
scores an in-memory `Deal` object assembled from platform CSV fields plus
two precomputed flat-file caches: `counterparty-sandbox-scores.json`
(customs-enriched, built offline) and `route-risk-table-v2.csv` → compiled
`route-risk-tables.ts`. "Used" below means used by the actual formula,
regardless of whether it flows through the ERD's planned collection or a
flat-file stand-in for it.

## The composite formula (ground truth)

```
Overall = Counterparty×0.40 + Product×0.25 + Route×0.20 + Structure×0.15
```

Plus a **veto register** (hard stop, overrides the composite) checked
separately: invalid buyer/supplier license, confirmed-absent cargo
insurance, air transport with ≥4 stops, or a route-table `vetoCandidate`
flag.

---

## Dimension A — Counterparty (40% of overall)

All fields pool into one weighted average
(`counterparty-sandbox-scoring.ts`), then shrunk toward 50 by data-coverage
fraction, plus a flat +3 "platform trust" bonus if either party is
TruMarket-known.

### Buyer fields (weight sum 40)

| Field | Weight | Source |
|---|---|---|
| Years in business | 7 | `buyer.yearsInBusiness` — **not Veritrade**; SUNAT (`fecha_inscripcion`), not a DUA line |
| Credit rating | 7 | `buyer.creditRating`, manual/external bureau entry; auto-source from `cofaceCompanyRiskGrade` once an A1–A4/B/C/D mapping exists |
| Frequency of deals | 4 | 🚩 `customsEnrichment.shipments` |
| Monthly purchase volume (USD) | 4 | 🚩 derived (`yearlySales÷12`) |
| Yearly sales (USD) | 4 | 🚩 `customsEnrichment.fobUsd` |
| Annual import volume (MT) | 4 | 🚩 `customsEnrichment.volumeMt`, only when `roles` includes "importer" |
| Payment delay (days) | 4 | TruMarket platform-tracked; confirmed **not** derivable from Veritrade |
| Route diversity | 2 | 🚩 `customsEnrichment.routeCount` |
| Buyer country risk grade | 4 | `cofaceCountryRiskGrade` (Coface CRA) / ERD `CountryRisk.countryRiskGrade` |

<details>
<summary>Show formulas</summary>

| Field | Weight | Formula | Source |
|---|---|---|---|
| Years in business | 7 | `min(100, years×10)` | `buyer.yearsInBusiness` — **not Veritrade**; per `customs-veritrade-erd-and-counterparty-use.md`, this is SUNAT (`fecha_inscripcion`), not a DUA line |
| Credit rating | 7 | letter-grade → 28–90 | `buyer.creditRating`, manual/external bureau entry |
| Frequency of deals | 4 | tiered 15→95 by shipment count | 🚩 `customsEnrichment.shipments` |
| Monthly purchase volume (USD) | 4 | banded 25→90 | 🚩 derived (`yearlySales÷12`) |
| Yearly sales (USD) | 4 | banded 25→90 | 🚩 `customsEnrichment.fobUsd` |
| Annual import volume (MT) | 4 | banded 25→90 | 🚩 `customsEnrichment.volumeMt`, only when `roles` includes "importer" |
| Payment delay (days) | 4 | `max(15, 100−days×2)` | TruMarket platform-tracked; confirmed **not** derivable from Veritrade |
| Route diversity | 2 | tiered 35→95 by route count | 🚩 `customsEnrichment.routeCount` |
| Buyer country risk grade | 4 | Coface CRA grade (A1–A4/B/C/D) → mapped points | `cofaceCountryRiskGrade` |

</details>

### Supplier fields (weight sum 34)

| Field | Weight | Source |
|---|---|---|
| Years in business | 7 | SUNAT, not Veritrade |
| On-time delivery rate | 7 | TruMarket platform (`platformCompletionRate`, or finished÷total) — **genuinely populated** |
| Yearly sales (USD) | 4 | 🚩 `customsEnrichment.fobUsd` |
| Annual export volume (MT) | 4 | 🚩 `customsEnrichment.volumeMt` (note: unlike the buyer side, not gated on `roles.includes("exporter")` — falls back to raw `volumeMt` regardless; a minor asymmetry worth a second look) |
| Quality rejection rate | 4 | supplier QC / claims tracking |
| Frequency of deals | 2 | 🚩 `customsEnrichment.shipments` |
| Export license status | 2 | `supplier.licenseValid`, external registry/manual |
| Route diversity | 2 | 🚩 `customsEnrichment.routeCount` |
| Quality certifications | 2 | supplier certification registry |

<details>
<summary>Show formulas</summary>

| Field | Weight | Formula | Source |
|---|---|---|---|
| Years in business | 7 | same as buyer | SUNAT, not Veritrade |
| On-time delivery rate | 7 | pass-through 0–100 | TruMarket platform (`platformCompletionRate`, or finished÷total) — **genuinely populated** |
| Yearly sales (USD) | 4 | banded 25→90 | 🚩 `customsEnrichment.fobUsd` |
| Annual export volume (MT) | 4 | banded 25→90 | 🚩 `customsEnrichment.volumeMt` (note: unlike the buyer side, not gated on `roles.includes("exporter")` — falls back to raw `volumeMt` regardless; a minor asymmetry worth a second look) |
| Quality rejection rate | 4 | `max(15, 100−rate)` | supplier QC / claims tracking |
| Frequency of deals | 2 | tiered 15→95 | 🚩 `customsEnrichment.shipments` |
| Export license status | 2 | 0 or 100 | `supplier.licenseValid`, external registry/manual |
| Route diversity | 2 | tiered 35→95 | 🚩 `customsEnrichment.routeCount` |
| Quality certifications | 2 | tier 28/60/90 | supplier certification registry |

</details>

<details>
<summary>Internal: on-time delivery rate vs. quality rejection rate</summary>

**Do both make sense?** Conceptually yes, these measure different things:
on-time delivery is logistics/timeliness reliability, quality rejection is
product/QC conformance. A supplier can be perfectly punctual and still ship
bad product, or vice versa — not redundant in principle. In practice,
though, only on-time delivery rate actually has data behind it (it falls
back to a real `finishedDealCount÷dealCount` completion ratio when
`platformCompletionRate` is null, which it always is). Quality rejection
rate has no fallback and no data source at all — it's conceptually sound
but operationally dead, same class of problem as quality certifications,
not a case for removal on redundancy grounds.

</details>

### Relationship fields (weight sum 10, pooled into the same average)

| Field | Weight | Source |
|---|---|---|
| Prior deals between parties | 6 | `deal.priorDealsBetweenParties` — **TruMarket platform deal history only, not Veritrade** |
| Relationship age (months) | 4 | `deal.relationshipAgeMonths` — **TruMarket platform deal history only, not Veritrade** |

<details>
<summary>Show formulas</summary>

| Field | Weight | Formula | Source |
|---|---|---|---|
| Prior deals between parties | 6 | `min(100, count×20)` | `deal.priorDealsBetweenParties` — **TruMarket platform deal history only, not Veritrade** |
| Relationship age (months) | 4 | `min(100, months×100/24)` | `deal.relationshipAgeMonths` — **TruMarket platform deal history only, not Veritrade** |

</details>

Both are computed in `build-platform-deals.ts` purely from TruMarket's own
deal records: deals are grouped by `(buyerCompany, supplierCompany)` pair
key, `priorDealsBetweenParties = pairDealCount − 1`, and
`relationshipAgeMonths` = months between the earliest and latest
`createdAt` in that pair's deals. No customs/Veritrade join anywhere in
this computation.

---

## Dimension B — Product (25% of overall)

As of a 2026-07-30 rebuild, this is **entirely** price-vs-market now — the
old perishability/cold-chain/Grade-A product-risk table was explicitly
removed from the formula (code comment: *"the old PRODUCT_RISK_TABLE
`.score` / Grade A overlay is no longer added"*).

<details>
<summary>Show exact formula</summary>

```
score = base(55 if no benchmark match, else 70) + bandPoints(deflated % over usual price)
bandPoints: ≤15% over → +10, ≤30% → 0, ≤100% → −22, >100% → −35
```

</details>

- **Deal's own unit price**: `dealValue ÷ netKg` (preferred) or
  `offerUnitPriceUSD`, both deal/platform-entered.
- **"Usual" price to compare against**: looked up by
  product×origin×destination×shipment-month. 🚩 Primary source is
  **Veritrade customs FOB P50** per the file header comment; secondary is a
  precomputed platform-sheet CSV; tertiary fallback is a `marketIntel`
  adaptive-window benchmark persisted on the deal.

---

## Dimension C — Route (20% of overall)

Pure table lookup, no live computation:

<details>
<summary>Show exact formula</summary>

```
score = lookupRouteRisk(origin, destination, product, transportMode, numberOfTransshipments)
      → table score, minus 8 if the row is "unconfirmed" (scoreConfirmed: false)
      → 55 flat if no row matches at all
```

</details>

- **Deal-side inputs** (origin, destination, product, transportMode,
  transshipment count) are platform/contract-entered.
- **The table itself** (`route-risk-table-v2.csv`, compiled to
  `route-risk-tables.ts`, ~17.8k lines) is a precomputed reference built
  offline by `score_route.py` from transit-time/shelf-life modeling. The
  lookup function's own comment says it prefers **"AC/VERITRADE-confirmed"**
  rows when aliases collapse multiple lanes — so Veritrade partially backs
  the route table's `scoreConfirmed` flag, but it's baked into static
  reference data, not read live per deal.

---

## Dimension D — Structure (15% of overall)

**Two separate code paths**, depending on whether the deal has rich
`transactionStructure` data.

### Path 1 — flat fallback (`scoring.ts`, used when no structure data exists)

<details>
<summary>Show exact formula</summary>

```
score = 60 + collateralPoints + paymentTermsAdjustment + advancePaymentPoints + insurancePoints
```

</details>

| Component | Points | Source |
|---|---|---|
| Collateral type | −5 (None) to +25 (LC), +5 bonus if collateral ≥ deal value | `collateralType`, `collateralValueUSD` — deal-entered |
| Payment terms (text match) | −18 to +25 | `paymentTerms` free text — deal-entered |
| Advance payment % | 0–10 | `advancePaymentPct` — deal-entered |
| Insurance | −8 (unconfirmed) to +5 (All Risk) | `insuranceCoverage`, `insuranceConfirmed` — deal-entered |
| Trade-credit insurance coverage | 0 to +12 | `cofaceCoveragePct` — 0% → 0, >0% → +4, ≥50% → +8, ≥80% → +12. Distinct from the "Insurance" row above (credit-default backing vs. physical-loss cargo cover). |

### Path 2 — Kanato cash-flow model (`transaction-structure/compute.ts`, used when structure data is present — backs the ERD's `TxStructure`)

<details>
<summary>Show exact formula</summary>

```
composite = subA×0.5 + subB×0 + subD×0.5
```

</details>

- **Sub-A** (payment-terms exposure 60%, advance% 10%, contract type 15%,
  deal purpose 15%) — all from deal-level commercial terms.
- **Sub-D** (worst-case margin / upside-downside ratio) — from a full
  cash-flow simulation using the tranche timing/% fields (`supAdv*`,
  `supFin*`, `buyFirst*`, `buyFinal*`), sale/purchase price per kg, and
  logistics costs.

<details>
<summary>Internal: Sub-B and the insurance overlay (both zero-weight / display-only)</summary>

- **Sub-B is multiplied by zero, by explicit design** ("Kanato's own
  calibration decision"). It's fully computed —
  `tmProductOwnership`/`collectionRights` and a coverage ratio
  (`buyerFirstAmount ÷ saleTotal`) — and shown in the UI, but contributes
  nothing numerically.
- **The entire insurance overlay is also display-only in this path**:
  `computeInsuranceOverlay()` output (`insuranceIndemnityPct`,
  `insuranceCoverageCapUsd`, `insurancePolicyValidityDate`,
  `insurancePolicyholder`) is computed and returned in the report but never
  passed into `computeStructureScoreFromReport`. So a deal with a sparse
  structure gets insurance-scored via Path 1; the same deal once fully
  modeled in Kanato loses insurance from the score entirely.

</details>

---

<details>
<summary>Internal: Proposed additions — CountryRisk &amp; Coface rationale</summary>

## Proposed additions — CountryRisk & Coface (not yet implemented)

Why these two never reach the formula today, and — since this report doubles
as the spec for a formula rebuild — where they should plug in if wired up.

**Why CountryRisk doesn't contribute.** No scoring function anywhere reads
`cofaceCountryRiskGrade` (the live flat-engine field) or the normalized ERD
`CountryRisk` entity — they're the same underlying signal, the Coface CRA
(Country Risk Assessment) grade, just modeled in the ERD as its own
append-only fact table keyed by `countryCode` instead of a field on `Deal`.
Route (Dimension C) is a pure corridor lookup —
origin→destination→product→transportMode→table score — compiled offline
from transit-time/shelf-life modeling; it has no concept of a country's
sovereign, political, or currency-transfer risk. Nothing else in the engine
touches destination-country risk at all, so it's a genuine blind spot, not
an intentional exclusion.

**Why Coface doesn't contribute.** `externalCreditBonus()` in `scoring.ts`
computes a 0–12 value from `cofaceCoveragePct` (falling back to a flat 8 if
`externalCreditSignal` or `buyer.creditRating` is present), but the
function's own comment is explicit: *"Not a Dimension A score input… Gate 1
narrative only."* It's returned on `ScoreBreakdown.externalCreditBonus` and
surfaced as investor-facing "why" text — never added into `overall`.
`cofaceCountryRiskGrade` and `cofaceCompanyRiskGrade` are plumbed only as far
as `DocumentIngestion.tsx`'s display strings ("country A2", "company B") —
no scoring function reads either one.

**Recommendation: yes, wire both in.** Each measures something neither
existing dimension covers — country-level sovereign/transfer risk (not route
logistics risk) and third-party-verified credit-insurance backing (not a
manually-entered rating string) — so adding them isn't redundant with
anything already scored. Concrete proposed fields (also added above to the
relevant dimension tables, marked **proposed, not implemented**):

1. **Dimension A, Buyer fields** — new "Buyer country risk grade" field
   sourced from `cofaceCountryRiskGrade` (Coface CRA / ERD
   `CountryRisk.countryRiskGrade`).
2. **Dimension A, Buyer fields** — formalize the existing "Credit rating"
   field's source as `cofaceCompanyRiskGrade` (Coface DRA) — but only once a
   dedicated A1–A4/B/C/D mapping is written. `scoreCreditRating()` today only
   parses S&P-style letters (AAA/AA/A/BBB/BB/B/CCC-D); fed a Coface grade
   as-is, every one of A1–A4 falls into its single `startsWith("A")` branch
   and scores identically (85) — a real resolution loss, not just a label
   mismatch.
3. **Dimension D, Structure** — new "Trade-credit insurance coverage" field
   reusing `externalCreditBonus()`'s exact thresholds (0 / +4 / +8 / +12 for
   0% / >0% / ≥50% / ≥80% `cofaceCoveragePct`), kept distinct from the
   existing cargo-insurance row — one is credit-default backing, the other
   is physical-loss cargo cover.

</details>

<details>
<summary>Internal: computed but not scored (zero weight)</summary>

## Confirmed NOT part of the score at all (computed/displayed, zero weight)

- **All Coface fields** — `cofaceCoverageAmountUSD`, `cofaceCoveragePct`,
  `cofaceCountryRiskGrade`, `cofaceCompanyRiskGrade`,
  `cofaceRequestedCoverageAmountUSD`, plus the entire ERD
  `CofaceDealDecision` + `CofaceBuyerRating` entities.
  `externalCreditBonus()` computes a 0–12 value from these, but the code
  comment is explicit: *"Not a Dimension A score input... Gate 1 narrative
  only."* It feeds UI "why" text, not the composite.
- **`externalCreditSignal`** — same, narrative-only.

</details>

<details>
<summary>Internal: ERD fields that exist but never reach the score</summary>

## ERD fields that exist but never reach the score

| Entity | Field(s) | Status |
|---|---|---|
| **products** | `productCategory`, `perishabilityClass`, `shelfLifeDays`, `coldChainRequired`, `productRiskScore` | Entire legacy product-risk framework — superseded by the price-only rebuild, confirmed zero contribution to Dimension B. The one veto condition that *should* use shelf-life ("ultra-perishable + cold-chain execution deficient") is explicitly unimplemented — the code comment says the needed signal "doesn't exist anywhere in the CSV/document pipeline." |
| **CountryRisk** (whole entity) | `countryRiskGrade` | No dimension reads it. Destination-country risk isn't factored into Route (table is corridor-keyed, not grade-keyed) or anywhere else. |
| **Customs** (Veritrade raw rows) | `inspectionChannel` (VERDE/ROJO), `customsBroker`, `shippingLine`, `freightForwarders`, `grossWeight` (vs. `netWeight`, which *is* used), `declarationNumber` | Captured at ingest, never individually surfaced into any dimension. `inspectionChannel` in particular is a real potential signal (red-channel inspection flag) that's currently dormant. |
| **Counterparty** (planned collection) | `distinctBuyersCount`, `avgShipmentFobUsd`, `maxShipmentFobUsd`, `yearsActiveWithProduct`, `experienceScore`, `confidenceWeight` | Buyer-concentration and shipment-size-consistency signals aren't wired in (confirmed by the Veritrade doc's own "practical status" note). `experienceScore`/`confidenceWeight` look like they're meant to be the precomputed composite this entity stores — but the live engine recomputes its own equivalent in-process rather than reading these. |
| **Market-intel toolkit** (Python, not wired to live engine) | `dim_d3_pair_history` — 🚩 Veritrade exporter↔importer repeat-shipment pattern | A customs-sourced relationship signal exists but is a completely separate code path from `priorDealsBetweenParties`/`relationshipAgeMonths` (which are TruMarket-platform-only, see Dimension A above). Never reaches the live composite. |
| **companies** | `maxHistoricalTicketUsd`, `annualSalesUsd` (company-level, distinct from the customs-derived `yearlySalesUsd` path) | Ties to the next row. |
| **CRAM Assessment** (planned output) | `exposureToAnnualSalesPct`, `exposureToMaxTicketX` | A deal-size-vs-counterparty-capacity concentration check is modeled in the target schema but doesn't exist in any current dimension. This is the most consequential gap — no dimension currently checks "is this deal too big relative to what this counterparty normally does." |
| **product_price_routes** | `minUsdPerKg`, `maxUsdPerKg`, `spreadPct`, `nObservations` | Dimension B compares only against the single `usualUsdPerKg` (P50-equivalent); it ignores how wide or well-sampled that price distribution is, so a deal priced inside a wide/thin-data range is scored identically to one inside a tight/well-observed range. |
| **deals** | `incoterm`, `qualityGrade`, `routeRiskFlag` (deal-level, distinct from the route table's own flag), `portOfOrigin`/`portOfDestination`, `shipmentCompany`, `estimatedTransitDays` (deal-level — the table's own transit-days value is what matters, not this field) | None of these reach any dimension's math despite being classic trade-finance risk variables. |
| **TxStructure** | insurance overlay fields (see Dimension D above) | Computed, displayed, not scored when Kanato path is active. |

</details>

## Related docs

- [`customs-veritrade-erd-and-counterparty-use.md`](./customs-veritrade-erd-and-counterparty-use.md) — Veritrade↔ERD field map, Dim A customs-use pipeline (note: its formula section is stale vs. this doc)
- [`cram-formula-erd-audit-2026-07.md`](./cram-formula-erd-audit-2026-07.md) — prior audit pass
- [`tm-cram-engine-spec-2026-06.md`](./tm-cram-engine-spec-2026-06.md) — original spec this engine was built from
- `trumarket/docs/trumarket-database-erd-v4.drawio` — target schema cross-referenced above
