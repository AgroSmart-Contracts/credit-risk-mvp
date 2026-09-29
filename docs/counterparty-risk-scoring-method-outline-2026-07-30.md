# Counterparty Risk Scoring Method — Outline

*Sandbox tester tool — not connected to the live production scoring system.*

## What this is

A weighted-average scoring model that takes in known facts about a buyer, a supplier, and the relationship between them, and produces a 0–100 risk score for each side plus a combined composite. It's built to degrade gracefully: fields left blank don't get guessed at or penalized to zero — they're simply excluded, and the model pulls thin profiles back toward a neutral middle instead of letting one or two data points swing the score wildly.

## The equation, step by step

1. **Group raw average** (calculated separately for Buyer, Supplier, and Relationship): multiply each filled field's score by its weight, sum those, then divide by the sum of weights for only the fields that were actually filled in. Blank or N/A fields are excluded from both the top and bottom of that fraction.

2. **Coverage fraction**: filled weight ÷ possible weight, where possible weight is the sum of *all* of that group's field weights regardless of whether each one was filled in. This measures how much of the profile is actually known.

3. **Shrink toward neutral**: `Group Score = Coverage Fraction × Raw Average + (1 − Coverage Fraction) × 50`. A profile with only 2 of 12 fields filled gets pulled hard toward a neutral 50. A fully-filled profile passes through nearly unchanged, since its coverage fraction is close to 1.

4. **TM platform trust bonus**: added flat, after shrinkage. +0 if there's no record, +3 (default) if the counterparty has a prior transaction relationship on the platform, or is a known TM-affiliated entity that shows up fragmented across customs records (e.g., the same underlying trade appearing under two different legal names). Capped so no score exceeds 100. This bonus is never diluted by weight or shrinkage — a real known relationship keeps its full value even on an otherwise thin profile.

5. **Composite score**: the same three steps (raw average → coverage fraction → shrink toward 50) run again across all Buyer + Supplier + Relationship fields combined, then both trust bonuses are added on top, giving the final number.

## Buyer field weights and scoring

| Field | Weight | Scoring |
|---|---|---|
| Years in business | 7 | MIN(100, years × 10) |
| Frequency of deals | 4 | From customs shipments or platform deal count: 0 → 15; 1–2 → 35; 3–5 → 55; 6–11 → 70; 12–23 → 85; 24+ → 95. *(Renamed from Online verifiability 2026-08-07; import-license weight folded in.)* |
| ~~Import license status~~ | — | **Removed 2026-08-07** from buyer counterparty formula (veto register may still check invalid license separately). |
| Monthly purchase volume | 4 | Calendar monthly = yearly FOB ÷ 12. Bands aligned to yearly/12: under ~$42k = 25; ~$42–167k = 40; ~$167–833k = 60; ~$833k–4.17M = 80; over → 90 |
| Yearly sales | 4 | Not provided = blank; under $500K = 25; $500K–2M = 40; $2M–10M = 60; $10M–50M = 80; over $50M = 90 |
| Annual import volume | 4 | Not provided = 50; under 100 MT = 25; 100–500 MT = 40; 500–2,000 MT = 60; 2,000–10,000 MT = 80; over 10,000 MT = 90 |
| Route diversity | 2 | Not researched = 50; 1 route = 35; 2 = 40; 3 = 55; 4 = 70; 5 = 80; 6–7 = 90; 8+ = 95 |
| Credit rating | 7 | Not available = 50; AAA/AA = 90; A = 85; BBB = 70; BB = 55; B = 40; CCC or below = 28 |
| Platform transaction history | 4 | MIN(100, count × 10) |
| Payment delay | 4 | MAX(15, 100 − days × 2) |
| TM platform trust | bonus (default +3) | No record = +0; has record or known affiliate = +bonus, added flat |

## Supplier field weights and scoring

| Field | Weight | Scoring |
|---|---|---|
| Years in business | 7 | MIN(100, years × 10) |
| Frequency of deals | 2 | Same shipment/deal-count bands as Buyer |
| Export license status | 2 | Valid = 100; invalid = 0 (veto-grade, un-softened) |
| Production capacity | 4 | Not provided = 50; under 100 MT = 25; 100–500 MT = 40; 500–2,000 MT = 60; 2,000–10,000 MT = 80; over 10,000 MT = 90 |
| Yearly sales | 4 | Same tiers as Buyer |
| Annual export volume | 4 | Same tiers as Buyer |
| Route diversity | 2 | Same tiers as Buyer |
| Quality certifications | 2 | None = 28; some (1) = 60; multiple recognized = 90 |
| Platform transaction history | 4 | MIN(100, count × 10) |
| On-time delivery rate | 7 | Direct pass-through of the rate itself |
| Quality rejection rate | 4 | MAX(15, 100 − rate) |
| TM platform trust | bonus (default +3) | Same as Buyer |

## Relationship field weights and scoring

*Left untouched by softening/shrinkage exceptions — a 0 here is a real "no prior relationship found" finding, not an unresearched gap.*

| Field | Weight | Scoring |
|---|---|---|
| Prior deals between parties | 6 | MIN(100, count × 20), caps out at 5+ deals |
| Relationship age (months) | 4 | MIN(100, months × 100/24), caps out at 24+ months |

## Design notes

- **Continuous/graduated fields carry more weight (4–7)** — years in business, credit rating, sales, volume, on-time rate — because they move gradually and a single bad data point doesn't swing the group as hard.
- **Binary/tiered fields carry less weight (2)** — license status, verification, certifications — because they jump their full range on one flip, so a lower weight keeps one categorical answer from dominating the average.
- **Softening**: the harshest categorical extremes were compressed inward (e.g., a "not found" or "none" result no longer scores as low as a true 0) to reduce single-field swings — except for license validity and Relationship-group zeros, which are deliberately left as hard signals.
- **Shrink-toward-neutral** was added because softening alone wasn't enough: a profile with only 2–3 fields filled could still swing 40+ points on one assumption, since those few fields controlled nearly all of the weighted average. Shrinkage fixes this at the source by discounting thin profiles toward neutral before anything else happens.

*Sandbox tool for testing the scoring approach — separate from and not wired into the live production scoring engine.*
