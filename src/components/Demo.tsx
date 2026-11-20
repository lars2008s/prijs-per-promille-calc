import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue } from "motion/react";
import { reducer, type Action, type AppState } from "../state.ts";
import { DEFAULT_PROFILE, sortDrinks, type Category, type Profile, type RawDrink, type SortKey } from "../lib/drinks.ts";
import { ProfileContext } from "../profile.ts";
import { Results } from "./Results.tsx";
import { EditSheet } from "./EditSheet.tsx";
import { ProfileSheet } from "./ProfileSheet.tsx";
import { Icon } from "./Icon.tsx";
import { Burst } from "./MotionBits.tsx";

/* ------------------------------------------------------------------ data */

const drink = (
  name: string,
  category: Category,
  priceEur: number,
  volumeMl: number,
  abv: number,
  printed: string,
  estimated = false,
): RawDrink => ({
  printed,
  name,
  category,
  serving: "",
  priceEur,
  volumeMl,
  abv,
  volumeSource: "menu",
  abvSource: estimated ? "estimated" : "menu",
  note: "",
});

// Order chosen so the crown changes hands several times while "reading".
const BEERS: RawDrink[] = [
  drink("Hoegaarden", "bier", 3.2, 250, 4.9, "Hoegaarden 25cl ..... 3,20", true),
  drink("Jupiler", "bier", 3, 250, 5.2, "Jupiler 25cl ..... 3,00", true),
  drink("Leffe Blond", "bier", 4.8, 330, 6.6, "Leffe Blond 33cl 6,6% ..... 4,80"),
  drink("Pitcher Jupiler", "bier", 15, 1500, 5.2, "Pitcher Jupiler 1,5L ..... 15,00", true),
  drink("Kasteel Rouge", "bier", 5.8, 330, 8, "Kasteel Rouge 8% ..... 5,80"),
  drink("Duvel", "bier", 5.2, 330, 8.5, "Duvel 8,5% ..... 5,20"),
  drink("Westmalle Tripel", "bier", 5.5, 330, 9.5, "Westmalle Tripel 9,5% ..... 5,50"),
  drink("Bush Ambrée", "bier", 5.9, 330, 12, "Bush Ambrée 12% ..... 5,90"),
];

const MORE: RawDrink[] = [
  drink("Gin-tonic", "longdrink", 11, 240, 6.7, "Gin-tonic ..... 11,00", true),
  drink("Glas huiswijn rood", "wijn", 5.5, 150, 13, "Huiswijn rood glas ..... 5,50", true),
  drink("Jenever", "shot", 3.5, 30, 30, "Jenever 3cl ..... 3,50"),
  drink("Wodka", "shot", 4.5, 40, 37.5, "Wodka 4cl ..... 4,50", true),
  drink("Fles cava", "bubbels", 32, 750, 11.5, "Cava (fles) ..... 32,00", true),
  drink("Fles huiswijn rood", "wijn", 26, 750, 13, "Huiswijn rood fles ..... 26,00", true),
];

