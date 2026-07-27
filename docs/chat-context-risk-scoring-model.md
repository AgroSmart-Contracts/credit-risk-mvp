# Chat context: TruMarket credit-risk MVP — live scoring model

> **Purpose:** Paste or attach this file as system/context for chats about how credit risk is calculated in `credit-risk-mvp`.
>
> **Authority:** Implementation in code (Jul 2026). Spec docs under `docs/tm-cram-*.md` describe a fuller CRAM engine that is **not** what the dashboard runs today.
>
> **Primary code:** `src/lib/scoring.ts`, `src/lib/scoring-constants.ts`, `src/lib/assessment.ts`, `src/lib/risk-factors.ts`, `src/lib/financing.ts`, `src/lib/product-risk-tables.ts`, `src/lib/route-risk-tables.ts`

---

## 1. What this model is

- **Deterministic rule-based scorecard** (not ML, not PD/LGD/EL).
- Score range **0–100**, **higher = safer**.
- Four dimensions weighted into one overall score → risk tier → financing terms + narrative concerns/mitigants.
- Entry path: deal inputs → `buildRiskAssessment(deal)` → `computeOverallScore(deal)` → UI / financing.

```
Deal
  ├─ computeBuyerScore / computeSupplierScore → computeCounterpartyScore  (35%)
  ├─ computeProductScore   (20%)   ← product risk table OR perishability fallback
  ├─ computeRouteScore     (15%)   ← corridor table OR transit fallback
  └─ computeStructureScore (30%)   ← advance / collateral / insurance / payment terms
        ↓
  overall = round(Σ dim × weight)
        ↓
  getTier(overall) + analyzeRiskFactors + recommendFinancingTerms
```

---

## 2. Overall aggregation

```
overall = round(
  counterparty × 0.35
  + product     × 0.20
  + route       × 0.15
  + structure   × 0.30
)
```

- Each dimension is **clamped to [0, 100]** and **rounded** before weighting.
- Weights live in `DIMENSION_WEIGHTS` (`scoring-constants.ts`).

### Risk tiers (`getTier`)

| Overall | Tier |
|--------:|------|
| ≥ 75 | Low Risk |
| ≥ 60 | Medium-Low Risk |
| ≥ 45 | Medium-High Risk |
| < 45 | High Risk |

---

## 3. Component 1 — Counterparty (35%)

**Purpose:** Buyer/supplier creditworthiness, platform history, relationship, external credit (Coface %).

### Blend

```
counterparty = clamp(
  buyer × 0.6
  + supplier × 0.4
  + relationshipAdjustment
  + externalCreditBonus
)
```

### Buyer score (sum of factors, clamp 0–100)

| Factor | Points |
|--------|--------|
| Years in business | `null` → 15; ≤5 → 10; ≤10 → 20; ≤20 → 30; >20 → **40** |
| License valid | `true` → 15; `false` → 0; unknown/`null` → 8 |
| Platform completion rate | `null` → 15; else `min(25, rate × 0.25)` |
| Avg payment delay (days) | `null` → 15; `0` → 20; ≤5 → 15; ≤15 → 8; else → 0 |

### Supplier score (sum of factors, clamp 0–100)

| Factor | Points |
|--------|--------|
| Years in business | same bands as buyer but max **30** (≤20 and >20 both capped at 30) |
| License valid | same as buyer |
| Platform completion rate | `null` → 15; else `min(30, rate × 0.3)` |
| Quality rejection % | `null` → 13; `0` → 25; ≤3 → 18; ≤8 → 10; else → 0 |

### Relationship adjustment (added to blend)

- `priorDealsBetweenParties ≥ 4` → **+10**
- else `≥ 1` → **+5**
- `relationshipAgeMonths > 12` → **+5** (stacks)

### External credit bonus

| Condition | Bonus |
|-----------|------:|
| `cofaceCoveragePct ≥ 80` | +12 |
| `≥ 50` | +8 |
| `> 0` | +4 |
| else if `externalCreditSignal` OR buyer `creditRating` | +8 |
| else | 0 |

**Note:** Coface **CRA/DRA letter grades** (`cofaceCountryRiskGrade`, `cofaceCompanyRiskGrade`) are stored for narrative / review language. They are **not** converted into points.

**Missing data:** null years/license/completion/delay/rejection use **neutral mid defaults** so scoring does not fail.

**Platform CSV mapper caveats:** often assumes `licenseValid: true`, `avgPaymentDelayDays: 0`, `qualityRejectionRatePct: 0` (optimistic).

