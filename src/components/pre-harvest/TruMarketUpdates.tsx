/**
 * TruMarket updates: what TruMarket saw on the parcel, the weather, the market
 * and the counterparty, and what it means for the loan. Shown as a feed on the
 * file and as a notification when a new one arrives.
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Bell, CheckCircle2, ChevronDown, X } from "lucide-react";
import { financialImpact, updateTitle } from "../../lib/pre-harvest/finance";
import { formatDate, formatMonth, tb } from "../../lib/pre-harvest/i18n";
import type { CampaignSimulation } from "../../lib/pre-harvest/timeline";
import type { AlertLogEntry, Bilingual, Lang, PreHarvestDeal, TimelineFrame } from "../../lib/pre-harvest/types";
import type { CheckSource, LiveCheck } from "./live";
import { LiveDot } from "./motion";

const L = (en: string, es: string): Bilingual => ({ en, es });
const TX = {
  title: L("TruMarket updates", "Actualizaciones de TruMarket"),
  sub: L("What TruMarket checked, and what it means for this loan", "Lo que TruMarket revisó y lo que significa para este préstamo"),
  forLoan: L("For the loan", "Para el préstamo"),
  none: L("No updates yet on this file.", "Aún no hay actualizaciones en este expediente."),
  all: L("All updates", "Todas las actualizaciones"),
  watch: L("Watch", "Vigilar"),
  high: L("High risk", "Riesgo alto"),
  checking: L("Checking sources", "Revisando fuentes"),
  checkedToday: L("checked today", "revisado hoy"),
  decide: L("Go to the decision", "Ir a la decisión"),
  open: L("Open", "Abrir"),
};

const key = (a: AlertLogEntry) => `${a.date}:${a.panel}:${a.metric}:${a.severity}`;

/** Type chip for each kind of update. */
const KIND: Record<CheckSource | AlertLogEntry["panel"], Bilingual> = {
  satellite: L("Satellite", "Satélite"),
  crop: L("Satellite", "Satélite"),
  weather: L("Weather", "Clima"),
  enso: L("El Niño", "El Niño"),
  market: L("Price", "Precio"),
  counterparty: L("Registry", "Registros"),
  buyer: L("Buyer", "Comprador"),
  takeout: L("Repayment", "Repago"),
};

