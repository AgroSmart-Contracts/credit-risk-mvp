import { useState } from "react";
import { ChevronDown, ShieldAlert } from "lucide-react";
import { ScoreGauge } from "../ScoreGauge";
import { formatDate, formatRate, formatUsd, sourceName, t, tb } from "../../lib/pre-harvest/i18n";
import type { Bilingual, DimensionKey, DimensionScore, Lang, PreHarvestAssessment, PreHarvestDeal } from "../../lib/pre-harvest/types";
import { Card, SourceBadge } from "./ui";
import { gaugeTier } from "./theme";

const DIMENSION_TEXT: Record<DimensionKey, { title: Bilingual; question: Bilingual }> = {
  production: {
    title: { en: "Production", es: "Producción" },
    question: { en: "Will the crop come in?", es: "¿Saldrá la cosecha?" },
  },
  operator: {
    title: { en: "Operator", es: "Operador" },
    question: { en: "Can this grower execute and repay?", es: "¿Puede el productor ejecutar y pagar?" },
  },
  structure: {
    title: { en: "Structure", es: "Estructura" },
    question: { en: "Loan-to-value, tranches, insurance", es: "Loan-to-value, tramos, seguros" },
  },
  counterparty: {
    title: { en: "Counterparty", es: "Contraparte" },
    question: { en: "Buyer risk", es: "Riesgo comprador" },
  },
};

function DimensionRow({
  dim,
  origin,
  lang,
  checksDate,
}: {
  dim: DimensionScore;
  origin: DimensionScore | undefined;
  lang: Lang;
  checksDate: string;
}) {
  const [open, setOpen] = useState(false);
  const text = DIMENSION_TEXT[dim.key];
  const delta = origin ? dim.score - origin.score : 0;

  if (dim.dormant) {
    return (
      <div className="rounded-lg border border-dashed border-tm-border px-3 py-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-tm-text-light">
            {tb(text.title, lang)} <span className="text-xs text-tm-text-muted">(0% {t("weight", lang)})</span>
          </span>
          <span className="text-xs font-semibold uppercase text-tm-text-muted">M3</span>
        </div>
        <p className="mt-1 text-xs text-tm-text-muted">{t("dormant", lang)}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <div>
          <span className="text-sm font-medium text-tm-black">{tb(text.title, lang)}</span>{" "}
          <span className="text-xs text-tm-text-muted">
            ({Math.round(dim.weight * 100)}% {t("weight", lang)}) · {tb(text.question, lang)}
          </span>
        </div>
        <span className="font-display text-lg text-tm-black">
          {dim.score}
          {delta !== 0 && (
            <span className={`ml-1 text-xs font-semibold ${delta < 0 ? "text-tm-danger-dark" : "text-tm-primary-dark"}`}>
              {delta > 0 ? "+" : ""}
              {delta}
            </span>
          )}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-tm-neutral">
        <div className="h-full rounded-full bg-tm-text-light transition-all duration-700" style={{ width: `${dim.score}%` }} />
      </div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-tm-text-light hover:text-tm-black"
        aria-expanded={open}
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        {open ? t("hideReasons", lang) : t("showReasons", lang)}
      </button>
      {open && (
        <ul className="mt-2 divide-y divide-tm-border rounded-lg border border-tm-border bg-tm-neutral-light text-xs">
          <li className="flex justify-between px-3 py-1.5 text-tm-text-light">
            <span>{t("basePts", lang)}</span>
            <span className="font-semibold">{dim.base}</span>
          </li>
          {dim.lines.map((line, i) => (
            <li key={i} className="flex items-start justify-between gap-3 px-3 py-1.5">
              <div className="min-w-0">
                <p className="font-medium text-tm-black">{tb(line.label, lang)}</p>
                <p className="text-tm-text-light">
                  {tb(line.value, lang)} · <span className="text-tm-text-muted">{sourceName(line.source.name, lang)}</span>{" "}
                  <SourceBadge
                    status={line.source.status}
                    lang={lang}
                    date={line.source.status === "verified" ? checksDate : undefined}
                  />
                </p>
              </div>
              <span
                className={`shrink-0 font-semibold ${line.points > 0 ? "text-tm-primary-dark" : line.points < 0 ? "text-tm-danger-dark" : "text-tm-text-muted"}`}
              >
                {line.points > 0 ? "+" : ""}
                {line.points}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ScorePanel({
  deal,
  origination,
  current,
  asOf,
  lang,
}: {
  deal: PreHarvestDeal;
  origination: PreHarvestAssessment;
  current: PreHarvestAssessment;
  asOf: string;
  lang: Lang;
}) {
  const changed = current.composite !== origination.composite || current.tier !== origination.tier;
  return (
    <Card>
      {current.vetoed && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-tm-danger-dark bg-tm-danger-dark/10 px-4 py-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-tm-danger-dark" />
          <div>
            <p className="text-sm font-semibold text-tm-danger-dark">{t("vetoReasons", lang)}</p>
            <ul className="mt-1 list-inside list-disc text-xs text-tm-danger-dark/90">
              {current.vetoReasons.map((r) => (
                <li key={r.en}>{tb(r, lang)}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="flex flex-col items-center lg:w-60">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-tm-text-muted">
            {changed ? `${t("scoreNow", lang)} ${formatDate(asOf, lang)}` : t("scoreAtOrigination", lang)}
          </p>
          <ScoreGauge score={current.composite} tier={gaugeTier(current.tier)} />
          <p className="mt-3 text-sm font-semibold text-tm-black">
            {t("tier", lang)} {current.tier}
            {changed && (
              <span className="ml-1 text-xs font-normal text-tm-text-light">
                ({t("scoreAtOrigination", lang).toLowerCase()}: {origination.composite} · {origination.tier})
              </span>
            )}
          </p>
          <dl className="mt-4 grid w-full grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <dt className="text-tm-text-muted">{t("envelope", lang)}</dt>
            <dd className="text-right font-medium text-tm-black">{formatUsd(deal.envelopeUsd, lang)}</dd>
            <dt className="text-tm-text-muted">{t("ltv", lang)}</dt>
            <dd className="text-right font-medium text-tm-black">{current.ltvPct.toFixed(0)}%</dd>
            <dt className="text-tm-text-muted">{t("tenor", lang)}</dt>
            <dd className="text-right font-medium text-tm-black">
              {deal.tenorDays} {t("days", lang)}
            </dd>
            <dt className="text-tm-text-muted">{t("pricing", lang)}</dt>
            <dd className="text-right font-medium text-tm-black">
              {origination.pricingPct === null ? t("manualPricing", lang) : formatRate(origination.pricingPct, lang)}
            </dd>
          </dl>
        </div>
        <div className="flex-1 space-y-5">
          {current.dimensions.map((dim) => (
            <DimensionRow
              key={dim.key}
              dim={dim}
              origin={origination.dimensions.find((d) => d.key === dim.key)}
              lang={lang}
              checksDate={deal.checksDate}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}
