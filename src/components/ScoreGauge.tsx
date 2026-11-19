import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { RiskTier } from "../types";
import { getTierColors } from "../lib/risk-colors";

interface ScoreGaugeProps {
  score: number;
  tier: RiskTier;
}

const RADIUS = 72;
const STROKE = 10;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ScoreGauge({ score, tier }: ScoreGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  // Count from the value on screen, not from 0, so a score update does not
  // reset the gauge (the pre-harvest replay changes the score every step).
  const shown = useRef(0);
  const colors = getTierColors(tier);
  // The ring animates straight to the target; only the number is ticked by hand.
  const offset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;

  useEffect(() => {
    const duration = 900;
    const from = shown.current;
    const start = performance.now();
    let frame: number;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(from + (score - from) * eased);
      shown.current = value;
      setAnimatedScore(value);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  return (
    <div className="relative">
      <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-90">
        <circle
          cx="90"
          cy="90"
          r={RADIUS}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={STROKE}
        />
        <motion.circle
          cx="90"
          cy="90"
          r={RADIUS}
          fill="none"
          stroke={colors.arc}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-5xl text-tm-black">{animatedScore}</span>
        <span className="text-sm text-tm-text-muted">/100</span>
      </div>
    </div>
  );
}
