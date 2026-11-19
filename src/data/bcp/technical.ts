/**
 * The technical layer behind each example loan: where the parcel is, and the
 * history series a credit analyst can open from "Datos técnicos" or a condition
 * row ("Ver serie").
 *
 * - Temperature and rain are the real daily history for Ica (ERA5).
 * - Crop vigour, water, coastal El Niño and expected price are example series
 *   calibrated to the file: each starts at the condition's approval value and
 *   ends at its value today, so a chart never contradicts the table above it
 *   (see technical.test.ts).
 */
import climate from "../pre-harvest/climate-villacuri.json";
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
  labelSide?: "left" | "right";
}

export const GEO: Record<string, LoanGeo> = {
  "ICA-0188": { ...PARCELS["ica-0188"].site, ring: PARCELS["ica-0188"].ring, parcelId: "ica-0188", approximate: false, labelSide: "left" },
  "ICA-0142": { ...PARCELS["ica-0142"].site, ring: PARCELS["ica-0142"].ring, parcelId: "ica-0142", approximate: false },
  "ICA-0201": { lat: -14.186, lon: -75.713, ring: null, parcelId: null, approximate: true },
  "ICA-0215": { lat: -14.121, lon: -75.703, ring: null, parcelId: null, approximate: true },
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

export interface TechSeries {
  vigor: Pt[];
  agua: Pt[];
  enso: Pt[];
  precio: Pt[];
  clima: Array<{ date: string; tmax: number; tmin: number; rain: number }>;
}

const DAY = 86_400_000;
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const nextMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
};
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

/** ENFEN coastal El Niño classes on Niño 1+2 (°C): the scale the table's words come from. */
export const ENSO_CLASSES: Array<{ min: number; label: Tx }> = [
  { min: 3.0, label: L("Extraordinario", "Extraordinary") },
  { min: 1.7, label: L("Fuerte", "Strong") },
  { min: 1.0, label: L("Moderado", "Moderate") },
  { min: 0.4, label: L("Débil", "Weak") },
  { min: -Infinity, label: L("Neutro", "Neutral") },
];
export const ensoClass = (v: number) => ENSO_CLASSES.find((c) => v >= c.min)!.label;
/** Representative anomaly for a class word, to calibrate the example series. */
const ENSO_VALUE: Record<string, number> = { Neutro: 0.1, Débil: 0.7, Moderado: 1.3, Fuerte: 2.2, Extraordinario: 3.4 };

export function technicalSeries(loan: Loan, cutoff: string): TechSeries {
  const seed = seedOf(loan.id);
  const vig = cond(loan, "Vigor del cultivo vs lo normal del lote");
  const water = cond(loan, "Agua disponible vs necesidad");
  const enso = cond(loan, "El Niño costero");
  const price = cond(loan, "Precio esperado a cosecha");
  const sharp = num(vig.today.es) - num(vig.atApproval.es) < -10;

  // Coastal El Niño: monthly, from five months before approval to the cut-off month.
  const months: string[] = [];
  const first = addDays(loan.approvalDate, -150).slice(0, 7);
  for (let m = first; m <= cutoff.slice(0, 7); m = nextMonth(m)) months.push(m);
  const appMonth = loan.approvalDate.slice(0, 7);
  const eA = ENSO_VALUE[enso.atApproval.es];
  const eB = ENSO_VALUE[enso.today.es];
  // What was known at approval is the last complete month before it.
  const iA = Math.max(0, months.indexOf(appMonth) - 1);
  // The latest month counts is the last complete one (the class is a 3-month reading).
  const iB = months.length - 2;
  const ensoPts = months.map((m, i) => {
    let v: number;
    if (i <= iA) v = 0.2 + (eA - 0.2) * Math.pow(i / Math.max(1, iA), 1.3);
    else if (i <= iB) v = eA + (eB - eA) * ((i - iA) / Math.max(1, iB - iA));
    else v = eB + 0.15;
    if (i === iA) v = eA;
    if (i === iB) v = eB;
    return { date: `${m}-01`, v: Math.round(v * 100) / 100 };
  });

  // Expected harvest price: monthly from the approval month to the cut-off month.
  const pMonths: string[] = [];
  for (let m = appMonth; m <= cutoff.slice(0, 7); m = nextMonth(m)) pMonths.push(m);
  const pA = num(price.atApproval.es);
  const pB = num(price.today.es);
  const pricePts = pMonths.map((m, i) => ({
    date: i === 0 ? loan.approvalDate : i === pMonths.length - 1 ? cutoff : `${m}-01`,
    v: i === 0 ? pA : i === pMonths.length - 1 ? pB : Math.round((pA + ((pB - pA) * i) / (pMonths.length - 1) + wobble(i, seed, 0.02)) * 100) / 100,
  }));

  const from = addDays(loan.approvalDate, -30);
  const weather = (climate as { weather: Array<{ date: string; tmax: number | null; tmin: number | null; precip: number | null }> }).weather
    .filter((w) => w.date >= from && w.date <= cutoff && w.tmax !== null && w.tmin !== null)
    .map((w) => ({ date: w.date, tmax: w.tmax as number, tmin: w.tmin as number, rain: w.precip ?? 0 }));

  return {
    vigor: path(loan.approvalDate, cutoff, num(vig.atApproval.es), num(vig.today.es), seed, 1.2, sharp ? 6 : 1, 8),
    agua: path(loan.approvalDate, cutoff, num(water.atApproval.es), num(water.today.es), seed + 3, 1.5, 1, 4),
    enso: ensoPts,
    precio: pricePts,
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
    sub: L("Anomalía de temperatura del mar (Niño 1+2) y clases de ENFEN", "Sea temperature anomaly (Niño 1+2) and ENFEN classes"),
    source: L("Estimado · ENFEN · serie de ejemplo calibrada al expediente", "Estimated · ENFEN · example series calibrated to the file"),
  },
  precio: {
    title: L("Precio esperado a cosecha", "Expected harvest price"),
    sub: L("Precio FOB de exportación esperado para el mes de cosecha", "Expected export FOB price for the harvest month"),
    source: L("Doc. verificado · precios FOB de exportación · serie de ejemplo calibrada al expediente", "Verified doc. · export FOB prices · example series calibrated to the file"),
  },
  clima: {
    title: L("Temperatura y lluvia", "Temperature and rain"),
    sub: L("Máxima y mínima diaria y lluvia, desde un mes antes de la aprobación", "Daily maximum and minimum and rain, from a month before approval"),
    source: L("ERA5 · estación de referencia Ica · historia real", "ERA5 · Ica reference station · real history"),
  },
};
