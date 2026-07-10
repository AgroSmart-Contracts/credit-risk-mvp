# Integration — plugging into `compute_cram(deal_ref)`

This toolkit produces the market-intel inputs that CRAM's D4 primitive currently marks NEEDS_INPUT (spec Open Items #2, #3, and partially #4).

## The contract

`python -m src.rate ...` emits one JSON payload per deal. The payload is:
- **Deterministic** — same inputs + same `table_version` + same `data_as_of` = byte-identical output
- **Auditable** — every field carries confidence + provenance
- **Honest** — missing data returns `NEEDS_INPUT`, never a fabricated value

## Two integration patterns

### Pattern 1 — direct import (recommended for AC's current setup)

`compute_cram(deal_ref)` is a Python script AC runs manually. The simplest integration is to import and call in-process:

```python
import pandas as pd
from src.rate import build_payload

fact = pd.read_parquet("marts/fact_shipments.parquet")

payload = build_payload(
    fact=fact,
    exporter_ruc=deal.supplier_ruc,
    importer_name=deal.buyer_name,
    destination_country=deal.destination,
    variety=deal.commodity,
    deal_week=deal.closure_week,
    deal_kg=deal.quantity_kg,
    deal_price_usd_per_kg=deal.unit_price_fob,
    as_of=deal.d4_date,
    source_files=None,  # fills automatically
)

# payload dict is ready to fold into the D4 scorecard
```

Then `compute_cram` reads:
- `payload["dim_a_supplier"]["sunat"]["d2_pts"]` → Dim A years variable (or NEEDS_INPUT)
- `payload["dim_a_supplier"]["capacity_check"]["flag"]` → Dim A capacity
- `payload["dim_a_buyer"]["capacity_check"]["flag"]` → Dim A buyer capacity
- `payload["dim_b_price_benchmark"]["deal_vs_p50_band"]` → Dim B.2 points
- `payload["dim_c_route_intelligence"]["route_signal_pts"]` → Dim C.4 pts
- `payload["dim_d3_pair_history"]["d3_indicative_pts"]` → Dim D.3 pts

### Pattern 2 — CLI + file drop (recommended for cross-team handoff)

For teams whose runtime is elsewhere:

```bash
python -m src.rate ... --out Drive/deals/TM-2026-XXX/04-Risk/market-benchmark.json --pretty
```

The receiving process reads the JSON file. Independent of language, runtime, or environment. Auditable as an artifact.

## What to record on every scoring run

Per the CRAM spec §8 versioning discipline:

```python
scoring_run = {
    "deal_ref": ...,
    "computed_at": payload["meta"]["generated_at"],
    "engine_version": "cram-spec-v0.1",
    "table_version": payload["meta"]["table_version"],       # <-- from this toolkit
    "data_as_of": payload["meta"]["data_as_of"],             # <-- from this toolkit
    "market_intel_source_files": payload["meta"]["source_files"],
    # ... rest of your scorecard
}
```

## When the payload says NEEDS_INPUT

The engine spec says `compute_cram` never fabricates. Corresponding handling in the D4 playbook:

| Field | Fallback |
|---|---|
| `dim_a_supplier.sunat.d2_pts = NEEDS_INPUT` | Analyst supplies years-in-business from SUNARP direct check, or set `APIS_NET_PE_TOKEN` to unlock v2 |
| `dim_b_price_benchmark.confidence = NEEDS_INPUT` | Corridor too thin; supply reference manually from broker knowledge |
| `dim_c_route_intelligence.route_signal_table = NEEDS_INPUT` | Corridor missing from tables; add a row in `config/cram_tables_v0.1.json`, re-run |
| `dim_d3_pair_history.relationship_signal = FIRST_TIME` | Legitimate result — apply the −12 D.3 rule directly |

## Refresh cadence

Re-run `python -m src.refresh` when a new Veritrade drop arrives. Marts rebuild in ~90 seconds. `table_version` doesn't change unless `config/cram_tables_v0.1.json` is edited (that's a separate versioning event tied to AC sign-off).

## Related-party surfacing

When the SUNAT address of the supplier matches another entity in the customs data, treat the deal as a related-party arrangement. Cross-check:

```python
sunat_block = payload["dim_a_supplier"]["sunat"]
if sunat_block and "JUAN GRIS" in (sunat_block.get("direccion") or "").upper():
    # Flag the deal as related-party (TRU MARKET address family)
    ...
```

Full auto-detection is Phase 1 work; for now, human eyeball on address is the practical bridge.
