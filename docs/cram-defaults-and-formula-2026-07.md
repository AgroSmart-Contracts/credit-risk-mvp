# CRAM formula sync & applied defaults — 2026-07-24

This documents the changes made to sync the CRAM scoring engine with
`tm-cram-engine-spec-2026-06.md` and the ERD (`trumarket-database-erd-final.drawio`),
and every default value applied to the platform deal dataset as a result. It is the
canonical reference for the `DEFAULT (decision 2026-07-24, ...)` comments scattered
through `src/lib/platform-deal-mapper.ts` and `scripts/build-platform-deals.ts`.

Source dataset: `~/Desktop/full-deals-dataset-2026-07 (1).csv` (170 rows). This is the
**authoritative CSV going forward** — all future updates should extend this file, not
the earlier exports it superseded.

## 1. Dimension weights (fixed, per decision)

```
Counterparty: 0.40   Product: 0.25   Route: 0.20   Structure: 0.15
```

Previously `{0.35, 0.20, 0.15, 0.30}` in `src/lib/scoring-constants.ts` — did not match
the spec. No versioned-weights infrastructure was built; these are hardcoded constants.
Post-harvest mode (a future TruMarket product surface with different weights/formula)
is explicitly out of scope for now.

## 2. Counterparty (Dimension A) formula — synced to spec §4.A

`src/lib/scoring.ts` was rewritten so buyer/supplier sub-scores use the spec's point
tables instead of the MVP's original ad-hoc curves, and the buyer/supplier blend
changed from 60/40 to the spec's **50/50**.

**Buyer score** = 50 + platform-deals points + years-in-business points + credit-rating
points + license points + capacity points, clamped 0–100.

**Supplier score** = 50 + platform-deals points + years-in-business points +
quality-cert points + license points + capacity points, clamped 0–100.

**Counterparty score** = `buyer * 0.5 + supplier * 0.5 + relationship`, clamped 0–100.

### Variables with zero data source anywhere (decision: keep spec weight, score neutral)

Four of the ten spec variables have no source column in any current TruMarket export.
Per the 2026-07-24 decision, these are **not dropped or redistributed** — they keep
their place in the point table and contribute exactly `0` (neither bonus nor penalty)
until a real source lands:

| Variable | Spec points | Status |
|---|---|---|
| Buyer credit rating | AAA–AA +15 / A–BBB +10 / BB–B +5 / ≤CCC −15 | `NEEDS_DATA_CREDIT_RATING_POINTS = 0` |
| Buyer capacity vs. monthly volume | ≤50% +5 / >2× −10 | `NEEDS_DATA_BUYER_CAPACITY_POINTS = 0` |
| Supplier quality certifications | multiple +15 / at least one +10 | `NEEDS_DATA_QUALITY_CERT_POINTS = 0` |
| Supplier capacity vs. production | ≤30% +5 / >100% −15 | `NEEDS_DATA_SUPPLIER_CAPACITY_POINTS = 0` |

These are marked with `NEEDS_DATA_*` constants at the top of `src/lib/scoring.ts` —
wire them up in place once buyer credit ratings, capacity figures, and supplier
certifications become available from a real source.

### Coface coverage is NOT a Counterparty input

Coface buyer-default credit insurance is **Gate 1** (a pass/fail pre-check run before
`compute_cram`), not one of the four scored CRAM dimensions — confirmed per spec §1 and
the user's explicit correction ("is per deal right? not related to the counterparty
risk score"). `externalCreditBonus()` in `scoring.ts` is kept only to drive the
counterparty "why" narrative text in `assessment.ts`; it is never added into
`computeCounterpartyScore`.

## 3. Years-in-business — moved to a company master file

Per decision ("it's per company, and it should be in the company details csv file"),
years-in-business is no longer treated as a per-deal-row field. `scripts/build-company-master.ts`
groups all non-`likely_test` deal rows by normalized counterparty name (handling
spelling/mojibake variants via `scripts/lib/company-name.ts`), computes a canonical YIB
per company (mode across observed values, ties resolved to the max), and writes
`src/data/company-master.json` / `.csv`.

Result: **19 real companies** (86 of 170 deal rows are synthetic `likely_test` rows and
were excluded — see §5). **7 of the 19 have no YIB source anywhere** and fall back to
the `default` provenance below.

Each platform deal record carries `buyerYibSource` / `supplierYibSource: "csv" | "default"`
so the UI and mapper can distinguish a real company-master value from a fallback.

## 4. Mapper-level defaults (unchanged logic, now documented)

