/**
 * Technical history behind a file (spec: technical readings live only in the
 * evidence tabs). Each chart states its thresholds, today's value and its source;
 * opened from "Datos técnicos" or a condition row's "Ver serie".
 */
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { date, month } from "../../lib/bcp/calc";
import type { Loan } from "../../lib/bcp/types";
import { ENSO_CLASSES, SERIES_TEXT, ensoClass, type SeriesId, type TechSeries } from "../../data/bcp/technical";
import { useLang, useT } from "./shared";
import { Prov } from "./ui";

const INK = "#102a40";
const MUTED = "#4a5b6c";
const GRID = "#eef2f5";
const tick = { fontSize: 11, fill: MUTED };
const ts = (d: string) => Date.parse(`${d}T00:00:00Z`);

function Frame({ id, aria, children, today, extra }: { id: SeriesId; aria: string; children: React.ReactNode; today: string; extra?: React.ReactNode }) {
  const t = useT();
  const s = SERIES_TEXT[id];
  return (
    <figure className="rounded-lg border border-bcp-border p-3">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <figcaption className="text-[15px] font-bold">{t(s.title)}</figcaption>
          <p className="lbl">{t(s.sub)}</p>
        </div>
        <p className="num text-right text-sm">
          <span className="lbl block">{t("Hoy", "Today")}</span>
          <b>{today}</b>
        </p>
      </div>
      {extra}
      <div role="img" aria-label={aria} className="h-56 w-full">
        {children}
      </div>
      <p className="lbl mt-1 flex flex-wrap items-center gap-1.5">
        {id !== "clima" && <Prov p={id === "enso" ? "estimado" : id === "precio" ? "doc_verificado" : "satelital"} />}
        {t(s.source)}
      </p>
    </figure>
  );
}

function axisDates(from: string, to: string, lang: "es" | "en") {
  return { type: "number" as const, scale: "time" as const, domain: [ts(from), ts(to)] as [number, number], tickFormatter: (v: number) => date(new Date(v).toISOString().slice(0, 10), lang, false), tick, minTickGap: 28 };
}

