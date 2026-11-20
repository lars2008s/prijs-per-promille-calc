import { motion } from "motion/react";
import { BeerGlass } from "./BeerGlass.tsx";
import { Icon } from "./Icon.tsx";
import { useProfile } from "../profile.ts";

const STEPS = [
  { n: "01", t: "Fotografeer de kaart", d: "Meerdere foto's? Knip er gewoon achter elkaar op los." },
  { n: "02", t: "AI leest alles", d: "Prijzen, centiliters en alcoholpercentages, ook als ze er niet op staan." },
  { n: "03", t: "Bekijk de ranking", d: "Meeste alcohol voor je geld bovenaan. Live, terwijl je scant." },
];

const word = {
  hidden: { y: 60, opacity: 0, rotate: -4 },
  show: (i: number) => ({
    y: 0,
    opacity: 1,
    rotate: 0,
    transition: { type: "spring" as const, stiffness: 260, damping: 18, delay: 0.1 + i * 0.12 },
  }),
};

export function Home({
  onCamera,
  onPick,
  onResults,
  onDemo,
  onProfile,
  resultCount,
}: {
  onCamera: () => void;
  onPick: () => void;
  onResults: () => void;
  onDemo: () => void;
  onProfile: () => void;
  resultCount: number;
}) {
  const profile = useProfile();
  return (
    <motion.section
      className="home"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
    >
      <div className="hero">
        <h1 className="logo" aria-label="Prijs per Promille">
          <motion.span className="logo-l1" variants={word} initial="hidden" animate="show" custom={0}>
            Prijs
          </motion.span>
          <motion.span className="logo-per" variants={word} initial="hidden" animate="show" custom={1}>
            per
          </motion.span>
          <motion.span className="logo-l2" variants={word} initial="hidden" animate="show" custom={2}>
            Promille
          </motion.span>
        </h1>
        <motion.div
          className="hero-glass"
          initial={{ x: 60, rotate: 18, opacity: 0 }}
          animate={{ x: 0, rotate: 6, opacity: 1 }}
          transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.2 }}
        >
          <BeerGlass size={98} />
        </motion.div>
      </div>

      <motion.p className="tagline" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        Fotografeer de drankkaart. Wij zoeken uit waar je de <em>meeste alcohol voor de minste euro's</em> krijgt.
      </motion.p>

      <motion.div
        className="cta"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.6 }}
      >
        <motion.button className="btn btn-primary btn-xl" onClick={onCamera} whileTap={{ scale: 0.97 }}>
          <Icon name="camera" size={26} />
          Scan de kaart
          <span className="btn-shine" />
        </motion.button>
        <button className="btn btn-ghost btn-lg" onClick={onPick}>
          <Icon name="images" />
          Kies foto's uit je galerij
        </button>
        <motion.button
          className="btn btn-demo"
          onClick={onDemo}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
          whileTap={{ scale: 0.96 }}
        >
          <span className="demo-play" aria-hidden="true">
            <Icon name="play" size={14} />
          </span>
          Bekijk eerst de demo
        </motion.button>
        {resultCount > 0 && (
          <motion.button
            className="btn btn-resume"
            onClick={onResults}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8 }}
          >
            Bekijk je ranking <span className="pill">{resultCount}</span>
            <Icon name="arrowRight" size={18} />
          </motion.button>
        )}
      </motion.div>

      <ol className="steps">
        {STEPS.map((s, i) => (
          <motion.li
            key={s.n}
            className="step"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 + i * 0.12, type: "spring", stiffness: 200, damping: 22 }}
          >
            <span className="step-n">{s.n}</span>
            <div>
              <div className="step-t">{s.t}</div>
              <div className="step-d">{s.d}</div>
            </div>
          </motion.li>
        ))}
      </ol>

      <p className="std-note">
        Gerangschikt op <strong>prijs per promille</strong>: wat het kost om je bloedalcohol met 1‰ te laten stijgen.
        Nu berekend voor{" "}
        <button className="link-btn" onClick={onProfile}>
          {profile.sex}, {profile.weightKg} kg
        </button>
        . Hoe lager, hoe beter de deal.
      </p>
    </motion.section>
  );
}
