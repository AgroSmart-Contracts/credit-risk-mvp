/**
 * Building blocks of the BCP workspace (spec section 4.3): cards, state chips
 * with a text label (never colour alone), provenance badges, the "Estimado"
 * badge, buttons, and a stacked bar with its numbers stated for screen readers.
 */
import { useEffect, type ReactNode } from "react";
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
export function StateChip({ state, suffix }: { state: ConditionState | "neutral"; suffix?: string }) {
  const t = useT();
  const c = STATE_CHIP[state];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] font-[Arial,Helvetica,sans-serif] text-[12px] font-bold ${c.bg} ${c.text}`}>
      <span className={`h-2 w-2 rounded-full ${c.dot}`} aria-hidden />
      {t(STATE_TEXT[state])}
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

/** The example-data chips required on every screen (spec 2.6). */
export function ExampleChip({ kind }: { kind: "portfolio" | "file" }) {
  const t = useT();
  return <Chip>{kind === "portfolio" ? t("Cartera de ejemplo · datos ilustrativos", "Example portfolio · illustrative data") : t("Expediente de ejemplo", "Example file")}</Chip>;
}

/** Large dialog for evidence and history charts: Esc or the backdrop closes it. */
export function Dialog({ open, onClose, title, sub, children, closeLabel }: { open: boolean; onClose: () => void; title: string; sub?: string; children: ReactNode; closeLabel: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="bcp fixed inset-0 z-[1200] flex items-end justify-center bg-bcp-ink/40 sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl sm:p-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-bold text-bcp-ink">{title}</h2>
            {sub && <p className="lbl">{sub}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label={closeLabel} className="min-h-[44px] min-w-[44px] rounded-lg text-2xl leading-none text-bcp-muted hover:text-bcp-ink">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Side drawer: detail behind a figure or a reading, from the right, with the page
 * still in view. Esc, the close button or a click outside closes it; focus returns.
 */
export function SideDrawer({ eyebrow, title, sub, onClose, closeLabel, children }: { eyebrow: string; title: string; sub?: string; onClose: () => void; closeLabel: string; children: ReactNode }) {
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    document.getElementById("side-drawer-close")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="bcp fixed inset-0 z-[1200] print:hidden" role="presentation">
      <div className="absolute inset-0 bg-bcp-ink/35" onClick={onClose} aria-hidden />
      <aside role="dialog" aria-modal="true" aria-labelledby="side-drawer-title" className="absolute right-0 top-0 flex h-full w-[min(560px,100vw)] flex-col overflow-y-auto bg-white shadow-[-12px_0_32px_rgba(16,42,64,0.15)]">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-bcp-border bg-white px-6 pb-3 pt-5">
          <div className="min-w-0">
            <p className="font-[Arial,Helvetica,sans-serif] text-[12px] font-bold uppercase tracking-[0.06em] text-bcp-muted">{eyebrow}</p>
            <h2 id="side-drawer-title" className="mt-1 text-[20px] font-bold leading-tight">
              {title}
            </h2>
            {sub && <p className="lbl">{sub}</p>}
          </div>
          <button id="side-drawer-close" type="button" onClick={onClose} className="min-h-[44px] shrink-0 rounded-lg border border-bcp-border px-4 text-sm font-semibold hover:border-bcp-ink">
            {closeLabel}
          </button>
        </header>
        <div className="space-y-5 px-6 pb-10 pt-5">{children}</div>
      </aside>
    </div>
  );
}

/** The dark box a drawer opens with: what this means for the bank's money. */
export function ImpactBox({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="rounded-xl bg-bcp-ink px-4 py-3.5 text-white">
      <p className="font-[Arial,Helvetica,sans-serif] text-[12px] text-bcp-label">{label}</p>
      <p className="mt-1 text-[18px] font-bold leading-snug">{value}</p>
      {note && <p className="mt-1 text-[13px] text-white/85">{note}</p>}
    </div>
  );
}

/** Compact table for drawers: label column left, figures right-aligned. */
export function DrawerTable({ head, rows, right = [], foot }: { head: string[]; rows: ReactNode[][]; right?: number[]; foot?: ReactNode[] }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-bcp-border">
            {head.map((h, i) => (
              <th key={i} className={`lbl whitespace-nowrap py-2 pr-3 font-normal ${right.includes(i) ? "text-right" : "text-left"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-bcp-divider">
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              {r.map((c, j) => (
                <td key={j} className={`py-2 pr-3 ${right.includes(j) ? "whitespace-nowrap text-right" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
          {foot && (
            <tr className="border-t-2 border-bcp-ink font-bold">
              {foot.map((c, j) => (
                <td key={j} className={`py-2 pr-3 ${right.includes(j) ? "whitespace-nowrap text-right" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
