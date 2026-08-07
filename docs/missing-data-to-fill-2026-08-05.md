# Missing data to fill — credit-risk-mvp / prod alignment
Generated: 2026-08-05

Fill the empty **VALUE TO FILL** columns. Sources: platform deals, counterparty sandbox, prod deal invite emails vs `users`.

Companion CSVs (same folder):
- `missing-data-to-fill-2026-08-05.csv` — flat checklist for ops/data entry

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

## 4. Deal invite emails with known company — **no User** in prod

Create platform users (or link existing) for these addresses. Company is already on prod `buyerCompany` / `supplierCompany`.

**Country + taxId below are already on file in credit-risk-mvp** `src/data/company-master.csv` (not missing — copy into the new User). Drelifresh is the exception: not in company-master yet; country/taxId from the prod deal only.

| Email | Company | Role | Deals | Create user? (Y/N) | accountType | company.country | company.taxId |
|---|---|---|---|---|---|---|---|
| rita@alliedtrade.com | ALLIED TRADE GLOBAL CORP | buyer | 17 | | buyer | Taiwan, Province of China | 54354228 |
| andresti@biofarming.com | BIO FARMING PERU S.A.C. | supplier | 13 | | supplier | Peru | 20612199974 |
| dganga@davisworldwide.nl | DAVIS GLOBAL BV | buyer | 13 | | buyer | Netherlands | NL861363103B01 |
| lgarcia@avsa.com.pe | AGRICOLA VIÑASOL SAC | supplier | 12 | | supplier | Peru | 20534208008 |
| ivette.aedo@juhinej.com | JUHINEJ LTD | buyer/supplier | 12 | | | Chile | 76.476.953-2 |
| lvergara@medano.com.pe | AGRICOLA MEDANO AZUL SAC | supplier | 10 | | supplier | Peru | 20602492191 |
| miguel@xarki.com | XARKI SL | buyer | 10 | | buyer | Spain | B65792942 |
| info@haciendasotomayor.es | HACIENDA SOTOMAYOR SL | buyer | 9 | | buyer | Spain | B19277867 |
| sales@freshexpress.ae | FRESH EXPRESS LLC | buyer | 7 | | buyer | United Arab Emirates | 100295133600003 |
| tesor1@fundolaslomas.com | FUNDO LAS LOMAS SAC | supplier | 7 | | supplier | Peru | 20535311210 |
| cesar.berrospi@giddingsfruit.com | GIDDINS PERU SAC | supplier | 7 | | supplier | Peru | 20601552557 |
| jenny@internationalgreenco.com | SHANGHAI GREEN CHAIN TRADING CO LTD | buyer | 7 | | buyer | China | 91310115MA1H83UR0Q |
| mohamed.nazer@tradecultivators.com | TRADE CULTIVATORS LLC | buyer | 7 | | buyer | United Arab Emirates | 100412431700003 |
| gerritjan@biofreshi.com | BIOFRESHI BV | buyer | 5 | | buyer | Netherlands | NL853825828B01 |
| ian@khi-international.com | KHI INTERNATIONAL CORP | buyer | 5 | | buyer | Hong Kong | 1794711 |
| rony@villaventuraperu.com | VILLAVENTURA PERU SAC | supplier | 5 | | supplier | Peru | 20610491104 |
| sales@buyrite-intl.com | GUANGZHOU FRESH LINK IMPORT CO LTD | buyer | 4 | | buyer | China | 91440101MA59L8UW3L |
| amory.sepulveda@juhinej.com | AGRÍCOLA Y COMERCIAL VALLES DEL ÑUBLE | buyer | 1 | | buyer | Chile | 77.394.695-7 |
| andresmarin@drelifresh.com | DRELIFRESH SAS… | buyer | 1 | | buyer | Colombia *(prod deal only — not in company-master)* | 901893567 |
| mvillarreal.almacen@solimar.com.pe | INDUSTRIAS SOLIMAR SAC | supplier | 1 | | supplier | Peru | 20526450851 |

---

## 5. User.company fields empty on prod (even when email exists)

Many buyers/suppliers in `users` lack `company.name` / `taxId` / `country`. Fill on the User document so CRAM can match without deal-only heuristics.

Priority examples (have email, weak/empty company on User):

| Email | Expected company | company.name | country | taxId |
|---|---|---|---|---|
| andresmarin@drelifresh.com | DRELIFRESH SAS… | | Colombia | 901893567 |
| wli@bluepacificoils.com | BLUE PACIFIC FOODS SAC | | | |
| rsuarez@mikhunafoods.com.pe | MIKHUNA FOODS SAC | | Peru | |
| lsalas@mikhunafoods.com.pe | MIKHUNA FOODS SAC | | Peru | |
| jarno.moret@toffbv.nl | T.O.F.F. B.V | | Netherlands | |
| alessandro@holyfruitperu.com | Holy Fruit Peru | | Peru | |
| ventas@holyfruitperu.com | Holy Fruit Peru | | Peru | |

---

## After filling

1. Update `docs/platform-deals-with-defaults-2.csv` (YIB, insurance, etc.)
2. `npm run apply-platform-defaults` (or re-append overlays)
3. `npm run recalc-counterparties` / `sandbox-counterparties`
4. Create/link prod `users` for invite emails where agreed