**Readiness gate (Counterparties tab only):** `deal-readiness.ts` can block platform rows missing names / YIB / deal value — this does **not** change the math inside `scoring.ts`.

---

## 4. Component 2 — Product (20%)

**Purpose:** Physical / perishability risk of the commodity.

### Path A — product risk table (preferred)

If `deal.productRiskProfile` or `lookupProductRisk(deal.product)` hits `PRODUCT_RISK_TABLE`, return that **table score as-is** (cold-chain/grade adjustments are **not** re-applied).

| Product | Score | Class | Shelf | Cold chain |
|---------|------:|-------|------:|:----------:|
| Fresh Avocado | 82 | Perishable | 35d | yes |
| Fresh Mandarin | 68 | Semi-Perishable | 30d | yes |
| Fresh Blueberries | 42 | Ultra-Perishable | 21d | yes |
| Fresh Strawberries | 28 | Ultra-Perishable | 7d | yes |
| Fresh Grapes | 64 | Perishable | 28d | yes |
| Fresh Ginger | 88 | Semi-Perishable | 60d | no |
| Green Coffee | 94 | Non-Perishable | — | no |
| Cacao Beans | 92 | Non-Perishable | — | no |

### Path B — fallback formula (unknown product)

```
base = {
  Ultra-Perishable: 30,
  Perishable: 50,
  Semi-Perishable: 70,
  Non-Perishable: 90
}[perishabilityClass]

product = clamp(
  base
  + (coldChainRequired ? -10 : 0)
  + gradeAdj   // Grade A / Class I: +10; Grade B / Class II: 0; Industrial: -10
)
```

---

## 5. Component 3 — Route (15%)

**Purpose:** Logistics / corridor risk.

### Path A — corridor table (preferred)

If `routeRiskProfile` or `lookupRouteRisk(origin, destination)` matches `ROUTE_OPTIONS`, return **table score as-is**. Incoterm / transship formula adjustments are **not** applied on table hits.

| Corridor | Score | Transit days | Transships | Flag |
|----------|------:|-------------:|-----------:|------|
| Callao → Buenaventura | 86 | 7 | 0 | Low |
| Callao → Miami | 76 | 12 | 0 | Low |
| Callao → Valencia | 74 | 18 | 1 | Low |
| Callao → Rotterdam | 70 | 22 | 1 | Low |
| Callao → Jebel Ali | 56 | 18 | 1 | Medium |
| Callao → Kaohsiung | 44 | 35 | 1 | High |

### Path B — fallback formula

```
base =
  transit < 10 → 90
  transit ≤ 20 → 75
  transit ≤ 35 → 55
  else → 35

route = clamp(
  base
  + transshipAdj   // 0 → +10; 1 → 0; ≥2 → -15
  + flagAdj        // Low → 0; Medium → -10; High → -25
  + incotermAdj
)
```

**Incoterm adjustments:** EXW −5; FCA/FAS 0; FOB +5; CFR/CPT +3; CIF/CIP +8; DAP/DPU/DDP +10; unknown 0.

---

## 6. Component 4 — Structure (30%) — live MVP path

**Purpose:** Payment / advance / collateral / insurance structure (simple scorecard).

```
base(advancePaymentPct) =
  0 → 20; ≤19 → 35; ≤39 → 55; ≤59 → 75; else 90

structure = clamp(
  base
  + collateralBonus[collateralType]
  + insuranceBonus[insuranceCoverage]
  + paymentTermsAdjustment(paymentTerms)
  + structureRelationshipAdjustment
)
```

### Collateral bonus

| Type | Bonus |
|------|------:|
| None | 0 |
| Personal Guarantee | +5 |
| Warehouse Receipt / Inventory Pledge | +10 |
| Bank Guarantee / Letter of Credit | +15 |

### Insurance bonus

| Coverage | Bonus |
|----------|------:|
| None | 0 |
| Basic | +5 |
| Comprehensive | +10 |
| All Risk | +15 |

### Payment terms adjustment (string match on `paymentTerms`)

| Match | Adj |
|-------|----:|
| cash in advance / prepaid | +15 |
| letter of credit / ` l/c` | +12 |
| against + (bl\|doc) | +8 |
| `\b30\s*day` | +5 |
| `\b60\s*day` | 0 |
| `\b90\s*day` / "90 days" | −12 |
| `\b120` | −20 |
| else | 0 |

### Structure relationship

- ≥5 prior deals → **+7**
- ≥1 prior deal → **+5**
- none → **−8**

**Platform defaults often:** advance 0%, collateral None, insurance None, payment terms “Documentary / against BL…” → payment adj +8, and −8 if no prior relationship.

