import type { Bilingual, PanelId } from "../../lib/pre-harvest/types";

/**
 * Public events that touched the Chavimochic 2023-24 avocado campaign, found by
 * searching news and official sources for the parcel's area and dates. Each one is
 * dated and linked so the analyst can open the source. In production this search
 * runs per file with an AI research step; this is its stored result for VIR-0311.
 */
export interface ResearchFinding {
  date: string;
  panel: PanelId;
  source: string;
  url: string;
  /** Headline as published (Spanish). */
  headline: string;
  summary: Bilingual;
  /** What it means for this file. */
  relevance: Bilingual;
}

export const FINDINGS_VIR_0311: ResearchFinding[] = [
  {
    date: "2023-03-14",
    panel: "weather",
    source: "Gestión",
    url: "https://gestion.pe/economia/empresas/ciclon-yaku-la-libertad-trujillo-peru-chavimochic-agroexportadoras-agroexportadoras-de-la-libertad-sin-agua-por-rotura-de-canal-madre-de-chavimochic-noticia/",
    headline: "Agroexportadoras de La Libertad sin agua por rotura de canal madre de Chavimochic",
    summary: {
      en: "Cyclone Yaku broke the Chavimochic main canal at three points on 10 March. About 26,000 ha of export crops and 28,000 ha of small farms were left without irrigation; repairs were expected to take months.",
      es: "El ciclón Yaku rompió el canal madre de Chavimochic en tres puntos el 10 de marzo. Unas 26.000 ha de agroexportación y 28.000 ha de pequeños agricultores quedaron sin riego; la reparación tomaría meses.",
    },
    relevance: {
      en: "Six months before the application: the parcel's water source was interrupted during fruit sizing of the 2022-23 harvest. Explains the lower 2022-23 revenue declared in the application.",
      es: "Seis meses antes de la solicitud: la fuente de agua del predio se interrumpió durante el engorde de la cosecha 2022-23. Explica la menor venta 2022-23 declarada en la solicitud.",
    },
  },
  {
    date: "2023-03-16",
    panel: "weather",
    source: "Exitosa",
    url: "https://www.exitosanoticias.pe/actualidad/peru-pasa-estado-alerta-nino-costero-condiciones-calidas-mar-n95056",
    headline: "Perú pasa a estado de alerta de El Niño costero por condiciones cálidas del mar",
    summary: {
      en: "ENFEN, Peru's official El Niño committee, moved from watch to coastal El Niño alert.",
      es: "El ENFEN, comité oficial del Fenómeno El Niño, pasó de vigilancia a alerta de El Niño costero.",
    },
    relevance: {
      en: "The alert was still active on the approval date. Niño 1+2 averaged +3.05 °C over the three months before approval, which puts the weather panel in red from day one.",
      es: "La alerta seguía activa a la fecha de aprobación. Niño 1+2 promedió +3,05 °C en los tres meses previos, lo que pone el panel de clima en rojo desde el primer día.",
    },
  },
  {
    date: "2023-07-12",
    panel: "weather",
    source: "La República",
    url: "https://larepublica.pe/sociedad/2023/07/12/la-libertad-protegeran-canal-madre-de-chavimochic-fenomeno-el-nino-trujillo-1146084",
    headline: "La Libertad: protegerán canal madre de Chavimochic ante fenómeno El Niño",
    summary: {
      en: "The Chavimochic project announced works to protect the main canal at five ravines in Virú ahead of the expected El Niño rains.",
      es: "El proyecto Chavimochic anunció obras para proteger el canal madre en cinco quebradas de Virú ante las lluvias esperadas por El Niño.",
    },
    relevance: {
      en: "Irrigation was back, but the same canal remained exposed for the 2023-24 campaign: a second break would cut water during flowering and fruit set.",
      es: "El riego se había restablecido, pero el mismo canal seguía expuesto para la campaña 2023-24: una nueva rotura cortaría el agua en floración y cuajado.",
    },
  },
  {
    date: "2023-10-16",
    panel: "crop",
    source: "Agraria.pe",
    url: "https://agraria.pe/noticias/cosechas-disminuyen-hasta-un-75-en-chavimochic-y-miles-se-qu-33527",
    headline: "Cosechas disminuyen hasta un 75% en Chavimochic y miles se quedarían sin empleos",
    summary: {
      en: "Growers in Chavimochic reported harvest drops from the warm sea and the water deficit: avocado about −20%, blueberry more than −50%, mango up to −75%.",
      es: "Productores de Chavimochic reportaron caídas de cosecha por el mar cálido y el déficit hídrico: palta cerca de −20%, arándano más de −50%, mango hasta −75%.",
    },
    relevance: {
      en: "One month after approval: an independent estimate of the yield loss for the declared crop in this valley. Supports cutting expected volume by about 20%.",
      es: "Un mes después de la aprobación: estimación independiente de la pérdida de rendimiento del cultivo declarado en este valle. Respalda reducir el volumen esperado en torno a 20%.",
    },
  },
  {
    date: "2024-01-15",
    panel: "weather",
    source: "Agraria.pe",
    url: "https://agraria.pe/noticias/enfen-es-probable-que-el-nino-costero-continue-hasta-fines-d-34437",
    headline: "Enfen: \"Es probable que El Niño costero continúe hasta fines de verano\"",
    summary: {
      en: "ENFEN kept the coastal El Niño alert and expected it to last until the end of the southern summer.",
      es: "El ENFEN mantuvo la alerta de El Niño costero y estimó que duraría hasta fines del verano.",
    },
    relevance: {
      en: "Heat stress continued through fruit development: the campaign stayed under the weather alert into the pre-harvest tranche.",
      es: "El estrés por calor continuó en el desarrollo del fruto: la campaña siguió bajo alerta climática hasta el tramo de pre-cosecha.",
    },
  },
  {
    date: "2024-04-08",
    panel: "weather",
    source: "Agraria.pe",
    url: "https://agraria.pe/noticias/nino-costero-enfen-cambia-estado-de-alerta-a-no-activo-por-c-35280",
    headline: "Niño costero: Enfen cambia estado de alerta a \"No activo\" por condiciones neutras del mar",
    summary: {
      en: "ENFEN ended the coastal El Niño alert after sea temperatures returned to neutral.",
      es: "El ENFEN dio por terminada la alerta de El Niño costero al volver el mar a condiciones neutras.",
    },
    relevance: {
      en: "The weather risk closed after the M3 takeout date; it covered the whole financed period.",
      es: "El riesgo climático cerró después de la fecha de toma en M3; cubrió todo el periodo financiado.",
    },
  },
  {
    date: "2024-04-12",
    panel: "market",
    source: "Agraria.pe",
    url: "https://agraria.pe/noticias/palta-peruana-proyecta-baja-en-calibre-de-hasta-un-30-35341",
    headline: "Palta peruana proyecta baja en calibre de hasta un 30%",
    summary: {
      en: "ProHass expected fruit 20–30% smaller after the heat of late 2023 and early 2024, with export prices about 30% higher than the previous season.",
      es: "ProHass proyectó fruta 20–30% más pequeña por el calor de fines de 2023 e inicios de 2024, con precios de exportación cerca de 30% más altos que la campaña anterior.",
    },
    relevance: {
      en: "Lower volume, higher price: consistent with the purchase order signed for 44 t (vs 55.6 t declared) at USD 2.05/kg.",
      es: "Menor volumen, mayor precio: coherente con la orden de compra firmada por 44 t (vs 55,6 t declaradas) a USD 2,05/kg.",
    },
  },
  {
    date: "2024-05-08",
    panel: "crop",
    source: "Agraria.pe",
    url: "https://agraria.pe/noticias/produccion-peruana-de-palta-en-olmos-y-chavimochic-caeria-en-35632",
    headline: "Producción peruana de palta en Olmos y Chavimochic caería en el orden del 40%",
    summary: {
      en: "Camposol's general manager estimated avocado output in Olmos about −40%, with Chavimochic similar, from winter heat stress during the coastal El Niño.",
      es: "El gerente general de Camposol estimó la producción de palta en Olmos en cerca de −40%, y similar en Chavimochic, por estrés térmico invernal durante El Niño costero.",
    },
    relevance: {
      en: "A harsher estimate than October's −20%. This parcel's canopy recovered from October 2023 (NDVI back to 0.7–0.8), so the loss here is closer to the lower figure.",
      es: "Una estimación más dura que el −20% de octubre. El follaje de este predio se recuperó desde octubre de 2023 (NDVI de vuelta a 0,7–0,8), por lo que la pérdida aquí está más cerca de la cifra menor.",
    },
  },
  {
    date: "2024-09-09",
    panel: "market",
    source: "Agraria.pe",
    url: "https://agraria.pe/noticias/exportaciones-peruanas-de-palta-caen-12-en-volumen-pero-crec-36922",
    headline: "Exportaciones peruanas de palta caen 12% en volumen, pero crecen 11% en valor hasta la semana 33 del 2024",
    summary: {
      en: "Season result: Peru shipped 12% less avocado by volume but earned 11% more by value through week 33 of 2024.",
      es: "Resultado de la campaña: Perú exportó 12% menos palta en volumen pero 11% más en valor hasta la semana 33 de 2024.",
    },
    relevance: {
      en: "Confirms the market offset the crop loss at country level, as it did for this file's takeout.",
      es: "Confirma que el mercado compensó la pérdida de cosecha a nivel país, como ocurrió en la toma de este expediente.",
    },
  },
];
