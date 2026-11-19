/**
 * Evidence drawer: the technical detail behind one condition, from the right,
 * with the page still in view. It opens on what the reading does to repayment,
 * then the history (when there is a series), the reading itself, where it comes
 * from, and the rule applied.
 */
import { lazy, Suspense, useEffect, useMemo, useRef } from "react";
import { PORTFOLIO } from "../../data/bcp/dataset";
import { SERIES_OF_CONDITION, technicalSeries } from "../../data/bcp/technical";
import { date } from "../../lib/bcp/calc";
import type { Condition, Loan } from "../../lib/bcp/types";
import { PROV_TEXT, useT } from "./shared";
import { Prov, StateChip } from "./ui";

const TechChart = lazy(() => import("./TechCharts").then((m) => ({ default: m.TechChart })));

const AFFECTS: Record<Condition["group"], { es: string; en: string }> = {
  Prestatario: { es: "Capacidad de pago del productor", en: "The grower's capacity to repay" },
  "Cultivo y volumen": { es: "Volumen de cosecha que paga el préstamo", en: "Harvest volume that repays the loan" },
  "Precio y calidad": { es: "Precio y fruta exportable: ingreso de la cosecha", en: "Price and exportable fruit: harvest revenue" },
  "Uso de fondos y cobranza": { es: "Uso de los fondos y cobro del repago", en: "Use of funds and collection of repayment" },
};

export function EvidenceDrawer({ loanId, condition, onClose }: { loanId: string; condition: string; onClose: () => void }) {
  const t = useT();
  const closeRef = useRef<HTMLButtonElement>(null);
  const loan = PORTFOLIO.loans.find((l) => l.id === loanId) as Loan | undefined;
  const c = loan?.conditions.find((x) => x.label.es === condition);
  const seriesId = c ? SERIES_OF_CONDITION[c.label.es] : undefined;
  const series = useMemo(() => (loan && seriesId ? technicalSeries(loan, PORTFOLIO.cutoff) : null), [loan, seriesId]);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  if (!loan || !c) return null;
  const none = c.effectOnRepayment.es === "Ninguno";
  const conf = c.state === "observacion" ? t("En observación", "Under watch") : c.provenance === "estimado" ? t("Estimado", "Estimated") : t("Confirmado", "Confirmed");
  const reviewed =
    c.state === "verde"
      ? t("No requerida: sin desvío", "Not required: no deviation")
      : c.state === "observacion"
        ? t("Alerta temprana: se confirma en campo antes de cambiar el estado", "Early warning: confirmed in the field before the state changes")
        : loan.auditLog.some((a) => /analista/i.test(a.responsible.es))
          ? t("Sí: el cambio de estado lo confirmó un analista de TruMarket", "Yes: the change of state was confirmed by a TruMarket analyst")
          : t("Pendiente de confirmación", "Pending confirmation");
  const rows: Array<[string, React.ReactNode]> = [
    [t("Qué pasó", "What happened"), `${t(c.atApproval)} → ${t(c.today)}`],
    [t("Umbral", "Threshold"), t(c.threshold)],
    [t("Estado", "State"), <StateChip key="s" state={c.state} />],
    [t("Qué afecta", "What it affects"), t(AFFECTS[c.group])],
    [t("Verificado o estimado", "Verified or estimated"), t(PROV_TEXT[c.provenance])],
    [t("Fuente y fecha", "Source and date"), t(c.source)],
    [t("Revisión humana", "Human review"), reviewed],
  ];

  return (
    <div className="bcp fixed inset-0 z-[1200] print:hidden" role="presentation">
      <div className="absolute inset-0 bg-bcp-ink/35" onClick={onClose} aria-hidden />
      <aside role="dialog" aria-modal="true" aria-labelledby="evidence-title" className="absolute right-0 top-0 flex h-full w-[min(560px,100vw)] flex-col overflow-y-auto bg-white shadow-[-12px_0_32px_rgba(16,42,64,0.15)]">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-bcp-border bg-white px-6 pb-3 pt-5">
          <div>
            <p className="font-[Arial,Helvetica,sans-serif] text-[12px] font-bold uppercase tracking-[0.06em] text-bcp-muted">{t("Datos técnicos", "Technical data")}</p>
            <h2 id="evidence-title" className="mt-1 text-[20px] font-bold leading-tight">
              {t(c.label)}
            </h2>
            <p className="lbl">
              {loan.id} · {t(loan.zone)}
            </p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="min-h-[44px] rounded-lg border border-bcp-border px-4 text-sm font-semibold hover:border-bcp-ink">
            {t("Cerrar", "Close")}
          </button>
        </header>
        <div className="space-y-5 px-6 pb-10 pt-5">
          {/* The money first: what this reading does to repayment. */}
          <div className="rounded-xl bg-bcp-ink px-4 py-3.5 text-white">
            <p className="font-[Arial,Helvetica,sans-serif] text-[12px] text-bcp-label">{t("Efecto en el repago", "Effect on repayment")}</p>
            <p className="mt-1 text-[18px] font-bold leading-snug">{none ? t("Ninguno por ahora", "None so far") : t(c.effectOnRepayment)}</p>
            <span className="mt-2 inline-flex rounded-full bg-white/15 px-2.5 py-[3px] font-[Arial,Helvetica,sans-serif] text-[12px] font-bold">{conf}</span>
          </div>

          {series && seriesId && (
            <Suspense fallback={<div className="h-64 rounded-lg bg-bcp-fill" aria-busy="true" />}>
              <TechChart id={seriesId} s={series} loan={loan} cutoff={PORTFOLIO.cutoff} />
            </Suspense>
          )}

          <dl className="divide-y divide-bcp-divider text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2">
                <dt className="lbl shrink-0">{k}</dt>
                <dd className="text-right font-semibold">{v}</dd>
              </div>
            ))}
          </dl>

          <p className="flex flex-wrap items-center gap-2">
            <Prov p={c.provenance} />
            <span className="lbl">{t(c.source)}</span>
          </p>
          <p className="lbl">
            {t(
              `Las lecturas técnicas no cambian el estado por sí solas. El estado se fija con datos confirmados; la regla y la versión del motor (${PORTFOLIO.engineVersion}) quedan en el registro de auditoría. Datos al ${date(PORTFOLIO.cutoff, "es")}.`,
              `Technical readings never change the state on their own. The state is set on confirmed data; the rule and the engine version (${PORTFOLIO.engineVersion}) stay in the audit log. Data as of ${date(PORTFOLIO.cutoff, "en")}.`,
            )}
          </p>
        </div>
      </aside>
    </div>
  );
}
