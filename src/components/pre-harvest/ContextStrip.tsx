/**
 * The outside forces on this loan, in one line under the header: coastal El Niño,
 * the export price against its normal range, and water, then what they mean for
 * what each one does to the money. Each item opens a sheet with its explanation, source and history.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { WEATHER_THRESHOLDS as WT } from "../../lib/pre-harvest/config";
import { signalMoney } from "../../lib/pre-harvest/finance";
import { formatDate, formatMonth, tb } from "../../lib/pre-harvest/i18n";
import { addDays, ensoAt, ensoCategory, marketAt } from "../../lib/pre-harvest/monitoring";
import type { CampaignSimulation } from "../../lib/pre-harvest/timeline";
import type { Bilingual, Lang, PreHarvestDeal, Severity, TimelineFrame } from "../../lib/pre-harvest/types";
import { CHART_COLORS as C } from "./theme";

type ItemId = "enso" | "price" | "water";

interface Item {
  id: ItemId;
  label: Bilingual;
  value: string;
  qualifier: Bilingual;
  severity: Severity;
  dataDate: string;
  source: string;
  explain: Bilingual;
  series: Array<{ x: string; v: number }>;
  /** Monthly data is labelled by its month, not a day. */
  monthly: boolean;
  unit: string;
  lines: Array<{ y: number; severity: Exclude<Severity, "green"> }>;
}

const L = (en: string, es: string): Bilingual => ({ en, es });

function items(sim: CampaignSimulation, frame: TimelineFrame): Item[] {
  const out: Item[] = [];
  const climate = { enso: sim.series.enso };
  const e = ensoAt(climate, frame.date);
  if (e) {
    const before = ensoAt(climate, addDays(frame.date, -91));
    const trend = before ? e.value - before.value : 0;
    const arrow = trend > 0.05 ? "▲" : trend < -0.05 ? "▼" : "=";
    out.push({
      id: "enso",
      label: L("Coastal El Niño", "El Niño costero"),
      value: `${e.value >= 0 ? "+" : ""}${e.value.toFixed(1)} °C`,
      qualifier: {
        en: `${ensoCategory(e.value).en} ${arrow}${before ? ` ${trend >= 0 ? "+" : ""}${trend.toFixed(1)} in 3 months` : ""}`,
        es: `${ensoCategory(e.value).es} ${arrow}${before ? ` ${trend >= 0 ? "+" : ""}${trend.toFixed(1)} en 3 meses` : ""}`,
      },
      severity: e.value >= WT.ensoRed ? "red" : e.value >= WT.ensoYellow ? "yellow" : "green",
      dataDate: `${e.month}-01`,
      monthly: true,
      source: "NOAA CPC OISST · Niño 1+2, 3-month mean",
      explain: L(
        "Sea-surface temperature off Peru's coast against normal, averaged over the last three complete months (the basis of ENFEN's official ICEN index). A warm coast during flowering and fruit set cuts avocado yields: above +1.0 °C the file is on Watch, above +1.7 °C it is High risk.",
        "Temperatura del mar frente a la costa peruana respecto de lo normal, promedio de los tres últimos meses completos (base del índice oficial ICEN de ENFEN). Un mar cálido durante la floración y el cuajado reduce el rendimiento de la palta: sobre +1,0 °C el expediente pasa a Vigilar y sobre +1,7 °C a Riesgo alto.",
      ),
      series: sim.series.enso.filter((p) => p.month <= e.month).slice(-12).map((p) => ({ x: p.month, v: p.nino12 })),
      unit: "°C",
      lines: [
        { y: WT.ensoYellow, severity: "yellow" },
        { y: WT.ensoRed, severity: "red" },
      ],
    });
  }
  const p = marketAt(sim.series.market, frame.date);
  if (p) {
    const inBand = p.usdPerKg >= p.p25 && p.usdPerKg <= p.p75;
    out.push({
      id: "price",
      label: L("Export price", "Precio de exportación"),
      value: `USD ${p.usdPerKg.toFixed(2)}/kg`,
      qualifier: inBand
        ? L("in its normal range", "en su rango normal")
        : p.usdPerKg < p.p25
          ? L("below its normal range", "bajo su rango normal")
          : L("above its normal range", "sobre su rango normal"),
      severity: p.usdPerKg < p.p10 ? "red" : p.usdPerKg < p.p25 ? "yellow" : "green",
      dataDate: `${p.month}-01`,
      monthly: true,
      source: "Veritrade · UN Comtrade · HS 080440, FOB",
      explain: {
        en: `Hass avocado FOB price from Peru for ${formatMonth(p.month, "en")}, against the same month in previous years (normal range USD ${p.p25.toFixed(2)}–${p.p75.toFixed(2)}). The expected harvest price, and so the money the harvest brings to repay the loan, moves with it.`,
        es: `Precio FOB de la palta Hass de Perú en ${formatMonth(p.month, "es")}, frente al mismo mes de años anteriores (rango normal USD ${p.p25.toFixed(2)}–${p.p75.toFixed(2)}). El precio esperado en cosecha, y con él el dinero que la cosecha deja para repagar el préstamo, se mueve con este.`,
      },
      series: sim.series.market.filter((x) => x.month <= p.month).slice(-12).map((x) => ({ x: x.month, v: x.usdPerKg })),
      unit: "USD/kg",
      lines: [
        { y: p.p25, severity: "yellow" },
        { y: p.p10, severity: "red" },
      ],
    });
  }
  const w = sim.series.weather.filter((x) => x.date <= frame.date && x.waterCoverage !== null).at(-1);
  if (w && w.waterCoverage !== null) {
    out.push({
      id: "water",
      label: L("Water", "Agua"),
      value: `${Math.round(w.waterCoverage * 100)}%`,
      qualifier: w.waterCoverage >= 1 ? L("of crop demand covered", "de la demanda cubierta") : L("of crop demand: short", "de la demanda: insuficiente"),
      severity: w.waterCoverage < WT.waterCoverageRed ? "red" : w.waterCoverage < WT.waterCoverageYellow ? "yellow" : "green",
      dataDate: w.date,
      monthly: false,
      source: "ANA licence · Open-Meteo ERA5 evapotranspiration",
      explain: L(
        "The grower's licensed water against what the orchard needs today. Demand rises with heat (evapotranspiration), so a hot month can leave a valid licence short of what the trees need.",
        "El agua licenciada del productor frente a lo que el huerto necesita hoy. La demanda sube con el calor (evapotranspiración), así que un mes caluroso puede dejar corta una licencia vigente.",
      ),
      series: sim.series.weather
        .filter((x) => x.date <= frame.date && x.waterCoverage !== null)
        .filter((_, i, arr) => (arr.length - 1 - i) % 7 === 0)
        .slice(-16)
        .map((x) => ({ x: x.date, v: Math.round(x.waterCoverage! * 100) / 100 })),
      unit: "×",
      lines: [
        { y: WT.waterCoverageYellow, severity: "yellow" },
        { y: WT.waterCoverageRed, severity: "red" },
      ],
    });
  }
  return out;
}

