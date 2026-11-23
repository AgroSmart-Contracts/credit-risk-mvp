/** Bank edition of src/data/bcp/technical.ts: precomputed El Niño series and no locations. */
import type { Loan, Tx } from "../../lib/bcp/types";
import type { LoanGeo, SeriesId, TechSeries } from "../../data/bcp/technical";
import { bankData } from "../store";

export { ENSO_CLASSES, ensoClass } from "../../data/bcp/enso-classes";
export type { SeriesId, TechSeries };

const ENSO_TEXT = {
  title: { es: "El Niño costero", en: "Coastal El Niño" },
  sub: { es: "Índice costero de temperatura del mar, media de 3 meses, con las clases oficiales", en: "Coastal sea temperature index, 3-month mean, with the official classes" },
  source: { es: "Datos públicos de temperatura del mar", en: "Public sea temperature data" },
};
export const SERIES_TEXT = { vigor: ENSO_TEXT, agua: ENSO_TEXT, enso: ENSO_TEXT, precio: ENSO_TEXT, clima: ENSO_TEXT } as Record<SeriesId, { title: Tx; sub: Tx; source: Tx }>;
export const SERIES_OF_CONDITION: Record<string, SeriesId> = { "El Niño costero": "enso" };
export const GEO: Record<string, LoanGeo> = {};
export const technicalSeries = (loan: Loan, _cutoff: string): TechSeries => bankData().series[loan.id];
