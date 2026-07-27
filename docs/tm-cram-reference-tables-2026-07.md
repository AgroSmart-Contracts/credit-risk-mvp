---
moc: "[[MOC-Product]]"
tags: [trumarket, cram, scoring-engine, reference-tables, config, confidential]
version: 0.1-DRAFT
status: SEED — pending AC confirmation of NEEDS_CONFIRM cells
date: 2026-07-09
companion_to: [tm-cram-engine-spec-2026-06, audit-CRAM-MVP-process-2026-07-09]
classification: CONFIDENTIAL — scoring config. Internal only. Versioned per spec §8 (changes need AC sign-off + rationale).
---

# CRAM Reference Tables v0.1

Three tables the engine reads at D4. Design principle (from AC, 2026-07-09): **commodity risk alone is not the risk unit — Product×Market pairs are.** Blueberries (Group 1) into Israel can be higher-risk than asparagus (Group 1) into Spain. The architecture below keeps the composite intact:

- **Table 1 (Product)** stays market-agnostic → feeds dimension **B** variables (perishability, grade standards, phyto/EUDR).
- **Table 2 (Route/Logistics)** is corridor-physical → feeds dimension **C** variables (transit, transshipment norms, customs).
- **Table 3 (Product×Market pairs)** is the interaction term → feeds variable **C4 (route-risk flag)**: when a pair row exists it **overrides** the corridor's default flag; otherwise the corridor default applies. This is where "blueberry→Israel ≠ asparagus→Spain" lives, without collapsing dimensions B and C into each other.

AC's Group 1–4 ordering is retained as an advisory column (sanity check), but the engine scores the decomposed attributes — that's what keeps the rubric deterministic and explainable.

**Legend:** ✅ confirmed · 🔶 PROPOSED (from public logistics/agro norms — verify against TM booking/deal data) · ❓ NEEDS_CONFIRM (AC decision)

---

## Table 1 — Product table (dimension B inputs)

Perishability classes per spec §4.B: Non-perishable +18 · Semi (>30d) +9 · Perishable (7–30d) −4 · Ultra (<7d) −12.

| Commodity | Key PE varieties | AC risk group | Perishability class (proposed pts) | Shelf life (reefer/CA) | Grade standard | Phyto / cold-treatment notes | EUDR | PE season window |
|---|---|---|---|---|---|---|---|---|
| **Fresh asparagus** | Green (UC-157), white | 1 | ❓ **Ultra −12** (air-fresh trade) — commercially the most time-critical; confirm vs Perishable for short ocean legs | ~10–21d at 2°C, quality decays fast 🔶 | Cat I/II + caliber | High rejection sensitivity (tip decay, dehydration); air freight dominant to USA 🔶 | No | Near year-round, peaks Sep–Dec 🔶 |
| **Fresh grapes** | Red Globe, Sweet Globe, Crimson, Allison | 1 | ❓ **Perishable −4** (SO₂ pads extend to 30–60d — arguably Semi; risk is more price/market than decay) | 30–60d with SO₂/CA 🔶 | Cat I/II + caliber/brix | Cold treatment required PE→China 🔶; SO₂ residue limits per market | No | Oct–Feb (Piura/Ica) 🔶 |
| **Fresh blueberries** | Ventura, Biloxi, Sekoya | 1 | **Perishable −4** ✅ (consistent with spec examples) | 30–45d max in CA, practical window shorter 🔶 | Class I (no formal cat system) | Fruit-fly protocol PE→USA (systems approach/fumigation) 🔶; MRL sensitivity EU | No | Aug–Dec campaign peak ✅ (2025 campaign) |
| **Fresh avocados** | Hass | 2 | **Perishable −4** 🔶 | 25–35d reefer, CA extends 🔶 | Cat I/II + caliber + dry-matter % | Dry-matter minimums per market; checkerboard maturity claims common 🔶 | No | Mar–Aug 🔶 |
| **Fresh mandarins** | W. Murcott, Tango | 3 | **Perishable −4** ✅ (as scored in TM-2026-012) | 30–60d 🔶 | CAT 1 (Class I) ✅ | Cold treatment required PE→USA (fruit fly) 🔶; phyto required PE→CO ✅ | No | Jun–Sep 🔶 |
| **Fresh ginger** | Kion (yellow) | 3 | **Semi-perishable +9** 🔶 (stores months, ambient-tolerant) | 60–120d+ 🔶 | Grade by size/cleanliness; often industrial-tolerant | Low phyto friction; soil/quarantine checks 🔶 | No | Broad window, peak ~Aug–Feb ❓ |
| **Coffee (green)** | Arabica (Cajamarca, Junín) | 4 | **Non-perishable +18** ✅ | 12+ months dry 🔶 | SCA cup score / export grades | Dry container (not reefer) — Table 2 non-perish transit rules apply | **YES — hard-required DDS** (briefing §4.2) | Harvest Apr–Sep 🔶 |
| **Cacao (beans)** | CCN-51, Criollo/fino de aroma | 4 | **Non-perishable +18** ✅ | 6–12 months dry 🔶 | Fermentation % / bean count / fino grade | Dry container; humidity/mold control in transit 🔶 | **YES — hard-required DDS** | Main crop ~Apr–Jul + minor ❓ |

