/**
 * The bank's pre-harvest loan book, laid out like a credit portfolio report:
 * summary, book position (committed vs out), cash calendar (money out and back by
 * month), watch list with action plans, applications, the campaign calendar across
 * the crop season, concentration and outside risks, and the map.
 */
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowRight, Printer } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { monitoringDataFor } from "../../data/pre-harvest";
import { WEATHER_THRESHOLDS as WT } from "../../lib/pre-harvest/config";
import { formatDate, formatMonth, formatUsd, tb } from "../../lib/pre-harvest/i18n";
import { addDays, ensoAt, ensoCategory, marketAt } from "../../lib/pre-harvest/monitoring";
import type { Bilingual, Lang } from "../../lib/pre-harvest/types";
import { fileStatusLabel } from "../../lib/pre-harvest/verdict";
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
  // Same reading as the file verdict, so the map, the watch list and the file agree.
  if (r.deal.status === "live") return r.view.mood === "act" ? C.red : r.view.mood === "watch" ? C.yellow : C.green;
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
        className: r.deal.status === "live" && r.view.mood !== "comfortable" ? "tm-map-pulse" : "",
      }).addTo(g);
      const div = document.createElement("div");
      div.className = "text-xs";
      div.innerHTML = `<p style="font-weight:600;font-size:13px;margin:0">${tb(r.deal.name, lang)}</p>
        <p style="margin:2px 0;color:#6b7280">${tb(r.deal.location, lang)} · ${tb(r.deal.campaign, lang)}</p>
        <p style="margin:4px 0 0"><b>${tb(fileStatusLabel(r.status, r.deal.status), lang)}</b> · ${formatUsd(r.money.exposureUsd, lang)} ${lang === "es" ? "desembolsado" : "out"}</p>
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

// ---------------------------------------------------------------------------
// Report building blocks: the layout of a bank credit report, not tiles.
// ---------------------------------------------------------------------------

function Section({ title, note, children, action }: { title: string; note?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="border-t border-tm-black/80 pt-3">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-tm-black">{title}</h3>
        {note && <p className="text-xs text-tm-text-light">{note}</p>}
        {action}
      </div>
      {children}
    </section>
  );
}

const th = "py-1.5 pr-4 text-left text-[11px] font-semibold uppercase tracking-wide text-tm-text-muted";
const thR = `${th} text-right`;
const td = "py-2 pr-4 align-top";
const tdR = `${td} whitespace-nowrap text-right tabular-nums`;

const borrower = (r: FileRow, lang: Lang) => tb(r.deal.name, lang).split(" · ")[0];
const valley = (r: FileRow, lang: Lang) => {
  const loc = tb(r.deal.location, lang);
  return loc.includes(",") ? loc.split(",").at(-1)!.trim() : loc;
};
const monthKey = (d: string) => d.slice(0, 7);
const nextMonthKey = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
};
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "–");

const MOOD_TEXT: Record<string, Bilingual> = {
  comfortable: L2("On track", "En curso"),
  watch: L2("Watch closely", "Vigilar de cerca"),
  act: L2("Act now", "Actuar ahora"),
  decide: L2("Decision needed", "Decisión pendiente"),
  settled: L2("Settled", "Cerrado"),
};
const MOOD_DOT: Record<string, string> = { comfortable: "bg-tm-primary", watch: "bg-tm-accent", act: "bg-tm-danger", decide: "bg-tm-black", settled: "bg-tm-neutral" };

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
  const es = lang === "es";
  const fmt = (n: number) => formatUsd(Math.round(n), lang);
  const fmtK = (n: number) => (Math.abs(n) >= 1000 ? `${n < 0 ? "−" : ""}${Math.round(Math.abs(n) / 1000)}k` : String(Math.round(n)));

  const live = rows.filter((r) => r.deal.status === "live");
  const apps = rows.filter((r) => r.deal.status === "application");
  const closed = rows.filter((r) => r.deal.status === "closed");
  const sum = (list: FileRow[], f: (r: FileRow) => number) => list.reduce((s, r) => s + f(r), 0);

  // Book position: committed vs out, the classic split in a credit report.
  const committed = sum(live, (r) => r.money.committedUsd);
  const out = sum(live, (r) => r.money.exposureUsd);
  const due = sum(live, (r) => r.money.amountDueUsd);
  const cushion = sum(live, (r) => r.view.cushionUsd ?? 0);
  const el = sum(live, (r) => r.money.moneyAtRiskUsd);
  const appAmount = sum(apps.filter((r) => r.decision), (r) => r.deal.envelopeUsd);
  const acting = live.filter((r) => r.view.mood === "act");
  const watching = live.filter((r) => r.view.mood === "watch");
  const alerts = rows.flatMap((r) => r.alerts);
  const high = alerts.filter((a) => a.trigger.severity === "red").length;

  // Cash calendar: tranches still to go out and repayments still to come back, by month.
  const flows = live.flatMap((r) => [
    ...r.frame.tranches
      .filter((t) => (t.status === "pending" || t.status === "held") && r.frame.action !== "stop")
      .map((t) => ({ month: monthKey(t.dueDate < dataAsOf ? dataAsOf : t.dueDate), out: t.amountUsd, back: 0, label: `${borrower(r, lang)} · ${es ? "tramo" : "tranche"} ${t.pct}%`, held: t.status === "held" || r.frame.action === "hold_tranche" })),
    ...(r.money.repaid ? [] : [{ month: monthKey(r.money.maturityDate), out: 0, back: r.money.amountDueUsd, label: `${borrower(r, lang)} · ${es ? "repago" : "repayment"}`, held: false }]),
  ]);
  const months: string[] = [];
  const last = flows.reduce((m, f) => (f.month > m ? f.month : m), monthKey(dataAsOf));
  for (let m = monthKey(dataAsOf); m <= last && months.length < 9; m = nextMonthKey(m)) months.push(m);
  let balance = out;
  const calendar = months.map((m) => {
    const fm = flows.filter((f) => f.month === m);
    const o = fm.reduce((s, f) => s + f.out, 0);
    const b = fm.reduce((s, f) => s + f.back, 0);
    // Principal back reduces what is out; interest is income on top.
    const principalBack = live.filter((r) => !r.money.repaid && monthKey(r.money.maturityDate) === m).reduce((s, r) => s + r.money.committedUsd, 0);
    balance = Math.max(0, balance + o - principalBack);
    return { m, label: formatMonth(m, lang), out: -o, back: b, balance, items: fm, held: fm.some((f) => f.held && f.out > 0) };
  });

  // Watch list: every open loan that is not on track, with its action and next date.
  const watch = live
    .filter((r) => r.view.mood === "act" || r.view.mood === "watch")
    .sort((a, b) => Number(b.view.mood === "act") - Number(a.view.mood === "act") || b.money.exposureUsd - a.money.exposureUsd);

  // Campaign calendar range.
  const camp = [...live, ...apps];
  const start = camp.reduce((m, r) => (r.deal.approvalDate < m ? r.deal.approvalDate : m), dataAsOf);
  const end = camp.reduce((m, r) => (r.money.maturityDate > m ? r.money.maturityDate : m), dataAsOf);
  const span = Math.max(1, Date.parse(end) - Date.parse(start));
  const pos = (d: string) => `${Math.max(0, Math.min(100, ((Date.parse(d) - Date.parse(start)) / span) * 100))}%`;
  const campMonths: string[] = [];
  for (let m = monthKey(start); m <= monthKey(end); m = nextMonthKey(m)) campMonths.push(m);

  // Concentration and outside drivers.
  const byValley = new Map<string, { out: number; committed: number; n: number }>();
  for (const r of live) {
    const k = valley(r, lang);
    const v = byValley.get(k) ?? { out: 0, committed: 0, n: 0 };
    byValley.set(k, { out: v.out + r.money.exposureUsd, committed: v.committed + r.money.committedUsd, n: v.n + 1 });
  }
  const climate = monitoringDataFor("ica-0188").climate;
  const enso = ensoAt(climate, dataAsOf);
  const ensoBefore = ensoAt(climate, addDays(dataAsOf, -91));
  const price = marketAt(rows[0]?.sim.series.market ?? [], dataAsOf);
  const weatherHit = live.filter((r) => r.frame.panels.weather.severity !== "green");
  const thinnest = live.filter((r) => r.view.maxDropPct !== null).sort((a, b) => a.view.maxDropPct! - b.view.maxDropPct!)[0];

  const toggle = (l: Layer) =>
    setLayers((s0) => {
      const n = new Set(s0);
      if (n.has(l)) n.delete(l);
      else n.add(l);
      return n;
    });
  const bookMood = acting.length ? "act" : watching.length ? "watch" : "comfortable";

  return (
    <div className="space-y-7">
      {/* Report header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-tm-primary-dark">BCP · {es ? "Banca agrícola" : "Agricultural banking"}</p>
          <h2 className="font-display text-[28px] leading-tight text-tm-black">{es ? "Cartera pre-cosecha" : "Pre-harvest loan book"}</h2>
          <p className="text-sm text-tm-text-light">
            {es ? "Posición al" : "Position at"} {formatDate(dataAsOf, lang)} · {es ? "preparado por TruMarket" : "prepared by TruMarket"}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-md border border-tm-border bg-tm-surface px-3 py-1.5 text-sm text-tm-black hover:border-tm-black">
            <Printer className="h-4 w-4" /> {es ? "Imprimir reporte" : "Print report"}
          </button>
        </div>
      </header>

      {/* Summary paragraph */}
      <div className="grid gap-4 border-y border-tm-border py-4 md:grid-cols-[auto_1fr]">
        <span className="inline-flex h-fit items-center gap-2 text-sm font-semibold text-tm-black">
          <span className={`h-2.5 w-2.5 rounded-full ${MOOD_DOT[bookMood]}`} />
          {tb(MOOD_TEXT[bookMood], lang)}
        </span>
        <p className="max-w-4xl text-[15px] leading-relaxed text-tm-black">
          {es ? (
            <>
              BCP tiene <b>{fmt(out)}</b> desembolsados de {fmt(committed)} comprometidos en {live.length} {live.length === 1 ? "préstamo vigente" : "préstamos vigentes"}. Se espera que las cosechas repaguen los {fmt(due)} adeudados con{" "}
              <b>{cushion >= 0 ? `${fmt(cushion)} de holgura` : `un faltante de ${fmt(-cushion)}`}</b>.
              {acting.length > 0 && ` ${acting.length} requiere${acting.length === 1 ? "" : "n"} acción hoy.`}
              {watching.length > 0 && ` ${watching.length} en vigilancia.`}
              {appAmount > 0 && ` ${apps.filter((r) => r.decision).length} solicitud(es) por ${fmt(appAmount)} esperan decisión.`}
            </>
          ) : (
            <>
              BCP has <b>{fmt(out)}</b> out of {fmt(committed)} committed across {live.length} open {live.length === 1 ? "loan" : "loans"}. The harvests are expected to repay the {fmt(due)} due with{" "}
              <b>{cushion >= 0 ? `${fmt(cushion)} to spare` : `a ${fmt(-cushion)} shortfall`}</b>.
              {acting.length > 0 && ` ${acting.length} ${acting.length === 1 ? "needs" : "need"} action today.`}
              {watching.length > 0 && ` ${watching.length} on watch.`}
              {appAmount > 0 && ` ${apps.filter((r) => r.decision).length} ${apps.filter((r) => r.decision).length === 1 ? "application" : "applications"} for ${fmt(appAmount)} ${apps.filter((r) => r.decision).length === 1 ? "awaits" : "await"} a decision.`}
            </>
          )}
        </p>
      </div>

      {/* 1. Book position */}
      <Section title={es ? "1 · Posición de la cartera" : "1 · Book position"} note={es ? "USD · comprometido frente a desembolsado" : "USD · committed against disbursed"}>
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-tm-border">
              <tr>
                <th className={th}></th>
                <th className={thR}>{es ? "Expedientes" : "Files"}</th>
                <th className={thR}>{es ? "Comprometido" : "Committed"}</th>
                <th className={thR}>{es ? "Desembolsado" : "Out"}</th>
                <th className={thR}>{es ? "Por desembolsar" : "Still to disburse"}</th>
                <th className={thR}>{es ? "Adeudado al vencimiento" : "Due at maturity"}</th>
                <th className={thR}>{es ? "Holgura esperada" : "Expected cushion"}</th>
                <th className={thR}>{es ? "Pérdida esperada" : "Expected loss"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tm-border">
              <tr>
                <td className={`${td} font-medium text-tm-black`}>{es ? "Préstamos vigentes" : "Open loans"}</td>
                <td className={tdR}>{live.length}</td>
                <td className={tdR}>{fmt(committed)}</td>
                <td className={`${tdR} font-semibold text-tm-black`}>{fmt(out)}</td>
                <td className={tdR}>{fmt(committed - out)}</td>
                <td className={tdR}>{fmt(due)}</td>
                <td className={`${tdR} ${cushion < 0 ? "text-tm-danger-dark" : "text-tm-primary-dark"} font-semibold`}>{fmt(cushion)}</td>
                <td className={tdR}>{fmt(el)}</td>
              </tr>
              <tr className="text-tm-text-light">
                <td className={td}>{es ? "Solicitudes en evaluación" : "Applications under review"}</td>
                <td className={tdR}>{apps.length}</td>
                <td className={tdR}>{fmt(sum(apps, (r) => r.deal.envelopeUsd))} <span className="text-[11px]">{es ? "solicitado" : "requested"}</span></td>
                <td className={tdR}>–</td>
                <td className={tdR}>–</td>
                <td className={tdR}>–</td>
                <td className={tdR}>–</td>
                <td className={tdR}>–</td>
              </tr>
              <tr className="text-tm-text-light">
                <td className={td}>{es ? "Campañas cerradas" : "Closed campaigns"}</td>
                <td className={tdR}>{closed.length}</td>
                <td className={tdR}>{fmt(sum(closed, (r) => r.deal.envelopeUsd))}</td>
                <td className={tdR}>{fmt(0)}</td>
                <td className={tdR}>–</td>
                <td className={tdR}>{es ? "repagado" : "repaid"} {fmt(sum(closed.filter((r) => r.money.repaid), (r) => r.money.amountDueUsd))}</td>
                <td className={tdR}>–</td>
                <td className={tdR}>–</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* 2. Cash calendar */}
      <Section
        title={es ? "2 · Calendario de caja" : "2 · Cash calendar"}
        note={es ? "Lo que sale del banco y lo que vuelve, por mes, con el saldo desembolsado" : "What leaves the bank and what comes back, by month, with the balance out"}
      >
        <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={calendar} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} stackOffset="sign">
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.axis }} axisLine={{ stroke: C.rule }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: C.axis }} tickFormatter={fmtK} axisLine={false} tickLine={false} width={44} />
                <ReferenceLine y={0} stroke={C.ink} />
                <Tooltip formatter={(v: number, n: string) => [fmt(Math.abs(v)), n]} />
                <Bar dataKey="out" name={es ? "Desembolsos" : "Money out"} fill={C.ink} radius={[0, 0, 2, 2]} maxBarSize={28} />
                <Bar dataKey="back" name={es ? "Repagos" : "Money back"} fill={C.green} radius={[2, 2, 0, 0]} maxBarSize={28} />
                <Line dataKey="balance" name={es ? "Saldo desembolsado" : "Balance out"} stroke={C.yellow} strokeWidth={2} dot={{ r: 2.5 }} type="stepAfter" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="border-b border-tm-border">
                <tr>
                  <th className={th}>{es ? "Mes" : "Month"}</th>
                  <th className={thR}>{es ? "Sale" : "Out"}</th>
                  <th className={thR}>{es ? "Vuelve" : "Back"}</th>
                  <th className={th}>{es ? "Movimientos" : "Movements"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tm-border">
                {calendar.map((c) => (
                  <tr key={c.m}>
                    <td className={`${td} whitespace-nowrap font-medium text-tm-black`}>{c.label}</td>
                    <td className={tdR}>{c.out ? fmt(-c.out) : "–"}</td>
                    <td className={`${tdR} ${c.back ? "text-tm-primary-dark" : ""}`}>{c.back ? fmt(c.back) : "–"}</td>
                    <td className={`${td} text-xs text-tm-text-light`}>
                      {c.items.length === 0
                        ? "–"
                        : c.items.map((f, i) => (
                            <span key={i} className="block">
                              {f.label}
                              {f.held && <b className="ml-1 font-semibold text-tm-accent-dark">· {es ? "retenido" : "on hold"}</b>}
                            </span>
                          ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* 3. Watch list */}
      <Section
        title={es ? "3 · Lista de vigilancia" : "3 · Watch list"}
        note={es ? `${watch.length} préstamo(s) · ${high} alerta(s) de riesgo alto` : `${watch.length} ${watch.length === 1 ? "loan" : "loans"} · ${high} high-risk ${high === 1 ? "alert" : "alerts"}`}
        action={
          <button type="button" onClick={onAlerts} className="inline-flex items-center gap-1 text-xs font-semibold text-tm-black hover:underline print:hidden">
            {es ? "Centro de alertas" : "Alert centre"} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        }
      >
        {watch.length === 0 ? (
          <p className="text-sm text-tm-text-light">{es ? "Ningún préstamo en vigilancia." : "No loan on the watch list."}</p>
        ) : (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-tm-border">
                <tr>
                  <th className={th}>{es ? "Deudor" : "Borrower"}</th>
                  <th className={thR}>{es ? "Desemb. / comprom." : "Out / committed"}</th>
                  <th className={th}>{es ? "Score aprob. → hoy" : "Rating approval → now"}</th>
                  <th className={th}>SBS</th>
                  <th className={th}>{es ? "Motivo" : "Why on watch"}</th>
                  <th className={th}>{es ? "Plan de acción" : "Action plan"}</th>
                  <th className={th}>{es ? "Próxima fecha" : "Next date"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tm-border">
                {watch.map((r) => {
                  const trig = r.alerts[0];
                  const next = r.decision?.dueDate ?? trig?.recheckBy ?? null;
                  return (
                    <tr key={r.deal.id} className="cursor-pointer hover:bg-tm-neutral-light" onClick={() => onOpen(r.deal.id)}>
                      <td className={td}>
                        <span className="flex items-center gap-2 font-medium text-tm-black">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${MOOD_DOT[r.view.mood]}`} />
                          {borrower(r, lang)}
                        </span>
                        <span className="block pl-4 text-xs text-tm-text-light">
                          Hass · {valley(r, lang)}
                        </span>
                      </td>
                      <td className={tdR}>
                        <span className="font-semibold text-tm-black">{fmt(r.money.exposureUsd)}</span>
                        <span className="block text-xs text-tm-text-light">/ {fmt(r.money.committedUsd)}</span>
                      </td>
                      <td className={`${td} tabular-nums`}>
                        {r.sim.origination.composite} {r.sim.origination.tier} → <b className={r.frame.composite < r.sim.origination.composite ? "text-tm-accent-dark" : "text-tm-black"}>{r.frame.composite} {r.frame.tier}</b>
                      </td>
                      <td className={td}>{r.deal.checks.credit.rating}</td>
                      <td className={`${td} max-w-[16rem] text-xs text-tm-black`}>{trig ? tb(trig.trigger.message, lang) : tb(MOOD_TEXT[r.view.mood], lang)}</td>
                      <td className={`${td} max-w-[16rem] text-xs text-tm-black`}>{tb(r.action, lang)}</td>
                      <td className={`${td} whitespace-nowrap text-xs`}>
                        {next ? formatDate(next, lang) : "–"}
                        {r.decision && <span className="block text-tm-text-light">{es ? "decisión de tramo" : "tranche decision"}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* 4. Applications */}
      <Section
        title={es ? "4 · Solicitudes" : "4 · Applications"}
        note={es ? "Lo que aprobar pondría en juego" : "What approving would put at stake"}
        action={
          <button type="button" onClick={onDecisions} className="inline-flex items-center gap-1 text-xs font-semibold text-tm-black hover:underline print:hidden">
            {es ? "Decisiones pendientes" : "Decisions due"} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        }
      >
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-tm-border">
              <tr>
                <th className={th}>{es ? "Solicitante" : "Applicant"}</th>
                <th className={thR}>{es ? "Monto · plazo" : "Amount · tenor"}</th>
                <th className={th}>Score</th>
                <th className={thR}>{es ? "Pérdida esperada" : "Expected loss"}</th>
                <th className={th}>{es ? "Opinión TruMarket" : "TruMarket view"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tm-border">
              {apps.map((r) => {
                const loss = Math.round(r.deal.envelopeUsd * (r.money.pdPct / 100) * (r.money.lgdPct / 100));
                const decline = r.status === "declined";
                return (
                  <tr key={r.deal.id} className="cursor-pointer hover:bg-tm-neutral-light" onClick={() => onOpen(r.deal.id)}>
                    <td className={td}>
                      <span className="font-medium text-tm-black">{borrower(r, lang)}</span>
                      <span className="block text-xs text-tm-text-light">Hass · {valley(r, lang)}</span>
                    </td>
                    <td className={tdR}>
                      {fmt(r.deal.envelopeUsd)}
                      <span className="block text-xs text-tm-text-light">
                        {r.deal.tenorDays} {es ? "días" : "days"}
                      </span>
                    </td>
                    <td className={`${td} tabular-nums`}>{r.sim.origination.tier === "VETO" ? "Veto" : `${r.sim.origination.composite} · ${r.sim.origination.tier}`}</td>
                    <td className={`${tdR} ${decline ? "text-tm-danger-dark" : ""}`}>{fmt(loss)}</td>
                    <td className={`${td} text-xs font-semibold ${decline ? "text-tm-danger-dark" : "text-tm-primary-dark"}`}>{tb(fileStatusLabel(r.status, r.deal.status), lang)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 5. Campaign calendar */}
      <Section title={es ? "5 · Calendario de campaña" : "5 · Campaign calendar"} note={es ? "Cada préstamo a lo largo de la temporada: tramos, cosecha y vencimiento" : "Each loan across the season: tranches, harvest and maturity"}>
        <div className="-mx-1 overflow-x-auto px-1">
          <div className="min-w-[720px]">
            <div className="relative ml-44 h-5 border-b border-tm-border text-[11px] text-tm-text-muted">
              {campMonths.map((m) => (
                <span key={m} className="absolute -translate-x-1/2" style={{ left: pos(`${m}-01`) }}>
                  {formatMonth(m, lang).split(" ")[0]}
                </span>
              ))}
            </div>
            <ul className="divide-y divide-tm-border">
              {camp.map((r) => (
                <li key={r.deal.id} className="flex items-center py-2">
                  <button type="button" onClick={() => onOpen(r.deal.id)} className="w-44 shrink-0 pr-3 text-left text-sm hover:underline">
                    <span className="font-medium text-tm-black">{borrower(r, lang)}</span>
                    <span className="block text-xs text-tm-text-light">{r.deal.status === "application" ? (es ? "solicitud" : "application") : fmt(r.money.exposureUsd) + (es ? " desemb." : " out")}</span>
                  </button>
                  <div className="relative h-6 flex-1">
                    <span
                      className={`absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full ${r.deal.status === "application" ? "bg-tm-border" : r.view.mood === "act" ? "bg-tm-danger/40" : r.view.mood === "watch" ? "bg-tm-accent/50" : "bg-tm-primary/40"}`}
                      style={{ left: pos(r.deal.approvalDate), width: `calc(${pos(r.money.maturityDate)} - ${pos(r.deal.approvalDate)})` }}
                    />
                    {r.frame.tranches.map((t) => (
                      <span
                        key={t.id}
                        title={`${es ? "Tramo" : "Tranche"} ${t.pct}% · ${fmt(t.amountUsd)} · ${formatDate(t.releasedOn ?? t.dueDate, lang)}`}
                        className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
                          t.status === "released" ? "border-tm-black bg-tm-black" : t.status === "held" || (r.frame.action === "hold_tranche" && t.status === "pending") ? "border-tm-accent bg-tm-surface" : "border-tm-text-muted bg-tm-surface"
                        }`}
                        style={{ left: pos(t.releasedOn ?? t.dueDate) }}
                      />
                    ))}
                    <span title={es ? "Cosecha · OC" : "Harvest · PO"} className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-tm-primary bg-tm-surface" style={{ left: pos(r.deal.m3Date) }} />
                    <span title={`${es ? "Vence" : "Due"} ${fmt(r.money.amountDueUsd)}`} className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-tm-black" style={{ left: pos(r.money.maturityDate) }} />
                    {/* Today, on every row so it reads as one vertical line. */}
                    <span className="absolute -bottom-2 -top-2 w-px bg-tm-danger" style={{ left: pos(dataAsOf) }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="ml-44 mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-tm-text-light">
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-tm-black" /> {es ? "tramo desembolsado" : "tranche paid out"}</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border-2 border-tm-text-muted" /> {es ? "tramo previsto" : "tranche planned"}</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border-2 border-tm-accent" /> {es ? "retenido" : "on hold"}</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rotate-45 border-2 border-tm-primary" /> {es ? "cosecha · OC" : "harvest · buyer PO"}</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-0.5 bg-tm-black" /> {es ? "vencimiento" : "maturity"}</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-px bg-tm-danger" /> {es ? "hoy" : "today"} · {formatDate(dataAsOf, lang)}</span>
            </p>
          </div>
        </div>
      </Section>

      {/* 6. Concentration and outside drivers */}
      <Section title={es ? "6 · Concentración y riesgos externos" : "6 · Concentration and outside risks"}>
        <div className="grid gap-6 lg:grid-cols-2">
          <table className="w-full text-sm">
            <thead className="border-b border-tm-border">
              <tr>
                <th className={th}>{es ? "Valle" : "Valley"}</th>
                <th className={thR}>{es ? "Préstamos" : "Loans"}</th>
                <th className={thR}>{es ? "Desembolsado" : "Out"}</th>
                <th className={thR}>{es ? "% de la cartera" : "% of book"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tm-border">
              {[...byValley.entries()].map(([k, v]) => (
                <tr key={k}>
                  <td className={td}>{k}</td>
                  <td className={tdR}>{v.n}</td>
                  <td className={tdR}>{fmt(v.out)}</td>
                  <td className={tdR}>{pct(v.out, out)}</td>
                </tr>
              ))}
              <tr className="text-tm-text-light">
                <td className={td} colSpan={3}>
                  {es ? "Cultivo: palta Hass" : "Crop: Hass avocado"}
                </td>
                <td className={`${tdR} font-semibold text-tm-accent-dark`}>100%</td>
              </tr>
            </tbody>
          </table>
          <table className="w-full text-sm">
            <thead className="border-b border-tm-border">
              <tr>
                <th className={th}>{es ? "Riesgo externo" : "Outside risk"}</th>
                <th className={th}>{es ? "Lectura" : "Reading"}</th>
                <th className={th}>{es ? "Qué significa para la cartera" : "What it means for the book"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tm-border">
              {enso && (
                <tr>
                  <td className={td}>{es ? "El Niño costero" : "Coastal El Niño"}</td>
                  <td className={`${td} tabular-nums ${enso.value >= WT.ensoRed ? "text-tm-danger-dark" : enso.value >= WT.ensoYellow ? "text-tm-accent-dark" : ""}`}>
                    {enso.value >= 0 ? "+" : ""}
                    {enso.value.toFixed(1)} °C
                    <span className="block text-xs text-tm-text-light">
                      {tb(ensoCategory(enso.value), lang)}
                      {ensoBefore && ` · ${enso.value - ensoBefore.value >= 0 ? "▲ +" : "▼ "}${(enso.value - ensoBefore.value).toFixed(1)} ${es ? "en 3 meses" : "in 3 months"}`} · {formatMonth(enso.month, lang)}
                    </span>
                  </td>
                  <td className={`${td} text-xs text-tm-black`}>
                    {weatherHit.length
                      ? es
                        ? `${weatherHit.length} préstamo(s) afectado(s), ${fmt(sum(weatherHit, (r) => r.money.exposureUsd))} desembolsados`
                        : `${weatherHit.length} ${weatherHit.length === 1 ? "loan" : "loans"} affected, ${fmt(sum(weatherHit, (r) => r.money.exposureUsd))} out`
                      : es
                        ? "Sin préstamos afectados"
                        : "No loan affected"}
                  </td>
                </tr>
              )}
              {price && (
                <tr>
                  <td className={td}>{es ? "Precio de exportación" : "Export price"}</td>
                  <td className={`${td} tabular-nums`}>
                    USD {price.usdPerKg.toFixed(2)}/kg
                    <span className="block text-xs text-tm-text-light">FOB · {formatMonth(price.month, lang)}</span>
                  </td>
                  <td className={`${td} text-xs text-tm-black`}>
                    {thinnest
                      ? es
                        ? `Puede caer ${thinnest.view.maxDropPct}% antes de que falte el repago del préstamo más ajustado (${borrower(thinnest, lang)})`
                        : `Can fall ${thinnest.view.maxDropPct}% before the tightest loan (${borrower(thinnest, lang)}) is short`
                      : "–"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 7. Where the money is */}
      <Section
        title={es ? "7 · Dónde está el dinero" : "7 · Where the money is"}
        action={
          <div className="flex flex-wrap gap-1.5 print:hidden">
            {LAYERS.map((l) => {
              const on = layers.has(l.id);
              const n = rows.filter((r) => r.deal.status === l.id).length;
              return (
                <button key={l.id} type="button" onClick={() => toggle(l.id)} aria-pressed={on} className={`rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-tm-black bg-tm-black text-white" : "border-tm-border text-tm-text-light"}`}>
                  {tb(l.label, lang)} · {n}
                </button>
              );
            })}
          </div>
        }
      >
        <div className="relative h-[380px] overflow-hidden rounded-lg border border-tm-border bg-tm-black">
          <PortfolioMap rows={rows} layers={layers} lang={lang} onOpen={(id) => onOpen(id)} />
        </div>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-tm-text-light">
          {[
            [C.red, es ? "Actuar" : "Act now"],
            [C.yellow, es ? "Vigilar" : "Watch"],
            [C.green, es ? "En curso" : "On track"],
            [C.blue, es ? "Solicitud" : "Application"],
            [C.muted, es ? "Cerrado / rechazo" : "Closed / declined"],
          ].map(([c, t]) => (
            <span key={t} className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
              {t}
            </span>
          ))}
        </p>
      </Section>

      <p className="border-t border-tm-border pt-3 text-[11px] text-tm-text-muted">
        {es
          ? "Fuentes: Sentinel-2 y NASA MODIS (cultivo), Open-Meteo ERA5 (clima), NOAA CPC (El Niño), Veritrade y UN Comtrade (precio), SUNAT, SUNARP, INFOCORP/SBS (deudor). Pérdida esperada = desembolsado × PD × LGD, indicativa."
          : "Sources: Sentinel-2 and NASA MODIS (crop), Open-Meteo ERA5 (weather), NOAA CPC (El Niño), Veritrade and UN Comtrade (price), SUNAT, SUNARP, INFOCORP/SBS (borrower). Expected loss = out × PD × LGD, indicative."}
      </p>
    </div>
  );
}
