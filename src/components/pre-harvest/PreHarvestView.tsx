import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, History } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { allFiles, FINDINGS, loadRegistered, saveRegistered, simulateFile } from "../../data/pre-harvest/files";
import { buildRow } from "./portfolio";
import { BankShell, type Page } from "./BankShell";
import { Dashboard } from "./Dashboard";
import { AlertsPage, DecisionsPage, MethodPage } from "./WorkPages";
import { DATA_UNTIL, monitoringDataFor } from "../../data/pre-harvest";
import { sentinelComposites, yieldAdjustment } from "../../lib/pre-harvest/monitoring";
import { rescore, type CampaignSimulation } from "../../lib/pre-harvest/timeline";
import { loadDecisions, type DecisionEntry } from "../../lib/pre-harvest/decisions";
import { formatDate, formatUsd, t, tb } from "../../lib/pre-harvest/i18n";
import type { Bilingual, ClimateFixture, Formato, Lang, MonitoringData, PreHarvestDeal } from "../../lib/pre-harvest/types";
import { ScorePanel } from "./ScorePanel";
import { AlertLog } from "./AlertLog";
import { InputsPanel } from "./InputsPanel";
import { SummaryPanel, StressPanel } from "./CreditPanels";
import { DisbursementPanel } from "./DisbursementPanel";
import { Inbox } from "./Inbox";
import { ReplayBar } from "./ReplayBar";
import { ResearchTimeline } from "./ResearchTimeline";
import { DecisionCard, DecisionLog, FileHeader } from "./FileOverview";
import { MoneyOverview } from "./MoneyOverview";
import { UpdateToasts, UpdatesFeed } from "./TruMarketUpdates";
import { RiskDetails } from "./RiskDetails";
import { useLiveChecks } from "./live";

const LANG_KEY = "tm-pre-harvest-lang";
// The application flow (PDF reader, UTM conversion) loads only when it is opened.
const NewApplication = lazy(() => import("./NewApplication").then((m) => ({ default: m.NewApplication })));

