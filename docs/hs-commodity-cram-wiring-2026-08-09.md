# Commodity / HS codes and CRAM scoring — 2026-08-09

## Why HS matters

Counterparty customs volumes and product/price risk are **commodity-specific**.
The same buyer can look strong on blueberries (HS `0810`) and weak/irrelevant on coffee (`0901`). Free-text `product` labels are ambiguous; **partida / HS code** is the durable commodity key.

## What changed

1. **`hsCode` column** on `docs/platform-deals-with-defaults-2.csv` (and `src/data/platform-deals-with-defaults.csv`), backfilled from product where known (162/170).
2. **`src/lib/hs-product-map.ts`** — normalize partida, map HS ↔ product label / usual-price key.
3. **Dimension B** — `lookupProductRisk` + usual-price tables prefer HS when present.
4. **Dimension A customs** — aggregator keeps `byHs` per company; sandbox recalculate filters volumes to the deal/group HS heading when available.
5. **Deal / PlatformDealRecord** carry `hsCode` + `hsHeading4`.

## Fill priority

| Field | Required to score? | Why fill |
|---|---|---|
| `hsCode` (partida) | No (name backfill exists) | Correct commodity identity when name is wrong/alias; filters customs by tariff |
| Real partida from DUA/BL | Preferred over backfill | Observed shipment code beats assumed map |

## Refresh pipeline

```bash
# after editing HS on the defaults CSV
npx tsx scripts/apply-platform-defaults-csv.ts
python3 scripts/aggregate-customs-companies.py   # rebuilds byHs
npx tsx scripts/recalculate-counterparty-scores.ts
npm run export:deal-apy
```

## Known backfill map (heading)

| Product | Default HS |
|---|---|
| Fresh Blueberries | `0810400000` |
| Fresh Avocado | `0804400000` |
| Fresh Asparagus | `0709200000` |
| Fresh Mandarin | `0805200000` |
| Fresh Grapes | `0806100000` |
| Green Coffee | `0901119000` |
| Cacao Beans | `1801000000` |
| IQF / mixed tropical | `0811900000` |

Override any row’s `hsCode` in the defaults CSV when the real partida differs.
