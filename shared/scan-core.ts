// Shared between the Netlify Edge Function (Deno) and local Node scripts.
// Only web-standard APIs (fetch, Request, Response) are used here.
import { CATEGORIES } from "./categories.ts";

// gpt-6-luna with a little reasoning: ~$0.001 per photo and robust on tilted/blurry menus (benchmarked 2026-11-20).
export const DEFAULT_MODEL = "gpt-6-luna";
export const DEFAULT_REASONING_EFFORT = "low";

export { CATEGORIES };

export const MENU_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["drinks", "warning"],
  properties: {
    drinks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "printed",
          "name",
          "category",
          "serving",
          "priceEur",
          "volumeMl",
          "abv",
          "volumeSource",
          "abvSource",
          "note",
        ],
        properties: {
          printed: { type: "string" },
          name: { type: "string" },
          category: { type: "string", enum: [...CATEGORIES] },
          serving: { type: "string" },
          priceEur: { type: "number" },
          volumeMl: { type: "number" },
          abv: { type: "number" },
          volumeSource: { type: "string", enum: ["menu", "estimated"] },
          abvSource: { type: "string", enum: ["menu", "estimated"] },
          note: { type: "string" },
        },
      },
    },
    warning: { type: "string" },
  },
} as const;

export const INSTRUCTIONS = `You read photos of drink menus from cafés, bars and restaurants, mostly in Belgium and the Netherlands.
Extract every ALCOHOLIC drink that has a readable price. Output JSON that matches the schema.

Rules:
- printed: copy the menu line for this offer exactly as printed (name, size, percentage, price), e.g. "Jupiler 0,0% ..... 3,00". Fill this first and base every other field on it.
- One entry per distinct offer: if a drink is listed in several sizes or prices (25cl / 33cl / 50cl, glass / bottle, pitcher), output one entry per size.
- Skip drinks without alcohol completely: soft drinks, water, juice, coffee, tea, mocktails, and alcohol-free beers or wines. Anything marked "0,0%", "0.0", "0%", "alcoholvrij", "NA" or "zero" next to a beer/wine name is alcohol-free: skip it, even if the brand normally has alcohol. Skip food.
- Skip items whose price you cannot read. Never invent prices.
- name: the drink as written on the menu, short, keep the brand ("Duvel", "Huiswijn rood", "Gin Tonic Bombay"). Leave cl/L sizes out of the name, but keep format words such as "Pitcher", "Fles", "Karaf" or "Shot" ("Pitcher Jupiler").
- serving: short Dutch description of the serving, e.g. "25cl van 't vat", "33cl fles", "glas", "fles 75cl", "pitcher 1,5L", "shot".
- priceEur: price as a number in euro ("4,50" -> 4.5). If prices are in another currency, still give the number and mention the currency in warning.
- volumeMl: total serving volume in ml. Use the menu when it is printed (cl x 10, L x 1000). Otherwise estimate the usual Belgian serving: draught pils 250, Belgian specialty bottle 330, glass of wine 150, glass of cava/champagne/prosecco 125, bottle of wine 750, spirits/whisky/rum/vodka neat 40, jenever 35, shot 30, aperitif (Martini, Porto, Campari) 60-80, long drink or cocktail: total glass volume including mixer (typically 250-300).
- abv: alcohol percentage of the WHOLE serving as served. Use the menu when printed ("8,5%", "8.5% vol", "30°"). Otherwise use the known value of that exact product (Jupiler 5.2, Stella Artois 5.2, Duvel 8.5, Westmalle Tripel 9.5, Kasteel Donker 11, etc.), else a typical value for the category. For long drinks and cocktails compute the effective percentage of the full glass from the usual spirit dose (e.g. 4-5cl gin at 37.5-40% plus mixer) and mention the dose in note.
- volumeSource / abvSource: "menu" only when that value is printed on the photo, otherwise "estimated".
- category: pick the closest value.
- note: very short Dutch remark when useful (e.g. "≈ 5cl gin + tonic", "prijs per fles"), otherwise "".
- warning: "" normally. If the photo is not a drink menu, is unreadable, or partly cut off, write one short Dutch sentence explaining it.
- Read carefully: decimal commas, prices in a separate column aligned with the drink, section headers that imply the size (e.g. "Van 't vat 25cl").`;

