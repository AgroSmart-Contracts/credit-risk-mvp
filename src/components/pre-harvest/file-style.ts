import type { PreHarvestDeal } from "../../lib/pre-harvest/types";
import type { FileStatus } from "../../lib/pre-harvest/verdict";
import { CHART_COLORS } from "./theme";

/**
 * Colour is reserved for what needs attention. A normal file is neutral grey;
 * only follow-up / watch / stopped / declined get colour.
 */
export const STATUS_STYLE: Record<FileStatus, { pill: string; dot: string }> = {
  normal: { pill: "border-tm-border bg-tm-surface text-tm-black", dot: CHART_COLORS.muted },
  followup: { pill: "border-tm-blue/40 bg-tm-blue/10 text-tm-blue", dot: CHART_COLORS.blue },
  watch: { pill: "border-tm-accent/50 bg-tm-accent/10 text-tm-accent-dark", dot: CHART_COLORS.yellow },
  stopped: { pill: "border-tm-danger/50 bg-tm-danger/10 text-tm-danger-dark", dot: CHART_COLORS.red },
  // Declined is a settled outcome, not a live risk: neutral grey. Red is kept for live risk only.
  declined: { pill: "border-tm-border bg-tm-neutral text-tm-text-light", dot: CHART_COLORS.muted },
  repaid: { pill: "border-tm-border bg-tm-surface text-tm-black", dot: CHART_COLORS.muted },
};

export const FILE_KIND: Record<PreHarvestDeal["status"], { en: string; es: string }> = {
  closed: { en: "Closed campaign", es: "Campaña cerrada" },
  application: { en: "Application", es: "Solicitud" },
  live: { en: "Live campaign", es: "Campaña en curso" },
};