---

## 7. Outputs after the score

### Assessment package (`assessment.ts` + `risk-factors.ts`)

- Four weighted sub-scores with “why” strings
- Buyer / supplier party scores
- Overall + tier
- Up to **5 concerns** and **5 mitigants** (narrative, not additive to the number)

### Financing (`financing.ts`)

Derived from **overall** only (not from individual dimensions).

| Overall | Max finance % | Required advance % | Risk premium | Decision | Approval |
|--------:|--------------:|-------------------:|-------------:|----------|----------|
| ≥ 80 | 100 | 0 (≥75) | +0.5 | AUTO-APPROVE (≥75) | Automated (≥75) |
| ≥ 70 | 80 | 0 if ≥75 else 10 if ≥65 | +1.5 | AUTO-APPROVE if ≥75 else MANUAL REVIEW if ≥60 | Credit Manager if 60–74 |
| ≥ 60 | 70 | 10 if ≥65 else 20 if ≥55 | +2.5 | MANUAL REVIEW / Credit Manager | |
| ≥ 50 | 50 | 20 if ≥55 else 30 | +4.0 | SENIOR APPROVAL if ≥45 | Credit Director (45–59) |
| < 50 | 0 | 30 | +6.0 | RECOMMEND REJECT if <45 | Executive Override Only (<45) |

- Base rate **6.0%**; final rate = `6.0 + riskPremium`.
- Advance bands cut at 75 / 65 / 55 independently of financing %.
- Decision bands cut at 75 / 60 / 45 independently of financing %.

---

## 8. Data that feeds the live score today

| Source | Effect on live composite |
|--------|--------------------------|
| Deal form / sample deals | Direct inputs to all four dims |
| Product risk table | Overrides product dim when name matches |
| Route corridor table | Overrides route dim when O–D matches |
| Platform CSV → mapper | YIB, prior deals, product/route lookups; optimistic license/delay/rejection |
| Trade PDF extraction | Fills deal draft fields used by scorecard |
| Coface PDF | `cofaceCoveragePct` → external bonus; CRA/DRA grades narrative only |
| Veritrade / market-intel / SUNAT helpers | Code exists under `src/lib/market-intel/` — **not wired** into `computeCounterpartyScore` / assessment path |
| Cash-flow Structure Sub-A/D model | `src/lib/transaction-structure/` — **parallel**, not in overall |
| CRAM point helpers / Product×Market pair table | `cram-scoring.ts`, `product-market-pair-table.ts` — **not called** by live route/product scores |
| Target CRAM engine (40/25/20/15, letter tiers, vetoes) | Spec only — **not implemented** as the live composite |

---

## 9. Explicit non-goals / gaps (do not invent these)

When answering questions, **do not claim** the live MVP currently does any of:

1. Full CRAM composite `A×0.40 + B×0.25 + C×0.20 + D×0.15` or letter tiers A–D
2. Hard Coface Gate 1 / insurance veto (uninsured deals still score)
3. PD / LGD / expected loss
4. Veritrade customs history inside Dim A
5. Product×Market pair override or 35-day perishables High floor on the live route score
6. Cash-flow transaction-structure model as Dim D of overall

Those are scaffolding or target-spec items beside `scoring.ts`.

---

## 10. File index (live path)

| File | Role |
|------|------|
| `src/lib/scoring.ts` | Buyer/supplier/CP/product/route/structure + overall + tiers |
| `src/lib/scoring-constants.ts` | Weights + dimension labels |
| `src/lib/assessment.ts` | Assembles `RiskAssessment` for UI |
| `src/lib/risk-factors.ts` | Concerns / mitigants |
| `src/lib/financing.ts` | Terms from overall |
| `src/lib/product-risk-tables.ts` | Product lookup table |
| `src/lib/route-risk-tables.ts` | Corridor lookup table |
| `src/lib/platform-deal-mapper.ts` | CSV → Deal defaults |
| `src/lib/deal-readiness.ts` | Platform counterparty readiness gate |
| `src/App.tsx` | Orchestration |
| `docs/risk-calculation.md` | Human-readable twin of live scoring |
| `docs/tm-cram-engine-spec-2026-06.md` | Target CRAM (not live) |

---

## 11. One-line summary for the model

**Live risk = weighted scorecard (Counterparty 35% + Product 20% + Route 15% + Structure 30%), table-backed product/route when known, neutral defaults for missing counterparty fields, then tier + financing heuristics from the overall number — not full CRAM and not a PD model.**
