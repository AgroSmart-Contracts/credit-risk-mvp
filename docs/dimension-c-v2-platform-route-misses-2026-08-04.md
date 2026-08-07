# Dimension C v2 — platform deal route table misses

Generated: 2026-08-04
Engine: `dimension-c-v2`
Source: prescored platform deals (`platformDealsReadyForCounterparty` → `lookupRouteRisk`)

## Summary

| Metric | Count |
|---|---:|
| Platform deals (ready / listed) | 157 |
| Table hit | 99 |
| **Table miss** | **58** |
| Distinct miss corridors (OD × product × mode × stops) | 10 |

Misses do **not** invent transit/transship/flag points. Route score falls back to **base 70** (HANDOFF: engine never guesses).

## Likely causes

1. **Air tagged at seaport** — platform OD uses `Callao, Peru` for air; Dimension C air lanes POL is `Lima Jorge Chavez` (LIM).
2. **Country-level OD** — e.g. `Peru → Netherlands` instead of a scored node pair.
3. **Destination not in `lanes.csv`** — Guarulhos, Mumbai, Tel Aviv, etc. may be absent or under a different node name.
4. **Product / mode / stop combo** — row exists for ocean but not for this air stop count (exact `airStops` key).

## Misses by corridor (grouped)

### Callao, Peru → Dubai, United Arab Emirates · Fresh Blueberries · air · stops=1 (31 deals)

| Deal ref | Mongo ID | Incoterm | Fallback route score |
|---|---|---|---:|
| FRESH BLUEBERRIES AWB 996-13806111 | `6925c62b11cf91e11fc0fc68` | FOB | 70 |
| FRESH BLUEBERRIES AWB 996-13806122 | `6925cf9511cf91e11fc16b90` | FOB | 70 |
| FRESH BLUEBERRIES AWB 996-13806144 | `6925cc7b11cf91e11fc1329f` | FOB | 70 |
| FRESH BLUEBERRIES AWB 996-13810355 | `6925d34c11cf91e11fc1c847` | FOB | 70 |
| FRESH BLUEBERRIES AWB 996-13810366 | `692eea6b89cca3bcb7a1b6ef` | FOB | 70 |
| FRESH BLUEBERRIES AWB 996-13810366 | `692eeaed89cca3bcb7a1c661` | FOB | 70 |
| FRESH BLUEBERRIES AWB 996-13810366 | `692f092789cca3bcb7a2357d` | FOB | 70 |
| FRESH BLUEBERRIES AWB996-13810333 | `6925d1ba11cf91e11fc193a6` | FOB | 70 |
| FRESH BLUEBERRIES E001-38 | `6922fd4e11cf91e11fbd2f5a` | FOB | 70 |
| FRESH BLUEBERRIES E001-39 | `6922fe9111cf91e11fbd3178` | FOB | 70 |
| FRESH BLUEBERRIES E001-40 | `6923012511cf91e11fbd4971` | FOB | 70 |
| FRESH BLUEBERRIES E001-41 | `6923022c11cf91e11fbd5796` | FOB | 70 |
| FRESH BLUEBERRIES E001-42 | `6923043011cf91e11fbd6a29` | FOB | 70 |
| FRESH BLUEBERRIES E001-49 | `690cfcb63d2ca4b63b283ea7` | FOB | 70 |
| FRESH BLUEBERRIES E001-49 | `6915d77ae5985f7040b71697` | FOB | 70 |
| FRESH BLUEBERRIES E001-49 | `6915ee6862ce4b73260d6977` | FOB | 70 |
| FRESH BLUEBERRIES E001-50 | `690cfba23d2ca4b63b282e8b` | FOB | 70 |
| FRESH BLUEBERRIES FXP-UAE-001 | `23e57a6f048a99b2289e172e` | FOB | 70 |
| FRESH BLUEBERRIES FXP-UAE-002 | `45135bc76d452a32a725edec` | FOB | 70 |
| FRESH BLUEBERRIES FXP-UAE-003 | `bea2c0f99ebc8f06cbf904f2` | FOB | 70 |
| FRESH BLUEBERRIES FXP-UAE-004 | `0bd76140ce4658e133b374a2` | FOB | 70 |
| FRESH BLUEBERRIES FXP-UAE-005 | `3dc9aaaea9df02e3e76ae23f` | FOB | 70 |
| FRESH BLUEBERRIES FXP-UAE-006 | `72959fd4f095035fafece109` | FOB | 70 |
| FRESH BLUEBERRIES FXP-UAE-007 | `c9626056eb561b65860def70` | FOB | 70 |
| FRESH BLUEBERRIES TRD-CULT-001 | `69d3e6fb9e76ea086ca4c1a0` | FOB | 70 |
| FRESH BLUEBERRIES TRD-CULT-002 | `69d3e6fb9e76ea086ca4c1a1` | FOB | 70 |
| FRESH BLUEBERRIES TRD-CULT-003 | `f8292a55b92e31af8119fe8f` | FOB | 70 |
| FRESH BLUEBERRIES TRD-CULT-004 | `13d1c2e4dd7ce6c8c45a4b75` | FOB | 70 |
| FRESH BLUEBERRIES TRD-CULT-005 | `f91059110d2720ef1c100c68` | FOB | 70 |
| FRESH BLUEBERRIES TRD-CULT-006 | `02972b2dda4f7b4f3b133010` | FOB | 70 |
| FRESH BLUEBERRIES TRD-CULT-007 | `d1b96035d6c6c32f2d6bb32f` | FOB | 70 |

