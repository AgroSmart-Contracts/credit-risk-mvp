# Agent Instructions — Market Intelligence (Peru customs)

You have access to a Peruvian customs-derived market-intelligence toolkit that produces CRAM-shaped inputs for TruMarket's D4 credit decision.

## When to invoke this toolkit

- A deal reaches D4 (post-Coface, pre-CRAM composite) and needs Dim A / Dim B / Dim C / Dim D.3 inputs
- A prospective supplier or buyer needs a first-pass credit-risk read
- A pricing question comes up ("what does mango PE→USA sell for in week 42?")
- A route-risk question comes up ("what does the table say about BB→Israel?")

## The primary tool

```bash
python -m src.rate \
  --exporter-ruc RUC          # 11-digit Peruvian RUC
  --importer NAME             # consignee name as it appears in customs
  --dest COUNTRY              # Spanish country name (ESTADOS UNIDOS, ISRAEL, PAISES BAJOS, etc)
  --variety VARIETY           # BLUEBERRY, MANGO, AVOCADO, STRAWBERRY, GRAPE, ...
  --deal-week YYYY-MM-DD/YYYY-MM-DD    # W-SUN period
  --deal-kg NUMBER
  --deal-price NUMBER         # USD per kg net, FOB basis
  --pretty                    # pretty-print JSON
```

Only `--exporter-ruc` is strictly required. Missing inputs return `NEEDS_INPUT` for the relevant dimension — the payload is honest about what it could and could not evaluate.

## Output shape

The JSON payload has this top-level structure:

```
{
  "meta":            { generated_at, data_as_of, table_version, source_files, engine_data_row_count },
  "deal_inputs":     { the params you passed },
  "dim_a_supplier":  { counterparty_profile output + SUNAT block },
  "dim_a_buyer":     { importer counterparty_profile output },
  "dim_b_price_benchmark":    { price_benchmark output },
  "dim_c_route_intelligence": { route_intelligence output with authoritative table signal },
  "dim_d3_pair_history":      { pair_history output }
}
```

## Confidence signals you MUST respect

- **`confidence: "NEEDS_INPUT"` or `"NO_HISTORY"`** — do NOT fabricate. Report to the human. Suggest what would unblock it (multi-year data / SUNAT token / cert uploads / new corridor row).
- **`route_signal_driver: "AIR_COLD_TREATMENT_STACK"`** — corridor floored at HIGH. This is the Israel-blueberry canonical case: air freight + cold treatment at origin = near-certain cold-chain break at hub. Never override.
- **`route_signal_driver: "35D_RULE"`** — perishable ocean corridor > 35d transit. Floored at HIGH regardless of pair flag.
- **`sunat.estado != "ACTIVO"` or `sunat.condicion != "HABIDO"`** — hard flag; investigate before any deal.
- **`deal_vs_p50_band: "OVER_MARKET_FLAG"` or `"UNDER_MARKET_FLAG"`** — CRAM B.2 point deduction (−22 / −18). Requires documented premium/discount reason before overriding.

## Rules you MUST follow

- **Never expose CRAM point tables** in counterparty-facing output. Tier letters (A/B/C/D) OK; sub-weights and point rules are confidential.
- **Prefer `route_signal_table` over `route_signal_inferred`.** The inferred signal is a customs-derived proxy — it misses transit ceilings, transshipment norms, resale liquidity, and destination market fragility. Only use inferred when table returns `NEEDS_INPUT`.
- **Prefer corridor-level positioning over variety-only.** `dim_a_supplier.corridor_positioning[]` is more accurate than `dim_a_supplier.price_positioning` for a specific deal.
- **Stamp every scoring run** with `meta.table_version` and `meta.data_as_of`. Reproducibility gate.
- **When customs shows a related-party pattern** (shared address, intra-company flow, same RUC family), flag it explicitly. The `dim_a_supplier.sunat.direccion` field is your address anchor.

## Refreshing the underlying data

When a new Veritrade drop arrives (typically ad-hoc), the human drops the xlsx into `raw/` and runs:

```bash
python -m src.refresh
```

The agent should NOT run this autonomously — it re-runs entity resolution across all files and rewrites marts. Human-triggered only.

## Known gaps in v0.1

- **`fecha_inscripcion` requires an API token** (`APIS_NET_PE_TOKEN`). Without it, Dim A years-in-business = NEEDS_INPUT.
- **Some corridors missing from tables** — France, Mexico, Sweden, others. Returns NEEDS_INPUT with a note. Human adds a row.
- **Fresh vs frozen blueberry pooled in benchmarks** — variety taxonomy doesn't yet distinguish HS 0810 fresh from HS 0811 frozen. For deals whose commodity crosses both, apply judgment.
- **Country name normalization** — cross-source strings like `PAISES BAJOS` vs `PAÍSES BAJOS`, `TAIWAN` vs `TAIWAN {FORMOSA}`. The reference-table lookup is accent-tolerant; other places may still need care.

## Quick example — score a hypothetical blueberry deal to Israel

```bash
python -m src.rate --exporter-ruc 20602722628 \
                   --importer "EAGLE TRADING AGRICULTURE MARKETING LTD" \
                   --dest ISRAEL \
                   --variety BLUEBERRY \
                   --deal-week 2025-10-13/2025-10-19 \
                   --deal-kg 5000 \
                   --deal-price 11.00 \
                   --pretty
```

You should see:
- `dim_c_route_intelligence.route_signal_table = "HIGH"` with driver `"AIR_COLD_TREATMENT_STACK"`
- `dim_a_supplier.sunat.direccion` containing "JUAN GRIS" (structural finding: same address family as TRU MARKET BLOCKCHAIN)
- `dim_d3_pair_history.relationship_signal = "MODERATE"` with +15 D.3 pts
- `dim_b_price_benchmark.deal_vs_p50_band` classifying the $11.00 price