export interface ScanRequestOptions {
  model?: string;
  detail?: "low" | "high" | "auto" | "original";
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max" | null;
  stream?: boolean;
}

export function supportsReasoning(model: string): boolean {
  return /^(gpt-5|gpt-6|o\d)/.test(model);
}

export function buildOpenAIRequest(imageDataUrl: string, opts: ScanRequestOptions = {}) {
  const model = opts.model ?? DEFAULT_MODEL;
  const body: Record<string, unknown> = {
    model,
    instructions: INSTRUCTIONS,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: "Lees deze drankkaart en geef alle alcoholische dranken met prijs." },
          { type: "input_image", image_url: imageDataUrl, detail: opts.detail ?? "high" },
        ],
      },
    ],
    text: {
      format: { type: "json_schema", name: "drink_menu", strict: true, schema: MENU_SCHEMA },
    },
    max_output_tokens: 16000,
    store: false,
    stream: opts.stream ?? true,
  };
  const effort = opts.reasoningEffort === undefined ? DEFAULT_REASONING_EFFORT : opts.reasoningEffort;
  if (effort && supportsReasoning(model)) body.reasoning = { effort };
  return body;
}

// ---------------------------------------------------------------------------
// HTTP handler used by the edge function.

export interface ScanEnv {
  apiKey: string | undefined;
  model?: string;
  reasoningEffort?: string;
  /** Hostnames allowed in Origin/Referer. Empty = allow all. */
  allowedHosts?: string[];
}

const MAX_BODY_BYTES = 6 * 1024 * 1024;
const DATA_URL_RE = /^data:image\/(jpeg|jpg|png|webp|heic|heif);base64,[A-Za-z0-9+/=]+$/;

function json(status: number, data: unknown, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });
}

export function hostAllowed(req: Request, allowedHosts: string[] | undefined): boolean {
  if (!allowedHosts || allowedHosts.length === 0) return true;
  const source = req.headers.get("origin") ?? req.headers.get("referer");
  if (!source) return false;
  let host: string;
  try {
    host = new URL(source).hostname.toLowerCase();
  } catch {
    return false;
  }
  return allowedHosts.some((rule) => {
    const r = rule.trim().toLowerCase();
    if (!r) return false;
    if (r.startsWith("*")) return host.endsWith(r.slice(1));
    return host === r;
  });
}

export async function handleScanRequest(req: Request, env: ScanEnv): Promise<Response> {
  if (req.method !== "POST") return json(405, { error: "Alleen POST is toegestaan." }, { allow: "POST" });
  if (!env.apiKey) return json(500, { error: "De server mist een OpenAI-sleutel." });
  if (!hostAllowed(req, env.allowedHosts)) return json(403, { error: "Deze bron mag de scanner niet gebruiken." });

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return json(413, { error: "Foto is te groot." });

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return json(400, { error: "Kon de foto niet lezen." });
  }
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: "Foto is te groot." });

  let image: unknown;
  try {
    image = (JSON.parse(raw) as { image?: unknown }).image;
  } catch {
    return json(400, { error: "Ongeldige aanvraag." });
  }
  if (typeof image !== "string" || !DATA_URL_RE.test(image)) {
    return json(400, { error: "Stuur een foto als JPEG, PNG of WebP." });
  }

  const effort = (env.reasoningEffort || DEFAULT_REASONING_EFFORT) as ScanRequestOptions["reasoningEffort"];
  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${env.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(buildOpenAIRequest(image, { model: env.model || DEFAULT_MODEL, reasoningEffort: effort })),
  }).catch(() => null);

  if (!upstream) return json(502, { error: "OpenAI is niet bereikbaar. Probeer opnieuw." });
  if (!upstream.ok || !upstream.body) {
    let detail = "";
    try {
      const err = (await upstream.json()) as { error?: { message?: string; code?: string } };
      detail = err.error?.code ?? "";
    } catch {
      /* ignore */
    }
    const status = upstream.status === 429 ? 429 : 502;
    const msg =
      upstream.status === 429
        ? "Even te druk bij OpenAI. Wacht een paar seconden en probeer opnieuw."
        : "De AI kon deze foto niet verwerken.";
    return json(status, { error: msg, code: detail || String(upstream.status) });
  }

  // Pipe the SSE stream straight through: no buffering, minimal CPU.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
