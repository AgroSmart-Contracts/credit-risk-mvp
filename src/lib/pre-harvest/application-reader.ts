/**
 * Reads a pre-harvest application form (Formato de solicitud) uploaded as a PDF.
 * Text PDFs are read in the browser: content streams are inflated, the text
 * operators decoded, and each labelled field matched. Every field keeps the line it
 * came from, so the analyst can check it against the document.
 *
 * Scanned (image) PDFs have no text layer; those go to the AI extraction step.
 */
import proj4 from "proj4";

export type FieldKey =
  | "applicationDate"
  | "growerName"
  | "ruc"
  | "exportsDirectly"
  | "location"
  | "areaHa"
  | "vertices"
  | "waterLicence"
  | "waterAllocationM3PerHa"
  | "cropWaterNeedM3PerHa"
  | "salinityEcDsM"
  | "crop"
  | "variety"
  | "orchardAgeYears"
  | "lastHarvestDate"
  | "declaredYieldTPerHa"
  | "globalGap"
  | "revenueLast3CampaignsUsd"
  | "campaignCostUsd"
  | "amountUsd"
  | "tenorDays"
  | "approvalDate"
  | "fruitSetDate"
  | "preHarvestDate"
  | "m3Date"
  | "hasPackhouseContract"
  | "packhouseUtilizationPct"
  | "packhouseAssignment"
  | "buyer";

export interface ExtractedField<T = unknown> {
  value: T;
  /** The document line the value was read from. */
  line: string;
}

export type ExtractedApplication = Partial<{
  applicationDate: ExtractedField<string>;
  growerName: ExtractedField<string>;
  ruc: ExtractedField<string>;
  exportsDirectly: ExtractedField<boolean>;
  location: ExtractedField<string>;
  areaHa: ExtractedField<number>;
  vertices: ExtractedField<{ zone: number; south: boolean; points: Array<[number, number]>; ring: Array<[number, number]> }>;
  waterLicence: ExtractedField<string>;
  waterAllocationM3PerHa: ExtractedField<number>;
  cropWaterNeedM3PerHa: ExtractedField<number>;
  salinityEcDsM: ExtractedField<number>;
  crop: ExtractedField<string>;
  variety: ExtractedField<string>;
  orchardAgeYears: ExtractedField<number>;
  lastHarvestDate: ExtractedField<string>;
  declaredYieldTPerHa: ExtractedField<number>;
  globalGap: ExtractedField<boolean>;
  revenueLast3CampaignsUsd: ExtractedField<[number, number, number]>;
  campaignCostUsd: ExtractedField<number>;
  amountUsd: ExtractedField<number>;
  tenorDays: ExtractedField<number>;
  approvalDate: ExtractedField<string>;
  fruitSetDate: ExtractedField<string>;
  preHarvestDate: ExtractedField<string>;
  m3Date: ExtractedField<string>;
  hasPackhouseContract: ExtractedField<boolean>;
  packhouseUtilizationPct: ExtractedField<number>;
  packhouseAssignment: ExtractedField<boolean>;
  buyer: ExtractedField<string>;
}>;

/** Fields the evaluation cannot run without. */
export const REQUIRED_FIELDS: FieldKey[] = [
  "ruc",
  "areaHa",
  "vertices",
  "crop",
  "declaredYieldTPerHa",
  "amountUsd",
  "tenorDays",
  "approvalDate",
  "campaignCostUsd",
];

// ---------------------------------------------------------------------------
// PDF text layer
// ---------------------------------------------------------------------------

async function inflate(bytes: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const latin1 = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
  return s;
};

/** Decodes a PDF literal string body (between the parentheses). WinAnsi ≈ Latin-1 for Spanish text. */
function decodeLiteral(s: string): string {
  return s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, e: string) => {
    if (/^[0-7]+$/.test(e)) return String.fromCharCode(parseInt(e, 8));
    return ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" } as Record<string, string>)[e] ?? e;
  });
}

