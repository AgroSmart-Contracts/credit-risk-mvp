/**
 * Analyst decisions on a file (approve / hold / request inspection), kept as an
 * audit trail: who decided what, on which amount, when and why.
 * Stored in this browser until the bank's back office is connected.
 */
export type DecisionKind = "approve" | "hold" | "inspect" | "decline";

export interface DecisionEntry {
  at: string;
  kind: DecisionKind;
  subject: string;
  amountUsd: number | null;
  analyst: string;
  note: string;
}

const key = (dealId: string) => `tm-pre-harvest-decisions-${dealId}`;

export function loadDecisions(dealId: string): DecisionEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key(dealId)) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveDecision(dealId: string, entry: DecisionEntry): DecisionEntry[] {
  const next = [...loadDecisions(dealId), entry];
  try {
    localStorage.setItem(key(dealId), JSON.stringify(next));
  } catch {
    /* storage unavailable: kept for this session only */
  }
  return next;
}

export const DECISION_TEXT: Record<DecisionKind, { en: string; es: string }> = {
  approve: { en: "Approved", es: "Aprobado" },
  hold: { en: "Held", es: "Retenido" },
  inspect: { en: "Inspection requested", es: "Inspección solicitada" },
  decline: { en: "Declined", es: "Rechazado" },
};
