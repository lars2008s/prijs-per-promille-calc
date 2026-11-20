import { useEffect, useState, type CSSProperties } from "react";
import { motion } from "motion/react";
import { MAX_WEIGHT, MIN_WEIGHT, metrics, type Profile, type Sex } from "../lib/drinks.ts";
import { AnimatedPromille } from "./MotionBits.tsx";
import { Sheet } from "./Sheet.tsx";

const SLIDER_MIN = 40;
const SLIDER_MAX = 150;
const PINTJE = { volumeMl: 250, abv: 5.2, priceEur: 3 };

export function ProfileSheet({
  open,
  profile,
  onChange,
  onClose,
}: {
  open: boolean;
  profile: Profile;
  onChange: (p: Profile) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} label="Jouw promille">
      <ProfileForm profile={profile} onChange={onChange} onClose={onClose} />
    </Sheet>
  );
}

function ProfileForm({ profile, onChange, onClose }: { profile: Profile; onChange: (p: Profile) => void; onClose: () => void }) {
  const [kg, setKg] = useState(String(profile.weightKg));
  useEffect(() => setKg(String(profile.weightKg)), [profile.weightKg]);

  const setWeight = (s: string) => {
    setKg(s);
    const v = Number(s.replace(",", "."));
    if (Number.isFinite(v) && v >= MIN_WEIGHT && v <= MAX_WEIGHT) onChange({ ...profile, weightKg: Math.round(v) });
  };
  const setSex = (sex: Sex) => onChange({ ...profile, sex });
  const pint = metrics(PINTJE, profile);
  const pct = ((Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, profile.weightKg)) - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;

  return (
    <div className="sheet-body profile">
      <h2 className="sheet-title">Jouw promille</h2>
      <p className="profile-intro">
        Hoeveel promille een drankje doet, hangt af van je gewicht en lichaam. Vul ze in en alle bedragen rekenen zich
        meteen om.
      </p>

      <div className="field">
        <span className="field-label" id="sex-label">
          Lichaam
        </span>
        <div className="sex-toggle" role="radiogroup" aria-labelledby="sex-label">
          {(["man", "vrouw"] as const).map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={profile.sex === s}
              className={profile.sex === s ? "on" : ""}
              onClick={() => setSex(s)}
            >
              {profile.sex === s && (
                <motion.span layoutId="sex-pill" className="sex-pill" transition={{ type: "spring", stiffness: 500, damping: 36 }} />
              )}
              <span className="sex-label">{s === "man" ? "Man" : "Vrouw"}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="f-kg">Gewicht</label>
        <div className="abv-row">
          <input
            type="range"
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            step={1}
            value={Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, profile.weightKg))}
            onChange={(e) => setWeight(e.target.value)}
            aria-label="Gewicht schuifregelaar"
            style={{ "--p": `${pct}%` } as CSSProperties}
          />
          <div className="input-wrap small">
            <input id="f-kg" inputMode="numeric" value={kg} onChange={(e) => setWeight(e.target.value)} />
            <span className="affix">kg</span>
          </div>
        </div>
      </div>

      <div className="profile-example">
        <span className="profile-example-icon" aria-hidden="true">
          🍺
        </span>
        <span>
          Een pintje (25 cl, 5,2%) geeft jou ongeveer{" "}
          <AnimatedPromille className="profile-example-value" value={pint.promille} />
        </span>
      </div>

      <p className="info-small">
        Formule van Widmark: promille = gram alcohol ÷ (gewicht × 0,7 voor mannen of 0,6 voor
        vrouwen). Het is een schatting van je piek als je het glas in één keer drinkt; je lichaam breekt ongeveer 0,1 à
        0,15‰ per uur af. <strong>Gebruik dit nooit om te beslissen of je nog mag rijden.</strong>
      </p>
      <p className="info-small">Je gewicht blijft enkel op dit toestel.</p>

      <button className="btn btn-primary btn-block" onClick={onClose}>
        Klaar
      </button>
    </div>
  );
}
