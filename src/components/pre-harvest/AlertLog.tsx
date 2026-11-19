import { formatDate, t, tb } from "../../lib/pre-harvest/i18n";
import { PANEL_LABELS } from "../../lib/pre-harvest/timeline";
import type { AlertLogEntry, Lang } from "../../lib/pre-harvest/types";
import { ActionChip, Card, SectionTitle, SeverityChip } from "./ui";

export function AlertLog({ alerts, upTo, lang }: { alerts: AlertLogEntry[]; upTo: string; lang: Lang }) {
  const shown = alerts.filter((a) => a.date <= upTo);
  return (
    <Card>
      <SectionTitle title={t("alertLog", lang)} />
      {shown.length === 0 ? (
        <p className="text-sm text-tm-text-light">{t("alertLogEmpty", lang)}</p>
      ) : (
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="border-b border-tm-border text-tm-text-muted">
              <tr>
                <th className="py-2 pr-3 font-medium">{t("date", lang)}</th>
                <th className="py-2 pr-3 font-medium">{t("panel", lang)}</th>
                <th className="py-2 pr-3 font-medium">{t("trigger", lang)}</th>
                <th className="py-2 pr-3 font-medium">{t("limit", lang)}</th>
                <th className="py-2 pr-3 font-medium">{t("severity", lang)}</th>
                <th className="py-2 pr-3 font-medium">{t("rescored", lang)}</th>
                <th className="py-2 font-medium">{t("action", lang)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tm-border">
              {[...shown].reverse().map((a, i) => (
                <tr key={`${a.date}-${a.metric}-${i}`} className="align-top">
                  <td className="whitespace-nowrap py-2 pr-3 text-tm-text-light">{formatDate(a.date, lang)}</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-tm-black">{tb(PANEL_LABELS[a.panel], lang)}</td>
                  <td className="py-2 pr-3 text-tm-black">{tb(a.message, lang)}</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-tm-text-light">{a.limit}</td>
                  <td className="py-2 pr-3">
                    <SeverityChip severity={a.severity} lang={lang} />
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 font-semibold text-tm-black">
                    {a.composite} · {a.tier}
                  </td>
                  <td className="py-2">
                    <ActionChip action={a.action} lang={lang} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
