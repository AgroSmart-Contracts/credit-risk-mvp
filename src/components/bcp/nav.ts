/**
 * BCP workspace navigation, shared by the app shell (persistent sidebar) and the
 * workspace content: the views, which sidebar item each one lights up, the
 * sidebar items, and reading the initial state from the URL.
 */
import { AlertTriangle, FilePlus2, Folder, Gavel, LayoutDashboard, Map as MapIcon } from "lucide-react";
import type { SidebarItem } from "../Sidebar";
import { PORTFOLIO } from "../../data/bcp/dataset";
import { pendingDecisions } from "../../lib/bcp/calc";
import type { Lang } from "../../lib/bcp/types";
import { appKey, decisionKey, type Answer } from "./answers";

export type BcpView = "cartera" | "expedientes" | "expediente" | "solicitudes" | "solicitud" | "decision" | "excepciones" | "excepcion" | "reportes" | "reporte" | "mapa" | "metodo";

export const BCP_VIEWS: BcpView[] = ["cartera", "expedientes", "expediente", "solicitudes", "solicitud", "decision", "excepciones", "excepcion", "reportes", "reporte", "mapa", "metodo"];

/** The sidebar item each view belongs to. */
export const NAV_ACTIVE: Record<BcpView, string> = {
  cartera: "cartera",
  expedientes: "expedientes",
  expediente: "expedientes",
  solicitudes: "solicitudes",
  solicitud: "solicitudes",
  decision: "decision",
  excepciones: "excepciones",
  excepcion: "excepciones",
  reportes: "reportes",
  reporte: "reportes",
  mapa: "mapa",
  metodo: "metodo",
};

const param = (k: string) => {
  try {
    return new URLSearchParams(window.location.search).get(k);
  } catch {
    return null;
  }
};

export function readBcpUrl(): { view: BcpView; id: string | null } {
  const v = param("v") as BcpView | null;
  return { view: v && BCP_VIEWS.includes(v) ? v : "cartera", id: param("id") };
}

export function readLang(): Lang {
  const q = param("lang");
  if (q === "en" || q === "es") return q;
  try {
    const s = localStorage.getItem("bcp-lang");
    if (s === "en" || s === "es") return s;
  } catch {
    /* storage unavailable */
  }
  return "es";
}

/** Decisions still open for the bank: conformities due now and applications. */
export const pendingCount = (answers: Record<string, Answer>) =>
  pendingDecisions(PORTFOLIO.loans, PORTFOLIO.cutoff).filter((p) => !answers[decisionKey(p.loan, p.decision)]).length +
  PORTFOLIO.applications.filter((a) => !answers[appKey(a)]).length;

export function bcpNavItems(lang: Lang, answers: Record<string, Answer>): SidebarItem[] {
  const t = (es: string, en: string) => (lang === "es" ? es : en);
  return [
    { id: "cartera", label: t("Cartera", "Portfolio"), icon: LayoutDashboard },
    { id: "expedientes", label: t("Expedientes", "Credit files"), icon: Folder, count: PORTFOLIO.loans.length },
    { id: "solicitudes", label: t("Solicitudes", "Applications"), icon: FilePlus2, count: PORTFOLIO.applications.length },
    { id: "decision", label: t("Decisiones pendientes", "Pending decisions"), icon: Gavel, count: pendingCount(answers), tone: "high" },
    { id: "excepciones", label: t("Excepciones", "Exceptions"), icon: AlertTriangle, count: PORTFOLIO.exceptions.length, tone: "watch" },
    // Monthly reports and Methodology are hidden from the menu; their pages stay reachable
    // (the portfolio's "Download monthly report" button, direct links).
    { id: "mapa", label: t("Mapa de predios", "Parcel map"), icon: MapIcon },
  ];
}

/** The shareable URL of a BCP page: ?v=<view>&id=<file>&lang=en on the #pre-harvest hash. */
export function bcpUrl(view: BcpView, id: string | null, lang: Lang): string {
  const q = new URLSearchParams();
  if (view !== "cartera") q.set("v", view);
  if (id) q.set("id", id);
  if (lang === "en") q.set("lang", "en");
  const s = q.toString();
  return `${window.location.pathname}${s ? `?${s}` : ""}#pre-harvest`;
}
