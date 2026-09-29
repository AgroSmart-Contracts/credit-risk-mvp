# Veritrade customs fill — 2026-08-24

Source: `Veritrade_CHIARA.RIVAS@TRUMARKET.TECH_PE_E_20260818044149.xls` (all Peru fresh-fruit/spice partidas, 188,597 rows, dated **2025-05-01 → 2026-08-14**). Unlike the 2026-08-09 file (blueberry HS `0810` only, 35,671 rows), this extract also covers avocado (`0804`), mandarin/citrus (`0805`), and ginger (`0910`) — closing exactly the gap the prior fill's "Limits" section flagged. It still has **no** rows for asparagus (`0709`) or IQF/frozen tropical (`0811`) — those chapters aren't in this pull at all, and it has **no 2024 rows**, which matters below.

Match: `exportador`+`importador` pair on normalized company name, falling back to buyer-only when the supplier doesn't appear as Exportador; then best-scoring candidate by date proximity + FOB/kg proximity, reserving DUAs already used earlier in the pass.

## Pipeline bug found and fixed while investigating date mismatches

`scripts/apply-platform-defaults-csv.ts` fed `docs/platform-deals-with-defaults-2.csv`'s `shipmentDate` straight into `new Date(row.shipmentDate)`. For **DD/MM/YYYY** values (this CSV's usual format) that's a landmine:

- day > 12 → `Invalid Date`, and the code **silently kept the old `shippingStartDate`** instead (fell through to `record.shippingStartDate`)
- day ≤ 12 → parsed as **MM/DD**, silently swapping month and day — wrong date, no error

**18 of 170 rows** had a slash-formatted `shipmentDate` and were hitting one of these two failure modes — including deals from *before* this session (E001-14, E001-30 already had this bug baked into their `shippingStartDate` from the 2026-08-09 fill). `shippingStartDate` also feeds `src/lib/price-benchmarks.ts`'s month-lookup for Dimension B pricing, so this wasn't cosmetic. Fixed with an explicit DD/MM/YYYY parser (`parseCsvDate` in `apply-platform-defaults-csv.ts`); full pipeline rerun, all 77 tests pass.

## Applied: customsNarrative filled (31 real deals)

