/**
 * Credit-policy points still open with the TruMarket risk lead (risk audit,
 * 24 nov 2026, "waiting on AC"). Each is one switch, so a ruling is a one-line
 * change. The values below are the state today: nothing is built ahead.
 *
 * Settled elsewhere, no switch needed:
 * - Thresholds 1.50 / 1.30 / 1.10: `COVERAGE_BANDS` in lib/bcp/calc.ts, shown
 *   everywhere as "propuestos" until agreed with BCP.
 * - Who moves a loan to red: the bank, on TruMarket's written recommendation;
 *   the next tranche freezes automatically from orange (Method page, exceptions).
 * - The bank's cost: only inside the amount due, labelled estimated; no rate on
 *   screen (`BANK_COST_RATE` in lib/bcp/calc.ts).
 */
export const RULINGS = {
  /**
   * Can a technical signal (crop vigour, weather) set a loan's colour on its own?
   * The 19 nov rule says no: state = worse of coverage band and controls. Pending
   * confirmation, ICA-0188 stays amber on its vigour signal; `false` makes it green
   * with TruMarket follow-up.
   */
  technicalSignalsSetState: true,
  /**
   * Does the bank edition show each driver's projected range (rounded to 0.05x),
   * e.g. ICA-0201 use of funds −0.25x to −0.40x? Until ruled, only the internal
   * edition does; the bank sees the alert and the loan's overall projection.
   */
  bankSeesDriverProjections: false,
} as const;
