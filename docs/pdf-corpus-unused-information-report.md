# Unused information in extracted PDF corpus

**Date:** 2026-07-16  
**Method:** `pdf-parse` text extraction + NLP reading of content (not OCR).  
**Corpus:** 8 trade PDFs (DR oranges) + 22 Israel-1 drawback PDFs (30 files).  
**Question answered:** What information is **inside these files** (by type) that is **not used** as a TruMarket Mongo deal field **and** not used as a CRAM scoring field (per `credit-risk-mvp/docs`).

**Parse note:** `1776463705337-5PHITO-1.PDF` → **2 characters** (image-only / failed extract). Sister file `5FITO_-1.PDF` has usable text.

Raw extracts saved under `docs/_pdf-extract-corpus/`.

---

## Legend

| Tag | Meaning |
|---|---|
| **USED** | Mapped today into TM deal and/or CRAM Deal inputs |
| **UNUSED** | Present in PDF text, but neither TM deal columns nor CRAM score consume it |

---

## A. Trade documents (Dominican Republic — oranges)

### A1. Commercial Invoice (`3E001-1` ×2)

**What the file is:** SUNAT electronic sales invoice (BIO FARMING PERU → GRUPO QSP SRL), Valencia oranges, FOB Caucedo.

| Information in PDF | Status |
|---|---|
| Seller name, RUC, buyer name | USED |
| Invoice total USD 18,400 | USED |
| Issue date | USED (dates) |
| Product description / variety Valencia | USED |
| Qty 40 units | USED |
| `DEST:CAUCEDO`, `ICTM:FOB`, payment 50/50 in Observación | Partially — FOB/terms useful to CRAM if parsed; TM often only stuffs into `description` |
| **Container number** (`CTN:HLBU…` / `OERU…`) | **UNUSED** |
| **Booking number** (`BK:…`) | **UNUSED** |
| **Linked GRE** (`EG07 …`) | **UNUSED** |
| Full street addresses (emitter + buyer Santo Domingo) | **UNUSED** |
| Line packaging: **bines de 620 kg**, caliber **S-M-L**, unit price 460 | **UNUSED** (only aggregate qty/total used) |
| Tax breakdown: Anticipos, Descuentos, ISC, IGV=0, ICBPER, redondeo | **UNUSED** |
| `Forma de pago: Crédito` vs Contado | Weak — not a structured TM/CRAM enum |
| SUNAT “clave SOL” verification boilerplate | **UNUSED** |

### A2. Packing List (`41PL_2`, `4PL_64`)

**What the file is:** Pre-packing / packing list with per-bin lines, container load details.

| Information in PDF | Status |
|---|---|
| Variety Valencia, CAT I, box/bin count, ports, exporter/importer | USED |
| Brand HILLSIDE | Mostly **UNUSED** (may appear in description only) |
| **Per-pallet / bin IDs** (e.g. `25-13-00029`) | **UNUSED** |
| **Caliber mix** SMALL / MEDIUM / LARGE counts | **UNUSED** (CRAM has grade A/B, not size mix) |
| **Thermograph IDs + readings** (`SENSOR 0.9°C`, `-0.4°C`, device IDs) | **UNUSED** (banking framework wants temp range; not wired) |
| **Ventilation / humidity / CO₂ / O₂** setpoints | **UNUSED** |
| **Logistics operator** (ORANGE LOGISTIC), **truck company** (TORRES HNOS) | **UNUSED** (CRAM “freight forwarder” not extracted) |
| **SENASA seal / customs seal / line seal** | **UNUSED** |
| Vessel/line on PL, load **start/end time** | **UNUSED** |
| Internal refs (`CITRIC-E-AGP-00101`, `EG03-…`) | **UNUSED** |
| Gross kilos vs net (beyond qty label) | Mostly **UNUSED** as structured fields |

### A3. Phytosanitary (`5PHITO` empty; `5FITO` OK)

**What the file is:** SENASA phytosanitary certificate for fresh orange to Dominican Republic.

| Information in PDF | Status |
|---|---|
| Destination country (may pollute TM port merge) | Misused / partial |
| Botanical name **`Citrus sinensis`** | **UNUSED** |
| Certificate / expediente / documento numbers | **UNUSED** |
| Authorized officer name, place & date of issue | **UNUSED** |
| Declared qty + product formal name | Partial via common fields only |
| QR / verification codes, SENASA liability text | **UNUSED** |

### A4. Certificate of Origin (`6CO-64`)

**What the file is:** Cámara de Comercio de Lima CO — Callao → Caucedo.

| Information in PDF | Status |
|---|---|
| Exporter, consignee, origin Peru, product, 40 bines, net kg, ports | USED |
| **Chamber certificate number** | **UNUSED** |
| **Gross weight** 26,290 kg (vs net 24,800) | **UNUSED** as CRAM/TM field |
| Chamber issue date / preview URL | **UNUSED** |
| Linked invoice number (supports traceability) | **UNUSED** as deal field |

