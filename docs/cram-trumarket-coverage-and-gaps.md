# CRAM × TruMarket — Field Coverage, Missing-Data Recognition & Unused Extractables

**Date:** 2026-07-16  
**Purpose:** Single reference that (1) lists every CRAM scoring input, (2) maps what TruMarket’s trade + drawback extraction can fill today, (3) specifies system changes to surface **which CRAM fields are still missing**, and (4) inventories data already present in `trumarket/docs` / extractors that **neither** the CRAM deal model nor the TruMarket Mongo deal entity uses.

**Companions**

| Doc | Role |
|---|---|
| [`trumarket/docs/deal-field-extraction-reference.md`](../../trumarket/docs/deal-field-extraction-reference.md) | TruMarket Mongo deal field ← PDF |
| [`trumarket/docs/file-recognition-and-analysis.md`](../../trumarket/docs/file-recognition-and-analysis.md) | Classifiers, regexes, merge, §26 non-persisted |
| [`docs/cram-field-extraction-reference.md`](./cram-field-extraction-reference.md) | CRAM field ← Mongo / PDF (detail map) |
| [`docs/tm-cram-engine-spec-2026-06.md`](./tm-cram-engine-spec-2026-06.md) | Scoring variables & `NEEDS_INPUT` |
| [`docs/transaction-structure-model-reference.md`](./transaction-structure-model-reference.md) | Structure cash-flow inputs |
| [`docs/credit_risk_framework_banking.md`](./credit_risk_framework_banking.md) | Banking product variable list |

---

## 1. How the two systems relate

```
Trade PDFs (5 types) ──┐
                       ├─► shared regex extractor ──► DealFieldSuggestions
Drawback PDFs (11) ────┘         ▲
                                 │
                    TM classifiers only label type
                    (CRAM MVP runs trade classifier only)

TruMarket Mongo (deals/users/payments)
        │
        ▼
   CRAM Deal model ──► Tables 1–3 + structure engine ──► score + confidence
```

| Layer | TruMarket today | credit-risk-mvp today |
|---|---|---|
| Trade classify | 5 types | 6 + Coface (PO/contract split) |
| Drawback classify | 11 Peru types + chronology/validation | **Not run** — same regex on body only |
| Persisted deal shape | Mongo `deals.*` | In-browser `Deal` + `transactionStructure` |
| Missing-field UX | Partial (`analysisTrace`, merge gaps) | Static `fieldsNeedingConfirmation` + `docCoveragePct` |

---

## 2. CRAM fields needed (scoring inputs)

Legend: 📄 PDF · 🗄️ Mongo · 🔧 CRAM table · ✋ manual/API

### A — Counterparty

| CRAM field | Auto | Best source |
|---|---|---|
| `buyer.name` / `supplier.name` | 📄🗄️ | Export invoice, contract; Mongo company snapshots |
| `supplierRuc` | 📄🗄️ | Invoice RUC; Mongo `taxId` → market-intel |
| Party countries / roles | 📄🗄️ | DAM/BL/invoice; Mongo `accountType` |
| `priorDealsBetweenParties`, `relationshipAgeMonths` | 🗄️⚙️ | Mongo pair history — **not computed** |
| Platform deals / completion rate | 🗄️⚙️ | Mongo statuses — **not computed** |
| Payment delay / quality rejection | ✋ | Manual |
| Years in business / licenses / ratings | ✋ | Manual / SUNAT / Coface company grade (narrative) |
| **Coface — request** | 📄 | `cofaceRequestCountry`, `cofaceRequestBuyerName`, `cofaceRequestedCoverageAmountUSD` |
| **Coface — response** | 📄 | `cofaceCountryRiskGrade`, `cofaceCompanyRiskGrade`, `cofaceCoverageAmountUSD`, derived `cofaceCoveragePct` |
| `marketIntel.*` | ✋ | Peru customs API when RUC present |

### B — Product

| CRAM field | Auto | Best source |
|---|---|---|
| `product`, `variety`, `quantityLabel`, `qualityGrade` | 📄 | Invoice/CO/packing; CAT I/II → grade |
| Perishability / shelf life / cold chain / category | 🔧 | Table 1 from `product` |
| Price vs market | ✋🔧 | Market-intel (often `NEEDS_INPUT`) |

### C — Route

| CRAM field | Auto | Best source |
|---|---|---|
| `origin` / `destination` | 📄🗄️ | BL, export invoice, DAM; Mongo |
| `incoterm` | 📄 | Invoice/contract *(TM only embeds in `description`)* |
| Transit / transshipments / route flag | 🔧 | Tables 2–3 *(BL/GRE dates extracted but unused)* |
| Ports | 📄🗄️ | Corridor hint only |

### D — Transaction structure

