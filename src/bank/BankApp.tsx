/** The bank edition's shell: the pre-harvest workspace with its sidebar, and nothing else. */
import { useCallback, useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import { useAnswers } from "../components/bcp/answers";
import { getViewer } from "../components/bcp/edition";
import { NAV_ACTIVE, bcpNavItems, bcpUrl, readBcpUrl, readLang, type BcpView } from "../components/bcp/nav";
import { BcpWorkspace } from "../components/bcp/Workspace";
import { date } from "../lib/bcp/calc";
import type { Lang } from "../lib/bcp/types";
import { PORTFOLIO } from "./data/dataset";

export function BankApp({ onLogout }: { onLogout: () => void }) {
  const [page, setPage] = useState<{ view: BcpView; id: string | null }>(readBcpUrl);
  const [lang, setLang] = useState<Lang>(readLang);
  const [answers, setAnswer] = useAnswers();
  const t = (es: string, en: string) => (lang === "es" ? es : en);

  const go = useCallback(
    (view: BcpView, id: string | null = null) => {
      setPage({ view, id });
      const url = bcpUrl(view, id, lang);
      if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.pushState({ view, id }, "", url);
    },
    [lang],
  );

  useEffect(() => {
    const onPop = () => setPage(readBcpUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <div className="flex min-h-screen bg-tm-neutral-light">
      <Sidebar
        product={t("Pre-cosecha · BCP", "Pre-harvest · BCP")}
        active={NAV_ACTIVE[page.view]}
        onHome={() => go("cartera")}
        toggleLabels={{ collapse: t("Contraer menú", "Collapse menu"), expand: t("Expandir menú", "Expand menu") }}
        onSelect={(id) => go(id as BcpView)}
        groups={[{ label: t("Pre-cosecha · BCP", "Pre-harvest · BCP"), items: bcpNavItems(lang, answers) }]}
        footer={
          <div className="space-y-1 border-t border-tm-border pt-3 text-xs">
            <p className="truncate font-semibold text-tm-black">{getViewer()}</p>
            <p className="text-tm-text-muted">{t(`Datos al ${date(PORTFOLIO.cutoff, "es")}`, `Data as of ${date(PORTFOLIO.cutoff, "en")}`)}</p>
            <button type="button" onClick={onLogout} className="flex min-h-[32px] items-center gap-1.5 font-semibold text-tm-text-muted hover:text-tm-black">
              <LogOut className="h-3.5 w-3.5" /> {t("Cerrar sesión", "Sign out")}
            </button>
          </div>
        }
      />
      <BcpWorkspace view={page.view} id={page.id} go={go} lang={lang} setLang={setLang} answers={answers} setAnswer={setAnswer} onExit={() => go("cartera")} />
    </div>
  );
}
