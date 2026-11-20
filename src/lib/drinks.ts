import { CATEGORIES } from "../../shared/categories.ts";

export type Category = (typeof CATEGORIES)[number];
export type Source = "menu" | "estimated";

export interface RawDrink {
  /** The menu line as printed, for checking what the AI read. */
  printed?: string;
  name: string;
  category: Category;
  serving: string;
  priceEur: number;
  volumeMl: number;
  abv: number;
  volumeSource: Source;
  abvSource: Source;
  note: string;
}

export interface Drink extends RawDrink {
  id: string;
  photoIds: string[];
  addedAt: number;
  edited: boolean;
}

export type SortKey = "deal" | "cheap" | "strong" | "most";

export const ETHANOL_DENSITY = 0.789;
export const MIN_ABV = 0.5;

export type Sex = "man" | "vrouw";

/** Who the promille are calculated for. */
export interface Profile {
  sex: Sex;
  weightKg: number;
}

export const DEFAULT_PROFILE: Profile = { sex: "man", weightKg: 75 };
export const MIN_WEIGHT = 35;
export const MAX_WEIGHT = 200;

/** Widmark body-water factor r: the share of body weight alcohol spreads through. */
export const WIDMARK_R: Record<Sex, number> = { man: 0.7, vrouw: 0.6 };

/** Peak blood alcohol rise in ‰ from `grams` of alcohol (Widmark, nothing burned off yet). */
export function promilleFor(grams: number, p: Profile): number {
  return grams / (p.weightKg * WIDMARK_R[p.sex]);
}

export function sanitizeProfile(input: unknown): Profile | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const sex = o.sex === "man" || o.sex === "vrouw" ? o.sex : null;
  const w = Number(o.weightKg);
  if (!sex || !Number.isFinite(w)) return null;
  return { sex, weightKg: Math.round(Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, w))) };
}

export const CATEGORY_META: Record<Category, { label: string; icon: string }> = {
  bier: { label: "Bier", icon: "🍺" },
  wijn: { label: "Wijn", icon: "🍷" },
  bubbels: { label: "Bubbels", icon: "🥂" },
  cocktail: { label: "Cocktail", icon: "🍸" },
  longdrink: { label: "Longdrink", icon: "🍹" },
  sterk: { label: "Sterk", icon: "🥃" },
  shot: { label: "Shot", icon: "⚡" },
  cider: { label: "Cider", icon: "🍏" },
  aperitief: { label: "Aperitief", icon: "🍊" },
  overig: { label: "Overig", icon: "🍶" },
};

export interface DrinkMetrics {
  pureMl: number;
  grams: number;
  /** How much this drink raises your blood alcohol, in ‰. */
  promille: number;
  /** Price to raise your blood alcohol by 1 ‰. Lower is better. */
  eurPerPromille: number;
}

/**
 * The ranking order never depends on the profile (weight and sex scale every
 * drink equally); only the numbers shown do.
 */
export function metrics(d: Pick<RawDrink, "volumeMl" | "abv" | "priceEur">, profile = DEFAULT_PROFILE): DrinkMetrics {
  const pureMl = (d.volumeMl * d.abv) / 100;
  const grams = pureMl * ETHANOL_DENSITY;
  const promille = promilleFor(grams, profile);
  return {
    pureMl,
    grams,
    promille,
    eurPerPromille: promille > 0 ? d.priceEur / promille : Infinity,
  };
}

export function isRankable(d: RawDrink): boolean {
  return d.priceEur > 0 && d.volumeMl > 0 && d.abv >= MIN_ABV;
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v.replace(",", ".").replace(/[^0-9.]/g, ""));
  return NaN;
}

/** Alcohol-free markers that sometimes slip through the model ("Jupiler 0,0%"). */
const ALCOHOL_FREE = new RegExp(
  [
    String.raw`(^|[^\d.,])0(?:[.,]0+)?\s*(?:%|°|vol)`, // 0% · 0,0% · 0.0 vol (not 8,0% or 10%)
    String.raw`(^|[^\d.,])0[.,]0(?!\d)`, // "Jupiler 0.0" (not prices like 3,00 or 10,00)
    String.raw`alcohol\s*-?\s*(?:vrij|free)`,
    String.raw`alkoholfrei|sans\s+alcool|\bmocktail\b|\bzero\b`,
  ].join("|"),
  "i",
);

export function looksAlcoholFree(text: string): boolean {
  return ALCOHOL_FREE.test(text);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number, step: number) => Math.round(v / step) * step;

