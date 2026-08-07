import type { AppView } from "../types/platform";

const TABS: { id: AppView; label: string; short: string }[] = [
  { id: "assess", label: "Assess deal", short: "Assess" },
  {
    id: "counterparties",
    label: "Counterparty scores",
    short: "Counterparties",
  },
  {
    id: "platform",
    label: "Platform deals",
    short: "Platform",
  },
  {
    id: "missing",
    label: "Missing fields",
    short: "Missing",
  },
  {
    id: "route-table",
    label: "Route risk table",
    short: "Routes",
  },
  {
    id: "blueberry-cram",
    label: "Blueberry CRAM",
    short: "Blueberries",
  },
];

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
    <nav className="border-b border-tm-border bg-tm-surface">
      <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 sm:px-6">
        {TABS.map((tab) => {
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
              {typeof count === "number" && (
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
