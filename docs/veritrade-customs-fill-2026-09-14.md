# Never found in customs — 2026-09-14 (Chile extract 2026-09-21)

Peru extracts: pass2 188,597 rows (2025-05-01 → 2026-08-14) + pass3 159,932 rows (2024-01-01 → 2025-04-30) = **348,529** rows.

Chile extract: `docs/Veritrade_CHIARA.RIVAS@TRUMARKET.TECH_CL_E_2026092114510.csv` — **40,022** rows (2024-01-02 → 2026-07-31). Frozen HS `0811` only (52 named exporters + anonymized `X`). Qty in this file is 10× the true kg; true kg = `U$ FOB Tot / U$ FOB Und`.

Match rule: supplier as exporter → route → volume/product. Buyer-only hits do not fill. Unclaimed DUAs only. Name/product corrections that *did* match a DUA are written into `docs/platform-deals-with-defaults-2.csv` only — not listed here. Confirmed DUA share file: `docs/confirmed-customs-deals-share-2026-09-22.csv`.

**73 unique deals** still blank (70 Peru CSV rows + 8 Chile-origin). Overlay geography typos fixed 2026-09-22 (`Callao, Chile` → Peru; `Malaga, China` → Spain; `Vancouver, Netherlands` → Canada).

---

## Chile origin — never this exporter / lane (8)

Chile origin was held out of the 2026-09-14 Peru pass. Checked against the 2026-09-21 Chile export extract. **No DUA attached.**

### `JUHINEJ LTD` — `SGC-CHN-001`…`-007` (7)

San Antonio, Chile → Shanghai, mixed berries IQF `0811`, 24,000 kg, sea. Buyer Shanghai Green Chain: **0 hits**. Exporter name `JUHINEJ LTD` / RUT: **0 rows** (52 named exporters do not include it).

`JUHINEJ` appears only as a **brand** (`JUHINEJ-F`) on anonymized exporter `X` (RUT `0`) — 125 rows, mostly USA, embarque Coronel / Valparaíso / Lirquén, **never San Antonio**. China: 8 rows, single fruit (mora / frambuesa / frutilla / arándano), not mixed berries. FOB on the 24,000 kg Shanghai blackberry rows is **$70,800** vs deals **~$118–120k**.

Closest China/Shanghai `JUHINEJ-F` rows (not filled — exporter is `X`, wrong port, wrong product, FOB short):

| Fecha | Emb | Dest | kg | FOB USD | HS | Reg |
|---|---|---|---:|---:|---|---|
| 2025-02-27 | Coronel | Shanghai | 25,000 | 70,800 | `8112011` mora | 12573829 |
| 2025-03-03 | Coronel | Shanghai | 24,000 | 70,800 | `8112011` mora | 12573821 |
| 2025-03-11 | Coronel | Shanghai | 21,600 | 97,200 | `8112021` frambuesa | 12601204 |
| 2025-03-20 | Lirquén | Shanghai | 24,000 | 70,800 | `8112011` mora | 12628456 |
| 2025-03-20 | Lirquén | China (other) | 24,000 | 70,800 | `8112011` mora | 12628455 |
| 2025-04-09 | Coronel | Shanghai | 21,600 | 101,520 | `8112021` frambuesa | 12662893 |
| 2025-12-11 | Coronel | Shanghai | 24,000 | 86,400 | `8111010` frutilla | 13125416 |
| 2026-01-05 | Coronel | Shanghai | 24,000 | 67,200 | `8119019` arándano | 13175139 |

No January 2025 `JUHINEJ` China row for `-001`/`-002`. No October 2025 China row for `-007`.

| dealRef | Buyer | Origin → dest | kg | USD | Date |
|---|---|---|---:|---:|---|
| SGC-CHN-001 | Shanghai Green Chain | San Antonio → Shanghai | 24,000 | 118,368 | 2025-01-10 |
| SGC-CHN-002 | Shanghai Green Chain | San Antonio → Shanghai | 24,000 | 120,408 | 2025-01-20 |
| SGC-CHN-003 | Shanghai Green Chain | San Antonio → Shanghai | 24,000 | 119,736 | 2025-02-09 |
| SGC-CHN-004 | Shanghai Green Chain | San Antonio → Shanghai | 24,000 | 118,128 | 2025-02-18 |
| SGC-CHN-005 | Shanghai Green Chain | San Antonio → Shanghai | 24,000 | 118,128 | 2025-03-10 |
| SGC-CHN-006 | Shanghai Green Chain | San Antonio → Shanghai | 24,000 | 118,392 | 2025-04-15 |
| SGC-CHN-007 | Shanghai Green Chain | San Antonio → Shanghai | 24,000 | 118,896 | 2025-10-24 |