| CRAM field | Auto | Best source |
|---|---|---|
| `dealValueUSD` / sale total | 📄🗄️ | Export invoice; Mongo `totalValue` |
| `purchaseTotalUSD` | 📄 | PO / raw-material invoice |
| `paymentTerms`, `advancePaymentPct` | 📄 | Contract / invoice |
| Buyer tranche schedule | 📄⚙️ | Best-effort from terms + transit |
| Supplier tranches / dealPurpose / collateral | ✋ | Manual or defaults |
| Coface → approved limit + request/response grades | 📄✋ | PDF extraction; % derived vs `dealValueUSD` |

---

## 3. Extractable from trade + drawback (TruMarket system)

### Trade (5 + CRAM PO/Coface)

| Document type | CRAM-usable fields |
|---|---|
| Commercial Invoice | Sale total, parties, RUC, corridor (noisy), incoterm, payment terms |
| Bill of Lading / AWB | Origin/destination via ports; vessel/dates **extracted, not mapped** |
| Certificate of Origin | Product, kg qty, origin |
| Packing List | Variety, boxes, quality grade |
| Phytosanitary | Destination (often wrong as export POD) |
| Purchase Order / Contract (CRAM) | Above + dealRef, advance %, purchase vs sale split |
| Coface | **Request:** country, buyer name, requested amount · **Response:** CRA & DRA (A1–A4, B, C, D), approved coverage USD, derived % |

### Drawback (11)

| Drawback type | CRAM-usable | Caution |
|---|---|---|
| Commercial Export Invoice | Sale, buyer, supplier, RUC, route, terms, product | Primary truth |
| Customs DAM | Destination; FOB → TM totalValue | **CRAM MVP does not map DAM FOB** |
| Export Packing List | Variety, qty, grade | No TM requirement slot |
| Export GRE | Origin port, dates | Dates unused by CRAM transit |
| Raw Material Purchase Invoice | `purchaseTotalUSD`, supplier, RUC | Needed for structure |
| Raw / Internal GRE | Origin, chronology dates | TM validation only |
| Maquila / materials / contract / DJ | Domestic costs/names | Must not win export economics |

Example packs in `trumarket/docs/accepted/` usually can fill sale total, destination, RUC, product/variety, purchase total when parse succeeds. Common gaps: missing DAM/GRE, Vercel empty-text on export invoice → empty buyer.

### 3.1 Coface limit notification (Gate 1)

