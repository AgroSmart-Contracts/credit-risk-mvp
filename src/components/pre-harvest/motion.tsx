/**
 * Motion primitives for the loan file. Figures count to their new value, cards
 * ease in once, and everything drops to a plain swap under reduced motion.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion, useSpring } from "framer-motion";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** A number that counts from its previous value to the new one (about 400 ms). */
export function AnimatedNumber({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const reduce = useReducedMotion();
  const spring = useSpring(value, { stiffness: 120, damping: 20 });
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    spring.set(value);
  }, [value, reduce, spring]);
  useEffect(() => spring.on("change", (v) => setShown(v)), [spring]);
  return <span className={`tabular-nums ${className ?? ""}`}>{format(reduce ? value : shown)}</span>;
}

/** Card entry: rises 8 px and fades in on first mount only. */
export function Rise({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/** Briefly highlights its child whenever `signal` changes (a severity escalation, a new figure). */
export function Flash({ signal, children, className, tone = "accent" }: { signal: unknown; children: ReactNode; className?: string; tone?: "accent" | "danger" | "primary" }) {
  const reduce = useReducedMotion();
  const first = useRef(true);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setN((k) => k + 1);
  }, [signal]);
  const color = tone === "danger" ? "var(--color-tm-danger)" : tone === "primary" ? "var(--color-tm-primary)" : "var(--color-tm-accent)";
  return (
    <motion.div
      key={n}
      className={className}
      initial={reduce || n === 0 ? false : { boxShadow: `0 0 0 0px ${color}` }}
      animate={{ boxShadow: [`0 0 0 0px ${color}`, `0 0 0 4px color-mix(in srgb, ${color} 30%, transparent)`, `0 0 0 0px transparent`] }}
      transition={{ duration: 0.8, ease: EASE_OUT }}
      style={{ borderRadius: 12 }}
    >
      {children}
    </motion.div>
  );
}

/** Pulsing dot for a file that is being monitored right now. */
export function LiveDot({ className = "" }: { className?: string }) {
  return (
    <span className={`relative inline-flex h-2 w-2 ${className}`}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-tm-primary opacity-60 motion-reduce:hidden" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-tm-primary" />
    </span>
  );
}