### `NATURAL SOUTH FRUIT LTD` — `KHI-HKG-004` (1)

San Antonio, Chile → Hong Kong, mixed berries IQF `0811`, 24,000 kg, sea, 2025-10-28. Buyer KHI International: **0 hits**. Exporter `NATURAL SOUTH` / `SOUTH FRUIT`: **0 rows**. Not `NATURANDINA CHILE S.A.`. Hong Kong in this extract: **1 row** — Vita Foods 2025-07-17, 21,763 kg, FOB $71,340 — wrong exporter and date.

`KHI-HKG-001`…`-003` were recorded `Callao, Chile`; Callao is Peru — see Peru leftover below.

| dealRef | Buyer | Origin → dest | kg | USD | Date |
|---|---|---|---:|---:|---|
| KHI-HKG-004 | KHI International | San Antonio, Chile → Hong Kong | 24,000 | 75,720 | 2025-10-28 |

---

## Supplier never in Peru extracts (3)

### `NATURAL SOUTH FRUIT LTD` — `KHI-HKG-001`…`-003` (3)

Origin was `Callao, Chile` (impossible). Overlay now **Callao, Peru** → Hong Kong, mixed berries IQF `0811`, 24,000 kg, sea. `NATURAL SOUTH` / `SOUTH FRUIT` as Peru exporter: **0 rows** in pass2+pass3. Chile extract does not apply (Callao is not a Chilean port).

| dealRef | Buyer | Origin → dest | kg | USD | Date |
|---|---|---|---:|---:|---|
| KHI-HKG-001 | KHI International | Callao, Peru → Hong Kong | 24,000 | 75,888 | 2025-01-15 |
| KHI-HKG-002 | KHI International | Callao, Peru → Hong Kong | 24,000 | 73,296 | 2025-02-14 |
| KHI-HKG-003 | KHI International | Callao, Peru → Hong Kong | 24,000 | 73,176 | 2025-03-15 |

---

## Real exporter, never this lane (47)

### `AGRICOLA LOS MEDANOS S.A.` — `XRK-ESP-001`…`-010` (10)

Ops: recorded Agricola Medano = this exporter (RUC `20389426891`). Overlay supplier name updated. **These 10 asparagus → Xarki Spain deals still have no DUA.** HS `0709` is empty in both Peru extracts. Los Medanos’ 936 rows are passion fruit `0810` / IQF `0811` (almost all USA). Spain: 5 rows, not Xarki (Xarki’s 2 customs rows are other exporters, avocado, 2026).

All: Xarki SL, Callao → Málaga, asparagus, sea.

| dealRef | kg | USD | Date |
|---|---:|---:|---|
| XRK-ESP-001 | 24,000 | 53,568 | 2025-03-10 |
| XRK-ESP-002 | 24,000 | 50,016 | 2025-04-05 |
| XRK-ESP-003 | 24,000 | 53,112 | 2025-04-06 |
| XRK-ESP-010 | 24,000 | 50,640 | 2025-06-15 |
| XRK-ESP-004 | 24,000 | 53,304 | 2025-07-07 |
| XRK-ESP-005 | 24,000 | 50,664 | 2025-07-21 |
| XRK-ESP-006 | 24,000 | 52,848 | 2025-08-04 |
| XRK-ESP-007 | 24,000 | 51,720 | 2025-08-18 |
| XRK-ESP-008 | 22,160 | 51,411 | 2025-10-06 |
| XRK-ESP-009 | 22,160 | 51,134 | 2025-10-20 |

### `BERRYCO S.A.C.` — `GFL-CHN-001`…`-004` (4)

RUC `20606396628`. 74 rows, mostly blueberry `0810` to NL/UK/USA. **Zero China.** Guangzhou Fresh Link is not a partner. Not `BERRYCORP S.A.C.` Dest on `-001`/`-002`/`-004` was recorded `Malaga, China`; Málaga is Spain (overlay corrected). Port was always MALAGA. BerryCo still has no China lane; Spain blueberries were not a Guangzhou Fresh Link match in the Peru extracts.

| dealRef | Buyer | Origin → dest | kg | USD | Date |
|---|---|---|---:|---:|---|
| GFL-CHN-001 | Guangzhou Fresh Link | Callao → Málaga, Spain | 11,700 | 78,936 | 2025-09-05 |
| GFL-CHN-002 | Guangzhou Fresh Link | Callao → Málaga, Spain | 11,700 | 80,106 | 2025-09-18 |
| GFL-CHN-003 | Guangzhou Fresh Link | Callao → Shanghai, China | 27,300 | 80,496 | 2025-10-15 |
| GFL-CHN-004 | Guangzhou Fresh Link | Callao → Málaga, Spain | 11,700 | 78,078 | 2026-01-17 |

