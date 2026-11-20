import { sanitizeProfile, type Drink, type Profile } from "./drinks.ts";
import type { Photo } from "../state.ts";

const SESSION_KEY = "ppp:v1:session";
const AGE_KEY = "ppp:v1:age-ok";
const PROFILE_KEY = "ppp:v1:profile";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage full or blocked: the app still works, it just won't remember */
  }
}

export interface StoredSession {
  drinks: Drink[];
  photos: Photo[];
}

export function loadSession(): StoredSession {
  const raw = read(SESSION_KEY);
  if (!raw) return { drinks: [], photos: [] };
  try {
    const s = JSON.parse(raw) as Partial<StoredSession>;
    const photos = (Array.isArray(s.photos) ? s.photos : []).map((p) =>
      p.status === "done" || p.status === "error"
        ? { ...p, canRetry: false }
        : { ...p, status: "error" as const, error: "Onderbroken", canRetry: false },
    );
    return { drinks: Array.isArray(s.drinks) ? s.drinks : [], photos };
  } catch {
    return { drinks: [], photos: [] };
  }
}

export function saveSession(s: StoredSession) {
  if (s.drinks.length === 0 && s.photos.length === 0) write(SESSION_KEY, null);
  else write(SESSION_KEY, JSON.stringify(s));
}

export const ageGate = {
  ok: () => read(AGE_KEY) === "yes",
  confirm: () => write(AGE_KEY, "yes"),
};

/** Weight and sex for the promille calculation. Stays on this device. */
export const profileStore = {
  load(): Profile | null {
    try {
      return sanitizeProfile(JSON.parse(read(PROFILE_KEY) ?? "null"));
    } catch {
      return null;
    }
  },
  save: (p: Profile) => write(PROFILE_KEY, JSON.stringify(p)),
};
