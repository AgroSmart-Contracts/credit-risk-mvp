import { Briefcase, Cherry, FileSearch, Sprout } from "lucide-react";
import type { AppView } from "../types/platform";
import { VISIBLE_APP_TABS } from "./app-tabs";
import { Sidebar } from "./Sidebar";

interface AppNavProps {
  view: AppView;
  onChange: (view: AppView) => void;
  scoredCount: number;
  platformCount: number;
  missingCount: number;
}

export function AppNav({
  view,
  onChange,
  scoredCount,
  platformCount,
  missingCount,
}: AppNavProps) {
  const badge: Partial<Record<AppView, number>> = {
    counterparties: scoredCount,
    platform: platformCount,
    missing: missingCount,
  };

  return (
    <nav className="border-b border-tm-border bg-tm-surface lg:hidden print:hidden">
      <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto overflow-y-hidden px-4 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
        {VISIBLE_APP_TABS.map((tab) => {
          const active = view === tab.id;
          const count = badge[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`relative shrink-0 px-3 py-3 text-sm font-medium transition-colors ${
                active
                  ? "text-tm-primary"
                  : "text-tm-text-light hover:text-tm-black"
              }`}
            >
              <span className="sm:hidden">{tab.short}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              {typeof count === "number" && tab.id === "platform" && (
                <span
                  className={`ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${
                    active
                      ? "bg-tm-primary/15 text-tm-primary"
                      : "bg-tm-neutral text-tm-text-muted"
                  }`}
                >
                  {count}
                </span>
              )}
              {active && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-tm-primary" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

const SIDE_ICON: Partial<Record<AppView, typeof Sprout>> = {
  assess: FileSearch,
  "pre-harvest": Sprout,
  platform: Briefcase,
  "blueberry-cram": Cherry,
};

/** Desktop navigation for the internal workspace, on the shared sidebar. */
export function AppSidebar({ view, onChange, platformCount, onHome }: { view: AppView; onChange: (v: AppView) => void; platformCount: number; onHome: () => void }) {
  return (
    <Sidebar
      product="Credit risk"
      active={view}
      onHome={onHome}
      onSelect={(id) => onChange(id as AppView)}
      groups={[
        {
          items: VISIBLE_APP_TABS.map((tab) => ({
            id: tab.id,
            label: tab.id === "pre-harvest" ? "Pre-harvest loans" : tab.label,
            icon: SIDE_ICON[tab.id] ?? FileSearch,
            count: tab.id === "platform" ? platformCount : undefined,
          })),
        },
      ]}
      footer={<p className="px-3 text-[11px] leading-snug text-tm-text-muted">Agro trade-finance credit risk · Peru</p>}
    />
  );
}
