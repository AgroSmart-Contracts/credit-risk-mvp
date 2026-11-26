/**
 * Solicitudes: loan applications awaiting the bank's decision. Approval is
 * discretionary (bank lane): TruMarket recommends in writing, the bank decides.
 * Each file says first what approving would put at stake, in money.
 */
import { useCallback, useState } from "react";
import { GEO } from "../../data/bcp/technical";
import { COVERAGE_BANDS, L, cov, date, harvestBuild, pct, stateFromCoverage, usd, haLabel } from "../../lib/bcp/calc";
import { BANK_EDITION } from "./edition";
import type { Application, Portfolio } from "../../lib/bcp/types";
import { appKey, useReason, type Answer } from "./answers";
import { FieldImages } from "./FieldImages";
import { ScoreBreakdown, StressGrid } from "./ScoreStress";
import { CoverageBuild } from "./CoverageBuild";
import { LineCompare, RepaymentCard } from "./Repayment";
import { sourceTx, useLang, useT, useToast } from "./shared";
import { LockedDecision, Rationale, Stamp } from "./Decision";
import { Btn, Card, Chip, Lbl, LockedBtn, Modal, PilotLocked, Prov, SectionTitle, StateChip } from "./ui";
import { PILOT_NOTE } from "./nav";


const ANSWER_TEXT = {
  aprobar: { es: "Aprobación registrada", en: "Approval recorded" },
  rechazar: { es: "Rechazo registrado", en: "Decline recorded" },
  info: { es: "Inspección o información solicitada a TruMarket", en: "Inspection or information requested from TruMarket" },
} as const;

export function RecommendationChip({ a }: { a: Application }) {
  const t = useT();
  if (a.recommendation === "rechazar") return <Chip tone="naranja">{t("Rechazo recomendado", "Decline recommended")}</Chip>;
  if (a.recommendation === "aprobar_condicion") return <Chip tone="ambar">{t("Aprobación con condición", "Approval with a condition")}</Chip>;
  return <Chip tone="green">{t("Aprobación recomendada", "Approval recommended")}</Chip>;
}

