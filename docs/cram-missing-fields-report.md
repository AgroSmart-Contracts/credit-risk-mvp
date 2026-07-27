# CRAM missing fields report

Generated from `full-deals-dataset.csv` enrichment used by `credit-risk-mvp`.
This data was removed from the app UI (Missing fields tab) and kept here for data-fill tracking.

**Assumption (MVP):** `licenseValidity` is **true** for all buyers and suppliers; ` = 0` and ` = 0` (perfect Dim A points — ignored until real data).

## Summary

| Metric | Count |
|---|---|
| Platform deals in MVP dataset | 123 |
| Counterparty-ready (both YIB) | 45 |
| Scored buyer↔supplier pairs | 5 |
| **Blocked — cannot score Dim A** | **79** |

**Primary blocker:** `buyer.yearsInBusiness` (Nectura / SUNAT gap) — all 79 blocked deals.

Fields empty across the CSV enrichment for blocked deals:

- buyer years in business
- Coface record / coverage
- customs export records (most rows; 4 deals have `customsId`)

## Missing field frequency

| Field | Deals missing it |
|---|---|
| `buyer.yearsInBusiness` | 79 |
| `cofaceRecordId / cofaceCoveragePct` | 79 |
| `customsId / customs export records` | 76 |
| `supplier.yearsInBusiness` | 1 |
| `buyer.name` | 1 |
| `supplier.name` | 1 |
| `dealValueUSD` | 1 |

## Still missing on ready deals (Dim A can run, full CRAM cannot)

Even the 45 counterparty-ready deals lack:

| Field | Notes |
|---|---|
| `cofaceRecordId` / coverage % | 0% fill in CSV |
| `customsId` / customs records | Only 4 of 45 ready deals linked |

## Blocked counterparties

| Buyer | Supplier | Blocked deals | Primary blocker(s) |
|---|---|---|---|
| AGRO SMART CONTRACTS LDA | TRU MARKET BLOCKCHAIN S.A.C. | 14 | `buyer.yearsInBusiness` |
| DAVIS GLOBAL BV | BIO FARMING PERU S.A.C. | 12 | `buyer.yearsInBusiness` |
| HACIENDA SOTOMAYOR SL | MIKHUNA FOODS SAC | 9 | `buyer.yearsInBusiness` |
| AGRO SMART CONTRACTS LDA | TRU MARKET BLOCKCHAIN | 8 | `buyer.yearsInBusiness` |
| GRUPO QSP SRL | BIO FARMING PERU S.A.C. | 7 | `buyer.yearsInBusiness` |
| TRADE CULTIVATORS LLC | GIDDINS PERU SAC | 7 | `buyer.yearsInBusiness` |
| FRESH EXPRESS LLC | FUNDO LAS LOMAS SAC | 7 | `buyer.yearsInBusiness` |
| AGRO SMART CONTRACTS LDA | BIO FARMING PERU S.A.C. | 6 | `buyer.yearsInBusiness` |
| GUANGZHOU FRESH LINK IMPORT CO LTD | ICA BLUEBERRIES SAC | 4 | `buyer.yearsInBusiness` |
| Kuba | MCORP | 1 | `buyer.yearsInBusiness` |
| Unknown buyer | Unknown supplier | 1 | `buyer.yearsInBusiness` |
| AGRO SMART CONTRACTS, LDA. | TRU MARKET BLOCKCHAIN S.A.C | 1 | `buyer.yearsInBusiness` |
| AGRO SMART CONTRACTS | TRU MARKET BLOCKCHAIN S.A.C | 1 | `buyer.yearsInBusiness` |
| JUHINEJ LTD | INDUSTRIAS SOLIMAR SAC | 1 | `buyer.yearsInBusiness` |

## Blocked deals (full list)

