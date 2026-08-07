# Missing data to fill — sections 1–3 only
Generated: 2026-08-05

Open gaps that still need values. Sections 4–5 (create users / fill `User.company` from company-master) are covered separately in `missing-data-to-fill-2026-08-05.md` and are **not** repeated here.

Companion CSV: `missing-data-to-fill-sections-1-3-2026-08-05.csv`

---

## 1. Counterparties blocked — need years in business (YIB)

These appear under “Blocked — no years-in-business” and have **no sandbox score** until YIB is set (and re-run `npm run recalc-counterparties` / refresh platform deals).

| Company | Role | Product | Deals | YIB (years) | YIB source (csv / registry / default) | Notes |
|---|---|---|---|---|---|---|
| ~~DRELIFRESH SAS VEREDA EL PORTENTO VIA RETIRO LA CEJA~~ | buyer | Fresh Blueberries | 1 | **4** | verified (2026-08-06) | Filled — now scored. Tax ID `901893567` (Colombia). |
| ~~SHANGHAI GREEN CHAIN TRADING CO LTD~~ | buyer | Mixed Berries / Tropical Fruits (IQF) | 7 | **5** | verified (2026-08-06) | Filled — now scored. |
| ~~GUANGZHOU FRESH LINK IMPORT CO LTD~~ | buyer | Fresh Blueberries | 4 | **5** | verified (2026-08-06) | Filled — now scored. |

**Still blocked (placeholders only):** see Unknown buyer/supplier deal below.

### Deal with Unknown buyer **and** Unknown supplier

One finished platform deal has both parties as placeholders — identify real buyer/supplier + YIB before it can score as counterparties.

| Field | Value on file |
|---|---|
| Deal name / ref | `Arándano fresco` (stored mojibake: `ArÃ¯Â¿Â½ndano fresco`) |
| mongoId | `66fb1eb20b1b5991fc6479ff` |
| Commodity | Fresh Blueberries |
| Volume | `1000 units` (variety blank) |
| Deal value | `$30,000` |
| Unit price | `$30` |
| Origin → destination | Peru → Netherlands |
| Transport | sea · ~20 transit days · 1 transshipment · route flag Medium (provisional / transport-mode fallback) |
| Status | finished · milestone 7 · `likelyTest=real` |
| Buyer | **Unknown buyer** (YIB empty) |
| Supplier | **Unknown supplier** (YIB empty) |
| Prior deals / relationship | 0 / 0 months |
| Shipping start / createdAt | both empty/null |
| Coface coverage (defaulted) | `$27,000` (90%) |
| Customs narrative | none |
| Other missing | cargo insurance (None → veto), buyer credit rating, route table row |

**VALUE TO FILL:** real buyer name + YIB, real supplier name + YIB, quantity unit clarification, shipping date, OD ports if known.

---

## 2. Drelifresh deal — CRAM fields still missing

Deal is in platform deals + defaults CSV. Overall score runs at **64** but **Veto** until insurance (and ideally other gaps) are filled.

| Field | Current | VALUE TO FILL | Effect if filled |
|---|---|---|---|
| Buyer years in business | **4** (verified 2026-08-06) | done | Buyer counterparty now scored |
| Cargo insurance coverage | None (default) | e.g. All-risk / named policy + value USD | Clears mandatory insurance veto |
| Buyer credit rating (Coface CRA/DRA) | none | grade / doc id | Improves buyer Dimension A |
| Customs export narrative / DUA | none | free text or DUA ref | Fills customs gap on deal |
| Company contact email on deal (non-TM) | only `supply@trumarket.tech` as supplier; buyer invite `andresmarin@drelifresh.com` not a User | confirm / create user | Platform user linkage |
| Origin / destination (prod vs table) | Prod: Callao / Colombia → stored as Lima Jorge Chavez / El Dorado·Bogota for Dimension C | confirm ports | Route already scores 83 on LIM→BOG air |

---

## 3. Scored companies with **no company invite email** on prod deals

Only `@trumarket.tech` on buyer/supplier slots today. Contact emails collected below — still need to be wired onto deals (and ideally a User).

| Company | Role | Suggested action | Contact email TO FILL |
|---|---|---|---|
| Eagle Trading Agriculture Marketing Ltd | buyer | Replace Alessandro TM proxy on deals | nir@eagle-import.com |
| Holy Fruit Peru | supplier | Deals use `supply@trumarket.tech`; users `@holyfruitperu.com` exist — wire onto deals or confirm | |
| AGRO SMART CONTRACTS LDA | buyer | Deals use TM staff; user has company.name set | |
| LIMAX SP. Z O.O. | buyer | Replace TM proxy | Leo.Klaassen@limax.pl |
| A.S.M International | buyer | Replace TM proxy | asminternational2@gmail.com |
| ICA BLUEBERRIES SAC | supplier | Replace `supply@trumarket.tech` | |
| ANTERRA FARMS GMBH | buyer | Replace TM proxy | anders.persson@anterrafarms.com |
| «Ardzhies» LLC | buyer | Replace TM proxy | |
| BC NATURE QUALITY FRUITS S.L | buyer | Replace TM proxy | jcortes@bcnature.es |
| BENASSI SAO PAULO IMPORTACAO E EXPORTACAO LTDA | buyer | Replace TM proxy | benassi.importacao@benassisp.com.br |
| GOURMET & BEVERAGE ONE GROUP (THAILAND) CO. LTD | buyer | Replace TM proxy | |

---

## After filling

1. Update `docs/platform-deals-with-defaults-2.csv` (YIB, insurance, party names, etc.)
2. `npm run apply-platform-defaults`
3. `npm run recalc-counterparties` / `sandbox-counterparties`