Per decision 7 ("keep default values for now, just report them in a document that
those values has been a default value"), the following hardcoded defaults in
`src/lib/platform-deal-mapper.ts` were **left as-is** — only documented:

| Field | Default | Rationale |
|---|---|---|
| `buyer.licenseValid` | `true` | No license/KYC data source in any CSV export. |
| `supplier.licenseValid` | `true` | Same. |
| `buyer.avgPaymentDelayDays` | `0` (perfect) | No payment-timing history source. |
| `supplier.qualityRejectionRatePct` | `0` (perfect) | No quality-rejection source. |

These affect the license-points and (indirectly, via score ceilings) other sub-scores
for every platform deal until a real KYC/payment-history/QC source is integrated. They
are optimistic defaults — real data, once available, is more likely to lower these
scores than raise them.

## 5. Coface coverage default — persisted into the dataset

Per decision 5 ("make the default 90% from the dealvalue not 0... [persist it] into
the most recent csv file"), `scripts/build-platform-deals.ts` computes, for every deal
row where `cofaceRecordId` is empty (**100% of the 170 source rows** — no row in the
current export has a real Coface record):

```
cofaceCoverageAmountUSD = dealValueUSD * 0.9
cofaceCoveragePct = 90
cofaceIsDefaulted = true
```

This is written literally into the regenerated `src/data/platform-deals.ts` /
`platform-deals.generated.json` (not applied only at runtime), with `cofaceIsDefaulted`
kept alongside so defaulted rows remain distinguishable from real Coface records once
any exist. `fieldsNeedingConfirmation` on the mapped `Deal` includes a `"coface"`-tagged
entry for every such row.

## 6. Synthetic/test row exclusion

86 of the 170 rows in the source CSV are synthetic seed data (`likely_test = true`,
detected via round `10:00:00.000Z` `createdAt` timestamps and Mongo ObjectIds decoding
to impossible years) and are excluded from all scoring, aggregation, and the
company-master build. Regenerating the dataset now reports:

```
Excluded 86 likely_test rows out of 170 total.
Kept 84 real/unverified deals; 52 counterparty-ready.
8 scored buyer<->supplier pairs.
```

## 7. Relationship signal — computed, not defaulted

As a byproduct of building the generator (not separately re-confirmed after the user
said "didn't get it" to the original terse mention, but a natural requirement for the
synced formula's relationship term to be meaningful): `priorDealsBetweenParties` is
computed per buyer↔supplier pair as `pairTotalDealCount - 1` (same value repeated
across every deal in that pair — a documented simplification, not a true running
counter), and `relationshipAgeMonths` is computed from the min/max parseable
`createdAt` timestamps observed for that pair. Both replace what were previously
hardcoded/placeholder values.

## 9. Buyer credit rating — wired to Coface CRA/DRA grades (2026-07-24 follow-up)

The MVP already had a document-analysis pipeline (`src/lib/coface-analysis/`) that
extracts Coface's own CRA (country risk assessment) and DRA (debtor/company risk
assessment) letter grades — `A1`/`A2`/`A3`/`A4`/`B`/`C`/`D` — from an uploaded Coface
limit-notification PDF in the Assess Deal wizard, and stores them on
`Deal.cofaceCountryRiskGrade` / `Deal.cofaceCompanyRiskGrade`. This lines up exactly
with the ERD's `CofaceRecord.countryRiskGrade` / `CofaceRecord.companyRiskGrade`
fields. **`scoring.ts` never read either field** — the buyer credit-rating variable
was hardcoded to a neutral 0 regardless of whether a real Coface document had been
analyzed. That was the actual bug behind "buyer... doesn't consider risk value from
Coface for company and country."

Fixed: `computeBuyerScore` now calls `creditRatingPoints(deal)`, which reads
`deal.cofaceCompanyRiskGrade` (preferred — most specific to the debtor) and falls back
to `deal.cofaceCountryRiskGrade`, mapped onto the spec's point bucket via
`COFACE_GRADE_POINTS` in `src/lib/scoring.ts`:

| Coface grade | Points | Spec bucket |
|---|---|---|
| A1, A2 | +15 | AAA–AA |
| A3, A4 | +10 | A–BBB |
| B | +5 | BB–B |
| C, D | −15 | ≤CCC |

This mapping is a best-effort bucket assignment (Coface's scale isn't literally S&P
notches) — flag to AC if a different mapping is preferred.

**This does not change the earlier Coface-coverage decision.** `cofaceCoveragePct`
(the insurance coverage %, Gate 1) remains completely separate from this — it is still
not read by `computeCounterpartyScore`. What changed is a *different* pair of fields
(the risk *grades*, not the coverage *amount*) that the ERD's CofaceRecord entity also
carries, and that a real document-extraction pipeline already populates but the score
never consumed.

**Still neutral (0) for every platform CSV deal today**: none of the 84 real deals in
`full-deals-dataset-2026-07 (1).csv` have a Coface document on file (`cofaceRecordId`
is 0% filled, and the bulk CSV pipeline has no document-upload step at all) — so this
fix has zero effect on the current Counterparty scores / Platform deals / Missing
fields tabs until a real Coface PDF is uploaded and analyzed for a specific deal via
the Assess Deal wizard. It was not worth inventing per-country risk grades to populate
the bulk dataset artificially — that would mean presenting fabricated financial risk
data as real. If real Coface documents exist for some of the 19 companies in
`company-master.json` (one is already in `docs/Coface-Credit-Limit-EN (1).pdf` — a
EUR 40,000 approved limit for Agro Smart Contracts, LDA, Portugal, addressed against
debtor Terra Trading S.A.S., Colombia, dated 2026-05-25 — but it carries no risk grade,
only an approved amount, and isn't linked to a specific deal row), they'd need to be
uploaded through the wizard (or a bulk-CSV extension built later) to actually move a
score.

## 10. ID columns removed from deal records (2026-07-24 follow-up)

Per decision, raw ID fields were dropped from `PlatformDealRecord` and from every
missing-field label shown in the UI, since an ID is a database foreign-key concern
(see ERD `Customs._id`, `CofaceRecord._id`), not something a human reviewing this
CSV-driven tool needs as its own column:

- **`customsId` removed** from `PlatformDealRecord`. The DUA reference number already
  lives inside `customsNarrative`'s free text (e.g. `"DUA 011835-1 | 2025-02-15 |
  AEREO | ..."`) — no separate ID field is needed. `platform-deal-mapper.ts`'s
  `sourceDocuments` label now reads directly from `customsNarrative` instead of a
  bare ID.
- **`cofaceRecordId` was never exposed** as a field on `PlatformDealRecord` — it's read
  only internally in `build-platform-deals.ts` to decide `cofaceIsDefaulted`, and was
  never a public column. The missing-field **label**, however, was wrong on two counts:
  it named the raw ID (`"cofaceRecordId (...)"`), and — per correction 2026-07-24 —
  it shouldn't have existed as a "missing field" at all. `cofaceCoveragePct` /
  `cofaceCoverageAmountUSD` are never null or zero (always either a real record's value
  or the 90%-of-dealValue default), so there is no gap to flag — the field always has a
  confirmed, persisted value. `cofaceIsDefaulted` remains on the record to distinguish
  "this 90% is our assumption" from "this is a real Coface number" for anyone
  inspecting the data (e.g. the defaults CSV in §11), but it's no longer surfaced as a
  Missing Fields / `fieldsNeedingConfirmation` entry. Removed entirely from
  `COUNTERPARTY_ENRICHMENT_GAPS` (`deal-readiness.ts`) and from the generator's
  `missingFields` push (`build-platform-deals.ts`).

## 11. Defaults-applied CSV export

Per decision ("create another CSV file with all the default values... propagated"),
`scripts/build-platform-deals.ts` now also writes
`src/data/platform-deals-with-defaults.csv` — one row per real (non-`likely_test`)
deal, with every value actually reaching the scoring engine written out literally:
buyer/supplier license validity (`true`, mapper default), avg payment delay (`0`),
quality rejection rate (`0`), Coface coverage amount/pct + `cofaceIsDefaulted`, YIB +
its `csv`/`default` source, relationship signals, and the raw customs narrative. This
is a full audit artifact — nothing about what the formula actually consumes is hidden
in code; it's all visible in one flat file. Regenerate it any time by re-running
`npx tsx scripts/build-platform-deals.ts`.

## 12. Not built (explicitly out of scope for this round)

Two items from the original discussion were only explained, not approved, and remain
unbuilt:

- **Customs-narrative structured parsing** — extracting structured fields out of free-text
  customs declaration narratives. `customsNarrative` is captured as a raw string field
  on `PlatformDealRecord` but not parsed.
- **Counterparty-identity-confidence flagging** — a confidence score on how certain the
  name-normalization/dedup in `scripts/lib/company-name.ts` is that two spellings refer
  to the same real company. Not implemented; `company-master.json` currently treats its
  `ALIAS_MAP` entries as ground truth with no confidence signal.
