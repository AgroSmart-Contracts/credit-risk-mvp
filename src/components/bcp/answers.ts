/** Bank answers to pending conformities, kept per analyst in this browser. */
import { useEffect, useState } from "react";
import type { Application, Decision, Loan } from "../../lib/bcp/types";

/** A bank answer, with the analyst's written reason (required for the audit trail). */
export type Answer = { kind: "conformidad" | "conformidad_condicion" | "info" | "aprobar" | "rechazar"; at: string; note?: string };
const KEY = "bcp-decisions";

/** Bank answers kept in this browser (per analyst); the audit trail of record is TruMarket's. */
export function useAnswers(): [Record<string, Answer>, (k: string, a: Answer) => void] {
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? "{}");
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(answers));
    } catch {
      /* storage unavailable: answers last for this session */
    }
  }, [answers]);
  return [answers, (k, a) => setAnswers((s) => ({ ...s, [k]: a }))];
}

export const decisionKey = (loan: Loan, d: Decision) => `${loan.id}:${d.date}`;


export const appKey = (a: Application) => `app:${a.id}`;
