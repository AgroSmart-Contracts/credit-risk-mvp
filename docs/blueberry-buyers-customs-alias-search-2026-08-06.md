# Blueberry buyers missing from customs — alias / dest+volume search

Generated: 2026-08-06

Sources searched:

- `docs/Veritrade_UL-20111724_PE_E_20260109105908(new).csv` (Peru blueberry exports, Jan 2025–Jan 2026)
- `docs/10843_20260128213854_20260128213855.xlsx` (Datasur, same window)

Question: for platform buyers that do not appear under their Mongo names, can we still find their shipments in customs under a **different importer/consignee name**, by matching destination + volume (+ supplier when present)?

Buyers in scope:

1. Allied Trade Global
2. Agro Smart Contracts LDA
3. Trade Cultivators LLC
4. Fresh Express LLC
5. Guangzhou Fresh Link Import Co Ltd

Related checks also covered: «Ardzhies» LLC, Limax Sp. z o.o., and screenshot alias **Allied Trade International Link Co., Ltd.**

---

## Method

For each buyer:

1. **Name search** — exact / fuzzy variants in Importador / Consignatario / full row text.
2. **Supplier presence** — does the platform supplier appear as Exportador?
3. **Supplier route** — if the supplier exists, which destinations and consignees do they actually ship to?
4. **Dest + volume (+ FOB)** — ignore Mongo buyer name; look for customs rows with the same destination country and similar kg / boxes / FOB.

A match is only treated as an alias if supplier route and dest+volume point to a **single consistent** importer. Dest+volume alone (common pallet sizes like 11,700 kg / 7,800 boxes) is treated as noise.

---

## Summary

| Mongo buyer | Name in customs? | Platform supplier in customs? | Dest+volume usable as alias? | Conclusion |
|---|---|---|---|---|
| Allied Trade Global | No (also no “Allied Trade International Link”) | Viñasol / Villaventura **absent** as exporters | No — many Taiwan lookalikes, wrong exporters | **Not found** |
| Agro Smart Contracts LDA | No | Tru Market → IL/IN/NL only; Holy Fruit → Israel (Eagle Trading), not Taiwan | No | **Not found** |
| Trade Cultivators LLC | No | Giddins **absent** | No — UAE has traffic, but not this kg+FOB band | **Not found** |
| Fresh Express LLC | No | Fundo Las Lomas **present**, but UK/US/NL — **not UAE** | No | **Not found** |
| Guangzhou Fresh Link | No | ICA Blueberries **absent** | No — China 11.7t band too common | **Not found** |
| «Ardzhies» LLC | No | Tru Market → Russia = **0** rows | Russia rows exist but importer always N/A | **Not found** |
| Limax Sp. z o.o. | **Yes** | Tru Market → Limax rows exist | N/A (direct name match) | **Matched** |

---

## Per-buyer detail

### 1. Allied Trade Global — 18 Fresh Blueberries deals

| Field | Platform |
|---|---|
| Destination | Kaohsiung, Taiwan |
| Suppliers | Agrícola Viñasol SAC (12), Villaventura Peru SAC (6) |
| Typical volume | 7,800 × 1.5 kg = **11,700 kg** |
| Typical FOB | ~$53k–$56k |
| Total value | ~$990k |

**Name search:** 0 hits for Allied Trade Global, Allied Trade, Allied Trade International Link Co., Ltd. (screenshot consignee), Yongji Rd / phone numbers.

**Suppliers:** Viñasol only appears in Datasur as **ALMACEN** (warehouse), not Exportador. Villaventura absent from both files.

**Dest + volume (Taiwan · ~11.7t · FOB ~$50–62k):** 48 Veritrade rows, but exporters are Hortifrut / Larama / Bomarea / etc. — not Viñasol/Villaventura.

Frequent Taiwan importers on those lookalikes (not attributable to Allied):

- Shine Orchard Corporation
- Lica Fresh Co. Ltd
- Very Fresh Inc
- Ever Galan Enterprise Co. Ltd
- others (Ron Jiun, Joy Lee, Jumbo Food, Derek L. Wang, …)

**Verdict:** no customs alias. Screenshot legal name does not appear either.

---

### 2. Agro Smart Contracts LDA — 13 deals (7 blueberries + avocado/mandarin/other)

Blueberry-relevant patterns:

| Dest | Supplier | Approx volume / FOB |
|---|---|---|
| Guarulhos, Brazil | Tru Market | ~2,310 kg · ~$24k |
| Vancouver, Canada | Tru Market | small 576-carton lots · ~$10k |
| Kaohsiung, Taiwan | Tru Market / Holy Fruit Peru | 7,800 cartons / ~11,700 kg · ~$85–94k |

**Name search:** 0 hits.

**Supplier routes in customs:**

| Supplier | Customs destinations | Top importers |
|---|---|---|
| Tru Market Blockchain | Israel, India, Netherlands | Eagle Trading, A.S.M International, **Limax** |
| Holy Fruit Peru | **Israel** (mainly), India | **Eagle Trading Agriculture Marketing Ltd** |
| Bio Farming Peru | absent | — |

Holy Fruit does **not** ship to Taiwan in these extracts; its clear consignee is Eagle Trading (Israel), which is **not** Agro Smart.

**Dest + volume:** Taiwan ~11.7t / ~$85–94k hits exist (Camposol, Blue Gold, Aqu Anqa, … → Very Fresh, Plenty Fruit, Glitter Gem, …). Too many exporters/importers; no link to Agro Smart or its suppliers.

**Verdict:** not found. Closest real Holy Fruit trail points to Eagle Trading / Israel, not Agro Smart / Taiwan.

---

### 3. Trade Cultivators LLC — 7 Fresh Blueberries deals

