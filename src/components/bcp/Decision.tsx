/**
 * A pending bank sign-off, with what is at stake, the
 * checklist, the coverage and TruMarket's recommendation. The bank answers with
 * a sign-off, a conditioned sign-off or a request for information, always with a
 * written reason; the answer is recorded with its date and that reason.
 */
import { useState } from "react";
import { COVERAGE_BANDS, STANDARD_STRESS, cov, coverageUnder, date, usd } from "../../lib/bcp/calc";
import type { Decision, Loan, State } from "../../lib/bcp/types";
import { useReason, type Answer, type Reason } from "./answers";
import { useLang, useT, useToast } from "./shared";
import { BANK_EDITION } from "./edition";
import { Btn, Card, CheckIcon, LockedBtn, StateChip } from "./ui";
import { PILOT_NOTE } from "./nav";

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
  const reason = useReason();
  const suggestion = !tranche
    ? t("Sin tramo pendiente.", "No tranche pending.")
    : !ready
      ? t(`Se espera el aforo del ${date(decision.date, "es", false)}; el monto final se fija sobre el volumen verificado.`, `Waiting for the ${date(decision.date, "en", false)} field estimate; the final amount is set on the verified volume.`)
      : p20 >= COVERAGE_BANDS.ambar
        ? t(`Checklist ${done} de ${tranche.checklist.length} completo; cobertura ${cov(loan.coverageToday)} y ${cov(p20)} con precio −20%. Conformidad por ${usd(tranche.amountUsd)}.`, `Checklist ${done} of ${tranche.checklist.length} complete; coverage ${cov(loan.coverageToday)} and ${cov(p20)} at price −20%. Sign-off for ${usd(tranche.amountUsd)}.`)
        : t(`Checklist ${done} de ${tranche.checklist.length} completo; con precio −20% la cobertura queda en ${cov(p20)}. Conformidad condicionada: el T3 se ajusta al precio esperado vigente en su hito.`, `Checklist ${done} of ${tranche.checklist.length} complete; at price −20% coverage would be ${cov(p20)}. Conditioned sign-off: T3 is resized to the expected price at its milestone.`);
  const answerWith = (kind: Answer["kind"]) => {
    if (!reason.ok()) return;
    onAnswer({ kind, at: new Date().toISOString(), note: reason.note });
    toast(
      kind === "info"
        ? t(`Solicitud enviada a TruMarket · ${loan.id}`, `Request sent to TruMarket · ${loan.id}`)
        : t(`${kind === "conformidad" ? "Conformidad" : "Conformidad condicionada"} registrada · ${loan.id} ${tranche?.id ?? ""} ${tranche ? usd(tranche.amountUsd) : ""}`, `${kind === "conformidad" ? "Sign-off" : "Conditioned sign-off"} recorded · ${loan.id} ${tranche?.id ?? ""} ${tranche ? usd(tranche.amountUsd) : ""}`),
    );
  };
  const stampText = answer?.kind === "conformidad" ? t("Conformidad registrada", "Sign-off recorded") : answer?.kind === "conformidad_condicion" ? t("Conformidad condicionada registrada", "Conditioned sign-off recorded") : t("Información solicitada", "Information requested");
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
      {!answer && !BANK_EDITION && (
        <div className="mt-4">
          <Rationale reason={reason} suggestion={suggestion} disabled={!open} placeholder={t("p. ej. Aforo y facturas del T1 conciliados; conformidad con T3 sujeto al precio FOB en su hito.", "e.g. Field estimate and T1 invoices reconciled; sign-off with T3 subject to the FOB price at its milestone.")} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {answer ? (
          <div>
            <Stamp text={stampText} when={date(answer.at.slice(0, 10), lang)} />
            {answer.note && <p className="mt-2 text-sm text-bcp-ink"><b className="font-semibold">{t("Motivo del analista BCP", "BCP analyst's reason")}:</b> {answer.note}</p>}
          </div>
        ) : BANK_EDITION ? (
          <LockedDecision labels={[t("Pedir información", "Request information"), t("Conformidad condicionada", "Conditioned sign-off"), t("Dar conformidad", "Give sign-off")]} />
        ) : (
          <>
            <Btn disabled={!open} onClick={() => answerWith("info")}>
              {t("Pedir información", "Request information")}
            </Btn>
            <Btn disabled={!open || !ready} onClick={() => answerWith("conformidad_condicion")}>
              {t("Conformidad condicionada", "Conditioned sign-off")}
            </Btn>
            <Btn primary disabled={!open || !ready} onClick={() => answerWith("conformidad")}>
              {t("Dar conformidad", "Give sign-off")}
            </Btn>
            {!open && <span className="lbl">{t(`Se habilita el ${date(decision.date, "es", false)}`, `Opens on ${date(decision.date, "en", false)}`)}</span>}
          </>
        )}
        {onOpen && (
          <span className="ml-auto">
            <Btn primary onClick={onOpen}>{t("Abrir expediente", "Open file")} →</Btn>
          </span>
        )}
      </div>
    </Card>
  );
}