### A5. Bill of Lading (`7BLDRA`)

**What the file is:** COSCO proforma B/L — Callao → Caucedo, FCL reefer.

| Information in PDF | Status |
|---|---|
| Shipper, consignee, POL/POD, product, container | USED (ports/parties) |
| **B/L number** `COSU6448936350` | **UNUSED** |
| **Vessel + voyage** `CMA CGM CARL ANTOINE 0WCNCN1MA` | **UNUSED** (extracted in regex, not mapped) |
| **Notify party / customs broker** (R O VALDEZ & ASOCIADOS + contacts) | **UNUSED** |
| **Consignee tax ID RNC** `1-31-79197-2` | **UNUSED** |
| **Freight charge breakdown** (ocean, cold treatment, Panama Canal, terminal, release) **USD 4,211 collect** | **UNUSED** |
| Movement type **FCL/FCL CY-CY** | **UNUSED** |
| **HS / partida** `0805.10` | **UNUSED** |
| Seals, thermograph IDs, set temp **-0.5°C** | **UNUSED** |
| Shipper contact email/phone | **UNUSED** |
| **Date laden on board / place of issue** (actual transit signal) | **UNUSED** by CRAM (tables used instead) |
| Carrier agent, # original B/Ls, local Peru charges clauses | **UNUSED** |

---

## B. Drawback pack — Israel 1 (blueberries)

### B1. Packaging / Maquila Contract

**What the file is:** Contrato de producción por encargo — Holy Fruit (client) ↔ Viñasol (plant), blueberries.

| Information in PDF | Status |
|---|---|
| Party names + RUCs (may wrongly win supplier merge) | Partial / noisy |
| **Service scope** (reception, grading, packing, pre-cool, cold store ≤5 days, dispatch) | **UNUSED** |
| **Full tarifario** (US$/box by format 12×125g etc., exportable-% surcharges) | **UNUSED** |
| Contract term **6 months**, termination / notarial rules | **UNUSED** |
| **Legal reps + DNI** | **UNUSED** |
| Payment: invoice + **2-day** pay window / before container dispatch | **UNUSED** (structure schedule) |
| Penalty **10%** on client-caused material delays | **UNUSED** |
| Cold overstay fees, discard storage, air surcharge % | **UNUSED** |
| DocuSign-like **Transaction ID** | **UNUSED** |
| Obligation to present **SENASA producer certificates** | **UNUSED** (CRAM wants certs, does not read this) |

### B2. Customs Declaration DAM

**What the file is:** DAM aérea export Holy Fruit → Israel; código 13 drawback.

| Information in PDF | Status |
|---|---|
| Exporter, destination Israel, FOB, product blueberries | USED by TM (FOB→total); CRAM MVP often **misses** DAM FOB |
| **Canal Rojo** (red customs channel) | **UNUSED** — strong ops/risk signal |
| **Via transporte AEREO**, manifiesto #, warehouse **FRIO AEREO** | **UNUSED** |
| **Flete / Seguro / Valor Aduana** split (beyond FOB) | **UNUSED** by CRAM |
| **Código 13** restitución (TM validation flag only) | **UNUSED** by CRAM score |
| **Customs broker** CORPORACION MAREC | **UNUSED** |
| Partida arancelaria `0810400000`, ubi geo, numeración DAM | **UNUSED** |
| Linked commercial invoice # / dates | Trace only |

### B3. Sworn Declaration (DJ etiquetas)

**What the file is:** DJ that label stock was sold locally and not under suspensory customs regimes.

| Information in PDF | Status |
|---|---|
| Entire document for CRAM / TM deal economics | **UNUSED** |
| Local sale invoice ref for labels | TM requirement slot only |
| **Import DAM** of input (`118-2023-10-330129-00`) | **UNUSED** by CRAM |
| Input identity: **papel autoadhesivo ARCLAD…**, area m² | **UNUSED** |
| Legal citations (Ley 27444, drawback reglamento) | **UNUSED** |

### B4. Commercial Export Invoice (`Factura de venta Israel 1`)

**What the file is:** Holy Fruit → Eagle Trading (Israel), CPT + air freight line, drawback claim.

| Information in PDF | Status |
|---|---|
| Buyer, seller, RUC, totals, product/variety, CPT, destination Israel | USED |
| **Buyer VAT** `515059509` | **UNUSED** |
| **Consignee address** Moshav Magen Shaul 75 | **UNUSED** |
| **Separate air-freight line** ($3.55/kg Callao→Tel Aviv, ~$26,688) | **UNUSED** as structured freight cost |
| **Caliber split** 20mm vs 18mm with different unit prices | **UNUSED** (fulfillment/mix risk) |
| Tax/rounding lines | **UNUSED** |

### B5. TM → Holy Fruit sale (`Factura de venta TM A HF`)

**What the file is:** TruMarket sells selected fruit to Holy Fruit for packing (domestic link in chain).

