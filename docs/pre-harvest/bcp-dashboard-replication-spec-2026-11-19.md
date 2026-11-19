---
title: "BCP pre-harvest bank dashboard · replication spec for an AI builder"
date: 2026-11-19
type: spec
status: v1
project: bcp-pilot-pyme-pre-cosecha
moc: "[[MOC-BCP]]"
tags: [bcp, dashboard, pre-cosecha, spec, handoff]
source_canvas: https://claude.ai/artifact/Fqu1njK5v69zgMCTke1ZF8
---

# BCP pre-harvest bank dashboard: replication spec

You are an AI building a web dashboard and two printable reports. Follow this spec exactly. Everything you need is in this file: purpose, rules, screens, copy, data model, formulas, example data, visual tokens and an acceptance checklist. Where this file is silent, choose the simplest option that keeps the rules in section 2.

---

## 0. How to use this file

1. Read sections 1 and 2 completely before writing any code. They decide every trade-off.
2. Build the data model (section 5) and the example dataset (section 9) first. All screens read from it. Never hard-code a number in a component.
3. Build screens in this order: Loan file (section 6.2), Portfolio (6.1), Alert card (6.3), Monthly report (7.1), Exception notice (7.2).
4. Run the acceptance checklist (section 11) before you report the work as done.

UI copy is in **Spanish (Peru, banking register)**. This spec is in English. Every Spanish string in quotes is final copy: use it as written.

---

## 1. Context

