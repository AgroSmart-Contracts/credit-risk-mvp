# Veritrade customs fill — 2026-08-29

Source: `Veritrade_ALESSANDRO.CORDANO@TRUMARKET.TECH_PE_E_20260827071252.xls` (tab-separated text despite the `.xls` extension; English headers this time instead of Spanish — `Exporter`/`Importer` instead of `Exportador`/`Importador`). **159,932 rows, dated 2024-01-01 → 2025-04-30.** HS chapters: avocado `0804` (78,138 rows), blueberry `0810` (45,949), mandarin/citrus `0805` (17,770), **frozen/IQF `0811` (11,906) — new, first pull to cover this chapter**, ginger `0910` (6,169). Still **no** asparagus (`0709`) rows at all. This is the earliest-dated extract seen across all three passes — the 2026-08-24 file started 2025-05-01, so this one is the first to cover any 2024 shipment.

Match: `Importer`+`Exporter` pair on normalized company name (`scripts/lib/company-name.ts` rules ported to Python for this analysis), falling back to buyer-only when the supplier doesn't appear as Exporter; best-scoring candidate by date proximity + FOB/kg proximity; DUAs already used elsewhere in this pass reserved.

## Applied: customsNarrative filled (8 real deals)

**6 confident** (DUA date within ~10 days of the deal's recorded `shipmentDate`, right buyer/supplier, and volume — net kg — matching within a few percent):

| Deal | DUA | Date | Gap | FOB (customs) | kg | Dest | Note |
|---|---|---|---:|---:|---:|---|---|
| Fresh Ginger | 055677-1 | 2024-06-19 | 2d | $50,400.00 | 21,760 | PAÍSES BAJOS | kg within 0.06% of recorded 21,772.42 |
| FRESH BLUEBERRIES E001-12 | 054171-1 | 2024-09-01 | 0d | $22,907.35 | 2,240 | POLONIA | kg exact match |
| FRESH BLUEBERRIES E001-16 | 062002-1 | 2024-10-03 | 9d | $27,189.20 | 2,612.5 | POLONIA | kg within 2.9%; FOB −32% vs recorded (flagged for visibility, not enough alone to downgrade — date+kg both close) |
| FRESH AVOCADO - BK LMM0514033 | 001414-1 | 2025-03-12 | 1d | $51,933.34 | 24,000 | ESPAÑA | kg exact, FOB within 1.6% |
| FRESH AVOCADO - BK 21619266 | 002154-1 | 2025-04-01 | 0d | $19,940.00 | 24,000 | ESPAÑA | kg exact; FOB −62% vs recorded (plausible per-kg price swing on a weekly avocado program, but a real gap — worth a second look) |
| FRESH AVOCADO - BK 6412923740 2 | 003073-1 | 2025-04-22 | 2d | $28,776.92 | 24,000 | ESPAÑA | kg exact; FOB −45% vs recorded |

**1 low-confidence** — right buyer/supplier and exact kg, but date materially off:

| Deal | DUA | Date | Gap | FOB | kg | Dest |
|---|---|---|---:|---:|---:|---|
| FRESH BLUEBERRIES E001-17 | 065959-1 | 2024-10-13 | 17d | $16,522.80 | 2,816 (exact) | POLONIA |

**1 flagged anomaly** (supplier field looks wrong, same pattern as the mandarin/Villaventura case in the 2026-08-24 doc):

- **FRESH AVOCADO BK 6412923740** (buyer AGRICOLA Y COMERCIAL VALLES DEL NUBLE, recorded supplier BIO FARMING PERU S.A.C.) — the buyer is confirmed as a real importer on the deal's **exact recorded date** (DUA 001813, both line items, 2025-03-22, 0-day gap), but the real exporter of record is **VILLAVENTURA PRODUCE S.A.C.**, not Bio Farming. Combined kg (18,044) and FOB ($4,084.99) also differ substantially from the recorded deal ($27,035.10 / 32,300kg) — this could be a different, smaller shipment on the same buyer that coincidentally shares the date, or the recorded supplier/volume could simply be wrong. **Not auto-corrected** — flagged inline (`[supplierName flagged: …]`) per the established discipline; needs human sign-off.

### 2024 coverage gap fully resolved
All 4 deals the 2026-08-24 doc reverted to blank because they were genuinely 2024 and unverifiable by that (2025-05-01+) extract — **Fresh Ginger, FRESH BLUEBERRIES E001-16, E001-17, E001-12** — are now resolved by this earlier-dated pull (3 confident, 1 low-confidence, all above). No deals remain in that "genuinely 2024, no coverage" bucket.

### One deal left unresolved for lack of a spare DUA
**FRESH AVOCADO - BK 27489042** (AGRO SMART CONTRACTS LDA ← BIO FARMING PERU S.A.C., recorded 2025-04-08 / $50,400 / 24,000kg) sits on the same real lane as the 3 avocado deals filled above, but that lane has only **3** real DUAs in this window (001414-1, 002154-1, 003073-1) for **4** deal records claiming it. An optimal date-gap assignment (minimizing total gap across all 4 deals against all 3 DUAs) puts BK LMM0514033→001414-1 (1d), BK 21619266→002154-1 (0d), and BK 6412923740 2→003073-1 (2d) — all tighter than any assignment that includes BK 27489042. Left blank rather than reuse a DUA already claimed by a closer-fitting deal in this same pass.

## Still not found — status update on the 31-deal list from 2026-08-24

| Buyer/Supplier | Deals affected | 2026-08-24 status | This pull's finding |
|---|---:|---|---|
| Agro Smart Contracts LDA | ~12 on file now | 0 hits as Importador | **Now a confirmed real importer** — 3 avocado shipments from Bio Farming Peru S.A.C. (Mar–Apr 2025), which is exactly what resolved 3 of its avocado deals above (+1 left blank, DUA pool exhausted). Its blueberry and mandarin deals still have **no** matching product/lane for this buyer in this window, and several have recorded shipmentDates (2025-08 → 2026-01) past this extract's 2025-04-30 ceiling — still unmatched. |
| «Ardzhies» LLC | 2 | 0 hits (Russia rows never populate Importador) | **Correction**: Ardzhies **does** appear as Importador here — 112 real Peru→Russia shipments as `ARDZHIES LLC` (no guillemets) plus 1 as `ARDZHIES" LLC`, covering avocado/asparagus/mandarin, Jan 2024–Apr 2025. But **TRU MARKET BLOCKCHAIN S.A.C. never appears as exporter of record for this buyer** in any of the 112 rows (real exporters are Agrocrop Santa Peru, Corporación Tierra Brava, Negocacer, Grupo Clemencia, Inkapacking, Connect International Trade, EGA Agroindustrial, Espárragos del Perú, Agrícola Sunfields, Wambra Corp) — and there's no `0810`-family record at all in the Nov–Dec 2024 window either deal needs. Both deals stay unmatched; the earlier "Russia rows don't populate Importador" note in the prior doc is now known to be wrong — the real blocker is the exporter pairing, not Importador coverage. `company-name.ts`'s `«ARDZHIES» LLC` alias also doesn't cover the plain-ASCII-quote variants seen in this file — worth adding as a follow-up alias, though it wouldn't change the match outcome here. |
| A.S.M International | 1 (E001-33) | — (new deal since 08-24) | Real Peru→India blueberry-by-air lane confirmed for this buyer/supplier, and the closest candidate by date is only 9 days off — but its kg (1,800) and FOB (~$12.8–14.0k) are 29%/57% below the deal's recorded 2,520kg/$29,652, and every other candidate in-window has the same volume profile. No candidate meets even a loose "right volume" bar, so left blank rather than force a mismatched-size pick. |
| Agrícola y Comercial Valles del Ñuble | 2 on file now | 0 hits | **Now a confirmed real importer** — 2 avocado (`0804`) line items under DUA 001813, both dated exactly 2025-03-22, exporter VILLAVENTURA PRODUCE S.A.C. One deal (BK 6412923740) filled above as a flagged anomaly; the other (IQF TROPICAL FRUITS 40FT, needs `0811`) stays unmatched — this buyer's only real shipments on file are avocado, not IQF/frozen. |
| Drelifresh SAS | 1 (TM-2026-018, new dealRef) | 0 hits | **Now a confirmed real importer** under the plain form `DRELIFRESH SAS` (31 real Colombia-bound blueberry shipments, Jan–Apr 2025) — but every one is exported by RS Peruvian Business S.A.C., Raw Food Agrobusiness S.R.L., or Exportadora Frutícola del Sur SA, **never** Tru Market Blockchain (the recorded supplier). The deal's recorded shipmentDate (30/07/2026) is also far outside this extract's window regardless. Left blank; the buyer-existence finding is worth carrying forward, but the supplier pairing doesn't hold up, similar in shape to the Villaventura/Bio Farming mandarin case from 2026-08-24. |
| Bio Farming Peru S.A.C. (as buyer) | 7 (mandarin) | 0 hits as Importador (present as Exportador, 124 rows) | **Unchanged** — still 0 hits as Importador in this extract either. The "buyer==supplier data-entry placeholder" read from 2026-08-24 still stands. |
| Unknown buyer / Unknown supplier | 1 | Unidentified | Still unidentified — no shipmentDate on record either, nothing to match against. |

**Net effect on the 31-deal list**: the true "zero information" bucket shrank from 7 buyer/supplier groups to essentially 2 (Bio Farming-as-buyer, Unknown/Unknown) — the other 5 groups are now confirmed-real counterparties with an identified reason they still don't resolve (wrong exporter pairing, wrong product/HS, or volume mismatch), rather than companies absent from customs data entirely. 4 deals moved from "not found" to filled (3 confident avocado + 1 flagged anomaly); 1 more (BK 27489042) is blocked only by DUA scarcity, not absence.

## HS coverage check

- **Asparagus (`0709`)**: still absent — 0 rows in this extract, same as both prior pulls. FRESH ASPARAGUS E001-10 and the `likely_test` HSM-ESP-* rows remain unfillable regardless of counterparty.
- **IQF/Frozen Tropical (`0811`)**: **present for the first time** — 11,906 rows across `081190`/`081090`/`081110`/`081010`/`081120`/`081020`. This closes the chapter-coverage gap the prior two docs flagged. However, neither of the two real deals needing it (IQF TROPICAL FRUITS 40FT, Frozen Berries from Chile) actually resolved this pass: the first's buyer only has real avocado shipments on file, and the second's recorded date (2026-01-06) is outside this extract's window. The chapter gap is closed for the *next* pull, not this one.

## `likely_test` rows — none fillable

The defaults CSV has grown since 2026-08-24: 86 blank `rowType=likely_test` rows now exist (dealRefs like `TRD-CULT-*`, `FXP-UAE-*`, `SGC-CHN-*`, `GFL-CHN-*`, `ATG-TWN-*`, `XRK-ESP-*`, `HSM-ESP-*`, `DAVIS-NL-*`, `VLV-TWN-*`, `BFRSH-NL-*`, `KHI-HKG-*`, `BPOLS-ESP-*`, plus one Drelifresh-adjacent Frozen row), none of which had a `customsNarrative` filled in any prior pass. Checked every one systematically: for every single row, **neither** the buyer nor (independently) the supplier appears anywhere in this extract's 6,349 importer / 1,084 exporter keys. These read as synthetic/fictional counterparty names built for platform testing (company names like "Shanghai Green Chain Trading Co Ltd", "Trade Cultivators LLC", "Xarki SL" don't correspond to any real Peru export party in 160k customs rows) — not something any real Veritrade pull could resolve. None filled; none should be expected to fill from future real extracts either unless the underlying test data changes.

