/** Copy for the technical charts: no data and no model, so the bank edition can share it. */
import type { Tx } from "../../lib/bcp/types";

const L = (es: string, en: string): Tx => ({ es, en });

export type SeriesId = "vigor" | "agua" | "enso" | "precio" | "clima";

/** Which condition row opens which series. */
export const SERIES_OF_CONDITION: Record<string, SeriesId> = {
  "Vigor del cultivo frente a lo normal del lote": "vigor",
  "Agua disponible frente a la necesidad": "agua",
  "El Niño costero": "enso",
  "Precio esperado a cosecha": "precio",
};

export const SERIES_TEXT: Record<SeriesId, { title: Tx; sub: Tx; source: Tx }> = {
  vigor: {
    title: L("Vigor del cultivo frente a lo normal del lote", "Crop vigour vs the lot's normal"),
    sub: L("Diferencia semanal del índice de vigor frente a la mediana de 5 años del mismo lote", "Weekly vigour index difference against the lot's own 5-year median"),
    source: L("Satelital · Sentinel-2 · serie de ejemplo calibrada al expediente", "Satellite · Sentinel-2 · example series calibrated to the file"),
  },
  agua: {
    title: L("Agua disponible frente a la necesidad del cultivo", "Water available vs crop need"),
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
    source: L("ERA5 · punto de referencia en Ica · historia real", "ERA5 · Ica reference point · real history"),
  },
};
