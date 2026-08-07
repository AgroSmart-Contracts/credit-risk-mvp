---
moc: "[[MOC-Product]]"
tags: [trumarket, cram, dimension-c, handoff, onboarding]
date: 2026-07-30
owner: AC
audience: Tasneem (implementation) · Fábio (integration) · Chiara (context)
---

# Dimension C · Handoff

## What this replaces

`src/data/route-risk-given-commodity-by-mode-2026-07-29.csv` — a hand-maintained 336-row table
keyed on free-text location strings. It contained ocean scores for landlocked cities, duplicate
corridors under alternate spellings, and air lanes originating at a seaport. Those were not
arithmetic errors; nothing in the format could prevent them.

This replaces it with **generated output**. Nobody edits a score again.

## Run it

```bash
pip install -r requirements.txt
./run.sh                     # build → score → validate. Non-zero exit = do not ship.
```

Refreshing the customs-derived inputs (only when a new Veritrade book arrives):

```bash
VERITRADE_CSV="/path/to/Veritrade.csv" python3 build_nodes.py
VERITRADE_CSV="/path/to/Veritrade.csv" python3 extract_varieties.py
```

## Integration contract — TypeScript calls Python

Python owns scoring. The TS side never reimplements a formula; it either reads a generated CSV
(build time) or shells out to `score_deal.py` (runtime).

**Build time** — `build-route-risk-table.ts` becomes a renderer. Drop the join logic, read
`route-risk-table-v2.csv` and `route-risk-blueberry-by-variety.csv` as-is.

**Runtime** — a deal's stop count comes off the AWB per booking, so it cannot always be a table
lookup. Call the engine:

```ts
import { execFileSync } from "node:child_process";

type DealScore = {
  score: number | null;          // null when veto === true
  veto: boolean;
  veto_reason: string | null;
  effective_transit_days: number;
  headroom_days: number;
  shelf_life_source: string;     // shows whether variety or commodity baseline was used
  transit_evidence: string;      // AC | VERITRADE | REF | NEEDS_CONFIRM
  lane_exists_evidence: string;
  engine_version: string;
};

export function scoreDeal(deal: object): DealScore {
  const out = execFileSync("python3", ["score_deal.py"], {
    input: JSON.stringify(deal), cwd: DIM_C_DIR, encoding: "utf8",
  });
  return JSON.parse(out);
}
```

**Request** — `pol`, `pod`, `mode`, `commodity` required; `variety`, `stops`,
`cold_treatment_ok` optional. `pol`/`pod` accept node_id, UN/LOCODE, IATA, name, or any alias
(so the platform's existing dirty strings resolve).

**Exit codes** — `0` scored *or* vetoed (both are valid outcomes; branch on `veto`).
`2` bad input: unknown node, mode-invalid lane, unknown commodity, no such lane. **The engine never
guesses.** A `2` means the deal record is wrong, not that the score is zero — surface it as a data
error, don't coerce it to a low score.

**Two behaviours to handle explicitly:**
- An unknown or unclassified variety silently falls back to the commodity baseline. `shelf_life_source`
  tells you which happened — log it. Today the baseline is the *permissive* end (50d).
- `veto: true` returns `score: null`. Don't render it as 0.

## Dependency graph

```
                     ┌── nodes.csv ────────┐
Veritrade book ──────┤                     │
                     └── varieties_observed.csv    (evidence only, never scored from)
                                           │
   AC rulings ──> commodities.csv          ├──> score_route.py ──> route-risk-table-v2.csv
                  varieties.csv            │                   └─> route-risk-blueberry-by-variety.csv
                  lanes.csv ───────────────┘                            │
                  stop_modifiers.csv                                    v
                                                                   validate.py
```

## Who decides what

**AC only** — every number below is a judgement call, not a derivation. Changing one needs sign-off
plus a line in the README calibration log.

| Input | Current | Note |
|---|---|---|
| Commodity shelf life | blueberries 50d | CA + cold chain |
| Variety classes | traveller 50d · Europe 30d · low-travel 25d | 10 of 23 classified |
| Air stop veto | ≥4 stops | supersedes "≥2 = veto-grade" in architecture §6.2 |
| Corridor flags | Low/Med/High per lane | from Reference Table 3 |

**Mechanical** — anyone can change, tests will catch mistakes: node types, aliases, lane transit
figures, customs days, evidence grades.

**Never edit by hand:** `route-risk-table-v2.csv`, `route-risk-blueberry-by-variety.csv`,
`nodes.csv`, `varieties_observed.csv`. All generated.

## The four invariants

`validate.py` exits non-zero if any fail. Wire it into CI.

1. **Mode validity** — a lane's POL and POD must both support its mode
2. **Stop monotonicity** — `score(n+1) <= score(n)` on the same lane
3. **Air ≥ ocean when air is genuinely faster**
4. **≥4 air stops = VETO**

## Known limitations — read before quoting any score

- **Transit figures are norms, not measurements.** Every lane carries `transit_evidence`
  (`AC` / `VERITRADE` / `REF` / `NEEDS_CONFIRM`). Most are `REF`. The BL/AWB book with actual
  arrival dates is the single highest-value missing input.
- **No carrier term yet.** `Naviera` is present on 84% of the customs book (40 carriers) so we know
  who carries what where — but delay needs arrival dates.
- **13 of 23 varieties unclassified**, and they fall back to the 50d commodity baseline — the
  *permissive* end. Consider flipping the default to Europe-30d so the engine fails safe.
- **Variety is stated on only 28% of customs rows**, and exporters who state it may not be representative.
- **Deal intake must capture variety** or the model's strongest perishability input is unavailable.
- The `TRANSIT` map in `extract_varieties.py` is country-level norms. Replace with BL actuals.

## Source data

Veritrade PE export book, HS blueberries, Jan–Dec 2025 — 35,671 declarations, 361M kg, US$2.37B FOB.
Not committed to the repo (licensed data). Ask AC for the file.
