/**
 * How a coverage figure is reached, step by step, so the bank can recompute it:
 * volume × exportable share × price, less costs per kg, ÷ amount due. Also the
 * standard stress side by side for two amounts due, and the driver bridge.
 */
import type { ReactNode } from "react";
import { COST_USD_KG, DRIVERS, DRIVER_TEXT, STANDARD_STRESS, cov, coverageUnder, harvestBuild, signedCov, stateFromCoverage, usd, type HarvestInput } from "../../lib/bcp/calc";
import type { Loan } from "../../lib/bcp/types";
import { BANK_EDITION } from "./edition";
import { useT } from "./shared";
import { Chip, Lbl } from "./ui";

const kg = (n: number) => `${Math.round(n).toLocaleString("en-US")} kg`;
const perKg = (n: number) => `USD ${n.toFixed(2)}/kg`;
const TONE: Record<string, string> = { verde: "text-bcp-green-text", ambar: "text-bcp-ambar-text", naranja: "text-bcp-naranja-text", rojo: "text-bcp-rojo-text" };
const toned = (c: number) => <b className={`num ${TONE[stateFromCoverage(c)]}`}>{cov(c)}</b>;

export function CoverageBuild({ input, areaHa, yieldTHa, title }: { input: HarvestInput; areaHa?: number; yieldTHa?: number; title?: string }) {
  const t = useT();
  const b = harvestBuild(input);
  // The bank edition rounds the area, so the build starts from the volume there.
  const fromArea = !BANK_EDITION && areaHa !== undefined && yieldTHa !== undefined;
  const rows: [string, string, boolean?][] = [
    ...(fromArea
      ? ([
          [t("Área medida", "Measured area"), `${areaHa!.toFixed(2)} ha`],
          [t("× Rendimiento esperado", "× Expected yield"), `${yieldTHa!.toFixed(2)} t/ha`],
        ] as [string, string][])
      : []),
    [fromArea ? t("= Volumen esperado", "= Expected volume") : t("Volumen esperado", "Expected volume"), kg(b.volumeKg)],
    [t("× Fruta exportable", "× Exportable fruit"), `${b.exportablePct}%`],
    [t("= Volumen exportable", "= Exportable volume"), kg(b.exportKg)],
    [t("× Precio esperado a cosecha (FOB)", "× Expected harvest price (FOB)"), perKg(b.priceUsdKg)],
    [t("= Ingreso bruto", "= Gross revenue"), usd(b.grossUsd)],
    [t(`− Packing, cosecha, transporte a puerto y comisiones (${perKg(COST_USD_KG)}, estimado)`, `− Packing, harvest, transport to port and fees (${perKg(COST_USD_KG)}, estimated)`), usd(b.costUsd)],
    [t("= Ingreso neto", "= Net revenue"), usd(b.netUsd), true],
    [t("÷ Saldo al vencimiento", "÷ Amount due at maturity"), usd(b.dueUsd)],
    [t("= Cobertura de repago", "= Repayment coverage"), cov(b.coverage), true],
  ];
  return (
    <div>
      <h3 className="text-[16px] font-bold">{title ?? t(`Cómo se llega a ${cov(b.coverage)}`, `How ${cov(b.coverage)} is reached`)}</h3>
      <table className="mt-2 w-full text-sm">
        <tbody className="divide-y divide-bcp-divider">
          {rows.map(([k, v, total]) => (
            <tr key={k} className={total ? "border-t-2 border-bcp-ink font-bold" : ""}>
              <td className="py-1.5 pr-3">{k}</td>
              <td className="num whitespace-nowrap py-1.5 text-right">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The standard stress for one or more amounts due (requested line vs the condition). */
export function StressCompare({ input, cols }: { input: HarvestInput; cols: { label: string; dueUsd: number }[] }) {
  const t = useT();
  const at = (due: number, price = 0, volume = 0) => coverageUnder(input, price, volume, due);
  const rows: [string, (due: number) => ReactNode][] = [
    [t("Saldo al vencimiento", "Amount due at maturity"), (d) => usd(d)],
    [t("Cobertura hoy", "Coverage today"), (d) => toned(at(d))],
    [t("Si el precio cae 20%", "If the price falls 20%"), (d) => toned(at(d, STANDARD_STRESS.price))],
    [t("Si el volumen cae 30%", "If the volume falls 30%"), (d) => toned(at(d, 0, STANDARD_STRESS.volume))],
    [t("Ambos a la vez (caso severo)", "Both at once (severe case)"), (d) => toned(at(d, STANDARD_STRESS.price, STANDARD_STRESS.volume))],
    [t("Precio de equilibrio", "Break-even price"), (d) => perKg(harvestBuild(input, {}, d).breakEvenUsdKg)],
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[360px] text-sm">
        <thead>
          <tr className="border-b border-bcp-border">
            <th />
            {cols.map((c) => (
              <Lbl key={c.label} as="th" className="py-1.5 pl-3 text-right font-normal">{c.label}</Lbl>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-bcp-divider">
          {rows.map(([k, f]) => (
            <tr key={k}>
              <td className="py-1.5 pr-3">{k}</td>
              {cols.map((c) => (
                <td key={c.label} className="num whitespace-nowrap py-1.5 pl-3 text-right">{f(c.dueUsd)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** What moved coverage since approval, by driver, with the driver behind the alert marked even at 0.00x. */
export function DriverBridge({ loan }: { loan: Loan }) {
  const t = useT();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-bcp-border text-left">
            {[t("Factor", "Driver"), t("En la cobertura de hoy", "In today's coverage"), t("Señal", "Signal")].map((h, i) => (
              <Lbl key={h} as="th" className={`py-1.5 pr-3 font-normal ${i === 1 ? "text-right" : ""}`}>{h}</Lbl>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-bcp-divider">
          {DRIVERS.map((d) => {
            const alert = loan.alert?.driver === d ? loan.alert : null;
            const v = loan.driverDeltas[d];
            return (
              <tr key={d} className={`align-top ${alert ? "bg-bcp-naranja-bg/50" : ""}`}>
                <td className="py-2 pr-3 font-semibold">{t(DRIVER_TEXT[d])}</td>
                <td className={`num whitespace-nowrap py-2 pr-3 text-right font-semibold ${v < 0 ? "text-bcp-rojo-text" : v > 0 ? "text-bcp-green-text" : "text-bcp-muted"}`}>{v === 0 ? "0.00x" : signedCov(v)}</td>
                <td className="py-2 pr-3">
                  {alert ? (
                    <>
                      <Chip tone="naranja">{t("Origen de la alerta", "Behind the alert")}</Chip> <span>{t(alert.text)}</span>
                      {alert.projected && <span className="lbl block">{t("Efecto proyectado", "Projected effect")}: {t(alert.projected)} · {t("estimado", "estimated")}</span>}
                    </>
                  ) : (
                    <span className="text-bcp-muted">{v === 0 ? t("sin cambio", "no change") : t("confirmado", "confirmed")}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-bcp-ink font-bold">
            <td className="py-2 pr-3">{t(`Aprobación ${cov(loan.coverageAtApproval)} → hoy`, `Approval ${cov(loan.coverageAtApproval)} → today`)}</td>
            <td className="num py-2 pr-3 text-right">{cov(loan.coverageToday)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
