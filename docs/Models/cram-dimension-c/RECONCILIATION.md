# v1 → v2 corridor reconciliation

v1: 28 corridors + 8 unmatched · 336 rows · 3 fixed mode columns

v2: **34 mode-valid lanes** · 936 rows · stop-parameterised

11 lanes carried over unchanged. The 23 below were corrected:

| v1 corridor | v2 | What changed |
|---|---|---|
| Callao -> Madrid, Spain | `PELIM-ESMAD-A` | **POL_FIXED** — MAD air-confirmed 1.84M kg 2025. Ocean lane DELETED - Madrid landlocked |
| Callao -> Amsterdam, Netherlands | `PELIM-NLAMS-A` | **MERGED_OCEAN_TO_RTM** — AMS air-only (832K kg). v1 ocean 22d was Rotterdam mislabelled |
| Callao -> Bangkok, Thailand | `PECLL-THLCH-O` | **POD_FIXED** — Ocean POD is Laem Chabang, not Bangkok |
| Aereopuerto Jorge Chavez -> Bangkok | `PELIM-THBKK-A` | **POL_FIXED** — TH is 63% air - ocean marginal |
| _(absent)_ | `PELIM-COBOG-A` | **ADDED** — CO is 78% air (1.5M kg) - v1 had no air lane to Colombia |
| Callao -> Jebel Ali, UAE + Callao -> Dubai, UA | `PECLL-AEJEA-O` | **MERGED** — v1 scored Dubai and Jebel Ali as separate identical corridors |
| Callao -> Dubai, United Arab Emirates | `PELIM-AEDXB-A` | **POL_FIXED** — AE is 63% air |
| Callao -> Frankurt Am Main, Germany | `PELIM-DEFRA-A` | **OCEAN_DELETED** — Frankfurt landlocked. DE is 46% air |
| Callao -> Guarulhos, Brazil | `PELIM-BRGRU-A` | **OCEAN_DELETED** — GRU is an airport. BR is 100% air (442 t) |
| Callao -> Port Hueneme + Callao -> Hueneme | `PECLL-USHUE-O` | **MERGED** — v1 had these as two corridors (20 and 1 deals) |
| Chancay -> Kaohsiung, Taiwan | `PECHY-TWKHH-O` | **TRANSIT_FIXED** — v1 gave Chancay the SAME 35d as Callao. Direct Asia service is Chancay's entire rationale ❓ |
| Callao -> Malaga, Spain + Callao -> Malaga, Ch | `PECLL-ESAGP-O` | **MERGED** — 'Malaga, China' was a country-field error. Malaga port has limited reefer vs Algeciras ❓ |
| Callao -> Miami, United States | `PECLL-USMIA-O` | **TRANSIT_FIXED** — v1 gave Miami the SAME 12d as Port Hueneme - opposite coasts, Miami transits Panama ❓ |
| _(absent)_ | `PELIM-USMIA-A` | **ADDED** — MIA air 1.4M kg - v1 had no air lane |
| Callao -> Mumbai, India | `PECLL-INNSA-O` | **POD_FIXED** — Ocean POD is Nhava Sheva |
| _(absent)_ | `PELIM-INBOM-A` | **ADDED** — IN is 82% air (1.45M kg) - the dominant India mode, absent from v1 |
| Callao -> Tel Aviv, Israel | `PELIM-ILTLV-A` | **OCEAN_DELETED** — IL is 100% AIR - zero ocean declarations in 35,671 rows. Canonical routing LIM-MAD-TLV (79% via |
| _(absent)_ | `PECLL-ILASH-O` | **FLAGGED_NONEXISTENT** — Table 2 AC-confirmed 35d+ BUT zero 2025 declarations. Retained as scoreable-but-unused; 35-day  |
| Callao -> Vancouver, Canada + Callao Chile ->  | `PECLL-CAVAN-O` | **MERGED** — 'Vancouver, Netherlands' was a country-field error |
| Callao -> Vienna, Austria | `PELIM-ATVIE-A` | **OCEAN_DELETED** — Vienna landlocked |
| Callao Peru -> Shanghai, China (unmatched) | `PECLL-CNSHA-O` | **ADDED** — 31.2M kg 2025 - was in the unmatched list with no table row |
| Callao Chile -> Hong Kong (unmatched) | `PECLL-HKHKG-O` | **ADDED** — 8.0M kg 2025 - was unmatched. 'Callao, Chile' was a country error |
| SAN Antonio, Chile -> Shanghai (unmatched) | `PECLL-CLVAP-O` | **ADDED** — Valparaiso is the dominant Asia transship hub (21.7M kg) |
