/** Bank answers to pending conformities, kept per analyst in this browser. */
import { useEffect, useId, useState } from "react";
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

/** The analyst's reason for a decision: asked for when a button is pressed without one. */
export function useReason() {
  const [note, setNoteState] = useState("");
  const [missing, setMissing] = useState(false);
  const id = useId();
  const setNote = (v: string) => {
    setNoteState(v);
    if (v.trim()) setMissing(false);
  };
  /** True when there is a reason; otherwise flags the field and puts the cursor in it. */
  const ok = () => {
    if (note.trim()) return true;
    setMissing(true);
    document.getElementById(id)?.focus();
    return false;
  };
  return { note: note.trim(), raw: note, setNote, missing, id, ok };
}

export type Reason = ReturnType<typeof useReason>;
