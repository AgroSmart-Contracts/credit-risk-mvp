---
moc: "[[MOC-Product]]"
tags: [trumarket, ops-documentation, sop-system, cram, scoring-engine, plan, confidential]
version: 0.1-DRAFT
status: BUILD-SPEC
source: TruMarket-CRAM-Investor-Briefing-2026-05-07 (v3.3)
companion_to: [tm-agent-native-architecture-2026-06, tm-input-schema-and-placeholder-map-2026-06, playbooks/deal/D1-intake-classify]
classification: CONFIDENTIAL — proprietary scoring IP. Internal only. Never in counterparty-facing documents or the anonymised dataset (SOP-006/006D).
---

# CRAM Engine Spec — `compute_cram`

**Date:** 3 June 2026 · **Owner:** AC · **Status:** BUILD SPEC (v0.1)
**Source of record:** CRAM Investor Briefing v3.3. Where this spec and the briefing differ, the briefing governs.
**Purpose:** Define the versioned config the `compute_cram` primitive runs at deal stage **D4**. It is a **transparent rules engine** — given the deal's captured data, it produces a reproducible composite score, a tier, and a full scorecard where every point is traceable to a variable and rule. The agent proposes; a human confirms the tier (always-human gate).

> **This is not AI judgment.** The engine applies the documented rubric deterministically. The only "AI" parts are (a) normalising inputs and (b) proposing values for the few qualitative variables, each surfaced with its rationale for human confirmation. The score is explainable and reproducible — which is what makes it safe to gate capital on, and what the bank pilot / IC diligence require.

---

## 1. Invocation & sequence

`compute_cram(deal_ref)` is called at **D4**, and only after the prior gate:

1. **Gate 1 — Coface (before CRAM).** Confirm Coface buyer-default cover is placed for this deal. If Coface declines, the deal does not execute — `compute_cram` is not run. (CRAM is Gate 2; briefing §5–6.)
2. **Single-veto pre-check.** Evaluate the veto register (§6). Any veto → return `tier = VETO` with the reason; do not bother computing a composite that a veto would override.
3. **Score.** Compute the four dimension sub-scores, the composite, the tier, and pricing (§4–5).
4. **Human gate.** Present the scorecard; the human **confirms the tier** (decision token). The engine never finalises the tier itself.

Manual-first: every input the engine needs is captured in the registers or provided by the human; no platform API is required (counterparty-performance variables live in the Counterparty Master, updated at E7 closure).

---

## 2. Model shape

- Four dimensions, each a **0–100 sub-score** anchored to a base, with variables adding/subtracting points, clamped to [0,100].
- Composite = weighted sum of the four sub-scores.
- Composite → tier letter → financing terms + supplier-facing pricing.

| Dimension | Composite weight | Base score |
|-----------|-----------------|------------|
| A. Counterparty | 40% (Buyer 50% / Supplier 50% within) | 50 |
| B. Product | 25% | 70 |
| C. Trade-Route | 20% | 70 |
| D. Transaction-Structure | 15% | 60 |

```
Composite = A×0.40 + B×0.25 + C×0.20 + D×0.15      (each sub-score clamped 0–100)
```

---

## 3. Inputs & sourcing (what the engine reads)

The engine consumes data already captured — this is what makes scoring a *computation*, not a fresh data-entry step. Sources:

| Source | Provides |
|--------|----------|
| **Counterparty Master** | platform deal counts, completion/on-time rates, prior-deals count, relationship age, years in business, license validity, certifications, credit rating, capacity (the auto-populated performance block + onboarding attributes) |
| **Deal Register** | commodity, variety, grade, quantity, unit_price, incoterm, ports, vessel/ETD, ETA, freight type, payment terms, advance %, collateral, insurance |
| **Reference tables (Git)** | route-risk table (origin→destination), perishability class by commodity, phytosanitary cold-treatment corridors |
| **External feed** | **price-vs-market benchmark** (the single highest-signal fraud variable) — needs a benchmark source; flag below |
| **Human context (~10–15%)** | capacity figures, freight-forwarder identity if unbooked, optional credit rating |

**Two feeds to stand up:** (1) the price-vs-market benchmark, and (2) the route-risk reference table. Until they exist, the engine flags those variables as `NEEDS_INPUT` and the human supplies them — the score still computes, with those contributions marked provisional.

---

## 4. The scoring model (v3.3 indicative point rules)

> Point values below are the **indicative** rules disclosed in briefing v3.3 §4. The full production point tables are deeper-NDA; AC to confirm the production tables before go-live. Encode these as the v0.1 config; version any change (§8).

### 4.A Counterparty (40%) — base 50 · Buyer 50% / Supplier 50%