const TABS = ["summary", "monitoring", "analysis", "investigation", "disbursements", "application"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, Bilingual> = {
  summary: { en: "Summary", es: "Resumen" },
  analysis: { en: "Credit analysis", es: "Análisis de crédito" },
  monitoring: { en: "Risk details", es: "Detalle del riesgo" },
  investigation: { en: "What happened", es: "Qué pasó" },
  disbursements: { en: "Disbursements & audit", es: "Desembolsos y auditoría" },
  application: { en: "Application file", es: "Expediente" },
};

function urlParam(name: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

function setUrl(params: Record<string, string | null>) {
  try {
    const p = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(params)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    const q = p.toString();
    const url = `${window.location.pathname}${q ? `?${q}` : ""}${window.location.hash}`;
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(null, "", url);
  } catch {
    /* history unavailable */
  }
}

function readLang(): Lang {
  const fromUrl = urlParam("lang");
  if (fromUrl === "es" || fromUrl === "en") return fromUrl;
  try {
    // Spanish by default: the audience is a Peruvian bank.
    return localStorage.getItem(LANG_KEY) === "en" ? "en" : "es";
  } catch {
    return "es";
  }
}

type Route = { view: Page } | { view: "file"; id: string };
const PAGES: Page[] = ["dashboard", "inbox", "decisions", "alerts", "method", "new"];

export function PreHarvestView({ onOpenPostHarvest, onExitWorkspace }: { onOpenPostHarvest: () => void; onExitWorkspace: () => void }) {
  const [registered, setRegistered] = useState<PreHarvestDeal[]>(loadRegistered);
  const files = useMemo(() => allFiles(registered), [registered]);
  const rows = useMemo(() => files.map(buildRow), [files]);
  const [lang, setLangState] = useState<Lang>(readLang);
  const [route, setRoute] = useState<Route>(() => {
    const d = urlParam("deal");
    if (urlParam("new")) return { view: "new" };
    if (d && allFiles(loadRegistered()).some((x) => x.id === d)) return { view: "file", id: d };
    const p = urlParam("page") as Page | null;
    return { view: p && PAGES.includes(p) ? p : "dashboard" };
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* storage unavailable */
    }
  };

  useEffect(() => {
    const prev = document.documentElement.lang;
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = prev;
    };
  }, [lang]);

  useEffect(() => {
    setUrl({
      lang,
      deal: route.view === "file" ? route.id : null,
      new: route.view === "new" ? "1" : null,
      page: route.view !== "file" && route.view !== "new" && route.view !== "dashboard" ? route.view : null,
      tab: route.view === "file" ? urlParam("tab") : null,
      week: route.view === "file" ? urlParam("week") : null,
    });
    window.scrollTo({ top: 0 });
  }, [route, lang]);

  const deal = route.view === "file" ? files.find((d) => d.id === route.id) : undefined;
  const openFile = (id: string, tab?: string) => {
    if (tab) setUrl({ tab });
    setRoute({ view: "file", id });
  };
  const dataAsOf = rows.filter((r) => r.deal.status === "live").map((r) => r.frame.date).sort().at(-1) ?? DATA_UNTIL;

  return (
    <div lang={lang}>
      <BankShell
        page={deal ? null : (route.view as Page)}
        fileName={deal ? tb(deal.name, lang).split(" · ")[0] : undefined}
        rows={rows}
        dataAsOf={dataAsOf}
        lang={lang}
        onLang={setLang}
        onPage={(p) => setRoute({ view: p })}
        onOpenFile={(id) => openFile(id)}
        onExitWorkspace={onExitWorkspace}
      >
        {route.view === "new" ? (
          <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-tm-border/40" aria-busy="true" />}>
            <NewApplication
              lang={lang}
              onLang={setLang}
              onCancel={() => setRoute({ view: "inbox" })}
              onRegister={(d) => {
                const next = [d, ...registered.filter((r) => r.id !== d.id)];
                setRegistered(next);
                saveRegistered(next);
                setRoute({ view: "file", id: d.id });
              }}
            />
          </Suspense>
        ) : deal ? (
          <FileWorkspace key={deal.id} deal={deal} lang={lang} onBack={() => setRoute({ view: "inbox" })} onOpenPostHarvest={onOpenPostHarvest} />
        ) : route.view === "inbox" ? (
          <Inbox rows={rows} lang={lang} onOpen={(id) => openFile(id)} onNew={() => setRoute({ view: "new" })} />
        ) : route.view === "decisions" ? (
          <DecisionsPage rows={rows} lang={lang} onOpen={(id) => openFile(id)} />
        ) : route.view === "alerts" ? (
          <AlertsPage rows={rows} lang={lang} onOpen={openFile} />
        ) : route.view === "method" ? (
          <MethodPage lang={lang} dataAsOf={dataAsOf} />
        ) : (
          <Dashboard rows={rows} dataAsOf={dataAsOf} lang={lang} onOpen={openFile} onDecisions={() => setRoute({ view: "decisions" })} onAlerts={() => setRoute({ view: "alerts" })} />
        )}
      </BankShell>
    </div>
  );
}

function PrintSection({ title, children, hidden = false }: { title: string; children: ReactNode; hidden?: boolean }) {
  return (
    <section className={`break-inside-avoid-page ${hidden ? "hidden" : ""}`}>
      <h3 className="mb-3 hidden font-display text-xl text-tm-black print:block">{title}</h3>
      {children}
    </section>
  );
}

function FileWorkspace({
  deal: base,
  lang,
  onBack,
  onOpenPostHarvest,
}: {
  deal: PreHarvestDeal;
  lang: Lang;
  onBack: () => void;
  onOpenPostHarvest: () => void;
}) {
  const reduce = useReducedMotion();
  const [tab, setTabState] = useState<Tab>(() => {
    const raw = urlParam("tab");
    // Old links keep working: "risk" and "monitoring" both open Risk details.
    const t0 = raw === "risk" ? "monitoring" : raw;
    return TABS.includes(t0 as Tab) ? (t0 as Tab) : "summary";
  });
  const setTab = (t1: Tab) => {
    setTabState(t1);
    setUrl({ tab: t1 });
  };
  const [formato, setFormato] = useState<Formato>(base.formato);
  const [data, setData] = useState<MonitoringData>(() => monitoringDataFor(base.parcelId));
  const [printing, setPrinting] = useState(false);
  const [decisions, setDecisions] = useState<DecisionEntry[]>(() => loadDecisions(base.id));
  const isLive = base.status === "live";

  const deal = useMemo(() => ({ ...base, formato }), [base, formato]);
  const sim = useMemo(() => simulateFile(deal, data), [deal, data]);
  const last = sim.frames.length - 1;
  // The file opens at its latest week; the replay steps back through the real campaign.
  const [index, setIndex] = useState(() => {
    const w = Number(urlParam("week"));
    return Number.isFinite(w) && w > 0 ? w - 1 : Number.MAX_SAFE_INTEGER;
  });
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [pauseNote, setPauseNote] = useState<string | null>(null);
  // A live file opens on today; its replay ("look back") is one click away.
  const [lookBack, setLookBack] = useState(() => !isLive || Number(urlParam("week")) > 0);
  const frameIndex = Math.min(index, last);
  const frame = sim.frames[frameIndex];
  const atEnd = frameIndex >= last;
  const current = useMemo(() => rescore(sim.origination, frame.panels, deal), [sim, frame, deal]);
  const yieldAdj = useMemo(() => yieldAdjustment(sim.series.crop, frame.date), [sim, frame.date]);
  const findings = FINDINGS[deal.id] ?? [];
  const { checks, running: checking } = useLiveChecks(isLive && atEnd, deal, sim, frame);

  useEffect(() => {
    if (!playing) return;
    if (frameIndex >= last) {
      setPlaying(false);
      return;
    }
    // A week whose risk level changes gets a longer pause, so its notification can be read.
    const cur = sim.frames[frameIndex];
    const next = sim.frames[frameIndex + 1];
    const escalates = next && worstOf(next) !== worstOf(cur);
    // The replay stops by itself on a tranche decision: the analyst weighs it, then plays on to see what happened.
    const decision = next?.tranches.find((t) => t.dueDate > cur.date && t.dueDate <= next.date && t.id !== "approval");
    const id = window.setTimeout(
      () => {
        setIndex(frameIndex + 1);
        if (decision) {
          setPlaying(false);
          setPauseNote(
            lang === "es"
              ? `Pausa en la decisión: ${decision.label.es} · tramo ${decision.pct}% (${formatUsd(decision.amountUsd, lang)}). Revise la tarjeta de decisión y continúe para ver qué pasó.`
              : `Paused at a decision: ${decision.label.en} · tranche ${decision.pct}% (${formatUsd(decision.amountUsd, lang)}). Review the decision card, then play on to see what happened.`,
          );
        }
      },
      (escalates ? 2100 : 900) / speed,
    );
    return () => window.clearTimeout(id);
  }, [playing, frameIndex, last, sim.frames, speed, lang]);

  useEffect(() => {
    if (playing) return;
    setUrl({ week: atEnd ? null : String(frameIndex + 1) });
  }, [playing, frameIndex, atEnd]);

  const togglePlay = () => {
    if (!playing && atEnd) setIndex(0);
    setPauseNote(null);
    setPlaying(!playing);
  };

  const downloadLog = () => {
    const rows = decisionLogRows(deal, sim, decisions, lang);
    const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${deal.id}-decision-log.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done);
    const id = window.setTimeout(() => window.print(), 300);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("afterprint", done);
    };
  }, [printing]);

  // Live files sync with the sources in the background on opening: no refresh button.
  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/pre-harvest-data?parcel=${base.parcelId}`);
        if (!res.ok) return;
        const live = (await res.json()) as {
          status: { ndvi: "live" | "cached"; climate: "live" | "cached" };
          sentinelSeries: Array<{ date: string; ndviMean: number }>;
          climate: ClimateFixture;
        };
        if (cancelled || !live.sentinelSeries?.length) return;
        setData((prev) => ({
          ...prev,
          ndvi: { ...prev.ndvi, fetchedAt: new Date().toISOString(), series: sentinelComposites(live.sentinelSeries) },
          climate: live.climate,
          status: { ...prev.status, ndvi: live.status.ndvi, climate: live.status.climate },
        }));
      } catch {
        /* sources unavailable: the file keeps its last synced data */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, base.parcelId]);

  const show = (x: Tab) => printing || tab === x;
  const worst = worstOf(frame);
  const panelProps = { deal, sim, frame, current, yieldAdj, lang };
  const goTab = (t1: Tab) => {
    setTab(t1);
    window.setTimeout(() => document.getElementById("file-tabs")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }), 0);
  };
  const investigate = () => goTab("investigation");
  const updates = sim.alerts.filter((a) => a.date <= frame.date).length + findings.filter((f) => f.date <= frame.date).length;

  return (
    <div className="space-y-5 pb-24 print:pb-0">
      <FileHeader
        deal={deal}
        sim={sim}
        frame={frame}
        lang={lang}
        onBack={onBack}
        onPrint={() => setPrinting(true)}
        atEnd={atEnd}
        monitored={isLive && atEnd}
        checking={checking}
      />
      {/* Nothing to replay on an application: no loan has run yet. */}
      {sim.frames.length > 1 && deal.status !== "application" &&
        (lookBack ? (
          <ReplayBar
            frames={sim.frames}
            index={frameIndex}
            onIndex={(i) => {
              setPlaying(false);
              setIndex(i);
            }}
            playing={playing}
            onTogglePlay={togglePlay}
            findings={findings}
            lang={lang}
            speed={speed}
            onSpeed={setSpeed}
            pauseNote={pauseNote}
            onDownloadLog={downloadLog}
            onBackToToday={
              isLive
                ? () => {
                    setPlaying(false);
                    setIndex(Number.MAX_SAFE_INTEGER);
                    setLookBack(false);
                  }
                : undefined
            }
          />
        ) : (
          <button
            type="button"
            onClick={() => setLookBack(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-tm-text-light hover:text-tm-black print:hidden"
          >
            <History className="h-4 w-4" />
            {lang === "es" ? "Reproducir la campaña" : "Replay the campaign"}
          </button>
        ))}

      <MoneyOverview deal={deal} sim={sim} frame={frame} current={current} lang={lang} onOpenRisk={() => goTab("monitoring")} />
      <DecisionCard {...panelProps} atEnd={atEnd} decisions={decisions} onDecisions={setDecisions} onInvestigate={investigate} />
      <UpdatesFeed deal={deal} sim={sim} frame={frame} checks={checks} running={checking} lang={lang} onOpenAll={investigate} onAct={() => document.getElementById("decision-card")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" })} />

      {/* One line; swipes sideways (no scrollbar) when it does not fit. overflow-y stays hidden so the underline never makes the row scroll. */}
      <nav
        id="file-tabs"
        className="flex scroll-mt-4 gap-1 overflow-x-auto overflow-y-hidden border-b border-tm-border [scrollbar-width:none] print:hidden [&::-webkit-scrollbar]:hidden"
        role="tablist"
      >
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`relative shrink-0 whitespace-nowrap px-2.5 py-2 text-sm xl:px-3 font-medium transition-colors ${tab === id ? "text-tm-primary-dark" : "text-tm-text-light hover:text-tm-black"}`}
          >
            {tb(TAB_LABEL[id], lang)}
            {id === "monitoring" && worst !== "green" && (
              <span className={`ml-1.5 inline-block h-2 w-2 rounded-full align-middle ${worst === "red" ? "bg-tm-danger" : "bg-tm-accent"}`} />
            )}
            {id === "investigation" && (
              <span className="ml-1.5 rounded-full bg-tm-neutral px-1.5 py-0.5 text-[10px] font-semibold text-tm-text-light">{updates}</span>
            )}
            {tab === id && (
              <motion.span
                layoutId="tab-underline"
                className="absolute inset-x-0 bottom-0 h-0.5 bg-tm-primary"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 35 }}
              />
            )}
          </button>
        ))}
      </nav>

      {frame.m3Reached && frame.action !== "stop" && deal.status === "live" && !printing && (
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-tm-text-light">
          {t("m3Banner", lang)}
          <button type="button" onClick={onOpenPostHarvest} className="inline-flex items-center gap-1 font-medium text-tm-black underline-offset-2 hover:underline">
            {t("openPostHarvest", lang)}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </p>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={printing ? "print" : tab}
          initial={reduce ? false : { opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? undefined : { opacity: 0, transition: { duration: 0.12 } }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-5"
        >
          {show("summary") && (
            <PrintSection title={tb(TAB_LABEL.summary, lang)}>
              <SummaryPanel {...panelProps} />
            </PrintSection>
          )}

          {show("monitoring") && (
            <PrintSection title={tb(TAB_LABEL.monitoring, lang)}>
              <RiskDetails deal={deal} sim={sim} frame={frame} current={current} checks={checks} ndviSeries={data.ndvi.series} lang={lang} onCredit={() => goTab("analysis")} />
            </PrintSection>
          )}

          {show("analysis") && (
            <PrintSection title={tb(TAB_LABEL.analysis, lang)}>
              <div className="space-y-5">
                <ScorePanel deal={deal} origination={sim.origination} current={current} asOf={frame.date} lang={lang} />
                <StressPanel {...panelProps} />
              </div>
            </PrintSection>
          )}

          {show("investigation") && (
            <PrintSection title={tb(TAB_LABEL.investigation, lang)}>
              <ResearchTimeline deal={deal} sim={sim} findings={findings} decisions={decisions} lang={lang} applicationDate={deal.checksDate} upTo={frame.date} />
            </PrintSection>
          )}

          {show("disbursements") && (
            <PrintSection title={tb(TAB_LABEL.disbursements, lang)}>
              <div className="space-y-5">
                <DisbursementPanel deal={deal} frame={frame} fruitSetDelayDays={sim.fruitSetDelayDays} yieldAdj={yieldAdj} lang={lang} />
                <DecisionLog decisions={decisions} lang={lang} />
                <AlertLog alerts={sim.alerts} upTo={frame.date} lang={lang} />
              </div>
            </PrintSection>
          )}

          {show("application") && (
            <PrintSection title={tb(TAB_LABEL.application, lang)}>
              <InputsPanel deal={deal} data={data} onChange={setFormato} onReset={() => setFormato(base.formato)} lang={lang} />
            </PrintSection>
          )}
        </motion.div>
      </AnimatePresence>

      {printing && (
        <p className="text-xs text-tm-text-muted">
          {t("generatedOn", lang)} {formatDate(new Date().toISOString().slice(0, 10), lang)} · {t("thresholdPolicy", lang)}
        </p>
      )}

      {!printing && <UpdateToasts deal={deal} sim={sim} frame={frame} lang={lang} onOpen={investigate} />}
    </div>
  );
}

/** Decision log for audit: the bank's tranche decisions, TruMarket's alerts and the analyst's recorded decisions. */
function decisionLogRows(deal: PreHarvestDeal, sim: CampaignSimulation, decisions: DecisionEntry[], lang: Lang): string[][] {
  const out: string[][] = [];
  out.push([deal.approvalDate, "BCP", lang === "es" ? "Aprobación del préstamo" : "Loan approved", String(deal.envelopeUsd), `${sim.origination.composite} · ${sim.origination.tier}`]);
  const last = sim.frames.at(-1)!;
  for (const t of last.tranches) {
    out.push([t.releasedOn ?? t.dueDate, "BCP", `${tb(t.label, lang)} · ${t.pct}% · ${t.status}`, String(t.amountUsd), t.releasedOn && t.releasedOn > t.dueDate ? `due ${t.dueDate}` : ""]);
  }
  for (const a of sim.alerts) out.push([a.date, "TruMarket", tb(a.message, lang), "", `${a.severity} · ${a.action}`]);
  for (const d of decisions) out.push([d.at.slice(0, 10), d.analyst, `${d.kind} · ${d.subject}`, d.amountUsd === null ? "" : String(d.amountUsd), d.note]);
  out.sort((x, y) => x[0].localeCompare(y[0]));
  return [["date", "who", "event", "amount_usd", "detail"], ...out];
}

function worstOf(frame: { panels: Record<string, { severity: string }> }): "green" | "yellow" | "red" {
  const sev = Object.values(frame.panels).map((p) => p.severity);
  return sev.includes("red") ? "red" : sev.includes("yellow") ? "yellow" : "green";
}