/** Lines and concentration today and if the application is approved (as requested, and on its condition). */
function Headroom({ app, data }: { app: Application; data: Portfolio }) {
  const t = useT();
  const lines = data.loans.reduce((s, l) => s + l.lineUsd, 0);
  const largest = data.loans.reduce((m, l) => (l.lineUsd > m.lineUsd ? l : m), data.loans[0]);
  const ica = (zone: string) => /\bIca\b/.test(zone);
  const icaLines = data.loans.filter((l) => ica(l.zone.es)).reduce((s, l) => s + l.lineUsd, 0);
  const cols = [
    { label: t("Hoy", "Today"), add: 0 },
    { label: `+ ${usd(app.requestedUsd)}`, add: app.requestedUsd },
    ...(app.condition ? [{ label: `+ ${usd(app.condition.lineUsd)}`, add: app.condition.lineUsd }] : []),
  ];
  const top = (add: number) => (add > largest.lineUsd ? { id: app.id, usd: add } : { id: largest.id, usd: largest.lineUsd });
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-bcp-border">
            <th />
            {cols.map((c) => (
              <Lbl key={c.label} as="th" className="py-1.5 pl-3 text-right font-normal">{c.label}</Lbl>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-bcp-divider">
          <tr>
            <td className="py-1.5 pr-3">{t("Líneas aprobadas", "Approved lines")}</td>
            {cols.map((c) => <td key={c.label} className="num py-1.5 pl-3 text-right font-semibold">{usd(lines + c.add)}</td>)}
          </tr>
          <tr>
            <td className="py-1.5 pr-3">{t("Mayor prestatario", "Largest borrower")}</td>
            {cols.map((c) => {
              const x = top(c.add);
              return <td key={c.label} className="num py-1.5 pl-3 text-right">{pct((x.usd / (lines + c.add)) * 100)} · {x.id}</td>;
            })}
          </tr>
          <tr>
            <td className="py-1.5 pr-3">{t("Zona Ica", "Ica zone")}</td>
            {cols.map((c) => <td key={c.label} className="num py-1.5 pl-3 text-right">{pct(((icaLines + (ica(app.zone.es) ? c.add : 0)) / (lines + c.add)) * 100)}</td>)}
          </tr>
          <tr>
            <td className="py-1.5 pr-3">{t("Cupo del programa", "Programme limit")}</td>
            <td colSpan={cols.length} className="py-1.5 pl-3 text-right font-semibold">{t("por confirmar con el BCP", "to be confirmed with BCP")}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Application list (also used on the portfolio). */
export function ApplicationsTable({ apps, onOpen, answers }: { apps: Application[]; onOpen: (id: string) => void; answers: Record<string, Answer> }) {
  const t = useT();
  const lang = useLang();
  const [reasonsOf, setReasonsOf] = useState<Application | null>(null);
  const closeReasons = useCallback(() => setReasonsOf(null), []);
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b border-bcp-border text-left">
            {[t("Solicitante", "Applicant"), t("Recomendación de TruMarket", "TruMarket recommendation"), t("Solicitado", "Requested"), t("Cobertura a la solicitud", "Coverage at application"), BANK_EDITION ? t("Veto", "Veto") : "Score", t("Decidir antes del", "Decide by"), t("Decisión del banco", "Bank decision")].map((h, i) => (
              <Lbl key={h} as="th" className={`py-2 pr-3 font-normal ${i === 2 ? "text-right" : ""}`}>
                {h}
              </Lbl>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-bcp-divider">
          {apps.map((a) => {
            const ans = answers[appKey(a)];
            return (
              <tr key={a.id} onClick={() => onOpen(a.id)} className="cursor-pointer align-top hover:bg-bcp-bg">
                <td className="py-2.5 pr-3">
                  <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(a.id); }} className="text-left font-semibold hover:underline">
                    {a.id}
                  </button>
                  <span className="lbl block">{t(a.zone)}</span>
                </td>
                <td className="py-2.5 pr-3">
                  <RecommendationChip a={a} />
                  <button type="button" onClick={(e) => { e.stopPropagation(); setReasonsOf(a); }} className="mt-1 block min-h-[28px] text-xs font-semibold text-bcp-green-text underline-offset-2 hover:underline">
                    {t("Ver motivos", "View reasons")}
                  </button>
                </td>
                <td className="whitespace-nowrap py-2.5 pr-3 text-right">
                  <b>{usd(a.requestedUsd)}</b>
                  <span className="lbl block">
                    {a.tenorDays} {t("días", "days")}
                  </span>
                </td>
                <td className="py-2.5 pr-3">{a.coverage === null ? t("no verificable", "not verifiable") : <StateChip state={stateFromCoverage(a.coverage)} suffix={` ${cov(a.coverage)}`} />}</td>
                <td className="whitespace-nowrap py-2.5 pr-3">
                  {a.veto ? <StateChip state="veto" /> : BANK_EDITION ? t("No", "No") : `${a.score} · ${a.tier}`}
                </td>
                <td className="whitespace-nowrap py-2.5 pr-3">{date(a.decisionDueDate, lang)}</td>
                <td className="py-2.5 pr-3 text-xs">{ans ? <b className="text-bcp-green-text">{ANSWER_TEXT[ans.kind as keyof typeof ANSWER_TEXT]?.[lang] ?? ""}</b> : <span className="text-bcp-muted">{t("pendiente", "pending")}</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {reasonsOf && (
        <Modal
          title={t(`Motivos de la recomendación · ${reasonsOf.id}`, `Reasons for the recommendation · ${reasonsOf.id}`)}
          onClose={closeReasons}
          footer={
            <>
              <Btn onClick={closeReasons}>{t("Cerrar", "Close")}</Btn>
              <Btn primary onClick={() => onOpen(reasonsOf.id)}>{t("Abrir solicitud", "Open application")}</Btn>
            </>
          }
        >
          <RecommendationChip a={reasonsOf} />
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-bcp-ink">
            {reasonsOf.reasons.map((r, i) => (
              <li key={i}>{t(r)}</li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
}

export function ApplicationsPage({ data, onOpen, answers }: { data: Portfolio; onOpen: (id: string) => void; answers: Record<string, Answer> }) {
  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <Card>
        <ApplicationsTable apps={data.applications} onOpen={onOpen} answers={answers} />
      </Card>
    </div>
  );
}

export function ApplicationFile({ app, data, onBack, onMap, onMemo, answer, onAnswer }: { app: Application; data: Portfolio; onBack: () => void; onMap: () => void; onMemo: () => void; answer?: Answer; onAnswer: (a: Answer) => void }) {
  const t = useT();
  const lang = useLang();
  const [stress, setStress] = useState(false);
  const toast = useToast();
  const geo = GEO[app.id];
  const t1 = app.tranches[0];
  // Fixed order on every application, so a button is never in a different place; the recommended one is highlighted.
  const kinds = ["aprobar", "rechazar", "info"] as const;
  const label = { aprobar: app.condition ? t(`Aprobar con ${usd(app.condition.lineUsd)}`, `Approve with ${usd(app.condition.lineUsd)}`) : t("Aprobar", "Approve"), rechazar: t("Rechazar", "Decline"), info: t("Pedir inspección o información", "Request inspection or info") };
  const reason = useReason();
  // TruMarket's draft reason, from the recommendation and the standard stress.
  const suggestion = app.recommendation === "rechazar"
    ? L(`Rechazada según la recomendación de TruMarket: ${app.veto ? "veto técnico." : "no cumple el estrés estándar."}`, `Declined per TruMarket's recommendation: ${app.veto ? "technical veto." : "fails the standard stress."}`)
    : app.condition
      ? L(`Aprobada con una línea de ${usd(app.condition.lineUsd)}: pasa el estrés estándar (precio −20% y volumen −30%) sobre ${cov(COVERAGE_BANDS.ambar)}.`, `Approved with a line of ${usd(app.condition.lineUsd)}: passes the standard stress (price −20% and volume −30%) above ${cov(COVERAGE_BANDS.ambar)}.`)
      : L("Aprobada según la evaluación de crédito y técnica.", "Approved per the credit and technical assessment.");
  const recommended = (k: (typeof kinds)[number]) => k === app.recommendation || (k === "aprobar" && app.recommendation === "aprobar_condicion");

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <header className="space-y-2">
        <button type="button" onClick={onBack} className="min-h-[44px] text-sm font-semibold hover:underline print:hidden">
          ← {t("Solicitudes", "Applications")}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="ink">{t("Solicitud", "Application")}</Chip>
          <RecommendationChip a={app} />
          {app.veto && <StateChip state="veto" />}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-bold leading-tight">
              {t("Solicitud", "Application")} {app.id} · {t(app.crop)}
            </h1>
            <p className="text-sm text-bcp-muted">
              {t(app.zone)} · {haLabel(app.areaHa)} {t("ha medidas", "ha measured")} · {t("campaña", "campaign")} {app.campaign} · {t("recibida", "received")} {date(app.receivedDate, lang)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Btn onClick={onMemo}>{t("Memorando de evaluación (PDF)", "Assessment memo (PDF)")}</Btn>
            {BANK_EDITION ? <LockedBtn note={t(PILOT_NOTE)}>{t("Ver en el mapa", "View on the map")}</LockedBtn> : <Btn onClick={onMap}>{t("Ver en el mapa", "View on the map")}</Btn>}
          </div>
        </div>
      </header>

      <Card tone="dark">
        <p className="text-[16px] font-medium leading-snug">{t(app.summary)}</p>
      </Card>

      {app.coverage !== null && (
        <RepaymentCard
          input={app}
          cutoff={data.cutoff}
          middle={app.condition
            ? { label: t("Con la condición", "On the condition"), value: cov(harvestBuild(app, {}, app.condition.dueAtMaturityUsd).coverage), sub: t(`línea de ${usd(app.condition.lineUsd)}`, `line of ${usd(app.condition.lineUsd)}`) }
            : { label: t("Línea solicitada", "Requested line"), value: usd(app.requestedUsd), sub: t(`${app.tenorDays} días · ${usd(t1.amountUsd)} a la firma`, `${app.tenorDays} days · ${usd(t1.amountUsd)} at signing`) }}
          areaHa={BANK_EDITION ? undefined : app.areaHa}
          yieldTHa={BANK_EDITION ? undefined : app.yieldTHa}
          chip={<RecommendationChip a={app} />}
          drivers={{
            volume: app.checks.filter((c) => c.group === "Cultivo y volumen" && !c.before).map((c) => ({ label: t(c.label), value: t(c.value), effect: t(c.effect), state: c.state, provenance: c.provenance, source: t(sourceTx(c)) })),
            price: app.checks.filter((c) => c.group === "Precio y calidad" && !c.before).map((c) => ({ label: t(c.label), value: t(c.value), effect: t(c.effect), state: c.state, provenance: c.provenance, source: t(sourceTx(c)) })),
          }}
          onCalc={() => document.getElementById("calculo-cobertura")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        />
      )}

      {app.condition && (
        <section>
          <SectionTitle title={t("Línea solicitada y línea recomendada", "Requested line and recommended line")} />
          <LineCompare input={app} tenorDays={app.tenorDays} requestedUsd={app.requestedUsd} requestedDueUsd={app.dueAtMaturityUsd} condition={app.condition} />
        </section>
      )}

      {app.coverage === null && <section>
        <SectionTitle title={t("Exposición si se aprueba", "Exposure if approved")} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { k: t("Línea solicitada", "Requested line"), v: usd(app.requestedUsd), s: t(`${app.tenorDays} días · 3 tramos`, `${app.tenorDays} days · 3 tranches`) },
            { k: t("Desembolso a la firma", "Disbursed at signing"), v: usd(t1.amountUsd), s: "" },
            { k: t("Saldo al vencimiento", "Due at maturity"), v: usd(app.dueAtMaturityUsd), s: "" },
            { k: t("Cobertura a la solicitud", "Coverage at application"), v: t("No verificable", "Not verifiable"), s: "" },
          ].map((c) => (
            <Card key={c.k}>
              <Lbl>{c.k}</Lbl>
              <p className="num text-[22px] font-bold">{c.v}</p>
              {c.s && <p className="text-sm text-bcp-muted">{c.s}</p>}
            </Card>
          ))}
        </div>
      </section>}

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <h2 className="text-[20px] font-bold">{app.recommendation === "rechazar" ? t("Por qué TruMarket recomienda rechazar", "Why TruMarket recommends declining") : app.recommendation === "aprobar_condicion" ? t("Por qué TruMarket recomienda aprobar con condición", "Why TruMarket recommends approval with a condition") : t("Por qué TruMarket recomienda aprobar", "Why TruMarket recommends approving")}</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
            {app.reasons.map((r, i) => (
              <li key={i}>{t(r)}</li>
            ))}
          </ul>
        </Card>
        {/* The decision is the bank's: discretionary, on TruMarket's written recommendation. */}
        <Card tone="decision">
          <Lbl>{t("Su decisión", "Your decision")}</Lbl>
          <h2 className="text-[16px] font-bold">{t(`Aprobar o rechazar ${usd(app.requestedUsd)}`, `Approve or decline ${usd(app.requestedUsd)}`)}</h2>
          <p className="lbl">{t(`Vence ${date(app.decisionDueDate, "es")}`, `Due ${date(app.decisionDueDate, "en")}`)}</p>
          {answer ? (
            <div className="mt-3">
              <Stamp text={ANSWER_TEXT[answer.kind as keyof typeof ANSWER_TEXT]?.[lang] ?? ""} when={date(answer.at.slice(0, 10), lang)} />
              {answer.note && <p className="mt-2 text-sm"><b className="font-semibold">{t("Motivo del analista BCP", "BCP analyst's reason")}:</b> {answer.note}</p>}
            </div>
          ) : BANK_EDITION ? (
            // Read-only for the bank until the pilot: TruMarket's recommendation, in place of the buttons.
            <div className="mt-3">
              <Lbl>{t("Recomendación TruMarket", "TruMarket recommendation")}</Lbl>
              <p className="text-[20px] font-bold">{app.condition ? t(`Aprobar con ${usd(app.condition.lineUsd)}`, `Approve with ${usd(app.condition.lineUsd)}`) : app.recommendation === "rechazar" ? t("Rechazar", "Decline") : t("Aprobar", "Approve")}</p>
              <div className="mt-2"><RecommendationChip a={app} /></div>
              <div className="mt-4"><LockedDecision labels={kinds.map((k) => label[k])} /></div>
            </div>
          ) : (
            <>
            <div className="mt-3">
              <Rationale reason={reason} suggestion={t(suggestion)} placeholder={app.recommendation === "rechazar" ? t("p. ej. Rechazada por veto técnico: cultivo no verificable.", "e.g. Declined on a technical veto: crop cannot be verified.") : t("p. ej. Aprobada según la evaluación de crédito y técnica.", "e.g. Approved per the credit and technical assessment.")} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 [&>*]:flex-auto [&>*]:justify-center">
              {kinds.map((k) => (
                <Btn key={k} primary={recommended(k)} onClick={() => {
                  if (!reason.ok()) return;
                  onAnswer({ kind: k as Answer["kind"], at: new Date().toISOString(), note: reason.note });
                  toast(`${ANSWER_TEXT[k][lang]} · ${app.id} ${usd(app.requestedUsd)}`);
                }}>
                  {label[k]}
                  {recommended(k) && <span className="ml-1 rounded bg-white/20 px-1.5 text-[11px]">{t("recomendado", "recommended")}</span>}
                </Btn>
              ))}
            </div>
            </>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle title={t("Verificaciones a la solicitud", "Checks at application")} />
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-bcp-border text-left">
                {[t("Verificación", "Check"), t("Valor", "Value"), t("Estado", "State"), t("Antes de", "Before"), t("Efecto en el repago", "Effect on repayment"), t("Fuente y fecha", "Source and date")].map((h) => (
                  <Lbl key={h} as="th" className="py-2 pr-3 font-normal">
                    {h}
                  </Lbl>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-bcp-divider">
              {app.checks.map((c, i) => (
                <tr key={i} className="align-top">
                  <td className="py-2 pr-3 font-semibold">{t(c.label)}</td>
                  <td className="py-2 pr-3">{t(c.value)}</td>
                  <td className="py-2 pr-3"><StateChip state={c.state} /></td>
                  <td className="py-2 pr-3">{c.before ?? ""}</td>
                  <td className={`py-2 pr-3 ${c.state === "verde" ? "text-bcp-muted" : "font-semibold"}`}>{t(c.effect)}</td>
                  <td className="py-2 pr-3">
                    <Prov p={c.provenance} />
                    <span className="lbl block">{t(sourceTx(c))}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {app.coverage !== null && (
        <div className="grid gap-3 lg:grid-cols-2 [&>*]:min-w-0">
          <Card><div id="calculo-cobertura" className="scroll-mt-32"><CoverageBuild input={app} areaHa={app.areaHa} yieldTHa={app.yieldTHa} /></div></Card>
          <Card>
            <h3 className="text-[16px] font-bold">{t("Precio y volumen a la vez", "Price and volume together")}</h3>
            {stress ? (
              <div className="mt-3"><StressGrid input={app} /></div>
            ) : (
              <button type="button" onClick={() => setStress(true)} className="mt-2 min-h-[44px] text-sm font-semibold text-bcp-green-text hover:underline">
                {t("Ver la grilla de precio y volumen", "View the price and volume grid")} →
              </button>
            )}
          </Card>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <h3 className="text-[16px] font-bold">{t("Líneas y concentración si se aprueba", "Lines and concentration if approved")}</h3>
          <div className="mt-2"><Headroom app={app} data={data} /></div>
        </Card>
        {!BANK_EDITION && (
          <Card>
            <ScoreBreakdown dims={app.scoreDims} scores={{ approval: app.score, today: app.score }} single />
          </Card>
        )}
      </div>

      {BANK_EDITION ? (
        <PilotLocked title={t("Imagen satelital del predio", "Satellite image of the parcel")} note={t(PILOT_NOTE)} />
      ) : (
        geo?.parcelId &&
        geo.ring && (
          <Card>
            <SectionTitle title={t("Imagen del predio", "Parcel image")} />
            <FieldImages parcelId={geo.parcelId} ring={geo.ring} cutoff={data.cutoff} />
          </Card>
        )
      )}
    </div>
  );
}
