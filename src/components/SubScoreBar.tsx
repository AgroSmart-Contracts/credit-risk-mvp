import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { DimensionBreakdown } from "../lib/scoring";
import { getScoreBarColor } from "../lib/risk-colors";

interface SubScoreBarProps {
  label: string;
  score: number;
  why: string;
  weight?: number;
  headroom?: number;
  breakdown?: DimensionBreakdown;
  children?: ReactNode;
}

function formatPoints(points: number): string {
  if (points > 0) return `+${points.toFixed(1)}`;
  return points.toFixed(1);
}

function formatOverallImpact(points: number): string {
  if (points > 0) return `+${points.toFixed(2)} overall`;
  if (points < 0) return `${points.toFixed(2)} overall`;
  return "0 overall";
}

export function SubScoreBar({
  label,
  score,
  why,
  weight,
  headroom,
  breakdown,
  children,
}: SubScoreBarProps) {
  const [expanded, setExpanded] = useState(false);
  const barColor = getScoreBarColor(score);
  const hasFactors = breakdown && breakdown.factors.length > 0;
  const isMaxed = headroom !== undefined && headroom <= 0;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-tm-black">{label}</span>
          {weight !== undefined && (
            <span className="text-xs text-tm-text-muted">
              ({Math.round(weight * 100)}% weight)
            </span>
          )}
        </div>
        <span className="font-display text-lg text-tm-black">{score}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-tm-neutral">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-tm-text-light">{why}</p>
      {isMaxed && (
        <p className="mt-1 text-xs font-medium text-amber-700">
          Dimension maxed — additional confirmed data will not change this score.
        </p>
      )}
      {headroom !== undefined && headroom > 0 && headroom < 5 && (
        <p className="mt-1 text-xs text-tm-text-muted">
          {headroom.toFixed(1)} pts headroom before ceiling
        </p>
      )}
      {hasFactors && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            className="inline-flex items-center gap-1 text-xs font-medium text-tm-primary hover:text-tm-primary-dark"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
            {expanded ? "Hide" : "Show"} factor breakdown
          </button>
          {expanded && (
            <ul className="mt-2 space-y-1.5 rounded-lg border border-tm-border bg-tm-neutral-light px-3 py-2">
              {breakdown.factors.map((f) => (
                <li
                  key={`${f.label}-${f.input}`}
                  className="flex flex-col gap-0.5 text-xs sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-tm-text">{f.label}</span>
                    <span className="text-tm-text-muted"> — {f.input}</span>
                  </div>
                  <div className="shrink-0 text-right tabular-nums text-tm-text-light">
                    <span className="font-medium text-tm-text">
                      {formatPoints(f.points)} pts
                    </span>
                    <span className="ml-2 text-tm-text-muted">
                      ({formatOverallImpact(f.weightedContribution)})
                    </span>
                  </div>
                </li>
              ))}
              <li className="border-t border-tm-border pt-1.5 text-xs text-tm-text-muted">
                Raw {breakdown.raw.toFixed(1)} → clamped {breakdown.value}
                {breakdown.headroom > 0
                  ? ` · ${breakdown.headroom.toFixed(1)} pts headroom`
                  : " · at ceiling"}
              </li>
            </ul>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

function PartySubScore({
  label,
  score,
  headroom,
  breakdown,
}: {
  label: string;
  score: number;
  headroom?: number;
  breakdown?: DimensionBreakdown;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasFactors = breakdown && breakdown.factors.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          disabled={!hasFactors}
          onClick={() => setExpanded((open) => !open)}
          className={`text-left ${hasFactors ? "text-tm-text hover:text-tm-black" : "text-tm-text-muted"}`}
        >
          {label}
          {hasFactors && (
            <ChevronDown
              className={`ml-1 inline h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          )}
        </button>
        <span className="font-medium text-tm-text">{score}</span>
      </div>
      {expanded && breakdown && (
        <ul className="mt-1 space-y-1 border-l-2 border-tm-border pl-2">
          {breakdown.factors.map((f) => (
            <li key={`${f.label}-${f.input}`} className="text-[11px] text-tm-text-muted">
              <span className="text-tm-text">{f.label}</span>: {f.input} (
              {formatPoints(f.points)} pts)
            </li>
          ))}
        </ul>
      )}
      {headroom !== undefined && headroom <= 0 && (
        <p className="mt-0.5 text-[11px] text-amber-700">Maxed</p>
      )}
    </div>
  );
}

SubScoreBar.Party = PartySubScore;