## Pre-existing DUA reuse (not touched by this pass)

While checking for collisions, found that DUA `083159-2` is already recorded on **two** different deals (`FRESH BLUEBERRIES E001-27` and `FRESH BLUEBERRIES E001-50`), both filled in earlier passes (2026-08-09 / 2026-08-24). This pass didn't introduce it and didn't touch either row — flagging it here for visibility since it violates the "one DUA per deal" rule this doc otherwise holds to; worth a cleanup pass on prior narratives at some point, but out of scope today (no documented reason found here to override an already-filled value).

## Pipeline bug check

Confirmed `parseCsvDate` (explicit DD/MM/YYYY parser) is still in place in `scripts/apply-platform-defaults-csv.ts` and is what `shippingStartDate` derives from — no regression. Sanity-checked it against every DD/MM/YYYY-formatted `shipmentDate` touched or read during this pass (`26/01/2025`, `13/10/2025`, `03/11/2025`, `15/01/2025`, `10/09/2025`, `30/07/2026`) — all parse as the intended day/month, not swapped. No new pipeline bug found; `apply-platform-defaults-csv.ts` was not modified.

One data-quality observation (not a pipeline bug, not corrected): dealRef `Fresh Blueberries PI25E001-40` appears twice in the defaults CSV with two different `shipmentDate` values (`03/11/2025` and `2025-03-10`) for the same buyer/supplier/value/kg. Neither variant produced a usable match this pass (the only real Eagle Trading Agriculture Marketing Ltd ← Tru Market shipment in this window is a single Jan-2025 air record with a 20–33% kg/FOB mismatch), so nothing was filled either way — but the duplicate-with-conflicting-dates pattern is the same shape of issue flagged for the mandarin/Villaventura deals in 2026-08-24, and is worth a human look independent of this fill.

