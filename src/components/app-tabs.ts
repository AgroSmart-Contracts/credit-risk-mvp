import type { AppView } from "../types/platform";

export const TABS: { id: AppView; label: string; short: string }[] = [
  { id: "assess", label: "Assess deal", short: "Assess" },
  { id: "pre-harvest", label: "Pre-harvest · Pre-cosecha", short: "Pre-harvest" },
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

/** Hidden from nav for now — views/code kept so they can be re-enabled. */
export const HIDDEN_APP_TABS = new Set<AppView>([
  "counterparties",
  "missing",
  "route-table",
]);

export const VISIBLE_APP_TABS = TABS.filter((t) => !HIDDEN_APP_TABS.has(t.id));

