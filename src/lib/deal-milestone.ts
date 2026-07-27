/** Platform deal status → effective CRAM milestone. */

const FINISHED_STATUSES = new Set(["finished", "completed", "complete"]);

/**
 * Finished / completed platform deals always complete all milestones (7).
 * Open deals keep their CSV / Mongo `currentMilestone`.
 */
export function normalizeDealMilestone(
  status: string | null | undefined,
  rawMilestone: number | null | undefined,
): number {
  const st = (status ?? "").trim().toLowerCase();
  if (FINISHED_STATUSES.has(st)) return 7;
  if (rawMilestone == null || Number.isNaN(rawMilestone)) return 0;
  return Math.max(0, Math.floor(rawMilestone));
}

export function isFinishedDealStatus(status: string | null | undefined): boolean {
  return FINISHED_STATUSES.has((status ?? "").trim().toLowerCase());
}
