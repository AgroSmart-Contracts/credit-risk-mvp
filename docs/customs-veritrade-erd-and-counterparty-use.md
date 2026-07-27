# Customs ERD vs Veritrade — fields & counterparty use

**Sources:** Downloads ERD `Copy of trumarket-database-erd (1).drawio` (`Customs` entity), Veritrade sample `docs/Veritrade_UL-20111724_PE_E_20260109110033.xlsx`, market-intel ingest (`docs/market-intel-peru-2025-2026-07-10/src/ingest.py`), CRAM docs / MVP scoring in `credit-risk-mvp`.

**Short answer:** the Downloads `Customs` box is close for shipment grain, but it is missing several Veritrade columns the market-intel pipeline actually ingests, and it has one field that does not belong (`yearsInBusiness`). Customs does **not** directly set `avgPaymentDelayDays` / `qualityRejectionRatePct`; it feeds **aggregated track-record signals** into Dim A (and also B / C / D.3).

---

## Downloads ERD `Customs` vs this Veritrade file

Veritrade has **33 shipment columns**. The ERD already covers most of the ones used for join + volume + corridor:

| ERD field | Veritrade | Needed for CRAM / market-intel? |
|---|---|---|
| `taxId` | Cod. Tributario | Yes — key as **`exporterRuc`** |
| `exporterName` / `importerName` | Exportador / Importador | Yes — entity + pair history |
| `declarationNumber` | DUA / DAM | Yes — grain / dedupe |
| `tariffCode` / `tariffDescription` | Partida / descripción | Yes — product filter |
| `ShipmentDate` | Fecha | Yes — activity windows |
| `grossWeight` / `netWeight` | Kg Bruto / Neto | **net** is critical for capacity + $/kg |
| `fobValueTotal` | U$ FOB Tot | Yes — volume + pricing |
| destination / ports / via / naviera / broker / canal | matching cols | Yes for route / ops |

### Add if the table should match Veritrade + ingest

From `market-intel-peru-…/src/ingest.py` `RAW_COLUMNS`:

1. **`customsOffice`** (Aduana)
2. **`qty1` / `unit1` / `qty2` / `unit2`**
3. **`fobUsdPerUnit1` / `fobUsdPerUnit2`** (price benchmark)
4. **`portAgent`** (Agente Portuario)
5. **`commercialDescription`** (+ optional `description1…5`) — used for **variety** matching
6. Split **`freightForwarderOrigin` / `freightForwarderDestination`** (don’t collapse to one `freightForwarders` field)
7. **`sourceFile`** (provenance; already on the repo `customs_export_records` box in `trumarket/docs/trumarket-database-erd.drawio`)

### Remove / move off Customs

- **`yearsInBusiness`** — not in Veritrade rows. It comes from **SUNAT** (`fecha_inscripcion`) on the counterparty / RUC lookup, not from a DUA line. Belongs on **Counterparty** (or a SUNAT block), not shipment-level Customs.

### Modeling note (more important than extra columns)

Customs is **N rows per exporter RUC**, not 1:1 with Counterparty. `Counterparty.customsId → Customs` is the wrong shape; join should be `exporterRuc` (and optional `userId`), then aggregate.

The leaner `customs_export_records` entity in `trumarket/docs/trumarket-database-erd.drawio` is closer to how CRAM uses the data.

For scoring you do **not** need every Veritrade column on the ERD — qty/unit/descriptions matter for marts; broker/line/channel are secondary. You **do** need RUC, date, kg_net, FOB, importer, destination, HS, and commercial description.

### Full Veritrade column ↔ ingest map (reference)

| # | Veritrade header | Ingest / suggested store field |
|---|---|---|
| 0 | Partida Aduanera | `hs_code` / `tariffCode` |
| 1 | Descripcion de la Partida Aduanera | `hs_description` / `tariffDescription` |
| 2 | Aduana | `customs_office` — **often missing on ERD** |
| 3 | DUA / DAM | `dua` / `declarationNumber` |
| 4 | Fecha | `date` / `shipmentDate` |
| 5 | Cod. Tributario | `exporter_ruc` (prefer over generic `taxId`) |
| 6 | Exportador | `exporter_name` |
| 7 | Importador | `importer_name` |
| 8 | Kg Bruto | `kg_gross` |
| 9 | Kg Neto | `kg_net` |
| 10–13 | Qty 1 / Und 1 / Qty 2 / Und 2 | `qty1`, `unit1`, `qty2`, `unit2` |
| 14 | U$ FOB Tot | `fob_usd` |
| 15–16 | U$ FOB Und 1 / Und 2 | `fob_usd_per_unit1/2` |
| 17 | Pais de Destino | `destination_country` |
| 18 | Puerto de destino | `destination_port` |
| 19 | Último Puerto Embarque | `last_shipping_port` |
| 20 | Via | `transport_mode` |
| 21 | Agente Portuario | `port_agent` |
| 22 | Agente de Aduana | `customs_broker` |
| 23–28 | Descripcion Comercial + Descripcion1–5 | `commercial_description`, `description_1…5` |
| 29 | Naviera | `shipping_line` |
| 30–31 | Agente Carga (Origen/Destino) | `freight_forwarder_origin/destination` |
| 32 | Canal | `customs_channel` / `inspectionChannel` (VERDE/ROJO) |