### Callao, Peru → Tel Aviv, Israel · Fresh Blueberries · air · stops=1 (7 deals)

| Deal ref | Mongo ID | Incoterm | Fallback route score |
|---|---|---|---:|
| FRESH BLUEBERRIES E001-27 | `6759b914b9fa43de6d86f192` | FOB | 70 |
| FRESH BLUEBERRIES E001-35 | `67ec128e6b3eee0b06f6547b` | FOB | 70 |
| Fresh Blueberries PI25E001-38 | `688120b2953ab2c775d3e679` | FOB | 70 |
| Fresh Blueberries PI25E001-39 | `68839958953ab2c775d51830` | FOB | 70 |
| Fresh Blueberries PI25E001-40 | `68839a11953ab2c775d51f2e` | FOB | 70 |
| Fresh Blueberries PI25E001-40 | `68839b61953ab2c775d53dc7` | FOB | 70 |
| Fresh Blueberries PI25E001-41 | `68839aad953ab2c775d523ef` | FOB | 70 |

### Callao, Peru → Amsterdam, Netherlands · Fresh Blueberries · air · stops=1 (5 deals)

| Deal ref | Mongo ID | Incoterm | Fallback route score |
|---|---|---|---:|
| FRESH BLUEBERRIES E001-12 | `676449d1b9fa43de6d8bcd7e` | FOB | 70 |
| FRESH BLUEBERRIES E001-16 | `675b7892b9fa43de6d887afe` | FOB | 70 |
| FRESH BLUEBERRIES E001-17 | `675b799bb9fa43de6d88826b` | FOB | 70 |
| FRESH BLUEBERRIES E001-18 | `675b708fb9fa43de6d882fb9` | FOB | 70 |
| FRESH BLUEBERRIES E001-19 | `675b6053b9fa43de6d879470` | FOB | 70 |

### Callao, Peru → Mumbai, India · Fresh Blueberries · air · stops=1 (5 deals)

| Deal ref | Mongo ID | Incoterm | Fallback route score |
|---|---|---|---:|
| FRESH BLUEBERRIES E001-14 | `6761acdbb9fa43de6d8a387f` | FOB | 70 |
| FRESH BLUEBERRIES E001-29 | `6786a6e9b9fa43de6d94b696` | FOB | 70 |
| FRESH BLUEBERRIES E001-30 | `6797c0246b3eee0b06efb2a9` | FOB | 70 |
| FRESH BLUEBERRIES E001-31 | `67a4c9a56b3eee0b06f0fb73` | FOB | 70 |
| FRESH BLUEBERRIES E001-33 | `67f555dd6b3eee0b06f815e6` | FOB | 70 |

### Callao, Peru → Guarulhos, Brazil · Fresh Blueberries · air · stops=1 (3 deals)

| Deal ref | Mongo ID | Incoterm | Fallback route score |
|---|---|---|---:|
| Fresh Blueberries | `670ed7c83fdd80df80736642` | FOB | 70 |
| Fresh Blueberries | `670edd033fdd80df80736ef5` | FOB | 70 |
| FRESH BLUEBERRIES E001-11 | `6764614cb9fa43de6d8c1bc2` | FOB | 70 |

### Callao, Peru → Frankurt Am Main, Germany · Fresh Asparagus · air · stops=1 (2 deals)