/** Text lines of every page, in drawing order. */
export async function readPdfText(buffer: ArrayBuffer): Promise<string[]> {
  const bytes = new Uint8Array(buffer);
  const raw = latin1(bytes);
  if (!raw.startsWith("%PDF")) throw new Error("not_pdf");
  const lines: string[] = [];
  const re = />>\s*stream\r?\n/g;
  for (let m = re.exec(raw); m; m = re.exec(raw)) {
    const start = m.index + m[0].length;
    const stop = raw.indexOf("endstream", start);
    if (stop < 0) break;
    // The stream dictionary: from its object header to the `stream` keyword.
    const dict = raw.slice(Math.max(0, raw.lastIndexOf(" obj", m.index)), m.index + 2);
    if (/\/Subtype\s*\/Image/.test(dict)) continue;
    // Direct /Length when given; otherwise up to `endstream` minus its end-of-line.
    const len = dict.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/);
    const end = len ? Math.min(start + Number(len[1]), stop) : stop - (raw[stop - 2] === "\r" ? 2 : raw[stop - 1] === "\n" ? 1 : 0);
    let body: Uint8Array = bytes.subarray(start, end);
    if (/\/FlateDecode/.test(dict)) {
      try {
        body = await inflate(body);
      } catch {
        continue;
      }
    }
    const text = latin1(body);
    if (!/\bTj\b|\bTJ\b/.test(text)) continue;
    // One line per text-positioning operator; strings shown in between join up.
    for (const chunk of text.split(/\b(?:Tm|Td|TD|T\*)\b/)) {
      const parts: string[] = [];
      for (const s of chunk.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj|\[((?:\\.|[^\]])*)\]\s*TJ/g)) {
        if (s[1] !== undefined) parts.push(decodeLiteral(s[1]));
        else for (const p of s[2].matchAll(/\(((?:\\.|[^\\)])*)\)/g)) parts.push(decodeLiteral(p[1]));
      }
      const line = parts.join("").trim();
      if (line) lines.push(line);
    }
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Field matching
// ---------------------------------------------------------------------------

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const number = (s: string) => Number(s.replace(/[^\d.,-]/g, "").replace(/,(?=\d{3}\b)/g, "").replace(",", "."));
const isoDate = (s: string) => {
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
};
const yes = (s: string) => /^s[ií](?![a-z])/i.test(s.trim());

function after(lines: string[], label: RegExp): { value: string; line: string } | null {
  for (const line of lines) {
    const n = norm(line);
    const m = n.match(label);
    if (m && m.index !== undefined) {
      // Same offsets in the original: NFD + strip keeps one char per base letter.
      const value = line.slice(m.index + m[0].length).replace(/^\s*:\s*/, "").trim();
      return { value, line };
    }
  }
  return null;
}

