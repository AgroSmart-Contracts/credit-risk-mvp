/**
 * Shared state of the BCP workspace (not components): the language context and
 * translation hook, and the words for states and provenance.
 */
import { createContext, useContext } from "react";
import { L, tx } from "../../lib/bcp/calc";
import type { ConditionState, Lang, Provenance, Tx } from "../../lib/bcp/types";

export const LangContext = createContext<Lang>("es");
export const useLang = () => useContext(LangContext);
/** Translate a pair in the current language. */
export function useT() {
  const lang = useLang();
  return (t: Tx | string, en?: string) => (typeof t === "string" ? (lang === "es" ? t : (en ?? t)) : tx(t, lang));
}

export const STATE_TEXT: Record<ConditionState | "neutral", Tx> = {
  verde: L("Riesgo bajo", "Low risk"),
  ambar: L("Riesgo medio", "Medium risk"),
  naranja: L("Riesgo elevado", "Elevated risk"),
  rojo: L("Riesgo alto", "High risk"),
  veto: L("Veto", "Veto"),
  observacion: L("En observación", "Under watch"),
  neutral: L("Neutral", "Neutral"),
};
export const STATE_SOLID: Record<ConditionState, string> = {
  verde: "#0f9d6b",
  ambar: "#d9a93b",
  naranja: "#e0702a",
  rojo: "#d63a4d",
  veto: "#d63a4d",
  observacion: "#c3ccd5",
};

export const PROV_TEXT: Record<Provenance, Tx> = {
  doc_verificado: L("Doc. verificado", "Verified doc."),
  declarado: L("Declarado", "Declared"),
  satelital: L("Satelital", "Satellite"),
  estimado: L("Estimado", "Estimated"),
};


/** A row's source. The portfolio is disclosed as illustrative once, in the top bar and on printed documents. */
export const sourceTx = (row: { source: Tx; real?: boolean }): Tx => row.source;

/** Opens the evidence drawer for a loan's condition row (Spanish label). */
export const EvidenceContext = createContext<(loanId: string, condition: string) => void>(() => {});
export const useEvidence = () => useContext(EvidenceContext);

/** Short confirmation after the bank acts (conformity, approval, request). */
export const ToastContext = createContext<(text: string) => void>(() => {});
export const useToast = () => useContext(ToastContext);
