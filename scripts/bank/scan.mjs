/** Fails if anything internal is in the bank package: names, coordinates, model or vendors. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const PKG = path.join(ROOT, ".bank-build");
const files = (d) => readdirSync(d).flatMap((f) => (statSync(path.join(d, f)).isDirectory() ? files(path.join(d, f)) : [path.join(d, f)]));

const TERMS = ["Veritrade", "Comtrade", "Coface", "CRAM", "buyerName", "supplierName", "mongoId", "dealRef", "counterparty", "InternalApp", "growingPts", "strongPts", "scoreProduction", "scoreOperator", "Villacur", "Santiago", "Pueblo Nuevo", "Ocucaje", "Valle bajo", "Lower Ica", "sentinel-ica", "ica-0142", "ica-0177", "ica-0188", "viru-0311", "leaflet", "arcgisonline", "Respuesta Q18", "Answer Q18", "Sentinel", "ERA5", "NOAA", "OISST", "SUNARP", "Ingreso neto =", "Net revenue =", "15% ámbar", "15% amber", "-0.27x", "-0.42x", "volumen esperado 1", "expected volume 1", "gatillo naranja", "orange trigger"];
const deals = JSON.parse(readFileSync(path.join(ROOT, "src/data/platform-deals.generated.json"), "utf8"));
const list = Array.isArray(deals) ? deals : Object.values(deals).find(Array.isArray);
const names = [...new Set(list.flatMap((d) => [d.buyerName, d.supplierName]).filter((n) => typeof n === "string" && n.length >= 5))];
const site = readFileSync(path.join(ROOT, "src/lib/pre-harvest/site.ts"), "utf8") + readFileSync(path.join(ROOT, "src/data/bcp/technical.ts"), "utf8");
const coords = [...new Set(site.match(/-1[34]\.\d{3,}|-7[56]\.\d{3,}/g) ?? [])];
const VM_KEYS = ['"weight"', '"lat"', '"lon"', '"ring"', '"parcelId"', '"today":5', '"reference_x"'];

const problems = [];
const all = files(PKG);
for (const f of all) {
  const rel = path.relative(PKG, f);
  if (rel.endsWith(".map")) problems.push(`${rel}: source map`);
  const s = readFileSync(f, "utf8");
  for (const t of [...TERMS, ...names, ...coords]) if (s.includes(t)) problems.push(`${rel}: contains a blocked term (${names.includes(t) ? "deal party name" : t})`);
  if (rel.endsWith("view-model.json")) for (const k of VM_KEYS.slice(0, 5)) if (s.includes(k)) problems.push(`${rel}: key ${k}`);
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`scan clean: ${all.length} files, ${TERMS.length + names.length + coords.length} blocked terms`);