**Notes.**
1. **Group ≠ perishability alone.** Grapes are Group 1 on AC's ordering yet store longer than mandarins (Group 3) — the group encodes price volatility + rejection/claim risk + market behavior. Those components are carried by the price-vs-market variable (B2), grade (B3), and the pair table below — not double-counted in perishability.
2. **Coffee/cacao change the operating profile, not just the score:** dry containers (no cold-chain variable), EUDR due-diligence statement as a **hard-required document** for EU-destined deals (treat missing DDS as veto-grade for EU scope ❓ — AC to confirm), different buyer landscape and longer tenors typical.
3. Seasonal windows pre-seed the `commercial_window_alignment` variable (spec open item #4): a deal contracted outside the corridor's window is itself a flag.

---

## Table 2 — Route/logistics table (dimension C inputs)

Corridors = 2025 book (PE/CL/EC → USA, Spain, Portugal, Egypt, Thailand, Jordan) + live deals (PE→CO mandarin; Israel/Eagle; Taiwan/HFF). Ocean transit = reefer service norms 🔶 — **all transit figures to be verified against TM's actual BL history before the table goes live.**

| POL → POD | Market | Ocean transit (typ.) | Direct service? | Air option | Customs clearance norm | Corridor default risk flag | Notes |
|---|---|---|---|---|---|---|---|
| Callao → Buenaventura | Colombia | 3–5d ✅ (TM-2026-012) | Direct 🔶 | Yes, short | ❓ (S2 open item on live deal) | **Low–Med** 🔶 | Intra-LATAM; phyto PE→CO required ✅ |
| Callao → Philadelphia / Miami | USA East | 11–14d 🔶 | Direct services exist 🔶 | Yes (asparagus norm) | ≤3d 🔶 | **Low** 🔶 | Fruit-fly protocols per commodity; deep resale market |
| Callao → Los Angeles | USA West | 12–16d 🔶 | Direct/1 stop 🔶 | Yes | ≤3d 🔶 | **Low** 🔶 | |
| Callao → Algeciras / Valencia | Spain | 17–21d 🔶 | Direct 🔶 | Yes | 3–5d 🔶 | **Low** 🔶 | Deep EU resale market (re-export via Perpignan/Rotterdam) |
| Callao → Lisbon / Sines | Portugal | 18–22d 🔶 | Often via Algeciras (1 stop) 🔶 | Limited | 3–5d 🔶 | **Low** 🔶 | |
| Callao → Rotterdam | NL/EU north (DE/NL) | **19–22d** ✅ (AC 2026-07-09) | Direct 🔶 | Yes | ≤3d 🔶 | **Low** 🔶 (corridor default — see asparagus pair override, Table 3) | Alternative EU gateway; MRL-strict buyers |
| Callao → Haifa / Ashdod | Israel | **35d+** ✅ (AC 2026-07-09) | Usually 1–2 stops via Med hub 🔶 | Yes (costly) | 4–7d ❓ | **High** ✅ (35d rule) | Transit exceeds the 35d perishables ceiling; port-disruption/geopolitical exposure; thin resale market on rejection |
| Callao → Alexandria / Damietta | Egypt | 25–30d 🔶 | Transshipment via Med hub 🔶 | Limited | >7d ❓ | **Med–High** 🔶 | Payment-rail/FX friction ❓; customs variability |
| Callao → Aqaba | Jordan | 30–36d 🔶 | 1–2 stops 🔶 | Limited | 5–7d ❓ | **Med–High** 🔶 | Long tail corridor |
| Callao → Laem Chabang / Bangkok | Thailand | 30–38d 🔶 | 1+ stop via Asia hub 🔶 | Yes (costly) | 3–5d 🔶 | **Med** 🔶 | Long transit — near ceiling for most fresh categories |
| Callao → Keelung / Kaohsiung | Taiwan | **30d** ✅ (AC 2026-07-09) | 1 stop typical 🔶 | Yes | 3–5d 🔶 | **Med** 🔶 | HFF corridor; CISG applicability uncertain → governing-law clause mandatory (legal framework rule) |
| Callao → Shanghai / Hong Kong | China | **25d** ✅ (AC 2026-07-09) | Direct services exist 🔶 | Yes | 3–5d 🔶 | **Med** 🔶 | Cold treatment required for grapes PE→CN 🔶; documentation-strict customs |
| Callao → Jebel Ali | UAE/MENA hub | 28–34d 🔶 | 1 stop 🔶 | Yes | ≤3d 🔶 | **Med** 🔶 | Re-export hub — resale liquidity better than end-market MENA ports |

**Notes.**
0. **The 35-day rule (AC, 2026-07-09) ✅:** any ocean-freight corridor with typical transit **>35d is relatively high risk for perishables** — the C4 flag for a perishable (G1–G3 fresh) deal on such a corridor floors at **High**, regardless of the corridor's default. Non-perishables (coffee/cacao) are exempt. Israel (35d+) is the canonical trigger.
1. Spec transit scoring (C1): ocean reefer ≤14d +14 / 14–21d +6 / >21d −10 — so the Israel/Egypt/Jordan/SE-Asia corridors start transit-negative for fresh; fine for coffee/cacao under the non-perishable rule (≤30d +12 / >60d −8). Rotterdam at 19–22d sits on the +6/−10 boundary — score per actual BL transit, not the table norm.
2. **Transshipment norms** matter for veto proximity: any corridor whose *normal* routing is 2 stops by air is structurally un-executable for fresh (veto) — none seeded here, but the parser should check per booking, not per corridor.
3. Customs columns marked ❓ need TM's own clearance history (or broker input) — spec C6 scores ≤3d +5 / >7d −8.

---

## Table 3 — Product×Market pair table (overrides C4 route-risk flag)

**Rule:** if a (commodity-group × market) row exists → its flag replaces the corridor default in C4 (Low +12 / Med +3 / High −15, plus −5 if cold-treatment protocol required but absent). No row → corridor default. Rationale column is mandatory — every override must be explainable.

The driver behind most pair risk: **resale liquidity on rejection** (if the buyer rejects or defaults, can the cargo be re-sold in-market before it perishes?) × **transit-vs-shelf-life headroom** × **market payment/claims culture**.

| Commodity group | Market | Pair flag | Rationale |
|---|---|---|---|
| Blueberries / grapes / asparagus (G1) | **Israel** | **High** 🔶 | AC's canonical example: 28–34d transit eats most of practical shelf life; transshipment via Med hubs; port-disruption exposure; thin domestic resale market on rejection → rejection ≈ total loss |
| Asparagus (G1) | **Spain** | **Low–Med** 🔶 | Air-dominant (transit risk collapses); deep resale/re-export market (Mercamadrid, Perpignan); established claims culture → rejection ≠ total loss |
| Asparagus (G1) | **Germany / Netherlands** | **High** ✅ (AC 2026-07-09) | AC-confirmed flag. Proposed drivers 🔶: ocean transit (19–22d) consumes most of asparagus's usable shelf life; strict quality culture + strong domestic-season preference (German white-asparagus season) → high rejection propensity; rejected product hard to re-place at that shelf-life remainder. Overrides the Rotterdam corridor's Low default |
| Blueberries (G1) | **USA** | **Low–Med** 🔶 | Short-ish transit, deep market, but fruit-fly protocol compliance is the binding item (protocol absent → −5 or stop) |
| Blueberries / grapes (G1) | **Thailand / Taiwan / SE Asia** | **Med–High** 🔶 | 28–38d transit near CA ceiling; quality claims frequent at that range; moderate resale depth |
| Avocado (G2) | **EU** | **Low–Med** 🔶 | Robust demand + ripening infrastructure; dry-matter/maturity claims are the main friction |
| Mandarins (G3) | **Colombia** | **Med** 🔶 | Live corridor (TM-2026-012): short transit is favorable, but thin market depth + first-time counterparties; phyto compliance required |
| Mandarins (G3) | **USA** | **Med** 🔶 | Cold-treatment protocol mandatory — protocol certification is the gating item |
| Ginger (G3) | **EU / USA** | **Low** 🔶 | Semi-perishable + deep spot market → transit and rejection risk both low |
| Coffee / cacao (G4) | **EU** | **Low + EUDR gate** 🔶 | Physically lowest-risk; risk migrates to compliance — missing EUDR DDS blocks the deal (❓ veto-grade, confirm) |
| Coffee / cacao (G4) | **USA / MENA / Asia** | **Low** 🔶 | Non-perishable, standard dry logistics |
| Any fresh (G1–G3) | **Egypt / Jordan** | **High** 🔶 | Long transshipped transit + customs variability + payment-rail friction ❓ — confirm against TM's 2025 actuals on these corridors (they're in the book, so real performance data exists) |