| Deal ref | Mongo ID | Incoterm | Fallback route score |
|---|---|---|---:|
| FRESH ASPARAGUS E001-10 | `677c2b8ab9fa43de6d90a08a` | FOB | 70 |
| FRESH ASPARAGUS E001-10 | `677c3e54b9fa43de6d91291b` | FOB | 70 |

### Callao, Peru → Vancouver, Canada · Fresh Blueberries · air · stops=1 (2 deals)

| Deal ref | Mongo ID | Incoterm | Fallback route score |
|---|---|---|---:|
| Blueberries Export Canada | `6890fd76438d2534fe4eb33c` | FOB | 70 |
| Blueberries EXW Canada E001-42 | `6890fdf0438d2534fe4ebc56` | FOB | 70 |

### Callao, Peru → Madrid, Spain · Fresh Blueberries · air · stops=1 (1 deal)

| Deal ref | Mongo ID | Incoterm | Fallback route score |
|---|---|---|---:|
| FRESH BLUEBERRIES E001-23 | `675a16e4b9fa43de6d873513` | FOB | 70 |

### Callao, Peru → Vancouver, Canada · Frozen Tropical Fruits · air · stops=1 (1 deal)

| Deal ref | Mongo ID | Incoterm | Fallback route score |
|---|---|---|---:|
| Frozen Berries from Chile | `68910508438d2534fe4ed31f` | FOB | 70 |

### San Antonio, Chile → Hong Kong, Hong Kong · Mixed Berries / Tropical Fruits (IQF) · sea · stops=1 (1 deal)

| Deal ref | Mongo ID | Incoterm | Fallback route score |
|---|---|---|---:|
| FRESH MIXED BERRIES KHI-HKG-004 | `1f4444e7365df2ff9ca128c1` | FOB | 70 |

## Flat list (all 58 misses)

