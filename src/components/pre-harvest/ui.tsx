import type { ReactNode } from "react";
import { Check } from "lucide-react";
import type { BankAction, Lang, Severity, SourceStatus } from "../../lib/pre-harvest/types";
import { CHART_COLORS } from "./theme";
import { ACTION_TEXT, formatDate, SEVERITY_TEXT, SOURCE_STATUS_TEXT, tb } from "../../lib/pre-harvest/i18n";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-tm-border bg-tm-surface p-5 shadow-tm-sm ${className}`}>
      {children}
    </section>
  );
}

export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h3 className="font-display text-lg text-tm-black">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-tm-text-light">{hint}</p>}
    </div>
  );
}

const SEVERITY_CLASS: Record<Severity, string> = {
  green: "border-tm-border bg-tm-surface text-tm-text-light",
  yellow: "border-tm-accent/50 bg-tm-accent/15 text-tm-accent-dark",
  red: "border-tm-danger/50 bg-tm-danger/15 text-tm-danger-dark",
};

export function SeverityChip({ severity, lang }: { severity: Severity; lang: Lang }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${SEVERITY_CLASS[severity]}`}>
      {severity === "green" ? (
        <Check className="h-3 w-3 text-tm-primary" strokeWidth={3} />
      ) : (
        <span className="h-2 w-2 rounded-full" style={{ background: severity === "yellow" ? CHART_COLORS.yellow : CHART_COLORS.red }} />
      )}
      {tb(SEVERITY_TEXT[severity], lang)}
    </span>
  );
}

// Status text, not a button: what the bank should do, in the severity's colour.
const ACTION_CLASS: Record<BankAction, string> = {
  continue: "border-transparent text-tm-text-light",
  call_inspection: "border-transparent text-tm-blue",
  hold_tranche: "border-transparent text-tm-accent-dark",
  stop: "border-transparent text-tm-danger-dark",
};

export function ActionChip({
  action,
  lang,
  large = false,
  wrap = false,
}: {
  action: BankAction;
  lang: Lang;
  large?: boolean;
  wrap?: boolean;
}) {
  return (
    <span
      className={`inline-flex border font-semibold ${wrap ? "rounded-lg" : "whitespace-nowrap rounded-full"} ${ACTION_CLASS[action]} ${large ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"}`}
    >
      → {tb(ACTION_TEXT[action], lang)}
    </span>
  );
}

const SOURCE_CLASS: Record<SourceStatus, string> = {
  live: "bg-tm-neutral text-tm-text-light",
  cached: "bg-tm-neutral text-tm-text-light",
  verified: "bg-tm-neutral text-tm-text-light",
  manual: "bg-tm-neutral text-tm-text-light",
};

export function SourceBadge({ status, lang, date }: { status: SourceStatus; lang: Lang; date?: string }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SOURCE_CLASS[status]}`}>
      {tb(SOURCE_STATUS_TEXT[status], lang)}
      {date ? ` · ${formatDate(date, lang)}` : ""}
    </span>
  );
}

export function LanguageToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-tm-border bg-tm-surface p-0.5 text-xs font-semibold" role="group" aria-label="Language">
      {(["en", "es"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          aria-pressed={lang === l}
          className={`rounded-md px-2.5 py-1 transition-colors ${lang === l ? "bg-tm-primary text-white" : "text-tm-text-light hover:text-tm-black"}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
