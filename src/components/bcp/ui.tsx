/**
 * Building blocks of the BCP workspace (spec section 4.3): cards, state chips
 * with a text label (never colour alone), provenance badges, the "Estimado"
 * badge, buttons, and a stacked bar with its numbers stated for screen readers.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { CAUSE_TEXT, type StateCause } from "../../lib/bcp/calc";
import type { ConditionState, Provenance } from "../../lib/bcp/types";
import { PROV_TEXT, STATE_TEXT, useT } from "./shared";

export function Card({ children, className = "", tone = "plain" }: { children: ReactNode; className?: string; tone?: "plain" | "dark" | "control" | "decision" }) {
  const cls =
    tone === "dark"
      ? "border-bcp-ink bg-bcp-ink text-white"
      : tone === "control"
        ? "border-bcp-control-border bg-bcp-control"
        : tone === "decision"
          ? "border-2 border-bcp-ink bg-white"
          : "border-bcp-border bg-white";
  return <section className={`rounded-xl border p-4 sm:p-5 ${cls} ${className}`}>{children}</section>;
}

export function Lbl({ children, className = "", as: As = "p" }: { children: ReactNode; className?: string; as?: "p" | "span" | "th" }) {
  return <As className={`lbl ${className}`}>{children}</As>;
}

/** Page-level tabs: every kind of data has one fixed place on the page. */
export function PageTabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string; count?: number; locked?: string; pilot?: boolean }[]; value: T; onChange: (id: T) => void; label: string }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  // The bar sticks right below the app header, whose height depends on the screen width.
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".bcp header.sticky");
    if (!header) return;
    const measure = () => setTop(header.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  const select = (id: T) => {
    onChange(id);
    const y = anchor.current?.getBoundingClientRect().top;
    if (y !== undefined && y < top) window.scrollBy({ top: y - top });
  };
  return (
    <>
      <div ref={anchor} aria-hidden />
      <div role="tablist" aria-label={label} style={{ top }} className="sticky z-20 -mx-4 flex gap-1 overflow-x-auto border-b border-bcp-border bg-bcp-bg px-4 [scrollbar-width:none] sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0 print:hidden">
        {tabs.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={value === x.id} aria-disabled={x.locked ? true : undefined} title={x.locked} onClick={() => !x.locked && select(x.id)} className={`-mb-px inline-flex min-h-[46px] shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 text-sm font-semibold ${x.locked ? "cursor-not-allowed border-transparent text-bcp-muted/60" : value === x.id ? "border-bcp-ink text-bcp-ink" : "border-transparent text-bcp-muted hover:text-bcp-ink"}`}>
            {(x.locked || x.pilot) && <Lock className="h-3.5 w-3.5" aria-hidden />}
            {x.label}
            {x.count !== undefined && <span className="ml-1.5 rounded-full bg-bcp-fill px-1.5 py-[1px] text-[11px]">{x.count}</span>}
          </button>
        ))}
      </div>
    </>
  );
}

/** A small centred dialog: Escape or the backdrop closes it, and focus returns to what opened it. */
export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !box.current) return;
      const items = [...box.current.querySelectorAll<HTMLElement>("button")];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-bcp-ink/40 p-4 print:hidden" onClick={onClose}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 text-left shadow-xl sm:p-6">
        <h2 className="text-[18px] font-bold leading-snug text-bcp-ink">{title}</h2>
        <div className="mt-3">{children}</div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

export function SectionTitle({ title, sub, right, no }: { title: string; sub?: string; right?: ReactNode; no?: string }) {
  // Numbered sections read like a ledger: a heavy rule, the number, the title, the note on the right.
  if (no)
    return (
      <div className="mb-4 mt-10 flex flex-wrap items-baseline gap-x-3.5 gap-y-1 border-t-2 border-bcp-ink pt-3">
        <span className="font-[Arial,Helvetica,sans-serif] text-[12px] font-bold text-bcp-muted">{no}</span>
        <h2 className="text-[20px] font-bold leading-tight text-bcp-ink">{title}</h2>
        {(sub || right) && (
          <span className="ml-auto flex flex-wrap items-baseline gap-3">
            {sub && <span className="lbl">{sub}</span>}
            {right}
          </span>
        )}
      </div>
    );
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-[20px] font-bold leading-tight text-bcp-ink">{title}</h2>
        {sub && <p className="lbl mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

const STATE_CHIP: Record<ConditionState | "neutral", { bg: string; text: string; dot: string }> = {
  verde: { bg: "bg-bcp-verde-bg", text: "text-bcp-green-text", dot: "bg-bcp-green" },
  ambar: { bg: "bg-bcp-ambar-bg", text: "text-bcp-ambar-text", dot: "bg-bcp-ambar" },
  naranja: { bg: "bg-bcp-naranja-bg", text: "text-bcp-naranja-text", dot: "bg-bcp-naranja" },
  rojo: { bg: "bg-bcp-rojo-bg", text: "text-bcp-rojo-text", dot: "bg-bcp-rojo" },
  veto: { bg: "bg-bcp-rojo-bg", text: "text-bcp-rojo-text", dot: "bg-bcp-rojo" },
  observacion: { bg: "bg-bcp-divider", text: "text-bcp-ink", dot: "bg-bcp-fill-strong" },
  neutral: { bg: "bg-bcp-divider", text: "text-bcp-muted", dot: "bg-bcp-fill-strong" },
};
/** State chip: tinted pill, dot, and the state named in words. */
/** A state, optionally with why it has that colour ("Naranja por control"). */
export function StateChip({ state, suffix, cause }: { state: ConditionState | "neutral"; suffix?: string; cause?: StateCause | null }) {
  const t = useT();
  const c = STATE_CHIP[state];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] font-[Arial,Helvetica,sans-serif] text-[12px] font-bold ${c.bg} ${c.text}`}>
      <span className={`h-2 w-2 rounded-full ${c.dot}`} aria-hidden />
      {t(STATE_TEXT[state])}
      {cause && ` ${t(CAUSE_TEXT[cause])}`}
      {suffix && <span className="font-normal">{suffix}</span>}
    </span>
  );
}

/** Neutral chip (status words like "Liberado 15 set", "Expediente de ejemplo"). */
export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "ink" | "green" | "ambar" | "naranja" }) {
  const cls = {
    neutral: "bg-bcp-divider text-bcp-ink",
    ink: "bg-bcp-ink text-white",
    green: "bg-bcp-verde-bg text-bcp-green-text",
    ambar: "bg-bcp-ambar-bg text-bcp-ambar-text",
    naranja: "bg-bcp-naranja-bg text-bcp-naranja-text",
  }[tone];
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-[3px] font-[Arial,Helvetica,sans-serif] text-[12px] font-bold ${cls}`}>{children}</span>;
}

