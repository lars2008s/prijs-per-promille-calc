import { useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CATEGORY_META, fmt, metrics, sortDrinks, type Category, type SortKey } from "../lib/drinks.ts";
import type { Action, AppState, Photo } from "../state.ts";
import { useProfile } from "../profile.ts";
import { Leaderboard } from "./Leaderboard.tsx";
import { BeerGlass } from "./BeerGlass.tsx";
import { Icon } from "./Icon.tsx";
import { Burst } from "./MotionBits.tsx";

const TABS: { key: SortKey; label: string }[] = [
  { key: "deal", label: "Beste deal" },
  { key: "cheap", label: "Goedkoopst" },
  { key: "strong", label: "Sterkst" },
  { key: "most", label: "Meeste promille" },
];

const READING_LINES = [
  "Kaart aan het lezen…",
  "Prijzen ontcijferen…",
  "Centiliters tellen…",
  "Alcoholpercentages opzoeken…",
  "Promilles berekenen…",
  "Schuim afschrapen…",
];

export function Results({
  state,
  dispatch,
  onCamera,
  onPick,
  onRetry,
  onRemovePhoto,
  onReset,
  onProfile,
  profileSet = true,
  demo = false,
}: {
  state: AppState;
  dispatch: Dispatch<Action>;
  onCamera: () => void;
  onPick: () => void;
  onRetry: (id: string) => void;
  onRemovePhoto: (id: string) => void;
  onReset: () => void;
  onProfile?: () => void;
  /** False until the visitor entered a weight: the chip then asks for attention. */
  profileSet?: boolean;
  demo?: boolean;
}) {
  const { drinks, photos, sort, filter } = state;
  const profile = useProfile();
  const scanning = photos.some((p) => p.status === "queued" || p.status === "scanning");

  const presentCats = useMemo(() => {
    const counts = new Map<Category, number>();
    for (const d of sortDrinks(drinks, "deal")) counts.set(d.category, (counts.get(d.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [drinks]);

  const ranked = useMemo(() => {
    const list = filter === "all" ? drinks : drinks.filter((d) => d.category === filter);
    return sortDrinks(list, sort);
  }, [drinks, filter, sort]);

  useEffect(() => {
    if (filter !== "all" && !presentCats.some(([c]) => c === filter)) dispatch({ type: "filter", filter: "all" });
  }, [filter, presentCats, dispatch]);

  // Celebrate when a scan round finishes.
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const wasScanning = useRef(scanning);
  useEffect(() => {
    if (wasScanning.current && !scanning) {
      const winner = sortDrinks(drinks, "deal")[0];
      if (winner) {
        setToast({
          id: Date.now(),
          text: `${winner.name} wint met ${fmt.eur(metrics(winner, profile).eurPerPromille)} per promille`,
        });
      }
    }
    wasScanning.current = scanning;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const notices = photos
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => (p.status === "error" && p.error) || (p.status === "done" && p.warning));

  return (
    <motion.section
      className="results"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
    >
      <PhotoStrip photos={photos} onCamera={onCamera} onPick={onPick} onRetry={onRetry} onRemove={onRemovePhoto} />

      <AnimatePresence>
        {notices.map(({ p, i }) => (
          <motion.div
            key={p.id}
            className={`notice ${p.status === "error" ? "notice-error" : "notice-warn"}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Icon name="alert" size={16} />
            <span>
              <strong>Foto {i + 1}:</strong> {p.status === "error" ? p.error : p.warning}
            </span>
            {p.status === "error" && p.canRetry && (
              <button className="notice-btn" onClick={() => onRetry(p.id)}>
                Opnieuw
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="results-head">
        <div>
          <h2 className="results-title">De ranking</h2>
          <p className="results-sub">
            <motion.span key={drinks.length} initial={{ opacity: 0.3, y: -6 }} animate={{ opacity: 1, y: 0 }}>
              {ranked.length} {ranked.length === 1 ? "drank" : "dranken"}
            </motion.span>{" "}
            · {photos.length} {photos.length === 1 ? "foto" : "foto's"}
            {scanning && <span className="live-dot">live</span>}
          </p>
        </div>
        <motion.button
          key={`${profile.sex}-${profile.weightKg}`}
          className={`profile-chip ${profileSet ? "" : "unset"}`}
          onClick={onProfile}
          initial={{ scale: 0.85, opacity: 0.4 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 18 }}
          whileTap={{ scale: 0.94 }}
          aria-label={`Promille berekend voor ${profile.sex}, ${profile.weightKg} kg. Aanpassen.`}
        >
          <span className="profile-chip-k">promille voor</span>
          <span className="profile-chip-v">
            {profile.sex} · {profile.weightKg} kg
            <Icon name="edit" size={13} />
          </span>
        </motion.button>
      </div>

      <div className="tabs" role="tablist" aria-label="Sorteer">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={sort === t.key}
            className={`tab ${sort === t.key ? "active" : ""}`}
            onClick={() => dispatch({ type: "sort", sort: t.key })}
          >
            {sort === t.key && (
              <motion.span layoutId="tab-pill" className="tab-pill" transition={{ type: "spring", stiffness: 500, damping: 36 }} />
            )}
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </div>

      {presentCats.length > 1 && (
        <div className="chips" role="group" aria-label="Filter op soort">
          <button className={`chip ${filter === "all" ? "active" : ""}`} onClick={() => dispatch({ type: "filter", filter: "all" })}>
            Alles
          </button>
          {presentCats.map(([c, n]) => (
            <motion.button
              layout
              key={c}
              className={`chip ${filter === c ? "active" : ""}`}
              onClick={() => dispatch({ type: "filter", filter: filter === c ? "all" : c })}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <span aria-hidden="true">{CATEGORY_META[c].icon}</span> {CATEGORY_META[c].label}
              <span className="chip-n">{n}</span>
            </motion.button>
          ))}
        </div>
      )}

      {ranked.length > 0 ? (
        <Leaderboard drinks={ranked} sort={sort} onSelect={(id) => dispatch({ type: "edit", id })} />
      ) : scanning ? (
        <ReadingState />
      ) : (
        <EmptyState onCamera={onCamera} hasPhotos={photos.length > 0} />
      )}

      {scanning && ranked.length > 0 && (
        <motion.div className="still-reading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <span className="dots">
            <i />
            <i />
            <i />
          </span>
          Nog aan het lezen, de ranking schuift mee
        </motion.div>
      )}

      {!demo && (
        <div className="results-actions">
          <button className="btn btn-primary btn-lg" onClick={onCamera}>
            <Icon name="camera" /> Foto toevoegen
          </button>
          <button className="btn btn-ghost" onClick={onReset}>
            <Icon name="retry" size={18} /> Nieuwe kaart
          </button>
        </div>
      )}

      <p className="legend">
        ≈ geschat door de AI · tik op een drank om aan te passen · promille = geschatte piek in je bloed
        (Widmark), nooit een rijtest
      </p>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            className="toast"
            role="status"
            initial={{ y: -80, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
          >
            <span className="toast-trophy">🏆</span>
            <span>{toast.text}</span>
            <Burst count={18} spread={110} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function PhotoStrip({
  photos,
  onCamera,
  onPick,
  onRetry,
  onRemove,
}: {
  photos: Photo[];
  onCamera: () => void;
  onPick: () => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="strip" aria-label="Foto's">
      <AnimatePresence initial={false}>
        {photos.map((p, i) => (
          <motion.div
            key={p.id}
            layout
            className={`tile st-${p.status}`}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          >
            <img src={p.thumb} alt={`Foto ${i + 1}`} />
            {p.status === "scanning" && <span className="scanline" />}
            {p.status === "queued" && <span className="tile-state">wacht</span>}
            {p.status === "done" && (
              <motion.span className="tile-ok" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}>
                <Icon name="check" size={14} />
              </motion.span>
            )}
            {p.status === "error" && (
              <button
                className="tile-err"
                onClick={() => (p.canRetry ? onRetry(p.id) : onRemove(p.id))}
                aria-label={p.canRetry ? `Foto ${i + 1} opnieuw proberen` : `Foto ${i + 1} verwijderen`}
              >
                <Icon name={p.canRetry ? "retry" : "x"} size={18} />
              </button>
            )}
            {p.found > 0 && (
              <motion.span key={p.found} className="tile-n" initial={{ scale: 1.5 }} animate={{ scale: 1 }}>
                +{p.found}
              </motion.span>
            )}
            {p.status !== "scanning" && (
              <button className="tile-x" onClick={() => onRemove(p.id)} aria-label={`Foto ${i + 1} verwijderen`}>
                <Icon name="x" size={12} />
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
      <motion.button layout className="tile tile-add" onClick={onCamera} aria-label="Foto toevoegen">
        <Icon name="plus" size={22} />
        <span>foto</span>
      </motion.button>
      <motion.button layout className="tile tile-add" onClick={onPick} aria-label="Uit galerij">
        <Icon name="images" size={20} />
        <span>galerij</span>
      </motion.button>
    </div>
  );
}

function ReadingState() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((n) => (n + 1) % READING_LINES.length), 1700);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="reading">
      <BeerGlass size={96} loop />
      <div className="reading-line">
        <AnimatePresence mode="wait">
          <motion.span
            key={i}
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {READING_LINES[i]}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="skeletons" aria-hidden="true">
        {[0, 1, 2].map((n) => (
          <div key={n} className="skeleton" style={{ animationDelay: `${n * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ onCamera, hasPhotos }: { onCamera: () => void; hasPhotos: boolean }) {
  return (
    <div className="empty">
      <div className="empty-icon">🧐</div>
      <h3>{hasPhotos ? "Geen alcoholische dranken gevonden" : "Nog niets gescand"}</h3>
      <p>{hasPhotos ? "Probeer een scherpere foto, recht van boven en met genoeg licht." : "Neem een foto van de drankkaart om te beginnen."}</p>
      <button className="btn btn-primary btn-lg" onClick={onCamera}>
        <Icon name="camera" /> Scan de kaart
      </button>
    </div>
  );
}
