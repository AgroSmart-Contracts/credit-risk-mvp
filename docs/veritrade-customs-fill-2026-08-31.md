# Veritrade customs fill — 2026-08-31

## Methodology reset (project-owner directed, not a data finding)

This pass supersedes how the four prior fill docs (2026-08-09, -24, -29, -30) treated matching. It is a **policy change from the project owner**, not a new discovery about the data:

1. **All 170 rows in `docs/platform-deals-with-defaults-2.csv` are confirmed real production data from MongoDB**, including the 86 rows tagged `rowType=likely_test`. That label reflected a technical heuristic (round timestamps, impossible-year ObjectIds) that all four prior docs mistakenly read as "synthetic/fictional seed data." The project owner has stated directly that this reading was wrong. This pass gives all 86 `likely_test` rows the same matching effort and fill treatment as the 84 `real` rows — no exclusion, no deprioritization.
2. **Matching priority is now supplier name → route (origin/destination) → volume/product, in that order.** Buyer/importer name is explicitly **unreliable**: Veritrade's Importer field records the customs-declared consignee (freight forwarder, distributor, receiving agent), which is frequently not the deal's actual commercial buyer. A real match on supplier+route+volume+product with a *different* buyer/importer name is now recorded as **resolved**, with the buyer-name discrepancy noted in `customsNarrative` as expected/informational — not as an open question or a reason to withhold the fill.
3. **Supplier name mismatches are not excused by rule 2.** The project owner was explicit that the recorded supplier should always match the real exporter. Where it doesn't, that stays a genuine, unresolved anomaly (see Ardzhies/Drelifresh below) — this policy change does not touch that discipline, with one already-settled exception carried forward unchanged (`FRESH AVOCADO BK 6412923740`, resolved in the 2026-08-30 pass on an explicit supplier-substitution rule specific to that avocado/Bio-Farming/Villaventura case, not extended here).
4. **Customs data is authoritative on date when a real match is found.** When supplier+route+product match and volume is in the right ballpark (not necessarily near-exact — see rule 5), the real DUA's date now overwrites the deal's recorded `shipmentDate`, with the correction documented inline (old → new). This is broader than the 2026-08-30 pass's stricter "near-exact kg AND FOB, date-only differs" tiebreak (which found 0 qualifying matches).
5. **Split-shipment consideration**: before ruling out a match on volume, check whether summing several real customs rows (same supplier, same route, same product, clustered near the recorded date) approaches the recorded deal volume — and conversely whether one large real row might correspond to what MongoDB recorded as several smaller deals.

## Sources (unchanged from prior passes, re-parsed and re-verified)

- `docs/Veritrade_CHIARA.RIVAS@TRUMARKET.TECH_PE_E_20260818044149.xls` ("pass2"), tab-separated, **latin1/Windows-1252** encoded, Spanish headers. **188,597 rows**, dated 2025-05-01 → 2026-08-14. Row count and date range re-verified on load, matches all prior docs exactly.
- `docs/Veritrade_ALESSANDRO.CORDANO@TRUMARKET.TECH_PE_E_20260827071252.xls` ("pass3"), tab-separated, latin1-encoded, English headers. **159,932 rows**, dated 2024-01-01 → 2025-04-30. Same re-verification.
- Company-name normalization re-derived in Python from `scripts/lib/company-name.ts`'s `ALIAS_MAP`/`normalizeCompanyName`/`companyGroupKey` logic, consistent with all four prior passes. Two alias additions the 2026-08-30 doc *recommended but did not apply to the TS file* (`AGRICOLA Y COMERCIAL VALLES DEL ÑUBLE SPA`, `OPEN MARKETS CORPORATION 20533 BISC` + 2 truncated variants) were used for **search purposes only** in this pass's Python port, exactly as that doc's own analysis already relied on them — `scripts/lib/company-name.ts` itself was **not modified**, consistent with the "reporting-scope decision only" discipline of prior passes.

## Summary of outcome