/** Validates one drink coming from the model. Returns null for unusable entries. */
export function sanitizeRaw(input: unknown): RawDrink | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim().slice(0, 80) : "";
  const priceEur = num(o.priceEur);
  const volumeMl = num(o.volumeMl);
  const abv = num(o.abv);
  if (!name || !Number.isFinite(priceEur) || !Number.isFinite(volumeMl) || !Number.isFinite(abv)) return null;
  if (priceEur <= 0 || priceEur > 2000 || volumeMl <= 0 || abv < MIN_ABV) return null;
  const printed = typeof o.printed === "string" ? o.printed.trim().slice(0, 120) : "";
  if (looksAlcoholFree(`${printed} ${name}`)) return null;
  const category = (CATEGORIES as readonly string[]).includes(o.category as string) ? (o.category as Category) : "overig";
  const src = (v: unknown): Source => (v === "menu" ? "menu" : "estimated");
  return {
    ...(printed ? { printed } : {}),
    name,
    category,
    serving: typeof o.serving === "string" ? o.serving.trim().slice(0, 40) : "",
    priceEur: round(clamp(priceEur, 0.01, 2000), 0.01),
    volumeMl: Math.round(clamp(volumeMl, 5, 20000)),
    abv: round(clamp(abv, MIN_ABV, 96), 0.1),
    volumeSource: src(o.volumeSource),
    abvSource: src(o.abvSource),
    note: typeof o.note === "string" ? o.note.trim().slice(0, 60) : "",
  };
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function dedupeKey(d: Pick<RawDrink, "name" | "volumeMl" | "priceEur">): string {
  return `${normalizeName(d.name)}|${Math.round(d.volumeMl / 10)}|${d.priceEur.toFixed(2)}`;
}

let counter = 0;
export function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  counter += 1;
  return `d${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Adds drinks found on a photo. The same drink seen on two overlapping photos
 * (same name, size and price) is kept once.
 */
export function mergeDrinks(existing: Drink[], incoming: RawDrink[], photoId: string, now = Date.now()): Drink[] {
  if (incoming.length === 0) return existing;
  const out = existing.slice();
  const index = new Map(out.map((d, i) => [dedupeKey(d), i]));
  incoming.forEach((raw, n) => {
    const key = dedupeKey(raw);
    const at = index.get(key);
    if (at !== undefined) {
      const d = out[at];
      if (!d.photoIds.includes(photoId)) out[at] = { ...d, photoIds: [...d.photoIds, photoId] };
      return;
    }
    index.set(key, out.length);
    out.push({ ...raw, id: newId(), photoIds: [photoId], addedAt: now + n, edited: false });
  });
  return out;
}

export function sortValue(d: RawDrink, key: SortKey): number {
  const m = metrics(d);
  switch (key) {
    case "deal":
      return m.eurPerPromille;
    case "cheap":
      return d.priceEur;
    case "strong":
      return -d.abv;
    case "most":
      return -m.promille;
  }
}

export function sortDrinks<T extends Drink>(list: T[], key: SortKey): T[] {
  return list
    .filter(isRankable)
    .slice()
    .sort((a, b) => {
      const diff = sortValue(a, key) - sortValue(b, key);
      if (Math.abs(diff) > 1e-9) return diff;
      const deal = metrics(a).eurPerPromille - metrics(b).eurPerPromille;
      if (Math.abs(deal) > 1e-9) return deal;
      return a.addedAt - b.addedAt;
    });
}

/** 0..1 score relative to the best drink for the active sort. */
export function relativeScore(d: RawDrink, best: RawDrink, key: SortKey): number {
  const md = metrics(d);
  const mb = metrics(best);
  let s: number;
  switch (key) {
    case "deal":
      s = mb.eurPerPromille / md.eurPerPromille;
      break;
    case "cheap":
      s = best.priceEur / d.priceEur;
      break;
    case "strong":
      s = d.abv / best.abv;
      break;
    case "most":
      s = md.promille / mb.promille;
      break;
  }
  return Number.isFinite(s) ? clamp(s, 0.02, 1) : 0.02;
}

/** Rank movement: positive = moved up. */
export function rankDeltas(prev: Map<string, number>, next: string[]): Map<string, number | "new"> {
  const out = new Map<string, number | "new">();
  next.forEach((id, i) => {
    const before = prev.get(id);
    if (before === undefined) out.set(id, "new");
    else if (before !== i) out.set(id, before - i);
  });
  return out;
}

const eur = new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" });
const dec1 = new Intl.NumberFormat("nl-BE", { maximumFractionDigits: 1 });
const dec2 = new Intl.NumberFormat("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmt = {
  eur: (v: number) => (Number.isFinite(v) ? eur.format(v) : "–"),
  /** Compact euro without the space, for tight columns: €2,80 */
  eurTight: (v: number) => (Number.isFinite(v) ? eur.format(v).replace(/\s/g, "") : "–"),
  pct: (v: number) => `${dec1.format(v)}%`,
  /** Two decimals: 0,19 */
  num2: (v: number) => (Number.isFinite(v) ? dec2.format(v) : "–"),
  /** Blood alcohol as plain text: 0,19‰ */
  promille: (v: number) => (Number.isFinite(v) ? `${dec2.format(v)}‰` : "–"),
  kg: (v: number) => `${Math.round(v)} kg`,
  volume: (ml: number) => {
    if (ml >= 1000) return `${dec1.format(ml / 1000)} L`;
    if (ml % 10 === 0) return `${ml / 10} cl`;
    return `${dec1.format(ml / 10)} cl`;
  },
};