/** One row of the decision queue: the same structure for a tranche sign-off and an application. */
export interface QueueItem {
  key: string;
  ref: string;
  type: string;
  due: string;
  /** Risk level (coverage band and controls, or a veto), kept apart from the recommendation. */
  state: State;
  situation: string;
  amount: number;
  coverage: number | null;
  stressed: number | null;
  exposureAfter: number | null;
  exposureLabel: string;
  rec: { text: string; detail: string; tone: "green" | "amber" | "red" };
  /** What the bank is asked to do. */
  action: string;
  kind: "signoff" | "veto" | "condition" | "plain";
  open: () => void;
  openLabel?: string;
  /** The decision itself, recorded from the queue (internal edition; the bank's is read-only). */
  form?: {
    options: { kind: Answer["kind"]; label: string; primary?: boolean; disabled?: boolean }[];
    suggestion: string;
    placeholder: string;
    disabled?: boolean;
    answer?: Answer;
    record: (a: Answer) => void;
    done: (kind: Answer["kind"]) => string;
  };
}

const REC_TONE = { green: "text-bcp-green-text", amber: "text-bcp-ambar-text", red: "text-bcp-rojo-text" } as const;
const EDGE: Record<State, string> = { verde: "border-l-bcp-green", ambar: "border-l-bcp-ambar", naranja: "border-l-bcp-naranja", rojo: "border-l-bcp-rojo", veto: "border-l-bcp-rojo" };

