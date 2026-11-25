/**
 * The credit-analysis layer, on demand: what moved the score (by dimension,
 * with its weight) and the stress test of repayment coverage under price and
 * volume shocks. Every cell is labelled with its state in words.
 */
import { COVERAGE_BANDS, STRESS_PRICE, cov, scoreOf, stateFromCoverage, stressGrid, type HarvestInput } from "../../lib/bcp/calc";
import type { ScoreDim, State } from "../../lib/bcp/types";
import { STATE_TEXT, useT } from "./shared";
import { BANK_EDITION } from "./edition";
import { Lbl } from "./ui";

/** Bank edition: the score only: no dimensions, weights or points. */
function BankScore({ scores, single }: { scores: { approval: number; today: number }; single: boolean }) {
  const t = useT();
  return (
    <div>
      <h3 className="text-[16px] font-bold">{single ? t("Score a la solicitud", "Score at application") : t("Qué movió el score", "What moved the score")}</h3>
      <p className="num mt-1 text-[24px] font-bold">{single ? scores.today : `${scores.approval} → ${scores.today}`}</p>
    </div>
  );
}

export function ScoreBreakdown({ dims, scores, single = false }: { dims: ScoreDim[]; scores: { approval: number; today: number }; single?: boolean }) {
  const t = useT();
  if (BANK_EDITION) return <BankScore scores={scores} single={single} />;
  const a = scoreOf(dims, "approval");
  const b = scoreOf(dims, "today");
  return (
    <div>
      <h3 className="text-[16px] font-bold">{single ? t("Score a la solicitud", "Score at application") : t("Qué movió el score", "What moved the score")}</h3>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="border-b border-bcp-border">
            <Lbl as="th" className="py-1.5 text-left font-normal">{t("Dimensión", "Dimension")}</Lbl>
            <Lbl as="th" className="py-1.5 pl-3 text-right font-normal">{t("Peso", "Weight")}</Lbl>
            {!single && <Lbl as="th" className="py-1.5 pl-3 text-right font-normal">{t("Aprobación", "Approval")}</Lbl>}
            <Lbl as="th" className="py-1.5 pl-3 text-right font-normal">{single ? t("Puntos", "Points") : t("Hoy", "Today")}</Lbl>
            {!single && <Lbl as="th" className="py-1.5 pl-3 text-right font-normal">{t("Efecto", "Effect")}</Lbl>}
          </tr>
        </thead>
        <tbody className="divide-y divide-bcp-divider">
          {dims.map((d) => {
            const eff = Math.round(d.weight * (d.today - d.approval) * 10) / 10;
            return (
              <tr key={d.dim.es} className="align-top">
                <td className="py-2">
                  <span className="font-semibold">{t(d.dim)}</span>
                  {d.why && <span className="block text-xs text-bcp-muted">{t(d.why)}</span>}
                </td>
                <td className="py-2 pl-3 text-right">{Math.round(d.weight * 100)}%</td>
                {!single && <td className="py-2 pl-3 text-right text-bcp-muted">{d.approval}</td>}
                <td className="py-2 pl-3 text-right font-semibold">{d.today}</td>
                {!single && <td className={`py-2 text-right font-semibold ${eff < 0 ? "text-bcp-rojo-text" : eff > 0 ? "text-bcp-green-text" : "text-bcp-muted"}`}>{eff > 0 ? `+${eff}` : eff}</td>}
              </tr>
            );
          })}
          <tr className="border-t-2 border-bcp-ink font-bold">
            <td className="py-2">{t("Score", "Score")}</td>
            <td />
            {!single && <td className="py-2 pl-3 text-right">{a}</td>}
            <td className="py-2 pl-3 text-right">{b}</td>
            {!single && <td className="py-2 pl-3 text-right">{b - a > 0 ? `+${b - a}` : b - a}</td>}
          </tr>
        </tbody>
      </table>
      <p className="lbl mt-2">
        {t(
          "Puntos de 0 a 100 por dimensión. Motor de reglas determinista y versionado; el tier aprobado solo cambia con revisión humana registrada.",
          "Points from 0 to 100 per dimension. Deterministic, versioned rules engine; the approved tier only changes with a recorded human review.",
        )}
      </p>
    </div>
  );
}

const CELL: Record<string, string> = {
  verde: "bg-bcp-verde-bg text-bcp-green-text",
  ambar: "bg-bcp-ambar-bg text-bcp-ambar-text",
  naranja: "bg-bcp-naranja-bg text-bcp-naranja-text",
  rojo: "bg-bcp-rojo-bg text-bcp-rojo-text",
};

/**
 * Coverage under price and volume shocks, on net revenue. Cells are coloured by the
 * coverage band; the "today" cell also names the loan's state when a control sets it.
 */
export function StressGrid({ input, state }: { input: HarvestInput; state?: State }) {
  const t = useT();
  const grid = stressGrid(input);
  return (
    <div>
      <h3 className="text-[16px] font-bold">{t("Prueba de estrés de la cobertura", "Coverage stress test")}</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[440px] text-center text-sm">
          <thead>
            <tr>
              <Lbl as="th" className="py-1.5 text-left font-normal">{t("Volumen \\ Precio", "Volume \\ Price")}</Lbl>
              {STRESS_PRICE.map((p) => (
                <Lbl key={p} as="th" className="py-1.5 font-normal">
                  {p === 0 ? t("hoy", "today") : `${Math.round(p * 100)}%`}
                </Lbl>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row) => (
              <tr key={row.volume}>
                <td className="py-1 text-left text-xs text-bcp-muted">{row.volume === 0 ? t("volumen esperado", "expected volume") : `${Math.round(row.volume * 100)}%`}</td>
                {row.cells.map((c) => {
                  const s = stateFromCoverage(c.coverage);
                  const today = row.volume === 0 && c.price === 0;
                  // Today's cell: the band, labelled as such, and the loan's state when a control makes it worse.
                  const band = t(STATE_TEXT[s]);
                  const stateNote = today && state && state !== s && state !== "veto" ? `${t("expediente", "file")}: ${t(STATE_TEXT[state]).toLowerCase()}` : null;
                  return (
                    <td key={c.price} className="p-1">
                      <span className={`block rounded-md px-1 py-1.5 ${CELL[s]}`}>
                        <b className="num">{cov(c.coverage)}</b>
                        <span className="block font-[Arial,Helvetica,sans-serif] text-[11px]">{band}</span>
                        {stateNote && <span className="block font-[Arial,Helvetica,sans-serif] text-[11px] font-bold">{stateNote}</span>}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="lbl mt-2">
        {t(
          `Umbrales propuestos: ${cov(COVERAGE_BANDS.ambar)} riesgo medio, ${cov(COVERAGE_BANDS.naranja)} riesgo elevado, ${cov(COVERAGE_BANDS.rojo)} riesgo alto. Bajo 1.00x la cosecha no alcanza para el repago.`,
          `Proposed thresholds: ${cov(COVERAGE_BANDS.ambar)} medium risk, ${cov(COVERAGE_BANDS.naranja)} elevated risk, ${cov(COVERAGE_BANDS.rojo)} high risk. Below 1.00x the harvest does not cover repayment.`,
        )}
      </p>
    </div>
  );
}
