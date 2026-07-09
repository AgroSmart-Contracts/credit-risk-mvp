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

## Branding

Uses TruMarket colors from `trumarket/web` — primary green `#4E8C37`, accent `#F2A007`, text `#2D3E57`.
