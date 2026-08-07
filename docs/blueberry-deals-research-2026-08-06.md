# Blueberries deals — blank-field research (2026-08-06)

Research pass on the 5 curated Fresh Blueberries CRAM deals (`BLUEBERRY_CRAM_SAMPLE_MONGO_IDS` in `src/lib/blueberry-cram-analysis.ts`) to fill in blank Dimension‑A fields. Two rules governed this pass:

1. **No fabrication.** Fields with no real public source (Coface/CRA credit rating, payment delay history, quality rejection rate, buyer trade volume) stay blank — a plausible-sounding guess is worse than no data, since this feeds real Veto/tier decisions.
2. **Counterparty identifiers (RUC/taxId) were not changed**, even where research found a near-certain correction. That's a bigger decision than a data-fill pass and needs a human/compliance call — see "Red flags" below.

## The 5 deals

| # | mongoId | Buyer | Supplier |
|---|---|---|---|
| 1 | `690cf87e3d2ca4b63b280e92` | LIMAX SP. Z O.O. (Poland) | TRU MARKET BLOCKCHAIN S.A.C. |
| 2 | `19f4e57b930b0cc3a8609ea7` | Allied Trade Global (Taiwan) | AGRICOLA VIÑASOL SAC (Peru) |
| 3 | `06c34a88f0952a2320f620a8` | GUANGZHOU FRESH LINK IMPORT CO LTD (China) | ICA BLUEBERRIES SAC (Peru) |
| 4 | `23e57a6f048a99b2289e172e` | FRESH EXPRESS LLC (UAE) | FUNDO LAS LOMAS SAC (Peru) |
| 5 | `6972c74509dd14423e2461eb` | AGRO SMART CONTRACTS LDA (Portugal) | Holy Fruit Peru |

## What got filled

**Online verifiability** (weight 2, buyer + supplier) — applied via `src/lib/counterparty-research-overrides.ts`, consumed as a fallback by `dimension-a.ts` and `scripts/recalculate-counterparty-scores.ts` when there's no customs match (never overrides a real customs signal):

| Company | Tier | Basis |
|---|---|---|
| Allied Trade Global | less_authoritative (55) | Official site alliedtradeglobal.com found, but see red flag below — identity unconfirmed |
| AGRICOLA VIÑASOL SAC | less_authoritative (55) | Official site avsa.com.pe + LinkedIn ("AVSA"), but see red flag below — RUC unconfirmed |
| GUANGZHOU FRESH LINK IMPORT CO LTD | not_found (15) | Nothing found anywhere — registry, website, or directory — after an extensive search |
| ICA BLUEBERRIES SAC | less_authoritative (55) | Found via SUNAT-mirror registry aggregators with an exact-name match at a corrected RUC; no dedicated site |
| FRESH EXPRESS LLC | verified (90) | Official site + LinkedIn + Facebook, founded 1993, consistent identity across independent sources |
| AGRO SMART CONTRACTS LDA | less_authoritative (55) | NIF match via racius.com/kompass.com registry aggregators; no official site |

Full source URLs and confidence notes are in `src/lib/counterparty-research-overrides.ts`.

## What stayed blank, and why

- **Quality certifications** (all 5 suppliers) — left blank. Only Holy Fruit Peru had any certification claim at all (USDA Organic, BRC, HACCP, Rainforest Alliance, via its ConnectAmericas trade-directory profile) — but that profile is **self-reported and explicitly flagged by ConnectAmericas itself as "not yet verified."** Scoring on an unverified self-declaration would inflate trust on exactly the kind of claim this field exists to gate. Agricola Viñasol's site shows 5 unlabeled certification logos with no extractable cert names — not specific enough to classify. The other three suppliers had no certification information found at all.
- **Credit rating** (all 5 buyers) — no public source exists; this is a Coface/CRA product, not open data.
- **Payment delay days** (all 5 buyers), **quality rejection rate** (all 5 suppliers) — internal transaction/QC history, not public data by definition.
- **Monthly purchase volume, yearly sales, annual import volume, route diversity** for buyers without a customs match (Allied Trade Global, Guangzhou Fresh Link, Fresh Express, Agro Smart) — Peru's SUNAT/Veritrade export data only covers Peru-side exporters; the counterpart country's import-side trade data would require a paid service (Panjiva/ImportGenius/Trademo) and wasn't pursued for a private company's shipment-level figures. A couple of PR-sourced revenue/employee figures came up (Fresh Express: conflicting 300 vs. 529 employees between the company's own site and an aggregator) but weren't specific/reliable enough to convert into a volume-band score.

## Red flags for human follow-up (not applied to any data)

1. **Allied Trade Global (Taiwan, deal 2 buyer)** — the taxId on file, `54354228`, returns **no match** in Taiwan's company registry. A company operating at the same business address exists under a completely different legal name and registry number (成玉國際貿易有限公司 / Cheng Yu International Trade Co., Ltd., unified business no. `83727437`). This isn't a rounding/typo issue — the identifier on file doesn't correspond to any registered entity.
2. **Guangzhou Fresh Link Import Co Ltd (China, deal 3 buyer)** — zero independent verification found anywhere (registry, website, directory). Could be a real company that's simply hard to find online, or the name/tax ID on file could be wrong — currently unverifiable either way.
3. **AGRICOLA VIÑASOL SAC RUC (20534208008)** fails SUNAT's checksum algorithm — not a valid RUC as recorded. The closest name matches found (Corporación Agrícola Viñasol S.A.C., RUC 20543521401; or predecessor entity Agrícola Viñasol S.A., RUC 20449165331) use a different legal name, so it isn't confirmed to be the same counterparty.
4. **ICA BLUEBERRIES SAC RUC (20601449837)** also fails checksum. High-confidence correction available: **20601463971** is an exact legal-name match, checksum-valid, active/HABIDO — looks like a single-digit transcription typo, but wasn't applied here (identifier changes need a human call).
5. **Fundo Las Lomas RUC discrepancy** — two RUCs exist in-repo for this supplier: `20535311210` (in `docs/platform-deals-with-defaults-2.csv`-era sources) and `20538421279` (in the customs CSV / company-master). Only `20538421279` passes checksum and resolves to a real, active, registry-confirmed entity. `20535311210` isn't a valid RUC and doesn't match any company in any registry search — looks like a data-entry error, not a second entity. Not corrected here.

None of the 9 external companies researched showed any OFAC sanctions or litigation hits in open search — but for Guangzhou Fresh Link that's an absence-of-evidence result (couldn't find the company at all), not a clean bill of health.

## Not touched

`buyer.creditRating`, `avgPaymentDelayDays`, `qualityRejectionRatePct`, and the deal-level `insuranceCoverage`/`collateralType`/`paymentTerms` platform defaults are set elsewhere in the mapper (`src/lib/platform-deal-mapper.ts`) as hard-coded placeholders, not per-company blanks — out of scope for a data-research pass; those are a product/ops decision, not a research gap.