## Pipeline run

```
npm run apply-platform-defaults   # docs/platform-deals-with-defaults-2.csv → platform-deals.ts/.generated.json
npm run recalc-counterparties     # counterparty-sandbox-scores.json, counterparty-scores.csv
npm run export:deal-apy           # deals-analytics-dashboard prescored-deal-apy.json
npx vitest run                    # 77/77 pass
```

`apply-platform-defaults`: 170/170 defaults rows matched (all via hard key, 0 misses). `recalc-counterparties`: 50 counterparties scored, 15 customs-matched. `export:deal-apy`: 169 deals written (1 skipped, pre-existing). `scripts/aggregate-customs-companies.py` was **not** rerun — same as both prior passes, it hardcodes older Veritrade/Datasur file paths and doesn't consume this extract; wiring it in is separate follow-up work, not attempted here.

## Scope note — this does not touch MongoDB

`customsNarrative` / `shipmentCompany` exist only in this repo's local pipeline (CSV → `apply-platform-defaults-csv.ts` → `src/data/platform-deals.ts` / `.generated.json`). They are **not** fields on the production MongoDB `Deal` schema in `trumarket` / `admin-dashboard` (confirmed in the 2026-08-24 pass against both repos' Mongoose models and the admin-dashboard deals API; not reverified here). If real prod deals need this data, that requires adding customs fields to the actual `Deal` schema first — a separate, larger change.

