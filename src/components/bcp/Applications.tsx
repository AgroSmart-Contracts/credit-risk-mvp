/**
 * Solicitudes: loan applications awaiting the bank's decision. Approval is
 * discretionary (bank lane): TruMarket recommends in writing, the bank decides.
 * Each file says first what approving would put at stake, in money.
 */
import { useState } from "react";
import { GEO } from "../../data/bcp/technical";
import { cov, date, stateFromCoverage, usd } from "../../lib/bcp/calc";
import type { Application, Portfolio } from "../../lib/bcp/types";
import { appKey, type Answer } from "./answers";
import { FieldImages } from "./FieldImages";
import { ScoreBreakdown, StressGrid } from "./ScoreStress";
import { sourceTx, useLang, useT, useToast } from "./shared";
import { Stamp } from "./Decision";
import { Btn, Card, Chip, ExampleChip, Lbl, Prov, SectionTitle, StateChip } from "./ui";


const ANSWER_TEXT = {
  aprobar: { es: "Aprobación registrada", en: "Approval recorded" },
  rechazar: { es: "Rechazo registrado", en: "Decline recorded" },
  info: { es: "Inspección o información solicitada a TruMarket", en: "Inspection or information requested from TruMarket" },
} as const;

export function RecommendationChip({ a }: { a: Application }) {
  const t = useT();
  return a.recommendation === "rechazar" ? <Chip tone="naranja">{t("Rechazo recomendado", "Decline recommended")}</Chip> : <Chip tone="green">{t("Aprobación recomendada", "Approval recommended")}</Chip>;
}

