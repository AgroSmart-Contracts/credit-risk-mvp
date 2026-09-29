/**
 * Investor-facing APY (paid to capital partners), distinct from:
 * - TruMarket platform revenue (≈8% of volume)
 * - financing.ts interestRate (credit-engine base 6% + risk/uncertainty premia)
 *
 * Band: 10–18%. Higher CRAM overall → lower APY. Optional uncertainty
 * premium (from thin counterparty data) lifts APY within the band so two
 * deals with the same composite but different data coverage do not price
 * identically for LPs.
 */

export const INVESTOR_APY_MIN = 10;
export const INVESTOR_APY_MAX = 18;

/**
 * Map CRAM overall → base investor APY in the 10–18% band.
 * Cut-points track CRAM A/B/C/D tiers with half-steps inside A/B.
 */
export function investorApyPctFromOverall(overall: number): number {
  if (overall >= 90) return 10;
  if (overall >= 85) return 10.5;
  if (overall >= 80) return 11;
  if (overall >= 75) return 12;
  if (overall >= 70) return 13;
  if (overall >= 65) return 14;
  if (overall >= 60) return 15;
  if (overall >= 55) return 16;
  if (overall >= 50) return 17;
  return 18;
}

/** Clamp and round to one decimal. */
export function clampInvestorApyPct(apyPct: number): number {
  const clamped = Math.min(
    INVESTOR_APY_MAX,
    Math.max(INVESTOR_APY_MIN, apyPct),
  );
  return Math.round(clamped * 10) / 10;
}

/**
 * Final investor APY = score band + uncertainty premium (capped at 18%).
 * `uncertaintyPremium` should match financing.ts (0–2.5).
 */
export function investorApyPct(
  overall: number,
  uncertaintyPremium = 0,
): number {
  return clampInvestorApyPct(
    investorApyPctFromOverall(overall) + Math.max(0, uncertaintyPremium),
  );
}

/** Expected investor return over a short tenor (default 2 months). */
export function expectedInvestorReturnUsd(
  financedAmountUsd: number,
  apyPct: number,
  tenorMonths = 2,
): number {
  return financedAmountUsd * (apyPct / 100) * (tenorMonths / 12);
}
