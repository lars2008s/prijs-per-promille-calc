// Cookie-less visitor analytics on top of a tiny key/value store (Netlify Blobs in production).
// Every event is one empty blob whose key carries all the data, so stats are computed by
// listing keys only:  ev/<day>/<type>/<device>/<country>/<visitor>/<ref>/<ts><rand>
// <visitor> is a hash of IP + user agent + a secret that changes every day, so the same
// person is counted once per day and can't be followed across days or identified.
import { hostAllowed } from "./scan-core.ts";

export interface KV {
  set(key: string, value: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

export const EVENT_TYPES = ["pageview", "scan"] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export type Device = "mobiel" | "tablet" | "desktop";

export interface HitEvent {
  day: string;
  type: EventType;
  device: Device;
  country: string;
  visitor: string;
  ref: string;
  ts: number;
}

const TZ = "Europe/Brussels";
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** Calendar day in Belgium, e.g. "2026-11-19". */
export function dayKey(d: Date): string {
  return dayFmt.format(d);
}

/** The last `n` Belgian calendar days, oldest first, ending today. */
export function lastDays(n: number, now: Date): string[] {
  const [y, m, d] = dayKey(now).split("-").map(Number);
  const noon = Date.UTC(y, m - 1, d, 12);
  return Array.from({ length: n }, (_, i) => new Date(noon - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}

const BOT_RE =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|curl|wget|python|node-fetch|undici|axios|go-http|java\/|okhttp|postman|insomnia/i;

export function isBot(ua: string): boolean {
  return !ua || BOT_RE.test(ua);
}

export function deviceOf(ua: string): Device {
  if (/iPad|Tablet|Kindle|Silk|Android(?!.*Mobile)/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|iPod|Android/i.test(ua)) return "mobiel";
  return "desktop";
}

/** Referrer reduced to a bare host, "-" for direct visits or our own site. */
export function cleanRef(ref: unknown, ownHosts: string[]): string {
  if (typeof ref !== "string" || !ref) return "-";
  let host: string;
  try {
    host = new URL(ref).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "-";
  }
  if (!host || !/^[a-z0-9.-]{1,60}$/.test(host)) return "-";
  const own = ownHosts.some((h) => {
    const r = h.trim().toLowerCase();
    return r.startsWith("*") ? host.endsWith(r.slice(1)) : host === r;
  });
  return own ? "-" : host;
}

export function cleanCountry(code: unknown): string {
  return typeof code === "string" && /^[A-Za-z]{2}$/.test(code) ? code.toUpperCase() : "--";
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function visitorHash(secret: string, day: string, ip: string, ua: string): Promise<string> {
  return (await sha256Hex(`${secret}|${day}|${ip}|${ua}`)).slice(0, 16);
}

export function eventKey(e: HitEvent, rand: string): string {
  return `ev/${e.day}/${e.type}/${e.device}/${e.country}/${e.visitor}/${e.ref}/${e.ts}${rand}`;
}

export function parseKey(key: string): HitEvent | null {
  const p = key.split("/");
  if (p.length !== 8 || p[0] !== "ev") return null;
  const [, day, type, device, country, visitor, ref, tail] = p;
  if (!(EVENT_TYPES as readonly string[]).includes(type)) return null;
  return {
    day,
    type: type as EventType,
    device: device as Device,
    country,
    visitor,
    ref,
    ts: Number.parseInt(tail.slice(0, 13), 10) || 0,
  };
}

// ---------------------------------------------------------------------------
// POST /api/hit

export interface HitEnv {
  store: KV;
  secret: string | undefined;
  ip: string | undefined;
  country: string | undefined;
  allowedHosts: string[];
  now?: Date;
}

const WINDOW_MS = 60_000;
const PER_IP = 60;
const hitsByIp = new Map<string, { n: number; reset: number }>();

function tooMany(ip: string, now: number): boolean {
  if (hitsByIp.size > 5000) for (const [k, v] of hitsByIp) if (v.reset < now) hitsByIp.delete(k);
  const h = hitsByIp.get(ip);
  if (!h || h.reset < now) {
    hitsByIp.set(ip, { n: 1, reset: now + WINDOW_MS });
    return false;
  }
  return ++h.n > PER_IP;
}

const noContent = () => new Response(null, { status: 204, headers: { "cache-control": "no-store" } });

export async function recordHit(req: Request, env: HitEnv): Promise<Response> {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { allow: "POST" } });
  if (!env.secret) return new Response("Analytics not configured", { status: 500 });
  if (!hostAllowed(req, env.allowedHosts)) return new Response("Forbidden", { status: 403 });

  const ua = req.headers.get("user-agent") ?? "";
  if (isBot(ua)) return noContent();

  const now = env.now ?? new Date();
  const ip = env.ip ?? "0.0.0.0";
  if (tooMany(ip, now.getTime())) return new Response("Too many requests", { status: 429 });

  let body: { type?: unknown; ref?: unknown } = {};
  try {
    const text = await req.text();
    if (text.length > 2048) return new Response("Too large", { status: 413 });
    body = text ? JSON.parse(text) : {};
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const type = (EVENT_TYPES as readonly string[]).includes(body.type as string) ? (body.type as EventType) : null;
  if (!type) return new Response("Bad request", { status: 400 });

  const day = dayKey(now);
  const event: HitEvent = {
    day,
    type,
    device: deviceOf(ua),
    country: cleanCountry(env.country),
    visitor: await visitorHash(env.secret, day, ip, ua),
    ref: type === "pageview" ? cleanRef(body.ref, env.allowedHosts) : "-",
    ts: now.getTime(),
  };
  const rand = Math.random().toString(36).slice(2, 8);
  await env.store.set(eventKey(event, rand), "");
  return noContent();
}

// ---------------------------------------------------------------------------
// GET /api/stats

export interface DayStats {
  day: string;
  pageviews: number;
  visitors: number;
  scans: number;
  scanners: number;
}

export interface Stats {
  range: number;
  days: DayStats[];
  totals: { pageviews: number; visitors: number; scans: number; scanners: number };
  referrers: [string, number][];
  countries: [string, number][];
  devices: [string, number][];
  generatedAt: string;
}

function top(map: Map<string, number>, n = 8): [string, number][] {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);
}

export async function computeStats(store: KV, range: number, now = new Date()): Promise<Stats> {
  const days = lastDays(range, now);
  const perDay = await Promise.all(days.map((d) => store.list(`ev/${d}/`)));
  const refs = new Map<string, number>();
  const countries = new Map<string, number>();
  const devices = new Map<string, number>();
  const totals = { pageviews: 0, visitors: 0, scans: 0, scanners: 0 };

  const dayStats = days.map((day, i) => {
    const visitors = new Map<string, HitEvent>();
    const scanners = new Set<string>();
    let pageviews = 0;
    let scans = 0;
    for (const key of perDay[i]) {
      const e = parseKey(key);
      if (!e) continue;
      if (e.type === "pageview") {
        pageviews++;
        if (!visitors.has(e.visitor)) visitors.set(e.visitor, e);
        else if (e.ref !== "-" && visitors.get(e.visitor)!.ref === "-") visitors.set(e.visitor, e);
      } else {
        scans++;
        scanners.add(e.visitor);
      }
    }
    // Breakdowns count each visitor once per day.
    for (const e of visitors.values()) {
      refs.set(e.ref === "-" ? "Direct" : e.ref, (refs.get(e.ref === "-" ? "Direct" : e.ref) ?? 0) + 1);
      countries.set(e.country, (countries.get(e.country) ?? 0) + 1);
      devices.set(e.device, (devices.get(e.device) ?? 0) + 1);
    }
    const s = { day, pageviews, visitors: visitors.size, scans, scanners: scanners.size };
    totals.pageviews += s.pageviews;
    totals.visitors += s.visitors;
    totals.scans += s.scans;
    totals.scanners += s.scanners;
    return s;
  });

  return {
    range,
    days: dayStats,
    totals,
    referrers: top(refs),
    countries: top(countries),
    devices: top(devices, 3),
    generatedAt: now.toISOString(),
  };
}

async function safeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0;
}

export async function handleStats(req: Request, env: { store: KV; token: string | undefined; now?: Date }): Promise<Response> {
  const json = (status: number, data: unknown) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  if (req.method !== "GET") return json(405, { error: "Alleen GET." });
  if (!env.token) return json(500, { error: "STATS_TOKEN ontbreekt op de server." });
  const auth = req.headers.get("authorization") ?? "";
  const given = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!given || !(await safeEqual(given, env.token))) {
    await new Promise((r) => setTimeout(r, 400));
    return json(401, { error: "Verkeerd wachtwoord." });
  }
  const url = new URL(req.url);
  const range = Math.min(90, Math.max(1, Number.parseInt(url.searchParams.get("days") ?? "30", 10) || 30));
  return json(200, await computeStats(env.store, range, env.now));
}

/** In-memory store for local development and tests. */
export function memoryKV(): KV & { keys: Set<string> } {
  const keys = new Set<string>();
  return {
    keys,
    async set(key) {
      keys.add(key);
    },
    async list(prefix) {
      return [...keys].filter((k) => k.startsWith(prefix));
    },
  };
}