- **20 CSV rows edited** (15 newly filled from blank, 5 upgraded from an existing low-confidence fill to confirmed).
- **19 `shipmentDate` corrections** applied (all edited rows except one, where the recorded date was already exact).
- **74 remain unresolved** among the `likely_test` pool (86 − 12 DAVIS-NL resolved) — all genuinely blocked, not skipped.
- **27 remain unresolved** among `real` rows with blank `customsNarrative`, plus the 16 flagged mandarin rows and 2 low-confidence rows (PI25E001-38/-39) that were re-examined and confirmed to still not qualify.
- Pipeline green: 170/170 matched, 77/77 tests pass (see bottom).

---

## Part 1 — Resolved this pass (dealRef-level detail)

### 1a. New fills (previously blank `customsNarrative`)

**`Fresh Blueberries` (Agro Smart Contracts LDA / Tru Market Blockchain S.A.C., Brazil, recorded 2024-08-23, 2,310kg)** — CONFIRMED. DUA 051837-1: same date (exact), same kg (exact, 2,310), real exporter Tru Market Blockchain S.A.C. (matches recorded supplier), real importer Benassi Sao Paulo Importacao e Exportacao Ltda (not Agro Smart Contracts LDA — informational per policy). No `shipmentDate` change needed (already exact). This resolves one of the Agro Smart Contracts LDA blueberry deals by checking "does Tru Market export blueberry near this date/volume/route, any importer" rather than "does Agro Smart Contracts import it" — exactly the direction reversal the policy calls for.

**`FRESH AVOCADO - AWB 160-91712386`** (Gourmet & Beverage One Group (Thailand) Co. Ltd / Bio Farming Peru S.A.C., 1,728kg, recorded 13/10/2025) — CONFIRMED. DUA 025347-1, 2025-04-05: exact kg (1,728), exact FOB ($4,320.00), exact destination country (Thailand), real exporter Bio Farming Peru S.A.C. (matches recorded supplier), real importer "GOURMET Y BENERAGE ONE GROUP THAILAND CO LTD" — same company as the recorded buyer, "Benerage" is a spelling variant of "Beverage" in the raw customs text, not a different company. `shipmentDate` corrected 13/10/2025 → 2025-04-05 (a ~6-month gap, but every non-date field was an exact match). This is the strongest single-row match found in this pass. A split-shipment check on Bio Farming's other Thailand-bound rows found none nearby — not needed here.

**`MANDARINA FRESCA -OMC- 5TEU`** (Agro Smart Contracts LDA / Bio Farming Peru S.A.C., 114,800kg, recorded 2025-05-21) — CONFIRMED, split-shipment (rule 5). "5TEU" in the deal name is the tell: 114,800kg = 5 × 22,960kg, and 22,960kg is the standard container size on the real Bio Farming Peru S.A.C. → Open Markets Corporation mandarin lane (the same lane behind the 16 flagged mandarin rows below). Five real, unclaimed rows from that lane combine to an exact volume match:

| DUA | Date | kg | FOB |
|---|---|---:|---:|
| 004039-1 | 2025-05-24 | 22,960 | $32,079.94 |
| 004620-1 | 2025-05-31 | 22,960 | $34,244.49 |
| 004621-1 | 2025-05-31 | 22,960 | $34,305.19 |
| 004942-1 | 2025-06-08 | 22,960 | $34,732.49 |
| 004707-1 | 2025-06-08 | 22,960 | $33,933.65 |
| **Total** | | **114,800** (exact) | **$169,295.76** (+8% vs recorded $156,702) |

Real exporter on all 5 is Bio Farming Peru S.A.C. (matches recorded supplier); real importer on all 5 is Open Markets Corporation, not Agro Smart Contracts LDA (informational). `shipmentDate` corrected to the nearest container's date: 2025-05-21 → 2025-05-24 (3-day gap; the other 4 containers run 10–18 days out).

