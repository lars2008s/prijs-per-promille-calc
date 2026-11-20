import { DrinkStreamParser, readSSE } from "./stream.ts";
import { sanitizeRaw, type RawDrink } from "./drinks.ts";

/** Empty on the web (same origin). A future native app can point this at https://ppp.larsschrijvers.be */
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

export class ScanError extends Error {
  retryable: boolean;
  constructor(message: string, retryable = true) {
    super(message);
    this.retryable = retryable;
  }
}

export interface ScanResult {
  drinks: RawDrink[];
  warning: string;
}

interface ScanOptions {
  onDrink?: (drink: RawDrink) => void;
  signal?: AbortSignal;
}

export async function scanPhoto(imageDataUrl: string, opts: ScanOptions = {}): Promise<ScanResult> {
  try {
    return await scanOnce(imageDataUrl, opts);
  } catch (err) {
    if (opts.signal?.aborted || !(err instanceof ScanError) || !err.retryable) throw err;
    // Only retry when nothing was streamed yet, otherwise drinks would be shown twice.
    if ((err as ScanError & { streamed?: number }).streamed) throw err;
    await new Promise((r) => setTimeout(r, 1500));
    return scanOnce(imageDataUrl, opts);
  }
}

async function scanOnce(imageDataUrl: string, { onDrink, signal }: ScanOptions): Promise<ScanResult> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/scan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image: imageDataUrl }),
      signal,
    });
  } catch {
    throw new ScanError("Geen verbinding. Check je internet en probeer opnieuw.");
  }

  if (!res.ok || !res.body) {
    let msg = "Er ging iets mis bij het lezen van de kaart.";
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      if (res.status === 429) msg = "Rustig aan, even te veel scans. Probeer zo opnieuw.";
    }
    throw new ScanError(msg, res.status === 429 || res.status >= 500);
  }

  const parser = new DrinkStreamParser();
  const emitted: RawDrink[] = [];
  const emit = (raw: unknown) => {
    const d = sanitizeRaw(raw);
    if (!d) return;
    emitted.push(d);
    onDrink?.(d);
  };
  let streamedObjects = 0;
  let finished = false;
  let incomplete = false;

  const fail = (msg: string, retryable = true) => {
    const e = new ScanError(msg, retryable) as ScanError & { streamed?: number };
    e.streamed = streamedObjects;
    return e;
  };

  try {
    for await (const ev of readSSE(res.body)) {
      if (ev.type === "response.output_text.delta" && typeof ev.delta === "string") {
        for (const obj of parser.push(ev.delta)) {
          streamedObjects++;
          emit(obj);
        }
      } else if (ev.type === "response.completed") {
        finished = true;
      } else if (ev.type === "response.incomplete") {
        finished = true;
        incomplete = true;
      } else if (ev.type === "response.failed" || ev.type === "error") {
        throw fail("De AI kon deze foto niet lezen. Probeer een scherpere foto.");
      } else if (ev.type === "response.refusal.delta") {
        throw fail("De AI weigerde deze foto te verwerken.", false);
      }
    }
  } catch (err) {
    if (err instanceof ScanError) throw err;
    if (signal?.aborted) throw err;
    throw fail("Verbinding verbroken tijdens het lezen.");
  }

  if (!finished && streamedObjects === 0) throw fail("Geen antwoord gekregen. Probeer opnieuw.");

  let warning = "";
  try {
    const full = JSON.parse(parser.fullText) as { drinks?: unknown[]; warning?: unknown };
    // Anything the incremental parser missed (should not happen) is added now.
    for (const raw of (full.drinks ?? []).slice(streamedObjects)) emit(raw);
    if (typeof full.warning === "string") warning = full.warning;
  } catch {
    if (emitted.length === 0) throw fail("Het antwoord van de AI was onvolledig. Probeer opnieuw.");
  }
  if (incomplete && !warning) warning = "De kaart was erg lang; mogelijk ontbreken enkele dranken.";
  return { drinks: emitted, warning };
}
