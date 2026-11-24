/**
 * Repayment coverage over time (spec 6.2.4): threshold zones (ámbar 1.30 to 1.50,
 * naranja below 1.30), the confirmed weekly line, today, and the estimated path to
 * maturity as a dashed median inside a band.
 */
import { Area, ComposedChart, Line, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cov, date, range, stateFromCoverage } from "../../lib/bcp/calc";
import type { Loan } from "../../lib/bcp/types";
import { STATE_TEXT, useLang, useT } from "./shared";

const INK = "#102a40";
/** Dark state colours, for values shown as text. */
const VALUE_COLOR = { verde: "#0b6b48", ambar: "#6e4a00", naranja: "#8a3a0b", rojo: "#9b1c2c" } as const;
const t2 = (d: string) => Date.parse(`${d}T00:00:00Z`);

export function CoverageChart({ loan, cutoff }: { loan: Loan; cutoff: string }) {
  const t = useT();
  const lang = useLang();
  const hist = loan.coverageHistory.map((p) => ({ t: t2(p.date), conf: p.value, note: p.note }));
  const today = hist.at(-1)!;
  const p = loan.projection;
  const mid = p ? Math.round(((p.low + p.high) / 2) * 100) / 100 : null;
  const valueColor = (v: number) => VALUE_COLOR[stateFromCoverage(v)];
  // Projection from today to maturity: the band widens from today's value to the range.
  const proj = p
    ? [
        { t: today.t, med: today.conf, band: [today.conf, today.conf] as [number, number] },
        { t: t2(loan.maturityDate), med: mid!, band: [p.low, p.high] as [number, number] },
      ]
    : [];
  const data = [...hist.map((h) => ({ ...h })), ...proj.slice(1)].map((d) => d) as Array<{ t: number; conf?: number; med?: number; band?: [number, number]; note?: unknown }>;
  // The last confirmed point also starts the projection.
  if (p) Object.assign(data[hist.length - 1], { med: today.conf, band: [today.conf, today.conf] });
  const firstDrop = hist.find((h, i) => i > 0 && h.conf < hist[i - 1].conf);
  const t3 = loan.tranches.find((x) => x.id === "T3");
  const ticks = [t2(loan.approvalDate), t2(cutoff), ...(t3 ? [t2(t3.milestoneDate)] : []), t2(loan.maturityDate)];
  const tickLabel = (v: number) => {
    const d = new Date(v).toISOString().slice(0, 10);
    const tag = v === t2(loan.approvalDate) ? "T1" : v === t2(cutoff) ? t("hoy", "today") : t3 && v === t2(t3.milestoneDate) ? "T3" : t("vence", "due");
    return `${date(d, lang, false)} · ${tag}`;
  };
  const yMax = Math.max(2.4, ...hist.map((h) => h.conf + 0.1));
  const yMin = p && p.low < 1 ? Math.floor(p.low * 10) / 10 : 1.0;
  const aria = t(
    `Cobertura de repago de ${cov(loan.coverageAtApproval)} al aprobar a ${cov(loan.coverageToday)} hoy${p ? `, proyección ${range(p.low, p.high, "es")} al vencimiento` : ""}. Umbral ámbar 1.50x, zona naranja bajo 1.30x, zona roja bajo 1.10x.`,
    `Repayment coverage from ${cov(loan.coverageAtApproval)} at approval to ${cov(loan.coverageToday)} today${p ? `, projection ${range(p.low, p.high, "en")} at maturity` : ""}. Amber threshold 1.50x, orange zone below 1.30x, red zone below 1.10x.`,
  );

  return (
    <div role="img" aria-label={aria} className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 16, right: 16, bottom: 4, left: 0 }}>
          <ReferenceArea y1={1.3} y2={1.5} fill="#fbf1d9" fillOpacity={1} ifOverflow="hidden" />
          <ReferenceArea y1={1.1} y2={1.3} fill="#fde4d3" fillOpacity={1} ifOverflow="hidden" />
          {/* Red below 1.10x; drawn only as far as the axis goes. */}
          <ReferenceArea y1={yMin} y2={1.1} fill="#fbe0e3" fillOpacity={1} ifOverflow="hidden" />
          <ReferenceLine y={1.5} stroke="#d9a93b" strokeDasharray="5 4" label={{ value: t("umbral ámbar", "amber threshold"), position: "insideTopLeft", fontSize: 11, fill: "#6e4a00" }} />
          <ReferenceLine y={1.3} stroke="#e0702a" strokeDasharray="5 4" label={{ value: t("zona naranja", "orange zone"), position: "insideBottomLeft", fontSize: 11, fill: "#8a3a0b" }} />
          <ReferenceLine y={1.1} stroke="#d63a4d" strokeDasharray="5 4" label={{ value: t("zona roja", "red zone"), position: "insideBottomLeft", fontSize: 11, fill: "#8a1c2b" }} />
          <XAxis dataKey="t" type="number" scale="time" domain={[t2(loan.approvalDate), t2(loan.maturityDate)]} ticks={ticks} tickFormatter={tickLabel} tick={{ fontSize: 11, fill: "#4a5b6c" }} />
          <YAxis domain={[yMin, yMax]} ticks={[0.9, 1.0, 1.1, 1.3, 1.5, 1.8, 2.1, 2.4].filter((v) => v >= yMin && v <= yMax)} tickFormatter={(v: number) => `${v.toFixed(1)}x`} tick={{ fontSize: 11, fill: "#4a5b6c" }} width={40} />
          <ReferenceLine x={t2(cutoff)} stroke={INK} strokeDasharray="2 3" />
          {p && <Area dataKey="band" stroke="none" fill="#0f9d6b" fillOpacity={0.15} isAnimationActive={false} connectNulls />}
          {p && <Line dataKey="med" stroke="#0f9d6b" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} connectNulls />}
          <Line dataKey="conf" stroke={INK} strokeWidth={2.5} dot={{ r: 3, fill: INK }} isAnimationActive={false} connectNulls={false} />
          {firstDrop?.note && (
            <ReferenceDot x={firstDrop.t} y={firstDrop.conf} r={0} label={{ value: t(firstDrop.note as { es: string; en: string }), position: "top", fontSize: 11, fill: INK }} />
          )}
          <ReferenceDot
            x={today.t}
            y={today.conf}
            r={6}
            fill={loan.state === "verde" ? "#0f9d6b" : loan.state === "ambar" ? "#d9a93b" : "#e0702a"}
            stroke="#fff"
            label={{ value: `${cov(today.conf)} ${t("hoy", "today")}${today.note ? ` · ${t(today.note as { es: string; en: string })}` : ""}`, position: "bottom", fontSize: 11, fontWeight: 700, fill: INK }}
          />
          {p && (
            <ReferenceDot x={t2(loan.maturityDate)} y={mid!} r={0} label={{ value: `${t("proyección", "projection")} ${range(p.low, p.high, lang)}`, position: "insideTopRight", fontSize: 11, fontWeight: 700, fill: valueColor(mid!) }} />
          )}
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const of = (k: string) => payload.find((x) => x.dataKey === k)?.value as number | [number, number] | undefined;
              const confirmed = of("conf") as number | undefined;
              const est = of("med") as number | undefined;
              const band = of("band") as [number, number] | undefined;
              return (
                <div className="rounded-md border border-bcp-border bg-white px-3 py-2 text-sm shadow-sm">
                  <p className="mb-1 font-semibold text-bcp-ink">{date(new Date(label as number).toISOString().slice(0, 10), lang)}</p>
                  {confirmed !== undefined ? (
                    <p className="text-bcp-ink">{t("confirmado", "confirmed")}: <b>{cov(confirmed)}</b></p>
                  ) : (
                    <>
                      {band && (
                        <p className="text-bcp-muted">
                          {t("rango", "range")}: <b style={{ color: valueColor(band[0]) }}>{cov(band[0])}</b> {t("a", "to")} <b style={{ color: valueColor(band[1]) }}>{cov(band[1])}</b>
                        </p>
                      )}
                      {est !== undefined && (
                        <p className="text-bcp-muted">
                          {t("estimado", "estimated")}: <b style={{ color: valueColor(est) }}>{cov(est)} · {STATE_TEXT[stateFromCoverage(est)][lang]}</b>
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