### `BLUE PACIFIC OILS INTERNATIONAL I S.A.C.` — 7 deals, company found, **these shipments not in customs**

The supplier name is real. The problem is the **lane**, not the name.

What the 7 platform deals say:
- 6× Biofreshi BV, Rotterdam (NL), ~19,595 kg ginger, Apr–Oct 2025
- 1× Alboran Comex SL, Algeciras (Spain), 22,500 kg ginger, 2025-12-12

What Veritrade actually shows for this company family:
- RUC `20507873627` = `BLUE PACIFIC OILS S.A.C.` — 243 rows of HS `0910`, almost all **USA**. One NL shipment, importer **Eosta BV** (not Biofreshi).
- `BLUE PACIFIC OILS INTERNATIONAL I S.A.C.` RUC `20613692305` — 116 rows of HS `0910`, some NL, importers **Sawari / Roveg** (not Biofreshi). **Zero Spain.**

So: Oils exports ginger/spices in these extracts, but **not to Biofreshi and not to Spain**. There is no DUA to attach to these 7 deals.

| dealRef | Buyer | Dest | kg | USD | Date |
|---|---|---|---:|---:|---|
| BFRSH-NL-001 | Biofreshi BV | Rotterdam | 19,595 | 55,526 | 2025-04-20 |
| BFRSH-NL-004 | Biofreshi BV | Rotterdam | 19,595 | 54,475 | 2025-06-15 |
| BFRSH-NL-005 | Biofreshi BV | Rotterdam | 19,595 | 55,368 | 2025-07-15 |
| BFRSH-NL-006 | Biofreshi BV | Rotterdam | 19,595 | 53,784 | 2025-08-15 |
| BFRSH-NL-002 | Biofreshi BV | Rotterdam | 19,595 | 56,621 | 2025-08-20 |
| BFRSH-NL-003 | Biofreshi BV | Rotterdam | 19,595 | 56,534 | 2025-10-16 |
| BPOLS-ESP-001 | Alboran Comex SL | Algeciras, Spain | 22,500 | 11,997 | 2025-12-12 |

### `SOLIMAR INDUSTRIA E.I.R.L.` — `SOLIMAR-JHN-001` (1)

RUC `20526450851`. **Peru → Chile** (not Chile origin). Peru extracts: only DUA `008826`, 2025-02-20, 5,251 kg, Netherlands / Ethiquable. **Zero Chile.** Chile export extract cannot fill a Peru export.

| dealRef | Buyer | Origin → dest | kg | USD | Date | HS |
|---|---|---|---:|---:|---|---|
| SOLIMAR-JHN-001 | Juhinej Ltd | Callao → San Antonio, Chile | 24,000 | 55,992 | 2026-01-15 | `0811` IQF |

### `AGRICOLA VIÑASOL SAC` — `ATG-TWN-001`…`-012` (12)

53 real rows. Blueberry rows are USA Jan 2024. **Zero Taiwan.** Buyer Allied Trade Global, Callao → Kaohsiung, blueberries `0810`, 11,700 kg, sea.

| dealRef | USD | Date |
|---|---:|---|
| ATG-TWN-001 | 55,302 | 2025-09-06 |
| ATG-TWN-002 | 53,820 | 2025-09-14 |
| ATG-TWN-003 | 55,926 | 2025-09-20 |
| ATG-TWN-004 | 55,692 | 2025-09-27 |
| ATG-TWN-006 | 55,224 | 2025-10-20 |
| ATG-TWN-005 | 55,848 | 2025-11-03 |
| ATG-TWN-009 | 54,834 | 2025-12-06 |
| ATG-TWN-010 | 55,380 | 2025-12-12 |
| ATG-TWN-011 | 54,132 | 2025-12-18 |
| ATG-TWN-012 | 56,316 | 2025-12-24 |
| ATG-TWN-007 | 54,756 | 2026-01-09 |
| ATG-TWN-008 | 53,898 | 2026-01-25 |

### `Villaventura Peru SAC` — `VLV-TWN-001`…`-006` (6)

256 real rows. **Zero blueberry `0810`.** Mix is mandarin + avocado. Callao → Kaohsiung, blueberries `0810`, 11,700 kg, sea, buyer Allied Trade Global.

