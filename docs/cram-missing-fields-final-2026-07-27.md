# CRAM missing-fields report — final, grounded in ERD v4 (2026-07-27)

Consolidates everything found this session: the ERD v4 field-gap audit, the
tax ID / RUC completeness check, and a cross-reference against `trumarket`'s
actual document-extraction pipeline (which of these gaps already have real
extracted data sitting unused, vs. which need genuinely new extraction work).

Scope: of the **170 rows** in `full-deals-dataset-2026-07 (1).csv` (still the
most recent full dataset as of this writing), **86 are `likely_test`**
synthetic rows excluded from CRAM by design — everything below is scoped to
the **84 real deals** and **19 companies** in `company-master.json`.

ERD reference: `docs/trumarket-database-erd-v4.drawio` — the current target
schema for the TruMarket production database (`trumarket` repo), which this
CSV-driven MVP does not write to, only reads alongside.

---

## Priority 0 — already fixed this session

| Item | Status |
|---|---|
| 84/84 real deals forced to "Veto" tier (no cargo-insurance data) | Admin correction UI shipped (`CargoInsuranceSection.tsx`) — preview + CSV export, not auto-fixed |
| RUC/YIB completeness invisible | Admin correction UI shipped (`CompanyTaxIdSection.tsx`) — both fields directly editable, live badge preview |
| Buyer/supplier capacity + supplier license validity | Wired to real Peru customs/SUNAT data (`market-intel`) — mechanically complete, capacity still blocked by the quantity-unit gap below |

## Priority 1 — cheapest wins: data already extracted in `trumarket`, currently discarded before persistence

These aren't extraction problems — the values are already computed at
document-analysis time and thrown away before reaching the `Deal` schema.
Closing these is a persistence fix, not new extraction logic.

| Field | CRAM dimension | Where it's extracted today | What happens to it |
|---|---|---|---|
| **Volume (kg)** | A (40%) — unblocks buyer/supplier capacity | `netWeightKg`/`grossWeightKg`, `CertificateOfOriginFields` (`extraction.ts:62-63`) | Extracted, never mapped to any `Deal` field — only unit *count* (`quantity`) survives. This is the exact gap blocking `market-intel`'s `capacity_check` in credit-risk-mvp today (0/84 deals have a usable value because `deal_kg` can never be computed) |
| **Cold-chain temperature** | C (20%) + veto | `SENSOR ±NN°C` regex, `extraction.ts:951` | Extracted, then explicitly excluded from being misread as "presentation" — never persisted, never compared against the product's required cold-chain range |
| **Payment terms** | D (15%) | `InvoiceFields.paymentTerms` | Extracted, zero references anywhere in `deals.entities.ts` or the suggestion mapper — fully discarded |
| **Incoterm** | C (20%) | `CommonExtractedFields.incoterm` | Extracted, but only concatenated into a free-text `description` string (`map-extracted-fields-to-deal-suggestions.ts:302`) — never a structured, queryable field |

## Priority 2 — needs new extraction logic (not currently captured by any document type)

| Field | CRAM dimension | Notes |
|---|---|---|
| **HS codes** | C (20%) | Zero extraction anywhere in `trumarket`; appears once in a test fixture string, never parsed. BL/Invoice can carry multiple codes for mixed cargo — needs an array, not a scalar |
| **Customs clearance days** | C (20%, 5%wt) | No entry/release-date extraction anywhere; `Customs.shipmentDate` (ERD v4) is the only date captured |
| **Transshipments** | C (20%) + veto | `vesselName`/`voyageNumber` are captured per-BL, but nothing counts legs or flags multiple vessels per shipment |
| **Quality certifications** | A (40%) | GLOBALG.A.P./HACCP-style certs are not extracted anywhere — "Certificate of Origin" and "Phytosanitary Certificate" are compliance documents, not the voluntary quality-management certifications the spec variable means. Also absent from ERD v4 entirely (no field on `companies`, `Counterparty`, or `Product`) |

## Priority 3 — needs a new document-ingestion path entirely

