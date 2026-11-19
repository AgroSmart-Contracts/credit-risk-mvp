/**
 * Continuous monitoring of an open file. TruMarket re-checks each source in turn
 * (satellite pass, weather, export price, counterparty, buyer cover, El Niño) on
 * the latest data and its expected path, and reports what it means for the loan.
 */
import { useEffect, useState } from "react";
import { WEATHER_THRESHOLDS as WT } from "../../lib/pre-harvest/config";
import { moneyPosition, signalMoney } from "../../lib/pre-harvest/finance";
import { ensoAt, ensoCategory, yieldAdjustment } from "../../lib/pre-harvest/monitoring";
import type { CampaignSimulation } from "../../lib/pre-harvest/timeline";
import type { Bilingual, PreHarvestDeal, TimelineFrame } from "../../lib/pre-harvest/types";

export type CheckSource = "satellite" | "weather" | "market" | "counterparty" | "buyer" | "enso";

export interface LiveCheck {
  id: number;
  at: number;
  source: CheckSource;
  /** Date of the data the check read (an image, a daily reading, a monthly price): never a fake clock time. */
  dataDate: string;
  /** Monthly sources (export price, El Niño) are labelled by month. */
  monthly?: boolean;
  label: Bilingual;
  reading: Bilingual;
  /** What the reading means for the loan. */
  forLoan: Bilingual;
}

const CHECK_LABEL: Record<CheckSource, Bilingual> = {
  satellite: { en: "Satellite pass", es: "Pase satelital" },
  weather: { en: "Weather station", es: "Estación meteorológica" },
  market: { en: "Export price", es: "Precio de exportación" },
  counterparty: { en: "Counterparty", es: "Contraparte" },
  buyer: { en: "Buyer cover", es: "Cobertura del comprador" },
  enso: { en: "El Niño", es: "El Niño" },
};

const ORDER: CheckSource[] = ["market", "satellite", "counterparty", "weather", "buyer", "enso"];


