import type { ReactNode } from "react";
import { getScoreBarColor } from "../lib/risk-colors";

interface SubScoreBarProps {
  label: string;
  score: number;
  why: string;
  weight?: number;
  children?: ReactNode;
}

export function SubScoreBar({
  label,
  score,
  why,
  weight,
  children,
}: SubScoreBarProps) {
  const barColor = getScoreBarColor(score);

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
      {children}
    </div>
  );
}

function PartySubScore({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-tm-text-muted">{label}</span>
      <span className="font-medium text-tm-text">{score}</span>
    </div>
  );
}

SubScoreBar.Party = PartySubScore;
