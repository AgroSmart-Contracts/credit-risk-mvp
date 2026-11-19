import { Fragment, useState } from "react";
import { ChevronRight, FilePlus2, Search } from "lucide-react";
import { formatDate, formatUsd, tb } from "../../lib/pre-harvest/i18n";
import { FILE_STATUS_TEXT, type FileStatus } from "../../lib/pre-harvest/verdict";
import type { Bilingual, Lang } from "../../lib/pre-harvest/types";
import { FILE_KIND, STATUS_STYLE } from "./file-style";
import type { FileRow } from "./portfolio";

const L = (en: string, es: string): Bilingual => ({ en, es });
const TX = {
  title: L("Inbox", "Bandeja"),
  hint: L("Grouped by client. Colour only marks files that need attention.", "Agrupado por cliente. El color solo marca los expedientes que requieren atención."),
  newApplication: L("New application", "Nueva solicitud"),
  client: L("Client · campaign", "Cliente · campaña"),
  score: L("Score", "Score"),
  exposure: L("Exposure", "Exposición"),
  status: L("Status", "Estado"),
  next: L("Next decision", "Próxima decisión"),
  action: L("Next action", "Próxima acción"),
  needs: L("Needs attention only", "Solo los que requieren atención"),
  search: L("Search client, parcel or district", "Buscar cliente, predio o distrito"),
  none: L("No file matches.", "Ningún expediente coincide."),
  tryChip: L("Try:", "Pruebe:"),
  days: L("days", "días"),
  overdue: L("overdue", "vencida"),
};

const TILES: Array<{ id: "live" | "decisions" | "red" | "watch" | "repaid" | "declined"; label: Bilingual }> = [
  { id: "live", label: L("Open loans", "Préstamos vigentes") },
  { id: "decisions", label: L("Decisions due", "Decisiones pendientes") },
  { id: "red", label: L("High risk", "Riesgo alto") },
  { id: "watch", label: L("Watch", "Vigilar") },
  { id: "repaid", label: L("Repaid", "Repagados") },
  { id: "declined", label: L("Declined", "Rechazados") },
];