**Buyer sub-score** (within-buyer weights):

| Variable | Wt | Source | Points |
|----------|----|--------|--------|
| Platform deals + completion rate | 40% | Counterparty Master | ≥10 deals +20 / ≥5 +10 / ≥1 +5 · completion ≥95% +15 / ≥80% +10 / ≥60% +5 / <60% −10 |
| Years in business | 25% | trade reg | ≥10y +15 / ≥5y +10 / ≥2y +5 / <2y −5 |
| Credit rating (3rd-party) | 20% | external (optional) | AAA–AA +15 / A–BBB +10 / BB–B +5 / ≤CCC −15 |
| Import license validity | 10% | license cert | Valid +10 / **Invalid −20 (veto-grade)** |
| Capacity (deal vs monthly) | 5% | buyer financials (opt) | ≤50% +5 / >2× −10 |

**Supplier sub-score** (within-supplier weights):

| Variable | Wt | Source | Points |
|----------|----|--------|--------|
| Platform deals + on-time rate | 40% | Counterparty Master | ≥10 +20 / ≥5 +10 · on-time ≥90% +15 / ≥75% +10 / <50% −15 |
| Years in business | 25% | trade reg | ≥10y +15 / ≥5y +10 / <2y −10 |
| Quality certifications | 15% | cert uploads | multiple +15 / at least one +10 |
| Export license validity | 15% | license cert | Valid +15 / **Invalid −25 (veto)** |
| Capacity (deal vs production) | 5% | facility docs (opt) | ≤30% +5 / >100% −15 |

**Relationship signals** (cross-applied within Counterparty): prior deals ≥10 +10 / ≥5 +7 / ≥1 +5 / 0 −10. Relationship age used contextually (long relationship + many deals = strong; many deals in a short window = weaker).

### 4.B Product (25%) — base 70

| Variable | Wt | Source | Points |
|----------|----|--------|--------|
| Perishability class | 30% | phyto / spec | Non-perishable +18 / Semi (>30d) +9 / Perishable (7–30d) −4 / Ultra (<7d) −12 |
| Price vs market | 30% | **benchmark feed** | within ±5–15% +20 / >+30% −22 / <−30% −18 |
| Quality grade | 30% | quality/inspection cert | A/Class I +18 / B/Class II +5 / Industrial +8 |
| Standardisation & phyto | 10% | phyto + description | properly classified +10 (incl. EUDR-readiness flag for EU-scope commodities) |

### 4.C Trade-Route (20%) — base 70

| Variable | Wt | Source | Points |
|----------|----|--------|--------|
| Transit time × freight | 25% | BL/booking | air ≤2d +18 / 2–5d +12 · ocean reefer ≤14d +14 / 14–21d +6 / >21d −10 · ocean non-perish ≤30d +12 / >60d −8 |
| Transshipments × freight | 20% | BL | ocean direct +15 / 1 +3 / ≥2 −10 · **air direct +15 / 1 −10 / ≥2 −20 (veto-grade)** |
| Incoterms | 20% | invoice/contract | EXW −8 / FCA,FAS 0 / FOB +8 / CFR,CPT +5 / CIF,CIP +12 / DAP,DPU,DDP +15 |
| Route-risk flag + cold-treatment | 15% | route table + phyto | Low +12 / Med +3 / High −15 · cold-treatment-required & protocol absent: additional −5 |
| Cold-chain requirement | 15% | handling docs | required+documented −5 / required+incomplete −12 / not required 0 |
| Customs clearance time | 5% | dest. history | ≤3d +5 / >7d −8 |

### 4.D Transaction-Structure (15%) — base 60

| Variable | Wt | Source | Points |
|----------|----|--------|--------|
| Collateral structure | 35% | collateral docs | LC +25 / Bank Guarantee +20 / Warehouse Receipt +15 / Inventory Pledge +10 / Personal Guarantee +5 / None −5 · +5 if fully covers deal value |
| Payment terms | 25% | contract/invoice | Cash-in-advance +25 / LC +20 / CAD +15 / 30d +10 / 60d 0 / 90d −10 / 120d+ −18 |
| Relationship history | 25% | Counterparty Master | ≥10 +15 / ≥5 +12 / ≥1 +8 / 0 −12 |
| Advance payment % | 10% | contract | ≥50% +10 / ≥25% +7 / ≥10% +5 |
| Insurance (mandatory floor) | 5% | insurance cert | All-Risk +5 / Comprehensive +3 / Basic +1 / **None → does not execute (veto)** |

---

## 5. Composite → tier → pricing