const CAPTION_AFTER: Record<string, string> = {
  Jupiler: "Elke nieuwe drank schuift meteen naar zijn plek ↕",
  "Pitcher Jupiler": "Een pitcher van 1,5 liter? Eerlijk omgerekend, en meteen bovenaan",
  Duvel: "Duvel pikt de kroon in 👑",
  "Bush Ambrée": "Bush Ambrée met 12% wipt naar de top 🚀",
  Jenever: "Sterk is niet altijd een goede deal 🥃",
};

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A tiny chalkboard menu, drawn as SVG, standing in for a photo. */
function menuPhoto(title: string, items: RawDrink[], board: string): string {
  const rows = items
    .slice(0, 7)
    .map((d, i) => {
      const y = 78 + i * 20;
      const price = d.priceEur.toFixed(2).replace(".", ",");
      return `<text x="16" y="${y}">${xml(d.name.slice(0, 16))}</text><text x="204" y="${y}" text-anchor="end">${price}</text>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220">
<rect width="220" height="220" fill="#6b4423"/><rect x="7" y="7" width="206" height="206" rx="6" fill="${board}"/>
<text x="110" y="44" text-anchor="middle" font-family="Georgia,serif" font-size="22" font-style="italic" fill="#ffcf5c">${xml(title)}</text>
<path d="M40 54h140" stroke="#fff6e6" stroke-opacity=".4" stroke-dasharray="4 4"/>
<g font-family="Arial,sans-serif" font-size="13" fill="#fff6e6" fill-opacity=".92">${rows}</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const PHOTO_1 = menuPhoto("Bieren", BEERS, "#1f2b24");
const PHOTO_2 = menuPhoto("Wijn & sterk", MORE, "#2a1d24");

/* -------------------------------------------------------------- timeline */

type Target = () => Element | null;

interface Api {
  dispatch: (a: Action) => void;
  state: () => AppState;
  say: (text: string) => void;
  point: (target: Target | null) => void;
  tap: () => void;
  setProfile: (p: Profile) => void;
  scrollTop: () => void;
  finish: () => void;
}

interface Ev {
  at: number;
  run: (api: Api) => void;
}

const SORT_INDEX: Record<SortKey, number> = { deal: 0, cheap: 1, strong: 2, most: 3 };
const tab = (key: SortKey): Target => () => document.querySelectorAll(".results .tabs .tab")[SORT_INDEX[key]] ?? null;
const chip = (text: string): Target => () =>
  [...document.querySelectorAll(".results .chips .chip")].find((el) => el.textContent?.includes(text)) ?? null;
const row = (name: string): Target => () =>
  [...document.querySelectorAll(".results .row")].find((el) => el.querySelector(".row-name")?.textContent === name) ?? null;
const profileChip: Target = () => document.querySelector(".results .profile-chip");

function buildTimeline(): { events: Ev[]; total: number } {
  const events: Ev[] = [];
  let t = 0;
  const at = (wait: number, run: (api: Api) => void) => {
    t += wait;
    events.push({ at: t, run });
  };
  /** Move the finger to an element, tap it, then act. */
  const tapOn = (wait: number, target: Target, caption: string, act: (api: Api) => void) => {
    at(wait, (api) => {
      api.say(caption);
      api.point(target);
    });
    at(900, (api) => {
      api.tap();
      act(api);
    });
    at(600, (api) => api.point(null));
  };
  const scan = (photoId: string, list: RawDrink[]) =>
    list.forEach((d, i) => {
      at(i === 0 ? 900 : 950, (api) => api.dispatch({ type: "drinkFound", photoId, drink: d }));
      const caption = CAPTION_AFTER[d.name];
      if (caption) at(120, (api) => api.say(caption));
    });

  // The first photo is already in the initial state.
  at(100, (api) => api.say("Stel: je zit op café en fotografeert de bierkaart 📸"));
  at(1700, (api) => api.say("De AI leest de kaart, drank per drank…"));
  scan("demo-1", BEERS);
  at(700, (api) => {
    api.say("Nog een foto erbij: wijn en sterke drank");
    api.dispatch({ type: "addPhoto", photo: { id: "demo-2", thumb: PHOTO_2, status: "queued", found: 0, createdAt: 2 } });
  });
  at(700, (api) => {
    api.dispatch({ type: "photoDone", id: "demo-1", warning: "" });
    api.dispatch({ type: "photoStatus", id: "demo-2", status: "scanning" });
  });
  scan("demo-2", MORE);
  at(900, (api) => {
    api.dispatch({ type: "photoDone", id: "demo-2", warning: "" });
    api.say("En de winnaar is… 🏆");
  });

  tapOn(3400, tab("cheap"), "Sorteer op goedkoopste…", (api) => api.dispatch({ type: "sort", sort: "cheap" }));
  tapOn(1500, tab("strong"), "…op sterkste…", (api) => api.dispatch({ type: "sort", sort: "strong" }));
  tapOn(1500, tab("most"), "…of op meeste promille per glas", (api) => api.dispatch({ type: "sort", sort: "most" }));
  tapOn(1700, chip("Wijn"), "Enkel wijn? Filter op soort 🍷", (api) => api.dispatch({ type: "filter", filter: "wijn" }));
  tapOn(1700, chip("Alles"), "Terug naar alles…", (api) => api.dispatch({ type: "filter", filter: "all" }));
  tapOn(900, tab("deal"), "…gerangschikt op beste deal", (api) => api.dispatch({ type: "sort", sort: "deal" }));
  tapOn(1700, row("Kasteel Rouge"), "Happy hour! Kasteel Rouge nu €2,90 🎉", (api) => {
    const k = api.state().drinks.find((d) => d.name === "Kasteel Rouge");
    if (k) api.dispatch({ type: "updateDrink", id: k.id, patch: { priceEur: 2.9 } });
  });
  at(500, (api) => api.scrollTop());
  tapOn(2600, profileChip, "Promille hangen af van je lichaam: nu voor een vrouw van 60 kg", (api) =>
    api.setProfile({ sex: "vrouw", weightKg: 60 }),
  );
  at(3600, (api) => api.finish());
  return { events, total: t };
}

/* ------------------------------------------------------------- component */

const START: AppState = {
  screen: "results",
  drinks: [],
  photos: [{ id: "demo-1", thumb: PHOTO_1, status: "scanning", found: 0, createdAt: 1 }],
  sort: "deal",
  filter: "all",
  editingId: null,
};
const TICK = 100;

export function Demo({ onExit, onCamera, onPick }: { onExit: () => void; onCamera: () => void; onPick: () => void }) {
  const [run, setRun] = useState(0);
  return <DemoRun key={run} onExit={onExit} onCamera={onCamera} onPick={onPick} onRestart={() => setRun((n) => n + 1)} />;
}

function DemoRun({
  onExit,
  onCamera,
  onPick,
  onRestart,
}: {
  onExit: () => void;
  onCamera: () => void;
  onPick: () => void;
  onRestart: () => void;
}) {
  const [state, dispatch] = useReducer(reducer, START);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [profileOpen, setProfileOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [done, setDone] = useState(false);
  const [finger, setFinger] = useState<{ x: number; y: number; on: boolean; taps: number }>({ x: 0, y: 0, on: false, taps: 0 });
  const progress = useMotionValue(0);

  const stateRef = useRef(state);
  stateRef.current = state;
  const paused = useRef(false);
  paused.current = state.editingId !== null || profileOpen;

  const point = useCallback((target: Target | null) => {
    const el = target?.();
    if (!el) {
      setFinger((f) => ({ ...f, on: false }));
      return;
    }
    const r0 = el.getBoundingClientRect();
    const hidden = r0.top < 80 || r0.bottom > window.innerHeight - 170;
    if (hidden) el.scrollIntoView({ block: "center", behavior: "smooth" });
    window.setTimeout(
      () => {
        const r = el.getBoundingClientRect();
        setFinger((f) => ({ ...f, x: r.left + r.width / 2, y: r.top + r.height / 2, on: true }));
      },
      hidden ? 420 : 0,
    );
  }, []);

  useEffect(() => {
    const { events, total } = buildTimeline();
    const api: Api = {
      dispatch,
      state: () => stateRef.current,
      say: setCaption,
      point,
      tap: () => setFinger((f) => ({ ...f, taps: f.taps + 1 })),
      setProfile,
      scrollTop: () => window.scrollTo({ top: 0, behavior: "smooth" }),
      finish: () => setDone(true),
    };
    let elapsed = 0;
    let next = 0;
    const id = window.setInterval(() => {
      if (paused.current || document.hidden) return;
      elapsed += TICK;
      while (next < events.length && events[next].at <= elapsed) events[next++].run(api);
      progress.set(Math.min(1, elapsed / total));
      if (next >= events.length) window.clearInterval(id);
    }, TICK);
    return () => window.clearInterval(id);
  }, [point, progress]);

  const leave = (then: () => void) => {
    setFinger((f) => ({ ...f, on: false }));
    then();
  };
  const editing = state.drinks.find((d) => d.id === state.editingId);
  const editingRank = editing ? sortDrinks(state.drinks, state.sort).findIndex((d) => d.id === editing.id) + 1 : 0;

  return (
    <ProfileContext.Provider value={profile}>
      <motion.div className="demo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
        <Results
          state={state}
          dispatch={dispatch}
          onCamera={() => leave(onCamera)}
          onPick={() => leave(onPick)}
          onRetry={() => {}}
          onRemovePhoto={() => {}}
          onReset={() => leave(onExit)}
          onProfile={() => setProfileOpen(true)}
          demo
        />
      </motion.div>

      <motion.div
        className={`demo-bar ${done ? "is-done" : ""}`}
        layout
        initial={{ y: 120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 120, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        role="status"
        aria-live="polite"
      >
        {!done ? (
          <>
            <div className="demo-bar-row">
              <span className="demo-badge">demo</span>
              <div className="demo-caption">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={caption}
                    initial={{ y: 22, opacity: 0, filter: "blur(4px)" }}
                    animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                    exit={{ y: -22, opacity: 0, filter: "blur(4px)" }}
                    transition={{ type: "spring", stiffness: 420, damping: 30 }}
                  >
                    {caption}
                  </motion.span>
                </AnimatePresence>
              </div>
              <button className="demo-stop" onClick={() => leave(onExit)} aria-label="Demo stoppen">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="demo-progress" aria-hidden="true">
              <motion.span style={{ scaleX: progress }} />
            </div>
          </>
        ) : (
          <motion.div
            className="demo-end"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 20 }}
          >
            <Burst count={22} spread={140} />
            <h2>Nu jij! 🍻</h2>
            <p>Scan de kaart van jouw café en zie meteen waar je het meest krijgt voor je geld.</p>
            <p className="demo-end-warn">Alcohol schaadt de gezondheid. Drink met mate.</p>
            <div className="demo-end-actions">
              <button className="btn btn-primary btn-lg" onClick={() => leave(onCamera)}>
                <Icon name="camera" /> Scan je kaart
              </button>
              <button className="btn btn-ghost" onClick={onRestart}>
                <Icon name="retry" size={18} /> Nog eens
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>

      <AnimatePresence>
        {finger.on && (
          <motion.div
            className="demo-finger"
            aria-hidden="true"
            initial={{ x: window.innerWidth * 0.7, y: window.innerHeight * 0.8, opacity: 0, scale: 0.6 }}
            animate={{ x: finger.x, y: finger.y, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 170, damping: 20 }}
          >
            <motion.span
              key={finger.taps}
              className="demo-finger-hand"
              initial={{ scale: 1 }}
              animate={finger.taps ? { scale: [1, 0.78, 1], rotate: [0, -8, 0] } : {}}
              transition={{ duration: 0.35 }}
            >
              👆
            </motion.span>
            <AnimatePresence>
              {finger.taps > 0 && (
                <motion.span
                  key={finger.taps}
                  className="demo-ripple"
                  initial={{ scale: 0.2, opacity: 0.9 }}
                  animate={{ scale: 2.6, opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <EditSheet
        drink={editing}
        rank={editingRank}
        onClose={() => dispatch({ type: "edit", id: null })}
        onUpdate={(id, patch) => dispatch({ type: "updateDrink", id, patch })}
        onRemove={(id) => dispatch({ type: "removeDrink", id })}
      />
      <ProfileSheet open={profileOpen} profile={profile} onChange={setProfile} onClose={() => setProfileOpen(false)} />
    </ProfileContext.Provider>
  );
}
