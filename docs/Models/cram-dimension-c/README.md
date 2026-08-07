---
moc: "[[MOC-Product]]"
tags: [trumarket, cram, dimension-c, trade-route, scoring-engine, config]
version: 2.0
status: BUILT — pending BL-history transit calibration
date: 2026-07-30
supersedes: src/data/route-risk-given-commodity-by-mode-2026-07-29.csv
classification: CONFIDENTIAL — L4 point tables. Not for external disclosure.
---

# CRAM Dimension C · Trade-Route · v2

## What changed structurally

v1 was a **hand-maintained 336-row table** keyed on free-text location strings. That shape caused
the errors: nothing prevented an ocean score on a landlocked node, or the same port appearing twice
under different spellings.

v2 makes the table an **output**. Four small inputs + one function generate it:

```
nodes.csv ──┐
lanes.csv ──┼──> score_route.py ──> route-risk-table-v2.csv
commodities.csv ─┤                        │
stop_modifiers.csv ┘                      └──> validate.py (4 invariants, exit 1 on fail)
```

Fixing a lane now means editing one row in `lanes.csv` and re-running. No cell is ever edited by hand.

## The four invariants (enforced, not hoped for)

| # | Invariant | Kills |
|---|---|---|
| I1 | Mode validity — a lane's POL and POD must both support its mode | ocean scores on Madrid / Frankfurt / Vienna / Guarulhos / Tel Aviv; air originating at Callao |
| I2 | Stop monotonicity — `score(n+1) <= score(n)` on the same lane | inconsistent stop handling |
| I3 | Air must not score below ocean when air is genuinely faster | the v1 bug where Frozen Tropical Fruits scored air ≥3 at −15 vs 34 days at sea |
| I4 | ≥4 air stops = VETO (AC ruling 2026-07-30) | supersedes "≥2 stops = veto-grade" in architecture §6.2 and Table 2 note 2 — **both need editing** |

## Stop curve (air only)

`0: 0 · 1: −5 · 2: −12 · 3: −25 · ≥4: VETO`

Ocean transshipment is deliberately **not** a stop penalty. Per AC's ruling stops are air-only; ocean
transship risk is carried as transit **variance** (a wider p90), which is where reefer plug-outs
actually show up. 67% of Peruvian ocean volume transships, so this term is not cosmetic.

## Evidence grading

Every lane carries `exists_evidence` and `transit_evidence`. v1 marked nearly everything "Prov."
with no distinction between "AC confirmed this" and "we guessed".

- `VERITRADE` — lane observed in the 2025 PE blueberry customs book (35,671 declarations)
- `AC` — confirmed by AC, per Reference Table 2
- `REF` — public logistics norm, unverified
- `NO_EVIDENCE` — scoreable but zero observed traffic
- `NEEDS_CONFIRM` — open question, listed below

## Calibration log

| Date | Change | Effect |
|---|---|---|
| 2026-07-30 | Blueberry shelf life 38d → **50d** (AC: CA + cold chain). Added `shelf_life_days_no_ca`. | 21 of 78 blueberry rows moved · 9 vetoes lifted · restored the Asia ocean book (50.1M kg of observed 2025 trade the model had been vetoing) |

## Open items blocking full calibration

1. **Transit p50/p90 are still norms, not measurements.** Needs the BL/AWB book (deal_id · POL · POD ·
   mode · carrier · ETD · **actual arrival** · commodity · claim Y/N). This is the single highest-value input.
2. **Carrier layer not yet applied.** `Naviera` is present on 84% of the customs book (40 carriers),
   so *who carries what where* is known — but delay requires arrival dates.
3. **4 of 12 commodities are not in Reference Table 1** (mango, strawberry, frozen tropical, IQF berries) — seeded from norms.
4. **Asparagus perishability class** unresolved in Table 1 (Ultra −12 vs Perishable −4).
5. **Chancay transit** ❓ — v2 seeds 25d vs Callao's 30d. Needs a real BL.
6. **The 35-day rule needs restating as a ratio.** With blueberry shelf life at 50d, a 35d ocean transit is 70% of shelf life — meaningful, but the absolute-days form was implicitly calibrated against a shorter shelf life. A ratio form (e.g. >70% of shelf life floors at HIGH) generalises across commodities and survives shelf-life revisions.
7. **Variety-level shelf life** — `varieties.csv` has the empirical 2025 distribution; the `shelf_life_delta_days` column is unfilled and needs AC's agronomy.
8. **CA status is not in customs data** (3 rows of 35,671 mention it). Must come from handling docs / freight booking per architecture §6.2 — so `shelf_life_days_no_ca` only fires when the deal fails to document cold chain.
9. **Caldera** (Costa Rica vs Chile) and **Dover** node identity — do not affect these 34 lanes.