/** Application list (also used on the portfolio). */
export function ApplicationsTable({ apps, onOpen, answers }: { apps: Application[]; onOpen: (id: string) => void; answers: Record<string, Answer> }) {
  const t = useT();
  const lang = useLang();
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b border-bcp-border text-left">
            {[t("Solicitante", "Applicant"), t("Recomendación de TruMarket", "TruMarket recommendation"), t("Solicitado", "Requested"), t("Cobertura a la solicitud", "Coverage at application"), "Score", t("Decidir antes del", "Decide by"), t("Decisión del banco", "Bank decision")].map((h, i) => (
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
                  <span className="mt-1 block max-w-[18rem] text-xs text-bcp-muted">{t(a.reasons[0])}</span>
                </td>
                <td className="whitespace-nowrap py-2.5 pr-3 text-right">
                  <b>{usd(a.requestedUsd)}</b>
                  <span className="lbl block">
                    {a.tenorDays} {t("días", "days")}
                  </span>
                </td>
                <td className="py-2.5 pr-3">{a.coverage === null ? t("no verificable", "not verifiable") : <StateChip state={stateFromCoverage(a.coverage)} suffix={` ${cov(a.coverage)}`} />}</td>
                <td className="whitespace-nowrap py-2.5 pr-3">
                  {a.veto ? <StateChip state="veto" /> : `${a.score} · ${a.tier}`}
                </td>
                <td className="whitespace-nowrap py-2.5 pr-3">{date(a.decisionDueDate, lang)}</td>
                <td className="py-2.5 pr-3 text-xs">{ans ? <b className="text-bcp-green-text">{ANSWER_TEXT[ans.kind as keyof typeof ANSWER_TEXT]?.[lang] ?? ""}</b> : <span className="text-bcp-muted">{t("pendiente", "pending")}</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ApplicationsPage({ data, onOpen, answers }: { data: Portfolio; onOpen: (id: string) => void; answers: Record<string, Answer> }) {
  const t = useT();
  const stake = data.applications.reduce((s, a) => s + a.requestedUsd, 0);
  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <ExampleChip kind="portfolio" />
      <Card>
        <SectionTitle
          title={t("Solicitudes", "Applications")}
          sub={t(`${data.applications.length} en evaluación · ${usd(stake)} solicitados · aprobar es decisión del banco con la recomendación escrita de TruMarket`, `${data.applications.length} under review · ${usd(stake)} requested · approval is the bank's decision on TruMarket's written recommendation`)}
        />
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
  const label = { aprobar: t("Aprobar", "Approve"), rechazar: t("Rechazar", "Decline"), info: t("Pedir inspección o información", "Request inspection or information") };

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
          <ExampleChip kind="file" />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-bold leading-tight">
              {t("Solicitud", "Application")} {app.id} · {t(app.crop)}
            </h1>
            <p className="text-sm text-bcp-muted">
              {t(app.zone)} · {app.areaHa.toFixed(2)} {t("ha medidas", "ha measured")} · {t("campaña", "campaign")} {app.campaign} · {t("recibida", "received")} {date(app.receivedDate, lang)}
            </p>
            <p className="lbl mt-0.5">{t(`Decidir antes del ${date(app.decisionDueDate, "es")}`, `Decide by ${date(app.decisionDueDate, "en")}`)}</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Btn onClick={onMemo}>{t("Memorando de evaluación (PDF)", "Assessment memo (PDF)")}</Btn>
            <Btn onClick={onMap}>{t("Ver en el mapa", "View on the map")}</Btn>
          </div>
        </div>
      </header>

      <Card tone="dark">
        <p className="text-[16px] font-medium leading-snug">{t(app.summary)}</p>
      </Card>

      <section>
        <SectionTitle title={t("Exposición si se aprueba", "Exposure if approved")} sub={t("si el banco aprueba", "if the bank approves")} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { k: t("Línea solicitada", "Requested line"), v: usd(app.requestedUsd), s: t(`${app.tenorDays} días · 3 tramos`, `${app.tenorDays} days · 3 tranches`) },
            { k: t("Desembolso a la firma", "Disbursed at signing"), v: usd(t1.amountUsd), s: t("T1 · el resto solo contra hitos", "T1 · the rest only against milestones") },
            { k: t("Saldo al vencimiento", "Due at maturity"), v: usd(app.dueAtMaturityUsd), s: t("capital más costo del banco", "principal plus bank cost") },
            { k: t("Cobertura a la solicitud", "Coverage at application"), v: app.coverage === null ? t("No verificable", "Not verifiable") : cov(app.coverage), s: app.coverage === null ? t("sin cultivo verificable", "no verifiable crop") : t("cosecha esperada ÷ saldo", "expected harvest ÷ amount due") },
            { k: t("Precio de equilibrio", "Break-even price"), v: app.breakEvenPriceUsdKg === null ? t("n/d", "n/a") : `USD ${app.breakEvenPriceUsdKg.toFixed(2)}/kg`, s: t(`esperado USD ${app.expectedPriceUsdKg.toFixed(2)}/kg`, `expected USD ${app.expectedPriceUsdKg.toFixed(2)}/kg`) },
          ].map((c) => (
            <Card key={c.k}>
              <Lbl>{c.k}</Lbl>
              <p className="num text-[22px] font-bold">{c.v}</p>
              <p className="text-sm text-bcp-muted">{c.s}</p>
            </Card>
          ))}
        </div>
        <p className="lbl mt-2">{app.tranches.map((x) => `${x.id} ${x.pct}% · ${usd(x.amountUsd)} · ${t(x.milestone)}`).join("   |   ")}</p>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <h2 className="text-[20px] font-bold">{app.recommendation === "rechazar" ? t("Por qué TruMarket recomienda rechazar", "Why TruMarket recommends declining") : t("Por qué TruMarket recomienda aprobar", "Why TruMarket recommends approving")}</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
            {app.reasons.map((r, i) => (
              <li key={i}>{t(r)}</li>
            ))}
          </ul>
        </Card>
        {/* The decision is the bank's: discretionary, on TruMarket's written recommendation. */}
        <Card tone="decision">
          <Lbl>{t("Decisiones pendientes", "Pending decisions")}</Lbl>
          <h2 className="text-[16px] font-bold">{t(`Aprobar o rechazar ${usd(app.requestedUsd)}`, `Approve or decline ${usd(app.requestedUsd)}`)}</h2>
          <p className="lbl">{t(`Vence ${date(app.decisionDueDate, "es")}`, `Due ${date(app.decisionDueDate, "en")}`)}</p>
          {answer ? (
            <p className="mt-3">
              <Stamp text={ANSWER_TEXT[answer.kind as keyof typeof ANSWER_TEXT]?.[lang] ?? ""} when={date(answer.at.slice(0, 10), lang)} />
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {kinds.map((k) => (
                <Btn key={k} primary={k === app.recommendation} onClick={() => {
                  onAnswer({ kind: k as Answer["kind"], at: new Date().toISOString() });
                  toast(`${ANSWER_TEXT[k][lang]} · ${app.id} ${usd(app.requestedUsd)}`);
                }}>
                  {label[k]}
                  {k === app.recommendation && <span className="ml-1 rounded bg-white/20 px-1.5 text-[11px]">{t("recomendado", "recommended")}</span>}
                </Btn>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle title={t("Verificaciones a la solicitud", "Checks at application")} sub={t("cada valor con su fuente y fecha", "each value with its source and date")} />
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-bcp-border text-left">
                {[t("Verificación", "Check"), t("Valor", "Value"), t("Estado", "State"), t("Efecto en el repago", "Effect on repayment"), t("Fuente y fecha", "Source and date")].map((h) => (
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

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="min-w-0">
          <ScoreBreakdown dims={app.scoreDims} single />
        </Card>
        <Card className="min-w-0">
          {app.coverage === null ? (
            <>
              <h3 className="text-[16px] font-bold">{t("Prueba de estrés de la cobertura", "Coverage stress test")}</h3>
              <p className="mt-2 text-sm text-bcp-muted">{t("No aplica: sin cultivo verificable no hay cobertura que estresar.", "Not applicable: without a verifiable crop there is no coverage to stress.")}</p>
            </>
          ) : stress ? (
            <StressGrid coverage={app.coverage} />
          ) : (
            <>
              <h3 className="text-[16px] font-bold">{t("Prueba de estrés de la cobertura", "Coverage stress test")}</h3>
              <p className="mt-2 text-sm">{t(`Cobertura ${cov(app.coverage)} a la solicitud; con el precio 20% más bajo, ${cov(Math.round(app.coverage * 0.8 * 100) / 100)}.`, `Coverage ${cov(app.coverage)} at application; with the price 20% lower, ${cov(Math.round(app.coverage * 0.8 * 100) / 100)}.`)}</p>
              <button type="button" onClick={() => setStress(true)} className="mt-2 min-h-[44px] text-sm font-semibold text-bcp-green-text hover:underline">
                {t("Ver la prueba de estrés completa", "View the full stress test")} →
              </button>
            </>
          )}
        </Card>
      </div>

      {geo?.parcelId && geo.ring && (
        <Card>
          <SectionTitle title={t("Imagen del predio", "Parcel image")} sub={t("evidencia satelital de la solicitud", "satellite evidence for the application")} />
          <FieldImages parcelId={geo.parcelId} ring={geo.ring} cutoff={data.cutoff} />
        </Card>
      )}
    </div>
  );
}
