/**
 * New application, the way an analyst receives one: upload the client's
 * application form, check what was read from it, locate the parcel, run the
 * verifications, see the score, and open the file.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileText, Upload, XCircle } from "lucide-react";
import { dealFromApplication, simulateFile } from "../../data/pre-harvest/files";
import { monitoringDataFor } from "../../data/pre-harvest";
import {
  centroid,
  parseApplication,
  readPdfText,
  REQUIRED_FIELDS,
  ringAreaHa,
  type ExtractedApplication,
  type FieldKey,
} from "../../lib/pre-harvest/application-reader";
import { CROP_THRESHOLDS as CT, WEATHER_THRESHOLDS as WT } from "../../lib/pre-harvest/config";
import { recommendationFor, RECOMMENDATION_TEXT } from "../../lib/pre-harvest/credit-metrics";
import { formatDate, formatRate, formatUsd, tb } from "../../lib/pre-harvest/i18n";
import type { Bilingual, Lang, PreHarvestDeal } from "../../lib/pre-harvest/types";
import { FieldMap } from "./FieldMap";
import { ScorePanel } from "./ScorePanel";
import { Card, LanguageToggle } from "./ui";

const L = (en: string, es: string): Bilingual => ({ en, es });
const STEPS = [L("Document", "Documento"), L("Review", "Revisión"), L("Location", "Ubicación"), L("Verification", "Verificación"), L("Assessment", "Evaluación")];

const FIELD_LABEL: Record<FieldKey, Bilingual> = {
  applicationDate: L("Application date", "Fecha de solicitud"),
  growerName: L("Client", "Cliente"),
  ruc: L("RUC", "RUC"),
  exportsDirectly: L("Exports directly", "Exporta directamente"),
  location: L("Location", "Ubicación"),
  areaHa: L("Declared area (ha)", "Superficie declarada (ha)"),
  vertices: L("Parcel vertices (UTM)", "Vértices del predio (UTM)"),
  waterLicence: L("Water licence", "Licencia de agua"),
  waterAllocationM3PerHa: L("Water allocation (m³/ha/yr)", "Dotación de agua (m³/ha/año)"),
  cropWaterNeedM3PerHa: L("Crop water need (m³/ha/yr)", "Requerimiento hídrico (m³/ha/año)"),
  salinityEcDsM: L("Water salinity (dS/m)", "Salinidad del agua (dS/m)"),
  crop: L("Crop", "Cultivo"),
  variety: L("Variety", "Variedad"),
  orchardAgeYears: L("Orchard age (years)", "Edad de la plantación (años)"),
  lastHarvestDate: L("Last harvest", "Última cosecha"),
  declaredYieldTPerHa: L("Expected yield (t/ha)", "Rendimiento esperado (t/ha)"),
  globalGap: L("GlobalG.A.P.", "GlobalG.A.P."),
  revenueLast3CampaignsUsd: L("Revenue, last 3 campaigns (USD)", "Ventas, últimas 3 campañas (USD)"),
  campaignCostUsd: L("Campaign cost (USD)", "Costo de campaña (USD)"),
  amountUsd: L("Amount requested (USD)", "Monto solicitado (USD)"),
  tenorDays: L("Tenor (days)", "Plazo (días)"),
  approvalDate: L("First disbursement", "Primer desembolso"),
  fruitSetDate: L("Fruit set", "Cuajado"),
  preHarvestDate: L("Pre-harvest", "Pre-cosecha"),
  m3Date: L("Purchase order (M3)", "Orden de compra (M3)"),
  hasPackhouseContract: L("Packhouse contract", "Contrato con empacadora"),
  packhouseUtilizationPct: L("Packhouse utilisation (%)", "Utilización de empacadora (%)"),
  packhouseAssignment: L("Assignment of proceeds", "Cesión de flujos"),
  buyer: L("Intended buyer", "Comprador previsto"),
};

function show(v: unknown, lang: Lang): string {
  if (typeof v === "boolean") return v ? (lang === "es" ? "Sí" : "Yes") : "No";
  if (Array.isArray(v)) return v.map((x) => (typeof x === "number" ? x.toLocaleString("en-US") : String(x))).join(" · ");
  if (typeof v === "number") return v.toLocaleString("en-US");
  if (v && typeof v === "object" && "points" in v) return `${(v as { points: unknown[] }).points.length} ${lang === "es" ? "vértices" : "vertices"}`;
  return String(v);
}

type Check = { label: Bilingual; ok: boolean | null; value: Bilingual };

function CheckRow({ c, lang }: { c: Check; lang: Lang }) {
  const Icon = c.ok === null ? AlertTriangle : c.ok ? CheckCircle2 : XCircle;
  return (
    <li className="flex gap-3 py-2.5">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${c.ok === null ? "text-tm-accent-dark" : c.ok ? "text-tm-primary" : "text-tm-danger-dark"}`} />
      <div>
        <p className="text-sm font-medium text-tm-black">{tb(c.label, lang)}</p>
        <p className="text-xs text-tm-text-light">{tb(c.value, lang)}</p>
      </div>
    </li>
  );
}

function useReverseGeocode(ring: Array<[number, number]> | undefined) {
  const [place, setPlace] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!ring) return;
    const [lon, lat] = centroid(ring);
    let alive = true;
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=12&accept-language=es`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && setPlace(j?.display_name ?? null))
      .catch(() => alive && setPlace(null));
    return () => {
      alive = false;
    };
  }, [ring]);
  return place;
}

function StepNav({
  step,
  onStep,
  onCancel,
  next,
  disabled,
  label,
  lang,
}: {
  step: number;
  onStep: (s: number) => void;
  onCancel: () => void;
  next?: () => void;
  disabled?: boolean;
  label?: Bilingual;
  lang: Lang;
}) {
  return (
    <div className="flex justify-between gap-2 pt-2">
      <button
        type="button"
        onClick={() => (step === 0 ? onCancel() : onStep(step - 1))}
        className="rounded-lg border border-tm-border px-3 py-1.5 text-sm font-medium text-tm-text-light hover:text-tm-black"
      >
        {step === 0 ? (lang === "es" ? "Cancelar" : "Cancel") : lang === "es" ? "Atrás" : "Back"}
      </button>
      {next && (
        <button type="button" onClick={next} disabled={disabled} className="rounded-lg bg-tm-primary px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
          {label ? tb(label, lang) : lang === "es" ? "Continuar" : "Continue"}
        </button>
      )}
    </div>
  );
}

function Section({ title, hint, lang, children }: { title: Bilingual; hint?: Bilingual; lang: Lang; children: ReactNode }) {
  return (
    <Card>
      <h3 className="font-display text-lg text-tm-black">{tb(title, lang)}</h3>
      {hint && <p className="mt-0.5 text-sm text-tm-text-light">{tb(hint, lang)}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </Card>
  );
}

export function NewApplication({
  lang,
  onLang,
  onCancel,
  onRegister,
}: {
  lang: Lang;
  onLang: (l: Lang) => void;
  onCancel: () => void;
  onRegister: (deal: PreHarvestDeal) => void;
}) {
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [app, setApp] = useState<ExtractedApplication | null>(null);
  const [error, setError] = useState<Bilingual | null>(null);
  const [reading, setReading] = useState(false);

  const read = async (file: File) => {
    setError(null);
    setReading(true);
    setFileName(file.name);
    try {
      const lines = await readPdfText(await file.arrayBuffer());
      if (!lines.length) {
        setError(L("This PDF has no text layer (a scan). It needs the AI document reader, which is not enabled for this workspace.", "Este PDF no tiene capa de texto (es un escaneo). Requiere el lector de documentos con IA, no habilitado en este espacio."));
        setApp(null);
      } else {
        setApp(parseApplication(lines));
        setStep(1);
      }
    } catch {
      setError(L("The file could not be read as a PDF.", "No se pudo leer el archivo como PDF."));
      setApp(null);
    } finally {
      setReading(false);
    }
  };

  const missing = app ? REQUIRED_FIELDS.filter((k) => !app[k]) : REQUIRED_FIELDS;
  const built = useMemo(() => (app && !missing.length ? dealFromApplication(app) : null), [app, missing.length]);
  const deal = built?.ok ? built.deal : null;
  const sim = useMemo(() => (deal ? simulateFile(deal) : null), [deal]);
  const place = useReverseGeocode(step >= 2 ? deal?.parcel : undefined);

  const checks = useMemo((): Check[] => {
    if (!deal || !sim) return [];
    const s = sim.signals;
    const measured = ringAreaHa(deal.parcel);
    const diff = ((deal.formato.areaHa - measured) / measured) * 100;
    const series = monitoringDataFor(deal.parcelId).ndvi.series;
    const byYear = new Map<number, number[]>();
    for (const p of series) {
      const y = Number(p.date.slice(0, 4));
      if (p.date <= deal.approvalDate) (byYear.get(y) ?? byYear.set(y, []).get(y)!).push(p.ndvi);
    }
    const med = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
    const established = [...byYear.entries()].sort(([a], [b]) => a - b).find(([, v]) => med(v) >= CT.establishedMinNdvi)?.[0];
    const planted = Number(deal.approvalDate.slice(0, 4)) - deal.formato.orchardAgeYears;
    const gap = established !== undefined ? established - planted : null;
    const water = deal.formato.waterAllocationM3PerHa / deal.formato.cropWaterNeedM3PerHa;
    const c = deal.checks;
    return [
      {
        label: L("Parcel area", "Área del predio"),
        ok: Math.abs(diff) <= 5,
        value: L(
          `${deal.formato.areaHa.toFixed(2)} ha declared · ${measured.toFixed(2)} ha measured from the vertices (${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%)`,
          `${deal.formato.areaHa.toFixed(2)} ha declaradas · ${measured.toFixed(2)} ha medidas de los vértices (${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%)`,
        ),
      },
      {
        label: L("Standing crop before disbursement", "Cultivo en pie antes del desembolso"),
        ok: s.cropPresenceNdvi !== null ? s.cropPresenceNdvi >= CT.plantingMinNdvi : null,
        value: L(
          `Mean parcel NDVI ${s.cropPresenceNdvi?.toFixed(2) ?? "–"} over the ${CT.plantingWindowDays} days before ${deal.approvalDate} · min ${CT.plantingMinNdvi}`,
          `NDVI medio del predio ${s.cropPresenceNdvi?.toFixed(2) ?? "–"} en los ${CT.plantingWindowDays} días previos al ${deal.approvalDate} · mín. ${CT.plantingMinNdvi}`,
        ),
      },
      {
        label: L("Crop type consistent with Hass avocado", "Tipo de cultivo coherente con palta Hass"),
        ok: s.seasonalMinNdvi !== null ? s.seasonalMinNdvi >= CT.evergreenMinNdvi : null,
        value: L(
          `Lowest NDVI in two years ${s.seasonalMinNdvi?.toFixed(2) ?? "–"} · an evergreen orchard stays ≥ ${CT.evergreenMinNdvi}; vines, asparagus and annual crops drop to ~0.1–0.2. Citrus and mango look similar: the field visit confirms the species.`,
          `NDVI mínimo en dos años ${s.seasonalMinNdvi?.toFixed(2) ?? "–"} · un huerto perenne se mantiene ≥ ${CT.evergreenMinNdvi}; vid, espárrago y cultivos anuales bajan a ~0,1–0,2. Cítricos y mango se ven similares: la visita confirma la especie.`,
        ),
      },
      {
        label: L("Orchard age vs satellite history", "Edad de la plantación vs historial satelital"),
        ok: gap === null ? null : gap >= 0 && gap <= 4,
        value:
          established === undefined
            ? L("No established canopy found before approval", "No se encontró follaje establecido antes de la aprobación")
            : L(
                `Declared ${deal.formato.orchardAgeYears} years (planted ~${planted}) · canopy established on satellite from ${established}`,
                `Declarada ${deal.formato.orchardAgeYears} años (plantada ~${planted}) · follaje establecido en satélite desde ${established}`,
              ),
      },
      {
        label: L("Crop vigour vs the parcel's own norm", "Vigor del cultivo vs la norma del propio predio"),
        ok: s.ndviVsMedianPct === null ? null : s.ndviVsMedianPct > -CT.yellowPctBelowMedian,
        value:
          s.ndviVsMedianPct === null
            ? L(`Fewer than ${CT.minBaselineYears} established seasons on record: no baseline yet (young orchard). Scored neutral.`, `Menos de ${CT.minBaselineYears} campañas establecidas: aún sin línea base (huerto joven). Puntaje neutro.`)
            : L(`${s.ndviVsMedianPct >= 0 ? "+" : ""}${s.ndviVsMedianPct}% vs same season, previous years`, `${s.ndviVsMedianPct >= 0 ? "+" : ""}${s.ndviVsMedianPct}% vs misma época de años previos`),
      },
      {
        label: L("Water licence covers crop need", "La dotación cubre la necesidad del cultivo"),
        ok: water >= 1,
        value: L(
          `${deal.formato.waterAllocationM3PerHa.toLocaleString("en-US")} vs ${deal.formato.cropWaterNeedM3PerHa.toLocaleString("en-US")} m³/ha/yr (${water.toFixed(2)}×) · licence ${c.ana.licenceId}`,
          `${deal.formato.waterAllocationM3PerHa.toLocaleString("en-US")} vs ${deal.formato.cropWaterNeedM3PerHa.toLocaleString("en-US")} m³/ha/año (${water.toFixed(2)}×) · licencia ${c.ana.licenceId}`,
        ),
      },
      {
        label: L("Coastal El Niño at approval", "El Niño costero a la aprobación"),
        ok: s.enso === null ? null : s.enso < WT.ensoYellow,
        value: L(
          `Niño 1+2 ${s.enso !== null ? `${s.enso >= 0 ? "+" : ""}${s.enso.toFixed(2)} °C` : "–"} (3-month mean, NOAA CPC) · watch ≥ +${WT.ensoYellow}, high ≥ +${WT.ensoRed}`,
          `Niño 1+2 ${s.enso !== null ? `${s.enso >= 0 ? "+" : ""}${s.enso.toFixed(2)} °C` : "–"} (media 3 meses, NOAA CPC) · vigilancia ≥ +${WT.ensoYellow}, alto ≥ +${WT.ensoRed}`,
        ),
      },
      {
        label: L("SUNAT · RUC", "SUNAT · RUC"),
        ok: c.ruc.active && c.ruc.habido,
        value: L(`${deal.formato.ruc} · ${c.ruc.active ? "active" : "inactive"}, ${c.ruc.habido ? "habido" : "no habido"} · ${deal.checksDate}`, `${deal.formato.ruc} · ${c.ruc.active ? "activo" : "inactivo"}, ${c.ruc.habido ? "habido" : "no habido"} · ${deal.checksDate}`),
      },
      {
        label: L("SUNARP · land title", "SUNARP · título del predio"),
        ok: c.sunarp.tenure === "owned" && c.sunarp.liens === 0 ? true : c.sunarp.tenure === "informal" ? false : null,
        value: L(`${c.sunarp.tenure} · ${c.sunarp.liens} lien(s)`, `${c.sunarp.tenure === "owned" ? "propio" : c.sunarp.tenure === "leased" ? "arrendado" : "informal"} · ${c.sunarp.liens} carga(s)`),
      },
      {
        label: L("Credit bureau · SBS rating", "Central de riesgos · calificación SBS"),
        ok: c.credit.rating === "Normal" && c.credit.protestedDebts === 0,
        value: L(`${c.credit.rating} · ${c.credit.protestedDebts} protested debts · ${c.credit.bureau}`, `${c.credit.rating} · ${c.credit.protestedDebts} protestos · ${c.credit.bureau}`),
      },
      { label: L("SENASA · phytosanitary zone", "SENASA · zona fitosanitaria"), ok: c.senasa.zoneStatus !== "quarantine", value: c.senasa.note },
    ];
  }, [deal, sim]);

  return (
    <div className="space-y-4 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-1 text-sm text-tm-text-light hover:text-tm-black">
          <ArrowLeft className="h-4 w-4" />
          {lang === "es" ? "Expedientes pre-cosecha" : "Pre-harvest files"}
        </button>
        <LanguageToggle lang={lang} onChange={onLang} />
      </div>
      <div>
        <h2 className="font-display text-2xl text-tm-black sm:text-[28px]">{lang === "es" ? "Nueva solicitud" : "New application"}</h2>
        <ol className="mt-3 flex flex-wrap gap-2 text-xs">
          {STEPS.map((s, i) => (
            <li
              key={i}
              className={`rounded-full px-3 py-1 font-medium ${i === step ? "bg-tm-primary text-white" : i < step ? "bg-tm-neutral text-tm-black" : "bg-tm-neutral/50 text-tm-text-muted"}`}
            >
              {i + 1}. {tb(s, lang)}
            </li>
          ))}
        </ol>
      </div>

      {step === 0 && (
        <Section
          lang={lang}
          title={L("Upload the application form", "Cargar el formato de solicitud")}
          hint={L("PDF of the client's pre-harvest application (Formato de solicitud). Fields are read from the document; nothing is typed by hand.", "PDF de la solicitud pre-cosecha del cliente. Los campos se leen del documento; nada se digita a mano.")}
        >
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) read(f);
            }}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-tm-border bg-tm-neutral-light px-6 py-12 text-center hover:border-tm-text-muted"
          >
            <Upload className="h-6 w-6 text-tm-text-light" />
            <span className="text-sm font-medium text-tm-black">
              {reading ? (lang === "es" ? "Leyendo…" : "Reading…") : lang === "es" ? "Arrastre el PDF aquí o haga clic para elegirlo" : "Drop the PDF here or click to choose it"}
            </span>
            {fileName && <span className="text-xs text-tm-text-muted">{fileName}</span>}
            <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
          </label>
          {error && <p className="rounded-lg bg-tm-danger/10 px-3 py-2 text-sm text-tm-danger-dark">{tb(error, lang)}</p>}
          <StepNav step={step} onStep={setStep} onCancel={onCancel} lang={lang} />
        </Section>
      )}

      {step === 1 && app && (
        <Section
          lang={lang}
          title={L("What was read from the document", "Lo que se leyó del documento")}
          hint={L("Each value shows the line it came from. Check it against the PDF before continuing.", "Cada valor muestra la línea de donde proviene. Verifíquelo contra el PDF antes de continuar.")}
        >
          <p className="inline-flex items-center gap-1.5 text-sm text-tm-text-light">
            <FileText className="h-4 w-4" />
            {fileName} · {Object.keys(app).length} {lang === "es" ? "campos leídos" : "fields read"}
            {missing.length > 0 && (
              <span className="font-medium text-tm-danger-dark">
                · {missing.length} {lang === "es" ? "obligatorios faltantes" : "required missing"}
              </span>
            )}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-tm-text-muted">
                <tr>
                  <th className="py-1.5 pr-3 font-semibold">{lang === "es" ? "Campo" : "Field"}</th>
                  <th className="py-1.5 pr-3 font-semibold">{lang === "es" ? "Valor" : "Value"}</th>
                  <th className="py-1.5 font-semibold">{lang === "es" ? "Línea del documento" : "Document line"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tm-border">
                {(Object.keys(FIELD_LABEL) as FieldKey[]).map((k) => {
                  const f = app[k] as { value: unknown; line: string } | undefined;
                  const req = REQUIRED_FIELDS.includes(k);
                  return (
                    <tr key={k} className="align-top">
                      <td className="py-1.5 pr-3 text-tm-text-light">
                        {tb(FIELD_LABEL[k], lang)}
                        {req && <span className="text-tm-text-muted"> *</span>}
                      </td>
                      <td className={`py-1.5 pr-3 font-medium tabular-nums ${f ? "text-tm-black" : req ? "text-tm-danger-dark" : "text-tm-text-muted"}`}>
                        {f ? show(f.value, lang) : lang === "es" ? "no encontrado" : "not found"}
                      </td>
                      <td className="py-1.5 font-mono text-[11px] text-tm-text-muted">{f?.line ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {built && !built.ok && (
            <p className="rounded-lg bg-tm-danger/10 px-3 py-2 text-sm text-tm-danger-dark">
              {built.reason === "no_records"
                ? lang === "es"
                  ? "No hay registros del banco (SUNAT, SUNARP, central de riesgos) para este RUC."
                  : "No bank records (SUNAT, SUNARP, credit bureau) for this RUC."
                : built.reason === "no_parcel"
                  ? lang === "es"
                    ? "Aún no hay historial satelital para este predio. Se solicita su construcción (toma algunos minutos)."
                    : "No satellite history for this parcel yet. Its build has to be requested (takes a few minutes)."
                  : ""}
            </p>
          )}
          <StepNav step={step} onStep={setStep} onCancel={onCancel} lang={lang} next={() => setStep(2)} disabled={!deal} />
        </Section>
      )}

      {step === 2 && deal && (
        <Section
          lang={lang}
          title={L("Parcel location", "Ubicación del predio")}
          hint={L("The parcel is drawn from the UTM vertices in the application, over satellite imagery.", "El predio se dibuja con los vértices UTM de la solicitud, sobre imagen satelital.")}
        >
          <div className="relative z-0">
            <FieldMap lat={deal.lat} lon={deal.lon} areaHa={deal.formato.areaHa} ring={deal.parcel} severity="green" />
          </div>
          <ul className="divide-y divide-tm-border">
            <CheckRow c={checks[0]} lang={lang} />
            <CheckRow
              c={{
                label: L("Declared location vs map", "Ubicación declarada vs mapa"),
                ok: place === undefined || place === null ? null : place.toLowerCase().includes((app?.location?.value ?? "").toLowerCase().match(/vir[uú]/)?.[0] ?? "§"),
                value: {
                  en: `Declared: ${app?.location?.value ?? "–"} · Map: ${place ?? (place === null ? "lookup unavailable" : "looking up…")}`,
                  es: `Declarada: ${app?.location?.value ?? "–"} · Mapa: ${place ?? (place === null ? "consulta no disponible" : "consultando…")}`,
                },
              }}
              lang={lang}
            />
          </ul>
          <StepNav step={step} onStep={setStep} onCancel={onCancel} lang={lang} next={() => setStep(3)} />
        </Section>
      )}

      {step === 3 && deal && (
        <Section
          lang={lang}
          title={L("Verification", "Verificación")}
          hint={L(`Satellite and climate checks on the data available on ${deal.approvalDate}, and registry results as of ${deal.checksDate}.`, `Controles satelitales y climáticos con los datos disponibles al ${deal.approvalDate}, y resultados de registros al ${deal.checksDate}.`)}
        >
          <ul className="divide-y divide-tm-border">
            {checks.slice(1).map((c, i) => (
              <CheckRow key={i} c={c} lang={lang} />
            ))}
          </ul>
          <StepNav step={step} onStep={setStep} onCancel={onCancel} lang={lang} next={() => setStep(4)} />
        </Section>
      )}

      {step === 4 && deal && sim && (
        <div className="space-y-4">
          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-tm-text-muted">{lang === "es" ? "Recomendación" : "Recommendation"}</p>
            <p className="mt-1 text-xl font-semibold text-tm-black">
              {sim.origination.tier === "VETO"
                ? lang === "es"
                  ? "Rechazar: no supera un control de veto"
                  : "Decline: fails a veto check"
                : `${tb(RECOMMENDATION_TEXT[recommendationFor(sim.origination.tier)], lang)} · ${sim.origination.composite} · ${sim.origination.tier}`}
            </p>
            <p className="mt-1 text-sm text-tm-text-light">
              {formatUsd(deal.envelopeUsd, lang)} · {deal.tenorDays} {lang === "es" ? "días" : "days"} · {lang === "es" ? "primer desembolso" : "first disbursement"} {formatDate(deal.approvalDate, lang)}
              {sim.origination.pricingPct !== null && ` · ${formatRate(sim.origination.pricingPct, lang)}`}
            </p>
            <StepNav
              step={step}
              onStep={setStep}
              onCancel={onCancel}
              lang={lang}
              next={() => onRegister(deal)}
              label={deal.status === "closed" ? L("Open the file and review the campaign", "Abrir el expediente y revisar la campaña") : L("Open the file", "Abrir el expediente")}
            />
          </Card>
          <ScorePanel deal={deal} origination={sim.origination} current={sim.origination} asOf={deal.approvalDate} lang={lang} />
        </div>
      )}
    </div>
  );
}
