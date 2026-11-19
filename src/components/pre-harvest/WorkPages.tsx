/**
 * The analyst's queues: decisions due (tranches and approvals, by due date) and
 * the alert centre (TruMarket's alerts on open loans, with what to do and when
 * each is re-checked). Plus Method & sources, the model's documentation.
 */
import { useState } from "react";
import { ArrowRight, BellRing, Gavel } from "lucide-react";
import { CROP_THRESHOLDS as CT, MARKET_THRESHOLDS as MT, PD_BY_TIER, TRANCHES, WEATHER_THRESHOLDS as WT, WEIGHTS } from "../../lib/pre-harvest/config";
import { financialImpact } from "../../lib/pre-harvest/finance";
import { formatDate, formatUsd, tb } from "../../lib/pre-harvest/i18n";
import { PANEL_LABELS } from "../../lib/pre-harvest/timeline";
import type { Bilingual, Lang, PanelId } from "../../lib/pre-harvest/types";
import { FILE_STATUS_TEXT } from "../../lib/pre-harvest/verdict";
import { STATUS_STYLE } from "./file-style";
import type { FileRow } from "./portfolio";
import { Card, SectionTitle } from "./ui";

const L = (en: string, es: string): Bilingual => ({ en, es });

function Header({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h2 className="font-display text-2xl text-tm-black sm:text-[28px]">{title}</h2>
      <p className="mt-0.5 text-sm text-tm-text-light">{hint}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function DecisionsPage({ rows, lang, onOpen }: { rows: FileRow[]; lang: Lang; onOpen: (id: string) => void }) {
  const due = rows.filter((r) => r.decision).sort((a, b) => a.decision!.dueDate.localeCompare(b.decision!.dueDate));
  return (
    <div className="space-y-4">
      <Header
        title={lang === "es" ? "Decisiones pendientes" : "Decisions due"}
        hint={lang === "es" ? "Tramos y aprobaciones que esperan al analista, por fecha de vencimiento." : "Tranches and approvals waiting for the analyst, by due date."}
      />
      {due.length === 0 ? (
        <Card>
          <p className="text-sm text-tm-text-light">{lang === "es" ? "No hay decisiones pendientes." : "No decisions due."}</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {due.map((r) => {
            const d = r.decision!;
            const sev = r.worst;
            return (
              <li key={r.deal.id} className={`rounded-xl border border-l-[3px] border-tm-border bg-tm-surface p-4 ${sev === "red" ? "border-l-tm-danger" : sev === "yellow" ? "border-l-tm-accent" : "border-l-tm-black"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-tm-text-muted">
                      {d.kind === "approval" ? (lang === "es" ? "Aprobación" : "Approval") : `${lang === "es" ? "Tramo" : "Tranche"} ${d.tranche!.pct}% · ${tb(d.tranche!.label, lang)}`} · {lang === "es" ? "vence" : "due"}{" "}
                      {formatDate(d.dueDate, lang)}
                      <span className={d.daysLeft < 0 ? "text-tm-accent-dark" : ""}>
                        {" "}
                        ({d.daysLeft === 0 ? (lang === "es" ? "vence hoy" : "due today") : d.daysLeft < 0 ? `${Math.abs(d.daysLeft)} ${lang === "es" ? (d.daysLeft === -1 ? "día vencida" : "días vencida") : d.daysLeft === -1 ? "day overdue" : "days overdue"}` : `${d.daysLeft} ${lang === "es" ? (d.daysLeft === 1 ? "día" : "días") : d.daysLeft === 1 ? "day" : "days"}`})
                      </span>
                    </p>
                    <p className="mt-0.5 text-lg font-semibold text-tm-black">
                      {tb(r.deal.name, lang)} · {formatUsd(d.amountUsd, lang)}
                    </p>
                    <p className="text-sm text-tm-text-light">{tb(r.action, lang)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-sm font-semibold ${d.met === d.total ? "text-tm-primary-dark" : "text-tm-accent-dark"}`}>
                      {d.met} {lang === "es" ? "de" : "of"} {d.total} {lang === "es" ? "condiciones cumplidas" : "conditions met"}
                    </span>
                    <button type="button" onClick={() => onOpen(r.deal.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-tm-primary px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">
                      <Gavel className="h-4 w-4" /> {lang === "es" ? "Revisar y decidir" : "Review and decide"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function AlertsPage({ rows, lang, onOpen }: { rows: FileRow[]; lang: Lang; onOpen: (id: string, tab?: string) => void }) {
  const [tab, setTab] = useState<"active" | "history">("active");
  const [panel, setPanel] = useState<PanelId | "all">("all");
  const active = rows.flatMap((r) => r.alerts.map((a) => ({ ...a, row: r })));
  const history = rows
    .flatMap((r) => r.sim.alerts.map((a) => ({ a, row: r })))
    .sort((x, y) => y.a.date.localeCompare(x.a.date));
  const high = active.filter((a) => a.trigger.severity === "red").length;
  const watch = active.length - high;
  const panels: PanelId[] = ["crop", "weather", "market", "takeout"];
  const shown = active.filter((a) => panel === "all" || a.trigger.panel === panel);
  return (
    <div className="space-y-4">
      <Header
        title={lang === "es" ? "Centro de alertas" : "Alert centre"}
        hint={lang === "es" ? "Las alertas de TruMarket sobre los préstamos vigentes: qué pasó, qué hacer y cuándo se vuelve a revisar." : "TruMarket's alerts on open loans: what happened, what to do and when it is re-checked."}
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: L("Active", "Activas"), n: active.length, cls: "border-l-tm-black" },
          { label: L("High risk", "Riesgo alto"), n: high, cls: high ? "border-l-tm-danger bg-tm-danger/5" : "border-l-tm-border" },
          { label: L("Watch", "Vigilar"), n: watch, cls: watch ? "border-l-tm-accent" : "border-l-tm-border" },
          ...panels.slice(0, 3).map((p) => ({ label: PANEL_LABELS[p], n: active.filter((a) => a.trigger.panel === p).length, cls: "border-l-tm-border" })),
        ].map((t) => (
          <div key={t.label.en} className={`rounded-lg border border-l-[3px] border-tm-border bg-tm-surface px-3 py-2 ${t.cls}`}>
            <p className="text-[11px] text-tm-text-muted">{tb(t.label, lang)}</p>
            <p className="font-display text-xl text-tm-black">{t.n}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-tm-border">
        <div className="flex gap-1">
          {(
            [
              ["active", L("Active on open loans", "Activas en préstamos vigentes")],
              ["history", L("All TruMarket alerts", "Todas las alertas de TruMarket")],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === id ? "border-tm-black text-tm-black" : "border-transparent text-tm-text-light hover:text-tm-black"}`}>
              {tb(label, lang)}
            </button>
          ))}
        </div>
        {tab === "active" && (
          <select value={panel} onChange={(e) => setPanel(e.target.value as PanelId | "all")} className="mb-1 rounded-lg border border-tm-border bg-tm-surface px-2 py-1 text-sm">
            <option value="all">{lang === "es" ? "Todas las áreas" : "All areas"}</option>
            {panels.map((p) => (
              <option key={p} value={p}>
                {tb(PANEL_LABELS[p], lang)}
              </option>
            ))}
          </select>
        )}
      </div>
      {tab === "active" ? (
        shown.length === 0 ? (
          <Card>
            <p className="text-sm text-tm-text-light">{lang === "es" ? "Sin alertas activas." : "No active alerts."}</p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {shown.map((a, i) => {
              const red = a.trigger.severity === "red";
              const impact = financialImpact(a.row.deal, a.row.sim, { date: a.row.frame.date });
              return (
                <li key={i} className={`rounded-xl border border-l-[3px] border-tm-border p-4 ${red ? "border-l-tm-danger bg-tm-danger/5" : "border-l-tm-accent bg-tm-surface"}`}>
                  <p className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className={`rounded px-1.5 py-0.5 font-semibold text-white ${red ? "bg-tm-danger" : "bg-tm-accent"}`}>{red ? (lang === "es" ? "RIESGO ALTO" : "HIGH RISK") : lang === "es" ? "VIGILAR" : "WATCH"}</span>
                    <span className="rounded bg-tm-neutral px-1.5 py-0.5 font-medium text-tm-text-light">{tb(PANEL_LABELS[a.trigger.panel], lang)}</span>
                    <span className="text-tm-text-muted">
                      TruMarket · {formatDate(a.trigger.date, lang)} · {lang === "es" ? "revisar antes del" : "re-check by"} {formatDate(a.recheckBy, lang)}
                    </span>
                  </p>
                  <p className="mt-1.5 font-semibold text-tm-black">{tb(a.row.deal.name, lang)}</p>
                  <p className="text-sm text-tm-black">{tb(a.trigger.message, lang)}</p>
                  <p className="mt-1 text-sm text-tm-text-light">
                    <b className="text-tm-black">{lang === "es" ? "Para el préstamo" : "For the loan"}:</b> {tb(impact.headline, lang)}
                  </p>
                  <p className="text-sm text-tm-text-light">
                    <b className="text-tm-black">{lang === "es" ? "Qué hacer" : "What to do"}:</b> {tb(a.row.action, lang)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => onOpen(a.row.deal.id)} className="inline-flex items-center gap-1 rounded-lg bg-tm-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                      {lang === "es" ? "Abrir expediente" : "Open file"} <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => onOpen(a.row.deal.id, "monitoring")} className="rounded-lg border border-tm-border px-3 py-1.5 text-xs font-semibold text-tm-black hover:border-tm-black">
                      {lang === "es" ? "Ver el detalle" : "See the detail"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : (
        <Card>
          <ul className="divide-y divide-tm-border">
            {history.map(({ a, row }, i) => (
              <li key={i} className="flex flex-wrap items-start gap-3 py-2.5 text-sm">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.severity === "red" ? "bg-tm-danger" : "bg-tm-accent"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-tm-text-muted">
                    {formatDate(a.date, lang)} · {tb(PANEL_LABELS[a.panel], lang)} · {tb(row.deal.name, lang)}
                  </p>
                  <p className="text-tm-black">{tb(a.message, lang)}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[row.status].pill}`}>{tb(FILE_STATUS_TEXT[row.status], lang)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <p className="inline-flex items-center gap-1.5 text-xs text-tm-text-muted">
        <BellRing className="h-3.5 w-3.5" />
        {lang === "es"
          ? "Los avisos oficiales (SENAMHI, ENFEN, SENASA) se mostrarán aparte, sin mezclarlos con lo que calcula TruMarket, cuando se conecten esas fuentes."
          : "Official notices (SENAMHI, ENFEN, SENASA) will be shown separately, never mixed with what TruMarket computes, once those sources are connected."}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function MethodPage({ lang, dataAsOf }: { lang: Lang; dataAsOf: string }) {
  const es = lang === "es";
  const area = (k: keyof typeof WEIGHTS, title: Bilingual, how: Bilingual, data: string) => ({ k, title, how, data, w: Math.round(WEIGHTS[k] * 100) });
  const areas = [
    area("production", L("Production", "Producción"), L("Will the crop come in: satellite crop presence and vigour, orchard age, declared yield vs peers, water, El Niño outlook.", "¿Saldrá la cosecha?: presencia y vigor satelital, edad del huerto, rendimiento declarado vs pares, agua, pronóstico de El Niño."), "Sentinel-2 · MIDAGRI · ANA · NOAA"),
    area("operator", L("Operator", "Operador"), L("Can the grower execute and repay: credit bureau, revenue history, packhouse contract, land tenure, export record.", "¿Puede el productor ejecutar y pagar?: central de riesgos, historial de ingresos, contrato de empaque, tenencia, historial exportador."), "SBS · SUNARP · SUNAT · Veritrade"),
    area("structure", L("Structure", "Estructura"), L("Loan-to-value on campaign cost, tranches, insurance layers, assignment of the packhouse proceeds.", "Loan-to-value sobre el costo de campaña, tramos, capas de seguro, cesión de los pagos del empaque."), es ? "Expediente del banco" : "Bank file"),
    area("counterparty", L("Buyer", "Comprador"), L("Weighted at 0% until harvest: the buyer's purchase order and Coface cover take over at M3.", "Pondera 0% hasta la cosecha: la OC del comprador y la cobertura Coface toman el relevo en M3."), "Coface"),
  ];
  return (
    <div className="space-y-5">
      <Header
        title={es ? "Método y fuentes" : "Method & sources"}
        hint={es ? "Qué es el score y qué no es, cómo se calcula, qué umbrales usa y de dónde vienen los datos." : "What the score is and isn't, how it is computed, the thresholds it uses and where the data comes from."}
      />
      <Card>
        <SectionTitle title={es ? "Qué es y qué no es" : "What it is and isn't"} />
        <p className="text-sm text-tm-black">
          {es
            ? "El score de TruMarket resume, de 0 a 100 (mayor = más seguro), la probabilidad de que la cosecha financiada repague el préstamo. Apoya al comité de crédito; no lo reemplaza. Cada número del expediente muestra su fuente y la fecha del dato."
            : "TruMarket's score summarises, from 0 to 100 (higher = safer), how likely the financed harvest is to repay the loan. It supports the credit committee; it does not replace it. Every figure in a file shows its source and the date of its data."}
        </p>
      </Card>
      <Card>
        <SectionTitle title={es ? "Cómo se calcula" : "How it is computed"} hint={es ? "Cuatro áreas ponderadas; la suma ponderada da el score y el tier (A–D)." : "Four weighted areas; the weighted sum gives the score and the tier (A–D)."} />
        <ul className="divide-y divide-tm-border">
          {areas.map((a) => (
            <li key={a.k} className="grid gap-1 py-2.5 text-sm sm:grid-cols-[10rem_1fr_12rem]">
              <span className="font-semibold text-tm-black">
                {tb(a.title, lang)} · {a.w}%
              </span>
              <span className="text-tm-text-light">{tb(a.how, lang)}</span>
              <span className="text-xs text-tm-text-muted">{a.data}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-tm-text-light">
          {es ? "Probabilidad de incumplimiento por tier" : "Probability of default by tier"}: A {PD_BY_TIER.A * 100}% · B {PD_BY_TIER.B * 100}% · C {PD_BY_TIER.C * 100}% · D {PD_BY_TIER.D * 100}%.{" "}
          {es ? "Dinero en riesgo = exposición × PD × LGD." : "Money at risk = exposure × PD × LGD."}
        </p>
      </Card>
      <Card>
        <SectionTitle title={es ? "Umbrales y por qué" : "Thresholds and why"} />
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-tm-text-muted">
              <tr>
                <th className="py-1.5 pr-3">{es ? "Señal" : "Signal"}</th>
                <th className="py-1.5 pr-3">{es ? "Vigilar" : "Watch"}</th>
                <th className="py-1.5 pr-3">{es ? "Riesgo alto" : "High risk"}</th>
                <th className="py-1.5">{es ? "Por qué" : "Why"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tm-border">
              {[
                [es ? "Verdor (NDVI) vs norma del predio" : "Greenness (NDVI) vs the parcel's norm", `−${CT.yellowPctBelowMedian}%`, `−${CT.redPctBelowMedian}%`, es ? "Un follaje más débil anticipa menos fruta." : "A weaker canopy means less fruit."],
                [es ? "El Niño costero (Niño 1+2, 3 meses)" : "Coastal El Niño (Niño 1+2, 3 months)", `+${WT.ensoYellow} °C`, `+${WT.ensoRed} °C`, es ? "Mar cálido en floración reduce el cuajado." : "A warm sea at flowering cuts fruit set."],
                [es ? "Agua licenciada ÷ demanda" : "Licensed water ÷ demand", `< ${WT.waterCoverageYellow}×`, `< ${WT.waterCoverageRed}×`, es ? "Sin agua suficiente el huerto no llena la fruta." : "Without enough water the orchard can't fill the fruit."],
                [es ? "Ingreso de cosecha ÷ adeudado" : "Harvest revenue ÷ amount due", `< ${MT.coverageYellow}×`, `< ${MT.coverageRed}×`, es ? "Bajo 1,0× la cosecha no repaga capital + intereses." : "Below 1.0× the harvest doesn't repay principal + interest."],
              ].map((r) => (
                <tr key={r[0]}>
                  {r.map((c, i) => (
                    <td key={i} className={`py-2 pr-3 ${i === 0 ? "font-medium text-tm-black" : "text-tm-text-light"}`}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-tm-text-light">
          {es ? "Tramos" : "Tranches"}: {TRANCHES.map((t) => `${t.pct}%`).join(" · ")}. {es ? "Riesgo alto detiene los desembolsos hasta una revisión." : "High risk stops disbursements until a review."}
        </p>
      </Card>
      <Card>
        <SectionTitle title={es ? "Fuentes de datos" : "Data sources"} hint={`${es ? "Datos al" : "Data as of"} ${formatDate(dataAsOf, lang)}`} />
        <ul className="divide-y divide-tm-border text-sm">
          {[
            ["Sentinel-2 L2A (Copernicus, Earth Search)", es ? "Verdor del predio e imágenes, 10 m, cada ~5 días" : "Parcel greenness and images, 10 m, every ~5 days"],
            ["Open-Meteo ERA5", es ? "Temperatura, lluvia y evapotranspiración diarias" : "Daily temperature, rain and evapotranspiration"],
            ["NOAA CPC OISST", es ? "Índices Niño 1+2 y 3.4, mensual" : "Niño 1+2 and 3.4 indices, monthly"],
            ["Veritrade · UN Comtrade", es ? "Precios FOB de exportación de palta, mensual" : "Avocado FOB export prices, monthly"],
            ["SUNAT · SUNARP · SBS · ANA · SENASA", es ? "Registros a la fecha de revisión del expediente" : "Registries as of the file's check date"],
            ["Coface", es ? "Cobertura del comprador" : "Buyer cover"],
          ].map(([n, d]) => (
            <li key={n} className="flex flex-wrap justify-between gap-2 py-2">
              <span className="font-medium text-tm-black">{n}</span>
              <span className="text-tm-text-light">{d}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <SectionTitle title={es ? "Límites" : "Limits"} />
        <ul className="list-inside list-disc space-y-1 text-sm text-tm-text-light">
          <li>{es ? "El satélite no distingue la palta de otros frutales perennes (cítricos, mango): la visita de campo confirma la especie." : "The satellite can't tell avocado from other evergreen orchards (citrus, mango): the field visit confirms the species."}</li>
          <li>{es ? "Los precios de 2020-2023 se aproximan con importaciones de los países compradores." : "Prices for 2020–2023 are approximated from buyer-country import data."}</li>
          <li>{es ? "Las probabilidades de incumplimiento son indicativas hasta calibrarlas con la cartera del banco." : "Default probabilities are indicative until calibrated on the bank's own book."}</li>
        </ul>
      </Card>
    </div>
  );
}