Separate from trade PDF merge. Full mapping: [`cram-field-extraction-reference.md`](./cram-field-extraction-reference.md#coface-credit-insurance--request--response).

| Direction | Business field | Deal field |
|---|---|---|
| Request | Country | `cofaceRequestCountry` |
| Request | Buyer name | `cofaceRequestBuyerName` |
| Request | Requested coverage / deal amount | `cofaceRequestedCoverageAmountUSD` |
| Response | Country risk assessment (**CRA**, A1–D) | `cofaceCountryRiskGrade` |
| Response | Company risk assessment (**DRA**, A1–D) | `cofaceCompanyRiskGrade` |
| Response | Coverage approved amount | `cofaceCoverageAmountUSD` |

Derived: `cofaceCoveragePct` from approved amount ÷ `dealValueUSD`. Coface is **not** a counterparty-score input at all (corrected 2026-07-27) — it's spec §1 Gate 1, a pass/fail pre-check evaluated before the composite runs, kept only to drive narrative "why" text (`externalCreditBonus()` in `src/lib/scoring.ts`). `cofaceCompanyRiskGrade`/`cofaceCountryRiskGrade` *do* feed `computeBuyerScore()` via `creditRatingPoints()` — see `cram-defaults-and-formula-2026-07.md`.

---

## 4. System changes — recognize missing data per CRAM field

Today: static `fieldsNeedingConfirmation` + `docCoveragePct`. Missing: *which field needs which document*.

### 4.1 Field registry + coverage report

```ts
type CramFieldStatus = "filled" | "derived" | "defaulted" | "missing" | "provisional";

interface CramFieldSpec {
  key: string;
  dimension: "A" | "B" | "C" | "D";
  requiredForScore: "hard" | "soft" | "optional";
  sources: Array<{
    kind: "trade_pdf" | "drawback_pdf" | "mongo" | "table" | "manual" | "api";
    documentTypes?: string[];
    mongoPath?: string;
  }>;
}
```

Emit after analyze/hydrate:

```json
{
  "field": "purchaseTotalUSD",
  "status": "missing",
  "dimension": "D",
  "blocking": true,
  "expectedFrom": ["Raw Material Purchase Invoice", "Purchase Order or Contract"],
  "seenDocTypes": ["Commercial Export Invoice", "DAM"],
  "action": "upload_or_enter"
}
```

Wire into UI checklist, confidence rating, and engine `NEEDS_INPUT`.

### 4.2 Concrete changes

| # | Change | Where |
|---|---|---|
| 1 | `computeCramCoverage(deal, analysis, mongo?)` | `credit-risk-mvp/src/lib/cram-coverage.ts` (new) |
| 2 | Map missing field → expected document types (§3) | Same |
| 3 | Run drawback classifier in CRAM (or call TM analyze) | `server/` analyze |
| 4 | Map DAM FOB → `dealValueUSD` when invoice empty | `map-extracted-to-deal.ts` |
| 5 | BL shipped/ETA → override `estimatedTransitDays` | deal-builder / route |
| 6 | Persist `incoterm` on TM deal (not only description) | TM schema + mapper |
| 7 | Export-tier filter for money + supplier (not only destination/buyer) | TM merge + CRAM merge |
| 8 | Mongo aggregations for platform history | TM API + CRAM hydrate |
| 9 | Treat `Factura … MP` / materia prima as purchase | `isPurchaseDocument` |
| 10 | On `parseFailed`, return `needs_review` — no filename fake fill | Both classifiers |
| 11 | Surface `analysisTrace` gaps in CRAM UI | DocumentIngestion |
| 12 | Hard veto checklist (no insurance, invalid license) | scoring |

### 4.3 Missing → ask for

| Missing field | Upload / enter |
|---|---|
| `dealValueUSD` | Export invoice or DAM |
| `purchaseTotalUSD` | MP invoice or PO |
| `buyer.name` | Export invoice (not DAM) |
| `supplierRuc` | Export/MP invoice |
| Corridor / `incoterm` | BL, export invoice, DAM / contract |
| Terms / advance % | Sales contract / PO |
| Grade / variety / product | Packing list / export invoice |
| Counterparty history | Manual or link TM deals |
| Years / licenses | Research / manual |
| Coface request/response (if Gate 1 required) | Coface limit notification PDF |
| Coface % (if deal value unknown) | Enter deal value or manual % |
| Supplier structure tranches | Manual |

---

## 5. Unused by both CRAM and TruMarket deal model

Scanned all markdown under `trumarket/docs/` and CRAM docs. “Unused by both” = not a CRAM scoring input **and** not a top-level Mongo deal column.

### 5.1 Extracted then dropped

| Extracted field | Docs | Notes |
|---|---|---|
| `containerNumber`, `bookingNumber` | BL | — |
| `vesselName`, `voyageNumber` | BL | Spec wants freight context |
| BL/GRE shipment & ETA dates | BL, export GRE | Could override Table 2 transit |
| Phyto cert #, plant org | Phyto | Entry point sometimes misused as POD |
| Packing `temperature`, `packSize`, `brand`, `lineCount` | Packing | Banking wants temp range |
| CO cert #, authority, net kg (beyond label) | CO | — |
| DAM declaration #, related invoice # | DAM | FOB used only in TM merge |
| `currency` | Invoice | Assumed USD |
| Buyer/consignee tax id | Invoice | Rarely on Mongo |
| Invoice / document numbers | Invoice | Only inside `description` |
| `meansOfConveyance` | Phyto | Overlaps transport |

### 5.2 TruMarket-only (drawback), ignored by CRAM

| Signal | Docs |
|---|---|
| `processStage`, chronology roles, `documentDateIso` | Chronology / auto-rejection reports |
| Decision codes (`p4_missing_dam`, `x1_chronology`, código 13, refund floor) | Validation docs |
| DJ / maquila contract / packing-materials economics | Accepted packs |
| Requirement-slot completeness | `MISSING-FILES-REPORT.md` |
| Dual trade vs drawback label disagreement | file-recognition |

### 5.3 On TM platform but unused by CRAM

`transport`, ports (hint only), `presentation`/`size`, milestones, payment amounts (no delay calc), `bankaccounts`, wallet/ROI/carbon/cover image, deal `name` (user-only).

### 5.4 CRAM/banking needs — not in current extractors or packs

Import/export licenses, GLOBALG.A.P./HACCP certs, marine cargo insurance (beyond Coface), freight forwarder, BL transshipment count, customs clearance days, capacity/volume financials, temp min/max, EUDR DDS, price benchmark feed, supplier cash-flow schedule, caliber-mix mismatch (structure audit).

### 5.5 Meta docs (not deal fields)

ERD, classifier redesign notes, golden-test proposals — engineering context only.

---

## 6. Coverage snapshot

| Bucket | Approx. | Action |
|---|---|---|
| PDF-fillable CRAM cores | ~15 | Fix DAM/BL/merge |
| Mongo-wireable history | ~6 | Aggregations |
| Table-derived | ~8 | Already in MVP |
| Always manual/API | ~12 | Dynamic checklist |
| Extracted-but-unused (§5.1) | ~20 | Map transit/freight/temp or drop |
| Drawback-only signals | many | Keep in TM; optional soft confidence |

## 7. Implementation order

1. Coverage report (§4) — unlocks missing-field UX.  
2. DAM FOB + purchase detection + export-tier money merge.  
3. Persist `incoterm` + BL dates → transit.  
4. Mongo history aggregations.  
5. Optionally map vessel/temp if banking-framework parity is required.

---

*Generated 2026-07-16 from TruMarket docs scan + CRAM MVP docs/code.*
