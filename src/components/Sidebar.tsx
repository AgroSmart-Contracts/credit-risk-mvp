/**
 * The one sidebar and top bar used across the app: the internal TruMarket tools
 * and the bank's pre-harvest workspace share the same frame, logo block, item
 * style and header, so moving between them never changes the chrome.
 */
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

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
}: {
  groups: SidebarGroup[];
  active: string;
  onSelect: (id: string) => void;
  onHome: () => void;
  /** Small line under the wordmark naming the workspace. */
  product: string;
  footer?: ReactNode;
}) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-tm-border bg-tm-surface px-4 py-6 lg:flex print:hidden">
      <button type="button" onClick={onHome} className="mb-7 flex flex-col items-center gap-1">
        <img src="/logo.svg" alt="" className="h-12 w-auto" />
        <span className="font-display text-xl font-semibold text-tm-primary-dark">TruMarket</span>
        <span className="text-[11px] text-tm-text-muted">{product}</span>
      </button>
      <nav className="space-y-5">
        {groups.map((g, i) => (
          <div key={g.label ?? i}>
            {g.label && <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-tm-text-muted">{g.label}</p>}
            <div className="space-y-1">
              {g.items.map((it) => {
                const Icon = it.icon;
                const on = active === it.id;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => onSelect(it.id)}
                    aria-current={on ? "page" : undefined}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                      on ? "bg-tm-primary/10 text-tm-primary-dark" : "text-tm-text-light hover:bg-tm-neutral-light hover:text-tm-black"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{it.label}</span>
                    {it.count !== undefined && it.count > 0 && (
                      <span className={`rounded-full px-1.5 text-[10px] font-semibold ${BADGE[it.tone ?? "neutral"]}`}>{it.count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="mt-auto">{footer}</div>
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