| Field | Notes |
|---|---|
| **Cargo insurance** | No "Insurance Certificate" document type exists in `trumarket`'s 5-type classifier (Invoice / BL-AWB / Certificate of Origin / Packing List / Phytosanitary). Someone would need to build a new classifier + extractor — this isn't a persistence fix like Priority 1. Currently hardcoded `"None"` in `platform-deal-mapper.ts`, which is *why* 84/84 real deals are vetoed |
| **Buyer credit rating (Coface)** | Correctly out of scope for document extraction — Coface is buyer-default credit insurance, unrelated to trade/shipping documents. A separate pipeline already exists (`credit-risk-mvp/src/lib/coface-analysis/`) and works the moment a real Coface document is uploaded per deal — 0/84 real deals have one on file today |

## Priority 4 — data-quality / identity fixes (not extraction — reconciliation of what's already captured)

| Item | Current state |
|---|---|
| **Tax ID / RUC completeness** | 5/19 companies have a valid Peru RUC. 1 (MCORP) has an obvious placeholder (`123123123123`, 12 digits) instead of a real one. 13/19 are non-Peru, so RUC structurally doesn't apply — they already carry their own country's tax ID, unverified against that country's actual format. 2 companies (A.S.M International, Agricola y Comercial Valles del Nuble) list more than one tax-ID value on file, which needs reconciling before it can satisfy ERD v4's `UNIQUE(taxIdType, taxId, country)` constraint on `companies` |
| **Buyer years-in-business** | 52/84 (62%) real deals known; 7/19 companies have none |
| **Supplier years-in-business** | 83/84 (99%) known |
| **⚠ Business-logic conflict, not a schema gap** | `trumarket`'s `deal-field-suggestions.types.ts` currently weights **BL as the *least* authoritative document for ports** (Packing List=100, Certificate of Origin=85-90, BL=15-20 — code comment literally calls BL "the least source of truth" for ports). This directly contradicts the stated priority "BL top priority for Port of Origin/Port of Destination." Worth resolving with whoever owns that authority table — supplier/exporter name is already weighted correctly (BL=100/top), it's specifically ports that are inverted |

---

## ERD v4 entity mapping (for anyone updating the schema directly)

| Field | Target entity | Status in ERD v4 |
|---|---|---|
| Cargo insurance | `TxStructure.insuranceCoverage` | Exists — data-entry gap only |
| Buyer/supplier YIB | `companies.yearsInBusiness` | Exists |
| License validity | `kybverifications.licenseValidity` | Exists |
| Buyer/supplier capacity | `companies.annualSalesUsd/maxHistoricalTicketUsd` + `Counterparty.totalFobUsd/avgShipmentFobUsd/maxShipmentFobUsd/totalNetWeightKg` | **Now exists** (added in v4; absent in `final`) |
| Buyer credit rating | `CofaceBuyerRating.companyRiskGrade` + `CountryRisk.countryRiskGrade` | Exists, redesigned (buyer-only, append-only history) |
| Tax ID / RUC | `companies.taxId` + `taxIdType` + `UNIQUE(taxIdType, taxId, country)` | Exists — the schema companies should be migrated toward |
| Quality certifications | — | **Still absent** — no field anywhere |
| Customs clearance days | — | **Still absent** — `Customs` has `shipmentDate` only |
| Cold-chain protocol status | — | **Still absent** — `Product.coldChain` is a static flag, not a per-shipment reading |
| Volume (kg) vs. quantity (units) | — | **Still absent** — `deals.quantity` is a single field, no unit/volume split |
| Incoterm | — | **Still absent** — no field on `deals` |
| Transshipments | — | **Still absent** — no field anywhere |
| Payment terms/advance/collateral | `TxStructure` | Exists — data-entry gap only |

---

*Supersedes the equivalent sections in `cram-defaults-and-formula-2026-07.md` §12 and the in-chat versions of this report from earlier in the 2026-07-27 session. Cross-repo findings (trumarket extraction pipeline) are current as of that session's read-only survey — re-verify against `trumarket`'s `ANALYZE_DOCUMENTS_VERSION` before acting, in case the extractor has changed since.*
