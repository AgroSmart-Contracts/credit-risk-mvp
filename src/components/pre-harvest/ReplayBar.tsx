/**
 * Replays the campaign as it actually happened: one step per monitoring week, on
 * the observed satellite, weather and price data only. The file shows what the
 * bank would have seen on that date, and public reports appear as they were published.
 */
import { Download, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import type { ResearchFinding } from "../../data/pre-harvest/files";
import { formatDate, tb } from "../../lib/pre-harvest/i18n";
import type { Lang, TimelineFrame } from "../../lib/pre-harvest/types";

export function ReplayBar({
  frames,
  index,
  onIndex,
  playing,
  onTogglePlay,
  findings,
  lang,
  onBackToToday,
  speed,
  onSpeed,
  pauseNote,
  onDownloadLog,
}: {
  frames: TimelineFrame[];
  index: number;
  onIndex: (i: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  findings: ResearchFinding[];
  lang: Lang;
  /** Live files: leave the replay and go back to today's view. */
  onBackToToday?: () => void;
  speed: number;
  onSpeed: (s: number) => void;
  /** Why the replay stopped by itself (a tranche decision), if it did. */
  pauseNote?: string | null;
  onDownloadLog: () => void;
}) {
  const last = frames.length - 1;
  const frame = frames[index];
  // Week 1 shows the two weeks before approval; later weeks, what was published since the previous step.
  const prev = index > 0 ? frames[index - 1].date : new Date(Date.parse(frames[0].date) - 14 * 86_400_000).toISOString().slice(0, 10);
  const atEnd = index >= last;
  // Public reports published since the previous step: "the news this week".
  const news = findings.filter((f) => f.date > prev && f.date <= frame.date);
  const btn = "grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-tm-border bg-tm-surface text-tm-black hover:border-tm-text-muted";

  return (
    <section className="rounded-xl border border-tm-border bg-tm-surface px-4 py-3 shadow-tm-sm print:hidden" aria-label={lang === "es" ? "Reproducir la campaña" : "Replay the campaign"}>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onTogglePlay}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-tm-primary px-3 text-sm font-semibold text-white hover:opacity-90"
        >
          {playing ? <Pause className="h-4 w-4" /> : atEnd ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {playing ? (lang === "es" ? "Pausa" : "Pause") : lang === "es" ? "Reproducir" : "Replay"}
        </button>
        <div className="min-w-[12rem] flex-1">
          <input
            type="range"
            min={0}
            max={last}
            value={index}
            onChange={(e) => onIndex(Number(e.target.value))}
            className="w-full accent-tm-primary"
            aria-label={lang === "es" ? "Semana de la campaña" : "Campaign week"}
          />
          <div className="flex justify-between text-[11px] text-tm-text-muted">
            <span>{formatDate(frames[0].date, lang)}</span>
            <span>{formatDate(frames[last].date, lang)}</span>
          </div>
        </div>
        <p className="shrink-0 text-sm tabular-nums text-tm-black">
          <span className="text-tm-text-muted">{lang === "es" ? "Semana" : "Week"} {index + 1}/{frames.length} · </span>
          <b>{formatDate(frame.date, lang)}</b>
        </p>
        <div className="inline-flex rounded-lg border border-tm-border p-0.5 text-xs font-semibold" role="group" aria-label={lang === "es" ? "Velocidad" : "Speed"}>
          {[1, 2, 4].map((x) => (
            <button key={x} type="button" aria-pressed={speed === x} onClick={() => onSpeed(x)} className={`rounded-md px-2 py-1 ${speed === x ? "bg-tm-primary text-white" : "text-tm-text-light hover:text-tm-black"}`}>
              {x}×
            </button>
          ))}
        </div>
        <button type="button" onClick={onDownloadLog} className={btn} title={lang === "es" ? "Descargar el registro de decisiones (CSV)" : "Download the decision log (CSV)"}>
          <Download className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => onIndex(last)} disabled={atEnd} className={`${btn} disabled:opacity-40`} title={lang === "es" ? "Ir al final" : "Jump to the end"}>
          <SkipForward className="h-4 w-4" />
        </button>
        {onBackToToday && (
          <button type="button" onClick={onBackToToday} className="inline-flex h-9 items-center rounded-lg border border-tm-border px-3 text-sm font-medium text-tm-black hover:border-tm-text-muted">
            {lang === "es" ? "Volver a hoy" : "Back to today"}
          </button>
        )}
      </div>
      {!atEnd && (
        <p className="mt-2 rounded-lg bg-tm-accent/10 px-3 py-1.5 text-xs text-tm-black">
          {lang === "es"
            ? `Viendo este expediente al ${formatDate(frame.date, lang)}, con los datos disponibles a esa fecha. No es el estado actual del préstamo.`
            : `Viewing this file as of ${formatDate(frame.date, lang)}, with the data available on that date. This is not the current state of the loan.`}
        </p>
      )}
      {pauseNote && !playing && (
        <p className="mt-2 rounded-lg border border-tm-black/20 bg-tm-neutral-light px-3 py-1.5 text-xs font-medium text-tm-black">{pauseNote}</p>
      )}
      {news.map((f) => (
        <a
          key={f.url}
          href={f.url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block rounded-lg bg-tm-neutral-light px-3 py-2 text-sm hover:bg-tm-neutral"
        >
          <span className="text-xs text-tm-text-muted">
            {formatDate(f.date, lang)} · {f.source}
          </span>
          <span className="block font-medium text-tm-black">{f.headline}</span>
          <span className="block text-xs text-tm-text-light">{tb(f.relevance, lang)}</span>
        </a>
      ))}
    </section>
  );
}
