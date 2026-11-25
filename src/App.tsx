/**
 * App shell: one persistent sidebar for the whole app, and a content area that
 * swaps sections. The bank's pre-harvest workspace and the internal TruMarket
 * tools are separate chunks loaded on demand (and prefetched when the browser
 * is idle), so switching never tears down the layout or reloads the page.
 */
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Briefcase, Cherry, FileSearch } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { VISIBLE_APP_TABS } from "./components/app-tabs";
import { useAnswers } from "./components/bcp/answers";
import { BCP_VIEWS, NAV_ACTIVE, bcpNavItems, bcpUrl, readBcpUrl, readLang, type BcpView } from "./components/bcp/nav";
import { PORTFOLIO } from "./data/bcp/dataset";
import { date } from "./lib/bcp/calc";
import type { Lang } from "./lib/bcp/types";
import type { AppView } from "./types/platform";

const loadBcp = () => import("./components/bcp/Workspace");
const loadInternal = () => import("./InternalApp");
const BcpWorkspace = lazy(() => loadBcp().then((m) => ({ default: m.BcpWorkspace })));
const InternalApp = lazy(loadInternal);

type Section = "bcp" | "internal";

const INTERNAL_ICON: Partial<Record<AppView, typeof FileSearch>> = { assess: FileSearch, platform: Briefcase, "blueberry-cram": Cherry };

function ContentSkeleton() {
  return (
    <div className="min-w-0 flex-1" aria-busy="true">
      <div className="h-[73px] border-b border-tm-border bg-tm-surface" />
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-8 sm:px-8">
        <div className="h-10 w-1/3 rounded-lg bg-tm-border/60" />
        <div className="h-40 rounded-xl bg-tm-border/50" />
        <div className="h-64 rounded-xl bg-tm-border/40" />
      </div>
    </div>
  );
}

function App() {
  const [section, setSection] = useState<Section>(() => (typeof window !== "undefined" && window.location.hash === "#pre-harvest" ? "bcp" : "internal"));
  const [internalView, setInternalView] = useState<AppView>("assess");
  const [bcp, setBcp] = useState<{ view: BcpView; id: string | null }>(readBcpUrl);
  const [lang, setLang] = useState<Lang>(readLang);
  const [answers, setAnswer] = useAnswers();
  const [platformCount, setPlatformCount] = useState<number | undefined>(undefined);

  // Warm both sections once the first screen is up, so the first switch is instant.
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (f: () => void) => number };
    const idle = (cb: () => void) => (w.requestIdleCallback ? w.requestIdleCallback(cb) : setTimeout(cb, 1500));
    // The internal tools are heavy (they score every platform deal when loaded), so they are
    // fetched when the pointer reaches their menu item, not in the background.
    idle(() => {
      void loadBcp().then(() => import("./components/bcp/pages")).then((m) => m.prefetchBcpPages());
    });
  }, []);

  // One history entry per page, so the browser's Back and Forward move between pages.
  const goBcp = useCallback(
    (view: BcpView, id: string | null = null) => {
      setSection("bcp");
      setBcp({ view, id });
      const url = bcpUrl(view, id, lang);
      // Never stack two entries for the same page (e.g. a row and its button both handling one click).
      if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.pushState({ section: "bcp", view, id }, "", url);
    },
    [lang],
  );

  const goInternal = useCallback(
    (v: AppView) => {
      if (v === "pre-harvest") {
        goBcp("cartera");
        return;
      }
      setSection("internal");
      setInternalView(v);
      window.history.pushState({ section: "internal", view: v }, "", window.location.pathname);
    },
    [goBcp],
  );

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const st = e.state as { section?: Section; view?: string; id?: string | null } | null;
      if (st?.section === "internal") {
        setSection("internal");
        setInternalView((st.view as AppView) ?? "assess");
      } else if (window.location.hash === "#pre-harvest") {
        setSection("bcp");
        setBcp(readBcpUrl());
      } else {
        setSection("internal");
        setInternalView("assess");
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const t = (es: string, en: string) => (lang === "es" ? es : en);
  const internalItems = VISIBLE_APP_TABS.filter((tab) => tab.id !== "pre-harvest").map((tab) => ({
    id: tab.id,
    label: tab.label,
    icon: INTERNAL_ICON[tab.id] ?? FileSearch,
    count: tab.id === "platform" ? platformCount : undefined,
  }));
  const active = section === "bcp" ? NAV_ACTIVE[bcp.view] : internalView;

  return (
    <div className="flex min-h-screen bg-tm-neutral-light">
      <Sidebar
        product={section === "bcp" ? t("Precosecha · BCP", "Pre-harvest · BCP") : "Credit risk"}
        active={active}
        onHome={() => goBcp("cartera")}
        toggleLabels={{ collapse: t("Contraer menú", "Collapse menu"), expand: t("Expandir menú", "Expand menu") }}
        onSelect={(id) => ((BCP_VIEWS as string[]).includes(id) ? goBcp(id as BcpView) : goInternal(id as AppView))}
        onPrefetch={(id) => {
          if (!(BCP_VIEWS as string[]).includes(id)) void loadInternal();
        }}
        groups={[
          { label: t("Precosecha · BCP", "Pre-harvest · BCP"), items: bcpNavItems(lang, answers) },
          { label: t("TruMarket interno", "TruMarket internal"), items: internalItems },
        ]}
        footer={
          <div className="space-y-0.5 border-t border-tm-border pt-3 text-xs">
            <p className="font-semibold text-tm-black">{t("Analista de Riesgos · BCP", "Risk analyst · BCP")}</p>
            <p className="text-tm-text-muted">{t(`Datos al ${date(PORTFOLIO.cutoff, "es")}`, `Data as of ${date(PORTFOLIO.cutoff, "en")}`)}</p>
          </div>
        }
      />
      <Suspense fallback={<ContentSkeleton />}>
        {section === "bcp" ? (
          <BcpWorkspace view={bcp.view} id={bcp.id} go={goBcp} lang={lang} setLang={setLang} answers={answers} setAnswer={setAnswer} onExit={() => goInternal("assess")} />
        ) : (
          <div className="min-w-0 flex-1">
            <InternalApp view={internalView} onView={goInternal} onPlatformCount={setPlatformCount} />
          </div>
        )}
      </Suspense>
    </div>
  );
}

export default App;
