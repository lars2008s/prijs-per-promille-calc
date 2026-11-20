import { useEffect, useState, type CSSProperties } from "react";
import { CATEGORY_META, fmt, metrics, type Drink, type RawDrink } from "../lib/drinks.ts";
import { useProfile } from "../profile.ts";
import { AnimatedNumber, AnimatedPromille } from "./MotionBits.tsx";
import { Icon } from "./Icon.tsx";
import { Sheet } from "./Sheet.tsx";

const VOLUME_PRESETS = [3, 4, 15, 25, 33, 50, 75];

const toNum = (s: string) => Number(s.replace(",", "."));
const show = (n: number, digits = 2) =>
  String(Math.round(n * 10 ** digits) / 10 ** digits).replace(".", ",");

export function EditSheet({
  drink,
  rank,
  onClose,
  onUpdate,
  onRemove,
}: {
  drink: Drink | undefined;
  rank: number;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<RawDrink>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Sheet open={Boolean(drink)} onClose={onClose} label="Drank aanpassen">
      {drink && <EditForm key={drink.id} drink={drink} rank={rank} onClose={onClose} onUpdate={onUpdate} onRemove={onRemove} />}
    </Sheet>
  );
}

function EditForm({
  drink,
  rank,
  onClose,
  onUpdate,
  onRemove,
}: {
  drink: Drink;
  rank: number;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<RawDrink>) => void;
  onRemove: (id: string) => void;
}) {
  const [name, setName] = useState(drink.name);
  const [price, setPrice] = useState(show(drink.priceEur));
  const [cl, setCl] = useState(show(drink.volumeMl / 10, 1));
  const [abv, setAbv] = useState(show(drink.abv, 1));
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Keep inputs in sync if the drink changes elsewhere (e.g. merged from another photo).
  useEffect(() => setName(drink.name), [drink.name]);

  const m = metrics(drink, useProfile());
  const update = (patch: Partial<RawDrink>) => onUpdate(drink.id, patch);

  const commitPrice = (s: string) => {
    setPrice(s);
    const v = toNum(s);
    if (Number.isFinite(v) && v > 0 && v <= 2000) update({ priceEur: Math.round(v * 100) / 100 });
  };
  const commitCl = (s: string) => {
    setCl(s);
    const v = toNum(s);
    if (Number.isFinite(v) && v >= 0.5 && v <= 2000) update({ volumeMl: Math.round(v * 10) });
  };
  const commitAbv = (s: string) => {
    setAbv(s);
    const v = toNum(s);
    if (Number.isFinite(v) && v >= 0.5 && v <= 96) update({ abv: Math.round(v * 10) / 10 });
  };

  return (
    <div className="sheet-body edit">
      <div className="edit-head">
        <span className="edit-rank">#{rank}</span>
        <span className="edit-cat">
          {CATEGORY_META[drink.category].icon} {CATEGORY_META[drink.category].label}
        </span>
      </div>
      <input
        className="edit-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name.trim() !== drink.name && update({ name: name.trim().slice(0, 80) })}
        aria-label="Naam"
      />
      {drink.printed && (
        <p className="edit-printed">
          <span>Op de kaart</span> {drink.printed}
        </p>
      )}
      {drink.note && <p className="edit-note">{drink.note}</p>}

      <div className="edit-live">
        <div>
          <AnimatedNumber className="edit-big" value={m.eurPerPromille} format={fmt.eur} />
          <span className="edit-lbl">per promille</span>
        </div>
        <div>
          <AnimatedPromille className="edit-big alt" value={m.promille} />
          <span className="edit-lbl">promille erbij</span>
        </div>
      </div>

      <div className="field">
        <label htmlFor="f-price">Prijs</label>
        <div className="input-wrap">
          <span className="affix">€</span>
          <input id="f-price" inputMode="decimal" value={price} onChange={(e) => commitPrice(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="f-cl">
          Volume {drink.volumeSource === "estimated" && <em className="est-tag">≈ geschat</em>}
        </label>
        <div className="input-wrap">
          <input id="f-cl" inputMode="decimal" value={cl} onChange={(e) => commitCl(e.target.value)} />
          <span className="affix">cl</span>
        </div>
        <div className="presets">
          {VOLUME_PRESETS.map((p) => (
            <button
              key={p}
              className={`preset ${Math.round(drink.volumeMl) === p * 10 ? "active" : ""}`}
              onClick={() => commitCl(String(p))}
            >
              {p} cl
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="f-abv">
          Alcohol {drink.abvSource === "estimated" && <em className="est-tag">≈ geschat</em>}
        </label>
        <div className="abv-row">
          <input
            type="range"
            min={0.5}
            max={60}
            step={0.1}
            value={Math.min(60, drink.abv)}
            onChange={(e) => commitAbv(e.target.value.replace(".", ","))}
            aria-label="Alcoholpercentage schuifregelaar"
            style={{ "--p": `${(Math.min(60, drink.abv) / 60) * 100}%` } as CSSProperties}
          />
          <div className="input-wrap small">
            <input id="f-abv" inputMode="decimal" value={abv} onChange={(e) => commitAbv(e.target.value)} />
            <span className="affix">%</span>
          </div>
        </div>
      </div>

      <div className="edit-actions">
        {confirmDelete ? (
          <button className="btn btn-danger" onClick={() => onRemove(drink.id)}>
            <Icon name="trash" size={18} /> Zeker verwijderen
          </button>
        ) : (
          <button className="btn btn-ghost" onClick={() => setConfirmDelete(true)}>
            <Icon name="trash" size={18} /> Verwijder
          </button>
        )}
        <button className="btn btn-primary" onClick={onClose}>
          <Icon name="check" size={18} /> Klaar
        </button>
      </div>
    </div>
  );
}