/** Provenance badge: square-ish, bordered, on every value in a condition table. */
export function Prov({ p }: { p: Provenance }) {
  const t = useT();
  return (
    // A label, not a control: plain white, text never over a pattern. Estimated values get a
    // dashed border (as dashed lines mark estimates in charts) and a small hatched swatch.
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded border bg-white px-1.5 py-[1px] font-[Arial,Helvetica,sans-serif] text-[11px] font-bold text-bcp-ink ${p === "estimado" ? "border-dashed border-bcp-muted" : "border-bcp-fill-strong"}`}>
      {p === "estimado" && <span aria-hidden className="hatch-est inline-block h-2 w-2 rounded-[1px] border border-bcp-fill-strong" />}
      {t(PROV_TEXT[p])}
    </span>
  );
}

/** Every forward-looking figure that is a projection carries this badge. */
export function Estimado() {
  return <Prov p="estimado" />;
}

export function Btn({ children, onClick, primary = false, disabled = false, type = "button" }: { children: ReactNode; onClick?: () => void; primary?: boolean; disabled?: boolean; type?: "button" | "submit" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-45 ${
        primary ? "bg-bcp-green-text text-white hover:opacity-90" : "border border-bcp-border bg-white text-bcp-ink hover:border-bcp-ink"
      }`}
    >
      {children}
    </button>
  );
}

/** Renders "**bold**" segments in dataset copy. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <b key={i} className="font-bold">
            {p}
          </b>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export interface Segment {
  value: number;
  className: string;
  label: string;
}

/** Horizontal stacked bar; the numbers are stated in the aria-label. */
export function StackBar({ segments, total, label, height = "h-4" }: { segments: Segment[]; total: number; label: string; height?: string }) {
  return (
    <div role="img" aria-label={label} className={`flex ${height} w-full overflow-hidden rounded-full bg-bcp-fill`}>
      {segments.map((s, i) => (
        <span key={i} className={`h-full ${s.className}`} style={{ width: `${total ? (s.value / total) * 100 : 0}%` }} title={s.label} />
      ))}
    </div>
  );
}

export function CheckIcon({ status }: { status: "ok" | "pending" | "warn" | "fail" }) {
  const map = {
    ok: { ch: "✓", cls: "text-bcp-green-text" },
    pending: { ch: "○", cls: "text-bcp-muted" },
    warn: { ch: "!", cls: "text-bcp-ambar-text font-bold" },
    fail: { ch: "✕", cls: "text-bcp-rojo-text font-bold" },
  }[status];
  return (
    <span className={`inline-block w-4 shrink-0 text-center ${map.cls}`} aria-label={status}>
      {map.ch}
    </span>
  );
}


/** A pilot-only feature: shown so the bank knows it exists, locked until the pilot. */
export function PilotLocked({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-bcp-border bg-bcp-bg px-5 py-6 text-bcp-muted">
      <Lock className="h-5 w-5 shrink-0" aria-hidden />
      <div>
        <p className="text-[15px] font-semibold text-bcp-ink">{title}</p>
        <p className="text-sm">{note}</p>
      </div>
    </div>
  );
}

/** A button for a pilot-only action: visible, disabled, with a lock. */
export function LockedBtn({ children, note }: { children: ReactNode; note: string }) {
  return (
    <button type="button" disabled title={note} aria-label={`${typeof children === "string" ? children : ""} · ${note}`} className="inline-flex min-h-[44px] cursor-not-allowed items-center gap-1.5 rounded-lg border border-dashed border-bcp-border bg-white px-4 text-sm font-semibold text-bcp-muted">
      <Lock className="h-3.5 w-3.5" aria-hidden />
      {children}
    </button>
  );
}
