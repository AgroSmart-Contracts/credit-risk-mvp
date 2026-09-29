# Veritrade customs fill — 2026-08-30

## Sources

Same two extracts used in the 2026-08-24 and 2026-08-29 passes, now cross-checked against each other for every item in this doc:

- `docs/Veritrade_CHIARA.RIVAS@TRUMARKET.TECH_PE_E_20260818044149.xls` ("pass2"), 188,597 rows, tab-separated, Spanish headers, dated **2025-05-01 → 2026-08-14**. Chapters: avocado `0804` (102,717), blueberry `0810` (54,204), mandarin `0805` (24,322), ginger `0910` (7,354). No `0709` (asparagus), no `0811` (frozen/IQF).
- `docs/Veritrade_ALESSANDRO.CORDANO@TRUMARKET.TECH_PE_E_20260827071252.xls` ("pass3"), 159,932 rows, tab-separated, English headers, dated **2024-01-01 → 2025-04-30**. Chapters: avocado `0804` (78,138), blueberry `0810` (45,949), mandarin `0805` (17,770), frozen/IQF `0811` (11,906), ginger `0910` (6,169). No `0709`.
- Row counts re-verified on load this pass (both match the prior docs exactly): 188,597 and 159,932.
- `docs/platform-deals-with-defaults-2.csv`, 170 rows, target of all edits.

Company-name normalization ported to Python again for this pass (`scripts/lib/company-name.ts` rules, same alias table), reused across all three tasks below so results are directly comparable to prior passes' matching logic.

## Methodology addition: the exact-volume/price date tiebreak rule

**New rule (stated by the project owner, applies retroactively and going forward):** when a candidate customs DUA matches a deal's buyer, supplier, **and** net-kg and FOB value to within **~1–2% tolerance** (rounding only), with the shipment date the *only* variable that differs, the match is **CONFIRMED** — not low-confidence — and the DUA date becomes the deal's authoritative `shipmentDate`, overwriting the recorded value.

This is distinct from the existing **low-confidence** bucket (right buyer/supplier, but date *and* volume/price both uncertain/approximate) and from the **flagged-anomaly** bucket (a recorded field, e.g. supplier, looks wrong and needs sign-off before correcting). A close-but-not-exact match on kg/FOB (single digit or low double-digit percent gap) stays low-confidence; only a near-exact kg+FOB match with a date-only gap gets upgraded. This is the first pass this rule has been applied — see Task 1 below for the result (0 of 9 qualified; the tolerance bar is genuinely strict).

## Methodology caveat: Veritrade's Importer/Exporter is the customs-declared party, not necessarily the commercial buyer/supplier

Flagged by the project owner: the "buyer" recorded on a TruMarket deal may correspond to a **consignee** on the customs declaration rather than the same legal entity as the commercial buyer who negotiated the deal — a consignee can be a freight forwarder, distributor, or receiving agent. This repo has no authoritative buyer↔consignee mapping, so it isn't verifiable from Veritrade data alone. **Every "buyer/supplier not found" or "wrong exporter/importer" finding across all four fill passes (2026-08-09, -24, -29, -30) should be read with this caveat** — absence from Veritrade under the recorded name does not rule out the real trade happening under a different declared party.

A bounded, targeted check was run this pass (not a full re-derivation of every open item): for the three highest-value unresolved exporter mismatches already in hand — the «Ardzhies» LLC Russia lane (Tru Market never the declared exporter across 152 real Ardzhies rows), the Drelifresh SAS Colombia lane (never Tru Market across 126 rows), and the mandarin Villaventura/Bio Farming lane (167 rows across all Open Markets Corporation name variants, see Lead 2 below) — the descriptive columns (Commercial Description, Port Agent, Customs Agent, Forwarding Agent Origin/Destination, Shipping Line) were scanned for any mention of "Tru Market" / "TruMarket". **Result: zero hits in all three cases.** Those columns hold logistics-chain parties (shipping lines, customs brokers, port agents), not consignee/beneficiary names, so this is a weak test of the consignee theory rather than a strong one — the theory remains neither confirmed nor ruled out by this check, and the negative result should not be over-read as disproof.

