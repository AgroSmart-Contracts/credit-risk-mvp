/**
 * Portfolio dashboard: the bank's whole pre-harvest book at a glance. El Niño and
 * price ticker, headline numbers, every financed parcel on a satellite map coloured
 * by status, and the alerts that need the analyst, filtered to Watch and above.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AlertTriangle, ArrowRight, Banknote, BellRing, Gavel, Info, ShieldAlert, X } from "lucide-react";
import { monitoringDataFor } from "../../data/pre-harvest";
import { WEATHER_THRESHOLDS as WT } from "../../lib/pre-harvest/config";
import { formatDate, formatMonth, formatUsd, tb } from "../../lib/pre-harvest/i18n";
import { addDays, ensoAt, ensoCategory, marketAt } from "../../lib/pre-harvest/monitoring";
import { PANEL_LABELS } from "../../lib/pre-harvest/timeline";
import type { Bilingual, Lang, Severity } from "../../lib/pre-harvest/types";
import { FILE_STATUS_TEXT } from "../../lib/pre-harvest/verdict";
import { AnimatedNumber, Rise } from "./motion";
import type { FileRow } from "./portfolio";
import { CHART_COLORS as C } from "./theme";

const IMAGERY = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const L2 = (en: string, es: string): Bilingual => ({ en, es });

type Layer = "live" | "application" | "closed";
const LAYERS: Array<{ id: Layer; label: Bilingual }> = [
  { id: "live", label: L2("Open loans", "Préstamos vigentes") },
  { id: "application", label: L2("Applications", "Solicitudes") },
  { id: "closed", label: L2("Closed campaigns", "Campañas cerradas") },
];

/** Map colour of a file: severity for open loans, neutral for everything else. */
function colorOf(r: FileRow): string {
  if (r.deal.status === "live") return r.worst === "red" ? C.red : r.worst === "yellow" ? C.yellow : C.green;
  if (r.status === "declined" || r.status === "stopped") return C.muted;
  return r.deal.status === "application" ? C.blue : "#ffffff";
}

function PortfolioMap({ rows, layers, lang, onOpen }: { rows: FileRow[]; layers: Set<Layer>; lang: Lang; onOpen: (id: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const group = useRef<L.LayerGroup | null>(null);
  // The popup button calls the latest handler without redrawing (and re-zooming) the map on every render.
  const openRef = useRef(onOpen);
  useEffect(() => {
    openRef.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { center: [-11.5, -77], zoom: 6, scrollWheelZoom: false, zoomControl: false });
    L.control.zoom({ position: "bottomright" }).addTo(m);
    L.tileLayer(IMAGERY, { maxZoom: 18, attribution: "Imagery © Esri, Maxar, Earthstar Geographics" }).addTo(m);
    group.current = L.layerGroup().addTo(m);
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const g = group.current;
    const m = map.current;
    if (!g || !m) return;
    g.clearLayers();
    const shown = rows.filter((r) => layers.has(r.deal.status));
    const bounds: L.LatLngExpression[] = [];
    for (const r of shown) {
      const color = colorOf(r);
      const ring = r.deal.parcel.map(([x, y]) => [y, x] as [number, number]);
      bounds.push(...ring);
      L.polygon(ring, { color, weight: 2, fillOpacity: 0.2 }).addTo(g);
      const marker = L.circleMarker([r.deal.lat, r.deal.lon], {
        radius: r.deal.status === "live" ? 9 : 7,
        color: "#ffffff",
        weight: 2,
        fillColor: color === "#ffffff" ? C.ink : color,
        fillOpacity: 1,
        className: r.deal.status === "live" && r.worst !== "green" ? "tm-map-pulse" : "",
      }).addTo(g);
      const div = document.createElement("div");
      div.className = "text-xs";
      div.innerHTML = `<p style="font-weight:600;font-size:13px;margin:0">${tb(r.deal.name, lang)}</p>
        <p style="margin:2px 0;color:#6b7280">${tb(r.deal.location, lang)} · ${tb(r.deal.campaign, lang)}</p>
        <p style="margin:4px 0 0"><b>${tb(FILE_STATUS_TEXT[r.status], lang)}</b> · ${formatUsd(r.money.exposureUsd, lang)} ${lang === "es" ? "desembolsado" : "out"}</p>
        <p style="margin:2px 0 6px;color:#374151">${tb(r.action, lang)}</p>`;
      const btn = document.createElement("button");
      btn.textContent = lang === "es" ? "Abrir expediente →" : "Open file →";
      btn.style.cssText = "font-weight:600;color:#102a40;text-decoration:underline";
      btn.onclick = () => openRef.current(r.deal.id);
      div.appendChild(btn);
      marker.bindPopup(div, { maxWidth: 260 });
      marker.bindTooltip(tb(r.deal.name, lang).split(" · ")[0], { direction: "top", offset: [0, -8] });
    }
    if (bounds.length) m.fitBounds(L.latLngBounds(bounds), { padding: [60, 60], maxZoom: 9 });
  }, [rows, layers, lang]);

  return <div ref={el} className="h-full w-full" />;
}

function Kpi({ icon, label, value, qualifier, tone = "neutral" }: { icon: React.ReactNode; label: string; value: React.ReactNode; qualifier?: string; tone?: "neutral" | "accent" | "danger" }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 text-tm-text-light">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[11px] text-tm-text-muted">{label}</span>
        <span className="block font-display text-xl leading-tight text-tm-black">{value}</span>
        {qualifier && <span className={`block text-xs font-semibold ${tone === "danger" ? "text-tm-danger-dark" : tone === "accent" ? "text-tm-accent-dark" : "text-tm-text-light"}`}>{qualifier}</span>}
      </span>
    </div>
  );
}

