import type { CSSProperties } from "react";
import "./ProcessingMascot.css";

const DEFAULT_MESSAGES = [
  "Reading deal documents…",
  "Scoring counterparty risk…",
  "Checking trade route…",
  "Calculating financing terms…",
] as const;

export interface ProcessingMascotProps {
  messages?: string[];
  size?: number;
  className?: string;
}

function AnalystCharacter() {
  return (
    <svg
      className="processing-mascot__character"
      viewBox="0 0 100 100"
      aria-hidden
    >
      <rect width="100" height="100" fill="var(--color-bg-card)" />
      {/* Shirt */}
      <path
        d="M22 78c4-18 52-18 56 0v22H22V78z"
        fill="var(--color-primary)"
      />
      {/* Neck */}
      <rect x="42" y="62" width="16" height="12" fill="var(--color-mascot-skin)" />
      {/* Face */}
      <ellipse cx="50" cy="48" rx="22" ry="24" fill="var(--color-mascot-skin)" />
      {/* Hair */}
      <path
        d="M28 44c2-16 18-24 22-24s20 8 22 24c-8-4-16-6-22-6s-14 2-22 6z"
        fill="var(--color-text-heading)"
      />
      <path
        d="M27 38c6-10 14-14 23-14 9 0 17 4 23 14-5-6-12-9-23-9s-18 3-23 9z"
        fill="var(--color-text-heading)"
      />
      {/* Glasses */}
      <circle
        cx="40"
        cy="50"
        r="7"
        fill="none"
        stroke="var(--color-text-body)"
        strokeWidth="2"
      />
      <circle
        cx="60"
        cy="50"
        r="7"
        fill="none"
        stroke="var(--color-text-body)"
        strokeWidth="2"
      />
      <path
        d="M47 50h6"
        stroke="var(--color-text-body)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Eyes */}
      <circle cx="40" cy="50" r="2" fill="var(--color-text-heading)" />
      <circle cx="60" cy="50" r="2" fill="var(--color-text-heading)" />
      {/* Smile */}
      <path
        d="M44 58q6 5 12 0"
        fill="none"
        stroke="var(--color-text-body)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LightbulbIcon() {
  return (
    <svg
      className="processing-mascot__bulb"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M9 21h6v-1H9v1zm3-19a7 7 0 0 0-4 12.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26A7 7 0 0 0 12 2zm0 2a5 5 0 0 1 3.07 8.94l-.57.43V16h-5v-2.63l-.57-.43A5 5 0 0 1 12 4z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg
      className="processing-mascot__gear"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.94 3a7.94 7.94 0 0 1 .06.98 7.94 7.94 0 0 1-.06.98l2.11 1.65a.5.5 0 0 1 .12.64l-2 3.46a.5.5 0 0 1-.6.22l-2.49-1a8.06 8.06 0 0 1-1.7.98l-.38 2.65a.5.5 0 0 1-.5.42h-4a.5.5 0 0 1-.5-.42l-.38-2.65a8.06 8.06 0 0 1-1.7-.98l-2.49 1a.5.5 0 0 1-.6-.22l-2-3.46a.5.5 0 0 1 .12-.64L3 12.96a7.94 7.94 0 0 1 0-1.96L.89 9.35a.5.5 0 0 1-.12-.64l2-3.46a.5.5 0 0 1 .6-.22l2.49 1a8.06 8.06 0 0 1 1.7-.98l.38-2.65A.5.5 0 0 1 9.94 1h4a.5.5 0 0 1 .5.42l.38 2.65a8.06 8.06 0 0 1 1.7.98l2.49-1a.5.5 0 0 1 .6.22l2 3.46a.5.5 0 0 1-.12.64L20.94 11z" />
    </svg>
  );
}

export function ProcessingMascot({
  messages = [...DEFAULT_MESSAGES],
  size = 220,
  className = "",
}: ProcessingMascotProps) {
  const cycle = messages.length > 0 ? messages : [...DEFAULT_MESSAGES];
  const padded = [...cycle];
  while (padded.length < 4) {
    padded.push(cycle[padded.length % cycle.length] ?? DEFAULT_MESSAGES[0]);
  }
  const displayMessages = padded.slice(0, 4);

  const style = {
    "--pm-size": `${size}px`,
  } as CSSProperties;

  const cycleSeconds = displayMessages.length * 2;

  return (
    <div
      className={`processing-mascot ${className}`.trim()}
      style={style}
      role="status"
      aria-live="polite"
      aria-label="Processing"
    >
      <div className="processing-mascot__stage">
        <div className="processing-mascot__orbit processing-mascot__orbit--1">
          <span className="processing-mascot__dot processing-mascot__dot--primary" />
        </div>
        <div className="processing-mascot__orbit processing-mascot__orbit--2">
          <span className="processing-mascot__dot processing-mascot__dot--accent" />
        </div>
        <div className="processing-mascot__orbit processing-mascot__orbit--3">
          <span className="processing-mascot__dot processing-mascot__dot--danger" />
        </div>
        <div className="processing-mascot__ring" aria-hidden />
        <div className="processing-mascot__badge">
          <AnalystCharacter />
        </div>
        <LightbulbIcon />
        <GearIcon />
      </div>
      <div className="processing-mascot__status">
        {displayMessages.map((message, index) => (
          <span
            key={`${index}-${message}`}
            className="processing-mascot__message"
            style={{
              animationDuration: `${cycleSeconds}s`,
              animationDelay: `${index * 2}s`,
            }}
          >
            {message}
          </span>
        ))}
      </div>
    </div>
  );
}
