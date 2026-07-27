# Transaction Structure Scoring Model — Formula & Integration Reference

**Prepared by:** Kanato Foley (TruMarket) · **Last updated:** 2026-07-11
**Purpose:** complete, precise reference to the Transaction Structure scoring model's formulas, calibration, and data shape — for whoever is integrating this with the other three CRAM dimensions (Counterparty, Product, Trade Route).

---

## 1. What this model is

This is TruMarket's Credit Risk Assessment Framework (CRAM), Transaction Structure dimension: a 0–100 score (plus a tier and a recommended protocol) that quantifies the risk embedded in *how a specific deal is structured* — payment timing, collateral/security, and downside resilience if the buyer doesn't pay. It does **not** assess counterparty creditworthiness, product/perishability risk, or trade-route/logistics risk — those are separate dimensions being built independently (Sylvia is building Counterparty, Product, and Trade Route).

Two implementations exist and are kept numerically identical:
- **Excel workbook:** `Product/transaction-structure-scoring-model.xlsx` — the original, sheet-based model.
- **HTML dashboard:** `Product/transaction-structure-dashboard.html` — a standalone JS reimplementation, same formulas, built for easier data entry and eventual integration.

Both are internal, confidential documents (real counterparty names and deal figures) — not for external distribution outside TruMarket.

---

## 2. Where this fits in the CRAM

Per the CRAM spec (`credit_risk_framework_banking.md`), the overall rating combines four dimensions: **Counterparty, Product, Trade Route, Transaction Structure**. This model covers Transaction Structure only.

**Unresolved (this is the main open question for integration):** whether Transaction Structure should be:
- (a) a **standalone score** with its own tier/protocol, used independently, or
- (b) a **weighted component** feeding into one CRAM-wide aggregate rating (in which case its own tier/protocol columns would defer to the aggregate rather than triggering action on their own).

Not decided yet — flagged for whoever does the four-dimension merge.

A second, related open item: the CRAM's original spec lists "Deal Size relative to Counterparty Capacity" under Transaction Structure (section 1.1), but on review this is really a **Counterparty Risk** question (is this deal sized appropriately for what this specific buyer/supplier normally handles) — it was deliberately **not** implemented in this model. Whoever builds Counterparty Risk should consider adding it there.

---

## 3. Input schema — what a deal needs

