import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { LogoMark } from "./Icon.tsx";

export function AgeGate({ onConfirm }: { onConfirm: () => void }) {
  const [minor, setMinor] = useState(false);
  return (
    <motion.div
      className="gate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
    >
      <motion.div
        className="gate-card"
        initial={{ y: 40, scale: 0.94, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: -30, scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
      >
        <motion.div
          className="gate-coaster"
          initial={{ rotate: -200, scale: 0.3 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 140, damping: 13, delay: 0.1 }}
        >
          <LogoMark size={92} />
          <span className="gate-18">18+</span>
        </motion.div>
        <AnimatePresence mode="wait" initial={false}>
          {!minor ? (
            <motion.div key="ask" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <h1 id="gate-title" className="gate-title">
                Ben je 18 jaar of ouder?
              </h1>
              <p className="gate-text">
                Prijs per Promille vergelijkt drankprijzen en is enkel bedoeld voor volwassenen.
              </p>
              <p className="gate-warning">Alcohol schaadt de gezondheid. Drink met mate.</p>
              <div className="gate-actions">
                <button className="btn btn-primary btn-lg" onClick={onConfirm} autoFocus>
                  Ja, ik ben 18+
                </button>
                <button className="btn btn-ghost" onClick={() => setMinor(true)}>
                  Nee
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="minor" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="gate-title">Dan is dit (nog) niets voor jou</h1>
              <p className="gate-text">Kom gerust terug als je 18 bent. Tot dan: proost met een frisdrank! 🧃</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
