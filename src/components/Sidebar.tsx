/**
 * The one sidebar and top bar used across the app: the internal TruMarket tools
 * and the bank's pre-harvest workspace share the same frame, logo block, item
 * style and header, so moving between them never changes the chrome.
 */
import { useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from "lucide-react";

export interface SidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  count?: number;
  /** Badge tone: neutral for plain counts, attention colours for work waiting. */
  tone?: "neutral" | "watch" | "high";
}

export interface SidebarGroup {
  label?: string;
  items: SidebarItem[];
}

const BADGE = {
  neutral: "bg-tm-neutral text-tm-text-muted",
  watch: "bg-tm-accent text-white",
  high: "bg-tm-danger text-white",
} as const;

export function Sidebar({
  groups,
  active,
  onSelect,
  onHome,
  product,
  footer,
  onPrefetch,
  toggleLabels = { collapse: "Collapse menu", expand: "Expand menu" },
}: {
  groups: SidebarGroup[];
  active: string;
  onSelect: (id: string) => void;
  onHome: () => void;
  /** Small line under the wordmark naming the workspace. */
  product: string;
  footer?: ReactNode;
  /** Called when the pointer or focus reaches an item: warm its code before the click. */
  onPrefetch?: (id: string) => void;
  /** Words for the collapse / expand control, in the workspace's language. */
  toggleLabels?: { collapse: string; expand: string };
}) {
  // Expanded (labels) or collapsed (icon rail), remembered in this browser.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("tm-sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem("tm-sidebar-collapsed", c ? "0" : "1");
      } catch {
        /* storage unavailable */
      }
      return !c;
    });
  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col overflow-y-auto border-r border-tm-border bg-tm-surface py-6 transition-[width] duration-200 lg:flex print:hidden ${collapsed ? "w-[72px] px-2" : "w-64 px-4"}`}
    >
      <button type="button" onClick={onHome} className="mb-6 flex flex-col items-center gap-1" title="TruMarket">
        <img src="/logo.svg" alt="" className={collapsed ? "h-9 w-auto" : "h-12 w-auto"} />
        {!collapsed && (
          <>
            <span className="font-display text-xl font-semibold text-tm-primary-dark">TruMarket</span>
            <span className="text-[11px] text-tm-text-muted">{product}</span>
          </>
        )}
      </button>
      <nav className="space-y-5">
        {groups.map((g, i) => (
          <div key={g.label ?? i}>
            {g.label &&
              (collapsed ? (
                <div className="mx-2 mb-2 border-t border-tm-border" aria-hidden />
              ) : (
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-tm-text-muted">{g.label}</p>
              ))}
            <div className="space-y-1">
              {g.items.map((it) => {
                const Icon = it.icon;
                const on = active === it.id;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => onSelect(it.id)}
                    onPointerEnter={() => onPrefetch?.(it.id)}
                    onFocus={() => onPrefetch?.(it.id)}
                    aria-current={on ? "page" : undefined}
                    aria-label={collapsed ? `${it.label}${it.count ? ` (${it.count})` : ""}` : undefined}
                    title={it.label}
                    className={`relative flex w-full items-center rounded-lg py-2.5 text-left text-sm font-medium transition-colors ${collapsed ? "justify-center px-0" : "gap-3 px-3"} ${
                      on ? "bg-tm-primary/10 text-tm-primary-dark" : "text-tm-text-light hover:bg-tm-neutral-light hover:text-tm-black"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {!collapsed && <span className="min-w-0 flex-1 truncate">{it.label}</span>}
                    {it.count !== undefined && it.count > 0 && (
                      <span className={`rounded-full px-1.5 text-[10px] font-semibold ${BADGE[it.tone ?? "neutral"]} ${collapsed ? "absolute right-1 top-1" : ""}`}>{it.count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="mt-auto space-y-3 pt-4">
        {!collapsed && footer}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          title={collapsed ? toggleLabels.expand : toggleLabels.collapse}
          aria-label={collapsed ? toggleLabels.expand : toggleLabels.collapse}
          className={`flex w-full items-center rounded-lg py-2 text-xs font-medium text-tm-text-muted hover:bg-tm-neutral-light hover:text-tm-black ${collapsed ? "justify-center" : "gap-2 px-3"}`}
        >
          {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
          {!collapsed && <span>{toggleLabels.collapse}</span>}
        </button>
      </div>
    </aside>
  );
}

/** Top bar: page title with a subtitle or breadcrumb on the left, utilities on the right. */
export function TopBar({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-[900] border-b border-tm-border bg-tm-surface/95 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/logo.svg" alt="TruMarket" className="h-9 w-auto shrink-0 lg:hidden" />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-tm-black sm:text-xl">{title}</h1>
            {sub && <div className="truncate text-xs text-tm-text-muted sm:text-sm">{sub}</div>}
          </div>
        </div>
        {right}
      </div>
    </header>
  );
}