---

## How the engine reads these (integration contract)

1. Parser/deal intake resolves `commodity`, `variety`, `POL`, `POD`, `market`, `freight_type`.
2. **B-dimension:** perishability class + points from Table 1; seasonal-window check (advisory until `commercial_window_alignment` ships); EUDR gate for coffee/cacao→EU.
3. **C-dimension:** transit + transshipment norms from Table 2 (actual BL data overrides table norms when available — table is the *prior*, the booking is the *fact*); C4 flag from Table 3 if a pair row exists, else Table 2 default.
4. Missing row (new commodity or corridor) → `NEEDS_INPUT`, admin supplies + a row is added (versioned).
5. Every scoring run records the table version alongside `engine_version`.

## Open items to close v0.1 → v1.0

1. ❓ Asparagus: Ultra vs Perishable (possibly freight-type-conditional: Ultra if ocean, Perishable if air ≤2d — decide).
2. ❓ Grapes: Perishable vs Semi with SO₂/CA.
3. ❓ EUDR missing-DDS = veto-grade for EU-scope deals — confirm and, if yes, add to the spec §6 veto register.
4. 🔶 Replace all proposed transit/customs figures with TM's 2025 BL + clearance history (139-deal book covers most of these corridors — the data exists).
5. ❓ Egypt/Jordan payment-rail friction — score from 2025 actual payment behavior on those corridors.
6. Ginger + cacao season windows — confirm.

---

*Reference tables v0.1 draft. Confidential config — internal only. Companion to the engine spec; changes versioned per spec §8.*
