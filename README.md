# TruMarket Credit Risk MVP

Standalone demo app for presenting TruMarket's agro trade-finance credit scoring model to bank audiences.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Build & deploy

```bash
npm run build
```

Deploys cleanly to Vercel with zero config (static Vite output in `dist/`). Document analysis runs via Vite dev middleware locally and Vercel serverless handlers in `api/` when deployed.

## Flow

1. **Deal selector** — pick a seeded deal or create a new assessment
2. **Create assessment** — upload trade contracts and Coface limit PDFs; deal fields auto-fill from extraction
3. **Document ingestion** — animated extraction summary
4. **Risk dashboard** — circular gauge + four sub-score bars with CRAM-backed reasons
5. **Financing recommendation** — max financing, advance, rate, collateral, approval routing

Scoring uses CRAM reference tables in `src/lib/product-risk-tables.ts`, `route-risk-tables.ts`, and `product-market-pair-table.ts`. Sample PDFs for local testing live in `docs/`.

## Pre-harvest mode

The **Pre-harvest** workspace (`/#pre-harvest`, English and Spanish) is the bank's view of crop loans made before harvest: it scores the grower, releases the loan in tranches and monitors the campaign until the buyer's purchase order (M3), when the deal moves to the post-harvest model above.

- **Pages:** Dashboard (portfolio map, KPIs, alerts), Inbox, Decisions, Alerts, Method, New application, and one page per loan file.
- **Loan file:** money first (exposure, money at risk, repayment, risk score), the pending decision, the credit timeline, TruMarket updates, then tabs for Summary, Risk details, Credit analysis, What happened, Disbursements & audit and Application file. A replay steps through the campaign week by week and exports the decision log as CSV.
- **Score:** Production 50%, Operator 35%, Structure 15%; Counterparty is 0% until M3. Tiers A ≥80, B 65–79, C 50–64, D <50.
- **Tranches:** 30% at approval, 40% at fruit set, 30% pre-harvest, each released only when its conditions are met.
- **Money at risk** = exposure × PD (by tier) × LGD. Coverage uses the buyer's PO once signed, otherwise the expected harvest.
- **Monitoring:** crop health (NASA MODIS NDVI and Sentinel-2), weather and water (Open-Meteo, Niño 1+2 from NOAA), market (avocado FOB prices) and the M3 takeout, each with Watch and High risk thresholds.
- **Registry checks** (SUNARP, INFOCORP/SBS, ANA, SENASA, insurance) come from recorded files; there is no live connection to those registries yet.

All rules and thresholds are in `src/lib/pre-harvest/config.ts`. Engine logic is in `src/lib/pre-harvest/`, file data in `src/data/pre-harvest/`, UI in `src/components/pre-harvest/`.

Every data source is free and keyless. `GET /api/pre-harvest-data?parcel=<id>` fetches the latest satellite, weather and El Niño readings for a live file and returns 400 for an unknown parcel. Cached copies live in `src/data/pre-harvest/` and `public/pre-harvest/`. Rebuild them with:

```bash
npx tsx scripts/pre-harvest/build-monitoring-fixtures.ts   # NDVI, weather, El Niño
npx tsx scripts/pre-harvest/build-sentinel-fixture.ts      # Sentinel-2 field imagery
npx tsx scripts/pre-harvest/build-market-data.ts           # export prices (UN Comtrade)
```

URL parameters: `page` (dashboard, inbox, decisions, alerts, method, new), `deal` (e.g. `PH-ICA-0177-2627`), `tab`, `week`, `lang=es`.

## Branding

Uses the TruMarket palette from `trumarket/web/src/styles/globals.css`: primary green `#0f9d6b`, accent `#d9a93b`, ink `#102a40`, danger `#f25e6b`. Tokens are defined in `src/index.css`.