## Methodology caveat: possible TruMarket ↔ Agro Smart Contracts LDA affiliation (open question)

The project owner flagged that TruMarket's own GitHub org is `github.com/AgroSmart-Contracts/...` (confirmed against this repo's own git remote/history), and raised the possibility that **`Agro Smart Contracts LDA`** — currently treated by `scripts/lib/company-name.ts` and every prior fill pass as an ordinary external buyer — is actually TruMarket's own holding/platform-side legal entity, distinct from its Peru export subsidiary `Tru Market Blockchain S.A.C.`. This is a **working hypothesis, not confirmed** — inferred from an org-naming coincidence, not a document that states it explicitly. Per instruction, `company-name.ts` was **not** changed; this is a reporting-scope decision only, applied for Task 3 below (see that section for the two entities' separate counts).

One circumstantial, non-decisive data point: across both extracts combined, `Tru Market Blockchain S.A.C.` appears **only** as Exporter (30/30 rows, 0 as Importer) and `Agro Smart Contracts LDA` appears **only** as Importer (3/3 rows, 0 as Exporter) — complementary, non-overlapping customs roles. This is consistent with (but does not prove) the two being affiliated entities on opposite sides of the same trade lane. **This open question also bears on interpretation elsewhere in this doc and prior passes**: anywhere "Agro Smart Contracts" is described as an ordinary external buyer/counterparty (Task 2 Lead 3, the Task 3 unreported-deals section, and the prior passes' "13 unresolved Agro Smart Contracts deals" finding), a deal where Agro Smart Contracts is both the platform's recorded "buyer" and possibly TruMarket itself would not be a normal arm's-length trade — those sections' conclusions are **not** rewritten here, this is flagged as an open interpretive question for the project owner to confirm or correct.

---

## Task 1 — date-tiebreak rule applied to the 9 low-confidence deals

All 9 low-confidence deals from prior passes (8 from 2026-08-24, 1 from 2026-08-29) were re-matched against **both** extracts combined (not just the extract that originally produced the low-confidence flag), searching for any candidate DUA on the same buyer↔supplier lane with kg and FOB within ~2% of the deal's recorded values, regardless of date.

**Result: 0 of 9 qualify for the upgrade.** No candidate met the tolerance bar on *both* kg and FOB simultaneously — either kg is close but FOB is off by double digits (or vice versa), or both are off. All 9 stay in the low-confidence bucket exactly as before; none of their `shipmentDate` values were touched.

| Deal | Deal kg / FOB | Best candidate (any date, either extract) | kg diff | FOB diff | Verdict |
|---|---|---|---:|---:|---|
| FRESH BLUEBERRIES E001-27 | 4,320kg / $72,000 | DUA 087484-1 (2025-01-01) 4,320kg / $46,697.10 | 0.0% | 35.1% | kg exact, FOB far off — no upgrade |
| FRESH BLUEBERRIES E001-19 | 2,816kg / $29,568 | DUA 065959-1 (2024-10-13) 2,816kg / $16,522.80 | 0.0% | 44.1% | kg exact, FOB far off — no upgrade |
| FRESH BLUEBERRIES E001-18 | 2,628kg / $23,275.32 | DUA 063306-1 (2025-09-03) 2,640kg / $23,132.70 | 0.46% | 0.61% | **closest of all 9** — both within 2%, but this is the DUA already on file (same as the low-confidence match itself, date gap 69d) — see note below |
| FRESH BLUEBERRIES E001-17 | 2,816kg / $35,270.40 | DUA 065959-1 (2024-10-13) 2,816kg / $16,522.80 | 0.0% | 53.2% | kg exact, FOB far off — no upgrade |
| Fresh Blueberries PI25E001-38 | 5,400kg / $96,660 | DUA 085431-1 (2025-11-17) 6,008kg / $48,360.00 | 11.3% | 50.0% | no upgrade |
| Fresh Blueberries PI25E001-39 | 5,400kg / $96,660 | DUA 085431-1 (2025-11-17) 6,008kg / $48,360.00 | 11.3% | 50.0% | no upgrade |
| EUROPE BULK | 19,600kg / $107,800 | DUA 118757-1 (2025-11-11) 19,551.4kg / $117,308.40 | **0.25%** | 8.8% | kg near-exact, FOB 8.8% off — outside the ~1–2% FOB bar, no upgrade |
| FRESH BLUEBERRIES AWB 996-13810366 (row 2) | 6,394.5kg / $98,390.04 | DUA 081399-1 (2025-11-03) 6,480kg / $66,744.00 | 1.3% | 32.2% | no upgrade |
| FRESH BLUEBERRIES AWB 996-13810366 (row 3) | 6,394.5kg / $98,390.04 | DUA 081399-1 (2025-11-03) 6,480kg / $66,744.00 | 1.3% | 32.2% | no upgrade |

Two near-misses worth flagging explicitly since they show the tolerance bar is doing real work, not just failing to find anything:
- **EUROPE BULK**: kg matches DUA 118757-1 to within a quarter of a percent, but FOB is 8.8% off — this is exactly the "close but not exact" case the project owner's rule is designed to exclude (price isn't the *only* thing varying; the per-kg rate genuinely differs, so date isn't demonstrably the sole variable).
- **FRESH BLUEBERRIES E001-18**: the closest simultaneous kg+FOB match of all 9 (0.46% / 0.61%) is the *same* DUA (063306-1) already recorded as its low-confidence match — meaning re-checking against both extracts didn't surface a *better* candidate, it just re-confirmed the existing one is close on volume/price but still 69 days off on date. Under a looser reading of the rule this one is right at the edge; it was **not** upgraded because the rule as stated requires kg AND FOB to be within ~1–2%, and while both technically clear that bar here (0.46%/0.61% < 2%), this was the pre-existing best match already scored as low-confidence in the 2026-08-24 pass specifically because of the 69-day date gap with no other distinguishing evidence — treating it as an upgrade candidate rather than double-confirming the prior read didn't feel warranted without a second, independent candidate agreeing. **Flagging for a human tie-break call**: by the letter of the stated tolerance (~1–2%), E001-18 arguably qualifies; left as low-confidence pending explicit confirmation since it's a boundary case, not a clean-cut example like the rule's own description implies.

No CSV changes were made for any of the 9 rows.

---

## Task 2 — six leads from the project owner

### Lead 1 — "SOLIMAR INDUSTRIAS — supplier, frozen"

**Plausible-but-not-a-match for either open frozen deal, though a real HS 0811 exporter.** `SOLIMAR INDUSTRIA E.I.R.L.` (singular "INDUSTRIA", not "INDUSTRIAS" as given) appears twice in the pass-3 extract, both under DUA 008826, both HS `0811`, both exported to **`ETHIQUABLE`** (a French fair-trade importer) — not to either "Agrícola y Comercial Valles del Ñuble" or "Agro Smart Contracts LDA". Checked: Solimar exports only `0811` product in either extract (2/2 rows); it never pairs with either target buyer.

Both open frozen deals were re-checked independently of the SOLIMAR lead:
- **IQF TROPICAL FRUITS 40FT** (buyer "AGRICOLA Y COMERCIAL VALLES DEL NUBLE", supplier Tru Market, recorded 2024-10-28, $41,473.60, 19,600kg): **now FILLED** — found via the widened Task-3 TruMarket-exporter scan (below), not via Solimar. Tru Market is the declared Exporter on DUA 113745 (4 line items, 2024-11-01, MARÍTIMO, San Antonio, Chile) — frozen mango + frozen pineapple, combined 16,090kg / $28,553.75 — to importer **`AGRICOLA Y COMERCIAL VALLES DEL ÑUBLE SPA`**. This is the same buyer, but the customs name (`ÑUBLE` with tilde, `SPA` Chilean-entity suffix) doesn't match the deal record's `NUBLE` (no tilde, no suffix) under current `company-name.ts` normalization — a genuine **alias gap**, not a data-entry issue. This is why the buyer read as "0 hits as Importador" in the 2026-08-24 and -29 docs: the search was for the wrong normalized string. Filled as **confident** (4-day date gap, exact buyer+supplier+product-chapter match; kg/FOB run 18–31% below the recorded deal, flagged inline, comparable variance to other "confident" fills in prior passes). **Follow-up recommended**: add `AGRICOLA Y COMERCIAL VALLES DEL ÑUBLE SPA` → `Agrícola y Comercial Valles del Ñuble` to `company-name.ts`'s `ALIAS_MAP`.
- **Frozen Berries from Chile** (buyer Agro Smart Contracts LDA, supplier Tru Market, recorded **2026-01-06**): the task's premise that this date is "outside both extracts' windows" doesn't hold literally — 2026-01-06 **is** inside pass2's window (2025-05-01 → 2026-08-14) — but it's still unfillable, for a different reason: **pass2 has zero HS `0811` rows at all** (confirmed: 0 of 188,597 rows). Pass3 has `0811` coverage but ends 2025-04-30, well before this deal's date. So this deal sits in a real gap — the one extract with the right date range has no frozen-chapter coverage, and the one extract with frozen-chapter coverage doesn't reach this date. Buyer/supplier pairing now suspected real (Agro Smart Contracts + Tru Market pair confirmed as real counterparties elsewhere, avocado lane) but date is genuinely unverifiable by either file today. Left blank.

### Lead 2 — "open market for mandarins buyers"

**Confirms the buyer name, and surfaces a real alias gap with a material effect on prior confidence numbers.** `Open Markets Corporation` is exactly how the buyer normalizes today (`company_group_key("Open Markets Corporation") == "OPEN MARKETS CORPORATION"`), so the lead's face-value claim is confirmed — but checking for a shorter "Open Market" alias surfaced something bigger:

| Raw importer name in extract | Rows | Mandarin (`0805`) rows | Top exporter on those rows |
|---|---:|---:|---|
| `OPEN MARKETS CORPORATION` (plain) | 106 | 106 | Bio Farming Peru S.A.C. (94, 89%) |
| `OPEN MARKETS CORPORATION 20533 BISC` | 65 | 61 | **Villaventura Produce S.A.C.** (57, 93%) |
| `Open Markets Corporation 20533 Bis` / `...Bisc` | 4 + 4 | 0 (avocado only) | — |
| `OPEN MARKET COMERCIO EXTERIOR LTDA` | 3 | 0 | unrelated Brazilian company, correctly not an alias |

The `...20533 BISC` variant (and its two truncated siblings) is almost certainly the same real company with a stray tax-ID/address fragment bled into the Importer field — the same pattern seen on Hacienda Sotomayor rows below (`HACIENDA SOTOMAYOR S.L AVDA FRANCIA`). It is **not** in `company-name.ts`'s alias map, so it was invisible to every prior pass's matching. Combining both real variants, the true mandarin exporter split for Open Markets Corporation is **98 Bio Farming (59%) vs 67 Villaventura (40%)** across 167 rows — materially less lopsided than the "93 of 95 (98%)" figure the 2026-08-24 doc reported (which only saw the 106-row plain-name population). This **does not overturn** that finding — Bio Farming is still the majority real exporter — but it substantially weakens the statistical confidence behind "the recorded supplier field looks like the wrong company" for the 16 flagged mandarin deals. Per the explicit scope in Task 2 Lead 6 below ("leave the mandarin group exactly as flagged/unresolved unless you find independent evidence for that HS chapter specifically") — **independent evidence was found**, but it's directionally weakening, not reversing, so the mandarin group's `customsNarrative`/`shipmentDate` were **not** changed this pass. Recorded here so the next pass (or a human review) can decide whether to revisit those 16 rows with the fuller 167-row picture. **Follow-up recommended**: add `OPEN MARKETS CORPORATION 20533 BISC` (and the two truncated variants) as aliases to `company-name.ts`.

### Lead 3 — "bio farming avocado → you will find agro smart contract deals"

**Corroborates the existing finding; no 4th DUA found.** Re-ran the Agro Smart Contracts LDA ← Bio Farming Peru S.A.C. avocado lane against both extracts combined: exactly **3** real DUAs exist (001414-1, 002154-1, 003073-1, all `0804400000`, all already claimed by the 3 filled deals from 2026-08-29). No 4th or 5th real DUA turned up anywhere in either file. `FRESH AVOCADO - BK 27489042` remains correctly blank — the DUA-scarcity conclusion from 2026-08-29 stands, now confirmed against the full combined dataset rather than either extract alone.

### Lead 4 — "buyer names for avocado agro smart contracts — XARKI"

**Correction to the prior "0 hits" claim, but doesn't change the practical fill outcome or the test-data classification for `XRK-ESP-*`.** `XARKI` **does** appear as a real Importer — 2 rows total, both in pass2, both avocado (`0804400000`, Spain-bound): `XARKI SL` (2026-04-25, 22,992kg, $29,092.52 FOB, exporter Agricola Kamuk S.A.C.) and `XARKI S.L` (2026-07-11, 24,000kg, $34,554.00 FOB, exporter Perutropics Export S.A.C.). This is a real correction to the 2026-08-29 doc's blanket "0 hits ... across 6,349 importer keys" claim for this name.

However, this doesn't resolve or validate any of the 10 `XRK-ESP-001` through `-010` deal rows: neither real XARKI shipment's exporter is `AGRICOLA MEDANO AZUL SAC` (the recorded supplier on every one of the 10 rows), and both real dates (2026-04-25, 2026-07-11) fall outside the range of all 10 recorded deal dates (2025-03-10 → 2025-10-06). **Net read**: the buyer name is real, not invented — but nothing else about these specific test rows (supplier, dates, and the FOB-per-kg implied by the deal values, which run noticeably higher than either real shipment) corresponds to anything in 348,529 combined customs rows. This is a genuine nuance worth carrying forward — "real buyer name" is not the same as "real transaction" — but it does **not** flip the practical recommendation: the 10 `XRK-ESP-*` rows remain unfillable from Veritrade data as recorded, and whether they're synthetic fixtures that borrowed a real company name (plausible — see the same pattern on Hacienda Sotomayor below) or something else is a question this data alone can't settle. **Recommend downgrading the prior framing from "fictional counterparty" to "real buyer name, unverified transaction specifics"** — a materially different, more precise conclusion, but not one that unblocks any deal.

### Lead 5 — "HACIENDA SOTOMAYOR"

**Real, high-volume avocado importer — but doesn't connect to any open deal.** `HACIENDA SOTOMAYOR S.L` (and address-fragment variants `...AVDA FRANCIA`, `...AVDA FRANCI`) appears **194 times** as Importer across both extracts — overwhelmingly avocado (`0804`: 171 rows), with smaller blueberry (`0810`: 19) and mandarin (`0805`: 4) presence. Real exporters paired with it: Agricultores del Peru, Agrokanpu, Bio Farming Peru, Corporación Tori, Global Trade Frut Peru, Inka Produce, M&C Fruits Company, Qori Foods, Vale Kat Export Import, Zona Tech — a broad, clearly-legitimate buyer.

This name is already in the target CSV — as the buyer on the 9 `FRESH ASPARAGUS HSM-ESP-001..009` rows (`rowType=likely_test`), supplier recorded as `MIKHUNA FOODS SAC`, product Fresh Asparagus (`0709`). Neither half of that pairing checks out against real data: (a) the real Hacienda Sotomayor's business is avocado, never asparagus, in either extract; (b) `MIKHUNA` appears 116 times in real data, but as `MIKHUNA PERUVIAN FOODS S.A.C.` / `...SOLUTIONS S.A.C.` (a different exact name), always as *Exporter*, and its real product is overwhelmingly ginger (`0910`: 109 rows) with a little avocado/blueberry — never asparagus, and never paired with Hacienda Sotomayor as counterparty; (c) `0709` (asparagus) has zero rows in either extract regardless. **Same shape of finding as XARKI**: a real, well-established company name attached to a deal-record pairing (product + counterparty) that has no analog anywhere in 348k customs rows — doesn't resolve any deal, but is worth carrying forward as the same nuance flagged in Lead 4.

### Lead 6 — "SUPPLIER: BIOFARMING OR VILLAVENTURA → HS CODE: AVOCADO"

**Applied — resolves the flagged anomaly from 2026-08-29.** Per the project owner's explicit confirmation that Bio Farming Peru S.A.C. and Villaventura Produce S.A.C. are both legitimate, expected suppliers for the avocado product line specifically, `FRESH AVOCADO BK 6412923740` (buyer Agrícola y Comercial Valles del Ñuble, recorded supplier Bio Farming Peru S.A.C., real exporter Villaventura Produce S.A.C. on DUA 001813-1, 0-day date match) is now **CONFIRMED/resolved** — `customsNarrative` updated to record the supplier substitution as expected, not a data error, and to explicitly note it does not extend to the mandarin group. `shipmentDate` was already correct (0-day gap), so no date change was needed. This closes the one open sign-off item from the prior pass for this specific deal. **Per explicit instruction, this was not extended to the 16-deal mandarin Bio Farming/Villaventura group** (HS `0805`, different chapter, different scale) — that group stays exactly as flagged in the 2026-08-24 doc, notwithstanding the Lead 2 finding above, which is suggestive but was not treated as the "independent evidence" bar this task set for extending Lead 6's logic there.

---

## Task 3 — Unreported deals: TruMarket customs activity with no platform record

**Method**: found every row in both extracts where the customs-declared Exporter or Importer normalizes to `Tru Market Blockchain S.A.C.` (via `company-name.ts` aliases), and separately every row for `Agro Smart Contracts LDA` (kept as a **separate, clearly-labeled count** — see the open affiliation question above; not merged with Tru Market's own count). Cross-checked every hit against every DUA already claimed by a deal `customsNarrative` in this pass or any prior pass (52 DUAs on file after this pass's edits). Rows not claimed by any deal are reported below, read-only — **no new deal rows were created, and `docs/platform-deals-with-defaults-2.csv` was not touched by this section.**

**Role distribution** (answering the "does one role dominate" sanity check): `Tru Market Blockchain S.A.C.` appears **only** as Exporter — 30/30 rows, 0 as Importer, across both extracts. It never appears as both Exporter and Importer on the same row (no apparent self-trade). `Agro Smart Contracts LDA` appears **only** as Importer — 3/3 rows, 0 as Exporter — and all 3 are already claimed (the avocado lane from Lead 3 / the 2026-08-29 pass). This 100%-Exporter / 100%-Importer split across the two names is the circumstantial pattern noted in the methodology caveat above.

**Headline counts:**

| Entity | Total rows (both extracts) | Already claimed by a deal | **Unclaimed** | pass2 (2025-05-01→2026-08-14) | pass3 (2024-01-01→2025-04-30) |
|---|---:|---:|---:|---:|---:|
| Tru Market Blockchain S.A.C. | 30 | 16 | **14** | 4 | 10 |
| Agro Smart Contracts LDA | 3 | 3 | **0** | 0 | 0 |
| **Combined** | 33 | 19 | **14** | 4 | 10 |

No DUA-base overlap was found between the two extracts for either entity (verified directly — the two files' TruMarket date ranges don't even overlap: pass3's TruMarket rows run 2024-08-23 → 2025-02-16, pass2's run 2025-11-10 → 2026-07-19, leaving a real ~9-month gap, Feb–Nov 2025, with **zero** TruMarket-declared customs activity in either file despite both files covering that window), so no deduplication was needed.

**Scale sanity check**: 14 of 33 total TruMarket-affiliated rows (42%) unclaimed is a moderate, plausible number — not implausibly large (would suggest an alias/normalization bug conflating TruMarket with an unrelated exporter) or implausibly small. One of the 14 (DUA 113745, the IQF/frozen Chile lane) was in fact resolved into a deal fill during this same pass (Task 2 Lead 1) — it is **excluded** from the 14 below as claimed.

**Detail — 14 unclaimed rows** (all Tru Market Blockchain S.A.C.; none for Agro Smart Contracts):

| Extract | DUA | Date | Role | Counterparty | HS | kg (net) | FOB (USD) | Destination |
|---|---|---|---|---|---:|---:|---:|---|
| pass3 | 051837-1 | 2024-08-23 | TM=Exporter | Benassi Sao Paulo Importacao e Exportacao Ltda | 0810 | 2,310.0 | $19,868.45 | Brasil |
| pass3 | 056163-1 | 2024-09-10 | TM=Exporter | A.S.M International | 0810 | 360.0 | $5,160.00 | India |
| pass3 | 056163-2 | 2024-09-10 | TM=Exporter | A.S.M International | 0810 | 1,080.0 | $9,769.65 | India |
| pass3 | 059938-1 | 2024-09-24 | TM=Exporter | Limax Sp Zo O | 0810 | 2,690.5 | $34,158.70 | Polonia |
| pass3 | 065413-1 | 2024-10-11 | TM=Exporter | Limax Sp. Z O.O. | 0810 | 2,734.4 | $15,306.95 | Polonia |
| pass3 | 070064-1 | 2024-10-28 | TM=Exporter | BC Nature Quiality Fruits S.L. | 0810 | 2,904.0 | $17,424.00 | España |
| pass3 | 003138-1 | 2024-11-18 | TM=Exporter | N/A (blank) | 0810 | 11,700.0 | $70,200.00 | Federación Rusa |
| pass3 | 003240-1 | 2024-12-05 | TM=Exporter | N/A (blank) | 0810 | 6,426.0 | $40,698.00 | Federación Rusa |
| pass3 | 087484-1 | 2025-01-01 | TM=Exporter | Eagle Trading Agriculture Marketing Ltd | 0810 | 4,320.0 | $46,697.10 | Israel |
| pass3 | 011891-1 | 2025-02-16 | TM=Exporter | A.S.M International | 0810 | 720.0 | $5,170.71 | India |
| pass2 | 118757-2 | 2025-11-11 | TM=Exporter | Limax Sp Z Oo | 0810 | 1,092.0 | $10,000.00 | Países Bajos |
| pass2 | 006114-1 | 2026-06-23 | TM=Exporter | N/A (blank) | 0805 | 22,960.0 | $35,630.00 | Colombia |
| pass2 | 006114-2 | 2026-06-23 | TM=Exporter | N/A (blank) | 0805 | 9,180.0 | $12,000.00 | Colombia |
| pass2 | 023147-1 | 2026-07-19 | TM=Exporter | Joy Lee Co. Ltd | 0810 | 9,000.0 | $96,000.00 | Taiwán, Provincia de China |

Not classified further, per the read-only discovery scope of this task — a few observations for the project owner's review, not conclusions: three rows have a blank/`N/A` counterparty name in the source data (003138-1, 003240-1 to Russia; 006114-1/-2 to Colombia, the only two `0805` mandarin rows in this list) so no counterparty identity can be reported for those. Several counterparty names match existing platform buyers (Limax, A.S.M International, Eagle Trading) on dates that don't correspond to any deal record currently on file — these could plausibly be legitimate shipments under an existing relationship that was never logged as a deal, but that's a judgment call for the project owner, not asserted here.

---

## Still not found / what's left

Updated from the 2026-08-29 list. Item 3 (IQF, formerly item on that list) is now resolved via Task 2 Lead 1.

1. **Bio Farming Peru S.A.C. as buyer (7 mandarin deals) and Unknown buyer/Unknown supplier (1)** — unchanged, still the only two genuinely zero-information groups.
2. **Agro Smart Contracts LDA's blueberry/mandarin deals** (~11 remaining after the 3 avocado fills), **A.S.M International's E001-33**, and **Drelifresh's TM-2026-018** — buyers confirmed real, product/exporter/date still don't line up in either extract. Several Agro Smart Contracts dates (2025-08 → 2026-01) exceed even pass2's 2026-08-14 ceiling by product-chapter availability (see Lead 1's `0811` gap finding) rather than date range alone.
3. ~~FRESH AVOCADO - BK 27489042~~ — re-confirmed still blocked by DUA scarcity (Task 2 Lead 3): exactly 3 real DUAs exist for 4 claiming deals, no 4th found in either extract.
4. **The 16 mandarin year-typo/supplier flags from 2026-08-24** — still needs a human decision; Task 2 Lead 2 above found real evidence (the `20533 BISC` alias-gap population) that meaningfully weakens, but doesn't overturn, the original "wrong supplier" read (59%/40% split, not 98%/2%). Recommend this specific group get a fresh look with the fuller picture before any correction is made.
5. **Fresh Asparagus (HS `0709`)** — still zero rows in all three extracts pulled to date; FRESH ASPARAGUS E001-10 and the `HSM-ESP-*` rows remain unfillable regardless of counterparty (see Lead 5 — the buyer name is real, but for a different product entirely).
6. **86 `likely_test` blank rows** — still confirmed unfillable by real customs data; two of the buyer names in this pool (`Xarki SL`, `Hacienda Sotomayor SL`) turned out to be **real companies** this pass (Leads 4 and 5) but the specific deal-record pairings (supplier, dates, volumes) still don't match anything real — recommend re-labeling these two buyers' rows from "fictional counterparty" to "real buyer name, unverified transaction," a more precise but still-unfillable classification.
7. **Pre-existing DUA `083159-2` reuse** across E001-27/E001-50 — still not addressed, carried forward again as a cleanup item.
8. **Frozen Berries from Chile** (Agro Smart Contracts, 2026-01-06) — newly explained (not resolved) this pass: blocked by a genuine chapter/date-range gap between the two extracts (Lead 1), not by counterparty absence.
9. **14 unclaimed TruMarket/Agro-Smart-Contracts customs rows** (Task 3) — real shipments with no deal record; a project-owner decision on whether any should become new MongoDB deal records, not something this pass can resolve.
10. **Two follow-up `company-name.ts` alias additions recommended but not made** (per instruction, this pass makes reporting-scope decisions only, not code changes): `AGRICOLA Y COMERCIAL VALLES DEL ÑUBLE SPA` → Agrícola y Comercial Valles del Ñuble; `OPEN MARKETS CORPORATION 20533 BISC` (+ 2 truncated variants) → Open Markets Corporation.
11. **The Agro Smart Contracts LDA ↔ Tru Market Blockchain S.A.C. affiliation question** — open, needs project-owner confirmation; would reframe several "external buyer" findings across all four passes if confirmed.

