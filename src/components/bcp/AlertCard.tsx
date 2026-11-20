/**
 * Alert card, impact first (spec 6.3). Two levels only: the money view, and
 * "Ver por qué" with one plain-language row per cause. Technical readings stay
 * in the file's audit log.
 */
import { useState } from "react";
import { COVERAGE_BANDS, cov, date, range, signedCov, stateFromCoverage, toDisburse, usd } from "../../lib/bcp/calc";
import type { Loan } from "../../lib/bcp/types";
import { Estimado, StateChip } from "./ui";
import { useEvidence, useLang, useT } from "./shared";

const CAUSE_CHIP = {
  confirmado: { es: "Confirmado", en: "Confirmed", cls: "bg-bcp-ink text-white" },
  observacion: { es: "En observación", en: "Under watch", cls: "bg-bcp-divider text-bcp-ink" },
  bajo_control: { es: "Bajo control", en: "Under control", cls: "bg-bcp-verde-bg text-bcp-green-text" },
} as const;

export function AlertCard({ loan, onOpen }: { loan: Loan; onOpen: () => void }) {
  const t = useT();
  const lang = useLang();
  const [why, setWhy] = useState(false);
  const openEvidence = useEvidence();
  const margin = Math.round((loan.coverageToday - COVERAGE_BANDS.ambar) * 100) / 100;
  const pending = loan.decisions.find((d) => d.lane === "bank" && !d.conformityDate);
  const p = loan.projection;
  const projState = p ? stateFromCoverage(p.low) : null;
  const tmDoes =
    loan.state === "naranja"
      ? { h: t("Tramo congelado", "Tranche frozen"), s: t(`El T3 de ${usd(loan.frozenUsd)} no se desembolsa hasta verificar la remediación.`, `The T3 of ${usd(loan.frozenUsd)} is not disbursed until remediation is verified.`) }
      : loan.state === "ambar"
        ? { h: t("Seguimiento reforzado", "Reinforced follow-up"), s: t("El T2 se calcula sobre el volumen verificado en el aforo, no sobre lo declarado.", "T2 is sized on the volume verified in the field estimate, not on the declaration.") }
        : { h: t("Monitoreo regular", "Regular monitoring"), s: t("Cada tramo se desembolsa solo contra su checklist y la conformidad del banco.", "Each tranche is disbursed only against its checklist and the bank's conformity.") };
  const vol = loan.expectedVolumeChangePct;

  return (
    <article className="rounded-xl border border-bcp-border bg-white p-4 sm:p-5">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <StateChip state={loan.state} />
        <span className="text-sm font-semibold text-bcp-ink">
          {loan.id} · {t(loan.crop)} · {t(loan.zone)}
        </span>
        <span className="lbl ml-auto">{date(loan.stateSince, lang)}</span>
      </header>

      {/* Three hero numbers */}
      <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_1fr]">
        <div className={`rounded-lg p-4 ${vol < 0 ? "bg-bcp-ambar-bg" : "bg-bcp-divider"}`}>
          <p className="lbl">{t("Volumen esperado", "Expected volume")}</p>
          <p className="num text-[52px] font-extrabold leading-none text-bcp-ink">
            {vol > 0 ? "+" : vol < 0 ? "-" : ""}
            {Math.abs(vol)}%
          </p>
          <p className="mt-1 text-sm text-bcp-muted">{t("vs lo declarado al aprobar", "vs declared at approval")}</p>
        </div>
        <div className="rounded-lg bg-bcp-divider p-4">
          <p className="lbl">{t("Cobertura de repago", "Repayment coverage")}</p>
          <p className="num flex items-baseline gap-3 leading-none">
            <span className="text-[32px] font-bold text-bcp-muted">{cov(loan.coverageAtApproval)}</span>
            <span aria-hidden className="text-2xl text-bcp-muted">→</span>
            <span className="text-[52px] font-extrabold text-bcp-ink">{cov(loan.coverageToday)}</span>
          </p>
          <p className="mt-1 text-sm text-bcp-muted">
            {t(`el ingreso esperado de cosecha cubre ${loan.coverageToday.toFixed(2)} veces el saldo adeudado`, `expected harvest revenue covers ${loan.coverageToday.toFixed(2)} times the amount due`)}
          </p>
        </div>
        <div className={`rounded-lg p-4 ${margin >= 0 ? "bg-bcp-verde-bg" : "bg-bcp-naranja-bg"}`}>
          <p className="lbl">{t("Margen sobre el umbral", "Margin over the threshold")}</p>
          <p className="num text-[52px] font-extrabold leading-none text-bcp-ink">{signedCov(margin)}</p>
          <p className="mt-1 text-sm text-bcp-muted">{t("umbral ámbar 1.50x", "amber threshold 1.50x")}</p>
        </div>
      </div>

      {p && (
        <p className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-bcp-fill-strong px-3 py-2 text-sm text-bcp-ink">
          <Estimado />
          <span>
            {t("Si", "If")} {t(p.cause).replace(/^si /, "")}, {t("la cobertura podría bajar a", "coverage could fall to")} <b>{range(p.low, p.high, lang)}</b>.{" "}
            {projState === "verde"
              ? t("Seguiría sobre el umbral.", "It would stay above the threshold.")
              : t(`Entraría en zona ${projState === "rojo" ? "roja" : projState === "naranja" ? "naranja" : "ámbar"}.`, `It would enter the ${projState} zone.`)}{" "}
            {/aforo/i.test(loan.next.label.es) && t(`El aforo del ${date(loan.next.date, "es", false)} lo confirma.`, `The ${date(loan.next.date, "en", false)} field estimate confirms it.`)}
          </span>
        </p>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {[
          { h: t("Exposición del banco", "Bank exposure"), big: usd(loan.disbursedUsd), s: loan.frozenUsd ? t(`desembolsado. ${usd(loan.frozenUsd)} congelado; ${usd(toDisburse(loan))} solo se desembolsan contra hitos verificados.`, `disbursed. ${usd(loan.frozenUsd)} frozen; ${usd(toDisburse(loan))} is disbursed only against verified milestones.`) : t(`desembolsado. Los ${usd(toDisburse(loan))} restantes solo se desembolsan contra hitos verificados.`, `disbursed. The remaining ${usd(toDisburse(loan))} is disbursed only against verified milestones.`) },
          { h: t("Acción de TruMarket", "TruMarket action"), big: tmDoes.h, s: tmDoes.s },
          { h: t("Decisión del banco", "Bank decision"), big: pending ? t("Conformidad", "Conformity") : t("Ninguna hoy", "None today"), s: pending ? t(`${t(pending.title)}. Vence ${date(pending.dueDate ?? pending.date, "es")}.`, `${t(pending.title)}. Due ${date(pending.dueDate ?? pending.date, "en")}.`) : t(loan.next.label) },
        ].map((c) => (
          <div key={c.h} className="border-t-[3px] border-bcp-ink pt-2">
            <p className="lbl">{c.h}</p>
            <p className="text-lg font-bold text-bcp-ink">{c.big}</p>
            <p className="text-sm text-bcp-muted">{c.s}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold">
        <button type="button" onClick={() => setWhy((v) => !v)} aria-expanded={why} className="min-h-[44px] text-bcp-green-text underline-offset-2 hover:underline">
          {why ? t("Ocultar causas", "Hide drivers") : t("Ver causas", "View drivers")}
        </button>
        <button type="button" onClick={onOpen} className="min-h-[44px] text-bcp-ink underline-offset-2 hover:underline">
          {t("Abrir expediente", "Open file")} →
        </button>
      </div>

      {why && (
        <div className="mt-2 border-t border-bcp-divider pt-3">
          <ul className="divide-y divide-bcp-divider">
            {loan.causes.map((c, i) => (
              <li key={i} className="flex flex-wrap items-start gap-3 py-2 text-sm">
                <span className={`shrink-0 rounded-full px-2.5 py-[3px] font-[Arial,Helvetica,sans-serif] text-[12px] font-bold ${CAUSE_CHIP[c.status].cls}`}>{CAUSE_CHIP[c.status][lang]}</span>
                <span className="min-w-0 flex-1 text-bcp-ink">{t(c.text)}</span>
                <span className="num shrink-0 font-semibold text-bcp-ink">{t(c.effect)}</span>
                {c.condition && (
                  <button type="button" onClick={() => openEvidence(loan.id, c.condition!)} className="shrink-0 text-xs font-semibold text-bcp-green-text underline-offset-2 hover:underline">
                    {t("Evidencia", "Evidence")} ›
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="lbl mt-2">
            {t(
              "Las lecturas técnicas, la regla aplicada y la versión del motor quedan en el registro de auditoría del expediente.",
              "Technical readings, the rule applied and the engine version stay in the file's audit log.",
            )}
          </p>
        </div>
      )}
    </article>
  );
}
