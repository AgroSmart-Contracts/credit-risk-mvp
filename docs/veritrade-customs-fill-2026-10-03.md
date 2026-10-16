# Veritrade customs fill — 2026-10-03

## Scope of this pass

The project owner asked, for every platform deal with no Veritrade reference, to **assume one or more recorded fields (buyer, supplier, commodity, route) could simply be wrong**, and to search for the real underlying shipment on that basis rather than taking the recorded fields as fixed search keys. This is a continuation of — not a restart of — the five prior fill docs (`veritrade-customs-fill-2026-08-09/24/29/30/31.md`, `veritrade-customs-fill-2026-09-14.md`). Those passes are not relitigated here except where this pass's wider search surfaced something new.

**Sources**: same three real extracts as the 2026-09-14/21 pass —
`Veritrade_CHIARA.RIVAS@TRUMARKET.TECH_PE_E_20260818044149.xls` (188,597 rows, 2025-05-01→2026-08-14) +
`Veritrade_ALESSANDRO.CORDANO@TRUMARKET.TECH_PE_E_20260827071252.xls` (159,932 rows, 2024-01-01→2025-04-30) = 348,529 Peru rows, plus
`Veritrade_CHIARA.RIVAS@TRUMARKET.TECH_CL_E_2026092114510.csv` (40,022 rows, Chile exports, HS `0811` only). The two small legacy single-chapter files (`Veritrade_UL-20111724_PE_E_20260109105908(new).csv`, blueberries only; `...110033.xlsx`, coffee only) were not re-parsed — both are strict date/HS-chapter subsets of the two big files above (confirmed by `scripts/aggregate-customs-companies.py`'s own file comments) and add no coverage the big files don't already have. Row counts re-verified on load, exact match to all prior docs.

**What's different about this pass's method**: every prior doc anchored its search on the recorded **lane** (supplier → that specific buyer/route/product) and reported "supplier is real but never ships this product/route" as the end of the trail. This pass additionally pulled each blocked supplier's **entire** real export history — any product, any destination, any buyer — and checked it directly against each deal's date and volume, independent of what was recorded for the other fields. This is the literal operationalization of "assume the commodity or destination could be wrong too."

**Known data quirk found and corrected for in this pass's own tooling**: the raw extracts' `DUA / DAM` field is not a globally unique key — the same bare number recurs across unrelated shipments at different customs offices and different years (e.g. bare DUA `011314` appears on four unrelated shipments: Martinique 2025-07-23, USA 2025-11-08, USA 2025-12-10, UK 2026-07-14). Every candidate below was re-verified against the raw rows directly (exporter + importer + exact date + HS + customs office) before being treated as real, not just matched by bare DUA digits.

---

## Resolved this pass — 7 deals (new finding)

**The "Bio Farming Peru S.A.C. as both buyer and supplier" mandarin group.** All five prior docs flagged this group (`69c6a889`, `69c6a7d9`, `69c6a832`, `69c6a855`, `69c67d82`, `69c6a452`, `69c6a642` — dealRefs `MANDARINA FRESCA...`, Nov 2025, Callao→USA, 22,960kg nominal) and left it unchanged, reasoning that the buyer field offered "no distinct name to search from" since it was identical to the supplier. That reasoning conflated two different things: the **buyer** field being a placeholder does not make the **supplier** field (Bio Farming Peru S.A.C., a well-documented real mandarin exporter with 175 real `0805` rows in the combined extracts) any less searchable. This pass searched Bio Farming's own exporter history directly, independent of the buyer field, and found an essentially exact match for all 7:

| dealRef | Recorded date | Recorded kg/GMV | DUA | Real date | Real kg | Real FOB | Real port | Real importer |
|---|---|---|---|---|---:|---:|---|---|
| `MANDARINA FRESCA 261433095-HUENEME-MNBU0401959` | 2025-11-08 | 22,960kg / $22,500.80 | 011314-1 | 2025-11-08 (0d) | 22,960 (exact) | $33,475.53 | Valparaíso | Open Markets Corporation |
| `MANDARINA FRESCA 261715398-HUENEME-MNBU4360842` | 2025-11-15 | 22,960kg / $21,812.00 | 011509-1 | 2025-11-15 (0d) | 22,960 (exact) | $33,489.82 | Balboa | Open Markets Corporation |
| `MANDARINA FRESCA-PER8823983A-MIAMI-SZLU5010513` | 2025-11-17 | 22,960kg / $21,812.00 | 011448-1 | 2025-11-17 (0d) | 20,810 (9.4%) | $32,569.93 | Miami | Open Markets Corporation |
| `MANDARINA FRESCA PER8823982A-MIAMI-SMLU5477740` | 2025-11-17 | 22,960kg / $21,812.00 | 011449-1 | 2025-11-17 (0d) | 20,950 (8.8%) | $31,688.83 | Miami | Open Markets Corporation |
| `MANDARINA FRESCA` | 2025-11-22 | 22,960kg / $21,812.00 | 011687-1 | 2025-11-22 (0d) | 22,960 (exact) | $34,978.23 | Balboa | Open Markets Corporation |
| `MANDARINA FRESCA 261987687-HUENEME-MNBU0631925` | 2025-11-22 | 22,960kg / $21,789.04 | 011686-1 | 2025-11-22 (0d) | 22,960 (exact) | $28,382.79 | Balboa | Open Markets Corporation |
| `MANDARINA FRESCA PER8830115A -MIAMI-SEGU9383086` | 2025-11-24 | 22,960kg / $21,789.04 | 011625-1 | 2025-11-24 (0d) | 21,390 (6.8%) | $33,646.17 | Miami | Open Markets Corporation |

All 7: **exact date match (0-day gap)**, HS `0805299000` (mandarin, matches recorded product), Chancay customs office, destination USA (matches recorded corridor), 4 of 7 exact-kg and the other 3 within 6.8–9.4% — the same "right ballpark" tolerance already accepted on the DAVIS-NL/5TEU mandarin fills in the 2026-08-31 pass (up to 6.5%). Every DUA was independently re-verified exporter+importer+date+office directly against the raw rows (not just matched on bare DUA digits) given the DUA-reuse quirk above; all 7 are distinct DUAs, none double-claimed, none colliding with any of the 85 already-claimed DUAs on file.

**What was actually wrong**: the recorded **buyer** field. "Bio Farming Peru S.A.C." as buyer is not a real company name search miss — it's a data-entry placeholder (buyer defaulted to equal the supplier), consistent with the same pattern already identified and named in the 2026-08-24 doc for this exact group. The real buyer on all 7 is **Open Markets Corporation** — the same counterparty already established across 15+ other Bio-Farming-mandarin deals in the prior docs (DAVIS-NL ×12, 5TEU ×1, and the originally-filed plain-name mandarin lane), so this isn't a new company, just the correct value for an already-known relationship.

**Applied**: `customsNarrative` filled for all 7 rows in `docs/platform-deals-with-defaults-2.csv`, following the exact convention established in the prior docs (DUA | date | mode | FOB | kg | destination(port) | prose explaining the match and the buyer-field discrepancy). `buyerName`/`supplierName` themselves were **not** overwritten — same discipline as every prior pass, since those fields mirror MongoDB and this local CSV pipeline only carries narrative/date corrections, not identity overrides. `shipmentDate` needed no correction (every match is an exact 0-day gap).

---

## Re-checked, confirmed still unresolved (no new finding)

Everything below was re-verified this pass by pulling the named supplier's **entire** real shipment history (any product/destination), not just their recorded lane, specifically to test the "wrong commodity or destination" hypothesis harder than the prior docs did. None of it overturns the prior conclusion; two are worth recording in detail because the wider search surfaced something that looked promising at first and had to be ruled out.

### Blue Pacific Oils ginger group (7 deals, `BFRSH-NL-*` / `BPOLS-ESP-001`) — near-miss, ruled out

The wider search found that nearly every one of Blue Pacific Oils' real USA-bound ginger shipments weighs almost exactly 19,584kg net — strikingly close to the 19,595.17kg recorded on 6 of these 7 deals — with several landing within 0–7 days of the recorded dates. This looked like a strong "right shipment, wrong recorded destination/buyer" candidate. It isn't: **19,584kg is simply this exporter's standard ginger container weight** — it repeats on roughly 60 of their ~116 real rows across the entire 15-month window, so it has no matching power on its own. More decisively, **price per kg doesn't hold up**: every recorded deal in this group prices at $2.74–2.89/kg, while every real shipment of this exporter's ginger — to the USA, Netherlands, Canada, or anywhere else in either extract — prices at $0.68–1.72/kg (the real USA-bound rows, the closest in kg, average roughly half the recorded price). A systematic ~2x price gap across every single real row this exporter has, not just the closest-date one, is not consistent with "same shipment, wrong destination" — it reads as two genuinely different price regimes. **No fill applied**; this specifically confirms (not just repeats) the 2026-09-14 doc's "company real, lane doesn't exist" conclusion.

### Everything else — confirmed, citing the specific prior finding

| Group | Deals | Status |
|---|---:|---|
| `AGRICOLA LOS MEDANOS S.A.` (asparagus→Xarki/Spain) | 10 | Confirmed again: real company, 936 rows, but passion fruit/IQF almost entirely to USA — zero Spain asparagus. No close date+volume match anywhere in its full history either (closest real rows are 10–150 days off and a different HS chapter). See 2026-09-14 doc. |
| `BERRYCO S.A.C.` (blueberry→Guangzhou/China+Spain) | 4 | Confirmed: 74 rows, mostly NL/UK/USA blueberry, zero China. No close match in full history (best is 128+ days off, 38% kg gap). |
| `CORPORACION AGRICOLA VIÑASOL S.A.C.` (blueberry→Allied Trade/Taiwan) | 12 | Confirmed: 53 rows, overwhelmingly avocado to Spain/NL/China/Korea, zero Taiwan. |
| `VILLAVENTURA PRODUCE S.A.C.` (blueberry→Allied Trade/Taiwan) | 6 | Confirmed: 256 rows, mandarin+avocado only, zero blueberry at all. |
| `FUNDO LAS LOMAS SAC` (blueberry→Fresh Express/Dubai) | 7 | Confirmed: 123 rows, UK/USA/NL/Mexico/Spain, zero UAE. |
| `MIKHUNA PERUVIAN FOODS SOLUTIONS S.A.C` (ginger→Hacienda Sotomayor/Spain) | 5 | Confirmed: 99 rows, real Spain ginger business exists (46 rows) but never to Hacienda Sotomayor specifically. |
| `SOLIMAR INDUSTRIA E.I.R.L.` (IQF→Juhinej/Chile) | 1 | Confirmed: only 2 real rows, both to Netherlands/Ethiquable, zero Chile; Peru→Chile can't be filled from Chile's own export extract either (that extract is Chile-origin only). |
| `JUHINEJ LTD`, `NATURAL SOUTH FRUIT LTD`, `GIDDINS PERU SAC` (as supplier) | 7+4+7 | Confirmed zero rows under any spelling, in Peru or Chile extracts. |
| `TRU MARKET BLOCKCHAIN S.A.C.` — remaining groups (2nd Brazil, Canada ×2, Taiwan ×2, India E001-33) | 7 | Confirmed: TruMarket's real export footprint (30 rows total) has no second Brazil row, zero Canada destination, and its one Taiwan row / India rows are far off on volume and date from every one of these. |
| `«Ardzhies» LLC` (Russia) / `Drelifresh SAS` (Colombia) | 3 | Re-confirmed real companies, but TruMarket is never their declared exporter (150+/126+ real rows each) — stays open per the explicit 2026-08-31 instruction not to resolve this one on a volume/date coincidence alone. |
| 16 flagged mandarin rows (Open Markets/Villaventura mix-up) + `FRESH ASPARAGUS` (HS `0709`, zero rows anywhere) + `Unknown buyer/Unknown supplier` | 18 | Unchanged, no new information this pass. |

---

## Addendum — flipping the anchor to the buyer side (completely different company, not just a typo)

The checks above all anchored on the recorded **supplier** name and searched harder for it. That leaves open a different failure mode: what if the recorded supplier (or buyer) isn't a misspelling of the real company at all, but a **completely different, unrelated company**? This addendum flips the anchor — for every remaining buyer name, it pulls *all* that buyer's real importer rows, independent of which supplier is recorded, and looks for a different real exporter that fits.

**Confirmed zero presence, verified by raw substring search (not just normalized-key lookup, to rule out a normalization bug)**: `Fresh Express LLC`, `Guangzhou Fresh Link` (and `Fresh Link` alone), `Shanghai Green Chain`, `KHI International`, `Biofreshi BV`, `Anterra Farms GmbH` — none appear anywhere in the 388,551 combined Peru+Chile rows under any spelling tried. These stay fully unresolved on both sides.

**Allied Trade Global (18 deals: `ATG-TWN-*` ×12, `VLV-TWN-*` ×6)** — stronger than the prior per-supplier finding: there are **zero blueberry shipments to Kaohsiung, Taiwan in either extract, from any exporter or importer at all.** This isn't just "the recorded companies don't do this" — the corridor itself (blueberries → Kaohsiung) has no real presence in the data for anyone. Confirms, more strongly than before, that this group is unresolvable from these extracts regardless of which company names are attached.

**Alboran Comex Spain SL (1 deal, ginger→Spain)** — a real buyer exists under a slightly fuller name (`ALBORAN COMEX SPAIN SL`, 24 real rows; the recorded `ALBORAN COMEX SL` is missing the "SPAIN" token, the same shape of alias gap as the already-documented `OPEN MARKETS CORPORATION 20533 BISC` case). Of its 24 rows, 23 are avocado and exactly **one** is ginger (HS `0910`) — the one real ginger shipment this buyer has ever received, in either extract. But its exporter is **Costa Produce S.A.C.**, not the recorded Blue Pacific Oils, and it's dated 2026-03-03 against a recorded 2025-12-12 (81-day gap) — wrong company, and too far off on date to call a match even though the volume is close (21,760kg vs recorded 22,500kg, 3.3%). Not resolved, but worth naming Costa Produce S.A.C. explicitly here in case it means something to the project owner.

**Eagle Trading Agriculture Marketing Ltd — the one genuinely open question from this addendum (5 deals: `68839b61`, `68839a11`, `690cfcb6`, `6915d77a`, `6915ee68`; recorded supplier Tru Market Blockchain S.A.C., recorded destinations Tel Aviv ×2 / Dubai ×3).** Pulling every real row to this buyer (23 total) shows **Holy Fruit Peru S.A.C. is the dominant real supplier (15 of 23 rows, 65%) — not Tru Market (5 of 23, 22%), and every one of Tru Market's 5 real rows to this buyer is already claimed by other, already-confirmed deals from prior passes.** Two things point the same direction but don't quite close the loop:

1. Every single real shipment to this buyer — Tru Market's or Holy Fruit's — goes to **Israel**, never Dubai. This is not new uncertainty: the already-confirmed sibling deals on this exact lane (`FRESH BLUEBERRIES AWB 996-13806111/-13810355/-13810366`, which correctly record **Holy Fruit Peru**, not Tru Market, as supplier) are *also* recorded with destination "Dubai, United Arab Emirates" while their real, already-accepted DUA match is Israel every time. So "Dubai" appears to be a systematic mislabel across this whole buyer's deal family, already implicitly accepted for the Holy-Fruit-recorded siblings — not something newly discovered here, but newly connected to this specific 5-deal group.
2. The one real row that date-and-volume-matches best — DUA 081399-1, 2025-11-03, exactly 6,480kg, Israel — is **already claimed by two different existing deal records simultaneously** (`AWB 996-13810355` and, ambiguously, `AWB 996-13810366`), a pre-existing double-claim flagged unresolved in every prior doc since 2026-08-29. Three of this pass's 5 target deals want exactly that same date+volume (690cfcb6/6915d77a/6915ee68, all 2025-11-03, 6,480kg) — which reads less like "these are 3 independent real shipments we haven't found yet" and more like **these may be duplicate MongoDB deal records of the same one or two real Holy-Fruit→Eagle-Trading shipments**, recorded under varying supplier names (sometimes Tru Market, sometimes Holy Fruit Peru) and varying destination labels (sometimes Dubai, sometimes Israel/Tel Aviv) for what might be a much smaller number of actual transactions.

**Not auto-corrected** — swapping the recorded supplier from Tru Market to Holy Fruit Peru would need the same kind of explicit project-owner sign-off already given for the one other precedent of this shape (the avocado Bio-Farming/Villaventura substitution, 2026-08-30 Lead 6), and there's no unclaimed DUA to assign even if that sign-off were given. Flagging this whole 5-deal group, plus the pre-existing 081399-1 double-claim it bumps into, for a human decision: is "Tru Market Blockchain S.A.C." actually correct here, or should some/all of these be reassigned to Holy Fruit Peru — and separately, are `68839b61`/`68839a11`/`690cfcb6`/`6915d77a`/`6915ee68` five genuinely distinct deals, or do some of them duplicate each other / the already-filled AWB-996 family?

## Pipeline run

```
npm run apply-platform-defaults   # 170/170 rows applied, 0 misses
npm run recalc-counterparties     # 49 counterparties scored (avg 58.1), 15 customs-matched
npm run export:deal-apy           # 169 deals written (1 skipped, pre-existing)
npx vitest run                    # 77/77 pass
```

Counterparty scores are unchanged by this pass (avg 58.1, same as before) — expected, since `buyerName`/`supplierName` were not touched and the sandbox scorer doesn't read `customsNarrative`.

## What's left

After this pass: **83 of the original 90** blank rows remain genuinely unresolved for the specific reasons tabulated above (real company/no company, wrong product or destination, explicit-exclusion anomaly, or zero product-chapter coverage) — all independently re-verified against each supplier's complete real shipment history this pass, not just their recorded lane. The Blue Pacific Oils near-miss is recorded above so a future pass doesn't re-discover and re-chase the same red herring. The buyer-side addendum re-confirms most of the same 83 from the other direction, surfaces no second new fill, but does flag one open question (the 5-deal Eagle Trading / Holy Fruit Peru group) worth a project-owner decision before the next pass. Everything else in the five prior docs' "what's left" lists still applies unchanged.