Every deal is a flat record with these fields (types match the dashboard's internal representation; the Excel equivalent cell locations are listed in §9):

| Field | Type | Notes |
|---|---|---|
| `label` | string | Deal identifier/description |
| `purchaseTotal` | number (USD) | Total paid to supplier |
| `saleTotal` | number (USD) | Total collected from buyer |
| `supAdvDay`, `supAdvPct` | number, 0–1 fraction | Supplier Advance: day offset, % of purchase total |
| `supFinDay`, `supFinPct` | number, 0–1 fraction | Supplier Final: day offset, % of purchase total |
| `buyFirstDay`, `buyFirstPct` | number, 0–1 fraction | Buyer First payment: day offset, % of sale total |
| `buyFinalDay`, `buyFinalPct` | number, 0–1 fraction | Buyer Final payment: day offset, % of sale total |
| `advancePct` | number, 0–100 | Buyer-side advance payment %, entered directly on a 0–100 scale (not 0–1) |
| `contractType` | enum: Spot / Forward / Seasonal | |
| `dealPurpose` | enum: Export / Retail / Processing / Resale | |
| `ownership` | enum: Yes / No | TM Product Ownership |
| `collectionRights` | enum: Yes / No | Vienna Convention / CISG collection rights |

Note on units: in the dashboard's UI, the four `*Pct` cash-flow fields and the severity assumption are displayed to the user as whole numbers (0–100) but stored/computed internally as 0–1 fractions. `advancePct` is the one exception — it's both displayed *and* stored as 0–100, because it's used directly as points (see §6).

---

## 4. Cash-flow engine (feeds Sub-A and Sub-D)

Four signed cash events per deal, in this order:

```
Supplier Advance : day = supAdvDay,   amount = -supAdvPct  × purchaseTotal
Supplier Final    : day = supFinDay,   amount = -supFinPct  × purchaseTotal
Buyer First       : day = buyFirstDay, amount = +buyFirstPct × saleTotal
Buyer Final       : day = buyFinalDay, amount = +buyFinalPct × saleTotal
```

Running cumulative position:
```
cum1 = SupplierAdvanceAmount
cum2 = cum1 + SupplierFinalAmount
cum3 = cum2 + BuyerFirstAmount
cum4 = cum3 + BuyerFinalAmount
```

Derived figures:
```
Peak Negative Position   = MIN(cum1, cum2, cum3, cum4)         — max capital at risk
Exposure Duration        = buyFinalDay − supAdvDay              — full round-trip days
Best Case Margin         = cum4                                 — base case, 0% claim
```

**Sensitivity 1 (timing):** scenarios add days to shipment/buyer-payment; Peak Negative Position is invariant to timing in a back-to-back FOB structure — only Exposure Duration stretches.

**Sensitivity 2 (quality/price claim):** for claim% ∈ {0%, 10%, 25%, severity}:
```
AdjustedBuyerFinal = BuyerFinalAmount × (1 − claim%)
ResultingMargin    = cum3 + AdjustedBuyerFinal
```
The `severity` row **is** Sub-D's worst case (see §7) — same cell, single source of truth.

**Breakeven claim %** (where margin = 0):
```
ratio = 1 + cum3 / BuyerFinalAmount
breakeven = ratio,  unless ratio > 1 → "N/A (>100%, cannot break even via this tranche)"
                     or ratio < 0 → "N/A (already negative at 0% claim)"
```

---

## 5. Sub-Score A — Payment Terms & Cash Flow Exposure

```
Sub-A = PaymentTermsPts × w_paymentTerms
      + AdvancePts      × w_advancePct
      + ContractTypePts × w_contractType
      + DealPurposePts  × w_dealPurpose
```

- **PaymentTermsPts**: bucket lookup on Exposure Duration (days) — see §9 for current thresholds.
- **AdvancePts**: `clamp(advancePct, 0, 100)` — linear, no lookup table. (Buyer-side advance %, not the supplier-side advance modeled in the cash-flow engine.)
- **ContractTypePts / DealPurposePts**: exact-match lookup — see §9.

---

## 6. Sub-Score B — Collateral & Security Coverage

**Currently weighted 0% in the composite** (see §2/§10 — zeroed per Kanato's instruction, "collateral and security coverage does not apply for these deals"). Still computed and displayed for reference, just doesn't count toward the score.

```
OwnershipCollectionPts = 100 if (ownership='Yes' OR collectionRights='Yes') else 0
                         + 10 stacking bonus if BOTH are 'Yes', capped at 100

CollateralValue = BuyerFirstAmount   (from the cash-flow engine)
DealSize        = saleTotal
CoverageRatio   = CollateralValue / DealSize
CoverageRatioPts = bucket lookup on CoverageRatio (5% increments, linear 0→100 — see §9)

Sub-B = OwnershipCollectionPts × w_ownershipCollection + CoverageRatioPts × w_coverageRatio
```

**⚠ Known issue (audit finding, not fixed — logged per Kanato's explicit instruction to leave as-is):** `CollateralValue` and `DealSize` are both derived from the same two cash-flow numbers (Buyer First Amount and Sale Total), so `CoverageRatio` is mathematically identical to Buyer-First-Payment % by construction — it isn't an independent variable. Combined with Ownership/Collection Rights being effectively locked at 100 (Collection Rights is CISG-driven and scores "Yes" for essentially every deal), Sub-B currently has no independently-discriminating input. This is moot right now since B's weight is 0%, but matters if B is ever reactivated.

**Also note:** the collection-rights convention — per AC, Collection Rights (Vienna Convention/CISG) scores "Yes" for every deal, since CISG applies automatically given the jurisdictions involved (this is not a case-by-case assessment).

---

## 7. Sub-Score D — Downside Resilience (Upside:Downside Ratio)

```
WorstCaseMargin = cum3 + BuyerFinalAmount × (1 − severity)
```
`severity` = the assumed worst-case claim % on the Buyer Final tranche. **Currently 100%** — i.e. the worst case models *total non-payment* of the final tranche, not a partial claim. This is a single named cell (Cash Flow & Sensitivity `B43` in Excel / `CONFIG.severity` in the dashboard) referenced everywhere as the single source of truth.

```
if WorstCaseMargin >= 0:
    Sub-D = 100   ("no downside" — even total non-payment on the final tranche doesn't create a loss)
else:
    Ratio = BestCaseMargin / |WorstCaseMargin|
    Sub-D = bucket lookup on Ratio (see §9)
```

This is the **only** place where an entire deal category (buyer simply doesn't pay at all) gets modeled — it is a payment/collection-risk measure. It is **not** the same thing as fulfillment risk (see §11's caliber-mismatch findings) — those are separate, currently uncaptured risks.

---

## 8. Composite score, tiers & protocol

```
Composite = Sub-A × w_A + Sub-B × w_B + Sub-D × w_D
```
(A sub-dimension for Insurance, "C," exists in the calibration sheet at 0% weight and has been fully removed from the input/output pages — see §10's change history. **The composite formula does not reference an Insurance cell at all** — reactivating Insurance would require rebuilding an input section and editing this formula, not just changing a weight.)

```
Tier = first tier (checked highest to lowest) where Composite >= tier.min
```

| Tier | Min score | Protocol |
|---|---|---|
| Strong | 80 | Standard terms, fast-track routing |
| Adequate | 60 | Proceeds at policy-minimum collateral/advance requirements |
| Weak | 40 | Requires additional collateral/insurance or reduced financing % before approval |
| Insufficient | 0 | Restructure required, or escalate/decline |

---

## 9. Current calibration (as of 2026-07-11)

**Top-level weights:**

| Dimension | Weight |
|---|---|
| A · Payment Terms & Cash Flow Exposure | 50% |
| B · Collateral & Security Coverage | 0% |
| C · Insurance Protection | 0% (removed) |
| D · Downside Resilience | 50% |

**Sub-weights within A:**

| Variable | Weight |
|---|---|
| Payment Terms (days) | 60% |
| Advance Payment % | 10% |
| Contract Type | 15% |
| Deal Purpose | 15% |

**Sub-weights within B:** Ownership+Collection 50% / Coverage Ratio 50%.

**Binary points & stacking (Ownership/Collection):** Yes = 100 pts, No = 0 pts, +10 stacking bonus if both Yes, capped at 100.

**Bucket table — Payment Terms (days → points):**

| Min days | Points |
|---|---|
| 0 | 100 |
| 30 | 80 |
| 35 | 60 |
| 45 | 40 |
| 60 | 20 |
| 91 | 0 |

*(Reads as: <30 days→100, 30–35→80, 35–45→60, 45–60→40, 60–90→20, >90→0.)*

**Bucket table — Contract Type:** Spot=100, Forward=60, Seasonal=40.
**Bucket table — Deal Purpose:** Export=100, Retail=80, Processing=60, Resale=40.

**Bucket table — Collateral Coverage Ratio (5% increments, linear):** 0→0, 0.05→5, 0.10→10 … 1.00→100.

**Bucket table — Upside:Downside Ratio (concave curve, ~√ratio×50 below 1.0):**

| Min ratio | Points |
|---|---|
| 0.0 | 0 |
| 0.2 | 20 |
| 0.4 | 30 |
| 0.6 | 40 |
| 0.8 | 45 |
| 1.0 | 50 |
| 1.5 | 60 |
| 2.0 | 70 |
| 3.0 | 80 |
| 5.0 | 90 |
| 10.0 | 95 |
| "no downside" (worst case ≥ 0) | 100 |

**Severity assumption:** 100% (total non-payment on Buyer Final tranche).

**All bucket lookups are ascending "floor" matches** — the largest threshold ≤ your value applies.

### Calibration change history (this session, 2026-07-10/11)

Everything below is discretionary/qualitative, not calibrated against historical default data (only 2 real deals exist so far) — treat all current values as provisional:

| Change | From → To | Reason |
|---|---|---|
| Payment Terms day buckets | 0/16/31/46/61/91 → 0/30/35/45/60/91 | Recalibrated to align with common invoice-term breakpoints (30/45/60/90 day terms) |
| Sub-A weights | 35/35/15/15 → 60/10/15/15 (Payment Terms/Advance/Contract/Purpose) | Advance Payment % hasn't differentiated either real deal (both 0%); weight shifted to Payment Terms, which was felt to be under-weighted relative to duration risk |
| Top-level weights | 15/35/50 (A/B/D) → 40/0/60 → 50/0/50 | Collateral & Security Coverage deemed not applicable to these deals' risk profile; weight redistributed to Payment Terms and Downside Resilience, landing at an even split |
| Upside:Downside Ratio bucket table | Linear (0→0…1.0→50) → concave (√ratio×50, rounded) | Felt the linear scale under-credited deals with meaningful-but-partial downside protection |

---

## 10. Worked examples (real deals, current calibration)

### TM-2026-012/014 — Peru Mandarin (Bio Farming Peru → TM → Terra Trading, Colombia)

**Inputs:** Purchase Total $30,881.50, Sale Total $35,419.20 (see §11 — a $628 reconciliation issue exists on the source contract; this is the figure currently used). Supplier Advance day 0 (60%), Supplier Final day 7 (40%), Buyer First day 7 (60%), Buyer Final day 32 (40%). Advance Payment % 0. Contract Type Spot. Deal Purpose Export. Ownership Yes, Collection Rights Yes.

| | Value |
|---|---|
| Cumulative after each event | −$18,528.90 → −$30,881.50 → −$9,629.98 → **$4,537.70** |
| Peak Negative Position | −$30,881.50 |
| Exposure Duration | 32 days |
| Best Case Margin | $4,537.70 |
| Worst Case Margin (100% claim) | −$9,629.98 |
| Upside:Downside Ratio | 0.4712 |
| Sub-A | 78.0 |
| Sub-B | 80.0 *(not counted — weight 0%)* |
| Sub-D | 30.0 |
| **Composite** | **54.0** |
| **Tier** | **Weak** |

### TM-2026-015 — Peru Blueberries (RVR Agro → TM → Happy Farmers Family/Joy Lee, Taiwan) [draft contract]

**Inputs:** Purchase Total $34,360.00 (corrected from an initial $21,240 — see §11), Sale Total $64,000.00. Supplier Advance day 0 (0%), Supplier Final day 0 (100%), Buyer First day 3 (70%), Buyer Final day 38 (30%). Advance Payment % 0. Contract Type Spot. Deal Purpose Export. Ownership Yes, Collection Rights Yes.

| | Value |
|---|---|
| Cumulative after each event | $0 → −$34,360.00 → $10,440.00 → **$29,640.00** |
| Peak Negative Position | −$34,360.00 |
| Exposure Duration | 38 days |
| Best Case Margin | $29,640.00 |
| Worst Case Margin (100% claim) | $10,440.00 → **≥ 0, "no downside"** |
| Sub-A | 66.0 |
| Sub-B | 85.0 *(not counted — weight 0%)* |
| Sub-D | 100.0 |
| **Composite** | **83.0** |
| **Tier** | **Strong** |

---

## 11. Known issues / audit findings relevant to integration

These are real, verified findings from auditing the source contracts directly — not modeling artifacts. Listed because several of them bear on how other CRAM dimensions (especially Counterparty and Product) should be scoped, to avoid duplicate or conflicting coverage.

1. **Deal reference mismatch.** The two Mandarin contracts reference the same physical transaction under two different deal numbers (TM-2026-012 on the purchase side, TM-2026-014 on the sale side) — confirmed verbally by AC, not cross-referenced in either document.
2. **Sell-side reconciliation gap ($628).** The Mandarin sale contract's itemized caliber table sums to $36,047.20 (matches its own stated total exactly), but its payment schedule's two tranches sum to $35,419.20 — a $628 gap. The tranches were computed as 60/40 of $35,419.20, not of the true $36,047.20. This model currently uses **$35,419.20**. On later, careful re-derivation, the itemized total ($36,047.20) is more likely the true deal value, meaning TM may be owed $628 more than currently invoiced — an open collections question, not yet resolved with AC/Terra Trading. **Recomputing the score with the corrected total does not change the tier** (Sub-B's ratio is scale-invariant; Sub-D's ratio moves from 0.4712 to ~0.558, same bucket).
3. **Caliber/grade mix mismatch (Mandarin).** TM purchased 918 boxes of X-caliber + 1,378 of 2X/3X from its supplier, but is contracted to deliver 1,148 of each to its buyer — same total box count (2,296), different size-grade split. A 230-box shortfall in X-caliber and a 230-box surplus in 2X/3X with no assigned buyer. **Not scored anywhere in this model** — this is a fulfillment/Product risk, not a Transaction Structure one. A cost-accounting analysis found the currently-"confirmed" margin ($4,537.70) assumes this gap resolves for free; a genuine worst case (partial delivery + unsellable surplus) computes closer to **$1,600.70**, and a genuine best case (both positions resolve at original contract rates) computes closer to **$5,832.70** — a real ±$4,200 range this model doesn't capture.
4. **Caliber mismatch (Blueberry).** RVR sold 14mm+ caliber blueberries; the contract calls for 16mm+. Same category of issue as #3, still open, unrelated to the cost-basis correction below.
5. **Blueberry cost-basis correction.** Original purchase order stated "4,000 kg" while the sales agreement's "4,000" was actually cartons (≈6,000 kg) — a unit-labeling error across the two documents. AC confirmed the sales agreement's 6,000kg governs; corrected purchase cost = 6,000kg × $4.50/kg × 1.18 IGV + $2,500 EXW→FOB logistics = $34,360.00 (was $21,240.00 on the stale figure).
6. **Sub-B's Coverage Ratio circularity** (see §6) — currently irrelevant since B's weight is 0%, but would need addressing before B is ever reactivated.
7. **Insurance removal isn't a "one-line" reactivation** (see §8) — its input rows were deleted, not zeroed, and the composite formula doesn't reference it.
8. **Advance Payment % hasn't differentiated either real deal** (0% on both) — a watch item, not evidence the variable is miscalibrated; needs more data.
9. **Asymmetric advance-payment risk.** TM frequently advances a large % to its own supplier unsecured (e.g. 60% on Mandarin) while its buyer puts 0% down before shipment. This model only scores the downstream/buyer-facing side of that exposure — TM's upstream supplier-advance risk isn't captured anywhere in Transaction Structure. Worth deciding whether that belongs here, in Counterparty Risk, or as a new factor.
10. **"Deal Size vs. Counterparty Capacity"** — see §2, redirected to Counterparty Risk.

---

## 12. File & implementation notes

- **Excel:** `Product/transaction-structure-scoring-model.xlsx`. Sheets: `Overview`, `Scorecard Reference` (all bucket tables), `Weights & Tiers Config` (all weights/tiers — the "calibration knobs"), `Cash Flow & Sensitivity`, `Deal Inputs & Score`, `Open Design Questions`. A dropdown deal-selector on `Deal Inputs & Score!B3` requires Excel COM automation to attach correctly if ever rebuilt — openpyxl-created data validations have not persisted reliably on this file in the past; direct XML editing (unzip → edit sheet XML → re-zip) has been the reliable method for calibration changes.
- **Dashboard:** `Product/transaction-structure-dashboard.html`. Self-contained vanilla JS/CSS, no external dependencies, opens via any browser (`file://` or a local server). All formulas mirror the Excel exactly (see `CONFIG` object and `computeScore()`/`computeCashFlow()`/`computeSensitivity()` functions in the `<script>` block). Deals persist to the browser's `localStorage`; use the Export/Import JSON buttons to move data in and out. Not published anywhere — local file only, given real counterparty data.
- **Output shape** (for anyone building an aggregator across CRAM dimensions) — a natural, currently-implicit contract this model produces per deal:
  ```
  {
    dealId, subA, subB, subD, composite, tier, protocol,
    // plus supporting detail: exposureDuration, bestCaseMargin, worstCaseMargin, upsideDownsideRatio
  }
  ```
  This isn't a formally defined interface yet (see §2's standalone-vs-component question) — treat it as a starting proposal, not a locked contract.

---

## 13. Open questions for whoever merges the CRAM dimensions

- Standalone score vs. weighted component in an overall aggregate (§2).
- Where "Deal Size vs. Counterparty Capacity" should live (§2) — proposed: Counterparty Risk.
- Where the caliber-mismatch / fulfillment-risk findings (§11, #3–4) should live — likely Product Risk, not currently covered by any dimension.
- Whether TM's upstream supplier-advance exposure (§11, #9) belongs in Transaction Structure, Counterparty Risk, or as a new cross-cutting factor.
- Raw USD vs. coverage-ratio scoring for Collateral/Insurance Value — this model deviated from the CRAM's literal spec (flat USD) to ratios; not yet confirmed final with AC.