const attention = (r: FileRow) => !(["normal", "repaid", "declined"] as FileStatus[]).includes(r.status) || r.decision !== null;
const clientOf = (r: FileRow) => r.deal.formato.growerName || r.deal.formato.ruc;
const short = (s: string, n = 70) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function Inbox({ rows, lang, onOpen, onNew }: { rows: FileRow[]; lang: Lang; onOpen: (id: string) => void; onNew: () => void }) {
  const [q, setQ] = useState("");
  const anyAttention = rows.some(attention);
  // On by default whenever something needs the analyst; one click shows the whole book.
  const [needs, setNeeds] = useState(anyAttention);

  const counts = {
    live: rows.filter((r) => r.deal.status === "live").length,
    decisions: rows.filter((r) => r.decision).length,
    red: rows.filter((r) => r.deal.status === "live" && r.worst === "red").length,
    watch: rows.filter((r) => r.deal.status === "live" && r.worst === "yellow").length,
    repaid: rows.filter((r) => r.status === "repaid").length,
    declined: rows.filter((r) => r.status === "declined").length,
  };
  const term = q.trim().toLowerCase();
  const filtered = rows
    .filter((r) => !needs || attention(r))
    .filter((r) => !term || [r.deal.id, r.deal.name.en, r.deal.location.en, r.deal.location.es, r.deal.formato.ruc, r.deal.campaign.en].some((x) => x.toLowerCase().includes(term)));
  const groups = new Map<string, FileRow[]>();
  for (const r of filtered) (groups.get(clientOf(r)) ?? groups.set(clientOf(r), []).get(clientOf(r))!).push(r);
  for (const list of groups.values()) list.sort((a, b) => b.deal.approvalDate.localeCompare(a.deal.approvalDate));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-tm-black sm:text-[28px]">{tb(TX.title, lang)}</h2>
          <p className="mt-0.5 text-sm text-tm-text-light">{tb(TX.hint, lang)}</p>
        </div>
        <button type="button" onClick={onNew} className="inline-flex items-center gap-1.5 rounded-lg bg-tm-primary px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90">
          <FilePlus2 className="h-4 w-4" />
          {tb(TX.newApplication, lang)}
        </button>
      </div>

      {/* Summary tiles: the colour sits on the left border; only the worst tile is filled. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {TILES.map((t) => {
          const n = counts[t.id];
          const border = t.id === "red" && n ? "border-l-tm-danger bg-tm-danger/5" : t.id === "watch" && n ? "border-l-tm-accent" : t.id === "decisions" && n ? "border-l-tm-black" : "border-l-tm-border";
          return (
            <div key={t.id} className={`rounded-lg border border-l-[3px] border-tm-border bg-tm-surface px-3 py-2 ${border}`}>
              <p className="text-[11px] text-tm-text-muted">{tb(t.label, lang)}</p>
              <p className="font-display text-xl text-tm-black">{n}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tm-text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tb(TX.search, lang)}
            className="w-full rounded-lg border border-tm-border bg-tm-surface py-2 pl-8 pr-3 text-sm placeholder:text-tm-text-muted focus:border-tm-text-muted focus:outline-none"
          />
        </div>
        {anyAttention && (
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-tm-black">
            <input type="checkbox" checked={needs} onChange={(e) => setNeeds(e.target.checked)} className="accent-tm-black" />
            {tb(TX.needs, lang)}
          </label>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-tm-border bg-tm-surface shadow-tm-sm">
        <table className="w-full text-left text-sm">
          <thead className="hidden border-b border-tm-border text-[11px] uppercase tracking-wide text-tm-text-muted md:table-header-group">
            <tr>
              <th className="px-4 py-2.5 font-semibold">{tb(TX.client, lang)}</th>
              <th className="px-4 py-2.5 font-semibold">{tb(TX.score, lang)}</th>
              <th className="px-4 py-2.5 text-right font-semibold">{tb(TX.exposure, lang)}</th>
              <th className="px-4 py-2.5 font-semibold">{tb(TX.status, lang)}</th>
              <th className="px-4 py-2.5 font-semibold">{tb(TX.next, lang)}</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-tm-border">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-sm text-tm-text-light">
                  {tb(TX.none, lang)}{" "}
                  <span className="text-tm-text-muted">{tb(TX.tryChip, lang)}</span>{" "}
                  <button type="button" onClick={() => setQ("0142")} className="rounded-full border border-tm-border px-2 py-0.5 text-xs font-medium text-tm-black hover:border-tm-black">
                    ICA-0142
                  </button>
                </td>
              </tr>
            )}
            {[...groups.entries()].map(([client, list]) => (
              <Fragment key={client}>
                {list.length > 1 && (
                  <tr className="bg-tm-neutral-light">
                    <td colSpan={6} className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-tm-text-muted">
                      {lang === "es" ? "Cliente" : "Client"} {client} · {list.length} {lang === "es" ? "campañas" : "campaigns"}
                    </td>
                  </tr>
                )}
                {list.map((r) => {
                  const style = STATUS_STYLE[r.status];
                  const origin = r.sim.origination.composite;
                  const delta = r.frame.composite - origin;
                  const d = r.decision;
                  return (
                    <tr
                      key={r.deal.id}
                      onClick={() => onOpen(r.deal.id)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen(r.deal.id)}
                      tabIndex={0}
                      className="block cursor-pointer px-4 py-3 transition-colors hover:bg-tm-neutral/60 focus:bg-tm-neutral/60 focus:outline-none md:table-row md:p-0"
                    >
                      <td className={`block md:table-cell md:py-3 md:pr-4 ${list.length > 1 ? "md:pl-8" : "md:pl-4"}`}>
                        <p className="font-medium text-tm-black">{tb(r.deal.name, lang)}</p>
                        <p className="text-xs text-tm-text-muted">
                          {tb(r.deal.campaign, lang)} · {tb(FILE_KIND[r.deal.status], lang)} · {tb(r.deal.location, lang)}
                        </p>
                      </td>
                      <td className="block whitespace-nowrap tabular-nums md:table-cell md:px-4 md:py-3">
                        {r.frame.tier === "VETO" ? (
                          <span className="font-semibold text-tm-text-light">Veto</span>
                        ) : (
                          <>
                            <span className="font-semibold text-tm-black">
                              {r.frame.composite} · {r.frame.tier}
                            </span>
                            {delta !== 0 && r.deal.status !== "application" && (
                              <span className={`ml-1 text-xs font-semibold ${delta < 0 ? "text-tm-accent-dark" : "text-tm-primary-dark"}`}>
                                {delta < 0 ? "▼" : "▲"}
                                {Math.abs(delta)}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="block whitespace-nowrap tabular-nums md:table-cell md:px-4 md:py-3 md:text-right">
                        <span className="text-tm-black">{formatUsd(r.money.exposureUsd, lang)}</span>
                        <span className="block text-xs text-tm-text-muted">
                          {lang === "es" ? "de" : "of"} {formatUsd(r.deal.envelopeUsd, lang)}
                        </span>
                      </td>
                      <td className="block py-1 md:table-cell md:px-4 md:py-3">
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style.pill}`}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: style.dot }} />
                          {tb(FILE_STATUS_TEXT[r.status], lang)}
                        </span>
                      </td>
                      <td className="block max-w-xs md:table-cell md:px-4 md:py-3" title={tb(r.action, lang)}>
                        {d ? (
                          <>
                            <p className="font-medium text-tm-black">
                              {d.kind === "approval" ? (lang === "es" ? "Aprobación" : "Approval") : `${tb(d.tranche!.label, lang)} ${d.tranche!.pct}%`} · {formatUsd(d.amountUsd, lang)}
                            </p>
                            <p className={`text-xs ${d.daysLeft < 0 ? "font-semibold text-tm-accent-dark" : "text-tm-text-muted"}`}>
                              {formatDate(d.dueDate, lang)} · {d.daysLeft < 0 ? `${Math.abs(d.daysLeft)} ${tb(TX.days, lang)} ${tb(TX.overdue, lang)}` : `${d.daysLeft} ${tb(TX.days, lang)}`} · {d.met}/{d.total} ✓
                            </p>
                          </>
                        ) : (
                          <p className="text-tm-text-light">{short(tb(r.action, lang))}</p>
                        )}
                      </td>
                      <td className="hidden pr-3 text-tm-text-muted md:table-cell">
                        <ChevronRight className="h-4 w-4" />
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