| # | Deal ref | Origin | Destination | Product | Mode | Stops | Fallback |
|---:|---|---|---|---|---|---:|---:|
| 1 | FRESH BLUEBERRIES E001-12 | Callao, Peru | Amsterdam, Netherlands | Fresh Blueberries | air | 1 | 70 |
| 2 | FRESH BLUEBERRIES E001-16 | Callao, Peru | Amsterdam, Netherlands | Fresh Blueberries | air | 1 | 70 |
| 3 | FRESH BLUEBERRIES E001-17 | Callao, Peru | Amsterdam, Netherlands | Fresh Blueberries | air | 1 | 70 |
| 4 | FRESH BLUEBERRIES E001-18 | Callao, Peru | Amsterdam, Netherlands | Fresh Blueberries | air | 1 | 70 |
| 5 | FRESH BLUEBERRIES E001-19 | Callao, Peru | Amsterdam, Netherlands | Fresh Blueberries | air | 1 | 70 |
| 6 | FRESH BLUEBERRIES AWB 996-13806111 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 7 | FRESH BLUEBERRIES AWB 996-13806122 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 8 | FRESH BLUEBERRIES AWB 996-13806144 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 9 | FRESH BLUEBERRIES AWB 996-13810355 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 10 | FRESH BLUEBERRIES AWB 996-13810366 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 11 | FRESH BLUEBERRIES AWB 996-13810366 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 12 | FRESH BLUEBERRIES AWB 996-13810366 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 13 | FRESH BLUEBERRIES AWB996-13810333 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 14 | FRESH BLUEBERRIES E001-38 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 15 | FRESH BLUEBERRIES E001-39 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 16 | FRESH BLUEBERRIES E001-40 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 17 | FRESH BLUEBERRIES E001-41 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 18 | FRESH BLUEBERRIES E001-42 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 19 | FRESH BLUEBERRIES E001-49 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 20 | FRESH BLUEBERRIES E001-49 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 21 | FRESH BLUEBERRIES E001-49 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 22 | FRESH BLUEBERRIES E001-50 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 23 | FRESH BLUEBERRIES FXP-UAE-001 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 24 | FRESH BLUEBERRIES FXP-UAE-002 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 25 | FRESH BLUEBERRIES FXP-UAE-003 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 26 | FRESH BLUEBERRIES FXP-UAE-004 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 27 | FRESH BLUEBERRIES FXP-UAE-005 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 28 | FRESH BLUEBERRIES FXP-UAE-006 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 29 | FRESH BLUEBERRIES FXP-UAE-007 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 30 | FRESH BLUEBERRIES TRD-CULT-001 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 31 | FRESH BLUEBERRIES TRD-CULT-002 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 32 | FRESH BLUEBERRIES TRD-CULT-003 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 33 | FRESH BLUEBERRIES TRD-CULT-004 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 34 | FRESH BLUEBERRIES TRD-CULT-005 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 35 | FRESH BLUEBERRIES TRD-CULT-006 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 36 | FRESH BLUEBERRIES TRD-CULT-007 | Callao, Peru | Dubai, United Arab Emirates | Fresh Blueberries | air | 1 | 70 |
| 37 | FRESH ASPARAGUS E001-10 | Callao, Peru | Frankurt Am Main, Germany | Fresh Asparagus | air | 1 | 70 |
| 38 | FRESH ASPARAGUS E001-10 | Callao, Peru | Frankurt Am Main, Germany | Fresh Asparagus | air | 1 | 70 |
| 39 | Fresh Blueberries | Callao, Peru | Guarulhos, Brazil | Fresh Blueberries | air | 1 | 70 |
| 40 | Fresh Blueberries | Callao, Peru | Guarulhos, Brazil | Fresh Blueberries | air | 1 | 70 |
| 41 | FRESH BLUEBERRIES E001-11 | Callao, Peru | Guarulhos, Brazil | Fresh Blueberries | air | 1 | 70 |
| 42 | FRESH BLUEBERRIES E001-23 | Callao, Peru | Madrid, Spain | Fresh Blueberries | air | 1 | 70 |
| 43 | FRESH BLUEBERRIES E001-14 | Callao, Peru | Mumbai, India | Fresh Blueberries | air | 1 | 70 |
| 44 | FRESH BLUEBERRIES E001-29 | Callao, Peru | Mumbai, India | Fresh Blueberries | air | 1 | 70 |
| 45 | FRESH BLUEBERRIES E001-30 | Callao, Peru | Mumbai, India | Fresh Blueberries | air | 1 | 70 |
| 46 | FRESH BLUEBERRIES E001-31 | Callao, Peru | Mumbai, India | Fresh Blueberries | air | 1 | 70 |
| 47 | FRESH BLUEBERRIES E001-33 | Callao, Peru | Mumbai, India | Fresh Blueberries | air | 1 | 70 |
| 48 | FRESH BLUEBERRIES E001-27 | Callao, Peru | Tel Aviv, Israel | Fresh Blueberries | air | 1 | 70 |
| 49 | FRESH BLUEBERRIES E001-35 | Callao, Peru | Tel Aviv, Israel | Fresh Blueberries | air | 1 | 70 |
| 50 | Fresh Blueberries PI25E001-38 | Callao, Peru | Tel Aviv, Israel | Fresh Blueberries | air | 1 | 70 |
| 51 | Fresh Blueberries PI25E001-39 | Callao, Peru | Tel Aviv, Israel | Fresh Blueberries | air | 1 | 70 |
| 52 | Fresh Blueberries PI25E001-40 | Callao, Peru | Tel Aviv, Israel | Fresh Blueberries | air | 1 | 70 |
| 53 | Fresh Blueberries PI25E001-40 | Callao, Peru | Tel Aviv, Israel | Fresh Blueberries | air | 1 | 70 |
| 54 | Fresh Blueberries PI25E001-41 | Callao, Peru | Tel Aviv, Israel | Fresh Blueberries | air | 1 | 70 |
| 55 | Blueberries Export Canada | Callao, Peru | Vancouver, Canada | Fresh Blueberries | air | 1 | 70 |
| 56 | Blueberries EXW Canada E001-42 | Callao, Peru | Vancouver, Canada | Fresh Blueberries | air | 1 | 70 |
| 57 | Frozen Berries from Chile | Callao, Peru | Vancouver, Canada | Frozen Tropical Fruits | air | 1 | 70 |
| 58 | FRESH MIXED BERRIES KHI-HKG-004 | San Antonio, Chile | Hong Kong, Hong Kong | Mixed Berries / Tropical Fruits (IQF) | sea | 1 | 70 |

## Next steps

- Map platform air origins `Callao*` to LIM aliases (or normalize in `platform-deal-mapper`).
- Add missing lanes/nodes in Dimension C (`lanes.csv` / `nodes.csv`) then `./run.sh` + `npm run build:route-risk`.
- Prefer port/airport codes over country-only OD in the platform export.