| Field | Platform |
|---|---|
| Destination | Dubai, UAE |
| Supplier | Giddins Peru SAC |
| Volume | ~5,400–6,480 kg (3,600–4,320 × 1.5 kg) |
| FOB | ~$88k–$91k |

**Name search:** 0 hits.  
**Giddins:** 0 rows as exporter in Veritrade/Datasur.

**UAE blueberry traffic exists** (379 Veritrade rows). Top importers: Salah A Al Amoudi Est, Mohammed Abdallah Sharbatly, Kibsons, Berry Mount Arabia, Fresh Fruits Company, Spinneys, etc. Exporters: Blueberries Peru, Agrovision, Frutícola del Sur, …

But **no rows** combine UAE + ~5.4–6.5t + FOB ~$88–97k (the 5–7t UAE band tops out around ~$60k FOB in this extract).

**Verdict:** not found; cannot alias to Al Amoudi / Sharbatly / etc. from these files.

---

### 4. Fresh Express LLC — 7 Fresh Blueberries deals

| Field | Platform |
|---|---|
| Destination | Dubai, UAE |
| Supplier | Fundo Las Lomas SAC |
| Volume | ~5,400–6,480 kg |
| FOB | ~$93k–$97k |

**Name search:** 0 hits for Fresh Express.

**Fundo Las Lomas — present in customs (Veritrade 38 / Datasur 33), but not to UAE:**

| Destination | Typical consignees |
|---|---|
| United Kingdom | S&A Produce UK Ltd (and spelling variants) |
| United States | The Fruitist Company |
| Netherlands | Berryland B.V., Byblue BV |
| Spain | Surexport |

**Dest + volume UAE:** same as Trade Cultivators — **0** rows at deal kg+FOB.

**Verdict:** not found. Fundo’s real customs buyers are UK/US produce importers, not Fresh Express / Dubai.

---

### 5. Guangzhou Fresh Link Import Co Ltd — 4 Fresh Blueberries deals

| Field | Platform |
|---|---|
| Destination | China (Malaga / Shanghai in Mongo) |
| Supplier | ICA Blueberries SAC |
| Volume | 7,800 × 1.5 kg = **11,700 kg** (one bulk 3.5 kg lot larger) |
| FOB | ~$78k–$80k |

**Name search:** 0 for Guangzhou Fresh Link / Fresh Link. Unrelated Guangzhou\* companies exist (e.g. Guangzhou Canasto, Chun Wan Yi Guangzhou Supply Chain) — different entities.

**ICA Blueberries:** 0 rows as exporter.

**Dest + volume (China · ~11.7t · FOB ~$70–90k):** hundreds of rows; mostly Importador **N/A**, else Shenzhen forwarders / traders (Yueshi Supply Chain, Joy Wing Mau, Frutacloud, Oheng, …). Exporters are Danper, Berry Harvest, Larama, Hass Peru, Camposol, etc. — not ICA.

**Verdict:** not found; pallet size too common to alias.

---

## Related: «Ardzhies» LLC (2 deals)

| Field | Platform |
|---|---|
| Product | Fresh Blueberries |
| Destination | St Petersburg, Russian Federation |
| Supplier | Tru Market Blockchain |
| Volumes | 11,700 kg ($70,200) and 6,426 kg ($38,556) |

- Name: 0 hits.
- Tru Market → Russia: **0** rows.
- Russia blueberry rows in customs: **~129–130**, but **Importador/Consignatario = N/A on every row**.
- Exporters on Russia traffic: Frutícola del Sur, Verfrut, Beta, …
- `platform-deals-with-defaults-2.csv` has **empty `shipmentDate`** for these deals; ignoring Mongo dates does not create a match.

**Verdict:** Russia blueberry shipments exist in customs, but with blank importers — cannot identify Ardzhies (or any buyer).

---

## Related: Limax Sp. z o.o. (contrast — matched)

| Field | Result |
|---|---|
| Platform deals | 7 Fresh Blueberries → Amsterdam/Rotterdam |
| Veritrade | **32** rows as Importador (`LIMAX SP ZOO` / variants) |
| Datasur | **10** rows as Consignatario |
| Sandbox | `customsMatched: true` — ~143 MT, ~$944k FOB, 3 routes |
| Tru Market → Limax | 2 Veritrade lines on 2025-11-11 |

Limax is the pattern that works: buyer name (with spelling variants) appears as importer/consignee.

---

## Screenshot note — Allied Trade International Link Co., Ltd.

Shipping docs for an Allied Taiwan deal list consignee / notify / commercial invoice party as:

**Allied Trade International Link Co., Ltd.**  
4F-5, No. 350, Yongji Rd., Xinyi Dist., Taipei, Taiwan  

That is a useful Mongo alias candidate vs “Allied Trade Global”, but **that fuller name is also absent** from Veritrade and Datasur (0 hits). So it explains a naming mismatch; it does not unlock enrichment from these extracts.

---

## Bottom line

1. The five missing buyers are **not** findable under alternate importer names in the current Veritrade/Datasur pulls.
2. Where platform suppliers **do** appear (Fundo Las Lomas, Holy Fruit, Tru Market), they ship to **other countries/consignees** than the Mongo deals claim (UK/US, Israel/Eagle Trading, IL/IN/NL) — evidence the Mongo buyer/route may not match the customs filing party.
3. Dest + volume alone is insufficient: 11,700 kg / 7,800-box lots are a standard blueberry pallet and match many unrelated shippers.
4. Russia blueberry customs rows never populate the importer field in these files.
5. To close these gaps, need either:
   - a customs extract that includes the missing exporters (Viñasol, Villaventura, Giddins, ICA) and/or destination-country imports under the legal names, or
   - document-backed aliases (BL/invoice consignee) plus a targeted pull under those legal names (e.g. Allied Trade International Link Co., Ltd.).