export function parseApplication(lines: string[]): ExtractedApplication {
  const out: ExtractedApplication = {};
  const set = <K extends keyof ExtractedApplication>(key: K, label: RegExp, conv: (v: string) => unknown) => {
    const hit = after(lines, label);
    if (!hit) return;
    const v = conv(hit.value);
    if (v === null || v === undefined || (typeof v === "number" && !Number.isFinite(v)) || v === "") return;
    out[key] = { value: v, line: hit.line } as ExtractedApplication[K];
  };

  set("applicationDate", /fecha de solicitud/, isoDate);
  set("growerName", /razon social/, (v) => v.replace(/^cliente\s+/i, "").replace(/\s*\(.*\)$/, ""));
  set("ruc", /\bruc\b/, (v) => v.match(/\d{11}/)?.[0] ?? null);
  set("exportsDirectly", /exporta directamente/, yes);
  set("location", /ubicacion/, (v) => v);
  set("areaHa", /superficie declarada/, number);
  set("waterLicence", /licencia de uso de agua/, (v) => v);
  set("waterAllocationM3PerHa", /dotacion de agua/, (v) => number(v.split("m")[0]));
  set("cropWaterNeedM3PerHa", /requerimiento hidrico del cultivo/, (v) => number(v.split("m")[0]));
  set("salinityEcDsM", /conductividad electrica del agua/, (v) => number(v.split("ds")[0].split("dS")[0]));
  set("crop", /^cultivo/, (v) => v.split("·")[0].trim());
  set("variety", /variedad/, (v) => v.trim());
  set("orchardAgeYears", /edad de la plantacion/, number);
  set("lastHarvestDate", /ultima cosecha/, isoDate);
  set("declaredYieldTPerHa", /rendimiento esperado/, (v) => number(v.split("t")[0]));
  set("globalGap", /certificacion/, (v) => /globalg\.?a\.?p/i.test(v) && !/no\b/i.test(v));
  set("campaignCostUsd", /costo proyectado de la campana/, number);
  set("amountUsd", /monto solicitado/, number);
  set("tenorDays", /^plazo/, number);
  set("approvalDate", /desembolso inicial solicitado/, isoDate);
  set("fruitSetDate", /cuajado esperado/, isoDate);
  set("preHarvestDate", /^pre-cosecha/, isoDate);
  set("m3Date", /orden de compra esperada/, isoDate);
  set("hasPackhouseContract", /contrato con empacadora/, (v) => yes(v));
  set("packhouseUtilizationPct", /utilizacion de la empacadora/, number);
  set("packhouseAssignment", /cesion de flujos/, (v) => yes(v.replace(/^.*?:\s*/, "")));
  set("buyer", /comprador previsto/, (v) => v);

  const revenue = ["2020-21", "2021-22", "2022-23"].map((c) => after(lines, new RegExp(`campana ${c}`)));
  if (revenue.every(Boolean)) {
    out.revenueLast3CampaignsUsd = {
      value: revenue.map((r) => number(r!.value)) as [number, number, number],
      line: revenue.map((r) => r!.line).join(" · "),
    };
  }

  // UTM vertices: "Coordenadas UTM WGS84 zona 17S" followed by "V1 E 746683 N 9067795" lines.
  const header = lines.findIndex((l) => /coordenadas utm/.test(norm(l)));
  if (header >= 0) {
    const zm = norm(lines[header]).match(/zona\s*(\d{1,2})\s*([ns])/);
    const zone = zm ? Number(zm[1]) : 0;
    const south = zm?.[2] === "s";
    const points: Array<[number, number]> = [];
    const used: string[] = [lines[header]];
    for (const l of lines.slice(header + 1)) {
      const m = l.match(/V\d+\s+E\s*([\d.,]+)\s+N\s*([\d.,]+)/i);
      if (!m) break;
      points.push([number(m[1]), number(m[2])]);
      used.push(l.trim());
    }
    if (zone && points.length >= 3) {
      const utm = `+proj=utm +zone=${zone}${south ? " +south" : ""} +datum=WGS84 +units=m +no_defs`;
      const ring = points.map((p) => proj4(utm, "EPSG:4326", p).map((v) => Math.round(v * 1e6) / 1e6) as [number, number]);
      out.vertices = { value: { zone, south, points, ring }, line: used.join(" · ") };
    }
  }
  if (out.crop) out.crop.value = norm(String(out.crop.value)).startsWith("palta") ? "avocado" : String(out.crop.value);
  return out;
}

/** Geodesic area of a [lon, lat] ring, hectares. */
export function ringAreaHa(ring: Array<[number, number]>): number {
  const R = 6_371_008.8;
  const rad = Math.PI / 180;
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    a += (x2 - x1) * rad * (2 + Math.sin(y1 * rad) + Math.sin(y2 * rad));
  }
  return Math.abs((a * R * R) / 2) / 10_000;
}

/** Distance between two [lon, lat] points, metres (equirectangular, fine at parcel scale). */
export function distanceM([x1, y1]: [number, number], [x2, y2]: [number, number]): number {
  const rad = Math.PI / 180;
  const dx = (x2 - x1) * rad * Math.cos(((y1 + y2) / 2) * rad);
  const dy = (y2 - y1) * rad;
  return Math.hypot(dx, dy) * 6_371_008.8;
}

export const centroid = (ring: Array<[number, number]>): [number, number] => [
  ring.reduce((s, p) => s + p[0], 0) / ring.length,
  ring.reduce((s, p) => s + p[1], 0) / ring.length,
];
