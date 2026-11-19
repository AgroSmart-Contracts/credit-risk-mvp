/**
 * Writes the pre-harvest application form (Formato de solicitud) for client VIR-0311
 * as a text PDF: docs/pre-harvest/solicitud-PH-VIR-0311-2324.pdf
 * Field values come from the deal record and the surveyed parcel (UTM vertices).
 *
 * Usage: npx tsx scripts/pre-harvest/build-formato-pdf.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";
import proj4 from "proj4";
import { CLOSED_VIR_0311_2324 as D } from "../../src/data/pre-harvest/deal-viru-0311";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = path.join(ROOT, "docs/pre-harvest/solicitud-PH-VIR-0311-2324.pdf");
const UTM17S = "+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs";

const dmy = (iso: string) => iso.split("-").reverse().join("/");
const num = (n: number) => n.toLocaleString("en-US");
const f = D.formato;
const vertices = D.parcel.map(([lon, lat]) => proj4("EPSG:4326", UTM17S, [lon, lat]).map((v) => Math.round(v)));

type Line = { text: string; size?: number; bold?: boolean; gap?: number };
const L = (text: string, o: Partial<Line> = {}): Line => ({ text, ...o });
const H = (text: string): Line => ({ text, bold: true, size: 11, gap: 10 });

const lines: Line[] = [
  L("SOLICITUD DE FINANCIAMIENTO PRE-COSECHA", { bold: true, size: 14 }),
  L("Formato N.° PH-VIR-0311-2324 · Agroexportación, palta Hass", { size: 9 }),
  L(`Fecha de solicitud: ${dmy("2023-09-04")}`),
  H("1. Datos del solicitante"),
  L(`Razón social: Cliente ${f.growerName} (código anonimizado)`),
  L(`RUC: ${f.ruc}`),
  L(`Exporta directamente: ${f.exportsDirectly ? "Sí" : "No (vende a exportador a través de empacadora)"}`),
  H("2. Predio"),
  L("Ubicación: Sector Chavimochic, distrito de Virú, provincia de Virú, La Libertad"),
  L(`Superficie declarada: ${f.areaHa.toFixed(2)} ha`),
  L("Tenencia: Propia (inscrita en SUNARP)"),
  L("Coordenadas UTM WGS84 zona 17S (vértices del predio):"),
  ...vertices.map(([e, n], i) => L(`   V${i + 1}  E ${e}  N ${n}`)),
  L("Fuente de agua: Proyecto Especial Chavimochic (canal madre)"),
  L(`Licencia de uso de agua: ${D.checks.ana.licenceId}`),
  L(`Dotación de agua: ${num(f.waterAllocationM3PerHa)} m³/ha/año`),
  L(`Requerimiento hídrico del cultivo: ${num(f.cropWaterNeedM3PerHa)} m³/ha/año`),
  L(`Conductividad eléctrica del agua: ${f.salinityEcDsM} dS/m`),
  H("3. Cultivo"),
  L(`Cultivo: Palta  ·  Variedad: ${f.variety}`),
  L(`Edad de la plantación: ${f.orchardAgeYears} años`),
  L(`Última cosecha: ${dmy(f.lastHarvestDate)}`),
  L(`Rendimiento esperado: ${f.declaredYieldTPerHa} t/ha`),
  L("Certificación: GlobalG.A.P. vigente"),
  H("4. Historial comercial (ventas por campaña, USD)"),
  L(`Campaña 2020-21: ${num(f.revenueLast3CampaignsUsd[0])}`),
  L(`Campaña 2021-22: ${num(f.revenueLast3CampaignsUsd[1])}`),
  L(`Campaña 2022-23: ${num(f.revenueLast3CampaignsUsd[2])}`),
  H("5. Campaña 2023-24 y financiamiento solicitado"),
  L(`Costo proyectado de la campaña: USD ${num(f.campaignCostUsd)}`),
  L(`Monto solicitado: USD ${num(D.envelopeUsd)}`),
  L(`Plazo: ${D.tenorDays} días`),
  L(`Desembolso inicial solicitado: ${dmy(D.approvalDate)}`),
  L(`Cuajado esperado: ${dmy(D.fruitSetDate)}`),
  L(`Pre-cosecha: ${dmy(D.preHarvestDate)}`),
  L(`Orden de compra esperada (M3): ${dmy(D.m3Date)}`),
  H("6. Comercialización y garantías"),
  L(`Contrato con empacadora: ${f.hasPackhouseContract ? "Sí" : "No"}  ·  Utilización de la empacadora: ${f.packhouseUtilizationPct}%`),
  L(`Cesión de flujos de la empacadora al banco: ${D.packhouseAssignment ? "Sí" : "No"}`),
  L("Comprador previsto: importador de la Unión Europea (Países Bajos), con línea Coface"),
  L(" ", { gap: 18 }),
  L("Declaro que la información consignada es verdadera.", { size: 9 }),
  L(`Firma del representante legal: ______________________     Lugar y fecha: Virú, ${dmy("2023-09-04")}`, { size: 9 }),
];

// WinAnsi covers the Spanish characters used here (á é í ó ú ñ ° ³ ·).
const esc = (s: string) =>
  [...s]
    .map((ch) => {
      const c = ch.charCodeAt(0);
      if (ch === "(" || ch === ")" || ch === "\\") return `\\${ch}`;
      if (c < 128) return ch;
      if (c <= 255) return `\\${c.toString(8).padStart(3, "0")}`;
      return "?";
    })
    .join("");

let y = 800;
const ops: string[] = ["BT"];
for (const l of lines) {
  const size = l.size ?? 10;
  y -= (l.gap ?? 0) + size + 4;
  ops.push(`/${l.bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 56 ${y} Tm (${esc(l.text)}) Tj`);
}
ops.push("ET");
const content = deflateSync(Buffer.from(ops.join("\n"), "latin1"));

const objects: Buffer[] = [];
const obj = (body: string | Buffer) => {
  objects.push(typeof body === "string" ? Buffer.from(body, "latin1") : body);
  return objects.length;
};
obj("<< /Type /Catalog /Pages 2 0 R >>");
obj("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
obj("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>");
obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
obj(Buffer.concat([Buffer.from(`<< /Length ${content.length} /Filter /FlateDecode >>\nstream\n`, "latin1"), content, Buffer.from("\nendstream", "latin1")]));
obj(`<< /Title (Solicitud de financiamiento pre-cosecha PH-VIR-0311-2324) /Producer (TruMarket) /CreationDate (D:20230904090000-05'00') >>`);

const parts: Buffer[] = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")];
const offsets: number[] = [];
let pos = parts[0].length;
objects.forEach((body, i) => {
  const chunk = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, "latin1"), body, Buffer.from("\nendobj\n", "latin1")]);
  offsets.push(pos);
  parts.push(chunk);
  pos += chunk.length;
});
const xref =
  `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
  offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("") +
  `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
parts.push(Buffer.from(xref, "latin1"));

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, Buffer.concat(parts));
console.log(`Wrote ${path.relative(ROOT, OUT)}`);
