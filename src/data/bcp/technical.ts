/**
 * The technical layer behind each example loan: where the parcel is, and the
 * history series a credit analyst can open from "Datos técnicos" or a condition
 * row ("Ver serie").
 *
 * Real history:
 * - Temperature and rain: daily ERA5 history for Ica.
 * - Coastal El Niño: NOAA's monthly Niño 1+2 anomaly as ENFEN's 3-month index (enso.ts);
 *   the file's El Niño words are read from the same data.
 * - Export prices: Hass avocado FOB by month from customs declarations (median and
 *   interquartile range). The file's expected harvest price is an estimate shown over it.
 * Example series: crop vigour and water, calibrated to the file (each starts at the
 * condition's approval value and ends at today's, see technical.test.ts).
 */
import climate from "../pre-harvest/climate-villacuri.json";
import real from "./market-real.json";
import { ensoSeries } from "./enso";
export { ENSO_CLASSES, ensoClass } from "./enso";
import { PARCELS } from "../../lib/pre-harvest/site";
import type { Loan, Tx } from "../../lib/bcp/types";

const L = (es: string, en: string): Tx => ({ es, en });

export interface LoanGeo {
  lat: number;
  lon: number;
  /** Surveyed outline [lon, lat], when the parcel is registered. */
  ring: Array<[number, number]> | null;
  /** Satellite image set, when available. */
  parcelId: string | null;
  /** True when the point is the zone, not a surveyed parcel. */
  approximate: boolean;
  /** Side of the map label, so neighbouring labels do not overlap. */
  labelSide?: "left" | "right" | "top" | "bottom";
}

export const GEO: Record<string, LoanGeo> = {
  "ICA-0188": { ...PARCELS["ica-0188"].site, ring: PARCELS["ica-0188"].ring, parcelId: "ica-0188", approximate: false },
  // Zone point only: the surveyed parcel near here was cleared in May 2026 and would contradict this example file.
  "ICA-0142": { lat: -13.915, lon: -75.87, ring: null, parcelId: null, approximate: true, labelSide: "left" },
  "ICA-0201": { lat: -14.186, lon: -75.713, ring: null, parcelId: null, approximate: true, labelSide: "left" },
  "ICA-0215": { lat: -14.121, lon: -75.703, ring: null, parcelId: null, approximate: true, labelSide: "top" },
  "PIS-0034": { lat: -13.694, lon: -76.031, ring: null, parcelId: null, approximate: true },
  // Applications
  "ICA-0177": { ...PARCELS["ica-0177"].site, ring: PARCELS["ica-0177"].ring, parcelId: "ica-0177", approximate: false },
  "ICA-0244": { lat: -14.352, lon: -75.668, ring: null, parcelId: null, approximate: true },
};

// ---------------------------------------------------------------------------
// Series
// ---------------------------------------------------------------------------

export type SeriesId = "vigor" | "agua" | "enso" | "precio" | "clima";

export interface Pt {
  date: string;
  v: number;
}

/** Real monthly export price: median and interquartile range, USD/kg FOB. */
export interface PricePt {
  date: string;
  p25: number;
  p50: number;
  p75: number;
  shipments: number;
}

export interface TechSeries {
  vigor: Pt[];
  agua: Pt[];
  /** Real coastal index by month, to the last complete month before the cut-off. */
  enso: Pt[];
  /** Real export prices by month, from a year before approval. */
  precio: PricePt[];
  /** The file's expected harvest price (estimate): at approval and today. */
  esperado: Pt[];
  clima: Array<{ date: string; tmax: number; tmin: number; rain: number }>;
}

const DAY = 86_400_000;
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
/** "+2%" → 2, "USD 1.94/kg" → 1.94, "104%" → 104. */
export const num = (s: string) => Number((s.match(/[-+]?\d+(?:\.\d+)?/) ?? ["NaN"])[0]);
/** Deterministic small wobble so series look like readings, never random between renders. */
const wobble = (i: number, seed: number, amp: number) => Math.round(Math.sin(i * 1.7 + seed) * Math.cos(i * 0.6 + seed * 0.3) * amp * 100) / 100;
const seedOf = (id: string) => [...id].reduce((s, c) => s + c.charCodeAt(0), 0) / 10;

/**
 * Weekly path from the approval value to today's value. `late` > 1 keeps the
 * series flat and moves it near the end (a recent change, as with vigour on
 * ICA-0188); 1 is a steady drift. First and last points are exact.
 */
function path(from: string, to: string, a: number, b: number, seed: number, amp: number, late = 1, preWeeks = 0): Pt[] {
  const dates: string[] = [];
  for (let d = addDays(from, -7 * preWeeks); d < to; d = addDays(d, 7)) dates.push(d);
  dates.push(to);
  const start = dates.indexOf(from) >= 0 ? dates.indexOf(from) : preWeeks;
  const n = dates.length - 1 - start;
  return dates.map((date, i) => {
    if (i === dates.length - 1) return { date, v: b };
    if (i === start) return { date, v: a };
    if (i < start) return { date, v: Math.round((a + wobble(i, seed, amp)) * 10) / 10 };
    const s = Math.pow((i - start) / n, late);
    return { date, v: Math.round((a + (b - a) * s + wobble(i, seed, amp)) * 10) / 10 };
  });
}

