import { memo, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CATEGORY_META,
  fmt,
  metrics,
  rankDeltas,
  relativeScore,
  type Drink,
  type Profile,
  type SortKey,
} from "../lib/drinks.ts";
import { useProfile } from "../profile.ts";
import { AnimatedNumber, AnimatedPromille, Burst, Flap } from "./MotionBits.tsx";
import { Crown } from "./Icon.tsx";

const METRIC: Record<SortKey, { label: string; value: (d: Drink, p: Profile) => number; format: (v: number) => string }> = {
  deal: { label: "per promille", value: (d, p) => metrics(d, p).eurPerPromille, format: fmt.eurTight },
  cheap: { label: "prijs", value: (d) => d.priceEur, format: fmt.eurTight },
  strong: { label: "alcohol", value: (d) => d.abv, format: fmt.pct },
  most: { label: "promille erbij", value: (d, p) => metrics(d, p).promille, format: fmt.num2 },
};

type Delta = number | "new";

export function Leaderboard({
  drinks,
  sort,
  onSelect,
}: {
  drinks: Drink[];
  sort: SortKey;
  onSelect: (id: string) => void;
}) {
  const ids = drinks.map((d) => d.id);
  const orderKey = ids.join(",");
  const prevRanks = useRef<Map<string, number> | null>(null);
  const prevSort = useRef(sort);
  const [deltas, setDeltas] = useState<Map<string, Delta>>(new Map());
  const clearTimer = useRef<number | undefined>(undefined);
  const firstPaint = useRef(true);

  useEffect(() => {
    const t = window.setTimeout(() => (firstPaint.current = false), 50);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const next = new Map(ids.map((id, i) => [id, i]));
    if (prevRanks.current && prevSort.current === sort) {
      const d = rankDeltas(prevRanks.current, ids);
      if (d.size > 0) {
        setDeltas((old) => {
          const merged = new Map(old);
          d.forEach((v, k) => merged.set(k, v));
          return merged;
        });
        window.clearTimeout(clearTimer.current);
        clearTimer.current = window.setTimeout(() => setDeltas(new Map()), 2600);
      }
    } else if (prevSort.current !== sort) {
      setDeltas(new Map());
    }
    prevRanks.current = next;
    prevSort.current = sort;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey, sort]);

  useEffect(() => () => window.clearTimeout(clearTimer.current), []);

  const best = drinks[0];
  const leaderId = best?.id;

  return (
    <ol className="board" aria-label="Ranking">
      <AnimatePresence mode="popLayout" initial={true}>
        {drinks.map((d, i) => (
          <RankRow
            key={d.id}
            drink={d}
            rank={i + 1}
            sort={sort}
            score={best ? relativeScore(d, best, sort) : 1}
            delta={deltas.get(d.id)}
            leaderKey={i === 0 ? leaderId : undefined}
            enterDelay={firstPaint.current ? Math.min(i * 0.06, 0.9) : 0}
            onSelect={onSelect}
          />
        ))}
      </AnimatePresence>
    </ol>
  );
}

interface RowProps {
  drink: Drink;
  rank: number;
  sort: SortKey;
  score: number;
  delta: Delta | undefined;
  leaderKey: string | undefined;
  enterDelay: number;
  onSelect: (id: string) => void;
}

const RankRow = memo(function RankRow({ drink: d, rank, sort, score, delta, leaderKey, enterDelay, onSelect }: RowProps) {
  const tier = rank <= 3 ? rank : 0;
  const metric = METRIC[sort];
  const profile = useProfile();
  const m = metrics(d, profile);
  const est = (s: string) => (s === "estimated" ? "≈" : "");
  const cat = CATEGORY_META[d.category];

  return (
    <motion.li
      layout="position"
      className={`row tier-${tier}`}
      initial={{ opacity: 0, x: 70, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -60, scale: 0.9, transition: { duration: 0.22 } }}
      transition={{
        layout: { type: "spring", stiffness: 300, damping: 30, mass: 0.9 },
        default: { type: "spring", stiffness: 340, damping: 26, delay: enterDelay },
      }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(d.id)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(d.id))}
      tabIndex={0}
      role="button"
      aria-label={`Plaats ${rank}: ${d.name}, ${fmt.eur(d.priceEur)}, ${fmt.pct(d.abv)}, ${fmt.eur(m.eurPerPromille)} per promille. Tik om aan te passen.`}
    >
      <div className="row-rank">
        {tier === 1 && (
          <motion.span
            key={leaderKey}
            className="row-crown"
            initial={{ y: -26, rotate: -30, opacity: 0 }}
            animate={{ y: 0, rotate: -12, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 12, delay: 0.15 }}
          >
            <Crown size={22} />
          </motion.span>
        )}
        <span className="badge">
          <Flap value={String(rank)} />
        </span>
        {tier === 1 && <Burst key={`burst-${leaderKey}`} count={14} spread={70} />}
      </div>

      <div className="row-main">
        <div className="row-title">
          <span className="row-cat" title={cat.label} aria-hidden="true">
            {cat.icon}
          </span>
          <span className="row-name">{d.name}</span>
        </div>
        <div className="row-meta">
          {d.edited && <span className="row-tag">aangepast</span>}
          <span>
            {est(d.volumeSource)}
            {fmt.volume(d.volumeMl)}
          </span>
          <span className="sep">·</span>
          <span>
            {est(d.abvSource)}
            {fmt.pct(d.abv)}
          </span>
          <span className="sep">·</span>
          <span className="row-price">{fmt.eur(d.priceEur)}</span>
          {d.serving && !/^\d/.test(d.serving) && (
            <>
              <span className="sep">·</span>
              <span className="row-serving">{d.serving}</span>
            </>
          )}
        </div>
        <div className="bar" aria-hidden="true">
          <motion.div
            className="bar-fill"
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(4, score * 100)}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20, delay: enterDelay + 0.15 }}
          >
            <span className="bar-foam" />
          </motion.div>
        </div>
      </div>

      <div className="row-metric">
        {sort === "most" ? (
          <AnimatedPromille className="metric-value" value={m.promille} />
        ) : (
          <AnimatedNumber className="metric-value" value={metric.value(d, profile)} format={metric.format} />
        )}
        <span className="metric-label">{metric.label}</span>
        {sort === "deal" && <AnimatedPromille className="metric-sub" value={m.promille} />}
      </div>

      <AnimatePresence>
        {delta !== undefined && delta !== 0 && (
          <motion.span
            key={String(delta)}
            className={`delta ${delta === "new" ? "new" : delta > 0 ? "up" : "down"}`}
            initial={{ scale: 0, y: 6, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 600, damping: 20 }}
          >
            {delta === "new" ? "nieuw" : delta > 0 ? `▲ ${delta}` : `▼ ${-delta}`}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.li>
  );
});