**`MANDARINA FRESCA DAVIS-NL-001` through `-012`** (12 `likely_test` rows; buyer "Davis Global BV", supplier Bio Farming Peru S.A.C., 21,560kg each, Callao → Rotterdam) — all 12 CONFIRMED, same Bio Farming Peru S.A.C. → Open Markets Corporation mandarin lane as above. This is the lead the 2026-08-30 methodology had already partially surfaced; under this pass's policy it is treated as a confirmed match, not a lead, and filled:

| dealRef | DUA | New date | Old date | Gap | kg (real) | FOB (real) | Port |
|---|---|---|---|---:|---:|---:|---|
| DAVIS-NL-001 | 004763-1 | 2025-06-08 | 2025-06-09 | 1d | 22,960 | $34,542.61 | Balboa |
| DAVIS-NL-002 | 006030-1 | 2025-07-12 | 2025-07-10 | 2d | 22,960 | $33,307.34 | Balboa |
| DAVIS-NL-003 | 007780-1 | 2025-08-09 | 2025-08-12 | 3d | 22,960 | $30,679.30 | Valparaíso |
| DAVIS-NL-004 | 004941-1 | 2025-06-08 | 2025-06-06 | 2d | 22,960 | $34,041.67 | Balboa |
| DAVIS-NL-005 | 005059-1 | 2025-06-14 | 2025-06-12 | 2d | 22,960 | $33,306.54 | Balboa |
| DAVIS-NL-006 | 005589-1 | 2025-06-21 | 2025-06-18 | 3d | 22,960 | $33,325.62 | Mejillones |
| DAVIS-NL-007 | 005378-1 | 2025-06-21 | 2025-06-24 | 3d | 22,960 | $33,306.54 | Mejillones |
| DAVIS-NL-008 | 006305-1 | 2025-07-05 | 2025-07-07 | 2d | 22,960 | $34,767.91 | Valparaíso |
| DAVIS-NL-009 | 006413-1 | 2025-07-12 | 2025-07-14 | 2d | 22,960 | $33,306.54 | Balboa |
| DAVIS-NL-010 | 006801-1 | 2025-07-20 | 2025-07-21 | 1d | 22,960 | $23,904.42 | Balboa |
| DAVIS-NL-011 | 008009-1 | 2025-08-09 | 2025-08-10 | 1d | 22,960 | $27,345.86 | Valparaíso |
| DAVIS-NL-012 | 008060-1 | 2025-08-16 | 2025-08-20 | 4d | 22,960 | $29,481.70 | Balboa |

kg gap is a consistent 6.5% across all 12 (22,960 real vs 21,560 recorded) — right ballpark. Real importer on all 12 is Open Markets Corporation, not "Davis Global BV" (which appears **zero** times in either extract — informational per policy, not a blocking anomaly). One honest caveat carried into every one of these 12 narratives: **the recorded destination (Rotterdam, Netherlands) does not match the real customs destination (Estados Unidos, via Panama-Canal-area transshipment ports)** — Bio Farming Peru S.A.C.'s mandarin (HS `0805`) exports never go to Europe in either extract (175 mandarin rows checked: 141 Estados Unidos, 21 Colombia, 13 República Dominicana — zero Netherlands or any other European destination). This is treated as part of the same declared-consignee/transshipment-hub limitation the project owner flagged for buyer names, per the explicit instruction to fill this lane on supplier+product+volume+date — but it is flagged plainly, not glossed over, since it is a real, unresolved discrepancy on the route dimension specifically.

### 1b. Upgraded from low-confidence to confirmed (date corrections)

Re-checked all 9 low-confidence deals from the 2026-08-24/-29/-30 docs by re-deriving supplier-side matches from scratch (the strict supplier-must-match rule, §3 below, changed several of these outcomes from what a simple "take the existing low-confidence DUA's date" approach would have produced).