3 confident (DUA date within 10 days of the deal's real recorded `shipmentDate`, now correctly parsed):

| Deal | DUA | Date | FOB | kg | Dest |
|---|---|---|---|---:|---|
| FRESH BLUEBERRIES E001-23 | 010331-1 | 2025-11-21 | $48,509.22 | 17,280 | ESPAÑA |
| FRESH BLUEBERRIES E001-11 | 050719-1 | 2025-07-18 | $10,453.20 | 1,530 | BRASIL |
| FRESH BLUEBERRIES AWB 996-13810366 | 081399-1 | 2025-11-03 | $66,744.00 | 6,480 | ISRAEL |

**8 low-confidence** — right buyer/supplier/volume, same year, but DUA date still 20–268 days from the recorded (correctly-parsed) shipmentDate. No evidence these recorded dates are wrong; more likely "right lane, not the exact shipment this file happens to contain":

- FRESH BLUEBERRIES E001-27 (268d), E001-19 (58d), E001-18 (69d) — Limax/Eagle Trading ← Tru Market
- Fresh Blueberries PI25E001-38 (27d), PI25E001-39 (20d) — Eagle Trading ← Tru Market
- EUROPE BULK (49d) — Limax ← Tru Market
- FRESH BLUEBERRIES AWB 996-13810366 ×2 more (83d, 26d) — Eagle Trading ← Holy Fruit Peru

**16 mandarin deal rows flagged as a likely year-entry error, not filled as a normal low-confidence match** — buyer Open Markets Corporation, recorded supplier Villaventura Peru SAC. Evidence and a correction to this section's own earlier claim:
- Each deal's MongoDB ObjectId shows the record was **created 2025-05-28/30**, but its recorded `shipmentDate` is **June–Aug 2024** — the record was created ~11 months *after* the shipment it claims to describe.
- Buyer (Open Markets Corporation) and volume (22,960 kg) are confirmed against 95 real Veritrade rows for this buyer, running weekly through 2025–2026.
- **Correction (verified after a follow-up check):** the recorded supplier "Villaventura Peru SAC" does **not** appear as an exporter paired with Open Markets anywhere in the file. The real exporter on 93 of 95 (98%) of Open Markets' mandarin imports — including all 16 best-scoring candidates for these specific deals — is **Bio Farming Peru S.A.C.**, a different, already-known real exporter in this dataset. The deal records also list destination port "Port Hueneme," which never appears in this buyer's real history either — actual ports are Balboa/Posorja/Valparaíso/Mejillones (Panama-Canal-area transshipment hubs), same destination country (USA) but a different specific port. Same pattern as the Drelifresh finding below: **the recorded supplier field looks like the wrong company**, not merely an unconfirmed one.
- This reads as a 2024→2025 typo on `shipmentDate` at data-entry time, but given the supplier/port mismatch, more than just the year may be wrong on these 16 records. **Not auto-corrected** — `shipmentDate` is a recorded field, not a blank one, so changing it needs sign-off, not an automated fill. Flagged inline in `customsNarrative` on all 16 rows (`[shipmentDate flagged: …]`) plus here. All 16 also share near-identical FOB and the same 22,960kg, so even setting the supplier question aside, which specific DUA belongs to which specific deal is still not verifiable — treat the DUA numbers as illustrative of "this lane exists," not a confirmed 1:1 shipment link.

**4 deals reverted to empty (genuinely 2024, unverifiable by this file)** — Fresh Ginger, FRESH BLUEBERRIES E001-16, E001-17, E001-12. Their `shipmentDate` is a real, correctly-parsed 2024 date (confirmed against MongoDB ObjectId creation time, which is also 2024) — but this Veritrade extract starts 2025-05-01, so it cannot contain their actual shipment. My first pass matched them to a 2025 shipment on the same buyer/supplier lane, which is very likely a *different* real shipment, not theirs — left these blank rather than record a probably-wrong DUA. (One correction to this logic mid-session: E001-27 and E001-11 were briefly misclassified into this bucket from a diagnostic that read the *pre-fix* `shippingStartDate` instead of the CSV's real date — both actually have real 2025 dates once the parser bug above is fixed, and are restored above with their correct classification.)

## Still not found (31 real deals) — same names as before, still absent as customs parties

| Buyer/Supplier | Deals affected | Note |
|---|---:|---|
| Agro Smart Contracts LDA | 13 | 0 hits as Importador across avocado/mandarin/blueberry |
| «Ardzhies» LLC | 2 | 0 hits (Russia-bound; Russia rows never populate Importador in any extract seen so far) |
| A.S.M International | 1 | 0 hits |
| Agrícola y Comercial Valles del Ñuble | 1 | 0 hits |
| Drelifresh SAS | 1 | 0 hits |
| Bio Farming Peru S.A.C. (as buyer) | 7 | Present as Exportador (124 rows) but 0 hits as Importador — these deals list Bio Farming as both buyer and supplier in Mongo, which looks like a data-entry placeholder rather than a real counterparty pair |
| Unknown buyer / Unknown supplier | 1 | Still unidentified |

Also unfillable by this file specifically: **Fresh Asparagus** (2 deal rows, HS `0709` absent) and **IQF/Frozen Tropical** (1 deal, HS `0811` absent) — need a different customs pull.

## Pipeline run

```
npm run apply-platform-defaults   # docs/platform-deals-with-defaults-2.csv → platform-deals.ts/.generated.json
npm run recalc-counterparties     # counterparty-sandbox-scores.json, counterparty-scores.csv
npm run export:deal-apy           # deals-analytics-dashboard prescored-deal-apy.json
npx vitest run                    # 77/77 pass
```
`scripts/aggregate-customs-companies.py` (byHs company-level aggregates) was **not** rerun — it hardcodes the older Veritrade/Datasur file paths and doesn't consume this file. Wiring this new extract into the company-level aggregator is separate follow-up work.

## Scope note — this does not touch MongoDB

`customsNarrative` / `shipmentCompany` exist only in this repo's local pipeline (CSV → `apply-platform-defaults-csv.ts` → `src/data/platform-deals.ts` / `.generated.json`). They are **not fields on the production MongoDB `Deal` schema** in `trumarket` / `admin-dashboard` — confirmed against both repos' Mongoose models and the admin-dashboard deals API. If real prod deals need this data, that requires adding customs fields to the actual `Deal` schema first — a separate, larger change.

## What's left to fill

1. **The 31 still-not-found deals above** — need either a different Veritrade pull that captures these importer names under an alias, or manual document-backed verification (BL/invoice consignee), same conclusion as the 2026-08-06 alias-search doc.
2. **Fresh Asparagus (HS 0709) and IQF/Frozen Tropical (HS 0811)** — this file has zero rows in either chapter; need a Veritrade pull scoped to those partidas.
3. **The 12 mandarin year-typo flags** — needs your decision on whether to correct `shipmentDate` from 2024→2025 (see flag text above); not done here by design.
4. **The 4 reverted 2024 deals** (Ginger, E001-16/17/12) — still have no customs narrative; would need a Veritrade extract that actually covers 2024 to verify them at all.
