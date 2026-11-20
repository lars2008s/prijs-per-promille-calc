import { useId } from "react";
import { motion } from "motion/react";

/**
 * Animated pint: the beer pours in, the foam wobbles and bubbles rise.
 * `loop` keeps pouring (used while the card is being read).
 */
export function BeerGlass({ size = 150, loop = false, level = 0.78 }: { size?: number; loop?: boolean; level?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const top = 22;
  const bottom = 150;
  const fillY = bottom - (bottom - top) * level;
  return (
    <svg className="beer-glass" width={size} height={size * 1.25} viewBox="0 0 120 160" aria-hidden="true">
      <defs>
        <clipPath id={`pint${uid}`}>
          <path d="M18 20h84l-9 132a6 6 0 0 1-6 5.5H33a6 6 0 0 1-6-5.5z" />
        </clipPath>
        <linearGradient id={`beer${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffd25e" />
          <stop offset="0.55" stopColor="#f7a928" />
          <stop offset="1" stopColor="#b85d06" />
        </linearGradient>
        <linearGradient id={`shine${uid}`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <g clipPath={`url(#pint${uid})`}>
        <rect x="0" y="0" width="120" height="160" fill="rgba(255,240,210,0.05)" />
        <motion.g
          initial={{ y: 140 }}
          animate={loop ? { y: [140, 0, 0, 140] } : { y: 0 }}
          transition={
            loop
              ? { duration: 3.2, times: [0, 0.55, 0.85, 1], repeat: Infinity, ease: "easeInOut" }
              : { duration: 1.5, ease: [0.2, 0.8, 0.2, 1], delay: 0.25 }
          }
        >
          <rect x="0" y={fillY} width="120" height="160" fill={`url(#beer${uid})`} />
          {[22, 38, 55, 70, 86, 98].map((x, i) => (
            <circle key={x} className="glass-bubble" cx={x} cy={150} r={1.4 + (i % 3) * 0.7} style={{ animationDelay: `${i * 0.37}s` }} />
          ))}
          <g className="foam">
            <rect x="0" y={fillY - 9} width="120" height="12" fill="#fff6e6" />
            {[8, 24, 40, 56, 72, 88, 104, 118].map((x, i) => (
              <circle key={x} cx={x} cy={fillY - 9} r={8 + (i % 3) * 2.5} fill="#fff6e6" />
            ))}
          </g>
        </motion.g>
        <rect x="26" y="20" width="12" height="140" fill={`url(#shine${uid})`} opacity="0.6" />
      </g>

      <path
        d="M18 20h84l-9 132a6 6 0 0 1-6 5.5H33a6 6 0 0 1-6-5.5z"
        fill="none"
        stroke="rgba(255,240,215,0.75)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <text x="60" y="108" textAnchor="middle" className="glass-mark">
        %
      </text>
    </svg>
  );
}