| dealRef | Old DUA (real exporter) | New DUA (real exporter) | New date | Old date | kg gap |
|---|---|---|---|---|---:|
| FRESH BLUEBERRIES E001-27 | 083159-2 (Tru Market) | **087484-1** (Tru Market) | 2025-01-01 | 15/02/2025 | 0% (exact) |
| FRESH BLUEBERRIES E001-19 | 067126-1 (Consorcio de Productores de Fruta S.A. — **not** Tru Market) | **065413-1** (Tru Market) | 2024-10-11 | 11/11/2025 | 2.9% |
| FRESH BLUEBERRIES E001-18 | 063306-1 (Q'inti Foods S.A.C. — **not** Tru Market) | **059938-1** (Tru Market) | 2024-09-24 | 11/11/2025 | 2.4% |
| FRESH BLUEBERRIES E001-17 | 065959-1 (Tru Market) | 065959-1 (unchanged, already correct supplier) | 2024-10-13 | 2024-10-30 | 0% (exact) |
| FRESH BLUEBERRIES AWB 996-13810366 (row 2 of 3) | 059014-1 (Holy Fruit Peru, but double-claimed with E001-39) | **073604-1** (Holy Fruit Peru) | 2025-10-06 | 2025-11-10 | 5.8% |

**Important correction surfaced by the strict supplier-match rule (policy §3):** the 2026-08-24 pass's low-confidence matches for E001-19 and E001-18 had silently fallen back to "buyer-only" matching — the real exporter on their previously-recorded DUAs (067126-1, 063306-1) was **not** Tru Market Blockchain S.A.C. at all, but two unrelated companies (Consorcio de Productores de Fruta S.A., Q'inti Foods S.A.C.) that happened to also ship to Limax Sp. Z O.O. This is exactly the kind of supplier mismatch policy §3 does *not* excuse. Both were re-matched against Tru Market Blockchain S.A.C.'s own real Limax-bound rows instead (a small, exhaustively-checked pool of 2 unclaimed real rows for 2 deals — an unusually clean 1:1 fit).

**EUROPE BULK was re-checked on the same basis and does *not* qualify** — its previously-recorded low-confidence DUA (068863-1) also turned out to be a non-Tru-Market exporter (Consorcio de Productores de Fruta S.A.) under the buyer-only fallback. The one real Tru-Market → Limax row close to its recorded volume (118757-1, 19,551.4kg vs recorded 19,600kg, 0.25% gap) is already claimed by `FRESH BLUEBERRIES E001-52`, which shares an identical recorded volume (19,600kg) and date (2025-11-11) — these two CSV rows are very likely duplicate records of the same physical shipment. Left unresolved rather than let EUROPE BULK reuse E001-52's DUA. **`customsNarrative` unchanged for EUROPE BULK.**

**Fresh Blueberries PI25E001-38 and PI25E001-39 were re-checked and do *not* qualify for upgrade** — both want the same Tru Market Blockchain S.A.C. → Eagle Trading Agriculture Marketing Ltd (Israel) lane as E001-27/-35/-41/E001-50, but that lane has exactly **5** real DUA line-items in either extract, and all 5 are now claimed by other, better-fitting deals (E001-27 via this pass's reassignment above, E001-35, PI25E001-41, E001-50, and PI25E001-39's own pre-existing 083159-1 which is a poor 51.7% kg-gap fit with nothing better available). This is the same DUA-scarcity pattern already documented for `FRESH AVOCADO - BK 27489042` in the 2026-08-29/-30 passes. **`customsNarrative` unchanged for both** — PI25E001-39 keeps its existing (still low-confidence) DUA 083159-1; PI25E001-38 stays exactly as before.

Two pre-existing DUA double-claims were resolved as a **byproduct** of the reassignments above (not separately hunted for): moving E001-27 off 083159-2 leaves that DUA solely with `FRESH BLUEBERRIES E001-50`; moving AWB996-13810366 (row 2) off 059014-1 leaves that DUA solely with `FRESH BLUEBERRIES E001-39`. Two other pre-existing double-claims remain untouched, out of this pass's scope: `085431-1` (PI25E001-38 / PI25E001-41 — see above, PI25E001-38 could not be moved off it because it never independently had a DUA in this pass's edits; to be precise, PI25E001-38's *existing* recorded DUA is 085431-1, shared with PI25E001-41, and no unclaimed replacement exists) and `081399-1` / `075566-1` (AWB996-13810355 vs AWB996-13810366 row 1; AWB996-13806111 vs AWB996-13810366 row 3) — carried forward unresolved exactly as in all four prior docs.