| Information in PDF | Status |
|---|---|
| Totals / parties (can pollute purchase vs sale merge) | Partial |
| **Credit schedule**: 1 cuota, due **30/09/2025**, pending balance | **UNUSED** by structure engine |
| Linked GRE `EG07-90` | **UNUSED** |
| Caliber 18mm + box count in description | Partial via text only |

### B6. Raw Material Purchase Invoices (MP 1–5)

**What the file is:** Field growers → TruMarket fruit purchases (**SOLES**).

| Information in PDF | Status |
|---|---|
| Supplier name, RUC, kg, product (→ purchaseTotal if detected) | USED if purchase path works |
| **Currency SOLES** (not USD) — FX not applied | **UNUSED** / dangerous if treated as USD |
| **Detracción** % / BN account / códigos 035 / 011 | **UNUSED** |
| **Bank accounts, CCI, SWIFT** | **UNUSED** |
| **GLOBALG.A.P. GGN / CLP** (Sur Natural invoice) | **UNUSED** — CRAM wants quality certs but does not extract |
| Farm / variety codes (`VN`, `057`, Ventura), retention-agent legend | **UNUSED** |
| Linked GRE / OC numbers | **UNUSED** |

### B7. Processing / packing-materials / reetiquetado invoices

**Types:** Maquila service, clamshell+cajas, etiquetas, retiquetado / Servicio reetiquetada (duplicate content).

| Information in PDF | Status |
|---|---|
| Domestic supplier name/RUC/totals | Must not drive export deal FOB |
| **SKU / product codes**, Temptale device | **UNUSED** |
| **Service breakdown**: cold-air treatment, re-label in cold room, box repair, repalletizing | **UNUSED** |
| Truck **plate** on maquila line, IGV, detracción bank | **UNUSED** |
| “CARGA N°01”, Nisira portal hashes | **UNUSED** |

### B8. Transport guides (GRE)

**Subtypes in pack:** field→plant (compra), TM→HF (venta), export to airport, internal materials.

| Information in PDF | Status |
|---|---|
| Dates / origin hints / export motivo (TM chronology + weak deal dates) | Partial |
| **Driver name, DNI, license, plate** | **UNUSED** |
| **Harvest window** (inicio/fin cosecha hours) | **UNUSED** |
| **Producer + CLP** codes (SENASA farm registry) | **UNUSED** |
| Motivo traslado, modalidad privada/pública | TM classify only |
| **MTC** auth / transportista RUC | **UNUSED** |
| Export: destinatario **FRIO AEREO**, related **DAM #**, plant **precinto**, bultos | **UNUSED** by CRAM |
| Same origin=destination (internal materials) | Classify only |

---

## C. Cross-cutting unused themes (highest value if productized)

These appear repeatedly in the corpus and are unused by **both** TM deal model and CRAM score:

1. **Logistics identity** — vessel/voyage, B/L #, freight forwarder/broker, truck/driver, MTC  
2. **Cold-chain evidence** — set temp, Temptale/thermograph IDs & readings, ventilation/CO₂  
3. **Customs risk ops** — Canal Rojo, código 13 detail, manifiesto, almacén frío, broker  
4. **Cost stack beyond FOB** — ocean/air freight lines, packing materials, maquila tariff, detracción  
5. **Quality / compliance IDs** — GLOBALG.A.P. GGN/CLP, botanical name, HS/partida, SENASA seals  
6. **Size/caliber mix** — S/M/L or 18/20mm splits (fulfillment risk noted in CRAM structure audit, unscored)  
7. **Payment microstructure** — cuota due dates, Contado vs Crédito, bank CCI/SWIFT  
8. **FX** — MP invoices in **SOLES** while export in **USD**  
9. **DJ / import-input traceability** — import DAM of labels/packaging  
10. **Contract commercial terms** — maquila tarifario, penalties, cold-day caps

---

## D. File → type map (this corpus)

| File | Inferred type |
|---|---|
| `*3E001-1.PDF` | Commercial Invoice (trade export) |
| `*41PL*`, `*4PL*` | Packing List |
| `*5PHITO*` | Phytosanitary (no text) |
| `*5FITO*` | Phytosanitary |
| `*6CO*` | Certificate of Origin |
| `*7BLDRA*` | Bill of Lading |
| Contrato de maquila | Packaging / Maquila Contract |
| DAM-056607 | Customs Declaration |
| DJ de etiquetas | Sworn Declaration |
| Factura de venta Israel 1 | Commercial Export Invoice |
| Factura de venta TM A HF | Domestic sale (TM→exporter) |
| Factura venta MP 1–5 | Raw Material Purchase Invoice |
| Factura de Maquila / caja / etiqueta / retiquetado / Servicio reetiquetada | Processing or packing-materials invoices |
| Guia remision 1–4 | Raw material GRE (field→plant) |
| Guia TM A HF | Domestic transfer GRE |
| Guia exportacion | Export GRE |
| Guia materiales | Internal plant GRE |

---

*Extraction: pdf-parse via TruMarket `node_modules`. Empty phyto needs OCR before claims about its unused fields.*