const SEV_TEXT: Record<Severity, string> = {
  green: "text-tm-black",
  yellow: "text-tm-accent-dark",
  red: "text-tm-danger-dark",
};

function Sheet({ item, lang, onClose }: { item: Item; lang: Lang; onClose: () => void }) {
  const reduce = useReducedMotion();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <motion.div className="fixed inset-0 z-[1100] flex items-end justify-center bg-tm-black/30 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={tb(item.label, lang)}
        onClick={(e) => e.stopPropagation()}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-lg rounded-t-2xl bg-tm-surface p-5 shadow-tm-lg sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-tm-text-light">{tb(item.label, lang)}</p>
            <p className={`font-display text-3xl ${SEV_TEXT[item.severity]}`}>{item.value}</p>
            <p className="text-sm text-tm-text-light">{tb(item.qualifier, lang)}</p>
          </div>
          <button type="button" onClick={onClose} className="text-tm-text-muted hover:text-tm-black" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 h-36">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={item.series} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <XAxis dataKey="x" tick={{ fontSize: 10, fill: C.axis }} tickFormatter={(x: string) => (x.length > 7 ? x.slice(5) : x.slice(2))} />
              <YAxis tick={{ fontSize: 10, fill: C.axis }} domain={["auto", "auto"]} />
              <Tooltip formatter={(v: number) => `${v} ${item.unit}`} />
              {item.lines.map((l) => (
                <ReferenceLine key={l.y} y={l.y} stroke={l.severity === "red" ? C.red : C.yellow} strokeDasharray="3 3" />
              ))}
              <Line dataKey="v" stroke={C.ink} strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive animationDuration={500} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-sm text-tm-black">{tb(item.explain, lang)}</p>
        <p className="mt-3 text-[11px] text-tm-text-muted">
          {item.source} · {lang === "es" ? "dato de" : "data of"} {item.monthly ? formatMonth(item.dataDate, lang) : formatDate(item.dataDate, lang)}
        </p>
      </motion.div>
    </motion.div>
  );
}

export function ContextStrip({ deal, sim, frame, lang }: { deal: PreHarvestDeal; sim: CampaignSimulation; frame: TimelineFrame; lang: Lang }) {
  const [open, setOpen] = useState<ItemId | null>(null);
  const list = items(sim, frame);
  const worst = list.some((i) => i.severity === "red") ? "red" : list.some((i) => i.severity === "yellow") ? "yellow" : "green";
  const current = list.find((i) => i.id === open);
  return (
    <>
      <div
        className={`flex flex-col divide-y overflow-hidden rounded-xl border bg-tm-surface text-sm sm:flex-row sm:divide-x sm:divide-y-0 ${
          worst === "red" ? "border-tm-danger/40 divide-tm-danger/20" : worst === "yellow" ? "border-tm-accent/50 divide-tm-accent/20" : "border-tm-border divide-tm-border"
        }`}
      >
        {list.map((i) => {
          const money = signalMoney(i.id, i.severity, deal, sim, frame);
          return (
            <button key={i.id} type="button" onClick={() => setOpen(i.id)} className="group flex flex-1 items-start gap-2 px-4 py-2.5 text-left transition-colors hover:bg-tm-neutral-light">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${i.severity === "red" ? "bg-tm-danger" : i.severity === "yellow" ? "bg-tm-accent" : "bg-tm-primary"}`} />
              {/* Money first; the reading behind it is the small line (full chart on click). */}
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-tm-text-muted">{tb(i.label, lang)}</span>
                {money ? (
                  <span className="block text-sm font-medium leading-snug text-tm-black">{tb(money, lang)}</span>
                ) : null}
                <span className="mt-0.5 block text-xs text-tm-text-light">
                  <span className="tabular-nums">{i.value}</span> <span className={SEV_TEXT[i.severity]}>{tb(i.qualifier, lang)}</span>
                </span>
              </span>
              <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-tm-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          );
        })}
      </div>
      <AnimatePresence>{current && <Sheet item={current} lang={lang} onClose={() => setOpen(null)} />}</AnimatePresence>
    </>
  );
}