export function Dashboard({
  rows,
  dataAsOf,
  lang,
  onOpen,
  onDecisions,
  onAlerts,
}: {
  rows: FileRow[];
  dataAsOf: string;
  lang: Lang;
  onOpen: (id: string, tab?: string) => void;
  onDecisions: () => void;
  onAlerts: () => void;
}) {
  const [layers, setLayers] = useState<Set<Layer>>(() => new Set<Layer>(["live", "application", "closed"]));
  const [onlyWatch, setOnlyWatch] = useState(true);
  const [about, setAbout] = useState(false);

  const live = rows.filter((r) => r.deal.status === "live");
  const exposure = live.reduce((s, r) => s + r.money.exposureUsd, 0);
  const atRisk = live.reduce((s, r) => s + r.money.moneyAtRiskUsd, 0);
  const committed = live.reduce((s, r) => s + r.money.committedUsd, 0);
  const alerts = rows.flatMap((r) => r.alerts.map((a) => ({ ...a, row: r })));
  const high = alerts.filter((a) => a.trigger.severity === "red").length;
  const decisions = rows.filter((r) => r.decision);
  const watchFiles = live.filter((r) => r.worst !== "green").length;
  const overall: Severity = high ? "red" : alerts.length ? "yellow" : "green";

  // One El Niño value for the whole book (the 3-month mean), and the latest export price.
  const climate = monitoringDataFor("ica-0188").climate;
  const enso = ensoAt(climate, dataAsOf);
  const ensoBefore = ensoAt(climate, addDays(dataAsOf, -91));
  const market = rows[0]?.sim.series.market ?? [];
  const price = marketAt(market, dataAsOf);
  const affected = live.filter((r) => r.frame.panels.weather.severity !== "green").length;

  const shownAlerts = useMemo(
    () => alerts.filter((a) => !onlyWatch || a.trigger.severity === "red" || a.trigger.severity === "yellow").sort((a, b) => Number(b.trigger.severity === "red") - Number(a.trigger.severity === "red")),
    [alerts, onlyWatch],
  );
  const toggle = (l: Layer) => setLayers((s) => {
    const n = new Set(s);
    if (n.has(l)) n.delete(l);
    else n.add(l);
    return n;
  });
  const fmt = (n: number) => formatUsd(Math.round(n), lang);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-tm-black sm:text-[28px]">{lang === "es" ? "Cartera pre-cosecha" : "Pre-harvest book"}</h2>
          <p className="text-sm text-tm-text-light">
            {lang === "es" ? "Datos al" : "Data as of"} {formatDate(dataAsOf, lang)} · {lang === "es" ? "datos satelitales, climáticos y de mercado" : "satellite, weather and market data"}
          </p>
        </div>
        <button type="button" onClick={() => setAbout(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-tm-border bg-tm-surface px-3 py-1.5 text-sm text-tm-text-light hover:text-tm-black">
          <Info className="h-4 w-4" /> {lang === "es" ? "¿Qué muestra esta página?" : "About this page"}
        </button>
      </div>

      {/* Ticker: the outside force that moves the whole book, with its trend and what it touches. */}
      {enso && (
        <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-2.5 text-sm ${enso.value >= WT.ensoRed ? "border-tm-danger/40 bg-tm-danger/5" : enso.value >= WT.ensoYellow ? "border-tm-accent/50 bg-tm-accent/5" : "border-tm-border bg-tm-surface"}`}>
          <span className={`h-2 w-2 rounded-full ${enso.value >= WT.ensoRed ? "bg-tm-danger" : enso.value >= WT.ensoYellow ? "bg-tm-accent" : "bg-tm-primary"}`} />
          <span className="font-medium text-tm-black">{lang === "es" ? "El Niño costero" : "Coastal El Niño"}</span>
          <b className={enso.value >= WT.ensoRed ? "text-tm-danger-dark" : "text-tm-black"}>
            {enso.value >= 0 ? "+" : ""}
            {enso.value.toFixed(1)} °C {tb(ensoCategory(enso.value), lang)}
          </b>
          {ensoBefore && (
            <span className="text-tm-text-light">
              {enso.value - ensoBefore.value >= 0 ? "▲ +" : "▼ "}
              {(enso.value - ensoBefore.value).toFixed(1)} {lang === "es" ? "en 3 meses" : "in 3 months"}
            </span>
          )}
          <span className="text-tm-text-muted">· Niño 1+2 · {formatMonth(enso.month, lang)}</span>
          {price && (
            <span className="text-tm-text-light">
              │ {lang === "es" ? "Palta FOB" : "Avocado FOB"} <b className="text-tm-black">USD {price.usdPerKg.toFixed(2)}/kg</b> ({formatMonth(price.month, lang)})
            </span>
          )}
          <span className="ml-auto font-medium text-tm-black">
            {affected} {lang === "es" ? (affected === 1 ? "préstamo afectado" : "préstamos afectados") : affected === 1 ? "open loan affected" : "open loans affected"}
          </span>
        </div>
      )}

      <Rise>
        <div className="grid grid-cols-2 divide-tm-border overflow-hidden rounded-xl border border-tm-border bg-tm-surface sm:grid-cols-3 sm:divide-x xl:grid-cols-6">
          <Kpi icon={<BellRing className="h-5 w-5" />} label={lang === "es" ? "Alertas activas" : "Active alerts"} value={alerts.length} qualifier={high ? `${high} ${lang === "es" ? "riesgo alto" : "high risk"}` : undefined} tone={high ? "danger" : "neutral"} />
          <Kpi icon={<Gavel className="h-5 w-5" />} label={lang === "es" ? "Decisiones pendientes" : "Decisions due"} value={decisions.length} />
          <Kpi icon={<Banknote className="h-5 w-5" />} label={lang === "es" ? "Exposición" : "Exposure"} value={<AnimatedNumber value={exposure} format={fmt} />} qualifier={committed ? `${Math.round((exposure / committed) * 100)}% ${lang === "es" ? "de lo comprometido" : "of committed"}` : undefined} />
          <Kpi icon={<ShieldAlert className="h-5 w-5" />} label={lang === "es" ? "Dinero en riesgo" : "Money at risk"} value={<AnimatedNumber value={atRisk} format={fmt} />} />
          <Kpi icon={<AlertTriangle className="h-5 w-5" />} label={lang === "es" ? "Préstamos en vigilancia" : "Loans on watch"} value={watchFiles} qualifier={`/ ${live.length}`} tone={watchFiles ? "accent" : "neutral"} />
          <Kpi
            icon={<Info className="h-5 w-5" />}
            label={lang === "es" ? "Estado general" : "Overall status"}
            value={<span className={overall === "red" ? "text-tm-danger-dark" : overall === "yellow" ? "text-tm-accent-dark" : "text-tm-black"}>{overall === "red" ? (lang === "es" ? "Riesgo alto" : "High risk") : overall === "yellow" ? (lang === "es" ? "Vigilar" : "Watch") : "Normal"}</span>}
          />
        </div>
      </Rise>

      <div className="relative h-[560px] overflow-hidden rounded-xl border border-tm-border bg-tm-black">
        <PortfolioMap rows={rows} layers={layers} lang={lang} onOpen={(id) => onOpen(id)} />

        {/* Layers */}
        <div className="absolute left-3 top-3 z-[500] w-56 rounded-xl bg-tm-surface/95 p-3 shadow-tm-lg backdrop-blur">
          <p className="mb-2 text-xs font-semibold text-tm-black">{lang === "es" ? "Capas" : "Layers"}</p>
          <ul className="space-y-1">
            {LAYERS.map((l) => {
              const n = rows.filter((r) => r.deal.status === l.id).length;
              const on = layers.has(l.id);
              return (
                <li key={l.id}>
                  <button type="button" onClick={() => toggle(l.id)} aria-pressed={on} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${on ? "bg-tm-neutral text-tm-black" : "text-tm-text-muted"}`}>
                    <span className={`h-2.5 w-2.5 rounded-sm border ${on ? "border-tm-primary bg-tm-primary" : "border-tm-border"}`} />
                    <span className="flex-1">{tb(l.label, lang)}</span>
                    <span className="rounded-full bg-tm-surface px-1.5 text-[11px] font-semibold text-tm-text-light">{n}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Alerts panel */}
        <div className="absolute bottom-14 right-3 top-3 z-[500] hidden w-80 flex-col overflow-hidden rounded-xl bg-tm-surface/95 shadow-tm-lg backdrop-blur md:flex">
          <div className="flex items-center justify-between gap-2 border-b border-tm-border px-3 py-2">
            <p className="text-sm font-semibold text-tm-black">
              {lang === "es" ? "Alertas" : "Alerts"} ({shownAlerts.length})
            </p>
            <button type="button" onClick={onAlerts} className="text-xs font-medium text-tm-text-light hover:text-tm-black">
              {lang === "es" ? "Ver todas" : "See all"} →
            </button>
          </div>
          <div className="flex items-center gap-1.5 border-b border-tm-border px-3 py-1.5 text-xs">
            <span className="h-2 w-2 rounded-full bg-tm-accent" />
            <span className={onlyWatch ? "font-medium text-tm-black" : "text-tm-text-light"}>{lang === "es" ? "Solo Vigilar o más grave" : "Only Watch or more severe"}</span>
            <button type="button" onClick={() => setOnlyWatch(!onlyWatch)} className="ml-auto rounded-full px-2 py-0.5 font-medium text-tm-text-light hover:bg-tm-neutral hover:text-tm-black">
              {onlyWatch ? (lang === "es" ? "Mostrar todo" : "Show all") : lang === "es" ? "Filtrar" : "Filter"}
            </button>
          </div>
          <ul className="flex-1 space-y-2 overflow-y-auto p-2">
            {shownAlerts.length === 0 && <li className="px-2 py-3 text-sm text-tm-text-light">{lang === "es" ? "Sin alertas activas." : "No active alerts."}</li>}
            {shownAlerts.map((a, i) => (
              <li key={i} className={`rounded-lg border-l-[3px] bg-tm-surface p-2.5 text-sm shadow-tm-sm ${a.trigger.severity === "red" ? "border-l-tm-danger" : "border-l-tm-accent"}`}>
                <p className="flex flex-wrap items-center gap-1 text-[11px]">
                  <span className={`rounded px-1.5 py-0.5 font-semibold text-white ${a.trigger.severity === "red" ? "bg-tm-danger" : "bg-tm-accent"}`}>
                    {a.trigger.severity === "red" ? (lang === "es" ? "RIESGO ALTO" : "HIGH RISK") : lang === "es" ? "VIGILAR" : "WATCH"}
                  </span>
                  <span className="rounded bg-tm-neutral px-1.5 py-0.5 font-medium text-tm-text-light">{tb(PANEL_LABELS[a.trigger.panel], lang)}</span>
                </p>
                <p className="mt-1 font-medium text-tm-black">{tb(a.row.deal.name, lang).split(" · ")[0]}</p>
                <p className="text-xs text-tm-text-light">{tb(a.trigger.message, lang)}</p>
                <p className="mt-1 text-xs text-tm-black">
                  <b>{lang === "es" ? "Qué hacer" : "What to do"}:</b> {tb(a.row.action, lang)}
                </p>
                <p className="mt-1 flex items-center justify-between text-[11px] text-tm-text-muted">
                  <span>
                    {lang === "es" ? "Revisar antes del" : "Re-check by"} {formatDate(a.recheckBy, lang)}
                  </span>
                  <button type="button" onClick={() => onOpen(a.row.deal.id, "monitoring")} className="inline-flex items-center gap-0.5 font-semibold text-tm-black hover:underline">
                    {lang === "es" ? "Abrir" : "Open"} <ArrowRight className="h-3 w-3" />
                  </button>
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* Legend: one encoding for the whole map. */}
        <div className="absolute bottom-3 left-1/2 z-[500] flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full bg-tm-surface/95 px-4 py-1.5 text-xs shadow-tm-lg backdrop-blur">
          <span className="text-tm-text-light">{lang === "es" ? "Color = estado" : "Colour = status"}</span>
          {[
            [C.red, lang === "es" ? "Riesgo alto" : "High risk"],
            [C.yellow, lang === "es" ? "Vigilar" : "Watch"],
            [C.green, "Normal"],
            [C.blue, lang === "es" ? "Solicitud" : "Application"],
            [C.ink, lang === "es" ? "Cerrado" : "Closed"],
          ].map(([c, t]) => (
            <span key={t} className="inline-flex items-center gap-1 text-tm-black">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Where to go next */}
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={onDecisions} className="flex items-center justify-between rounded-xl border border-tm-border bg-tm-surface px-4 py-3 text-left hover:border-tm-black">
          <span>
            <span className="block font-medium text-tm-black">{lang === "es" ? "Decisiones pendientes" : "Decisions due"}</span>
            <span className="text-xs text-tm-text-light">
              {decisions.length} {lang === "es" ? "tramos o aprobaciones esperan al analista" : "tranches or approvals waiting for the analyst"}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-tm-text-muted" />
        </button>
        <button type="button" onClick={onAlerts} className="flex items-center justify-between rounded-xl border border-tm-border bg-tm-surface px-4 py-3 text-left hover:border-tm-black">
          <span>
            <span className="block font-medium text-tm-black">{lang === "es" ? "Centro de alertas" : "Alert centre"}</span>
            <span className="text-xs text-tm-text-light">
              {alerts.length} {lang === "es" ? "alertas de TruMarket en préstamos vigentes" : "TruMarket alerts on open loans"}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-tm-text-muted" />
        </button>
      </div>

      {about && (
        <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-tm-black/30 sm:items-center" onClick={() => setAbout(false)}>
          <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-t-2xl bg-tm-surface p-5 shadow-tm-lg sm:rounded-2xl">
            <div className="flex items-start justify-between">
              <h3 className="font-display text-lg text-tm-black">{lang === "es" ? "Qué muestra esta página" : "About this page"}</h3>
              <button type="button" onClick={() => setAbout(false)} aria-label="Close" className="text-tm-text-muted hover:text-tm-black">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-tm-black">
              {lang === "es"
                ? "Toda la cartera pre-cosecha del banco. Cada predio financiado aparece en el mapa con el color de su estado: los préstamos vigentes por su nivel de riesgo, las solicitudes en azul y las campañas cerradas en gris. A la derecha, las alertas de TruMarket que requieren al analista, con qué hacer y cuándo se vuelven a revisar."
                : "The bank's whole pre-harvest book. Every financed parcel is on the map in its status colour: open loans by risk level, applications in blue, closed campaigns in grey. On the right, TruMarket's alerts that need the analyst, with what to do and when they are re-checked."}
            </p>
            <p className="mt-2 text-sm text-tm-text-light">
              {lang === "es"
                ? "El Niño es la media de 3 meses del índice Niño 1+2 (NOAA CPC), la misma base del ICEN oficial de ENFEN. Dinero en riesgo = exposición × probabilidad de incumplimiento del tier × pérdida dado incumplimiento."
                : "El Niño is the 3-month mean of the Niño 1+2 index (NOAA CPC), the same basis as ENFEN's official ICEN. Money at risk = exposure × the tier's probability of default × loss given default."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