---

## Part 2 — Re-examined per the task's named groups, confirmed still unresolved

### The other 74 `likely_test` rows

Re-ran matching for every one of the remaining 12 supplier names using supplier-as-exporter search across both extracts (not buyer name), per policy. Two sub-categories:

**No anchor at all (49 rows)** — the recorded supplier has **zero** rows as Exporter in 348,529 combined customs rows: `GIDDINS PERU SAC` (TRD-CULT-001..007, 7), `JUHINEJ LTD` (SGC-CHN-001..007, 7), `ICA BLUEBERRIES SAC` (GFL-CHN-001..004, 4), `NATURAL SOUTH FRUIT LTD` (KHI-HKG-001..004, 4), `MIKHUNA FOODS SAC` (HSM-ESP-001..009, 9 — also independently blocked by HS `0709` having zero rows in either extract, so this group is doubly unfillable), `AGRICOLA MEDANO AZUL SAC` (XRK-ESP-001..010, 10 — buyer XARKI SL is real, per the 2026-08-30 doc's Lead 4, but that doesn't help since supplier is what must match and it doesn't), `BLUE PACIFIC FOODS SAC` (BFRSH-NL-001..006 + BPOLS-ESP-001, 7 — a real "Blue Pacific Oils" family of companies exists in the data but does a different business, oils not fresh produce; not treated as the same company), `INDUSTRIAS SOLIMAR SAC` (SOLIMAR-JHN-001, 1 — a real, differently-named `SOLIMAR INDUSTRIA E.I.R.L.` exists, singular/E.I.R.L. vs plural/SAC, exporting only to a French importer never paired with the recorded buyer JUHINEJ LTD; treated as a different legal entity, not a name variant, consistent with the 2026-08-30 doc's Lead 1 finding).

