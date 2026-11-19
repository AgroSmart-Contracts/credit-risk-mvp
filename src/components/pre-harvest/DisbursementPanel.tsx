import { CheckCircle2, Circle, XCircle } from "lucide-react";
import { trancheConditions, type ConditionStatus } from "../../lib/pre-harvest/credit-metrics";
import { formatDate, formatUsd, t, tb, TRANCHE_STATUS_TEXT } from "../../lib/pre-harvest/i18n";
import type { Lang, PreHarvestDeal, TimelineFrame, TrancheStatus } from "../../lib/pre-harvest/types";
import { Card, SectionTitle } from "./ui";

const TRANCHE_CLASS: Record<TrancheStatus, string> = {
  pending: "border-tm-border",
  released: "border-tm-primary/50",
  held: "border-tm-accent/60",
  stopped: "border-tm-danger/60",
};

const STATUS_CLASS: Record<TrancheStatus, string> = {
  pending: "bg-tm-neutral text-tm-text-light",
  released: "bg-tm-primary/15 text-tm-primary-dark",
  held: "bg-tm-accent/15 text-tm-accent-dark",
  stopped: "bg-tm-danger/15 text-tm-danger-dark",
};

function ConditionIcon({ status }: { status: ConditionStatus }) {
  if (status === "met") return <CheckCircle2 className="h-4 w-4 shrink-0 text-tm-primary" />;
  if (status === "failed") return <XCircle className="h-4 w-4 shrink-0 text-tm-danger-dark" />;
  return <Circle className="h-4 w-4 shrink-0 text-tm-text-muted" />;
}

export function DisbursementPanel({
  deal,
  frame,
  fruitSetDelayDays,
  yieldAdj,
  lang,
}: {
  deal: PreHarvestDeal;
  frame: TimelineFrame;
  fruitSetDelayDays: number;
  yieldAdj: number;
  lang: Lang;
}) {
  const statusText: Record<ConditionStatus, string> = {
    met: t("condMet", lang),
    pending: t("condPending", lang),
    failed: t("condFailed", lang),
  };
  return (
    <Card>
      <SectionTitle title={t("tranches", lang)} hint={`${t("outstanding", lang)}: ${formatUsd(frame.outstandingUsd, lang)} / ${formatUsd(deal.envelopeUsd, lang)}`} />
      <div className="grid gap-4 lg:grid-cols-3">
        {frame.tranches.map((tr) => (
          <div key={tr.id} className={`rounded-lg border-2 p-4 ${TRANCHE_CLASS[tr.status]}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-tm-black">
                  {tr.pct}% · {tb(tr.label, lang)}
                </p>
                <p className="font-display text-lg text-tm-black">{formatUsd(tr.amountUsd, lang)}</p>
              </div>
              <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_CLASS[tr.status]}`}>
                {tb(TRANCHE_STATUS_TEXT[tr.status], lang)}
              </span>
            </div>
            <p className="mt-1 text-xs text-tm-text-light">
              {tr.releasedOn ? `${t("releasedOn", lang)} ${formatDate(tr.releasedOn, lang)}` : `${t("due", lang)} ${formatDate(tr.dueDate, lang)}`}
            </p>
            <p className="mt-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-tm-text-muted">{t("conditions", lang)}</p>
            <ul className="space-y-1.5">
              {trancheConditions(deal, tr, frame, fruitSetDelayDays, yieldAdj).map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-xs" title={statusText[c.status]}>
                  <ConditionIcon status={c.status} />
                  <span className={c.status === "failed" ? "text-tm-danger-dark" : "text-tm-black"}>{tb(c.label, lang)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}