| Deal | Mongo `_id` | Status | Value USD | Buyer | Supplier | Blocker | Missing fields |
|---|---|---|---|---|---|---|---|
| Fresh Blueberries | `670edd033fdd80df80736ef5` | confirmed | 24,101 | AGRO SMART CONTRACTS | TRU MARKET BLOCKCHAIN S.A.C | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| Blueberries E001-50 | `68d40b987da7cd176486aabb` | proposal | 85,800 | AGRO SMART CONTRACTS LDA | TRU MARKET BLOCKCHAIN | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| Blueberries E001-50 | `68d40e8c7da7cd176486c359` | confirmed | 85,800 | AGRO SMART CONTRACTS LDA | TRU MARKET BLOCKCHAIN | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| Blueberries EXW Canada E001-42 | `6890fdf0438d2534fe4ebc56` | proposal | 10,368 | AGRO SMART CONTRACTS LDA | TRU MARKET BLOCKCHAIN | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| Blueberries Export Canada | `6890fd76438d2534fe4eb33c` | proposal | 10,368 | AGRO SMART CONTRACTS LDA | TRU MARKET BLOCKCHAIN | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| EUROPE BULK | `6917a58b62ce4b73260f06f4` | finished | 107,800 | AGRO SMART CONTRACTS LDA | TRU MARKET BLOCKCHAIN | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH ASPARAGUS E001-10 | `677c2b8ab9fa43de6d90a08a` | cancelled | 17,627 | AGRO SMART CONTRACTS LDA | TRU MARKET BLOCKCHAIN S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH ASPARAGUS E001-10 | `677c3e54b9fa43de6d91291b` | finished | 17,627 | AGRO SMART CONTRACTS LDA | TRU MARKET BLOCKCHAIN S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH AVOCADO - BK 21619266 | `67e564fc6b3eee0b06f42666` | confirmed | 52,800 | AGRO SMART CONTRACTS LDA | BIO FARMING PERU S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH AVOCADO - BK 27489042 | `67ef392d6b3eee0b06f72d16` | confirmed | 50,400 | AGRO SMART CONTRACTS LDA | BIO FARMING PERU S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH AVOCADO - BK 6412923740 2 | `683de11b42a9e57e2b48e715` | confirmed | 52,800 | AGRO SMART CONTRACTS LDA | BIO FARMING PERU S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH AVOCADO - BK LMM0514033 | `67d096556b3eee0b06f29d9a` | confirmed | 52,800 | AGRO SMART CONTRACTS LDA | BIO FARMING PERU S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH AVOCADO BK 6412923740 | `67e5642f6b3eee0b06f42147` | confirmed | 27,035 | AGRO SMART CONTRACTS LDA | BIO FARMING PERU S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES | `6972c74509dd14423e2461eb` | confirmed | 93,600 | AGRO SMART CONTRACTS LDA | TRU MARKET BLOCKCHAIN | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES E001-12 | `676449d1b9fa43de6d8bcd7e` | finished | 26,880 | AGRO SMART CONTRACTS LDA | TRU MARKET BLOCKCHAIN S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES E001-14 | `6761acdbb9fa43de6d8a387f` | finished | 20,285 | AGRO SMART CONTRACTS LDA | TRU MARKET BLOCKCHAIN S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES E001-16 | `675b7892b9fa43de6d887afe` | finished | 40,090 | AGRO SMART CONTRACTS LDA | TRU MARKET BLOCKCHAIN S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES E001-17 | `675b799bb9fa43de6d88826b` | finished | 35,270 | AGRO SMART CONTRACTS LDA | TRU MARKET BLOCKCHAIN S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES E001-18 | `675b708fb9fa43de6d882fb9` | finished | 23,275 | AGRO SMART CONTRACTS LDA | TRU MARKET BLOCKCHAIN S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES E001-19 | `675b6053b9fa43de6d879470` | finished | 29,568 | AGRO SMART CONTRACTS LDA | TRU MARKET BLOCKCHAIN S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES E001-23 | `675a16e4b9fa43de6d873513` | finished | 26,400 | AGRO SMART CONTRACTS LDA | TRU MARKET BLOCKCHAIN S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES E001-29 | `6786a6e9b9fa43de6d94b696` | finished | 21,600 | AGRO SMART CONTRACTS LDA | TRU MARKET BLOCKCHAIN S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct |
| FRESH BLUEBERRIES E001-30 | `6797c0246b3eee0b06efb2a9` | finished | 25,920 | AGRO SMART CONTRACTS LDA | TRU MARKET BLOCKCHAIN S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct |
| FRESH BLUEBERRIES E001-31 | `67a4c9a56b3eee0b06f0fb73` | finished | 21,600 | AGRO SMART CONTRACTS LDA | TRU MARKET BLOCKCHAIN S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES E001-33 | `67f555dd6b3eee0b06f815e6` | confirmed | 29,652 | AGRO SMART CONTRACTS LDA | TRU MARKET BLOCKCHAIN S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES E001-52 | `690cf87e3d2ca4b63b280e92` | confirmed | 156,800 | AGRO SMART CONTRACTS LDA | TRU MARKET BLOCKCHAIN | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct |
| Frozen Berries from Chile | `68910508438d2534fe4ed31f` | confirmed | 10,368 | AGRO SMART CONTRACTS LDA | TRU MARKET BLOCKCHAIN | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| IQF TROPICAL FRUITS 40FT | `677ec54eb9fa43de6d931ebd` | finished | 41,474 | AGRO SMART CONTRACTS LDA | TRU MARKET BLOCKCHAIN S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| MANDARINA FRESCA -OMC- 5TEU | `6853637d46f5613e126c952e` | finished | 156,702 | AGRO SMART CONTRACTS LDA | BIO FARMING PERU S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| Fresh Blueberries | `670ed7c83fdd80df80736642` | confirmed | 24,086 | AGRO SMART CONTRACTS, LDA. | TRU MARKET BLOCKCHAIN S.A.C | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| MANDARINA FRESCA DAVIS-NL-001 | `2ed7c1b150ad8f4526fa7f4d` | finished | 33,461 | DAVIS GLOBAL BV | BIO FARMING PERU S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| MANDARINA FRESCA DAVIS-NL-002 | `f5773097d8a8a638caefd256` | finished | 31,413 | DAVIS GLOBAL BV | BIO FARMING PERU S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| MANDARINA FRESCA DAVIS-NL-003 | `248e0cca105c2c60131599bf` | finished | 32,469 | DAVIS GLOBAL BV | BIO FARMING PERU S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| MANDARINA FRESCA DAVIS-NL-004 | `ad35696fe45079e585ff4ef1` | finished | 31,090 | DAVIS GLOBAL BV | BIO FARMING PERU S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| MANDARINA FRESCA DAVIS-NL-005 | `dbe9992e55a45817e0d6b2cd` | finished | 33,310 | DAVIS GLOBAL BV | BIO FARMING PERU S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| MANDARINA FRESCA DAVIS-NL-006 | `0b42b541b06d1772e862b368` | finished | 30,184 | DAVIS GLOBAL BV | BIO FARMING PERU S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| MANDARINA FRESCA DAVIS-NL-007 | `484be52664c4d034ac0c8bed` | finished | 32,987 | DAVIS GLOBAL BV | BIO FARMING PERU S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| MANDARINA FRESCA DAVIS-NL-008 | `f476b4d2a714e7a83621aba0` | finished | 31,887 | DAVIS GLOBAL BV | BIO FARMING PERU S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| MANDARINA FRESCA DAVIS-NL-009 | `4de32d0a8f3a7b07c43e34b3` | finished | 32,189 | DAVIS GLOBAL BV | BIO FARMING PERU S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| MANDARINA FRESCA DAVIS-NL-010 | `17ab808caeaea4d2a6f9774e` | finished | 30,507 | DAVIS GLOBAL BV | BIO FARMING PERU S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| MANDARINA FRESCA DAVIS-NL-011 | `846e9a2ebd8357ff396e0dff` | finished | 33,979 | DAVIS GLOBAL BV | BIO FARMING PERU S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| MANDARINA FRESCA DAVIS-NL-012 | `84fc96e64a6345f411f92998` | finished | 33,785 | DAVIS GLOBAL BV | BIO FARMING PERU S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES FXP-UAE-001 | `23e57a6f048a99b2289e172e` | finished | 93,571 | FRESH EXPRESS LLC | FUNDO LAS LOMAS SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES FXP-UAE-002 | `45135bc76d452a32a725edec` | finished | 96,000 | FRESH EXPRESS LLC | FUNDO LAS LOMAS SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES FXP-UAE-003 | `bea2c0f99ebc8f06cbf904f2` | finished | 93,420 | FRESH EXPRESS LLC | FUNDO LAS LOMAS SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES FXP-UAE-004 | `0bd76140ce4658e133b374a2` | finished | 95,760 | FRESH EXPRESS LLC | FUNDO LAS LOMAS SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES FXP-UAE-005 | `3dc9aaaea9df02e3e76ae23f` | finished | 96,038 | FRESH EXPRESS LLC | FUNDO LAS LOMAS SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES FXP-UAE-006 | `72959fd4f095035fafece109` | finished | 96,653 | FRESH EXPRESS LLC | FUNDO LAS LOMAS SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES FXP-UAE-007 | `c9626056eb561b65860def70` | finished | 95,213 | FRESH EXPRESS LLC | FUNDO LAS LOMAS SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| MANDARINA FRESCA | `69c67d820bdf50f1f471aeac` | confirmed | 21,812 | GRUPO QSP SRL | BIO FARMING PERU S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| MANDARINA FRESCA 261433095-HUENEME-MNBU0401959 | `69c6a889388a149dee825208` | confirmed | 22,501 | GRUPO QSP SRL | BIO FARMING PERU S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| MANDARINA FRESCA 261715398-HUENEME-MNBU4360842 | `69c6a7d9185ebda6a9c4bd82` | confirmed | 21,812 | GRUPO QSP SRL | BIO FARMING PERU S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| MANDARINA FRESCA 261987687-HUENEME-MNBU0631925 | `69c6a452185ebda6a9c4b47c` | confirmed | 21,789 | GRUPO QSP SRL | BIO FARMING PERU S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| MANDARINA FRESCA PER8823982A-MIAMI-SMLU5477740 | `69c6a855388a149dee8250a6` | confirmed | 21,812 | GRUPO QSP SRL | BIO FARMING PERU S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| MANDARINA FRESCA PER8830115A -MIAMI-SEGU9383086 | `69c6a642388a149dee8247ae` | confirmed | 21,789 | GRUPO QSP SRL | BIO FARMING PERU S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| MANDARINA FRESCA-PER8823983A-MIAMI-SZLU5010513 | `69c6a832c5e900f5ecdcfae0` | confirmed | 21,812 | GRUPO QSP SRL | BIO FARMING PERU S.A.C. | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES GFL-CHN-001 | `06c34a88f0952a2320f620a8` | finished | 78,936 | GUANGZHOU FRESH LINK IMPORT CO LTD | ICA BLUEBERRIES SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES GFL-CHN-002 | `23e523e46e222d9075058dd8` | finished | 80,106 | GUANGZHOU FRESH LINK IMPORT CO LTD | ICA BLUEBERRIES SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES GFL-CHN-003 | `aa8a2204db5a02446f0b2d08` | finished | 80,496 | GUANGZHOU FRESH LINK IMPORT CO LTD | ICA BLUEBERRIES SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES GFL-CHN-004 | `4957b3404f55a8589b9e420e` | finished | 78,078 | GUANGZHOU FRESH LINK IMPORT CO LTD | ICA BLUEBERRIES SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH ASPARAGUS HSM-ESP-001 | `c8dcac5597b0e930ae253eff` | finished | 48,880 | HACIENDA SOTOMAYOR SL | MIKHUNA FOODS SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH ASPARAGUS HSM-ESP-002 | `7394319c4838862cd229de92` | finished | 51,920 | HACIENDA SOTOMAYOR SL | MIKHUNA FOODS SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH ASPARAGUS HSM-ESP-003 | `2d19374d4f8331ce5f4051d0` | finished | 51,120 | HACIENDA SOTOMAYOR SL | MIKHUNA FOODS SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH ASPARAGUS HSM-ESP-004 | `4b8d7a5b4742bbf14f494eaf` | finished | 49,380 | HACIENDA SOTOMAYOR SL | MIKHUNA FOODS SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH ASPARAGUS HSM-ESP-005 | `743a2854fbc7fef6e4dea5d3` | finished | 48,420 | HACIENDA SOTOMAYOR SL | MIKHUNA FOODS SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH ASPARAGUS HSM-ESP-006 | `32897f091183db2f46a577ff` | finished | 48,380 | HACIENDA SOTOMAYOR SL | MIKHUNA FOODS SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH ASPARAGUS HSM-ESP-007 | `30dc4ee7d54082ca34ad0d59` | finished | 49,560 | HACIENDA SOTOMAYOR SL | MIKHUNA FOODS SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH ASPARAGUS HSM-ESP-008 | `e2bf4fbe59c0c5bea91c0b26` | finished | 48,400 | HACIENDA SOTOMAYOR SL | MIKHUNA FOODS SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH ASPARAGUS HSM-ESP-009 | `8d28be47d037080eb35ce5a4` | finished | 49,480 | HACIENDA SOTOMAYOR SL | MIKHUNA FOODS SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FROZEN TROPICAL FRUITS - SOLIMAR-JHN-001 | `b6948e52fcced0daf3a48d45` | finished | 55,992 | JUHINEJ LTD | INDUSTRIAS SOLIMAR SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| Mango | `6682734c0b1b5991fc631b3e` | confirmed | 20,000 | Kuba | MCORP | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES TRD-CULT-001 | `69d3e6fb9e76ea086ca4c1a0` | finished | 90,612 | TRADE CULTIVATORS LLC | GIDDINS PERU SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES TRD-CULT-002 | `69d3e6fb9e76ea086ca4c1a1` | finished | 88,474 | TRADE CULTIVATORS LLC | GIDDINS PERU SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES TRD-CULT-003 | `f8292a55b92e31af8119fe8f` | finished | 88,200 | TRADE CULTIVATORS LLC | GIDDINS PERU SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES TRD-CULT-004 | `13d1c2e4dd7ce6c8c45a4b75` | finished | 91,080 | TRADE CULTIVATORS LLC | GIDDINS PERU SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES TRD-CULT-005 | `f91059110d2720ef1c100c68` | finished | 89,126 | TRADE CULTIVATORS LLC | GIDDINS PERU SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES TRD-CULT-006 | `02972b2dda4f7b4f3b133010` | finished | 89,011 | TRADE CULTIVATORS LLC | GIDDINS PERU SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| FRESH BLUEBERRIES TRD-CULT-007 | `d1b96035d6c6c32f2d6bb32f` | finished | 88,906 | TRADE CULTIVATORS LLC | GIDDINS PERU SAC | `buyer.yearsInBusiness` | buyer.yearsInBusiness; cofaceRecordId / cofaceCoveragePct; customsId / customs export records |
| Arándano fresco | `66fb1eb20b1b5991fc6479ff` | proposal | 0 | Unknown buyer | Unknown supplier | `buyer.yearsInBusiness` | buyer.yearsInBusiness; supplier.yearsInBusiness; buyer.name; supplier.name; cofaceRecordId / cofaceCoveragePct; customsId / customs export records; dealValueUSD |

## Notes

- Blueberry / 2025 enrichment only; 2024 and mandarin customs still pending.
- **Rule:** `status` finished/completed → `currentMilestone = 7` (encoded in `deal-milestone.ts` and regenerated CSV data).
- Do not mutate live TruMarket Mongo from this report — fill sources (SUNAT, Coface, Veritrade) then regenerate `src/data/platform-deals.ts`.
- See also `docs/platform-csv-cram-integration.md` and `docs/customs-veritrade-erd-and-counterparty-use.md`.