## What's left to fill

1. **Bio Farming Peru S.A.C. as buyer (7 mandarin deals) and Unknown buyer/Unknown supplier (1)** — the only two genuinely zero-information groups left from the original 31. Need manual document-backed verification (BL/invoice consignee) or a different data source; no Veritrade pull so far shows Bio Farming as an Importador at all.
2. **Agro Smart Contracts LDA's blueberry/mandarin deals, A.S.M International's E001-33, and Drelifresh's TM-2026-018** — buyer confirmed real, but product/exporter/date don't line up in any extract seen so far. Needs either a pull covering their recorded dates (several are 2025-08 → 2026-01, past every extract's ceiling so far) or confirmation that the recorded supplier/product fields are correct.
3. **FRESH AVOCADO - BK 27489042** — real lane, but the 3 available DUAs in-window are all closer fits for other deals on file; would need a wider-dated pull to find a 4th real record for this buyer/supplier pair.
4. **The flagged BK 6412923740 anomaly and the 16 mandarin year-typo flags from 2026-08-24** — both need a human decision on whether the recorded supplier/date fields are wrong; not auto-corrected by design.
5. **Fresh Asparagus (HS `0709`)** — still zero rows in any of the three extracts pulled so far; needs a Veritrade pull scoped to that partida specifically.
6. **86 `likely_test` blank rows** — confirmed unfillable by any real customs pull (synthetic counterparty names); out of scope for future Veritrade fills unless the underlying test fixtures change.
7. **Pre-existing DUA `083159-2` reuse** across E001-27/E001-50 — a cleanup item for prior-pass narratives, not addressed here.