---

## How customs is used in counterparty risk (credit-risk-mvp)

### Pipeline

1. **Ingest** Veritrade → `fact_shipments` (`ingest.py` column map above).
2. **Rate** a deal by `exporterRuc` (+ optional importer / dest / variety / kg / price) → `marketIntel` payload (`docs/market-intel-peru-2025-2026-07-10/docs/INTEGRATION.md`, `README.md`).
3. That payload’s **Dim A** blocks are the customs-derived counterparty signals:

| Signal | Source | Role in Dim A |
|---|---|---|
| `months_active_12mo`, shipment counts, kg/FOB | Veritrade aggregates | Activity / “completion” proxy |
| `capacity_check` (deal vs monthly baseline) | Veritrade volumes vs deal size | Capacity points |
| `top_partners` concentration | Veritrade bipartite flows | Concentration flag |
| `dim_d3_pair_history` | prior exporter↔importer rows | Relationship pts (customs pair history) |
| `sunat.years_in_business` / estado | **SUNAT API**, not Veritrade | Years + license-like signal |

Mapped in `src/lib/market-intel/scoring.ts` toward buyer/supplier-style points (years, activity, capacity). Docs also say Veritrade feeds **Dim B** (price vs P50) and **Dim C** (route), not only counterparty.

### What the main MVP scorecard does today

From `src/lib/scoring.ts` (weights corrected 2026-07-24, this section corrected 2026-07-27 — see `cram-defaults-and-formula-2026-07.md`):

```
counterparty = buyer×0.5 + supplier×0.5 + relationship
```

Coface coverage % is **not** part of this formula — it's a spec §1 Gate 1 pass/fail pre-check, kept only for narrative "why" text (`externalCreditBonus()` in `scoring.ts`).

Buyer/supplier points use **manual / deal fields**: years, license, platform completion, credit rating — **not** raw customs columns.

### Practical status today

- Customs **can** enrich Dim A via `deal.marketIntel` when RUC resolves.
- Helpers exist to turn that into points (`marketIntelSupplierBreakdown`, etc.), but **`computeCounterpartyScore` does not yet consume those helpers** — it still reads `deal.buyer` / `deal.supplier`.
- Veritrade **cannot** produce `avgPaymentDelayDays` or `qualityRejectionRatePct` (different semantics; payment delay needs actual vs due dates; quality rejection needs claims/QC, not DUA lines).

---

## Bottom line

For the Downloads Customs entity:

1. Add the Veritrade columns listed above if you want full-fidelity storage.
2. Drop `yearsInBusiness` from Customs (put on Counterparty / SUNAT).
3. Fix Counterparty↔Customs to **RUC / many-shipments**, not `customsId` 1:1.

For counterparty scoring, prioritize storing (or marting) **RUC + date + kg_net + FOB + importer + dest + HS + commercial description** — that is what Dim A actually aggregates.

### Related docs

- [`cram-field-extraction-reference.md`](./cram-field-extraction-reference.md) — `marketIntel.*` / RUC gate
- [`cram-trumarket-coverage-and-gaps.md`](./cram-trumarket-coverage-and-gaps.md) — coverage matrix
- [`tm-cram-engine-spec-2026-06.md`](./tm-cram-engine-spec-2026-06.md) — counterparty blend formula (spec §4.A)
- [`market-intel-peru-2025-2026-07-10/README.md`](./market-intel-peru-2025-2026-07-10/README.md) — Dim A/B/C/D.3 feeds
- [`trumarket/docs/trumarket-database-erd.drawio`](../../trumarket/docs/trumarket-database-erd.drawio) — `customs_export_records` target shape
