# Platform CSV → CRAM MVP (local only)

This folder consumes **Desktop `full-deals-dataset.csv`** enrichment for CRAM counterparty scoring inside `credit-risk-mvp` only.

## What we did **not** change

- No Mongo migrations or schema edits under `trumarket/`
- No changes to apps that depend on the live TruMarket deal/user ERD
- New CRAM tables (Customs, Counterparty, CofaceRecord, CRAM Assessment, Product, Route, Transaction Structure) are documented in `trumarket-database-erd-final.drawio` here for reference; wiring to production Mongo is out of scope for this MVP UI pass

## Data loaded

| Source | Use |
|---|---|
| `full-deals-dataset.csv` | 170 deals → `src/data/platform-deals.ts` |
| Counterparty formula HTML tester | Pre-computed CSV formula scores on ready pairs |
| Existing MVP `scoring.ts` | Live Dim A / full CRAM when user runs assessment |

### Counts (current CSV)

- **45** deals counterparty-ready (buyer + supplier `yearsInBusiness`)
- **5** buyer↔supplier pairs with calculated scores
- **79** real/unverified deals blocked (almost all missing `buyer.yearsInBusiness`)
- `licenseValidity` = **assumed true**; `avgPaymentDelayDays = 0`; `qualityRejectionRatePct = 0` (perfect Dim A points)
- `cofaceRecordId` still 0%; `customsId` = **4** deals

## UI tabs

1. **Assess deal** — wizard + fixed sample deals only
2. **Counterparty scores** — pre-scored buyer↔supplier pairs + formula panel
3. **Platform deals** — 45 CSV-ready deals with full CRAM already run + CRAM formula panel
4. **Missing fields** — unfilled enrichment fields per pre-scored deal (Coface / customs)

Also see **`docs/cram-missing-fields-report.md`** for the longer static report.

## Regenerate data

```bash
# From workspace: re-run the Desktop CSV → platform-deals.ts generator
# (script lived in the agent session; prefer re-exporting JSON then TS if CSV updates)
```

When Alessandro’s mandarin customs land and buyer YIB/SUNAT fills improve, regenerate `platform-deals.ts` and the Ready / Gaps tabs update automatically.

**Milestone rule:** any deal with `status` finished/completed is treated as `currentMilestone = 7` (`src/lib/deal-milestone.ts`), matching platform reality for closed deals.