| dealRef | USD | Date |
|---|---:|---|
| VLV-TWN-001 | 54,522 | 2025-09-12 |
| VLV-TWN-002 | 53,352 | 2025-10-10 |
| VLV-TWN-005 | 56,394 | 2025-12-10 |
| VLV-TWN-006 | 55,536 | 2025-12-20 |
| VLV-TWN-003 | 55,224 | 2026-01-06 |
| VLV-TWN-004 | 54,210 | 2026-01-28 |

### `FUNDO LAS LOMAS SAC` — `FXP-UAE-001`…`-007` (7)

123 real rows. **Zero UAE.** Blueberry dests: UK / USA / NL / Spain. Callao → Dubai, blueberries `0810`, air.

| dealRef | kg | USD | Date |
|---|---:|---:|---|
| FXP-UAE-001 | 6,480 | 93,571 | 2025-09-10 |
| FXP-UAE-002 | 5,760 | 96,000 | 2025-09-24 |
| FXP-UAE-003 | 5,400 | 93,420 | 2025-10-08 |
| FXP-UAE-004 | 5,400 | 95,760 | 2025-10-22 |
| FXP-UAE-007 | 6,480 | 95,213 | 2025-12-20 |
| FXP-UAE-006 | 5,760 | 96,653 | 2025-12-10 |
| FXP-UAE-005 | 5,760 | 96,038 | 2026-01-21 |

---

## Lane exists; no free DUA (8 CSV rows / 4 unique)

| dealRef | Supplier | Buyer | Dest | kg | Date | Why blank |
|---|---|---|---|---:|---|---|
| `FRESH ASPARAGUS E001-10` ×2 | Tru Market | Anterra Farms GmbH | Frankfurt | 185 | 2025-01-20 | HS `0709` has 0 rows |
| `FRESH AVOCADO - BK 27489042` | Bio Farming Peru | Agro Smart Contracts LDA | Málaga | 24,000 | 2025-04-08 | 3 Spain avocado DUAs, 4 claiming deals |
| `Fresh Blueberries PI25E001-40` ×2 | Tru Market | Eagle Trading | Tel Aviv | 5,400 | 2025-03-10 / 03/11/2025 | Israel blueberry DUAs already used |
| `FRESH BLUEBERRIES E001-49` ×3 | Tru Market | Eagle Trading | Dubai | 6,480 | 2025-11-03 | Tru Market UAE blueberry: 0 rows |

---

## Mikhuna Spain ginger — no DUA on this buyer/dates (5)

`MIKHUNA PERUVIAN FOODS SOLUTIONS S.A.C` (RUC `20611718579`) has 99 HS `0910` rows, including 46 to Spain (Frutas Alhambra / Axarfruit / Hermanos Fernández). **Never Hacienda Sotomayor.** Ginger chapter is in both Peru extracts (13,523 `0910` rows). These 5 stay blank.

| dealRef | kg | USD | Date |
|---|---:|---:|---|
| HSM-ESP-003 | 20,000 | 51,120 | 2025-04-07 |
| HSM-ESP-009 | 20,000 | 49,480 | 2025-06-15 |
| HSM-ESP-004 | 20,000 | 49,380 | 2025-07-14 |
| HSM-ESP-005 | 20,000 | 48,420 | 2025-07-28 |
| HSM-ESP-006 | 20,000 | 48,380 | 2025-08-11 |

All: Hacienda Sotomayor SL, Callao → Málaga, ginger `0910`, sea.

---

## Tru Market extra dest / extra volume (6)

| dealRef | Dest | kg | Date | Why blank |
|---|---|---:|---|---|
| Fresh Blueberries (2nd Brazil) | Guarulhos | 2,310 | 2024-10-15 | Only one Brazil DUA; used by the 2024-08-23 twin |
| Blueberries Export Canada / EXW Canada E001-42 | Vancouver | 1,176 | 2025-08-08 | Zero Canada dest on Tru Market exporter rows |
| Frozen Berries from Chile | Vancouver, Canada | 1,175.71 | 2026-01-06 | Origin was `Callao, Chile` / dest `Vancouver, Netherlands`; now Callao, Peru → Vancouver, Canada. Still zero Canada on Tru Market exporter rows. Chile extract N/A. |
| Blueberries E001-50 ×2 | Kaohsiung | 15,921 | 2025-09-29 | Only Taiwan DUA is 9,000 kg / 2026-07-19 |
| FRESH BLUEBERRIES (Holy Fruit) | Kaohsiung | 11,700 | 2026-01-27 | Holy Fruit: 16 Israel + 2 India; zero Taiwan |
| FRESH BLUEBERRIES E001-33 | Mumbai | 2,520 | 26/01/2025 | Remaining India splits do not sum to 2,520 without stealing another deal’s DUA |