export function TechChart({ id, s, loan, cutoff }: { id: SeriesId; s: TechSeries; loan: Loan; cutoff: string }) {
  const t = useT();
  const lang = useLang();
  const approval = <ReferenceLine x={ts(loan.approvalDate)} stroke={MUTED} strokeDasharray="2 3" label={{ value: t("aprobación", "approval"), position: "insideTopLeft", fontSize: 10, fill: MUTED }} />;
  const now = <ReferenceLine x={ts(cutoff)} stroke={INK} strokeDasharray="2 3" label={{ value: t("hoy", "today"), position: "insideTopRight", fontSize: 10, fill: INK }} />;

  if (id === "vigor") {
    const data = s.vigor.map((p) => ({ t: ts(p.date), v: p.v }));
    const last = s.vigor.at(-1)!.v;
    return (
      <Frame id={id} today={`${last > 0 ? "+" : ""}${last}%`} aria={t(`Vigor del cultivo: ${last}% frente a lo normal del lote. Ámbar bajo -15%, naranja bajo -30%.`, `Crop vigour: ${last}% against the lot's normal. Amber below -15%, orange below -30%.`)}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <ReferenceArea y1={-30} y2={-15} fill="#fbf1d9" />
            <ReferenceArea y1={-40} y2={-30} fill="#fde4d3" />
            <ReferenceLine y={0} stroke={MUTED} />
            <XAxis dataKey="t" {...axisDates(s.vigor[0].date, cutoff, lang)} />
            <YAxis domain={[-40, 20]} ticks={[-30, -15, 0, 15]} tickFormatter={(v: number) => `${v}%`} tick={tick} width={42} />
            {approval}
            {now}
            <Line dataKey="v" stroke={INK} strokeWidth={2} dot={{ r: 2.5, fill: INK }} isAnimationActive={false} />
            <Tooltip labelFormatter={(v: number) => date(new Date(v).toISOString().slice(0, 10), lang)} formatter={(v: number) => [`${v}%`, t("vs lo normal", "vs normal")]} />
          </ComposedChart>
        </ResponsiveContainer>
      </Frame>
    );
  }

  if (id === "agua") {
    const data = s.agua.map((p) => ({ t: ts(p.date), v: p.v }));
    const last = s.agua.at(-1)!.v;
    return (
      <Frame id={id} today={`${last}%`} aria={t(`Agua disponible: ${last}% de la necesidad del cultivo. Bajo 100% es alerta.`, `Water available: ${last}% of crop need. Below 100% is an alert.`)}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <ReferenceArea y1={80} y2={100} fill="#fbf1d9" />
            <XAxis dataKey="t" {...axisDates(s.agua[0].date, cutoff, lang)} />
            <YAxis domain={[80, 125]} ticks={[80, 100, 120]} tickFormatter={(v: number) => `${v}%`} tick={tick} width={42} />
            <ReferenceLine y={100} stroke="#d9a93b" strokeDasharray="5 4" label={{ value: t("100% de la necesidad", "100% of need"), position: "insideBottomLeft", fontSize: 10, fill: "#6e4a00" }} />
            {approval}
            {now}
            <Line dataKey="v" stroke={INK} strokeWidth={2} dot={{ r: 2.5, fill: INK }} isAnimationActive={false} />
            <Tooltip labelFormatter={(v: number) => date(new Date(v).toISOString().slice(0, 10), lang)} formatter={(v: number) => [`${v}%`, t("cubierto", "covered")]} />
          </ComposedChart>
        </ResponsiveContainer>
      </Frame>
    );
  }

  if (id === "enso") {
    const data = s.enso.map((p) => ({ t: ts(p.date), v: p.v }));
    const lastComplete = s.enso.at(-2)!;
    const bands = [
      [1.0, 1.7, "#fbf1d9"],
      [1.7, 3.0, "#fde4d3"],
      [3.0, 4.0, "#fbe0e3"],
    ] as const;
    return (
      <Frame
        id={id}
        today={`+${lastComplete.v.toFixed(1)} °C · ${t(ensoClass(lastComplete.v))}`}
        aria={t(`El Niño costero: +${lastComplete.v.toFixed(1)} °C en ${month(lastComplete.date, "es")}, ${ensoClass(lastComplete.v).es}.`, `Coastal El Niño: +${lastComplete.v.toFixed(1)} °C in ${month(lastComplete.date, "en")}, ${ensoClass(lastComplete.v).en}.`)}
        extra={
          <p className="lbl mb-1">
            {ENSO_CLASSES.filter((c) => Number.isFinite(c.min) && c.min >= 1)
              .map((c) => `${t(c.label)} ≥ ${c.min.toFixed(1)} °C`)
              .join(" · ")}
          </p>
        }
      >
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            {bands.map(([a, b, c]) => (
              <ReferenceArea key={a} y1={a} y2={b} fill={c} />
            ))}
            <XAxis dataKey="t" type="number" scale="time" domain={[data[0].t, data.at(-1)!.t]} tickFormatter={(v: number) => month(new Date(v).toISOString().slice(0, 10), lang)} tick={tick} minTickGap={24} />
            <YAxis domain={[-0.5, 4]} ticks={[0, 1, 1.7, 3]} tickFormatter={(v: number) => `${v}`} tick={tick} width={32} />
            {approval}
            <Line dataKey="v" stroke={INK} strokeWidth={2} dot={{ r: 3, fill: INK }} isAnimationActive={false} />
            <Tooltip labelFormatter={(v: number) => month(new Date(v).toISOString().slice(0, 10), lang)} formatter={(v: number) => [`+${v.toFixed(1)} °C · ${t(ensoClass(v))}`, "Niño 1+2"]} />
          </ComposedChart>
        </ResponsiveContainer>
      </Frame>
    );
  }

  if (id === "precio") {
    const data = s.precio.map((p) => ({ t: ts(p.date), v: p.v }));
    const a = s.precio[0].v;
    const last = s.precio.at(-1)!.v;
    return (
      <Frame id={id} today={`USD ${last.toFixed(2)}/kg`} aria={t(`Precio esperado a cosecha: USD ${last.toFixed(2)} por kg; aprobación USD ${a.toFixed(2)}. Ámbar a -15%, naranja a -30%.`, `Expected harvest price: USD ${last.toFixed(2)} per kg; approval USD ${a.toFixed(2)}. Amber at -15%, orange at -30%.`)}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <ReferenceArea y1={a * 0.7} y2={a * 0.85} fill="#fbf1d9" />
            <ReferenceArea y1={a * 0.6} y2={a * 0.7} fill="#fde4d3" />
            <XAxis dataKey="t" {...axisDates(loan.approvalDate, cutoff, lang)} />
            <YAxis domain={[Math.floor(a * 0.6 * 10) / 10, Math.ceil(a * 1.1 * 10) / 10]} tickFormatter={(v: number) => v.toFixed(2)} tick={tick} width={40} />
            <ReferenceLine y={a} stroke={MUTED} strokeDasharray="4 3" label={{ value: t("aprobación", "approval"), position: "insideTopRight", fontSize: 10, fill: MUTED }} />
            {now}
            <Line dataKey="v" stroke={INK} strokeWidth={2} dot={{ r: 3, fill: INK }} isAnimationActive={false} />
            <Tooltip labelFormatter={(v: number) => date(new Date(v).toISOString().slice(0, 10), lang)} formatter={(v: number) => [`USD ${v.toFixed(2)}/kg`, t("esperado", "expected")]} />
          </ComposedChart>
        </ResponsiveContainer>
      </Frame>
    );
  }

  // Weather: real daily history.
  const data = s.clima.map((p) => ({ t: ts(p.date), tmax: p.tmax, tmin: p.tmin, rain: p.rain }));
  const last = s.clima.at(-1)!;
  const hot = s.clima.filter((p) => p.date >= loan.approvalDate && p.tmax >= 33).length;
  return (
    <Frame
      id="clima"
      today={`${last.tmax.toFixed(1)} / ${last.tmin.toFixed(1)} °C`}
      aria={t(`Temperatura diaria desde ${date(s.clima[0].date, "es")}: hoy máxima ${last.tmax} °C, mínima ${last.tmin} °C; ${hot} días sobre 33 °C desde la aprobación.`, `Daily temperature since ${date(s.clima[0].date, "en")}: today max ${last.tmax} °C, min ${last.tmin} °C; ${hot} days above 33 °C since approval.`)}
      extra={<p className="lbl mb-1">{t(`${hot} días sobre 33 °C desde la aprobación · línea roja: 33 °C (estrés en floración)`, `${hot} days above 33 °C since approval · red line: 33 °C (flowering stress)`)}</p>}
    >
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="t" {...axisDates(s.clima[0].date, cutoff, lang)} />
          <YAxis yAxisId="t" domain={[5, 40]} ticks={[10, 20, 30, 33]} tickFormatter={(v: number) => `${v}°`} tick={tick} width={34} />
          <YAxis yAxisId="r" orientation="right" domain={[0, 20]} hide />
          <ReferenceLine yAxisId="t" y={33} stroke="#d63a4d" strokeDasharray="4 3" />
          <ReferenceLine yAxisId="t" x={ts(loan.approvalDate)} stroke={MUTED} strokeDasharray="2 3" />
          <Bar yAxisId="r" dataKey="rain" fill="#4ea4d9" isAnimationActive={false} />
          <Line yAxisId="t" dataKey="tmax" stroke="#d63a4d" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line yAxisId="t" dataKey="tmin" stroke="#4ea4d9" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Tooltip
            labelFormatter={(v: number) => date(new Date(v).toISOString().slice(0, 10), lang)}
            formatter={(v: number, n: string) => [n === "rain" ? `${v} mm` : `${v} °C`, n === "tmax" ? t("máxima", "max") : n === "tmin" ? t("mínima", "min") : t("lluvia", "rain")]}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Frame>
  );
}