**Real supplier, wrong product/route (25 rows)** — the recorded supplier is a real, active exporter, but never ships the recorded product to the recorded destination: `CORPORACION AGRICOLA VIÑASOL S.A.C.` (ATG-TWN-001..012, 12 — real company, close name match to recorded "AGRICOLA VIÑASOL SAC" modulo a "Corporación" prefix likely dropped in the deal record, but its 53 real rows are 50 avocado shipments to Spain/Netherlands/China/Korea plus exactly 3 blueberry shipments, all to the USA in Jan 2024 — never Taiwan, the group's recorded destination); `Villaventura Peru SAC` / `VILLAVENTURA PRODUCE S.A.C.` (VLV-TWN-001..006, 6 — real company, 256 real rows, but zero are blueberry (HS `0810`) at all — only mandarin and avocado — and its only China-bound rows (avocado) go to Shanghai, not Taiwan); `FUNDO LAS LOMAS SAC` (FXP-UAE-001..007, 7 — real company, 123 real rows across blueberry and mandarin, but **zero** rows to any UAE destination in either chapter — its blueberry markets are UK/USA/Netherlands/Spain, its mandarin markets are USA/Mexico/Netherlands).

### The 9 low-confidence deals

Covered in Part 1b above: 5 of 9 upgraded to confirmed (E001-27, E001-19, E001-18, E001-17, and AWB996-13810366 row 2), 4 of 9 re-checked and confirmed to still not qualify (EUROPE BULK, PI25E001-38, PI25E001-39, and AWB996-13810366 row 3 — the latter for lack of any close-volume unclaimed Holy Fruit Peru DUA).

### Agro Smart Contracts LDA's remaining blueberry/mandarin deals

Re-checked "does Tru Market Blockchain (or the row's actually-recorded supplier) export this product on this route near this date, any importer" — the direction the policy calls for, reversed from the prior passes' "does Agro Smart Contracts import this."

- **Resolved**: the Brazil blueberry deal (2024-08-23) and the mandarin 5TEU deal — both in Part 1a above.
- **Still unresolved, no anchor**: the second Brazil deal (`Fresh Blueberries`, recorded 2024-10-15, 2,310kg) — Tru Market has only **one** real Brazil-bound row in either extract (the one claimed above), no second one to reuse. `Blueberries Export Canada` / `Blueberries EXW Canada E001-42` (Tru Market, Vancouver, 1,175.71kg) — Tru Market has **zero** Canada-destination rows anywhere in 30 real exporter rows. `Blueberries E001-50` (×2 duplicate rows, Taiwan, 15,921.08kg) — Tru Market's only real Taiwan row (DUA 023147-1, 9,000kg, 2026-07-19, importer Joy Lee Co. Ltd) is 43% off on volume and ~9.5 months off on date, well outside ballpark, and no second Taiwan row exists to sum against it. `FRESH BLUEBERRIES` (recorded supplier Holy Fruit Peru, Taiwan, 11,700kg) — Holy Fruit Peru's 18 real rows are 16 Israel + 2 India; **zero** Taiwan. `FRESH AVOCADO - BK 27489042` (Agro Smart Contracts / Bio Farming) — re-confirmed still blocked by DUA scarcity (exactly 3 real DUAs on this lane, all claimed by the 3 avocado deals filled in 2026-08-29). `Frozen Berries from Chile` (2026-01-06) — unchanged from 2026-08-30: pass2 has zero HS `0811` rows at all; pass3 has `0811` coverage but ends 2025-04-30, before this date. A genuine chapter/date-range gap, not a counterparty problem.

### A.S.M International (E001-33) and Gourmet & Beverage

**Gourmet & Beverage: resolved** (Part 1a above — an exact single-row match, split-shipment check wasn't even needed).

**A.S.M International (E001-33, 2,520kg, recorded 26/01/2025)**: split-shipment check performed as instructed. Tru Market Blockchain S.A.C.'s unclaimed real India/ASM rows are 056163-1 (360kg, 2024-09-10), 056163-2 (1,080kg, 2024-09-10), and 011891-1 (720kg, 2025-02-16) — no combination of these sums to anything near 2,520kg, and none cluster near the recorded date (Sept 2024 or Feb 2025 vs. recorded Jan 2025). One numerical coincidence noted for the record but **not acted on**: 011891-1 (720kg, 2025-02-16) + 011894-1 (1,800kg, 2025-02-16, but already claimed by the pre-existing confident fill for E001-14) sum to exactly 2,520kg — an interesting split-shipment candidate in principle, but reassigning an already-confident prior-pass fill (E001-14) is out of this pass's scope and E001-14's own recorded volume (1,440kg) doesn't obviously fit that reassignment either. **`customsNarrative` unchanged for E001-33.**

### Ardzhies (2 deals) and Drelifresh (1 deal) — stay open, per explicit instruction

Not resolved. Both remain blocked by a genuine supplier mismatch (Tru Market Blockchain S.A.C. never appears as the real exporter of record for either «Ardzhies» LLC across 150 real Ardzhies rows, or for Drelifresh SAS across 126 real Drelifresh rows — reconfirmed against the same 348,529-row combined dataset this pass; the Ardzhies count differs slightly from the 2026-08-30 doc's "152" figure, likely a small alias-normalization variance, not a material change to the finding). One observation carried forward for the record, **not treated as a resolution**: Tru Market Blockchain S.A.C. does have two real, unclaimed Russia-bound blueberry rows (DUA 003138-1, 11,700kg, 2024-11-18; DUA 003240-1, 6,426kg, 2024-12-05) whose volumes and dates are close to `E001-22` (11,700kg, 2024-11-20) and `E001-26` (6,426kg, 2024-12-07) respectively — but the counterparty field on both real rows is blank/redacted, not confirmably «Ardzhies» LLC, and the explicit instruction for this pass is that the Ardzhies category stays open regardless. `customsNarrative` unchanged for E001-22, E001-26, and TM-2026-018.

### The 16 flagged mandarin deals (Open Markets Corporation / Villaventura Peru SAC)

Unchanged, per explicit instruction — this is a genuine supplier mismatch (recorded supplier Villaventura Peru SAC; the real exporters behind the illustrative DUAs already on these 16 rows are actually Bio Farming Peru S.A.C., confirmed directly in this pass by cross-referencing those same DUA numbers against Bio Farming's own real row list), not a buyer/consignee issue, so this policy change does not resolve it. `customsNarrative` and `shipmentDate` unchanged on all 16 rows.

### The zero-trace groups — unchanged

`Arándano fresco` (Unknown buyer/Unknown supplier, 1 row) and the 7 `MANDARINA FRESCA...` rows where buyer and recorded supplier are both `BIO FARMING PERU S.A.C.` (the data-entry placeholder pattern flagged since 2026-08-24) — no distinct supplier name to search from, so this policy provides no new path to resolution. Unchanged.

### Fresh Asparagus (HS `0709`)

Still zero rows in either extract. `FRESH ASPARAGUS E001-10` (×2 duplicate rows) and the 9 `HSM-ESP-*` rows remain unfillable on product-chapter grounds alone, independent of the counterparty finding above.

---

## Pipeline run

```
npm run apply-platform-defaults   # 170/170 rows matched (hard=170, soft=0, ref=0, miss=0); 170 deals, 50 counterparties, 2 blocked
npm run recalc-counterparties     # 50 counterparties scored (avg 57.4); 15 customs-matched (13 via Matching Company overlay)
npm run export:deal-apy           # 169 deals written (1 skipped, pre-existing); 2025 scored 138, weighted APY 16.40%
npx vitest run                    # 77/77 pass
```

No pipeline code was modified this pass. `scripts/lib/company-name.ts` was **not** modified (two alias additions recommended in the 2026-08-30 doc were used for search purposes only in this pass's Python port, same as that doc already did for its own analysis — still a follow-up recommendation, not applied to the TS file). `scripts/aggregate-customs-companies.py` was **not** rerun, same as every prior pass — it hardcodes older Veritrade/Datasur file paths.

## Scope note — this does not touch MongoDB

`customsNarrative` / `shipmentDate` corrections exist only in this repo's local pipeline (CSV → `apply-platform-defaults-csv.ts` → `src/data/platform-deals.ts` / `.generated.json`), not on the production MongoDB `Deal` schema (confirmed in the 2026-08-24 pass, not reverified here).

## What's left

1. **74 `likely_test` rows** — 49 with zero anchor under either buyer or supplier name (or, for `HSM-ESP-*`, also blocked by a zero-row product chapter), 25 where the recorded supplier is real but never active on the recorded product/route. Not fillable from these two extracts regardless of buyer-name reliability, since the blocker is on the supplier/product/route side, which this policy does not relax.
2. **27 blank `real` rows** — see the per-group breakdown in Part 2. Roughly: DUA scarcity (BK 27489042, PI25E001-40 ×2, E001-49 ×3 — 6 rows), no anchor at all (Canada ×2, second Brazil deal, Taiwan ×3, E001-33, Unknown/Unknown, Bio-Farming-placeholder ×7 — 15 rows), explicit-exclusion supplier mismatch (Ardzhies ×2, Drelifresh ×1 — 3 rows), product-chapter gaps (Asparagus ×2, Frozen Chile ×1 — 3 rows).
3. **16 flagged mandarin rows + 2 low-confidence rows (PI25E001-38/-39) + EUROPE BULK** — re-examined, confirmed to stay exactly as before; no CSV changes.
4. **Two pre-existing DUA double-claims** remain unaddressed (`085431-1` on PI25E001-38/PI25E001-41; `081399-1`/`075566-1` on the AWB99*-family rows) — carried forward as a cleanup item across all five fill docs now.
5. **Company-name.ts alias additions** recommended in 2026-08-30 (Ñuble SPA, Open Markets BISC variants) — still not applied to the TS file; also worth considering a `CORPORACION AGRICOLA VIÑASOL S.A.C.` → `AGRICOLA VIÑASOL SAC` alias per this pass's ATG-TWN finding, though it wouldn't change that group's outcome (product/route still doesn't match).
