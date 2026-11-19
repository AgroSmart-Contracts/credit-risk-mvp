import { useEffect, useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { t, tb, type StringKey } from "../../lib/pre-harvest/i18n";
import type { Formato, Lang, MonitoringData, PreHarvestDeal, SourceStatus } from "../../lib/pre-harvest/types";
import { Card, SectionTitle, SourceBadge } from "./ui";

type NumKey = {
  [K in keyof Formato]: Formato[K] extends number ? K : never;
}[keyof Formato];

/** [field, label, step, must be > 0]. Divisors (area, yield, need, cost) cannot be 0. */
const NUMBER_FIELDS: Array<[NumKey, StringKey, number, boolean]> = [
  ["areaHa", "areaHa", 0.5, true],
  ["orchardAgeYears", "orchardAge", 1, false],
  ["declaredYieldTPerHa", "declaredYield", 0.5, true],
  ["waterAllocationM3PerHa", "waterAllocation", 100, false],
  ["cropWaterNeedM3PerHa", "waterNeed", 100, true],
  ["salinityEcDsM", "salinity", 0.1, false],
  ["campaignCostUsd", "campaignCost", 1000, true],
  ["packhouseUtilizationPct", "packhouseUtil", 1, false],
];

/**
 * Number input that keeps the typed text locally and only commits valid values,
 * so clearing a field or typing "0." does not push 0 into the score.
 */
function NumberInput({
  value,
  step,
  positive,
  onCommit,
}: {
  value: number;
  step: number;
  positive: boolean;
  onCommit: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  // Follow outside changes (e.g. "Reset inputs").
  useEffect(() => {
    setText((prev) => (Number(prev) === value ? prev : String(value)));
  }, [value]);
  const n = Number(text);
  const valid = text.trim() !== "" && Number.isFinite(n) && (positive ? n > 0 : n >= 0);
  return (
    <input
      type="number"
      inputMode="decimal"
      className={`${inputClass} ${valid ? "" : "border-tm-danger focus:border-tm-danger"}`}
      value={text}
      step={step}
      min={0}
      aria-invalid={!valid}
      onChange={(e) => {
        setText(e.target.value);
        const v = Number(e.target.value);
        if (e.target.value.trim() !== "" && Number.isFinite(v) && (positive ? v > 0 : v >= 0)) onCommit(v);
      }}
      onBlur={() => {
        if (!valid) setText(String(value));
      }}
    />
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-tm-text-light">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const TENURE_TEXT = {
  owned: { en: "Owned", es: "Propia" },
  leased: { en: "Leased", es: "Arrendada" },
  informal: { en: "Informal", es: "Informal" },
} as const;

const inputClass =
  "w-full rounded-md border border-tm-border bg-tm-surface px-2.5 py-1.5 text-sm text-tm-black focus:border-tm-primary focus:outline-none";

function Row({ name, detail, status, lang, date }: { name: string; detail: string; status: SourceStatus; lang: Lang; date?: string }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-tm-black">{name}</p>
        <p className="text-xs text-tm-text-light">{detail}</p>
      </div>
      <SourceBadge status={status} lang={lang} date={date} />
    </li>
  );
}

export function InputsPanel({
  deal,
  data,
  onChange,
  onReset,
  lang,
}: {
  deal: PreHarvestDeal;
  data: MonitoringData;
  onChange: (formato: Formato) => void;
  onReset: () => void;
  lang: Lang;
}) {
  const f = deal.formato;
  const c = deal.checks;
  const yesNo = (b: boolean) => (b ? t("yes", lang) : t("no", lang));
  const set = <K extends keyof Formato>(k: K, v: Formato[K]) => onChange({ ...f, [k]: v });

  return (
    <Card>
      <SectionTitle title={t("inputs", lang)} hint={t("inputsHint", lang)} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-tm-text-muted">{t("formato", lang)}</p>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 text-xs font-medium text-tm-text-light hover:text-tm-black"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t("resetInputs", lang)}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("growerName", lang)}>
              <input className={inputClass} value={`${f.growerName} · RUC ${f.ruc.slice(0, 2)}•••••••${f.ruc.slice(-2)}`} readOnly />
            </Field>
            <Field label={t("variety", lang)}>
              <input className={inputClass} value={f.variety} readOnly />
            </Field>
            {NUMBER_FIELDS.map(([key, label, step, positive]) => (
              <Field key={key} label={t(label, lang)}>
                <NumberInput value={f[key]} step={step} positive={positive} onCommit={(v) => set(key, v)} />
              </Field>
            ))}
            {f.revenueLast3CampaignsUsd.map((v, i) => (
              <Field key={i} label={`${t("revenue", lang)} ${i + 1}/3`}>
                <NumberInput
                  value={v}
                  step={1000}
                  positive={false}
                  onCommit={(n) => {
                    const next = [...f.revenueLast3CampaignsUsd] as Formato["revenueLast3CampaignsUsd"];
                    next[i] = n;
                    set("revenueLast3CampaignsUsd", next);
                  }}
                />
              </Field>
            ))}
            <Field label={t("packhouseContract", lang)}>
              <select className={inputClass} value={String(f.hasPackhouseContract)} onChange={(e) => set("hasPackhouseContract", e.target.value === "true")}>
                <option value="true">{t("yes", lang)}</option>
                <option value="false">{t("no", lang)}</option>
              </select>
            </Field>
            <Field label={t("exportsDirectly", lang)}>
              <select className={inputClass} value={String(f.exportsDirectly)} onChange={(e) => set("exportsDirectly", e.target.value === "true")}>
                <option value="true">{t("yes", lang)}</option>
                <option value="false">{t("no", lang)}</option>
              </select>
            </Field>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-tm-text-muted">{t("thirdParty", lang)}</p>
            <ul className="divide-y divide-tm-border">
              <Row lang={lang} name="SUNAT · RUC" detail={`${c.ruc.active ? "ACTIVO" : "NO ACTIVO"} · ${c.ruc.habido ? "HABIDO" : "NO HABIDO"}`} status={c.ruc.status} date={deal.checksDate} />
              <Row lang={lang} name="SUNARP" detail={`${TENURE_TEXT[c.sunarp.tenure][lang]} · ${c.sunarp.liens} ${lang === "es" ? "gravamen(es)" : "lien(s)"}`} status={c.sunarp.status} date={deal.checksDate} />
              <Row lang={lang} name={c.credit.bureau} detail={`${c.credit.rating} · ${c.credit.protestedDebts} ${lang === "es" ? "protestos" : "protested debts"}`} status={c.credit.status} date={deal.checksDate} />
              <Row lang={lang} name="ANA" detail={`${c.ana.licenceId} · ${c.ana.licenceValid ? (lang === "es" ? "vigente" : "valid") : lang === "es" ? "no vigente" : "invalid"}`} status={c.ana.status} date={deal.checksDate} />
              <Row lang={lang} name="SENASA" detail={tb(c.senasa.note, lang)} status={c.senasa.status} date={deal.checksDate} />
              <Row lang={lang} name={lang === "es" ? "Inspección en campo" : "Field inspection"} detail={tb(c.inspection.note, lang)} status={c.inspection.status} date={deal.inspectionDate} />
              <Row
                lang={lang}
                name={lang === "es" ? "Seguros (3 capas)" : "Insurance (3 layers)"}
                detail={`SAC ${yesNo(c.insurance.catastrophic)} · ${lang === "es" ? "Comercial" : "Commercial"} ${yesNo(c.insurance.commercial)} · ${lang === "es" ? "Paramétrico" : "Parametric"} ${yesNo(c.insurance.parametric)}`}
                status={c.insurance.status}
                date={deal.checksDate}
              />
              <Row lang={lang} name="MIDAGRI SIEA" detail={`${lang === "es" ? "Rendimiento pares" : "Peer yield"}: ${lang === "es" ? "mediana" : "median"} ${c.peerYieldTPerHa.median} t/ha · P75 ${c.peerYieldTPerHa.p75} t/ha`} status={c.peerYieldTPerHa.status} date={deal.checksDate} />
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-tm-text-muted">{t("dataSources", lang)}</p>
            <ul className="divide-y divide-tm-border">
              <Row lang={lang} name="Sentinel-2 NDVI" detail={`${data.ndvi.series.length} composites · ${data.ndvi.series[0]?.date} → ${data.ndvi.series.at(-1)?.date}`} status={data.status.ndvi} date={data.ndvi.fetchedAt.slice(0, 10)} />
              <Row lang={lang} name="Open-Meteo · NOAA Niño 1+2" detail={`${lang === "es" ? "Clima diario hasta" : "Daily weather to"} ${data.climate.weather.at(-1)?.date} · Niño 1+2 ${data.climate.enso.at(-1)?.month}`} status={data.status.climate} date={data.climate.fetchedAt.slice(0, 10)} />
              <Row lang={lang} name="Veritrade · UN Comtrade" detail={`${data.market.veritradeMonthly.length} + ${data.market.comtradeMonthly.length} ${lang === "es" ? "meses" : "months"} · HS ${data.market.hsCode}`} status={data.status.market} date={data.market.generatedAt.slice(0, 10)} />
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}
