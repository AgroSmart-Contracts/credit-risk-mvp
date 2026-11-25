/**
 * A pending bank sign-off, with what is at stake, the
 * checklist, the coverage and TruMarket's recommendation. The bank answers with
 * "Dar conformidad" or "Pedir información"; the answer is recorded with its date.
 */
import { useState } from "react";
import { COVERAGE_BANDS, STANDARD_STRESS, cov, coverageUnder, date, usd } from "../../lib/bcp/calc";
import type { Application, Decision, Loan } from "../../lib/bcp/types";
import type { Answer } from "./answers";
import { useLang, useT, useToast } from "./shared";
import { BANK_EDITION } from "./edition";
import { Btn, Card, CheckIcon, Chip, StateChip } from "./ui";

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
  const p20 = coverageUnder(loan, STANDARD_STRESS.price);
  // TruMarket's checklist only; the bank's sign-off is the decision itself, not an item on it.
  const ready = !!tranche && done === tranche.checklist.length;
  const answerWith = (kind: Answer["kind"]) => {
    onAnswer({ kind, at: new Date().toISOString() });
    toast(
      kind === "conformidad"
        ? t(`Conformidad registrada · ${loan.id} ${tranche?.id ?? ""} ${tranche ? usd(tranche.amountUsd) : ""}`, `Sign-off recorded · ${loan.id} ${tranche?.id ?? ""} ${tranche ? usd(tranche.amountUsd) : ""}`)
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
          <dt className="lbl">{t("Checklist TruMarket", "TruMarket checklist")}</dt>
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
          <dd className={`text-[20px] font-bold ${ready ? "text-bcp-green-text" : "text-bcp-ink"}`}>{ready ? t("Conformidad", "Sign-off") : t("Esperar el aforo", "Wait for the estimate")}</dd>
          <dd className="lbl">{ready ? t("por el monto completo", "for the full amount") : t("monto final sobre el volumen verificado", "final amount on the verified volume")}</dd>
        </div>
      </dl>
      {tranche && ready && !answer && <p className="mt-3 text-sm font-semibold">{t("Falta: su conformidad", "Missing: your sign-off")}</p>}
      {tranche && (
        <p className="mt-3 text-sm">
          {t(
            p20 >= COVERAGE_BANDS.ambar
              ? `Si el precio cae 20%, la cobertura queda en ${cov(p20)}, aún sobre ${cov(COVERAGE_BANDS.ambar)}.`
              : `Si el precio cae 20%, la cobertura queda en ${cov(p20)}, bajo ${cov(COVERAGE_BANDS.ambar)}. Condición propuesta: el monto del T3 se ajusta al precio esperado vigente en su hito.`,
            p20 >= COVERAGE_BANDS.ambar
              ? `If the price falls 20%, coverage would be ${cov(p20)}, still above ${cov(COVERAGE_BANDS.ambar)}.`
              : `If the price falls 20%, coverage would be ${cov(p20)}, below ${cov(COVERAGE_BANDS.ambar)}. Proposed condition: the T3 amount is resized to the expected price at its milestone.`,
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
          <Stamp text={answer.kind === "conformidad" ? t("Conformidad registrada", "Sign-off recorded") : t("Información solicitada", "Information requested")} when={date(answer.at.slice(0, 10), lang)} />
        ) : BANK_EDITION ? null : (
          <>
            <Btn disabled={!open} onClick={() => answerWith("info")}>
              {t("Pedir información", "Request information")}
            </Btn>
            <Btn primary disabled={!open} onClick={() => answerWith("conformidad")}>
              {t("Dar conformidad", "Give sign-off")}
            </Btn>
            {!open && <span className="lbl">{t(`Se habilita el ${date(decision.date, "es", false)}`, `Opens on ${date(decision.date, "en", false)}`)}</span>}
          </>
        )}
        {onOpen && (
          <span className="ml-auto">
            <Btn onClick={onOpen}>{t("Abrir expediente", "Open file")} →</Btn>
          </span>
        )}
      </div>
    </Card>
  );
}

/** An application waiting for the bank: what approving puts at stake and TruMarket's recommendation. */
export function AppDecisionBlock({ app, answered, onOpen }: { app: Application; answered?: string; onOpen: () => void }) {
  const t = useT();
  const rec =
    app.recommendation === "rechazar" ? <Chip tone="naranja">{t("Rechazo recomendado", "Decline recommended")}</Chip>
    : app.recommendation === "aprobar_condicion" ? <Chip tone="ambar">{t("Aprobación con condición", "Approval with a condition")}</Chip>
    : <Chip tone="green">{t("Aprobación recomendada", "Approval recommended")}</Chip>;
  const p20 = app.coverage === null ? null : coverageUnder(app, STANDARD_STRESS.price);
  return (
    <Card tone="decision">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-bold text-bcp-ink">
            {app.id} · {t(`Aprobar o rechazar ${usd(app.requestedUsd)}`, `Approve or decline ${usd(app.requestedUsd)}`)}
          </h3>
          <p className="lbl mt-0.5">{t(`Vence ${date(app.decisionDueDate, "es")}`, `Due ${date(app.decisionDueDate, "en")}`)}</p>
        </div>
        {app.veto ? <StateChip state="veto" /> : rec}
      </div>
      <p className="mt-2 text-sm text-bcp-ink">{t(app.summary)}</p>
      <dl className="mt-3 grid gap-4 border-y border-bcp-divider py-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="lbl">{t("Solicitado", "Requested")}</dt>
          <dd className="num text-[20px] font-bold">{usd(app.requestedUsd)}</dd>
        </div>
        <div>
          <dt className="lbl">{t("Cobertura a la solicitud", "Coverage at application")}</dt>
          <dd className="num text-[20px] font-bold">{app.coverage === null ? t("No verificable", "Not verifiable") : cov(app.coverage)}</dd>
        </div>
        <div>
          <dt className="lbl">{t("Si el precio cae 20%", "If the price falls 20%")}</dt>
          <dd className="num text-[20px] font-bold">{p20 === null ? "n/d" : cov(p20)}</dd>
        </div>
        <div>
          <dt className="lbl">{t("Recomendación TruMarket", "TruMarket recommendation")}</dt>
          <dd className="text-[16px] font-bold">{app.condition ? t(`Aprobar con ${usd(app.condition.lineUsd)}`, `Approve with ${usd(app.condition.lineUsd)}`) : app.recommendation === "rechazar" ? t("Rechazar", "Decline") : t("Aprobar", "Approve")}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {answered && <Stamp text={answered} when="" />}
        <span className="ml-auto">
          <Btn primary onClick={onOpen}>{t("Abrir solicitud", "Open application")} →</Btn>
        </span>
      </div>
    </Card>
  );
}

/** The bank's answer, shown as a stamp on the decision. */
export function Stamp({ text, when }: { text: string; when: string }) {
  return (
    <span className="inline-flex -rotate-2 items-center gap-2 rounded-md border-2 border-bcp-green-text px-2.5 py-1.5 font-[Arial,Helvetica,sans-serif] text-[12px] font-bold uppercase tracking-wide text-bcp-green-text">
      ✓ {text}{when ? ` · ${when}` : ""}
    </span>
  );
}
