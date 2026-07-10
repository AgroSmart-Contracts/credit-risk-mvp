# TruMarket — Market Intelligence (Peru customs)

Peruvian customs-derived market-intelligence toolkit that feeds CRAM Dimensions A, B, C, D.3.

**Scope in this bundle:** Peru 2025 export customs, HS 0810 (fresh blueberries) + HS 0811 (frozen fruit). 47,948 shipment-level records across 269 exporters and 1,109 canonical importers. Analytical marts pre-built and ready to query.

## What this is for

Given a proposed deal — supplier RUC, buyer, destination, variety, week, size, price — this toolkit returns every market-intel signal the deal reviewer (or the D4 CRAM engine) needs:

- **Dim A Supplier** — counterparty profile with SUNAT lookup: capacity, vintage, buyer concentration, price positioning, activity consistency
- **Dim A Buyer** — importer profile: capacity, supplier concentration, corridor pricing
- **Dim B.2** — price-vs-market benchmark: adaptive-window P10/P50/P90 bands, variance classification (WITHIN_BAND / OUTSIDE_BAND / OVER_MARKET_FLAG / UNDER_MARKET_FLAG)
- **Dim C.4** — route intelligence: authoritative flag from CRAM reference tables (35-day rule, air+cold-treatment stack, product×market overrides) + inferred signal from customs
- **Dim D.3** — pair history: prior-shipment count, price stability, relationship signal

Every signal returns with a confidence tier and provenance. Missing data → `NEEDS_INPUT`, never fabricated.

## Quick start

```bash
# Install
python -m pip install -r requirements.txt

# Score a deal
python -m src.rate --exporter-ruc 20604580821 \
                   --importer "BERRYWORLD EUROPE" \
                   --dest "PAISES BAJOS" \
                   --variety BLUEBERRY \
                   --deal-week 2025-10-13/2025-10-19 \
                   --deal-kg 25000 \
                   --deal-price 7.06 \
                   --pretty
```

Returns a JSON payload keyed by CRAM dimension. Pipe to jq, save to a deal folder, or hand to an agent.

## Refresh when new Veritrade drops arrive

```bash
# Drop the new xlsx into raw/, then:
python -m src.refresh
```

Scans `raw/`, ingests each file (auto-detects Veritrade vs raw-SUNAT format), re-runs entity resolution, rebuilds all marts. Prints a diff.

## Layout

```
src/
  ingest.py              Excel → typed DataFrame (Veritrade + alt-SUNAT format detection)
  entity_resolution.py   RUC dedup, fuzzy importer clustering (per country), product taxonomy
  marts.py               fact_shipments + 3 dims + bipartite_flows
  analysis.py            The four CRAM-feed functions + dataclasses
  cram_tables.py         Loader for the reference-table JSON config
  sunat_lookup.py        RUC → registration info (free tier + v2 token via APIS_NET_PE_TOKEN)
  rate.py                CLI: one-shot D4 payload
  refresh.py             CLI: ingest + rebuild

config/
  cram_tables_v0.1.json  Perishability, corridor defaults, product×market pair overrides

marts/
  fact_shipments.parquet          all shipments, enriched (47,948 rows)
  dim_exporter_month.parquet
  dim_importer_month.parquet
  dim_variety_destination_week.parquet
  bipartite_flows.parquet
  importer_registry.parquet
  raw_snapshots/                  per-file Parquet snapshots
  fixtures/                       example outputs for known entities

docs/
  INTEGRATION.md         how to plug into compute_cram
```

**Not included in this bundle:** `raw/` (the source xlsx files — the marts already contain everything), `marts/sunat_cache/` (per-user).

## Environment

Optional: set `APIS_NET_PE_TOKEN` in your shell to unlock the SUNAT v2 endpoint. Without it, the shim uses the free v1 endpoint (returns `estado`, `condicion`, `razon_social`, `direccion` but not `fecha_inscripcion` — so `years_in_business` reports NEEDS_INPUT).

## Version

- **Table version:** stamped on every `rate` payload as `meta.table_version` — matches `config/cram_tables_v0.1.json` field `version`
- **Data as-of:** stamped on every `rate` payload as `meta.data_as_of` — set to the freshest date in `fact_shipments.parquet`

## For agent consumers

See `AGENTS.md` — one-page onboarding for LLM agents that will operate this toolkit.
