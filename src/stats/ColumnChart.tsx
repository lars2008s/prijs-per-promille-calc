import { useEffect, useRef, useState, type ReactNode } from "react";

export interface Column {
  key: string;
  label: string;
  value: number;
  tooltip: ReactNode;
}

const BAR = "#cf7f10"; // validated for the dark surface (OKLCH L inside the dark band, >= 3:1)
const BAR_HOVER = "#f7a928";
const MAX_BAR = 24;
const GAP = 2;
const PAD = { top: 22, right: 8, bottom: 26, left: 34 };

function niceMax(max: number): { top: number; step: number } {
  if (max <= 4) return { top: 4, step: 1 };
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  return { top: Math.ceil(max / step) * step, step };
}

const nf = new Intl.NumberFormat("nl-BE");

/** Single-series column chart with a per-column hover tooltip. */
export function ColumnChart({ data, height = 210, label }: { data: Column[]; height?: number; label: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = Math.max(0, ...data.map((d) => d.value));
  const { top, step } = niceMax(max);
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const band = plotW / Math.max(1, data.length);
  const barW = Math.max(2, Math.min(MAX_BAR, band - GAP));
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(plotW / 64))));
  const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0);

  const bar = (i: number, v: number) => {
    const x = PAD.left + i * band + (band - barW) / 2;
    const h = Math.max(0, (v / top) * plotH);
    if (h <= 0) return "";
    const r = Math.min(4, barW / 2, h);
    const yb = PAD.top + plotH;
    const yt = yb - h;
    return `M${x},${yb}V${yt + r}Q${x},${yt} ${x + r},${yt}H${x + barW - r}Q${x + barW},${yt} ${x + barW},${yt + r}V${yb}Z`;
  };

  const hovered = hover !== null ? data[hover] : null;
  const tipLeft = hover !== null ? PAD.left + hover * band + band / 2 : 0;

  return (
    <div className="chart" ref={wrap}>
      <svg width={width} height={height} role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="grid" />
            <text x={PAD.left - 8} y={y(t)} className="tick" textAnchor="end" dominantBaseline="middle">
              {nf.format(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => (
          <path key={d.key} d={bar(i, d.value)} fill={hover === i ? BAR_HOVER : BAR} />
        ))}
        {max === 0 && (
          <text x={PAD.left + plotW / 2} y={PAD.top + plotH / 2} textAnchor="middle" className="empty-note">
            Nog geen gegevens in deze periode
          </text>
        )}
        {max > 0 && (
          <text
            x={PAD.left + peak * band + band / 2}
            y={y(data[peak].value) - 7}
            textAnchor="middle"
            className="peak"
          >
            {nf.format(data[peak].value)}
          </text>
        )}
        {data.map((d, i) =>
          i % labelEvery === (data.length - 1) % labelEvery ? (
            <text key={d.key} x={PAD.left + i * band + band / 2} y={height - 8} textAnchor="middle" className="tick">
              {d.label}
            </text>
          ) : null,
        )}
        {data.map((d, i) => (
          <rect
            key={d.key}
            x={PAD.left + i * band}
            y={PAD.top}
            width={band}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onTouchStart={() => setHover(i)}
          />
        ))}
      </svg>
      {hovered && (
        <div
          className="tip"
          style={{ left: Math.min(Math.max(tipLeft, 80), width - 80), top: Math.max(0, y(hovered.value) - 12) }}
          role="status"
        >
          {hovered.tooltip}
        </div>
      )}
    </div>
  );
}