export function UpdatesFeed({
  deal,
  sim,
  frame,
  checks,
  running = false,
  lang,
  onOpenAll,
  onAct,
}: {
  deal: PreHarvestDeal;
  sim: CampaignSimulation;
  frame: TimelineFrame;
  checks: LiveCheck[];
  running?: boolean;
  lang: Lang;
  onOpenAll: () => void;
  /** Go to the decision an update calls for. */
  onAct: () => void;
}) {
  const reduce = useReducedMotion();
  const [showChecks, setShowChecks] = useState(false);
  // Cards only for what changed (TruMarket alerts); routine checks fold into one line.
  const alerts = sim.alerts.filter((a) => a.date <= frame.date).slice(-4).reverse();
  // Alerts with the same effect on the money share one card: the effect once, the alerts under it.
  const groups: Array<{ money: string; list: AlertLogEntry[]; sev: "yellow" | "red"; act: boolean }> = [];
  for (const a of alerts) {
    const impact = financialImpact(deal, sim, a);
    const money = [impact.headline, ...impact.details.slice(0, 1)].map((d) => tb(d, lang)).join(" · ");
    const g = groups.find((x) => x.money === money);
    const act = a.action !== "continue" && deal.status === "live";
    if (g) {
      g.list.push(a);
      if (a.severity === "red") g.sev = "red";
      g.act = g.act || act;
    } else groups.push({ money, list: [a], sev: a.severity, act });
  }

  return (
    <section className="rounded-xl border border-tm-border bg-tm-surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 font-display text-base text-tm-black">
          {tb(TX.title, lang)}
          {running && (
            <span className="inline-flex items-center gap-1.5 font-sans text-xs font-medium text-tm-text-light">
              <LiveDot /> {tb(TX.checking, lang)}
            </span>
          )}
        </h3>
        <button type="button" onClick={onOpenAll} className="inline-flex items-center gap-1 text-xs font-medium text-tm-text-light hover:text-tm-black print:hidden">
          {tb(TX.all, lang)} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {alerts.length === 0 && checks.length === 0 && <p className="text-sm text-tm-text-light">{tb(TX.none, lang)}</p>}
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {groups.map(({ money, list, sev, act }) => (
            <motion.li
              key={list.map(key).join("|")}
              layout={!reduce}
              initial={reduce ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`rounded-r-lg border-l-[3px] bg-tm-neutral-light py-2 pl-3 pr-3 text-sm ${sev === "red" ? "border-l-tm-danger" : "border-l-tm-accent"}`}
            >
              {/* The money effect once; the TruMarket alerts behind it underneath. */}
              <p className="font-medium text-tm-black">{money}</p>
              <ul className="mt-1 space-y-0.5">
                {list.map((a) => (
                  <li key={key(a)} className="text-xs text-tm-text-light">
                    <span className={a.severity === "red" ? "font-semibold text-tm-danger-dark" : "font-semibold text-tm-accent-dark"}>{tb(a.severity === "red" ? TX.high : TX.watch, lang)}</span> · {tb(KIND[a.panel], lang)} · {formatDate(a.date, lang)} · {tb(a.message, lang)}
                  </li>
                ))}
              </ul>
              {act && (
                <button type="button" onClick={onAct} className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-tm-border bg-tm-surface px-2 py-1 text-xs font-semibold text-tm-black hover:border-tm-black print:hidden">
                  {tb(TX.decide, lang)} <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {checks.length > 0 && (
        <div className="mt-2 rounded-lg border border-tm-border">
          <button
            type="button"
            onClick={() => setShowChecks((v) => !v)}
            aria-expanded={showChecks}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-tm-text-light hover:text-tm-black"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-tm-primary" />
            <span className="flex-1">
              {lang === "es"
                ? `${checks.length} revisiones de rutina hoy (satélite, clima, precio, registros, comprador, El Niño)`
                : `${checks.length} routine checks today (satellite, weather, price, registry, buyer, El Niño)`}
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showChecks ? "rotate-180" : ""}`} />
          </button>
          {showChecks && (
            <ul className="divide-y divide-tm-border border-t border-tm-border">
              {[...checks].sort((x, y) => y.dataDate.localeCompare(x.dataDate)).map((c) => (
                <li key={c.id} className="grid gap-x-3 px-3 py-1.5 text-xs sm:grid-cols-[6rem_1fr_1fr]">
                  <span className="font-semibold text-tm-black">
                    {tb(KIND[c.source], lang)}
                    <span className="block font-normal text-tm-text-muted">{c.monthly ? formatMonth(c.dataDate, lang) : formatDate(c.dataDate, lang)}</span>
                  </span>
                  <span className="text-tm-text-light">{tb(c.reading, lang)}</span>
                  <span className="text-tm-black">{tb(c.forLoan, lang)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

interface Toast {
  id: string;
  alert: AlertLogEntry;
}

/**
 * Notifications for new TruMarket updates: when the replay reaches an update, or
 * on opening a live file with a recent one. Each closes itself after a few seconds.
 */
export function UpdateToasts({
  deal,
  sim,
  frame,
  lang,
  onOpen,
}: {
  deal: PreHarvestDeal;
  sim: CampaignSimulation;
  frame: TimelineFrame;
  lang: Lang;
  onOpen: () => void;
}) {
  const reduce = useReducedMotion();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastDate = useRef<string | null>(null);

  useEffect(() => {
    const prev = lastDate.current;
    lastDate.current = frame.date;
    let fresh: AlertLogEntry[];
    if (prev === null) {
      // On opening: the latest update, if it is recent (last three weeks) and the file is still open.
      const recent = sim.alerts.filter((a) => a.date <= frame.date && a.date > dateMinus(frame.date, 21));
      fresh = deal.status === "live" ? recent.slice(-1) : [];
    } else if (frame.date > prev) {
      fresh = sim.alerts.filter((a) => a.date > prev && a.date <= frame.date);
    } else {
      fresh = [];
    }
    if (!fresh.length) return;
    // Defer to the next tick: a notification is a reaction to the new week, not part of rendering it.
    const id = window.setTimeout(() => setToasts((t) => [...t, ...fresh.slice(-2).map((alert) => ({ id: `${key(alert)}:${Date.now()}`, alert }))].slice(-3)), 0);
    return () => window.clearTimeout(id);
  }, [frame.date, sim.alerts, deal.status]);

  useEffect(() => {
    if (!toasts.length) return;
    const id = window.setTimeout(() => setToasts((t) => t.slice(1)), 8000);
    return () => window.clearTimeout(id);
  }, [toasts]);

  const close = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[1000] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2 print:hidden" aria-live="polite">
      <AnimatePresence>
        {toasts.map(({ id, alert }) => {
          const impact = financialImpact(deal, sim, alert);
          return (
            <motion.div
              key={id}
              layout={!reduce}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className={`pointer-events-auto rounded-xl border bg-tm-surface p-3.5 shadow-tm-lg ${alert.severity === "red" ? "border-tm-danger/50" : "border-tm-accent/60"}`}
            >
              <div className="flex items-start gap-2.5">
                <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${alert.severity === "red" ? "bg-tm-danger/15 text-tm-danger-dark" : "bg-tm-accent/15 text-tm-accent-dark"}`}>
                  <Bell className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-tm-black">
                    {tb(updateTitle(alert), lang)} · <span className="font-normal text-tm-text-muted">{formatDate(alert.date, lang)}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-tm-black">{tb(alert.message, lang)}</p>
                  <p className="mt-1 text-sm text-tm-text-light">
                    <b className="font-semibold text-tm-black">{tb(TX.forLoan, lang)}:</b> {tb(impact.headline, lang)}
                    {impact.details[0] && ` · ${tb(impact.details[0], lang)}`}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      close(id);
                      onOpen();
                    }}
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-tm-black hover:underline"
                  >
                    {tb(TX.open, lang)} <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
                <button type="button" onClick={() => close(id)} className="text-tm-text-muted hover:text-tm-black" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function dateMinus(d: string, n: number): string {
  return new Date(Date.parse(`${d}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
}