const cond = (loan: Loan, es: string) => loan.conditions.find((c) => c.label.es === es)!;

export function technicalSeries(loan: Loan, cutoff: string): TechSeries {
  const seed = seedOf(loan.id);
  const vig = cond(loan, "Vigor del cultivo vs lo normal del lote");
  const water = cond(loan, "Agua disponible vs necesidad");
  const price = cond(loan, "Precio esperado a cosecha");
  const sharp = num(vig.today.es) - num(vig.atApproval.es) < -10;

  // Coastal El Niño (real): from five months before approval to the last complete month.
  const ensoPts = ensoSeries(addDays(loan.approvalDate, -150), cutoff);

  // Export prices (real): monthly, from a year before approval to the latest month published.
  const yearBefore = addDays(loan.approvalDate, -365).slice(0, 7);
  const pricePts: PricePt[] = real.fob.months
    .filter((m) => m.month >= yearBefore && m.month <= cutoff.slice(0, 7))
    .map((m) => ({ date: `${m.month}-15`, p25: m.p25, p50: m.p50, p75: m.p75, shipments: m.shipments }));
  const esperado: Pt[] = [
    { date: loan.approvalDate, v: num(price.atApproval.es) },
    { date: cutoff, v: num(price.today.es) },
  ];

  const from = addDays(loan.approvalDate, -30);
  const weather = (climate as { weather: Array<{ date: string; tmax: number | null; tmin: number | null; precip: number | null }> }).weather
    .filter((w) => w.date >= from && w.date <= cutoff && w.tmax !== null && w.tmin !== null)
    .map((w) => ({ date: w.date, tmax: w.tmax as number, tmin: w.tmin as number, rain: w.precip ?? 0 }));

  return {
    vigor: path(loan.approvalDate, cutoff, num(vig.atApproval.es), num(vig.today.es), seed, 1.2, sharp ? 6 : 1, 8),
    agua: path(loan.approvalDate, cutoff, num(water.atApproval.es), num(water.today.es), seed + 3, 1.5, 1, 4),
    enso: ensoPts,
    precio: pricePts,
    esperado,
    clima: weather,
  };
}

/** Which condition row opens which series. */
export const SERIES_OF_CONDITION: Record<string, SeriesId> = {
  "Vigor del cultivo vs lo normal del lote": "vigor",
  "Agua disponible vs necesidad": "agua",
  "El Niño costero": "enso",
  "Precio esperado a cosecha": "precio",
};

export const SERIES_TEXT: Record<SeriesId, { title: Tx; sub: Tx; source: Tx }> = {
  vigor: {
    title: L("Vigor del cultivo vs lo normal del lote", "Crop vigour vs the lot's normal"),
    sub: L("Diferencia semanal del índice de vigor frente a la mediana de 5 años del mismo lote", "Weekly vigour index difference against the lot's own 5-year median"),
    source: L("Satelital · Sentinel-2 · serie de ejemplo calibrada al expediente", "Satellite · Sentinel-2 · example series calibrated to the file"),
  },
  agua: {
    title: L("Agua disponible vs necesidad del cultivo", "Water available vs crop need"),
    sub: L("Dotación de la licencia frente a la demanda del cultivo (evapotranspiración)", "Licensed allocation against crop demand (evapotranspiration)"),
    source: L("Satelital · ERA5 + licencia ANA · serie de ejemplo calibrada al expediente", "Satellite · ERA5 + ANA licence · example series calibrated to the file"),
  },
  enso: {
    title: L("El Niño costero", "Coastal El Niño"),
    sub: L("Índice costero: anomalía de temperatura del mar en Niño 1+2, media de 3 meses, con las clases de ENFEN", "Coastal index: Niño 1+2 sea temperature anomaly, 3-month mean, with ENFEN classes"),
    source: L("NOAA OISST · Niño 1+2 mensual · historia real", "NOAA OISST · monthly Niño 1+2 · real history"),
  },
  precio: {
    title: L("Precio de exportación y precio esperado a cosecha", "Export price and expected harvest price"),
    sub: L("Precio FOB real por mes (mediana y rango central de los embarques) y el precio esperado del expediente", "Real FOB price by month (median and middle range of shipments) and the file's expected price"),
    source: L("Declaraciones de exportación de palta Hass (aduanas) · historia real hasta ago 2026", "Hass avocado export declarations (customs) · real history to Aug 2026"),
  },
  clima: {
    title: L("Temperatura y lluvia", "Temperature and rain"),
    sub: L("Máxima y mínima diaria y lluvia, desde un mes antes de la aprobación", "Daily maximum and minimum and rain, from a month before approval"),
    source: L("ERA5 · estación de referencia Ica · historia real", "ERA5 · Ica reference station · real history"),
  },
};
