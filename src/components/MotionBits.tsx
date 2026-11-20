import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, animate, motion } from "motion/react";
import { fmt } from "../lib/drinks.ts";

/** Split-flap style text: every changed character flips over. */
export function Flap({ value, className = "" }: { value: string; className?: string }) {
  return (
    <span className={`flap ${className}`} aria-label={value}>
      {value.split("").map((ch, i) => (
        <span className="flap-cell" key={i} aria-hidden="true">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={ch}
              className="flap-char"
              initial={{ rotateX: -95, opacity: 0, y: -4 }}
              animate={{ rotateX: 0, opacity: 1, y: 0 }}
              exit={{ rotateX: 95, opacity: 0, y: 4 }}
              transition={{ duration: 0.32, delay: i * 0.05, ease: [0.3, 0.7, 0.3, 1] }}
            >
              {ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

/** Number that counts towards its new value. */
/** "+0,42‰" with the sign in the body font, where it reads as promille and not as a squeezed %. */
export function AnimatedPromille({ value, className }: { value: number; className?: string }) {
  return (
    <span className={className}>
      <AnimatedNumber value={value} format={(v) => `+${fmt.num2(v)}`} />
      <span className="unit-pm">‰</span>
    </span>
  );
}

export function AnimatedNumber({
  value,
  format,
  className,
  duration = 0.7,
}: {
  value: number;
  format: (v: number) => string;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const current = useRef(value);
  const formatRef = useRef(format);
  formatRef.current = format;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!Number.isFinite(value) || !Number.isFinite(current.current)) {
      current.current = value;
      el.textContent = formatRef.current(value);
      return;
    }
    const controls = animate(current.current, value, {
      duration,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => {
        current.current = v;
        el.textContent = formatRef.current(v);
      },
    });
    return () => controls.stop();
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}

/** Little explosion of beer bubbles. Re-mount (change key) to fire again. */
export function Burst({ count = 16, spread = 90, className = "" }: { count?: number; spread?: number; className?: string }) {
  const parts = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        const d = spread * (0.55 + Math.random() * 0.6);
        return { x: Math.cos(a) * d, y: Math.sin(a) * d, s: 5 + Math.random() * 9, gold: i % 3 !== 0 };
      }),
    [count, spread],
  );
  return (
    <span className={`burst ${className}`} aria-hidden="true">
      {parts.map((p, i) => (
        <motion.span
          key={i}
          className={`burst-dot ${p.gold ? "gold" : "foam"}`}
          style={{ width: p.s, height: p.s }}
          initial={{ x: 0, y: 0, scale: 0.2, opacity: 1 }}
          animate={{ x: p.x, y: p.y, scale: 1, opacity: 0 }}
          transition={{ duration: 0.9 + Math.random() * 0.4, ease: [0.1, 0.8, 0.3, 1] }}
        />
      ))}
    </span>
  );
}