function buildCheck(n: number, at: number, deal: PreHarvestDeal, sim: CampaignSimulation, frame: TimelineFrame): LiveCheck {
  const source = ORDER[n % ORDER.length];
  const usd = (v: number, es = false) => `USD ${Math.round(v).toLocaleString(es ? "es-PE" : "en-US")}`;
  const base = { id: n, at, source, label: CHECK_LABEL[source], dataDate: frame.date };
  // Every check ends in money: what it does to the cushion (expected repayment − amount due).
  const m = moneyPosition(deal, sim, frame);
  const cushion = m.expectedRepaymentUsd === null ? null : m.expectedRepaymentUsd - m.amountDueUsd;
  const cushionText = (es = false) => (cushion === null ? "" : cushion >= 0 ? (es ? `${usd(cushion, true)} de holgura` : `${usd(cushion)} cushion`) : es ? `faltan ${usd(-cushion, true)}` : `${usd(-cushion)} short`);
  const sev = (v: number, y: number, r: number) => (v >= r ? "red" : v >= y ? "yellow" : "green") as "green" | "yellow" | "red";
  switch (source) {
    case "satellite": {
      const crop = sim.series.crop.filter((p) => p.date <= frame.date).at(-1);
      const ndvi = crop ? crop.ndvi : null;
      const y = Math.round(yieldAdjustment(sim.series.crop, frame.date) * 100);
      return {
        ...base,
        dataDate: crop?.date ?? frame.date,
        reading: ndvi === null
          ? { en: "No clear pass over the parcel yet", es: "Aún sin pase despejado sobre el predio" }
          : { en: `Canopy greenness ${ndvi.toFixed(2)} on the latest pass, ${crop!.pctVsMedian >= -5 ? "on" : "below"} its expected path`, es: `Verdor del follaje ${ndvi.toFixed(2)} en el último pase, ${crop!.pctVsMedian >= -5 ? "en" : "bajo"} su trayectoria esperada` },
        forLoan: cushion !== null
          ? { en: `Harvest ${y}% of declared: ${cushionText()}`, es: `Cosecha ${y}% de lo declarado: ${cushionText(true)}` }
          : { en: `Expected harvest ${y}% of declared volume`, es: `Cosecha esperada ${y}% del volumen declarado` },
      };
    }
    case "weather": {
      const w = sim.series.weather.filter((p) => p.date <= frame.date && p.tmax !== null).at(-1);
      const cov = w?.waterCoverage ?? null;
      return {
        ...base,
        dataDate: w?.date ?? frame.date,
        reading: w
          ? { en: `Max ${w.tmax!.toFixed(1)} °C · licensed water covers ${Math.round((cov ?? 1) * 100)}% of crop demand`, es: `Máx ${w.tmax!.toFixed(1)} °C · el agua licenciada cubre ${Math.round((cov ?? 1) * 100)}% de la demanda` }
          : { en: "Waiting for today's reading", es: "Esperando la lectura de hoy" },
        forLoan:
          cov !== null && cov < 1
            ? (signalMoney("water", cov < WT.waterCoverageRed ? "red" : "yellow", deal, sim, frame) ?? { en: "Water short of demand", es: "Agua por debajo de la demanda" })
            : { en: "No cost to the loan", es: "Sin costo para el préstamo" },
      };
    }
    case "market": {
      const price = frame.expectedHarvestPrice;
      const cov = frame.coverageRatio;
      const month = sim.series.market.filter((p) => p.month < frame.date.slice(0, 7)).at(-1)?.month;
      return {
        ...base,
        dataDate: month ? `${month}-01` : frame.date,
        monthly: Boolean(month),
        reading: price !== null
          ? { en: `Expected harvest price USD ${price.toFixed(2)}/kg FOB`, es: `Precio esperado en cosecha USD ${price.toFixed(2)}/kg FOB` }
          : { en: "No price this month yet", es: "Aún sin precio este mes" },
        forLoan: cov !== null
          ? (signalMoney("price", "green", deal, sim, frame) ?? { en: `Covers the amount due ${cov.toFixed(2)}×`, es: `Cubre lo adeudado ${cov.toFixed(2)}×` })
          : { en: "Coverage pending", es: "Cobertura pendiente" },
      };
    }
    case "counterparty": {
      const c = deal.checks;
      return {
        ...base,
        dataDate: deal.checksDate,
        reading: {
          en: `SUNAT RUC ${c.ruc.active ? "active" : "inactive"} · SBS rating ${c.credit.rating} · ${c.credit.protestedDebts} protested debts`,
          es: `RUC SUNAT ${c.ruc.active ? "activo" : "inactivo"} · calificación SBS ${c.credit.rating} · ${c.credit.protestedDebts} protestos`,
        },
        forLoan: c.credit.rating === "Normal"
          ? { en: "Counterparty risk unchanged", es: "Riesgo de contraparte sin cambios" }
          : { en: "Rating below Normal: review the borrower", es: "Calificación bajo Normal: revisar al deudor" },
      };
    }
    case "buyer": {
      const tk = sim.takeout;
      const status: Record<typeof tk.coface, Bilingual> = {
        approved: { en: "approved", es: "aprobada" },
        reduced: { en: "reduced", es: "reducida" },
        declined: { en: "declined", es: "rechazada" },
        pending: { en: "requested, decision pending", es: "solicitada, decisión pendiente" },
      };
      return {
        ...base,
        dataDate: tk.poSignedDate && tk.poSignedDate <= frame.date ? tk.poSignedDate : deal.checksDate,
        reading: { en: `Coface cover on the buyer (${tk.buyerCountry}) ${status[tk.coface].en}`, es: `Cobertura Coface del comprador (${tk.buyerCountry}) ${status[tk.coface].es}` },
        forLoan: tk.coface === "declined"
          ? { en: `The ${usd(m.amountDueUsd)} repayment is not insured`, es: `El repago de ${usd(m.amountDueUsd, true)} no está asegurado` }
          : { en: `Coface insures ${tk.cofaceCoveragePct}% of the buyer's payment that repays the ${usd(m.amountDueUsd)} due`, es: `Coface asegura ${tk.cofaceCoveragePct}% del pago del comprador que repaga los ${usd(m.amountDueUsd, true)}` },
      };
    }
    case "enso": {
      const e = ensoAt({ enso: sim.series.enso }, frame.date);
      return {
        ...base,
        dataDate: e ? `${e.month}-01` : frame.date,
        monthly: Boolean(e),
        reading: e
          ? { en: `Coastal El Niño ${e.value >= 0 ? "+" : ""}${e.value.toFixed(1)} °C, ${ensoCategory(e.value).en} (Niño 1+2, 3-month mean)`, es: `El Niño costero ${e.value >= 0 ? "+" : ""}${e.value.toFixed(1)} °C, ${ensoCategory(e.value).es} (Niño 1+2, media 3 meses)` }
          : { en: "No reading", es: "Sin lectura" },
        forLoan: e
          ? (signalMoney("enso", sev(e.value, WT.ensoYellow, WT.ensoRed), deal, sim, frame) ?? { en: "No cost to the loan", es: "Sin costo para el préstamo" })
          : { en: "No reading", es: "Sin lectura" },
      };
    }
  }
}

/**
 * The latest check on each source. On opening, TruMarket runs them one after the
 * other (about a second each), so the analyst sees the file being checked.
 */
export function useLiveChecks(enabled: boolean, deal: PreHarvestDeal, sim: CampaignSimulation, frame: TimelineFrame, everyMs = 900): { checks: LiveCheck[]; running: boolean } {
  const [n, setN] = useState(0);
  const [started] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled || n >= ORDER.length) return;
    const id = window.setTimeout(() => setN((k) => k + 1), everyMs);
    return () => window.clearTimeout(id);
  }, [enabled, everyMs, n]);
  if (!enabled) return { checks: [], running: false };
  const out: LiveCheck[] = [];
  for (let i = 0; i < n; i++) out.push(buildCheck(i, started + (i + 1) * everyMs, deal, sim, frame));
  return { checks: out.reverse(), running: n < ORDER.length };
}