- **Product:** the bank-facing view of TruMarket's pre-harvest crop loans. TruMarket originates, structures and monitors loans to agricultural growers before harvest; the bank (BCP, Banco de Crédito del Perú) provides capital and gives conformity before each disbursement.
- **Primary user:** a credit risk analyst in BCP's Riesgos team. Secondary readers: the bank's credit committee (they read the printed reports) and the SBS (Peru's banking regulator) during audits.
- **What the user needs to know, always in this order:**
  1. **Mi dinero:** where the bank's money is (disbursed, frozen, pending, repaid, maturing).
  2. **Mi riesgo:** how likely the bank is to be repaid, and how that changed.
  3. **Qué cambió:** what moved since approval in any variable or pre-existing condition that can affect repayment.
- **Overall message every screen must send:** TruMarket controls the money at every step. No dollar leaves without a verified milestone and the bank's conformity; deviations are caught early, money is frozen the same day, and the bank only decides what is truly discretionary.

### 1.1 Loan mechanics you must model

- Each loan has a **line** (approved amount) released in **three tranches** tied to crop stage, not calendar:
  - **T1, 30%** at approval. Checklist: instruments signed and registered, collection account open, insurance verified, vetoes closed.
  - **T2, 40%** at fruit set (about week 10). Checklist: T1 invoices reconciled, independent field yield estimate ("aforo") agrees with satellite and invoices, credit bureau re-checked, field work within window. **T2 amount is sized on the verified volume, never on the grower's declaration.**
  - **T3, 30%** pre-harvest (about week 22). Checklist: harvest verified and fit for export, packhouse contracted, buyer with activatable credit cover.
- **Repayment** is a single bullet at maturity from the buyer's payments into a collection account, applied to the bank first; the surplus goes to the grower at the end. The grower pays no instalments during the campaign.
- **Decision ownership:**
  - Mechanical, pre-agreed decisions (release against a complete checklist, hold, freeze) are executed by TruMarket under contract and reported to the bank the same day.
  - Discretionary decisions (refinancing, stop-loss, salvage, termination, moving to red) are taken by the bank on TruMarket's written recommendation.
  - Every tranche release also needs the bank's conformity.

---

## 2. Non-negotiable rules

1. **Impact first.** Never show a technical reading (temperature, NDVI, sea-surface anomaly, indices) as a headline. Every signal is expressed as its effect on repayment: change in expected volume, quality, price or collection, and the resulting change in repayment coverage. Technical readings live only in the audit log and the evidence tabs.
2. **Coverage is the headline risk metric.** Repayment coverage = net harvest revenue ÷ amount due at maturity (formula in section 5.3). Show it with one decimal pair (e.g. `1.75x`).
3. **Four states plus veto**, always with a text label, never color alone: `Verde`, `Ámbar`, `Naranja`, `Rojo` (and `Veto` at origination only). Plus a neutral `En observación` for TruMarket early warnings that do not yet affect coverage.
4. **Confirmed vs estimated.** Every forward-looking impact is either `Confirmado` (verified by field visit, satellite or documents) or `Estimado` (a projection). Estimates are shown as ranges, hatched or dashed in charts, and carry an `Estimado` badge.
5. **Provenance on every value.** Each value in a condition table carries one badge: `Doc. verificado`, `Declarado`, `Satelital` or `Estimado`, plus its source and date.
6. **Example data is labelled.** The portfolio carries the chip `Cartera de ejemplo · datos ilustrativos`; every loan file carries `Expediente de ejemplo`. TruMarket has no pre-harvest track record yet; nothing may imply live historical loans.
7. **Do not show:** the name of the credit insurer, the name of any customs or trade data vendor, source code file paths, tier pricing percentages, probability-of-default tables, or the words "demo", "mock", "simulación", "AI", "IA" or "inteligencia artificial". The model is a deterministic, versioned rules engine.
8. **No live-feeling theatre.** No pulsing markers, no animated "checking sources…" text, no fake clocks. Show "source and date" instead.
9. **Typography rule:** labels, eyebrows, table headers and footers use Arial (Helvetica fallback). Never use a monospace font outside code. No em dashes or en dashes anywhere in UI copy; use commas, colons or "a" for ranges (e.g. "1.55x a 1.65x").
10. **Bank vocabulary:** exposición, saldo, desembolsado, por desembolsar, congelado, cobertura de repago, provisión, clasificación SBS, conformidad, tramo, aforo, central de riesgos, cesión de cobros, cuenta de recaudo.

---

## 3. Information architecture

```
Sidebar (persistent)
├── Cartera                      → 6.1 Portfolio
├── Expedientes (count)          → list → 6.2 Loan file
├── Requiere su decisión (count) → filtered list of pending bank conformities
├── Excepciones (count)          → list of open exception notices (7.2)
├── Reportes mensuales           → 7.1 Monthly report (view + PDF)
├── Mapa de predios              → secondary map view (optional, low priority)
├── Método y umbrales            → thresholds table (section 8) in Spanish
└── footer: "Analista de Riesgos · BCP" + "Datos al <fecha de corte>"
```

The map is deliberately demoted to a secondary item. It must never lead a screen.

---

## 4. Visual system

### 4.1 Tokens

| Token | Value | Use |
|---|---|---|
| `ink` | `#102a40` | Primary text, dark cards, primary bars |
| `ink-muted` | `#4a5b6c` | Secondary text, labels (passes 4.5:1 on white) |
| `bg` | `#f4f6f8` | Page background |
| `surface` | `#ffffff` | Cards |
| `border` | `#d9e1e8` | Card borders |
| `divider` | `#eef2f5` | Row dividers |
| `neutral-fill` | `#e8edf1` / `#c3ccd5` | Pending bars, placeholders |
| `primary` | `#0f9d6b` | TruMarket green (fills only) |
| `primary-text` | `#0b6b48` | Green text and buttons (contrast-safe) |
| `control-bg` | `#f3faf6`, border `#bfe3d0` | "Control del dinero" section |

State colors (chip = tinted background + dark text; dot/bar = solid):

| State | Solid | Chip background | Chip text |
|---|---|---|---|
| Verde | `#0f9d6b` | `#e3f4ec` | `#0b6b48` |
| Ámbar | `#d9a93b` | `#fbf1d9` | `#6e4a00` |
| Naranja | `#e0702a` | `#fde4d3` | `#8a3a0b` |
| Rojo | `#d63a4d` | `#fbe0e3` | `#9b1c2c` |
| En observación | `#c3ccd5` | `#eef2f5` | `#102a40` |

### 4.2 Type

- Body and numbers: **Inter** (400, 600, 700, 800), `font-variant-numeric: tabular-nums` on every number.
- Labels/eyebrows/table headers: **Arial**, 12px, `#4a5b6c`.
- Sizes: page title 28px/700; section title 20px/700; card title 16px/700; KPI 22 to 28px/700; hero numbers on the alert card 52px/800; body 14 to 16px; nothing below 12px.

### 4.3 Components

- **Card:** white, 1px `border`, radius 12px, padding 16 to 24px.
- **Chip:** pill, 12px Arial bold, padding 3px 10px, optional 8px dot.
- **Provenance badge:** square-ish (radius 4px), 11px Arial bold, 1px border `#c3ccd5`, white background.
- **Dark situation card:** background `ink`, white text, label color `#c9d6e2`.
- **Primary button:** `primary-text` background, white text, min height 44px. Secondary: white with border.
- **Tables:** header row in Arial 12px muted, 1px bottom border; numbers right-aligned; wide tables scroll horizontally inside their card.

### 4.4 Layout

- Sidebar 220 to 240px + content max-width 1200px (portfolio) or 1280px (loan file), padding 32 to 40px.
- Must work at 375px wide: sidebar stacks above content, grids collapse to one column, tables scroll inside their box.
- Must print cleanly on A4 (screens) and be designed natively for A4 (reports).

---

## 5. Data model and calculations

### 5.1 Types (TypeScript)

```ts
type State = "verde" | "ambar" | "naranja" | "rojo" | "veto";
type Provenance = "doc_verificado" | "declarado" | "satelital" | "estimado";
type Driver = "volumen" | "calidad" | "precio" | "cobranza" | "prestatario";

interface Tranche {
  id: "T1" | "T2" | "T3";
  pct: 30 | 40;
  amountUsd: number;          // maximum; T2 final = sized on aforo
  status: "liberado" | "pendiente" | "congelado" | "previsto";
  milestoneDate: string;      // ISO
  checklist: { label: string; status: "ok" | "pending" | "warn" | "fail" }[];
  bankConformityDate?: string;
}

interface CoveragePoint {
  date: string;               // weekly
  value: number;              // confirmed coverage
  note?: string;              // short impact note, e.g. "precio -5%"
}

interface Condition {
  group: "Prestatario" | "Cultivo y volumen" | "Precio y calidad" | "Uso de fondos y cobranza";
  label: string;              // Spanish
  atApproval: string;
  today: string;
  threshold: string;
  state: State | "observacion";
  effectOnRepayment: string;  // Spanish, impact language
  provenance: Provenance;
  source: string;             // e.g. "Central de riesgos · 05 nov"
}

interface UseOfFundsLine {
  item: string; budgetUsd: number; reconciledUsd: number;
  directPayPct: number; fieldMatch: string;
}

interface Decision {
  date: string;
  lane: "tm_contract" | "bank";
  title: string;
  basis: string;              // rule or trigger
  evidence: string[];
  engineVersion: string;
  responsible: string;
  dueDate?: string;           // bank lane only
}

interface Loan {
  id: string;                 // "ICA-0188"
  crop: string; zone: string; areaHa: number;
  campaign: string; dayOfCycle: number; cycleDays: number;
  lineUsd: number; disbursedUsd: number; frozenUsd: number;
  dueAtMaturityUsd: number; maturityDate: string;
  state: State; stateSince: string;
  coverageAtApproval: number; coverageToday: number;
  projection?: { low: number; high: number; cause: string }; // estimado
  driverDeltas: Record<Driver, number>;  // sums to today - approval
  breakEvenPriceUsdKg: number; expectedPriceUsdKg: number;
  scenarios: { label: string; coverage: number }[];
  sbsRating: "Normal" | "CPP" | "Deficiente" | "Dudoso" | "Pérdida";
  provisionUsd: number;
  scoreAtApproval: number; scoreToday: number; approvedTier: "A"|"B"|"C"|"D";
  tranches: Tranche[];
  coverageHistory: CoveragePoint[];
  conditions: Condition[];
  useOfFunds: { tranche: string; lines: UseOfFundsLine[]; cashWithdrawnUsd: number;
                threeSources: { facturas: boolean; satelite: boolean; aforo: "ok"|"pending"|"fail" } };
  decisions: Decision[];
  auditLog: { date: string; event: string; responsible: string; rule: string; evidence: string; engineVersion: string }[];
}
```

### 5.2 State rule

```
loan.state = most severe of:
  a) coverage band:  coverage >= 1.50 → verde; 1.30 to 1.49 → ámbar; 1.10 to 1.29 → naranja; < 1.10 → rojo
  b) agreed triggers (section 8), each mapped to its band
TruMarket early warnings (weather, El Niño, temperature) never change the state on their own.
They set "En observación" and produce an estimated impact range until confirmed.
```

Use the projection, not only today's value, when it falls inside a worse band: show the band in the projection text, but the official state stays on confirmed data.

### 5.3 Formulas

- **Net harvest revenue** = verified volume (kg) × exportable share × expected FOB price (USD/kg) × farm-gate share (after packing, freight and fees).
- **Repayment coverage** = net harvest revenue ÷ amount due at maturity (principal + bank cost).
- **Driver delta:** recompute coverage changing one driver at a time from its approval value to today's; the five deltas must sum to `coverageToday - coverageAtApproval` (allocate any rounding to Volumen).
- **Break-even price** = amount due ÷ (verified volume × exportable share × farm-gate share).
- **Scenarios:** coverage × (1 + shock); show at least "Si el precio cae 20%" and "Si el volumen cae 30%".
- **Portfolio coverage** = Σ(coverage_i × disbursed_i) ÷ Σ disbursed_i.
- **SBS provision** = disbursed × rate by rating (Normal 1%, CPP 5%, Deficiente 25%, Dudoso 60%, Pérdida 100%), Res. SBS 11356-2008, no preferred guarantee.
- **Expected loss:** display "por calibrar con Riesgos". Do not show probability of default.

---

## 6. Screens

### 6.1 Portfolio ("Cartera")

Top to bottom:

1. **Header.** Chip `Cartera de ejemplo · datos ilustrativos`. Title "Cartera pre-cosecha". Subtitle "5 préstamos · palta Hass · Ica y Pisco · corte 10 nov 2026". Secondary button "Descargar reporte mensual (PDF)".
2. **Situación de la cartera:** four cards in a row, each with a label, one big number and two bullets. No paragraph.

   | Card | Big number | Bullets |
   |---|---|---|
   | Desembolsado (dark card) | USD 66,600 | "44% de la línea de USD 150,000" · "El resto sale solo contra hitos" |
   | Cobertura de repago | 1.80x | "La cosecha paga 1.8 veces lo adeudado" · "Ningún préstamo en rojo" |
   | Cambios del mes | 3 préstamos | "1 a naranja: tramo congelado" · "2 a ámbar: seguimiento reforzado" |
   | Requiere su decisión (2px ink border) | 1 | "Conformidad del T2 de PIS-0034" · "Vence 12 nov 2026" |

3. **Control del dinero** (green-tinted card, the key trust section). Title + "controles verificados al 10 nov 2026". Four big indicators:
   - "7 de 7": "tramos liberados con checklist completo y conformidad del banco"
   - "93%": "de los fondos con factura conciliada · USD 4,930 en revisión"
   - "72%": "pagado directo a proveedores · USD 0 retirado en efectivo"
   - "Mismo día": "congelamiento ejecutado y reportado al detectar el desvío (ICA-0201)"

   Then a bullet list: "Central de riesgos re-consultada en el mes: 5 de 5 deudores" · "Cesión de cobros inscrita y sin cesiones a terceros: 5 de 5" · "Seguro agrícola vigente: 5 de 5" · "Mayor exposición en naranja: USD 16,800, limitada a lo desembolsado".
4. **Mi dinero.** One horizontal stacked bar of the line: desembolsado (ink), congelado (orange hatched), por desembolsar (light grey). Below, five figures: Desembolsado (capital vigente) USD 66,600 · Congelado USD 7,200 (T3 de ICA-0201) · Por desembolsar USD 76,200 (contra hitos, nov a feb) · Repagado USD 0 (cosechas desde mar 2027) · Vencimientos de capital: mar 2027 USD 90,000; abr 2027 USD 60,000.
5. **Mi riesgo.** Three cards:
   - *Exposición por estado (USD desembolsados):* stacked bar + table with chip, USD and loan count per state (Verde 29,400 / 2; Ámbar 20,400 / 2; Naranja 16,800 / 1; Rojo 0 / 0).
   - *Cobertura de repago de la cartera:* 1.80x big; amber note "Proyección 1.60x a 1.70x si El Niño costero reduce el cuajado como en 2017 y 2023. [Estimado] Se confirma con los aforos de nov y dic."; footnote with the thresholds.
   - *Regulatorio y concentración:* Clasificación SBS "5 de 5 Normal"; Provisión requerida USD 666; Pérdida esperada "por calibrar con Riesgos"; Cultivo "palta Hass 100%"; Zona "Ica 81% · Pisco 19%"; Packing principal "58% de la línea".
6. **Qué cambió este mes** ("10 oct a 10 nov 2026"): one row per change: client + date | chip from → chip to | bold impact sentence + "Causa: …" | link "Ver". Rows in section 9.2.
7. **Requiere su decisión** block (2px ink border): "PIS-0034 · Conformidad del T2 por USD 11,200", checklist summary, coverage, TruMarket recommendation; buttons "Pedir información" (secondary) and "Dar conformidad" (primary).
8. **Préstamos** table, sorted by state severity then exposure: Cliente (+zona) | Estado chip | Desembolsado (de línea) | Próximo tramo | Cobertura "aprobación → hoy" + projection line | Vence | Qué está pasando. Footnote: "Cada dato muestra su fuente y fecha en el expediente. Estado = el más severo entre cobertura de repago y los gatillos acordados (vigor, facturas, labores, cuajado, aforo, deuda)."

### 6.2 Loan file ("Expediente"), example ICA-0188

1. Back link "← Cartera". Chips: state with date ("Ámbar desde 08 nov 2026") + `Expediente de ejemplo`. Title "Cliente ICA-0188 · Palta Hass". Subtitle "Valle bajo de Ica · 4.85 ha medidas · campaña 2026-27 · día 56 de 180". Buttons "Memorando de crédito", "Exportar registro (CSV)".
2. **Situation** (dark card), four bullets in two columns:
   - "Cosecha esperada **10% menor**: vigor del cultivo 16% bajo lo normal"
   - "Cobertura **1.75x**, sobre el umbral de 1.50x"
   - "Expuesto: **USD 10,800**. El T2 se calcula sobre el aforo del 15 nov"
   - "Productor, agua y uso de fondos en orden. **No requiere su decisión hoy**"
3. **Mi dinero.** Five KPI cards: Línea aprobada USD 36,000 (180 días · 3 tramos) · Desembolsado USD 10,800 (T1 · 15 set 2026) · Por desembolsar USD 25,200 (T2 y T3 contra hitos) · Saldo al vencimiento USD 37,800 (capital más costo del banco) · Vence 14 mar 2027 (124 días).
   Then the **tranches card**, titled "Tramos: cada dólar sale solo contra un hito verificado", subtitle "checklist firmado por TruMarket + conformidad del banco". A thin progress bar (30% filled), then four columns:
   - T1 · 30% · USD 10,800 · chip "Liberado 15 set" · ✓ Instrumentos firmados e inscritos · ✓ Cuenta de recaudo abierta · ✓ Cobertura de seguro verificada · ✓ Vetos cerrados · "Conformidad del banco 14 set".
   - T2 · 40% · USD 14,400 "máximo" · chip "Hito 15 nov" · ✓ Facturas de T1 conciliadas (96%) · ✓ Central de riesgos re-consultada 05 nov · ○ Aforo independiente de cuajado · 15 nov · ! Satélite: vigor en ámbar · ○ Ejecutivo PyME del BCP invitado al aforo · "Monto final = volumen verificado en el aforo". Top border ámbar.
   - T3 · 30% · USD 10,800 · chip "Previsto 15 feb" · ○ Cosecha verificada y apta · ○ Packing contratado · ○ Comprador con cobertura activable.
   - Repago (dashed card) · USD 37,800 · chip "14 mar 2027" · "Desde los cobros del comprador, antes que cualquier pago al productor."

   Do **not** build a separate collection-account section; the account appears only as a checklist item and as condition rows.
4. **Mi riesgo.** Two columns (2:1).
   - **Left: "Cobertura de repago en el tiempo"** (subtitle "ingreso neto de cosecha ÷ saldo al vencimiento"). A line chart, x = dates from approval to maturity, y = coverage 1.0x to 2.4x:
     - Shaded horizontal zones: ámbar band 1.30 to 1.50 (`#fbf1d9`), naranja zone below 1.30 (`#fde4d3`); dashed threshold lines at 1.50 and 1.30, labelled "umbral ámbar" and "zona naranja".
     - Solid ink line for confirmed weekly coverage: 2.10 (15 set) → 2.10 → 2.05 (precio) → 2.00 → 1.95 (calidad) → 1.75 (10 nov, vigor).
     - Annotate the first drop "precio -5%" and today "1.75x hoy · vigor -16%"; highlight today's point in ámbar.
     - Vertical dotted "hoy" line. After today, a dashed green median line to maturity at 1.60x with a light-green band 1.55x to 1.65x labelled "proyección 1.55x a 1.65x".
     - X labels: "15 set · T1", "10 nov · hoy", "15 feb · T3", "14 mar · vence".
     - Below the chart, driver chips: "Volumen -0.20x", "Precio -0.10x", "Calidad -0.05x", "Cobranza 0.00x", "Prestatario 0.00x", and the legend "Línea sólida: confirmado · línea punteada: estimado".
   - **Right panel:** "Cobertura hoy" 1.75x (36px) + "proyección 1.55x a 1.65x [Estimado]"; then Precio de equilibrio USD 1.11/kg · Precio esperado a cosecha USD 1.94/kg · Si el precio cae 20% 1.40x · Si el volumen cae 30% 1.23x; then Clasificación SBS Normal · Provisión requerida USD 108 · Score "69 → 62 · tier aprobado B"; footnote "Ingreso neto = volumen verificado × % exportable × precio, menos packing, flete y comisiones. El tier aprobado solo cambia con revisión humana registrada."
5. **Qué cambió desde la aprobación** ("aprobación 15 set 2026 · hoy 10 nov 2026"). Table: Condición | Aprobación | Hoy | Umbral | Estado | Efecto en el repago | Fuente y fecha (badge + source). Grouped rows (section 9.3).
6. **Uso de fondos · T1.** Left: table Partida | Presupuesto | Facturas conciliadas | Pago directo | Concuerda con campo, with a bold total row. Right panel: Conciliado 96% (big) · Sin sustento USD 420 · Pagado directo a proveedores 72% · Retirado en efectivo USD 0 · "Tres fuentes deben concordar antes del T2": ✓ Facturas, ✓ Satélite: labores visibles, ○ Aforo en campo · 15 nov · footnote with the invoice bands.
7. **Decisiones**, two cards side by side:
   - "Requiere su decisión" (2px ink border): "Conformidad del T2 · se habilita el 15 nov", explanation "Tras el aforo, TruMarket le enviará el monto recomendado del T2 calculado sobre el volumen verificado. Usted tendrá 72 horas para dar conformidad.", disabled buttons until enabled.
   - "Ejecutado por TruMarket según contrato · informativo": dated entries (08 nov seguimiento reforzado; 15 set T1 liberado).
8. **Registro de auditoría** table: Fecha | Evento | Responsable | Regla o gatillo | Evidencia (link) | Versión del motor. Entries are immutable; corrections are new linked entries.
9. **Evidence tabs** (real tablist): "Campo y satélite" · "Documentos" · "Datos técnicos". Tiles: "Informe de visita, Formato JRA-AGRIND y memorando de evaluación" · "Fotos georreferenciadas y laboratorio de suelo y agua" · "Imagen del predio e histórico de cosechas verificado". Technical series (NDVI, weather, water) live only under "Datos técnicos".

### 6.3 Alert card ("impacto primero")

Used in the portfolio change feed (expanded), the alerts page and notifications. Two levels only; no technical layer.

**Main view:**
- Header: state chip + "ICA-0188 · Palta Hass · Valle bajo de Ica" + date.
- **Three hero stats** (grid 1 : 1.4 : 1):
  - Amber tile: label "Volumen esperado", **"-10%"** at 52px/800, sub "vs lo declarado al aprobar".
  - Neutral tile: label "Cobertura de repago", "2.10x" (32px muted) → **"1.75x"** (52px/800), sub "la cosecha aún paga 1.75 veces lo adeudado".
  - Green tile: label "Margen sobre el umbral", **"+0.25x"**, sub "umbral ámbar 1.50x".
- Estimate strip: [Estimado] "Si El Niño costero reduce el cuajado, la cobertura podría bajar a **1.55x a 1.65x**. Seguiría sobre el umbral. El aforo del 15 nov lo confirma."
- Three columns with a 3px top rule: "Su dinero": USD 10,800 + "desembolsado. Los USD 25,200 restantes solo salen contra hitos verificados." · "Qué hace TruMarket": "Seguimiento reforzado" + "El T2 se calcula sobre el volumen verificado en el aforo, no sobre lo declarado." · "Su decisión": "Ninguna hoy" + "Conformidad del T2 después del aforo del 15 nov."
- Links "Ver por qué" and "Abrir expediente".

**"Ver por qué" (expanded):** one row per cause: status chip | plain-language explanation | coverage effect right-aligned.
- Confirmado · "El cultivo está menos vigoroso de lo normal." … · -0.20x
- Confirmado · "El precio esperado bajó 5% y la fruta exportable 2 puntos." … · -0.15x
- En observación · "El mar frente a la costa está mucho más caliente de lo normal." … · -0.10x a -0.20x
- Bajo control · "El productor, el agua y el uso de fondos están en orden." … · 0.00x
- Footer: "Las lecturas técnicas, la regla aplicada y la versión del motor quedan en el registro de auditoría del expediente."

---

## 7. Printed reports (A4 portrait, 794 × 1123 px at 96 dpi, fixed pages)

Common: 48px vertical and 56px horizontal margins; 2px ink rule under the header; tables with 1px rules and right-aligned numbers; body 12.5 to 13.5px; footers in Arial 12px; readable in grayscale.

### 7.1 Monthly portfolio report (2 pages)

**Page 1.** Header: "TruMarket · para BCP Riesgos · confidencial" / "Reporte mensual de cartera pre-cosecha" / "Noviembre 2026 · corte 10 nov 2026 · datos de ejemplo" / "Página 1 de 2".
1. Resumen: four bullets: **Dinero** · **Riesgo** · **Cambios** · **Control** (copy in the canvas; Control = "7 de 7 tramos con checklist y conformidad del banco; 93% de los fondos con factura conciliada; congelamiento ejecutado el mismo día.").
2. Mi dinero: stacked bar + table Concepto | USD | % línea | Nota.
3. Mi riesgo: two tables side by side: exposure by state; indicators (coverage, projection, SBS, provision, concentration).
4. Cambios del mes: Préstamo | Cambio | Causa | Efecto en el repago.
5. Préstamos: Préstamo | Estado | Desembolsado | Línea | Cobertura | Próximo hito.
Footer: coverage definition and proposed thresholds · "Motor pre-harvest-v0.1".

**Page 2.**
6. Uso de fondos per loan: Tramos | Desembolsado | Conciliado | Pago directo | Sin sustento | Estado, with portfolio total (93% · 72% · 4,930).
7. Decisiones del mes: Fecha | Préstamo | Decisión | Quién ("TruMarket, mecánica" or "TruMarket con conformidad BCP <fecha>") | Base. Note of pending bank decisions.
8. Excepciones abiertas: Préstamo | Desde | Exposición | Plan | Si no se cumple.
9. Próximos 30 días: Fecha | Préstamo | Hito | Monto en juego.
Footer: evidence statement + signature line "Operaciones TruMarket" + issue date.

### 7.2 Exception notice (1 page), example ICA-0201

Issued the same day as the trigger. Sections:
- Header with a bordered state badge "NARANJA".
- "En una frase" (tinted box): what happened, exposure limit, frozen amount, "No requiere su decisión hoy."
- 1. Qué pasó (invoices 68% reconciled; fertilization 3 weeks late; above the naranja band).
- 2. Impacto en su dinero: exposure, frozen tranche, coverage today vs approval, estimated range, assignment and collection account status.
- 3. Qué hizo TruMarket según contrato: numbered list (freeze, investigation, remediation plan with deadline, field estimate brought forward).
- 4. Qué debe decidir el banco y cuándo (bordered box): nothing today; what happens if remediation is or is not verified; red is the bank's decision on TruMarket's written recommendation.
- 5. Evidencia adjunta (two-column list).
- Footer: next update date + signature line.

---

## 8. Thresholds (show on "Método y umbrales")

| Signal | Ámbar | Naranja | Source |
|---|---|---|---|
| Repayment coverage | < 1.50x | < 1.30x (rojo < 1.10x) | Proposed, to approve with BCP Riesgos |
| Crop vigour vs lot baseline | -15% | -30% | Answer Q18 to BCP |
| Invoices vs phase budget | 15% gap | 30% gap or missing | Q18 |
| Field work outside window | > 2 weeks | > 4 weeks | Q18 |
| Fruit set vs expected | | < 80% | Q18 |
| Aforo below pre-sold volume | | naranja, T2 not released | Q18 |
| Grower's aforo > TM's by 15% | | use the lower | Q18 |
| New debt > 20% of line or arrears > 30 days | ámbar | | Q18 |
| Two consecutive ámbar | | naranja | Q18 |
| Payment outside collection account | | | rojo (Q26) |

Effects: ámbar = reinforced follow-up and extra evidence; naranja = next tranche frozen mechanically, reported same day, mandatory investigation, remediation plan with deadline, structure adjustment; rojo = financing stopped, recovery cascade, bank decides on TruMarket's recommendation. Exposure stays limited to what was disbursed.

---

## 9. Example dataset (illustrative; keep all numbers consistent)

Cut-off date: 10 nov 2026. Approval date for all: 15 set 2026 unless stated. Crop: Hass avocado.

### 9.1 Portfolio

| Loan | Zone | Line | Disbursed | Tranches out | State | Coverage approval → today | Projection | Next | Due |
|---|---|---|---|---|---|---|---|---|---|
| ICA-0201 | Santiago, Ica | 24,000 | 16,800 | T1 7,200 + T2 9,600 | Naranja | 1.65 → 1.57 | 1.15 a 1.30 | T3 7,200 congelado | mar 2027 |
| ICA-0188 | Valle bajo de Ica | 36,000 | 10,800 | T1 | Ámbar | 2.10 → 1.75 | 1.55 a 1.65 | T2 14,400 · aforo 15 nov | 14 mar 2027 |
| ICA-0215 | Pueblo Nuevo, Ica | 32,000 | 9,600 | T1 | Ámbar | 1.62 → 1.60 | sin cambio | T2 12,800 · 20 nov | abr 2027 |
| PIS-0034 | Pisco | 28,000 | 8,400 | T1 | Verde | 1.95 → 1.90 | sin cambio | T2 11,200 · su conformidad | abr 2027 |
| ICA-0142 | Villacurí, Ica | 30,000 | 21,000 | T1 9,000 + T2 12,000 | Verde | 2.00 → 2.05 | sin cambio | T3 9,000 · 15 feb | mar 2027 |
| **Total** | | **150,000** | **66,600** | 7 tranches | | portfolio 1.80x | 1.60 a 1.70 | | mar 90,000 · abr 60,000 |

Frozen 7,200; to be disbursed 76,200; repaid 0; provision 666 (1% × 66,600); exposure by state: verde 29,400, ámbar 20,400, naranja 16,800, rojo 0.

Use of funds: ICA-0201 81% reconciled, 55% direct, 3,220 unexplained (T2 at 68%); ICA-0188 96%, 72%, 420; ICA-0215 94%, 80%, 580; PIS-0034 99%, 85%, 80; ICA-0142 97%, 78%, 630; portfolio 93%, 72%, 4,930.

### 9.2 Changes this month

| Loan | Date | From → To | Impact | Cause |
|---|---|---|---|---|
| ICA-0201 | 06 nov | Ámbar → Naranja | "T3 de USD 7,200 congelado. Su exposición queda en USD 16,800." | facturas de la fase 2 un 32% bajo el presupuesto y fertilización 3 semanas fuera de ventana |
| ICA-0188 | 08 nov | Verde → Ámbar | "Cobertura de 2.10x a 1.75x. Sigue sobre el umbral." | vigor del cultivo 16% bajo lo normal para el lote: volumen esperado 10% menor |
| ICA-0215 | 03 nov | Verde → Ámbar | "Capacidad de pago del productor en seguimiento. Cobertura sin cambio (1.60x)." | nueva deuda en el sistema financiero por 24% de la línea (central de riesgos) |
| Toda la cartera | 01 nov | Neutral → En observación | "Cobertura podría bajar 0.10x a 0.20x. Aún no confirmado en campo." | El Niño costero pasó a fuerte; en 2017 y 2023 redujo el cuajado de palta en Ica |

### 9.3 ICA-0188 detail

- Area 4.85 ha; campaign 2026-27, day 56 of 180; due 37,800 on 14 mar 2027; expected net harvest revenue 66,150 (coverage 1.75x); approval revenue 79,380 (2.10x).
- Driver deltas: volumen -0.20, precio -0.10, calidad -0.05, cobranza 0, prestatario 0.
- Coverage history: 15 set 2.10 · 29 set 2.10 · 06 oct 2.10 · 13 oct 2.05 (precio) · 27 oct 2.00 (precio) · 03 nov 1.95 (calidad) · 10 nov 1.75 (vigor).
- Break-even 1.11 USD/kg; expected 1.94 USD/kg (approval 2.04); price -20% → 1.40x; volume -30% → 1.23x.
- SBS Normal; provision 108; score 69 → 62; approved tier B.
- Conditions:

| Group | Condition | Approval | Today | Threshold | State | Effect | Provenance · source |
|---|---|---|---|---|---|---|---|
| Prestatario | Clasificación SBS | Normal | Normal | cualquier baja | Verde | Ninguno | Doc. verificado · Central de riesgos 05 nov |
| Prestatario | Deuda nueva en el sistema | USD 18,200 | USD 19,100 | +20% de la línea | Verde | Ninguno (+2.5% de la línea) | Doc. verificado · Central de riesgos 05 nov |
| Prestatario | Deuda no declarada detectada | Ninguna | Ninguna | cualquiera congela el tramo | Verde | Ninguno | Doc. verificado · Visita + proveedores de la zona 08 nov |
| Prestatario | Tenencia del predio y gravámenes | Título propio · 0 | Título propio · 0 | cualquier gravamen nuevo | Verde | Ninguno | Doc. verificado · SUNARP 05 nov |
| Prestatario | Licencia de agua | Vigente | Vigente | vencida o suspendida | Verde | Ninguno | Doc. verificado · ANA 15 set |
| Cultivo y volumen | Vigor del cultivo vs lo normal del lote | +2% | -16% | -15% ámbar · -30% naranja | Ámbar | Volumen -10% · cobertura -0.20x | Satelital · Sentinel-2 08 nov |
| Cultivo y volumen | Agua disponible vs necesidad | 111% | 104% | bajo 100% | Verde | Ninguno | Satelital · ERA5 + licencia 09 nov |
| Cultivo y volumen | El Niño costero | Moderado | Fuerte | alerta temprana TM | En observación | Volumen -5% a -10% · cobertura -0.10x a -0.20x | Estimado · ENFEN oct 2026 |
| Cultivo y volumen | Seguro agrícola | Vigente | Vigente al 30 abr 2027 | vencido o sin pago | Verde | Ninguno | Doc. verificado · Póliza 10 set |
| Cultivo y volumen | Eventos de zona (paros, bloqueos) | Ninguno | Ninguno | evento que afecte un hito | Verde | Ninguno | Declarado · Monitoreo de zona TM 10 nov |
| Precio y calidad | Precio esperado a cosecha | USD 2.04/kg | USD 1.94/kg | -15% ámbar · -30% naranja | Verde | Cobertura -0.10x | Doc. verificado · Precios FOB de exportación oct |
| Precio y calidad | Fruta exportable | 80% | 78% | bajo 70% | Verde | Cobertura -0.05x | Estimado · Visita 08 sep + sanidad |
| Uso de fondos y cobranza | Facturas de T1 vs presupuesto | Plan USD 10,800 | 96% conciliado | brecha 15% ámbar · 30% naranja | Verde | Ninguno | Doc. verificado · Facturas electrónicas 04 nov |
| Uso de fondos y cobranza | Labores en ventana | Plan de fase 1 | En ventana | +2 sem ámbar · +4 naranja | Verde | Ninguno | Satelital · Sentinel-2 + fotos 08 nov |
| Uso de fondos y cobranza | Cesión de cobros exclusiva | Inscrita | Vigente, sin cesiones a terceros | cualquier cesión a terceros | Verde | Ninguno | Doc. verificado · Registro de facturas negociables 05 nov |
| Uso de fondos y cobranza | Cuenta de recaudo | Abierta | Abierta | pago fuera de la cuenta = rojo | Verde | Ninguno | Doc. verificado · Banco 14 set |
| Uso de fondos y cobranza | Contrato de packing | Firmado | Firmado | rescindido | Verde | Ninguno | Doc. verificado · Contrato 10 set |
| Uso de fondos y cobranza | Orden de compra del comprador | Prevista M3 | En plazo | 14 días tras M3 | Verde | Ninguno | Declarado · Hito M3 1 mar 2027 |

- Use of funds T1: Fertilizantes 4,200 / 4,150 / 100% / "✓ satélite y fotos" · Sanidad 2,100 / 2,100 / 100% / "✓ registro fitosanitario" · Riego y energía 1,600 / 1,480 / 100% / "✓ recibos" · Mano de obra (tope por fase) 2,900 / 2,650 / 0% / "✓ planilla firmada" · Total 10,800 / 10,380 / 72%.
- Audit log: 08 nov estado verde → ámbar (Motor · confirmado por analista TM; vigor -15% vs línea base; Sentinel-2 08 nov) · 05 nov central re-consultada (Operaciones TM; checklist T2) · 15 set T1 liberado (Operaciones TM · conformidad BCP; checklist T1; 4 documentos) · 12 set tier B confirmado (Analista TM; score 69; memorando). Engine version "pre-harvest-v0.1".

### 9.4 ICA-0201 exception

T2 9,600 with 6,528 reconciled (68%), 3,072 unexplained; fertilization planned week 12, seen week 15; T3 7,200 frozen 06 nov; exposure 16,800; coverage 1.65x → 1.57x, estimated 1.15x to 1.30x; aforo brought forward to 20 nov; remediation deadline 5 dic.

---

## 10. Accessibility and quality

- Real `<button>`, `<a href>`, `<table>` with `<thead>`; tablists with `role="tab"` and `aria-selected`.
- Every chart and bar has `role="img"` and an `aria-label` that states the numbers in Spanish.
- Text contrast ≥ 4.5:1, including 12px labels. State is never conveyed by color alone.
- Touch targets ≥ 44px. Works at 375px. Prints on A4.
- `lang="es"` on Spanish pages.

---

## 11. Acceptance checklist

- [ ] Every screen reads top to bottom as Mi dinero → (Control) → Mi riesgo → Qué cambió.
- [ ] No technical reading appears outside "Datos técnicos" and the audit log.
- [ ] Every risk signal shows its effect on coverage in "x" and, where relevant, in USD.
- [ ] Estimated values are ranges with an `Estimado` badge and dashed or hatched styling.
- [ ] Every condition row has provenance badge, source and date.
- [ ] All numbers come from the dataset; totals reconcile (66,600 = sum of disbursed; driver deltas sum to the coverage change; exposure by state sums to disbursed; use-of-funds totals match).
- [ ] Portfolio situation is four cards with bullets, not a paragraph.
- [ ] Loan file has no separate collection-account section; tranches are shown as four columns including the repayment step.
- [ ] Coverage is shown as a time series with threshold zones and projection band.
- [ ] Alert card shows the three hero numbers large and has no technical layer.
- [ ] "Control del dinero" section present on the portfolio and "Control" bullet in the monthly report.
- [ ] No insurer or data-vendor names, no file paths, no pricing tiers, no PD table, no "demo/simulación/IA".
- [ ] No em or en dashes in UI copy; no monospace labels.
- [ ] Example-data chips present on portfolio and every loan file.
- [ ] Reports fit exactly on their A4 pages with nothing clipped.

---

## 12. Coverage of BCP Riesgos questions (why each section exists)

| BCP question (consultas sheet) | Where the dashboard answers it |
|---|---|
| Q2 how visit and evaluation reach the bank | Evidence tabs: informe de visita, JRA-AGRIND, memorando |
| Q3 real vs declared capacity | T2 sized on aforo; vigor and aforo rows |
| Q4 PyME executive at the visit | T2 checklist "Ejecutivo PyME del BCP invitado al aforo" |
| Q7 cash flow and debt capacity | Coverage definition, scenarios, break-even price |
| Q8 informal debt | "Deuda no declarada detectada" row |
| Q10 to Q13 use of funds, cash restriction, direct payment, diversion | Uso de fondos block, three-source check, cash withdrawn USD 0, Control del dinero |
| Q14, Q19 who decides, what happens on freeze | Decision lanes; exception notice |
| Q15 review frequency | Source and date on every value; monthly report; exception notice |
| Q16 harvest history | Evidence tab "histórico de cosechas verificado" |
| Q18 normal vs material deviation | Thresholds and states; Qué cambió table |
| Q20, Q30 satellite vs field | Provenance badges (Satelital vs Doc. verificado) |
| Q21 logistics events | "Eventos de zona" row |
| Q22, Q31, Q32 evidence, supervision, traceability | Audit log, CSV export, engine version |
| Q24 credit insurance | T3 checklist "comprador con cobertura activable"; insurer never named |
| Q25 factoring with third parties | "Cesión de cobros exclusiva" row |
| Q26, Q33 controlled account and repayment | "Cuenta de recaudo" row; repayment step in the tranche ladder |
| Q27 land tenure | "Tenencia del predio y gravámenes" row |
| Q28 track record | Example-data chips |
| Q29, Q34, Q35 model documentation and SBS | Deterministic engine version on every decision; "Método y umbrales" page |

---

## 13. Open decisions (do not invent answers; leave as configurable)

1. Coverage thresholds 1.50x / 1.30x / 1.10x (proposed, pending approval with BCP).
2. Source of the impact function that converts early warnings into volume ranges (reference ranges now, joint calibration later).
3. Whether pricing by tier and expected loss are ever shown.
4. Whether the credit insurer is named.
5. Final wording of the "product as built" framing versus the Fase A answers sent to BCP.