| Tier | Composite | Treatment | Pricing (60-day total fee) |
|------|-----------|-----------|----------------------------|
| A | ≥ 80 | auto-approve, full financing %, no advance | 7.0% |
| B | 65–79 | standard terms | 8.0% (reference) |
| C | 50–64 | enhanced collateral / smaller ticket, advance required, Type A only | 9.5% |
| D | < 50 | manual / senior review; typically declined or restructured | manual |

**Tenor multiplier** on the per-tier 60-day base, with a **5% floor**:

| Terms | ×mult | A | B |
|-------|------|---|---|
| ≤30d | 0.55 | 5.0% (floor) | 5.0% (floor) |
| 45d | 0.80 | ~5.6% | ~6.4% |
| 60d | 1.00 | 7.0% | 8.0% |
| 90d | 1.40 | ~9.8% | ~11.2% |
| 120d | 1.75 | ~12.25% | ~14.0% |

`fee_pct` (Deal Register, derived) = tier base × tenor multiplier, floored at 5%.

---

## 6. Single-veto register (hard stops, evaluated first)

Any one of these sinks the deal regardless of composite (briefing §4.6):

- Invalid **import** license (buyer) or invalid **export** license (supplier)
- **No cargo insurance** (mandatory baseline)
- **≥2 transshipments by air**
- **Ultra-perishable + cold-chain execution deficient** (specs/certification incomplete)

On any veto: `compute_cram` returns `tier = VETO`, the triggering variable(s), and stops. The deal goes to manual/senior review (does not auto-proceed).

---

## 7. Output — the scorecard + human gate

`compute_cram` returns a **transparent scorecard**, written to the Deal Register + the deal's `context.md`:

```
deal_ref · computed_at · engine_version
Gate 1 Coface: <confirmed | n/a>
  Request: country=<cofaceRequestCountry> buyer=<cofaceRequestBuyerName> requested USD=<cofaceRequestedCoverageAmountUSD>
  Response: country risk=<cofaceCountryRiskGrade> company risk=<cofaceCompanyRiskGrade> approved USD=<cofaceCoverageAmountUSD> cover=<cofaceCoveragePct>%
Veto check: <none | variable + reason>

A Counterparty  <sub-score>/100   ( Buyer <x> / Supplier <y> )   → contributes <A×0.40>
   <each variable: value → points>
B Product       <sub-score>/100                                  → contributes <B×0.25>
C Route         <sub-score>/100                                  → contributes <C×0.20>
D Structure     <sub-score>/100                                  → contributes <D×0.15>

Composite: <0–100>   Proposed tier: <A/B/C/D>   Proposed pricing: <fee_pct>
Provisional inputs (benchmark/route feeds pending): <list, if any>
```

The human (AC, or Chiara in backup) **confirms or overrides the tier** — this is the always-human gate. An override requires a logged reason (briefing §4.5.B override discipline); overrides that later produce worse-than-tier outcomes feed recalibration. Confirmed tier + pricing flow into D5 approval and the generated agreements.

---

## 8. Learning loop & versioning

- **Closure capture (E7):** record predicted tier vs actual outcome on the deal. Feeds quarterly recalibration of variable points, tier cut-offs, corridor tables, and benchmarks (briefing §4.6, §10).
- **Version-controlled config:** this spec is the engine config, in Git. Weight/cut-off changes require AC sign-off + a documented rationale (briefing §10). Every `compute_cram` run records `engine_version` (reproducibility — architecture R9).
- This is the compounding mechanism: the engine at deal #500 is better calibrated than at deal #1, on the same discipline.

---

## 9. Confidentiality

CRAM point tables and sub-weights are the **data moat** — proprietary, gaming-resistant. They live behind the confidentiality wall: only the deal/credit agent scope reads this config; it never appears in counterparty-facing documents, and is stripped entirely from the anonymised dataset (SOP-006 / 006D — "remove CRAM sub-weights"). The tier letter may be retained in anonymised data; the weights never.

---

## 10. Open items before go-live

1. **Confirm the production point tables** — §4 encodes the v3.3 *indicative* rules; the deeper-NDA production tables should be loaded and AC-signed before live scoring.
2. **Stand up the price-vs-market benchmark feed** — the highest-signal fraud variable; provisional/manual until then.
3. **Build the route-risk reference table** (origin→destination, cold-treatment corridors, customs history).
4. **`commercial_window_alignment` variable** — flagged in development (briefing §10) for seasonal corridors (blueberry PE→US/EU etc.); not yet in this config.
5. **Pre-season variant (50/35/15/0)** — out of scope for v0.1 (post-PO model only); add as a separate config when that book opens.

---

*Build spec v0.1. Encodes CRAM v3.3. Confidential — internal only. Companion to the agent-native architecture and the deal playbooks. Confirm production tables before live scoring.*
