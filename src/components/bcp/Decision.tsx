/**
 * A pending bank conformity, with what is at stake, the
 * checklist, the coverage and TruMarket's recommendation. The bank answers with
 * "Dar conformidad" or "Pedir información"; the answer is recorded with its date.
 */
import { useState } from "react";
import { COVERAGE_BANDS, cov, date, shocked, usd } from "../../lib/bcp/calc";
import type { Decision, Loan } from "../../lib/bcp/types";
import type { Answer } from "./answers";
import { useLang, useT, useToast } from "./shared";
import { BANK_EDITION } from "./edition";
import { Btn, Card, CheckIcon, StateChip } from "./ui";

export function DecisionBlock({ loan, decision, answer, onAnswer, cutoff, onOpen }: { loan: Loan; decision: Decision; answer?: Answer; onAnswer: (a: Answer) => void; cutoff: string; onOpen?: () => void }) {
  const t = useT();
  const lang = useLang();
  const tranche = loan.tranches.find((x) => x.status === "pendiente");
  // A conformity opens on its milestone date (e.g. after the field estimate).
  const open = decision.date <= cutoff;
  const done = tranche ? tranche.checklist.filter((c) => c.status === "ok").length : 0;
  const [showList, setShowList] = useState(false);
  const toast = useToast();
  // What the decision does to the money: exposure after the release, and a price-drop check.
  const after = loan.disbursedUsd + (tranche?.amountUsd ?? 0);
  const p20 = shocked(loan.coverageToday, -0.2);
  const ready = !!tranche && tranche.checklist.every((c) => c.status === "ok" || /conformidad del banco|bank conformity/i.test(c.label.es));
  const answerWith = (kind: Answer["kind"]) => {
    onAnswer({ kind, at: new Date().toISOString() });
    toast(
      kind === "conformidad"
        ? t(`Conformidad registrada · ${loan.id} ${tranche?.id ?? ""} ${tranche ? usd(tranche.amountUsd) : ""}`, `Conformity recorded · ${loan.id} ${tranche?.id ?? ""} ${tranche ? usd(tranche.amountUsd) : ""}`)
        : t(`Solicitud enviada a TruMarket · ${loan.id}`, `Request sent to TruMarket · ${loan.id}`),
    );
  };
  return (
    <Card tone="decision">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-bold text-bcp-ink">
            {loan.id} · {t(decision.title)}
          </h3>
          <p className="lbl mt-0.5">
            {decision.dueDate ? t(`Vence ${date(decision.dueDate, "es")}`, `Due ${date(decision.dueDate, "en")}`) : null}
          </p>
        </div>
        <StateChip state={loan.state} />
      </div>
      <p className="mt-2 text-sm text-bcp-ink">{t(decision.basis)}</p>
      <dl className="mt-3 grid gap-4 border-y border-bcp-divider py-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="lbl">{t("Checklist", "Checklist")}</dt>
          <dd className="num font-semibold">
            {tranche ? `${done} ${t("de", "of")} ${tranche.checklist.length}` : t("n/d", "n/a")}
            {tranche && (
              <button type="button" onClick={() => setShowList((v) => !v)} aria-expanded={showList} className="ml-2 text-xs font-semibold text-bcp-green-text hover:underline print:hidden">
                {showList ? t("ocultar", "hide") : t("ver", "view")}
              </button>
            )}
          </dd>
        </div>
        <div>
          <dt className="lbl">{t("Cobertura de repago", "Repayment coverage")}</dt>
          <dd className="num text-[20px] font-bold">{cov(loan.coverageToday)}</dd>
          <dd className="lbl">{t(`aprobación ${cov(loan.coverageAtApproval)}`, `approval ${cov(loan.coverageAtApproval)}`)}</dd>
        </div>
        <div>
          <dt className="lbl">{t("Exposición tras liberar", "Exposure after release")}</dt>
          <dd className="num text-[20px] font-bold">{tranche ? usd(after) : t("n/d", "n/a")}</dd>
          <dd className="lbl">{t(`hoy ${usd(loan.disbursedUsd)}`, `today ${usd(loan.disbursedUsd)}`)}</dd>
        </div>
        <div>
          <dt className="lbl">{t("Recomendación TruMarket", "TruMarket recommendation")}</dt>
          <dd className={`text-[20px] font-bold ${ready ? "text-bcp-green-text" : "text-bcp-ink"}`}>{ready ? t("Conformidad", "Conformity") : t("Esperar el aforo", "Wait for the estimate")}</dd>
          <dd className="lbl">{ready ? t("por el monto completo", "for the full amount") : t("monto final sobre el volumen verificado", "final amount on the verified volume")}</dd>
        </div>
      </dl>
      {tranche && (
        <p className="mt-3 text-sm">
          {t(
            `Si el precio cae 20%, la cobertura queda en ${cov(p20)}${p20 >= COVERAGE_BANDS.ambar ? ", aún sobre el umbral" : ", bajo el umbral ámbar"}.`,
            `If the price falls 20%, coverage would be ${cov(p20)}${p20 >= COVERAGE_BANDS.ambar ? ", still above the threshold" : ", below the amber threshold"}.`,
          )}
        </p>
      )}
      {tranche && showList && (
        <ul className="mt-3 space-y-1 text-sm">
          {tranche.checklist.map((c, i) => (
            <li key={i} className="flex gap-2">
              <CheckIcon status={c.status} />
              <span>{t(c.label)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {answer ? (
          <Stamp text={answer.kind === "conformidad" ? t("Conformidad registrada", "Conformity recorded") : t("Información solicitada", "Information requested")} when={date(answer.at.slice(0, 10), lang)} />
        ) : BANK_EDITION ? null : (
          <>
            <Btn disabled={!open} onClick={() => answerWith("info")}>
              {t("Pedir información", "Request information")}
            </Btn>
            <Btn primary disabled={!open} onClick={() => answerWith("conformidad")}>
              {t("Dar conformidad", "Give conformity")}
            </Btn>
            {!open && <span className="lbl">{t(`Se habilita el ${date(decision.date, "es", false)}`, `Opens on ${date(decision.date, "en", false)}`)}</span>}
          </>
        )}
        {onOpen && (
          <button type="button" onClick={onOpen} className="ml-auto min-h-[44px] text-sm font-semibold text-bcp-ink hover:underline">
            {t("Abrir expediente", "Open file")} →
          </button>
        )}
      </div>
    </Card>
  );
}

/** The bank's answer, shown as a stamp on the decision. */
export function Stamp({ text, when }: { text: string; when: string }) {
  return (
    <span className="inline-flex -rotate-2 items-center gap-2 rounded-md border-2 border-bcp-green-text px-2.5 py-1.5 font-[Arial,Helvetica,sans-serif] text-[12px] font-bold uppercase tracking-wide text-bcp-green-text">
      ✓ {text} · {when}
    </span>
  );
}
