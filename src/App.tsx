import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ChangeEvent } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { reducer, type AppState } from "./state.ts";
import { ageGate, loadSession, profileStore, saveSession } from "./lib/storage.ts";
import { prepareFromFile } from "./lib/image.ts";
import { DEFAULT_PROFILE, sortDrinks, type Profile } from "./lib/drinks.ts";
import { ProfileContext } from "./profile.ts";
import { useScanner } from "./useScanner.ts";
import { Backdrop } from "./components/Backdrop.tsx";
import { DisclaimerTicker } from "./components/DisclaimerTicker.tsx";
import { Home } from "./components/Home.tsx";
import { Camera } from "./components/Camera.tsx";
import { Results } from "./components/Results.tsx";
import { EditSheet } from "./components/EditSheet.tsx";
import { InfoSheet } from "./components/InfoSheet.tsx";
import { AgeGate } from "./components/AgeGate.tsx";
import { ProfileSheet } from "./components/ProfileSheet.tsx";
import { Demo } from "./components/Demo.tsx";
import { Icon, LogoMark } from "./components/Icon.tsx";

function init(): AppState {
  const s = loadSession();
  return { screen: "home", drinks: s.drinks, photos: s.photos, sort: "deal", filter: "all", editingId: null };
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, init);
  const [ageOk, setAgeOk] = useState(ageGate.ok);
  const [infoOpen, setInfoOpen] = useState(false);
  const [saved] = useState(profileStore.load);
  const [profile, setProfile] = useState<Profile>(saved ?? DEFAULT_PROFILE);
  const [profileSet, setProfileSet] = useState(saved !== null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [demo, setDemo] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const scanner = useScanner(state.photos, dispatch);

  useEffect(() => {
    saveSession({ drinks: state.drinks, photos: state.photos });
  }, [state.drinks, state.photos]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [state.screen, demo]);

  const changeProfile = useCallback((p: Profile) => {
    setProfile(p);
    setProfileSet(true);
    profileStore.save(p);
  }, []);
  const openProfile = useCallback(() => setProfileOpen(true), []);

  const go = useCallback((screen: AppState["screen"]) => {
    setDemo(false);
    dispatch({ type: "screen", screen });
  }, []);
  const pick = useCallback(() => fileInput.current?.click(), []);

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    go("results");
    let failed = 0;
    for (const f of files.slice(0, 12)) {
      try {
        scanner.add(await prepareFromFile(f));
      } catch {
        failed++;
      }
    }
    setPickError(failed ? `${failed} ${failed === 1 ? "bestand kon" : "bestanden konden"} niet geopend worden.` : null);
  };

  const reset = useCallback(() => {
    if (state.drinks.length > 0 && !window.confirm("Ranking wissen en een nieuwe kaart scannen?")) return;
    scanner.reset();
  }, [scanner, state.drinks.length]);

  const rankedForEdit = useMemo(() => sortDrinks(state.drinks, state.sort), [state.drinks, state.sort]);
  const editing = state.drinks.find((d) => d.id === state.editingId);
  const editingRank = editing ? rankedForEdit.findIndex((d) => d.id === editing.id) + 1 : 0;
  const rankedCount = useMemo(() => sortDrinks(state.drinks, "deal").length, [state.drinks]);

  return (
    <ProfileContext.Provider value={profile}>
    <MotionConfig reducedMotion="user">
      <Backdrop />
      <div className="app">
        <header className="topbar">
          <button className="brand" onClick={() => go("home")} aria-label="Naar start">
            <motion.span whileHover={{ rotate: 25 }} whileTap={{ rotate: 200 }} className="brand-mark">
              <LogoMark size={34} />
            </motion.span>
            <span className="brand-text">
              PPP<small>Prijs per Promille</small>
            </span>
          </button>
          <div className="topbar-actions">
            {state.screen === "home" && !demo && rankedCount > 0 && (
              <button className="icon-btn" onClick={() => go("results")} aria-label="Naar ranking">
                <Icon name="arrowRight" />
              </button>
            )}
            <button className="icon-btn" onClick={() => setInfoOpen(true)} aria-label="Hoe werkt het?">
              <Icon name="info" />
            </button>
          </div>
        </header>

        <main>
          <AnimatePresence mode="wait">
            {demo ? (
              <Demo
                key="demo"
                onExit={() => go(state.screen === "results" ? "results" : "home")}
                onCamera={() => go("camera")}
                onPick={() => {
                  go("home");
                  pick();
                }}
              />
            ) : state.screen === "results" ? (
              <Results
                key="results"
                state={state}
                dispatch={dispatch}
                onCamera={() => go("camera")}
                onPick={pick}
                onRetry={scanner.retry}
                onRemovePhoto={scanner.remove}
                onReset={reset}
                onProfile={openProfile}
                profileSet={profileSet}
              />
            ) : (
              <Home
                key="home"
                onCamera={() => go("camera")}
                onPick={pick}
                onResults={() => go("results")}
                onDemo={() => setDemo(true)}
                onProfile={openProfile}
                resultCount={rankedCount}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {pickError && (
              <motion.button
                className="notice notice-error floating"
                onClick={() => setPickError(null)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <Icon name="alert" size={16} /> {pickError}
              </motion.button>
            )}
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {state.screen === "camera" && (
          <Camera
            key="camera"
            photos={state.photos}
            onCapture={scanner.add}
            onDone={() => go("results")}
            onClose={() => go(state.photos.length ? "results" : "home")}
            onPick={pick}
          />
        )}
      </AnimatePresence>

      <EditSheet
        drink={editing}
        rank={editingRank}
        onClose={() => dispatch({ type: "edit", id: null })}
        onUpdate={(id, patch) => dispatch({ type: "updateDrink", id, patch })}
        onRemove={(id) => dispatch({ type: "removeDrink", id })}
      />
      <InfoSheet
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        onProfile={() => {
          setInfoOpen(false);
          setProfileOpen(true);
        }}
      />
      <ProfileSheet open={profileOpen} profile={profile} onChange={changeProfile} onClose={() => setProfileOpen(false)} />

      <AnimatePresence>
        {!ageOk && (
          <AgeGate
            key="gate"
            onConfirm={() => {
              ageGate.confirm();
              setAgeOk(true);
            }}
          />
        )}
      </AnimatePresence>

      <DisclaimerTicker />

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={onFiles}
        aria-hidden="true"
        tabIndex={-1}
      />
    </MotionConfig>
    </ProfileContext.Provider>
  );
}
