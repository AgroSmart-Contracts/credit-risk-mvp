/**
 * Runs the private calculations and writes only finished, display-ready results for the
 * bank edition. No weights, point breakdowns, coordinates or location names leave here.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PORTFOLIO } from "../../src/data/bcp/dataset";
import { technicalSeries } from "../../src/data/bcp/technical";
import { RULINGS } from "../../src/data/bcp/rulings";
import type { Application, Cause, Condition, Loan, Tx } from "../../src/lib/bcp/types";

const OUT = path.resolve(import.meta.dirname, "../../.bank-build/private/view-model.json");
const region = (z: Tx): Tx => (z.es.includes("Pisco") ? { es: "Pisco", en: "Pisco" } : { es: "Ica", en: "Ica" });
const area = (ha: number) => Math.max(1, Math.round(ha));
const IN_COVERAGE: Tx = { es: "Incluido en la cobertura", en: "Included in coverage" };
const IN_PROJECTION: Tx = { es: "Incluido en la proyección", en: "Included in the projection" };
/** Confirmed effects are already in today's coverage; estimated ones only in the projection. */
const effectLabel = (t: Tx, estimated: boolean) => (estimated || /estimad/i.test(t.es) || /x (a|to) -?\d/.test(t.es + t.en) ? IN_PROJECTION : IN_COVERAGE);
const hasRange = (t: Tx) => /[-+]\d\.\d+x|Volum/.test(t.es + t.en);
const WORDS: Array<[RegExp, string, string]> = [
  [/Sentinel-2( \+ fotos| \+ photos)?/g, "Satélite", "Satellite"],
  [/ERA5 \+ (licencia|licence)/g, "Clima y licencia", "Climate and licence"],
  [/ERA5/g, "Clima", "Climate"],
  [/ENFEN, (comunicado|communiqué) 19-2026 · Niño 1\+2 \(NOAA\) (oct|Oct) 2026/g, "Fuente pública · oct 2026", "Public source · Oct 2026"],
  [/\b(NOAA|ENFEN|OISST)\b/g, "Fuente pública", "Public source"],
  [/\b(Coface)\b/gi, "Aseguradora de crédito", "Credit insurer"],
  [/\b(Veritrade|Comtrade)\b/gi, "Mercado de exportación", "Export market"],
  [/SUNARP/g, "Registro público", "Public registry"],
  [/\bANA\b/g, "Registro de agua", "Water registry"],
  [/Exportaciones de palta Hass \(aduanas\) · ago 2026|Hass avocado exports \(customs\) · Aug 2026/g, "Mercado de exportación", "Export market"],
  [/Contrato ·/g, "Contrato ·", "Contract ·"],
];
const clean = (s: string, lang: "es" | "en") => WORDS.reduce((x, [re, es, en]) => x.replace(re, lang === "es" ? es : en), s).replace(/ \(-?0\.\d+x (a|to) -?0\.\d+x\)/g, "").replace(/: (volumen esperado|expected volume) \d+% (menor|lower)/gi, "").replace(/ \([^()]*(?:trigger|gatillo)[^()]*\)/gi, "").replace(/ (?:vs the lot baseline|frente a la línea base del lote)/gi, "");
/** Every bilingual string: categories instead of source names, no per-risk effect ranges. */
function scrub<T>(v: T): T {
  if (Array.isArray(v)) return v.map(scrub) as T;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.es === "string" && typeof o.en === "string") return { es: clean(o.es, "es"), en: clean(o.en, "en") } as T;
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, scrub(x)])) as T;
  }
  return v;
}
const NO_THRESHOLD: Tx = { es: "", en: "" };
const matters = (c: Condition) => c.state !== "verde" || c.effectOnRepayment.es !== "Ninguno";
const condition = (c: Condition): Condition => ({ ...c, threshold: NO_THRESHOLD, effectOnRepayment: hasRange(c.effectOnRepayment) ? effectLabel(c.effectOnRepayment, c.state === "observacion" || c.provenance === "estimado") : c.effectOnRepayment });
const cause = (c: Cause): Cause => (hasRange(c.effect) ? { ...c, effect: effectLabel(c.effect, c.status === "observacion") } : c);
const TRIGGER: Tx = { es: "Gatillo contractual", en: "Contractual trigger" };


/** The score stays internal: unexplained to the bank and not what sets a state. */
const SCORELESS = /\b(score|tier)\b/i;
const loans: Loan[] = PORTFOLIO.loans.map(({ scoreAtApproval: _a, scoreToday: _b, approvedTier: _c, ...l }) => ({
  ...l,
  zone: region(l.zone),
  areaHa: area(l.areaHa),
  scoreDims: [],
  // Per-driver projected ranges stay internal unless ruled otherwise (src/data/bcp/rulings.ts).
  alert: l.alert && (RULINGS.bankSeesDriverProjections ? l.alert : { driver: l.alert.driver, text: l.alert.text }),
  conditions: l.conditions.filter(matters).map(condition),
  causes: l.causes.map(cause),
  auditLog: l.auditLog.filter((a) => !SCORELESS.test(a.event.es + a.rule.es)).map((a) => ({ ...a, rule: /%|semana|week|trigger|gatillo/i.test(a.rule.es + a.rule.en) ? TRIGGER : a.rule })),
}) as unknown as Loan);
const applications: Application[] = PORTFOLIO.applications.map(({ score: _s, tier: _t, ...a }) => ({
  ...a,
  zone: region(a.zone),
  areaHa: area(a.areaHa),
  scoreDims: [],
  checks: a.checks.map((c) =>
    c.label.es === "Área declarada frente a la medida" ? { ...c, value: { es: "Coincide con lo declarado (diferencia menor al 1%)", en: "Matches the declaration (under 1% difference)" }, source: { es: "Medición satelital", en: "Satellite measurement" } } : hasRange(c.effect) ? { ...c, effect: effectLabel(c.effect, c.state === "observacion" || c.provenance === "estimado") } : c,
  ),
}) as unknown as Application);

// Only El Niño leaves as a series; crop, water, weather and price histories stay private.
const series = Object.fromEntries(PORTFOLIO.loans.map((l) => [l.id, { vigor: [], agua: [], enso: technicalSeries(l, PORTFOLIO.cutoff).enso, precio: [], esperado: [], clima: [] }]));

const changes = PORTFOLIO.changes.map((c) => (hasRange(c.impact) || /0\.10x/.test(c.impact.es) ? { ...c, impact: { es: "Efecto incluido en la proyección. Aún no confirmado en campo.", en: "Effect included in the projection. Not yet confirmed in the field." }, evidence: undefined } : { ...c, evidence: undefined }));
const exceptions = PORTFOLIO.exceptions.map((e) => ({
  ...e,
  whatHappened: e.whatHappened.map((x) => (/banda|band/.test(x.es + x.en) ? { es: "Los desvíos activaron el gatillo contractual.", en: "The deviations activated the contractual trigger." } : x)),
}));

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(scrub({ portfolio: { ...PORTFOLIO, loans, applications, changes, exceptions }, series })));
console.log(`view model: ${loans.length} loans, ${applications.length} applications`);
