# Veritrade customs fill — 2026-08-09

Source: `Veritrade_UL-20111724_PE_E_20260109105908(new).csv` (blueberry partida 081040 only, 35671 rows, 2025).

Match: buyer+supplier + date±10d + (FOB or kg within 30%) + **one DUA per deal**, reserving DUAs already on narratives.

## Applied
- customsNarrative newly filled: **14** (total now 18/170)
- shipmentCompany newly filled: **13** (total now 29/170)

## Assignments
- **FRESH BLUEBERRIES AWB 996-13806122**: score=2.85 | Eagle Trading Agriculture Marketing Ltd ← Holy Fruit Peru | ship=2025-10-21 → VT 21/10/2025 | DUA 077466-2 | 2025-10-21 | AEREO | FOB $91,920.00 | 7,920kg | ISRAEL | shipco=AIR EUROPA LINEAS AÉREAS S.A. SUCURSAL DEL PERU
- **FRESH BLUEBERRIES E001-38**: score=2.83 | Eagle Trading Agriculture Marketing Ltd ← Holy Fruit Peru | ship=2025-08-13 → VT 13/08/2025 | DUA 056607-1 | 2025-08-13 | AEREO | FOB $71,917.00 | 5,461.5kg | ISRAEL | shipco=AIR EUROPA LINEAS AÉREAS S.A. SUCURSAL DEL PERU
- **FRESH BLUEBERRIES E001-39**: score=2.82 | Eagle Trading Agriculture Marketing Ltd ← Holy Fruit Peru | ship=2025-08-18 → VT 19/08/2025 | DUA 059014-1 | 2025-08-19 | AEREO | FOB $103,661.65 | 7,831.5kg | ISRAEL | shipco=AIR EUROPA LINEAS AÉREAS S.A. SUCURSAL DEL PERU
- **FRESH BLUEBERRIES E001-42**: score=2.81 | Eagle Trading Agriculture Marketing Ltd ← Holy Fruit Peru | ship=2025-09-28 → VT 28/09/2025 | DUA 070310-1 | 2025-09-28 | AEREO | FOB $72,882.33 | 6,238.5kg | ISRAEL | shipco=AIR EUROPA LINEAS AÉREAS S.A. SUCURSAL DEL PERU
- **FRESH BLUEBERRIES AWB996-13810333**: score=2.81 | Eagle Trading Agriculture Marketing Ltd ← Holy Fruit Peru | ship=2025-10-27 → VT 27/10/2025 | DUA 079557-1 | 2025-10-27 | AEREO | FOB $39,340.84 | 3,498kg | ISRAEL | shipco=AIR EUROPA LINEAS AÉREAS S.A. SUCURSAL DEL PERU
- **FRESH BLUEBERRIES E001-50**: score=2.81 | Eagle Trading Agriculture Marketing Ltd ← TRU MARKET BLOCKCHAIN S.A.C. | ship=2025-11-10 → VT 10/11/2025 | DUA 083159-2 | 2025-11-10 | AEREO | FOB $68,601.50 | 6,394.5kg | ISRAEL | shipco=AIR EUROPA LINEAS AÉREAS S.A. SUCURSAL DEL PERU
- **FRESH BLUEBERRIES E001-40**: score=2.81 | Eagle Trading Agriculture Marketing Ltd ← Holy Fruit Peru | ship=2025-09-01 → VT 02/09/2025 | DUA 063040-1 | 2025-09-02 | AEREO | FOB $71,860.40 | 5,983.5kg | ISRAEL | shipco=AIR EUROPA LINEAS AÉREAS S.A. SUCURSAL DEL PERU
- **FRESH BLUEBERRIES AWB 996-13806144**: score=2.80 | Eagle Trading Agriculture Marketing Ltd ← Holy Fruit Peru | ship=2025-10-20 → VT 20/10/2025 | DUA 076596-1 | 2025-10-20 | AEREO | FOB $38,983.60 | 3,600kg | ISRAEL | shipco=AIR EUROPA LINEAS AÉREAS S.A. SUCURSAL DEL PERU
- **FRESH BLUEBERRIES AWB 996-13806111**: score=2.78 | Eagle Trading Agriculture Marketing Ltd ← Holy Fruit Peru | ship=2025-10-13 → VT 15/10/2025 | DUA 075566-1 | 2025-10-15 | AEREO | FOB $92,274.96 | 7,903.5kg | ISRAEL | shipco=AIR EUROPA LINEAS AÉREAS S.A. SUCURSAL DEL PERU
- **FRESH BLUEBERRIES E001-41**: score=2.78 | Eagle Trading Agriculture Marketing Ltd ← Holy Fruit Peru | ship=2025-09-13 → VT 16/09/2025 | DUA 067181-2 | 2025-09-16 | AEREO | FOB $35,706.74 | 2,880kg | ISRAEL | shipco=AIR EUROPA LINEAS AÉREAS S.A. SUCURSAL DEL PERU
- **FRESH BLUEBERRIES AWB 996-13810355**: score=2.30 | Eagle Trading Agriculture Marketing Ltd ← Holy Fruit Peru | ship=2025-11-03 → VT 03/11/2025 | DUA 081399-1 | 2025-11-03 | AEREO | FOB $66,744.00 | 6,480kg | ISRAEL | shipco=AIR EUROPA LINEAS AÉREAS S.A. SUCURSAL DEL PERU
- **FRESH BLUEBERRIES E001-31**: score=2.23 | A.S.M International ← TRU MARKET BLOCKCHAIN S.A.C. | ship=2025-02-07 → VT 08/02/2025 | DUA 010095-1 | 2025-02-08 | AEREO | FOB $14,006.76 | 1,800kg | INDIA | shipco=AIR FRANCE
- **FRESH BLUEBERRIES E001-14**: score=2.00 | A.S.M International ← TRU MARKET BLOCKCHAIN S.A.C. | ship=16/02/2025 → VT 16/02/2025 | DUA 011894-1 | 2025-02-16 | AEREO | FOB $13,277.83 | 1,800kg | INDIA | shipco=KLM CARGO
- **Fresh Blueberries PI25E001-41**: score=1.85 | Eagle Trading Agriculture Marketing Ltd ← TRU MARKET BLOCKCHAIN S.A.C. | ship=10/11/2025 → VT 17/11/2025 | DUA 085431-1 | 2025-11-17 | AEREO | FOB $48,360.00 | 6,008kg | ISRAEL | shipco=AIR EUROPA LINEAS AÉREAS S.A. SUCURSAL DEL PERU
- **FRESH BLUEBERRIES E001-52** (existing DUA 118757): shipco ← TRAMARSA - TRABAJOS MARITIMOS S.A.

## Limits of this file
- **Blueberries only** — no mandarin/avocado/ginger/asparagus/IQF fills.
- Strict buyer×supplier — TruMarket-as-supplier only matches when VT lists TruMarket as Exportador (~12 rows).
- Holy Fruit×Eagle and a few TruMarket lanes matched; most other counterparties have no overlapping lane in-window.
- DUA collisions after fill: none
