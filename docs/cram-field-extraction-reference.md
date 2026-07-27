# CRAM deal fields ← data sources

Simple map: **which CRAM / credit-risk field comes from TruMarket MongoDB, trade PDFs, or drawback PDFs**.

This mirrors [`trumarket/docs/deal-field-extraction-reference.md`](../../trumarket/docs/deal-field-extraction-reference.md) but targets the **credit-risk MVP scoring model** (CRAM dimensions A–D + Transaction Structure), not the TruMarket Mongo `Deal` entity shape.

Three data sources feed a CRAM assessment today:

| Source | Where it lives | What it is good for |
|---|---|---|
| **TruMarket MongoDB** | `trumarket/api` — `users`, `deals`, `payments`, `bankaccounts` | Platform identity, deal snapshots, shipment corridor, amounts, raw deal/payment history *(some CRAM fields derivable but not computed yet)* |
| **Trade PDF extraction** | Shared `pdf-parse` + regex — 6 trade types + Coface | Contract terms, parties, product text, sale/purchase totals, incoterm |
| **Drawback PDF extraction** | Same regex extractor; drawback **type label** from TruMarket classifier only | Export invoice, DAM, GRE, materia prima, maquila packs — same body patterns as trade docs |

PDF **type labels** come from classifiers; **field values** always come from regex on the PDF body. When several PDFs are uploaded together, merged values prefer the **largest sale total** for `dealValueUSD`, the **smallest total** for `purchaseTotalUSD`, and the **first non-empty** text field (see [Multi-file merge](#multi-file-merge)).

**Counterparty risk fields** (years in business, license status, completion rate, payment delay, quality rejection, credit rating) are **not in MongoDB and not in trade PDFs** — they require manual confirmation, Coface upload, or Peru market-intel when `supplierRuc` is present.

---

## Master map — CRAM field × source

Legend: ✅ stored or directly mapped · ⚙️ derivable with a query (not implemented in API today) · 📄 from PDF extraction · 🔧 CRAM table lookup · ✋ manual / external API · — not available

| CRAM field | MongoDB | Trade PDF | Drawback PDF | Notes |
|---|---|---|---|---|
| **A — Counterparty** |
| `buyer.name` | ✅ `deals.buyerCompany.name`, `users.company.name` | 📄 Commercial Invoice, Contract | 📄 Commercial Export Invoice | Snapshots copied at deal create; may be stale vs user profile |
| `supplier.name` | ✅ `deals.supplierCompany.name`, `users.company.name` | 📄 Invoice, Contract, Packing List, CO | 📄 Export invoice, MP invoice, maquila | Same snapshot caveat |
| `buyer` / `supplier` country | ✅ `buyerCompany.country`, `supplierCompany.country` | 📄 Invoice consignee / destination inference | 📄 Export invoice, DAM country tokens | Mongo stores country string only |
| `supplierRuc` | ✅ `supplierCompany.taxId`, `users.company.taxId` | 📄 Invoice / contract RUC | 📄 Export invoice, MP invoice | Gates market-intel when 11-digit Peruvian RUC |
| `buyer.role` / `supplier.role` | ✅ `users.accountType` | — | — | `buyer` \| `supplier` \| `investor` |
| `priorDealsBetweenParties` | ⚙️ count `deals` by buyer+supplier id/email pair | — | — | Raw history exists; no aggregation endpoint |
| `relationshipAgeMonths` | ⚙️ earliest `deals.createdAt` / `shippingStartDate` for pair | — | — | Same — joinable, not pre-computed |
| `buyer.platformDealsCompleted` | ⚙️ count deals per `buyers.id` / email | — | — | Not computed today |
| `buyer.platformCompletionRate` | ⚙️ `finished`+`repaid` ÷ total per buyer | — | — | Not computed today |
| `supplier.platformCompletionRate` | ⚙️ same for `suppliers.*` | — | — | Not computed today |
| `buyer.avgPaymentDelayDays` | — | — | — | ✋ manual; `payments.dueDate` exists but delay not calculated |
| `supplier.qualityRejectionRatePct` | — | — | — | ✋ manual |
| `buyer.yearsInBusiness` | — | — | — | ✋ manual or market-intel SUNAT |
| `supplier.yearsInBusiness` | — | — | — | ✋ manual or market-intel SUNAT |
| `buyer.licenseValid` / `supplier.licenseValid` | — | — | — | ✋ default valid; no KYC field in Mongo |
| **Coface (credit insurance PDF)** | — | 📄 Coface PDF only | — | See [Coface request & response](#coface-credit-insurance--request--response) |
| `cofaceCoverageAmountUSD` / `cofaceCoveragePct` | — | 📄 approved limit + ✋/derived % | — | % derived from approved ÷ `dealValueUSD` when both known |
| `cofaceRequestCountry`, `cofaceRequestBuyerName`, `cofaceRequestedCoverageAmountUSD` | — | 📄 Coface request lines | — | Fallback: deal `buyer` country/name if PDF silent |
| `cofaceCountryRiskGrade`, `cofaceCompanyRiskGrade` | — | 📄 Coface response (CRA / DRA) | — | Grades **A1, A2, A3, A4, B, C, D**; stored on deal; not in numeric CRAM score yet |
| `externalCreditSignal` | — | 📄 Coface PDF | — | Legacy string; scoring prefers `cofaceCoveragePct` bands |
| `marketIntel.*` | — | — | — | ✋ external API from `supplierRuc` |
| **B — Product** |
| `product` | ⚙️ infer from `deals.description` / `variety` | 📄 Contract, Invoice, CO, Packing List | 📄 Export invoice, MP invoice, packing list | No dedicated `product` column in Mongo |
| `variety` | ✅ `deals.variety` | 📄 Contract, Packing List | 📄 Export Packing List | — |
| `quantityLabel` | ⚙️ `deals.quantity` + `presentation` | 📄 Contract kg/boxes, Packing List, CO | 📄 Export Packing List | Mongo has numeric `quantity`, not formatted label |
| `qualityGrade` | ⚙️ `deals.quality` *(TM grade, not CAT I/II)* | 📄 Packing List CAT I/II | 📄 Export Packing List | Needs mapping TM quality → CRAM grade enum |
| `perishabilityClass` etc. | 🔧 from `product` | 🔧 from extracted `product` | 🔧 from extracted `product` | CRAM Table 1 — not stored in Mongo |
| **C — Route** |
| `origin` | ✅ `deals.origin` | 📄 Invoice, BL, CO, Packing List, Phyto | 📄 Export invoice, MP invoice, GRE | Often filled from PDF at deal create |
| `destination` | ✅ `deals.destination` | 📄 Invoice, BL, Phyto, Contract | 📄 Export invoice, DAM | Same |
| `portOfOrigin` / `portOfDestination` | ✅ `deals.portOfOrigin`, `portOfDestination` | 📄 BL, Invoice | 📄 Export invoice, GRE, DAM | Not CRAM deal fields but useful for corridor |
| `incoterm` | — *(in `description` string only)* | 📄 Contract, Invoice | 📄 Export invoice | Not a top-level Mongo column ([TruMarket §26](../../trumarket/docs/file-recognition-and-analysis.md)) |
| `estimatedTransitDays` | 🔧 from origin+destination | 🔧 from origin+destination | 🔧 from origin+destination | CRAM Table 2 — BL/GRE dates not used |
| `routeRiskFlag` etc. | 🔧 Tables 2–3 | 🔧 Tables 2–3 | 🔧 Tables 2–3 | — |
| **D — Structure** |
| `dealValueUSD` | ✅ `totalValue` *(qty × unit price)* or `investmentAmount` | 📄 Invoice / sales contract total | 📄 Commercial Export Invoice, DAM FOB *(TruMarket only)* | credit-risk-mvp does not map DAM FOB |
| `purchaseTotalUSD` | — | 📄 Purchase order / acuerdo de compra | 📄 Raw Material Purchase Invoice | Not stored on Mongo deal |
| `paymentTerms` | — | 📄 Contract, Invoice | 📄 Export invoice | Not in Mongo |
| `advancePaymentPct` | — | 📄 Contract `Adelanto PO X%` | — | Not in Mongo |
| `transactionStructure.*` | — | ⚙️ partial from `paymentTerms` text | ⚙️ partial from export invoice terms | Cash-flow schedule mostly ✋ manual |
| `contractType` | — | — | — | ✋ default Spot |
| `collateralType` / `insuranceCoverage` | — | ✋ defaults | — | ✋ Coface presence may inform insurance narrative; not auto-set from PDF |

---

## CRAM scoring dimensions — by source

| CRAM dimension | Weight | Primary deal fields | MongoDB | Trade / drawback PDFs |
|---|---|---|---|---|
| **A — Counterparty** | 35% | `buyer.*`, `supplier.*`, relationship, Coface | **Partial** — names, countries, taxId, role; history ⚙️ derivable | **Partial** — names + RUC; Coface PDF |
| **B — Product** | 20% | `product`, `qualityGrade` → Table 1 | **Partial** — variety, quality, description | **Partial** — product, variety, grade |
| **C — Route** | 15% | `origin`, `destination`, `incoterm` → Tables 2–3 | **Partial** — origin, destination, ports *(no incoterm column)* | **Partial** — origin, destination, incoterm |
| **D — Transaction structure** | 30% | totals, payment terms, cash-flow schedule | **Partial** — sale total only | **Partial** — sale + purchase totals, payment text |

---

## TruMarket MongoDB — collections & CRAM mapping

Schemas: `trumarket/api/src/infra/database/users.model.ts`, `deals.model.ts`, `payments.model.ts`, `bank-accounts.model.ts`.

There is **no** separate `Company`, `Buyer`, `Supplier`, or `KYC` collection. Counterparty identity is embedded on `users` and denormalized onto each `deal`.

### `users` collection

| Mongo field | Type | CRAM field(s) | Status |
|---|---|---|---|
| `email` | string | *(contact / join key)* | ✅ stored |
| `accountType` | `buyer` \| `supplier` \| `investor` | `buyer.role` / `supplier.role` | ✅ stored |
| `walletAddress` | string | — | not used in CRAM |
| `company.name` | string | `buyer.name` / `supplier.name` | ✅ if profile filled |
| `company.country` | string | party country | ✅ |
| `company.taxId` | string | `supplierRuc` *(when supplier)* | ✅ partial — may not be 11-digit RUC |

### `deals` collection — counterparty & shipment

| Mongo field | Type | CRAM field(s) | Status |
|---|---|---|---|
| `buyerCompany.name` | string | `buyer.name` | ✅ snapshot at deal create |
| `buyerCompany.country` | string | buyer country | ✅ |
| `buyerCompany.taxId` | string | buyer tax id | ✅ rarely populated |
| `supplierCompany.name` | string | `supplier.name` | ✅ |
| `supplierCompany.country` | string | supplier country | ✅ |
| `supplierCompany.taxId` | string | `supplierRuc` | ✅ |
| `buyers[]` | `{ id, email, walletAddress }` | join for ⚙️ history stats | ✅ |
| `suppliers[]` | same | join for ⚙️ history stats | ✅ |
| `origin` | string | `origin` | ✅ often PDF-sourced at create |
| `destination` | string | `destination` | ✅ |
| `portOfOrigin` / `portOfDestination` | string | corridor hint | ✅ not direct CRAM input |
| `transport` | string | — | `sea_freight` default; not mapped to CRAM |
| `variety` | string | `variety` | ✅ |
| `quality` | string | `qualityGrade` *(needs mapping)* | ✅ |
| `description` | string | ⚙️ `product` inference | ✅ |
| `quantity` | number | ⚙️ `quantityLabel` | ✅ |
| `offerUnitPrice` | number | ⚙️ unit economics | ✅ |
| `totalValue` | computed | `dealValueUSD` | ✅ `quantity × offerUnitPrice` |
| `investmentAmount` | number | `dealValueUSD` alt | ✅ |
| `shippingStartDate` / `expectedShippingEndDate` | date | — *(not CRAM transit input today)* | ✅ stored |
| `status` | `proposal` \| `confirmed` \| `finished` \| `repaid` | ⚙️ completion rate | ✅ per deal |
| `milestones[]` | subdocs | — | milestone dates not mapped to payment delay |

### `payments` collection

| Mongo field | Type | CRAM field(s) | Status |
|---|---|---|---|
| `dealId` | string | join to deal | ✅ |
| `buyerId` / `supplierId` | string | join for counterparty history | ✅ |
| `amount` | number | — | not mapped to structure tranches |
| `dueDate` | date | ⚙️ payment timing | ✅ stored; **avg delay not computed** |
| `status` | enum | ⚙️ payment behaviour | ✅ |
| `paymentDocuments[]` | files | re-extract via PDF pipeline | metadata only in Mongo |

### `bankaccounts` collection

| Mongo field | CRAM relevance | Status |
|---|---|---|
| `userId`, `countryCode`, `bankName`, `accountHolderName`, `status` | KYC-adjacent; **not wired to CRAM scoring** | ✅ stored, unused by credit-risk-mvp |

### ⚙️ Derivable from Mongo but not computed today

These CRAM counterparty inputs **could** be built from existing collections but **no API endpoint or aggregation** produces them yet:

```
priorDealsBetweenParties  = COUNT(deals WHERE buyer∩supplier pair match, status IN finished/repaid/…)
relationshipAgeMonths     = MONTHS_BETWEEN(NOW, MIN(deals.createdAt) for pair)
platformDealsCompleted    = COUNT(deals for user)
platformCompletionRate    = COUNT(status IN finished, repaid) / COUNT(all) × 100
avgPaymentDelayDays       = AVG(actualPayDate − dueDate) from payments  ← actual pay date not stored
```

Until those queries exist, credit-risk-mvp leaves these fields `null` / `0` and relies on manual confirmation or market-intel Dim D.3.

### ❌ Not in MongoDB at all

| CRAM field | Alternative source |
|---|---|
| `incoterm` | Trade / export PDF |
| `paymentTerms`, `advancePaymentPct` | Contract / export PDF |
| `purchaseTotalUSD` | Purchase order / MP invoice PDF |
| `buyer.yearsInBusiness`, licenses, credit rating | Manual / Coface grades / market-intel |
| Coface flat fields (`cofaceCoverageAmountUSD`, request/response grades) | Coface PDF upload + document ingestion |
| `transactionStructure.supAdv*`, `supFin*`, `dealPurpose` | Manual confirmation |
| `marketIntel.*` | Peru customs API |

---

## Extractable suggestion fields (`DealFieldSuggestions`)

These are the fields the analyzer returns today (`src/lib/document-analysis/types.ts` → `server/map-extracted-to-deal.ts`).

| Suggestion field | Maps to CRAM deal field | MongoDB | Trade document type(s) | Drawback document type(s) *(same extractor)* |
|---|---|---|---|---|
| `dealRef` | `dealRef` | — | Purchase Order or Contract | Commercial Export Invoice *(order/ref in contract section)* |
| `product` | `product` → Table 1 | ⚙️ `deals.description` / `variety` | Purchase Order or Contract, Commercial Invoice, Certificate of Origin, Packing List | Commercial Export Invoice, Export Packing List, Raw Material Purchase Invoice |
| `variety` | `variety` | ✅ `deals.variety` | Purchase Order or Contract, Packing List | Export Packing List |
| `quantityLabel` | `quantityLabel` | ⚙️ `deals.quantity` + `presentation` | Purchase Order or Contract *(kg/boxes)*, Packing List, Certificate of Origin *(weight)* | Export Packing List |
| `dealValueUSD` | `dealValueUSD`, `transactionStructure.saleTotalUSD` | ✅ `deals.totalValue` / `investmentAmount` | Commercial Invoice, Purchase Order or Contract *(sales agreement only)* | Commercial Export Invoice |
| `purchaseTotalUSD` | `transactionStructure.purchaseTotalUSD` | — | Purchase Order or Contract *(purchase order / acuerdo de compra)* | Raw Material Purchase Invoice, Processing or Maquila Invoice *(low priority)* |
| `supplierRuc` | `supplierRuc` → market-intel Dim A | ✅ `supplierCompany.taxId`, `users.company.taxId` | Commercial Invoice, Purchase Order or Contract | Commercial Export Invoice, Raw Material Purchase Invoice |
| `origin` | `origin` → Table 2 corridor | ✅ `deals.origin` | Commercial Invoice, Bill of Lading, Certificate of Origin, Packing List, Phytosanitary | Commercial Export Invoice, Raw Material Purchase Invoice, Raw Material Transport Guide |
| `destination` | `destination` → Table 2 + Table 3 pair override | ✅ `deals.destination` | Commercial Invoice, Bill of Lading, Phytosanitary, Purchase Order or Contract *(discharge port)* | Commercial Export Invoice, Customs Declaration *(DAM text in PDF)* |
| `incoterm` | `incoterm` → route adjustment | — | Commercial Invoice, Purchase Order or Contract | Commercial Export Invoice |
| `buyerName` | `buyer.name` | ✅ `buyerCompany.name` | Commercial Invoice, Purchase Order or Contract | Commercial Export Invoice |
| `supplierName` | `supplier.name` | ✅ `supplierCompany.name` | Commercial Invoice, Packing List, Certificate of Origin, Purchase Order or Contract | Commercial Export Invoice, Raw Material Purchase Invoice, Processing or Maquila Invoice |
| `paymentTerms` | `paymentTerms` → structure Sub-A inference | — | Purchase Order or Contract, Commercial Invoice | Commercial Export Invoice |
| `advancePaymentPct` | `advancePaymentPct`, structure advance pts | — | Purchase Order or Contract *(Adelanto PO X%)* | *(rare — contract section only)* |
| `qualityGrade` | `qualityGrade` → product adjustment | ⚙️ `deals.quality` | Packing List *(CAT I / CAT II)* | Export Packing List |

---

## Trade document types (6 + Coface)

Used in credit-risk-mvp `POST /api/analyze-documents`. Classifier: `server/pdf-trade-classifier/classifier.ts`.

| Document type | Internal label | CRAM fields it typically provides |
|---|---|---|
| **Purchase Order or Contract** | `purchase_order` or `contract` *(filename: orden/acuerdo/contrato)* | `dealRef`, `buyerName`, `supplierName`, `supplierRuc`, `product`, `variety`, `quantityLabel`, `origin`, `destination`, `incoterm`, `paymentTerms`, `advancePaymentPct`; **`purchaseTotalUSD`** if purchase doc; **`dealValueUSD`** if sales agreement |
| **Commercial Invoice** | `sales_order` | `dealValueUSD`, `buyerName`, `supplierName`, `supplierRuc`, `origin`, `destination`, `incoterm`, `paymentTerms` |
| **Bill of Lading or AWB** | `contract` *(default)* | `origin`, `destination` *(via port → country inference)*; BL dates extracted but **not mapped** to CRAM deal fields today |
| **Certificate of Origin** | `contract` | `product` *(goods description)*, `quantityLabel` *(gross kg)*, `origin` |
| **Packing List** | `contract` | `variety`, `quantityLabel` *(boxes)*, `qualityGrade` *(CAT I → Grade A / Class I)* |
| **Phytosanitary Certificate** | `contract` | `destination` *(declared point of entry)* |
| **Coface limit notification** | `credit_insurance` | Request + response fields — see [Coface request & response](#coface-credit-insurance--request--response) |
| **Unknown / Parse error** | — | *(nothing reliable)* |

### Purchase vs sales split

The mapper treats a file as a **purchase document** when:

- Classified type is purchase/contract **and** filename or header matches `orden de compra`, `purchase order`, or `acuerdo de compra`
- **Not** a sales agreement (`acuerdo de ventas`, TRU MARKET as `Vendedor`)

| Document role | Total field | Example from TruMarket docs |
|---|---|---|
| Purchase | `purchaseTotalUSD` | `Factura Materia prima.pdf`, `Factura venta de MP Israel 4.pdf` |
| Sale / export | `dealValueUSD` | `Factura de venta de exportacion Israel 3.pdf`, `Factura venta exportacion.pdf` |

When both exist, merge assigns **max → sale**, **min → purchase** (see `server/merge-suggestions.ts`).

---

## Drawback document types (11) — TruMarket example packs

Drawback types come from the Peru drawback classifier in **TruMarket** (`trumarket/api`). credit-risk-mvp does **not** run that classifier, but the **same regex extractor** runs on every PDF body. Example filenames from `trumarket/docs/accepted/` (Israel 3/4/6/10, Exportación 9).

| Drawback document type | Example filename(s) | CRAM fields it typically provides |
|---|---|---|
| **Commercial Export Invoice** | `Factura de venta de exportacion Israel 3.pdf`, `Factura venta exportacion.pdf` | `dealValueUSD`, `buyerName`, `supplierName`, `supplierRuc`, `origin`, `destination`, `incoterm`, `paymentTerms`, `product` |
| **Export Packing List** | *(in packs but no dedicated slot — e.g. packing list PDFs)* | `variety`, `quantityLabel`, `qualityGrade` |
| **Customs Declaration (DAM/DUA)** | `DAM-063040.pdf`, `DAM-078917.pdf` | `destination` *(country tokens: ISRAEL, etc. in common section)*; FOB **not mapped** in credit-risk-mvp *(TruMarket maps `customsFob` → `totalValue`)* |
| **Export Transport Document (GRE)** | `Guia de remision de exportacion Israel 3.pdf`, `Guia de remision ISRAEL 4.pdf` | `origin` *(CALLAO)*; shipping dates extracted but **not mapped** to CRAM deal |
| **Raw Material Purchase Invoice** | `Factura Materia prima.pdf`, `Factura venta de MP Israel 4.pdf` | `purchaseTotalUSD`, `supplierName`, `supplierRuc`, `origin`, `product` |
| **Raw Material Transport Guide** | `Guia de remision MP Israel 4.pdf`, `Guia de remision Materia prim…` | `origin`, `shippingStartDate` *(TruMarket only — not CRAM deal field)* |
| **Processing or Maquila Invoice** | `Factura de maquila Israel 3.pdf`, `FACTURA MAQUILA.pdf` | `supplierName`; total may wrongly compete for `dealValueUSD` if classified as Commercial Invoice |
| **Packing Materials Invoice** | `Etiquetas caja .pdf`, `Factura de clamshells y cajas…` | *(none for CRAM scoring — packaging cost only)* |
| **Packaging or Maquila Contract** | `Contrato de maquila.pdf`, `CONTRATO DE MAQUILA.pdf` | `supplierName` *(party blocks)*; rarely product/terms |
| **Internal Plant Transport Guide** | `Guia de remision materiales.pdf` | *(none for CRAM scoring today)* |
| **Sworn Declaration (DJ)** | `DJ de etiquetas (1).pdf`, `DECLARACION JURADA.pdf` | *(none for CRAM scoring)* |
| **Unknown** | Scanned / unreadable PDF | *(empty suggestions, low confidence)* |

---

## Full CRAM deal model — extraction status

All fields on `Deal` (`src/types.ts`) grouped by whether documents can populate them.

### Directly extractable from trade PDFs

| Deal field | Source |
|---|---|
| `dealRef` | Contract `orderNumber` / `TM-YYYY-NNN` |
| `product` | Contract, invoice, CO, packing → `inferProductFromText()` → CRAM Table 1 |
| `variety` | Contract, packing list |
| `quantityLabel` | Contract kg/boxes, packing list, CO weight |
| `dealValueUSD` | Contract total / invoice total *(non-purchase docs)* |
| `origin` | Location/port inference → country |
| `destination` | Discharge port, consignee country, BL/phyto ports |
| `incoterm` | Contract / common section |
| `buyer.name` | Contract buyer / consignee |
| `supplier.name` | Contract supplier / exporter |
| `supplierRuc` | Contract `supplierTaxId` / `exporterTaxId` *(11-digit RUC)* |
| `paymentTerms` | Contract formatted terms / invoice |
| `advancePaymentPct` | Contract `Adelanto PO X%` |
| `qualityGrade` | Packing list `CAT I` / `CAT II` mapping |

### Coface credit insurance — request & response

Coface limit notifications are parsed separately (`POST /api/analyze-coface`, `server/coface-extraction.ts`). The product distinguishes **what was requested** on the application from **what Coface approved** on the decision.

#### Coface product terminology (portal & PDFs)

Coface’s **risk management** workspace labels assessments as follows (see Coface UI tooltips):

| Coface label | Meaning | CRAM deal field | Grade scale |
|---|---|---|---|
| **CRA** | **Country Risk Assessment** — payment behaviour context for the buyer’s country, from economic/financial prospects, political environment, and business environment | `cofaceCountryRiskGrade` | **A1, A2, A3, A4, B, C, D** (excellent → very bad) |
| **DRA** | **Debtor / company risk assessment** (company-level rating on the same buyer file) | `cofaceCompanyRiskGrade` | **A1, A2, A3, A4, B, C, D** |

Product briefs sometimes summarize these as “A to D”; in Coface the **A band is subdivided (A1–A4)**. The MVP stores the full token when extraction finds it (e.g. `A2 CRA` on a Taiwan buyer).

**Identity block (Coface portal — optional for CRAM today):** legal name, registered address, **Trade register number**, **EasyNumber** (`0001086054022`-style). These reinforce KYC / buyer matching but are **not** separate scored CRAM variables yet; PDF notifications may include `Debtor:` and country only. Future: map register / EasyNumber if they appear on limit letters.

#### Request vs response mapping

| Coface concept | Request / response | Deal field | PDF / extraction hint |
|---|---|---|---|
| Country | **Request** | `cofaceRequestCountry` | `Country:`, `Debtor country:`, `Country of risk:`; else deal `buyer` country |
| Buyer name | **Request** | `cofaceRequestBuyerName` | `Debtor:` line; may pre-fill `buyer.name` on analyze |
| Requested coverage / deal amount | **Request** | `cofaceRequestedCoverageAmountUSD` | `You requested: USD/EUR …` |
| Country risk assessment (**CRA**) | **Response** | `cofaceCountryRiskGrade` | `CRA`, `Country risk assessment: A1`–`D` |
| Company / debtor risk assessment (**DRA**) | **Response** | `cofaceCompanyRiskGrade` | `DRA`, `Company risk assessment: A1`–`D` |
| Coverage approved amount | **Response** | `cofaceCoverageAmountUSD` | `Guaranteed Amount: USD/EUR …` |
| Coverage vs deal size | **Response** (derived) | `cofaceCoveragePct` | `min(100, round(approved USD ÷ dealValueUSD × 100))` when deal value > 0; else manual |

**Also extracted (metadata):** `decisionDate`, `notificationNumber` — available on `CofaceExtractionResult`; optional future persistence on `Deal`.

**Scoring (dimension A — external credit bonus):** uses `cofaceCoveragePct` (+4 / +8 / +12 for >0 / ≥50% / ≥80%) or fallback +8 when `externalCreditSignal` / `buyer.creditRating` is set. **CRA / DRA grades (A1–D) are not point-mapped in the MVP** — use for scorecard narrative, Gate 1 review, and future calibration (e.g. veto or adjustment if grade is **C** or **D**).

**Upload:** filename stored via `sourceDocuments` (`type: credit_insurance`).

### Extractable from Coface PDF only (flat deal fields)

| Deal field | Source |
|---|---|
| `cofaceCoverageAmountUSD` | Response — `Guaranteed Amount:` |
| `cofaceRequestedCoverageAmountUSD` | Request — `You requested:` |
| `cofaceRequestCountry` | Request — country tokens on notification |
| `cofaceRequestBuyerName` | Request — `Debtor:` |
| `cofaceCountryRiskGrade` | Response — CRA (A1–A4, B, C, D) |
| `cofaceCompanyRiskGrade` | Response — DRA / company (A1–A4, B, C, D) |
| `cofaceCoveragePct` | Derived from approved amount ÷ `dealValueUSD`, or manual override in UI |
| `externalCreditSignal` | Optional legacy string from extraction hint |

Deprecated in docs (removed from model): nested `cofaceCoverage.*`, auto-setting `insuranceCoverage` / `buyer.creditRating` from every Coface upload.

### Derived from CRAM reference tables (not in PDF text)

| Deal field | Derivation |
|---|---|
| `perishabilityClass` | CRAM Table 1 from `product` |
| `shelfLifeDays` | CRAM Table 1 max shelf life |
| `coldChainRequired` | `true` unless Non-Perishable |
| `productCategory` | Fresh Produce vs Processed from perishability |
| `estimatedTransitDays` | CRAM Table 2 corridor `origin → destination` |
| `numberOfTransshipments` | Table 2 `directService` + transit heuristic |
| `routeRiskFlag` | Table 3 pair override → Table 2 default → 35-day rule |
| `routeRiskResolution.*` | Resolution metadata from above |

### Partially inferred from extracted text + defaults

| Deal field | Inference |
|---|---|
| `transactionStructure.saleTotalUSD` | `dealValueUSD` |
| `transactionStructure.purchaseTotalUSD` | `purchaseTotalUSD` suggestion |
| `transactionStructure.buyFirstDay/Pct`, `buyFinalDay/Pct` | Parsed from `paymentTerms` % + transit *(best-effort)* |
| `transactionStructure.dealPurpose` | Default `Export` when user confirms; not in PDFs |
| `transactionStructure.tmProductOwnership` | Default `true` |
| `transactionStructure.collectionRights` | Default `true` |
| `contractType` | Default `Spot` |
| `collateralType` / `collateralValueUSD` | Default `None` / `0` |
| `buyer.licenseValid` / `supplier.licenseValid` | Default `true` until user corrects |

### Manual confirmation only (scoring-critical)

| Deal field | CRAM dimension | Notes |
|---|---|---|
| `buyer.yearsInBusiness` | A | Per handoff doc: online research or manual |
| `buyer.platformCompletionRate` | A | TM platform history — not in PDFs |
| `buyer.avgPaymentDelayDays` | A | Buyer track record |
| `supplier.yearsInBusiness` | A | Manual or SUNAT via market-intel |
| `supplier.platformCompletionRate` | A | TM platform history |
| `supplier.qualityRejectionRatePct` | A | Supplier track record |
| `priorDealsBetweenParties` | A | TM history or market-intel Dim D.3 |
| `relationshipAgeMonths` | A | TM history or market-intel Dim D.3 |
| `transactionStructure.supAdvDay/Pct` | D | Supplier payment schedule |
| `transactionStructure.supFinDay/Pct` | D | Supplier final tranche |
| `transactionStructure.dealPurpose` | D | Export / Retail / Processing / Resale |

### External API (not document extraction)

| Deal field | Source |
|---|---|
| `marketIntel.*` | Peru customs + SUNAT when `supplierRuc` resolves (`api/market-intel-rate.py`) |

---

## Example pack coverage (TruMarket accepted docs)

What a typical **Israel blueberry/mandarin drawback pack** can auto-fill for CRAM vs what Mongo already holds vs what still needs manual input. Based on `trumarket/docs/accepted/MISSING-FILES-REPORT.md`.

| CRAM field group | MongoDB *(existing TM deal)* | Trade / drawback PDFs | Typical gap |
|---|---|---|---|
| Sale total + buyer + destination | ✅ if deal created via wizard *(totalValue, buyerCompany, destination)* | Export invoice + DAM text | Buyer missing if export invoice parse fails on Vercel |
| Purchase total | — | Raw material invoice | Structure Sub-D needs purchase total |
| Product + variety | ⚙️ variety only; product from description | Export invoice / packing | `product` needs inference or PDF |
| Origin / destination corridor | ✅ after PDF apply at create | Export invoice + GRE + DAM | Israel → Table 2 High flag |
| Supplier RUC | ✅ if profile / snapshot has taxId | Export invoice | Gates market-intel |
| Payment terms + advance % | — | Contract / export invoice | Structure tranches need confirm |
| Counterparty history | ⚙️ raw deals/payments exist | — | Aggregates not built — manual / market-intel |
| Coface coverage (approved + request + CRA/DRA grades) | — | Coface PDF only | Separate upload; see § Coface |

---

## Multi-file merge

**File:** `server/merge-suggestions.ts`

| Field | Rule |
|---|---|
| `dealValueUSD` | **Largest** positive total across non-purchase docs |
| `purchaseTotalUSD` | **Smallest** positive total; if two totals exist, min → purchase, max → sale |
| `advancePaymentPct` | First non-null across files |
| All other keys | First non-empty across files *(sorted by filename)* |

**Instability (same as TruMarket):** a domestic maquila or materia-prima invoice with a larger number than the export FOB can win `dealValueUSD` if misclassified as Commercial Invoice.

---

## Fields not available from any automated source

| CRAM field | MongoDB | PDFs | Fallback |
|---|---|---|---|
| `id` | generated at assessment create | — | — |
| `buyer.yearsInBusiness`, `supplier.yearsInBusiness` | — | — | ✋ manual / market-intel SUNAT |
| `buyer.platformCompletionRate`, `supplier.platformCompletionRate` | ⚙️ derivable | — | ✋ not computed — manual confirm |
| `buyer.avgPaymentDelayDays`, `supplier.qualityRejectionRatePct` | — | — | ✋ manual |
| `buyer.licenseValid`, `supplier.licenseValid` | — | — | ✋ default valid |
| `priorDealsBetweenParties`, `relationshipAgeMonths` | ⚙️ derivable | — | ✋ manual / market-intel Dim D.3 |
| `cofaceCoveragePct` | — | — | ✋ manual override if deal value unknown |
| `incoterm`, `paymentTerms`, `advancePaymentPct` | — | 📄 trade/export only | not persisted on Mongo deal |
| `purchaseTotalUSD` | — | 📄 purchase / MP invoice | — |
| `contractType`, `collateralType`, `collateralValueUSD` | — | — | ✋ defaults |
| `transactionStructure.supAdv*`, `supFin*`, `dealPurpose` | — | — | ✋ manual |
| `marketIntel.*` | — | — | ✋ Peru customs API |
| `teaser`, `fieldsNeedingConfirmation` | — | — | UI metadata |

---

## Confidence & coverage

`docCoveragePct` (`merge-suggestions.ts`) weights extractable fields:

| Field | Weight |
|---|---|
| `dealValueUSD` | 15 |
| `buyerName`, `supplierName` | 12 each |
| `product` | 12 |
| `origin`, `destination` | 10 each |
| `purchaseTotalUSD` | 10 |
| `paymentTerms` | 10 |
| `variety` | 8 |
| `incoterm` | 8 |
| `quantityLabel` | 8 |
| `qualityGrade` | 5 |

Score is capped 35–95%. Low coverage → lower **confidence rating** on the risk dashboard (separate from numeric CRAM score).

---

## Logic gaps (short)

| Issue | What happens |
|---|---|
| No DAM section in credit-risk-mvp | FOB from DAM not mapped to `dealValueUSD`; destination country may still appear via common regex |
| BL / GRE dates extracted but not mapped | `estimatedTransitDays` comes from CRAM Table 2, not actual shipment dates |
| Drawback PDFs classified as trade types | Maquila invoice may become `Commercial Invoice` → wrong total merge |
| `dealValueUSD` merge uses **max across all files** | Maquila or purchase invoice can beat export FOB |
| Purchase detection relies on filename/header | `Factura venta de MP` may be mis-tagged as sale |
| Scanned PDFs | All fields empty; `requiresOcr: true`, structure scores neutral 50 |
| Counterparty fields never from PDFs | High CRAM score possible with empty buyer/supplier history |
| Coface % | Derived from approved ÷ `dealValueUSD` when both known; else manual in UI |
| Mongo history not wired to CRAM | `deals` / `payments` exist but completion rate, prior deals, payment delay not aggregated |
| Deal company snapshots stale | `buyerCompany` / `supplierCompany` copied at create — may differ from current `users.company` |
| Incoterm on Mongo deal | Extracted into `description` at upload but **not** a queryable column |

---

## Recommended pre-fill order (integration)

When wiring TruMarket → credit-risk-mvp for an existing deal:

1. **Mongo deal record** — parties, corridor, variety, quality, sale total *(fast, always available if deal exists)*
2. **Re-analyze attached PDFs** — incoterm, payment terms, purchase total, product text, Coface docs on file
3. **⚙️ Mongo aggregations** *(future)* — prior deals, completion rate, relationship age for known buyer/supplier pair
4. **Market-intel API** — if `supplierRuc` resolves from Mongo or PDF
5. **Manual confirmation** — remaining counterparty + structure fields

---

## Related docs

| Document | Role |
|---|---|
| [`trumarket/docs/deal-field-extraction-reference.md`](../../trumarket/docs/deal-field-extraction-reference.md) | TruMarket Mongo deal field ← PDF mapping |
| [`trumarket/docs/file-recognition-and-analysis.md`](../../trumarket/docs/file-recognition-and-analysis.md) | Classifier keywords, regex patterns, merge rules |
| [`trumarket/docs/accepted/MISSING-FILES-REPORT.md`](../../trumarket/docs/accepted/MISSING-FILES-REPORT.md) | Example drawback pack inventories |
| [`docs/risk-calculation.md`](./risk-calculation.md) | CRAM scoring equations |
| [`tool-summary-handoff-2026-07-09.md`](file:///Users/tasneem-admin/Desktop/tool-summary-handoff-2026-07-09.md) | Product workflow: extract → research → confirm → score |

---

*Last updated: 2026-07-16. PDF analyzer: credit-risk-mvp `server/pdf-trade-classifier/` (shared lineage with TruMarket `drawback-extract-v4`). Coface: `server/coface-extraction.ts`. Mongo schemas: `trumarket/api/src/infra/database/`.*