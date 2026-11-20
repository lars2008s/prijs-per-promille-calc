import { useMemo, type CSSProperties } from "react";

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Warm café glow, rising bubbles and film grain behind everything. */
export function Backdrop() {
  const bubbles = useMemo(() => {
    const rnd = seeded(42);
    return Array.from({ length: 26 }, (_, i) => {
      const size = 4 + rnd() * 14;
      return {
        id: i,
        style: {
          left: `${rnd() * 100}%`,
          width: size,
          height: size,
          animationDuration: `${9 + rnd() * 14}s`,
          animationDelay: `${-rnd() * 20}s`,
          "--drift": `${(rnd() - 0.5) * 80}px`,
          opacity: 0.25 + rnd() * 0.45,
        } as CSSProperties,
      };
    });
  }, []);

  return (
    <div className="backdrop" aria-hidden="true">
      <div className="glow glow-a" />
      <div className="glow glow-b" />
      <div className="glow glow-c" />
      <div className="bubbles">
        {bubbles.map((b) => (
          <span key={b.id} className="bubble" style={b.style} />
        ))}
      </div>
      <div className="grain" />
    </div>
  );
}