export function QueueCard({ item, cutoff }: { item: QueueItem; cutoff: string }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const reason = useReason();
  const form = BANK_EDITION ? undefined : item.form;
  const na = t("N/D", "N/A");
  const overdue = item.due < cutoff;
  const cells: [string, string][] = [
    [t("Monto", "Amount"), usd(item.amount)],
    [t("Cobertura hoy", "Coverage today"), item.coverage === null ? na : cov(item.coverage)],
    [t("Con precio −20%", "With price −20%"), item.stressed === null ? na : cov(item.stressed)],
    [item.exposureLabel, item.exposureAfter === null ? na : usd(item.exposureAfter)],
  ];
  return (
    <article className={`rounded-lg border border-l-4 border-bcp-border bg-white ${EDGE[item.state]}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
        <h3 className="text-[15px] font-bold text-bcp-ink">
          {item.ref} <span className="font-normal text-bcp-muted">· {item.type}</span>
        </h3>
        <div className="flex items-center gap-3">
          <span className={`text-[13px] ${overdue ? "font-semibold text-bcp-rojo-text" : "text-bcp-muted"}`}>
            {overdue ? t("Vencida", "Overdue") : t("Vence", "Due")} {date(item.due, lang)}
          </span>
          <StateChip state={item.state} />
        </div>
      </div>
      {item.situation && <p className="px-5 pt-1.5 text-[14px] text-bcp-muted">{item.situation}</p>}
      <dl className="mx-5 mt-3 grid grid-cols-2 gap-x-6 gap-y-3 rounded-md bg-bcp-bg px-4 py-3 lg:grid-cols-4">
        {cells.map(([k, v]) => (
          <div key={k}>
            <dt className="lbl">{k}</dt>
            <dd className={`num text-[18px] font-bold ${v === na ? "text-bcp-muted" : "text-bcp-ink"}`}>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="grid gap-x-8 gap-y-1 sm:grid-cols-[auto_auto]">
          <div>
            <p className="lbl">{t("Recomendación TruMarket", "TruMarket recommendation")}</p>
            <p className={`text-[15px] font-bold ${REC_TONE[item.rec.tone]}`}>{item.rec.text}</p>
            <p className="text-[13px] text-bcp-muted">{item.rec.detail}</p>
          </div>
          <div>
            <p className="lbl">{t("Acción requerida", "Action required")}</p>
            <p className="text-[15px] font-semibold text-bcp-ink">{item.action}</p>
          </div>
        </div>
        {!form && (
          <Btn primary onClick={item.open}>
            {t("Revisar decisión", "Review decision")} →
          </Btn>
        )}
      </div>
      {form && (
        <div className="border-t border-bcp-divider px-5 py-4">
          {form.answer ? (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Stamp text={form.done(form.answer.kind)} when={date(form.answer.at.slice(0, 10), lang)} />
                {form.answer.note && <p className="mt-2 text-sm"><b className="font-semibold">{t("Motivo del analista BCP", "BCP analyst's reason")}:</b> {form.answer.note}</p>}
              </div>
              <button type="button" onClick={item.open} className="min-h-[40px] text-sm font-semibold text-bcp-ink hover:underline">{item.openLabel ?? t("Abrir expediente", "Open file")} →</button>
            </div>
          ) : (
            <>
              <Rationale reason={reason} suggestion={form.suggestion} placeholder={form.placeholder} disabled={form.disabled} />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {form.options.map((o) => (
                  <Btn key={o.kind} primary={o.primary} disabled={o.disabled || form.disabled} onClick={() => {
                    if (!reason.ok()) return;
                    form.record({ kind: o.kind, at: new Date().toISOString(), note: reason.note });
                    toast(`${form.done(o.kind)} · ${item.ref}`);
                  }}>
                    {o.label}
                  </Btn>
                ))}
                <button type="button" onClick={item.open} className="ml-auto min-h-[40px] text-sm font-semibold text-bcp-ink hover:underline">{item.openLabel ?? t("Abrir expediente", "Open file")} →</button>
              </div>
            </>
          )}
        </div>
      )}
    </article>
  );
}

/** The bank's answer, shown as a stamp on the decision. */
/** The analyst's written reason: required before any decision, with TruMarket's draft one click away. */
export function Rationale({ reason, suggestion, placeholder, disabled = false }: { reason: Reason; suggestion: string; placeholder: string; disabled?: boolean }) {
  const t = useT();
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label htmlFor={reason.id} className="text-[13px] font-semibold text-bcp-muted">
          {t("Motivo del analista BCP (obligatorio)", "BCP analyst's reason (required)")}
        </label>
        <button type="button" disabled={disabled} onClick={() => reason.setNote(suggestion)} className="text-[13px] font-semibold text-bcp-green-text hover:underline disabled:opacity-50">
          {t("Usar texto sugerido", "Use suggested text")}
        </button>
      </div>
      <textarea id={reason.id} rows={2} value={reason.raw} disabled={disabled} maxLength={400} aria-invalid={reason.missing} onChange={(e) => reason.setNote(e.target.value)} placeholder={placeholder} className={`mt-1.5 min-h-[56px] w-full resize-y rounded-lg border bg-white px-3 py-2 text-sm text-bcp-ink placeholder:text-bcp-muted/70 focus:outline-none disabled:bg-bcp-bg ${reason.missing ? "border-bcp-rojo focus:border-bcp-rojo" : "border-bcp-border focus:border-bcp-ink"}`} />
      {reason.missing && <p role="alert" className="mt-1 text-[13px] font-semibold text-bcp-rojo-text">{t("Escriba un motivo antes de registrar la decisión.", "Write a reason before recording the decision.")}</p>}
    </div>
  );
}

/** The decision buttons as the bank sees them before the pilot: visible, locked. */
export function LockedDecision({ labels }: { labels: string[] }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {labels.map((l) => (
        <LockedBtn key={l} note={t(PILOT_NOTE)}>{l}</LockedBtn>
      ))}
      <span className="lbl">{t("La decisión se registra aquí desde el piloto.", "Decisions are recorded here from the pilot.")}</span>
    </div>
  );
}

export function Stamp({ text, when }: { text: string; when: string }) {
  return (
    <span className="inline-flex -rotate-2 items-center gap-2 rounded-md border-2 border-bcp-green-text px-2.5 py-1.5 font-[Arial,Helvetica,sans-serif] text-[12px] font-bold uppercase tracking-wide text-bcp-green-text">
      ✓ {text}{when ? ` · ${when}` : ""}
    </span>
  );
}
