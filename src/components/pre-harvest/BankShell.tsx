/**
 * The bank's pre-harvest workspace: grouped navigation with counts, a breadcrumb
 * and file search in the top bar, and language, analyst and data date in the
 * sidebar footer. TruMarket's internal tools are behind the workspace switch.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BellRing, BookOpen, ChevronRight, FilePlus2, Gavel, Inbox as InboxIcon, LayoutDashboard, Search } from "lucide-react";
import { PRE_HARVEST_ENGINE_VERSION } from "../../lib/pre-harvest/config";
import { formatDate, tb } from "../../lib/pre-harvest/i18n";
import type { Bilingual, Lang, Severity } from "../../lib/pre-harvest/types";
import type { FileRow } from "./portfolio";
import { Sidebar, TopBar } from "../Sidebar";
import { LanguageToggle } from "./ui";

export type Page = "dashboard" | "inbox" | "decisions" | "alerts" | "method" | "new";

const L = (en: string, es: string): Bilingual => ({ en, es });
const NAV: Array<{ group: Bilingual; items: Array<{ id: Page; label: Bilingual; icon: typeof InboxIcon }> }> = [
  {
    group: L("Files", "Expedientes"),
    items: [
      { id: "dashboard", label: L("Dashboard", "Tablero"), icon: LayoutDashboard },
      { id: "inbox", label: L("Inbox", "Bandeja"), icon: InboxIcon },
      { id: "decisions", label: L("Decisions due", "Decisiones pendientes"), icon: Gavel },
      { id: "alerts", label: L("Alerts", "Alertas"), icon: BellRing },
      { id: "new", label: L("New application", "Nueva solicitud"), icon: FilePlus2 },
    ],
  },
  {
    group: L("Record", "Registro"),
    items: [{ id: "method", label: L("Method & sources", "Método y fuentes"), icon: BookOpen }],
  },
];


const PAGE_TITLE: Record<Page, Bilingual> = {
  dashboard: L("Dashboard", "Tablero"),
  inbox: L("Inbox", "Bandeja"),
  decisions: L("Decisions due", "Decisiones pendientes"),
  alerts: L("Alerts", "Alertas"),
  method: L("Method & sources", "Método y fuentes"),
  new: L("New application", "Nueva solicitud"),
};

function readAnalyst(): string {
  try {
    return localStorage.getItem("tm-pre-harvest-analyst") ?? "";
  } catch {
    return "";
  }
}

function SearchBox({ rows, lang, onOpen }: { rows: FileRow[]; lang: Lang; onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const hits = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return rows
      .filter((r) => [r.deal.id, r.deal.name.en, r.deal.name.es, r.deal.location.en, r.deal.location.es, r.deal.campaign.en, r.deal.formato.ruc].some((x) => x.toLowerCase().includes(term)))
      .slice(0, 6);
  }, [q, rows]);
  const open = (id: string) => {
    setQ("");
    input.current?.blur();
    onOpen(id);
  };
  return (
    <div className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tm-text-muted" />
      <input
        ref={input}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => window.setTimeout(() => setFocus(false), 150)}
        onKeyDown={(e) => e.key === "Enter" && hits[0] && open(hits[0].deal.id)}
        placeholder={lang === "es" ? "Buscar expedientes" : "Search files"}
        aria-label={lang === "es" ? "Buscar expedientes" : "Search files"}
        className="w-full rounded-lg border border-tm-border bg-tm-neutral-light py-1.5 pl-8 pr-12 text-sm placeholder:text-tm-text-muted focus:border-tm-text-muted focus:bg-tm-surface focus:outline-none"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-tm-border px-1 text-[10px] text-tm-text-muted">Ctrl K</kbd>
      {focus && q.trim() && (
        <ul className="absolute left-0 right-0 top-full z-[1200] mt-1 overflow-hidden rounded-lg border border-tm-border bg-tm-surface shadow-tm-lg">
          {hits.length === 0 ? (
            <li className="px-3 py-2 text-sm text-tm-text-light">{lang === "es" ? "Sin resultados" : "No matching files"}</li>
          ) : (
            hits.map((r) => (
              <li key={r.deal.id}>
                <button type="button" onMouseDown={() => open(r.deal.id)} className="block w-full px-3 py-2 text-left hover:bg-tm-neutral-light">
                  <span className="block text-sm font-medium text-tm-black">{tb(r.deal.name, lang)}</span>
                  <span className="block text-xs text-tm-text-muted">
                    {tb(r.deal.location, lang)} · {tb(r.deal.campaign, lang)}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export function BankShell({
  page,
  fileName,
  rows,
  dataAsOf,
  lang,
  onLang,
  onPage,
  onOpenFile,
  onExitWorkspace,
  children,
}: {
  /** Current page, or null when a loan file is open. */
  page: Page | null;
  fileName?: string;
  rows: FileRow[];
  dataAsOf: string;
  lang: Lang;
  onLang: (l: Lang) => void;
  onPage: (p: Page) => void;
  onOpenFile: (id: string) => void;
  onExitWorkspace: () => void;
  children: ReactNode;
}) {
  const analyst = readAnalyst();
  const decisions = rows.filter((r) => r.decision);
  const alerts = rows.flatMap((r) => r.alerts);
  const counts: Partial<Record<Page, { n: number; sev: Severity }>> = {
    inbox: { n: rows.length, sev: "green" },
    decisions: { n: decisions.length, sev: decisions.some((r) => r.worst === "red") ? "red" : decisions.some((r) => r.worst === "yellow") ? "yellow" : "green" },
    alerts: { n: alerts.length, sev: alerts.some((a) => a.trigger.severity === "red") ? "red" : alerts.length ? "yellow" : "green" },
  };
  const active = page ?? "inbox";

  const tone = (sev: Severity): "neutral" | "watch" | "high" => (sev === "red" ? "high" : sev === "yellow" ? "watch" : "neutral");
  const groups = NAV.map((g) => ({
    label: tb(g.group, lang),
    items: g.items.map((it) => ({ id: it.id, label: tb(it.label, lang), icon: it.icon, count: counts[it.id]?.n, tone: counts[it.id] ? tone(counts[it.id]!.sev) : undefined })),
  }));
  const crumbs = (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1">
      <button type="button" onClick={() => onPage("dashboard")} className="hover:text-tm-black">
        {lang === "es" ? "Pre-cosecha" : "Pre-harvest"}
      </button>
      {!page && (
        <>
          <ChevronRight className="h-3 w-3" />
          <button type="button" onClick={() => onPage("inbox")} className="hover:text-tm-black">
            {tb(PAGE_TITLE.inbox, lang)}
          </button>
        </>
      )}
    </nav>
  );

  return (
    <div className="bank-ui flex min-h-screen bg-tm-neutral-light">
      <Sidebar
        product={lang === "es" ? "Crédito agro · pre-cosecha" : "Agro credit · pre-harvest"}
        active={active}
        onHome={() => onPage("dashboard")}
        onSelect={(id) => onPage(id as Page)}
        groups={groups}
        footer={
          <div className="space-y-3 border-t border-tm-border pt-4">
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-tm-black">{analyst || (lang === "es" ? "Analista" : "Analyst")}</span>
                <span className="block text-[11px] text-tm-text-muted">{lang === "es" ? "Analista de crédito · BCP" : "Credit analyst · BCP"}</span>
              </span>
              <LanguageToggle lang={lang} onChange={onLang} />
            </div>
            <p className="px-1 text-[11px] leading-snug text-tm-text-muted">
              {lang === "es" ? "Datos al" : "Data as of"} {formatDate(dataAsOf, lang)} · {lang === "es" ? "modelo" : "model"} {PRE_HARVEST_ENGINE_VERSION.replace("pre-harvest-", "")}
              <br />
              Sentinel-2 · ERA5 · NOAA · Veritrade
            </p>
            {lang === "en" && <p className="px-1 text-[11px] leading-snug text-tm-text-muted">Registry results and news from Peru are quoted in Spanish, as published.</p>}
            <button type="button" onClick={onExitWorkspace} className="px-1 text-[11px] font-medium text-tm-text-light hover:text-tm-black">
              {lang === "es" ? "Espacio interno TruMarket →" : "TruMarket internal workspace →"}
            </button>
          </div>
        }
      />

      <div className="min-w-0 flex-1">
        <TopBar
          title={page ? tb(PAGE_TITLE[page], lang) : fileName}
          sub={crumbs}
          right={
            <div className="flex items-center gap-2">
              <SearchBox rows={rows} lang={lang} onOpen={onOpenFile} />
              <span className="lg:hidden">
                <LanguageToggle lang={lang} onChange={onLang} />
              </span>
            </div>
          }
        />
        {/* Phones: the sidebar becomes a row of tabs. */}
        <nav className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-tm-border bg-tm-surface px-3 [scrollbar-width:none] lg:hidden print:hidden [&::-webkit-scrollbar]:hidden">
          {NAV.flatMap((g) => g.items).map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => onPage(it.id)}
              className={`shrink-0 border-b-2 px-2.5 py-2 text-xs font-medium ${active === it.id ? "border-tm-primary text-tm-primary-dark" : "border-transparent text-tm-text-light"}`}
            >
              {tb(it.label, lang)}
              {counts[it.id] && counts[it.id]!.n > 0 && <span className="ml-1 text-tm-text-muted">{counts[it.id]!.n}</span>}
            </button>
          ))}
        </nav>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
