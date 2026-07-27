import type { RouteRiskProfile } from "../types";

export type CorridorRiskFlag = "Low" | "Low-Med" | "Medium" | "Med-High" | "High";

export const ROUTE_OPTIONS: RouteRiskProfile[] = [
  {
    origin: "Callao, Peru",
    destination: "Buenaventura, Colombia",
    score: 86,
    estimatedTransitDays: 7,
    numberOfTransshipments: 0,
    routeRiskFlag: "Low",
    rationale: "Short-haul regional corridor with direct reefer service and limited disruption exposure.",
    scoreConfirmed: true,
  },
  {
    origin: "Callao, Peru",
    destination: "Miami, United States",
    score: 76,
    estimatedTransitDays: 12,
    numberOfTransshipments: 0,
    routeRiskFlag: "Low",
    rationale: "Established perishables corridor with frequent sailings and deep destination liquidity.",
    scoreConfirmed: true,
  },
  {
    origin: "Callao, Peru",
    destination: "Port Hueneme, United States",
    score: 76,
    estimatedTransitDays: 12,
    numberOfTransshipments: 0,
    routeRiskFlag: "Low",
    rationale:
      "Same corridor class as the Miami entry (US West Coast reefer gateway) — this is the single largest destination in the real deal book (Open Markets Corp / Grupo QSP mandarina, ~20 deals).",
    scoreConfirmed: false,
  },
  {
    origin: "Callao, Peru",
    destination: "Hueneme, United States",
    score: 76,
    estimatedTransitDays: 12,
    numberOfTransshipments: 0,
    routeRiskFlag: "Low",
    rationale: "Same port as \"Port Hueneme\" above — alternate transcription seen in TM's own destination-port field.",
    scoreConfirmed: false,
  },
  {
    origin: "Callao, Peru",
    destination: "Valencia, Spain",
    score: 74,
    estimatedTransitDays: 18,
    numberOfTransshipments: 1,
    routeRiskFlag: "Low",
    rationale: "Well-served European route; moderate transit time but strong market absorption.",
    scoreConfirmed: true,
  },
  {
    origin: "Callao, Peru",
    destination: "Rotterdam, Netherlands",
    score: 70,
    estimatedTransitDays: 22,
    numberOfTransshipments: 1,
    routeRiskFlag: "Low",
    rationale: "Reliable corridor into a deep trading hub, though transit length raises freshness pressure.",
    scoreConfirmed: true,
  },
  {
    origin: "Callao, Peru",
    destination: "Jebel Ali, UAE",
    score: 56,
    estimatedTransitDays: 18,
    numberOfTransshipments: 1,
    routeRiskFlag: "Medium",
    rationale: "Longer transit and handling complexity create moderate execution risk.",
    scoreConfirmed: true,
  },
  {
    origin: "Callao, Peru",
    destination: "Kaohsiung, Taiwan, Province of China",
    score: 44,
    estimatedTransitDays: 35,
    numberOfTransshipments: 1,
    routeRiskFlag: "High",
    rationale: "Long-haul perishables route operating near shelf-life tolerance with higher claim frequency.",
    scoreConfirmed: true,
  },
  {
    origin: "Chancay, Peru",
    destination: "Kaohsiung, Taiwan, Province of China",
    score: 44,
    estimatedTransitDays: 35,
    numberOfTransshipments: 1,
    routeRiskFlag: "High",
    rationale: "Same corridor as Callao→Kaohsiung — Chancay is Peru's newer deep-water port, same destination profile.",
    scoreConfirmed: false,
  },

  // --- Added 2026-07-24: corridors hit by the real (non-likely_test) deal book that had no
  // row at all. Sourced from tm-cram-reference-tables-2026-07.md Table 2 where a 🔶/✅ figure
  // exists; everything else is a provisional regional estimate — see
  // docs/product-route-table-gaps-2026-07.md for the full gap list and what to verify against
  // real BL/customs-clearance history.

  {
    origin: "Callao, Peru",
    destination: "Tel Aviv, Israel",
    score: 30,
    estimatedTransitDays: 35,
    numberOfTransshipments: 1,
    routeRiskFlag: "High",
    rationale:
      "Table 2 (AC-confirmed 2026-07-09): 35d+ transit via Med-hub transshipment, exceeds the 35-day perishables ceiling; thin resale market on rejection. Real deal book's largest single-corridor exposure (Eagle Trading, ~130k kg across 22 deals split Israel/UAE).",
    scoreConfirmed: true,
  },
  {
    origin: "Callao, Peru",
    destination: "Dubai, United Arab Emirates",
    score: 56,
    estimatedTransitDays: 18,
    numberOfTransshipments: 1,
    routeRiskFlag: "Medium",
    rationale:
      "Same corridor characteristics as the existing Jebel Ali entry (Dubai is the same UAE hub, different port-name string in TM's own destination field).",
    scoreConfirmed: true,
  },
  {
    origin: "Callao, Peru",
    destination: "Lisbon, Portugal",
    score: 68,
    estimatedTransitDays: 20,
    numberOfTransshipments: 1,
    routeRiskFlag: "Low",
    rationale: "Table 2 (proposed 🔶): often via Algeciras (1 stop), 18–22d, ≤3–5d customs.",
    scoreConfirmed: false,
  },
  {
    origin: "Callao, Peru",
    destination: "Amsterdam, Netherlands",
    score: 70,
    estimatedTransitDays: 22,
    numberOfTransshipments: 1,
    routeRiskFlag: "Low",
    rationale: "Same corridor class as the existing Rotterdam entry (alternate NL gateway port).",
    scoreConfirmed: true,
  },
  {
    origin: "Callao, Peru",
    destination: "Madrid, Spain",
    score: 74,
    estimatedTransitDays: 18,
    numberOfTransshipments: 1,
    routeRiskFlag: "Low",
    rationale: "Same corridor class as the existing Valencia entry (air/inland routing to Spain).",
    scoreConfirmed: false,
  },
  {
    origin: "Callao, Peru",
    destination: "Malaga, Spain",
    score: 74,
    estimatedTransitDays: 18,
    numberOfTransshipments: 1,
    routeRiskFlag: "Low",
    rationale: "Same corridor class as the existing Valencia entry.",
    scoreConfirmed: false,
  },
  {
    origin: "Callao, Peru",
    destination: "Mumbai, India",
    score: 50,
    estimatedTransitDays: 28,
    numberOfTransshipments: 1,
    routeRiskFlag: "High",
    rationale:
      "Provisional — not in Table 2 (no PE→India corridor documented). Regional estimate only (Middle East/South Asia hub transit range); verify against real BL history (A.S.M International, 5 deals).",
    scoreConfirmed: false,
  },
  {
    origin: "Callao, Peru",
    destination: "Gdansk, Poland",
    score: 62,
    estimatedTransitDays: 24,
    numberOfTransshipments: 1,
    routeRiskFlag: "Medium",
    rationale:
      "Provisional — not in Table 2. Estimated as similar to the Rotterdam/NL-north corridor plus inland/Baltic leg; verify against real BL history (Limax, 7 deals; MCORP/Kuba, 1 deal).",
    scoreConfirmed: false,
  },
  {
    origin: "Callao, Peru",
    destination: "Guarulhos, Brazil",
    score: 78,
    estimatedTransitDays: 10,
    numberOfTransshipments: 0,
    routeRiskFlag: "Low",
    rationale:
      "Provisional — not in Table 2. Short-haul South America corridor by air freight per the real deal book's own transit figures (~10d); treated like the Buenaventura corridor class.",
    scoreConfirmed: false,
  },
  {
    origin: "Callao, Peru",
    destination: "San Antonio, Chile",
    score: 84,
    estimatedTransitDays: 7,
    numberOfTransshipments: 0,
    routeRiskFlag: "Low",
    rationale:
      "Provisional — not in Table 2. Short-haul intra-LATAM corridor, treated like Buenaventura.",
    scoreConfirmed: false,
  },
  {
    origin: "Callao, Peru",
    destination: "Vienna, Austria",
    score: 66,
    estimatedTransitDays: 24,
    numberOfTransshipments: 1,
    routeRiskFlag: "Medium",
    rationale:
      "Provisional — not in Table 2 (no PE→Austria corridor documented, inland from an EU seaport). Regional estimate only; verify against real BL history (Anterra Farms GmbH, 2 deals).",
    scoreConfirmed: false,
  },
  {
    origin: "Callao, Peru",
    destination: "Bangkok, Thailand",
    score: 40,
    estimatedTransitDays: 34,
    numberOfTransshipments: 1,
    routeRiskFlag: "Medium",
    rationale:
      "Table 2 (proposed 🔶): 30–38d via Asia hub transshipment, near the ceiling for most fresh categories; ≤3–5d customs.",
    scoreConfirmed: false,
  },
  {
    origin: "Callao, Peru",
    destination: "St Petersburg, Russian Federation",
    score: 32,
    estimatedTransitDays: 30,
    numberOfTransshipments: 1,
    routeRiskFlag: "High",
    rationale:
      "Provisional — not in Table 2. Long transit + payment-rail/sanctions friction on this corridor is a known open item; regional estimate only, treated close to the Egypt/Jordan class pending real data.",
    scoreConfirmed: false,
  },

  {
    origin: "Callao, Peru",
    destination: "Frankurt Am Main, Germany",
    score: 60,
    estimatedTransitDays: 26,
    numberOfTransshipments: 1,
    routeRiskFlag: "Medium",
    rationale:
      "Provisional — not in Table 2 (no PE→Germany corridor documented directly, Frankfurt is inland from an EU seaport). Note: \"Frankurt\" is TM's own destination-port field spelling, preserved here so the lookup matches; the city is Frankfurt am Main.",
    scoreConfirmed: false,
  },
  {
    origin: "Callao, Peru",
    destination: "Algeciras, Spain",
    score: 74,
    estimatedTransitDays: 19,
    numberOfTransshipments: 1,
    routeRiskFlag: "Low",
    rationale: "Table 2 (proposed 🔶): direct service, 17–21d, 3–5d customs — Spain's main entry gateway.",
    scoreConfirmed: false,
  },
  {
    origin: "Callao, Peru",
    destination: "San Vicente, Chile",
    score: 84,
    estimatedTransitDays: 8,
    numberOfTransshipments: 0,
    routeRiskFlag: "Low",
    rationale: "Same corridor class as the San Antonio, Chile entry (nearby Chilean port).",
    scoreConfirmed: false,
  },
  {
    origin: "Callao, Peru",
    destination: "Vancouver, Canada",
    score: 66,
    estimatedTransitDays: 14,
    numberOfTransshipments: 1,
    routeRiskFlag: "Medium",
    rationale:
      "Provisional — not in Table 2. Both real Canada-bound deals in the book are proposal-status only (never confirmed) per product-details-2026-07-22.csv, so there's no real BL history yet to verify against.",
    scoreConfirmed: false,
  },
  {
    origin: "Aereopuerto Jorge Chavez, Peru",
    destination: "Bangkok, Thailand",
    score: 40,
    estimatedTransitDays: 34,
    numberOfTransshipments: 1,
    routeRiskFlag: "Medium",
    rationale: "Same corridor as Callao→Bangkok — Jorge Chávez is Lima's airport, used for the air-freight leg of this route instead of the Callao seaport.",
    scoreConfirmed: false,
  },
  // Not tabled on purpose: the "Frozen Berries from Chile" deal (mongoId 68910508…)
  // has origin=Chile, destination=Netherlands, but destination *port*=Vancouver —
  // an internal data-quality inconsistency in TM's own row, not a real corridor.
  // Left unmatched deliberately; falls back to the by_air transport-mode estimate.
  // See docs/product-route-table-gaps-2026-07.md.

  // Ecuador origin — used by the «Ardzhies» LLC / Russia deals (Puerto Bolivar, not Callao).
  {
    origin: "Puerto Bolivar, Ecuador",
    destination: "St Petersburg, Russian Federation",
    score: 32,
    estimatedTransitDays: 30,
    numberOfTransshipments: 1,
    routeRiskFlag: "High",
    rationale: "Same corridor class as the Callao→St Petersburg entry.",
    scoreConfirmed: false,
  },
];

function normalizeLocation(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function lookupRouteRisk(
  origin: string,
  destination: string,
): RouteRiskProfile | null {
  const normalizedOrigin = normalizeLocation(origin);
  const normalizedDestination = normalizeLocation(destination);

  return (
    ROUTE_OPTIONS.find(
      (entry) =>
        normalizeLocation(entry.origin) === normalizedOrigin &&
        normalizeLocation(entry.destination) === normalizedDestination,
    ) ?? null
  );
}