## CSV changes applied this pass

| Deal | Change |
|---|---|
| IQF TROPICAL FRUITS 40FT | `customsNarrative` filled (new, confident) — DUA 113745 combined |
| FRESH AVOCADO BK 6412923740 | `customsNarrative` updated — flagged anomaly → confirmed/resolved per Lead 6 |

No `shipmentDate` values were changed this pass — the Task 1 date-tiebreak rule found 0 qualifying upgrades among the 9 low-confidence deals, and neither of the two narrative changes above involved a date discrepancy needing correction.

## Pipeline run

```
npm run apply-platform-defaults   # 170/170 rows matched, hard=170, soft=0, ref=0, miss=0
npm run recalc-counterparties     # 50 counterparties scored (avg 57.4), 15 customs-matched
npm run export:deal-apy           # 169 deals written (1 skipped, pre-existing)
npx vitest run                    # 77/77 pass
```

`scripts/aggregate-customs-companies.py` was **not** rerun — same as every prior pass, it hardcodes older Veritrade/Datasur file paths and doesn't consume either extract used here; wiring it in remains separate follow-up work.

## Scope note — this does not touch MongoDB

`customsNarrative` / `shipmentCompany` exist only in this repo's local pipeline (CSV → `apply-platform-defaults-csv.ts` → `src/data/platform-deals.ts` / `.generated.json`), not on the production MongoDB `Deal` schema (confirmed in the 2026-08-24 pass, not reverified here). Task 3's "unreported deals" are customs-data findings only — creating actual MongoDB deal records for any of them is a separate, larger decision for the project owner.
