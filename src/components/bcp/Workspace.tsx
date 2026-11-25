/**
 * BCP pre-harvest workspace content (spec 2026-11-19): the bank-facing view of
 * TruMarket's pre-harvest loans. The app shell owns the persistent sidebar and
 * the navigation state; this renders the page for the current view. Heavy pages
 * (charts, map, A4 reports) load on demand.
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Printer } from "lucide-react";
import { TopBar } from "../Sidebar";
import { PORTFOLIO, applicationById, loanById } from "../../data/bcp/dataset";
import { bySeverity, cov, date, pendingDecisions, usd } from "../../lib/bcp/calc";
import type { Lang } from "../../lib/bcp/types";
import { appKey, decisionKey, type Answer } from "./answers";
import { ApplicationFile, ApplicationsPage, ApplicationsTable } from "./Applications";
import { DecisionBlock } from "./Decision";
import { BANK_EDITION } from "./edition";
import { NAV_ACTIVE, bcpNavItems, bcpUrl, type BcpView as View } from "./nav";
import { loadLoanFile, loadMap, loadReports } from "./pages";
import { LoansTable, Portfolio } from "./Portfolio";
import { Btn, Card, Chip, ExampleChip, Lbl, SectionTitle, StateChip } from "./ui";
import { EvidenceContext, LangContext, ToastContext, useT } from "./shared";

// Recharts and Leaflet are only needed on these pages.
const LoanFile = lazy(() => loadLoanFile().then((m) => ({ default: m.LoanFile })));
const MapView = lazy(() => loadMap().then((m) => ({ default: m.MapView })));
const MonthlyReport = lazy(() => loadReports().then((m) => ({ default: m.MonthlyReport })));
const ExceptionNoticeReport = lazy(() => loadReports().then((m) => ({ default: m.ExceptionNoticeReport })));
const CreditMemo = lazy(() => loadReports().then((m) => ({ default: m.CreditMemo })));
const AssessmentMemo = lazy(() => loadReports().then((m) => ({ default: m.AssessmentMemo })));
const EvidenceDrawer = lazy(() => import("./EvidenceDrawer").then((m) => ({ default: m.EvidenceDrawer })));

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-[1200px] space-y-4" aria-busy="true">
      <div className="h-10 w-1/3 rounded-lg bg-bcp-fill" />
      <div className="h-40 rounded-xl bg-bcp-fill/70" />
      <div className="h-64 rounded-xl bg-bcp-fill/50" />
    </div>
  );
}

export interface BcpWorkspaceProps {
  view: View;
  id: string | null;
  go: (v: View, id?: string | null) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  answers: Record<string, Answer>;
  setAnswer: (k: string, a: Answer) => void;
  onExit: () => void;
}

export function BcpWorkspace({ view, id, go, lang, setLang, answers, setAnswer, onExit }: BcpWorkspaceProps) {
  // Evidence opens in a drawer over any page; actions confirm with a short toast.
  const [evidence, setEvidence] = useState<{ loanId: string; condition: string } | null>(null);
  const openEvidence = useCallback((loanId: string, condition: string) => setEvidence({ loanId, condition }), []);
  const closeEvidence = useCallback(() => setEvidence(null), []);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const showToast = useCallback((text: string) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  useEffect(() => {
    setEvidence(null);
  }, [view, id]);
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem("bcp-lang", lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  // Keep the URL shareable (the shell pushes a history entry per page; this only keeps the language in sync).
  useEffect(() => {
    const url = bcpUrl(view, id, lang);
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(window.history.state, "", url);
  }, [view, id, lang]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view, id]);

  return (
    <LangContext.Provider value={lang}>
      <EvidenceContext.Provider value={openEvidence}>
      <ToastContext.Provider value={showToast}>
      <Frame view={view} go={go} lang={lang} setLang={setLang} answers={answers} onExit={onExit}>
        <Suspense fallback={<PageSkeleton />}>
          {view === "cartera" && <Portfolio data={PORTFOLIO} onOpen={(x) => go("expediente", x)} onOpenApp={(x) => go("solicitud", x)} onReport={() => go("reporte")} onDecisions={() => go("decision")} answers={answers} onAnswer={setAnswer} />}
          {view === "expediente" && (() => {
            const loan = id ? loanById(id) : null;
            return loan ? <LoanFile key={loan.id} loan={loan} data={PORTFOLIO} onBack={() => go("cartera")} onMap={() => go("mapa", loan.id)} onMemo={() => go("memo", loan.id)} answers={answers} onAnswer={setAnswer} /> : <Files go={go} />;
          })()}
          {view === "expedientes" && <Files go={go} />}
          {view === "solicitudes" && <ApplicationsPage data={PORTFOLIO} onOpen={(x) => go("solicitud", x)} answers={answers} />}
          {view === "solicitud" && (() => {
            const app = id ? applicationById(id) : null;
            return app ? (
              <ApplicationFile key={app.id} app={app} data={PORTFOLIO} onBack={() => go("solicitudes")} onMap={() => go("mapa", app.id)} onMemo={() => go("evaluacion", app.id)} answer={answers[appKey(app)]} onAnswer={(a) => setAnswer(appKey(app), a)} />
            ) : (
              <ApplicationsPage data={PORTFOLIO} onOpen={(x) => go("solicitud", x)} answers={answers} />
            );
          })()}
          {view === "decision" && <Decisions go={go} answers={answers} onAnswer={setAnswer} />}
          {view === "excepciones" && <Exceptions go={go} />}
          {view === "reportes" && <Reports go={go} />}
          {view === "reporte" && (
            <ReportFrame onBack={() => go("cartera")}>
              <MonthlyReport data={PORTFOLIO} />
            </ReportFrame>
          )}
          {view === "memo" && (() => {
            const loan = id ? loanById(id) : null;
            return loan ? (
              <ReportFrame onBack={() => go("expediente", loan.id)} docTitle={lang === "es" ? `Memorando de crédito ${loan.id}` : `Credit memo ${loan.id}`}>
                <CreditMemo data={PORTFOLIO} loan={loan} />
              </ReportFrame>
            ) : <Files go={go} />;
          })()}
          {view === "evaluacion" && (() => {
            const app = id ? applicationById(id) : null;
            return app ? (
              <ReportFrame onBack={() => go("solicitud", app.id)} docTitle={lang === "es" ? `Memorando de evaluación ${app.id}` : `Assessment memo ${app.id}`}>
                <AssessmentMemo data={PORTFOLIO} app={app} />
              </ReportFrame>
            ) : <ApplicationsPage data={PORTFOLIO} onOpen={(x) => go("solicitud", x)} answers={answers} />;
          })()}
          {view === "excepcion" && (() => {
            const notice = PORTFOLIO.exceptions.find((e) => e.loanId === id) ?? PORTFOLIO.exceptions[0];
            return (
              <ReportFrame onBack={() => go("excepciones")}>
                <ExceptionNoticeReport data={PORTFOLIO} notice={notice} />
              </ReportFrame>
            );
          })()}
          {!BANK_EDITION && view === "mapa" && <MapView data={PORTFOLIO} focus={id} onOpen={(x) => go(PORTFOLIO.applications.some((a) => a.id === x) ? "solicitud" : "expediente", x)} />}
          {import.meta.env.VITE_BANK_EDITION !== "1" && view === "metodo" && <Method />}
        </Suspense>
      </Frame>
      {evidence && (
        <Suspense fallback={null}>
          <EvidenceDrawer loanId={evidence.loanId} condition={evidence.condition} onClose={closeEvidence} />
        </Suspense>
      )}
      {toast && (
        <div role="status" className="bcp fixed bottom-6 left-1/2 z-[1300] -translate-x-1/2 rounded-lg bg-bcp-ink px-4 py-3 text-sm font-semibold text-white shadow-lg print:hidden">
          {toast}
        </div>
      )}
      </ToastContext.Provider>
      </EvidenceContext.Provider>
    </LangContext.Provider>
  );
}

/** Top bar, phone navigation and page area. The desktop sidebar lives in the app shell. */
function Frame({ view, go, lang, setLang, answers, onExit, children }: { view: View; go: (v: View, id?: string | null) => void; lang: Lang; setLang: (l: Lang) => void; answers: Record<string, Answer>; onExit: () => void; children: React.ReactNode }) {
  const t = useT();
  const items = bcpNavItems(lang, answers);
  const titles: Record<View, string> = {
    cartera: t("Cartera", "Portfolio"),
    expedientes: t("Expedientes de crédito", "Credit files"),
    expediente: t("Expediente", "File"),
    solicitudes: t("Solicitudes", "Applications"),
    solicitud: t("Solicitud", "Application"),
    decision: t("Decisiones pendientes", "Pending decisions"),
    excepciones: t("Excepciones", "Exceptions"),
    excepcion: t("Aviso de excepción", "Exception notice"),
    reportes: t("Reportes mensuales", "Monthly reports"),
    reporte: t("Reporte mensual", "Monthly report"),
    memo: t("Memorando de crédito", "Credit memo"),
    evaluacion: t("Memorando de evaluación", "Assessment memo"),
    mapa: t("Mapa de predios", "Parcel map"),
    metodo: t("Metodología y umbrales", "Methodology and thresholds"),
  };
  const langToggle = (
    <div className="inline-flex overflow-hidden rounded-md border border-bcp-border text-xs font-semibold" role="group" aria-label="Idioma / Language">
      {(["es", "en"] as const).map((l) => (
        <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} className={`min-h-[32px] px-2.5 ${lang === l ? "bg-bcp-ink text-white" : "bg-white text-bcp-ink"}`}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
  return (
    <div className="bcp min-w-0 flex-1 bg-bcp-bg print:bg-white">
      <TopBar title={titles[view]} sub={`${t(`TruMarket · Precosecha · datos al ${date(PORTFOLIO.cutoff, "es")}`, `TruMarket · Pre-harvest · data as of ${date(PORTFOLIO.cutoff, "en")}`)}${BANK_EDITION ? ` · ${t("cartera ilustrativa", "illustrative portfolio")}` : ""}`} right={langToggle} />
      {/* Phones: the sidebar becomes a row of tabs. */}
      <nav className="flex gap-1 overflow-x-auto border-b border-bcp-border bg-white px-3 [scrollbar-width:none] lg:hidden print:hidden">
        {items.map((it) => (
          <button key={it.id} type="button" onClick={() => go(it.id as View)} className={`min-h-[44px] shrink-0 border-b-2 px-2.5 text-sm font-medium ${NAV_ACTIVE[view] === it.id ? "border-bcp-green-text text-bcp-ink" : "border-transparent text-bcp-muted"}`}>
            {it.label}
            {it.count ? <span className="ml-1 text-bcp-muted">{it.count}</span> : null}
          </button>
        ))}
        {!BANK_EDITION && (
          <button type="button" onClick={onExit} className="min-h-[44px] shrink-0 px-2.5 text-sm font-medium text-bcp-muted">
          {t("Interno TruMarket", "TruMarket internal")} →
        </button>
        )}
      </nav>
      <main className="px-4 py-6 sm:px-8 lg:px-10 print:p-0">{children}</main>
    </div>
  );
}

function Files({ go }: { go: (v: View, id?: string | null) => void }) {
  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <ExampleChip kind="portfolio" />
      <Card>
        <LoansTable data={{ ...PORTFOLIO, loans: [...PORTFOLIO.loans].sort(bySeverity) }} onOpen={(x) => go("expediente", x)} />
      </Card>
    </div>
  );
}

function Decisions({ go, answers, onAnswer }: { go: (v: View, id?: string | null) => void; answers: Record<string, Answer>; onAnswer: (k: string, a: Answer) => void }) {
  const t = useT();
  const lang = t("es", "en") as Lang;
  const all = pendingDecisions(PORTFOLIO.loans, PORTFOLIO.cutoff);
  // Status of each upcoming milestone, in words: is the bank needed, and when.
  const status = (u: (typeof PORTFOLIO.upcoming)[number]) => {
    const loan = loanById(u.loanId);
    if (all.some((p) => p.loan.id === u.loanId && /conformidad/i.test(u.milestone.es))) return <Chip tone="ink">{t("Pendiente de conformidad del banco", "Awaiting bank sign-off")}</Chip>;
    if (loan && loan.frozenUsd > 0) return <StateChip state="naranja" suffix={` · ${t("plan en curso", "plan in progress")}`} />;
    if (/aforo/i.test(u.milestone.es)) return <Chip tone="ambar">{t("Se habilita tras el aforo", "Opens after the estimate")}</Chip>;
    return <Chip>{t("Previsto", "Planned")}</Chip>;
  };
  return (
    <div className="mx-auto max-w-[1100px] space-y-4">
      {all.length === 0 && PORTFOLIO.applications.length === 0 && <p className="text-sm text-bcp-muted">{t("Nada pendiente.", "Nothing pending.")}</p>}
      {all.map((p) => (
        <DecisionBlock key={decisionKey(p.loan, p.decision)} loan={p.loan} decision={p.decision} cutoff={PORTFOLIO.cutoff} answer={answers[decisionKey(p.loan, p.decision)]} onAnswer={(a) => onAnswer(decisionKey(p.loan, p.decision), a)} onOpen={() => go("expediente", p.loan.id)} />
      ))}

      <SectionTitle title={t("Próximos 30 días", "Next 30 days")} />
      <Card>
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-bcp-border text-left">
                {[t("Fecha", "Date"), t("Préstamo", "Loan"), t("Hito", "Milestone"), t("Monto en juego", "Amount at stake"), t("Estado", "Status")].map((h, i) => (
                  <Lbl key={h} as="th" className={`py-2 pr-3 font-normal ${i === 3 ? "text-right" : ""}`}>
                    {h}
                  </Lbl>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-bcp-divider">
              {PORTFOLIO.upcoming.map((u, i) => (
                <tr key={i} className="align-top">
                  <td className="whitespace-nowrap py-2.5 pr-3">{date(u.date, lang, false)}</td>
                  <td className="py-2.5 pr-3">
                    <button type="button" onClick={() => go("expediente", u.loanId)} className="font-semibold hover:underline">
                      {u.loanId}
                    </button>
                  </td>
                  <td className="py-2.5 pr-3">{t(u.milestone)}</td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right font-semibold">{usd(u.amountUsd)}</td>
                  <td className="py-2.5 pr-3">{status(u)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {PORTFOLIO.applications.length > 0 && (
        <>
          <SectionTitle title={t("Solicitudes por aprobar o rechazar", "Applications to approve or decline")} />
          <Card>
            <ApplicationsTable apps={PORTFOLIO.applications} onOpen={(x) => go("solicitud", x)} answers={answers} />
          </Card>
        </>
      )}
    </div>
  );
}

function Exceptions({ go }: { go: (v: View, id?: string | null) => void }) {
  const t = useT();
  return (
    <div className="mx-auto max-w-[1000px] space-y-4">
      {PORTFOLIO.exceptions.map((e) => {
        const l = loanById(e.loanId)!;
        return (
          <Card key={e.loanId}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StateChip state={e.state} />
                  <span className="font-semibold">
                    {l.id} · {t(l.zone)}
                  </span>
                  <span className="lbl">{t(`desde ${date(e.since, "es")}`, `since ${date(e.since, "en")}`)}</span>
                </div>
                <p className="mt-2 max-w-3xl text-sm">{t(e.oneLine)}</p>
                <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <div><dt className="lbl inline">{t("Exposición", "Exposure")} </dt><dd className="num inline font-semibold">{usd(l.disbursedUsd)}</dd></div>
                  <div><dt className="lbl inline">{t("Congelado", "Frozen")} </dt><dd className="num inline font-semibold">{usd(l.frozenUsd)}</dd></div>
                  <div><dt className="lbl inline">{t("Cobertura", "Coverage")} </dt><dd className="num inline font-semibold">{cov(l.coverageToday)}</dd></div>
                  <div><dt className="lbl inline">Plan </dt><dd className="inline font-semibold">{t(e.plan)}</dd></div>
                </dl>
              </div>
              <div className="flex flex-wrap gap-2">
                <Btn onClick={() => go("excepcion", e.loanId)}>{t("Ver aviso (PDF)", "View notice (PDF)")}</Btn>
                <Btn onClick={() => go("expediente", e.loanId)}>{t("Abrir expediente", "Open file")}</Btn>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function Reports({ go }: { go: (v: View, id?: string | null) => void }) {
  const t = useT();
  return (
    <div className="mx-auto max-w-[1000px] space-y-4">
      <SectionTitle title={t("Reportes mensuales", "Monthly reports")} sub={t("Para el comité de crédito y la SBS · A4", "For the credit committee and the SBS · A4")} />
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{t("Noviembre 2026", "November 2026")}</p>
            <p className="lbl">{t(`corte ${date(PORTFOLIO.cutoff, "es")} · 2 páginas · datos ilustrativos`, `cut-off ${date(PORTFOLIO.cutoff, "en")} · 2 pages · illustrative data`)}</p>
          </div>
          <Btn primary onClick={() => go("reporte")}>{t("Ver y descargar (PDF)", "View and download (PDF)")}</Btn>
        </div>
      </Card>
    </div>
  );
}

function ReportFrame({ onBack, docTitle, children }: { onBack: () => void; docTitle?: string; children: React.ReactNode }) {
  const t = useT();
  // The browser names the saved PDF after the document title.
  useEffect(() => {
    if (!docTitle) return;
    const prev = document.title;
    document.title = docTitle;
    return () => {
      document.title = prev;
    };
  }, [docTitle]);
  return (
    <div>
      <div className="mx-auto mb-4 flex max-w-[794px] flex-wrap items-center justify-between gap-2 print:hidden">
        <button type="button" onClick={onBack} className="min-h-[44px] text-sm font-semibold hover:underline">
          ← {t("Volver", "Back")}
        </button>
        <Btn primary onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> {t("Imprimir o guardar PDF", "Print or save PDF")}
        </Btn>
      </div>
      {/* Fixed A4 pages scroll sideways on narrow screens, never reflow. */}
      <div className="overflow-x-auto pb-4 print:overflow-visible print:pb-0">{children}</div>
    </div>
  );
}

const THRESHOLDS: Array<[string, string, string, string, string]> = [
  ["Cobertura de repago|Repayment coverage", "< 1.50x", "< 1.30x (rojo < 1.10x)|< 1.30x (red < 1.10x)", "Propuesto, a aprobar con BCP Riesgos|Proposed, to approve with BCP Risk", ""],
  ["Vigor del cultivo vs línea base del lote|Crop vigour vs lot baseline", "-15%", "-30%", "Respuesta Q18 al BCP|Answer Q18 to BCP", ""],
  ["Facturas vs presupuesto de la fase|Invoices vs phase budget", "brecha 15%|15% gap", "brecha 30% o faltantes|30% gap or missing", "Q18", ""],
  ["Labores fuera de ventana|Field work outside window", "> 2 semanas|> 2 weeks", "> 4 semanas|> 4 weeks", "Q18", ""],
  ["Cuajado vs esperado|Fruit set vs expected", "", "< 80%", "Q18", ""],
  ["Aforo bajo el volumen prevendido|Field estimate below pre-sold volume", "", "naranja, T2 no se libera|orange, T2 not released", "Q18", ""],
  ["Aforo del productor > el de TM en 15%|Grower's estimate > TM's by 15%", "", "se usa el menor|the lower is used", "Q18", ""],
  ["Deuda nueva > 20% de la línea o atraso > 30 días|New debt > 20% of the line or arrears > 30 days", "ámbar|amber", "", "Q18", ""],
  ["Dos ámbar consecutivos|Two consecutive amber", "", "naranja|orange", "Q18", ""],
  ["Pago fuera de la cuenta de recaudo|Payment outside the collection account", "", "", "Q26", "rojo|red"],
];

function Method() {
  const t = useT();
  const pick = (s: string) => (s.includes("|") ? t(s.split("|")[0], s.split("|")[1]) : s);
  return (
    <div className="mx-auto max-w-[1000px] space-y-4">
      <SectionTitle title={t("Metodología y umbrales", "Methodology and thresholds")} sub={t(`Motor de reglas determinista y versionado · ${PORTFOLIO.engineVersion}`, `Deterministic, versioned rules engine · ${PORTFOLIO.engineVersion}`)} />
      <Card>
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-bcp-border text-left">
                {[t("Señal", "Signal"), t("Ámbar", "Amber"), t("Naranja", "Orange"), t("Rojo", "Red"), t("Fuente", "Source")].map((h) => (
                  <Lbl key={h} as="th" className="py-2 pr-3 font-normal">
                    {h}
                  </Lbl>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-bcp-divider">
              {THRESHOLDS.map(([sig, amb, nar, src, red]) => (
                <tr key={sig}>
                  <td className="py-2 pr-3 font-semibold">{pick(sig)}</td>
                  <td className="py-2 pr-3">{amb ? pick(amb) : ""}</td>
                  <td className="py-2 pr-3">{nar ? pick(nar) : ""}</td>
                  <td className="py-2 pr-3">{red ? pick(red) : ""}</td>
                  <td className="py-2 pr-3 text-bcp-muted">{pick(src)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <h3 className="text-[16px] font-bold">{t("Efectos", "Effects")}</h3>
        <ul className="mt-2 space-y-2 text-sm">
          <li className="flex gap-2"><StateChip state="ambar" /> <span>{t("Seguimiento reforzado y evidencia adicional.", "Reinforced follow-up and extra evidence.")}</span></li>
          <li className="flex gap-2"><StateChip state="naranja" /> <span>{t("El siguiente tramo se congela automáticamente y se reporta el mismo día; investigación obligatoria, plan de remediación con plazo y ajuste de estructura.", "The next tranche is frozen automatically and reported the same day; mandatory investigation, remediation plan with a deadline and structure adjustment.")}</span></li>
          <li className="flex gap-2"><StateChip state="rojo" /> <span>{t("Financiamiento detenido y cascada de recuperación; decide el banco con la recomendación escrita de TruMarket.", "Financing stopped and recovery cascade; the bank decides on TruMarket's written recommendation.")}</span></li>
          <li className="flex gap-2"><StateChip state="observacion" /> <span>{t("Alertas tempranas de TruMarket (clima, El Niño, temperatura): no cambian el estado por sí solas; producen un rango estimado de impacto hasta confirmarse en campo.", "TruMarket early warnings (weather, El Niño, temperature): they never change the state on their own; they produce an estimated impact range until confirmed in the field.")}</span></li>
        </ul>
        <p className="lbl mt-3">{t("La exposición hoy es lo desembolsado; el máximo es la línea completa más el costo estimado. Umbrales propuestos, pendientes de aprobación con BCP Riesgos.", "Exposure today is what was disbursed; at most, the full line plus the estimated cost. Proposed thresholds, pending approval with BCP Risk.")}</p>
      </Card>
    </div>
  );
}
