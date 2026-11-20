// POST /api/scan  { image: "data:image/jpeg;base64,..." }
// Streams the OpenAI Responses API (SSE) back to the browser. The API key never leaves the server.
import { handleScanRequest } from "../../shared/scan-core.ts";

declare const Netlify: { env: { get(name: string): string | undefined } };

const DEFAULT_HOSTS = [
  "ppp.larsschrijvers.be",
  "prijs-per-promille.netlify.app",
  "*--prijs-per-promille.netlify.app",
  "localhost",
  "127.0.0.1",
];

// Best-effort limit per IP inside this edge isolate. Netlify's own rateLimit rule
// (config below) only applies on paid plans; this keeps simple abuse loops in check.
const WINDOW_MS = 60_000;
const PER_IP = 20;
const hits = new Map<string, { n: number; reset: number }>();

function limited(ip: string): boolean {
  const now = Date.now();
  if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { n: 1, reset: now + WINDOW_MS });
    return false;
  }
  h.n++;
  return h.n > PER_IP;
}

export default (req: Request, context: { ip?: string }) => {
  const ip = context?.ip ?? req.headers.get("x-nf-client-connection-ip") ?? "unknown";
  if (req.method === "POST" && limited(ip)) {
    return new Response(JSON.stringify({ error: "Rustig aan, even te veel scans. Probeer het over een minuutje opnieuw." }), {
      status: 429,
      headers: { "content-type": "application/json; charset=utf-8", "retry-after": "60" },
    });
  }
  const hosts = Netlify.env.get("ALLOWED_HOSTS");
  return handleScanRequest(req, {
    apiKey: Netlify.env.get("OPENAI_API_KEY"),
    model: Netlify.env.get("OPENAI_MODEL"),
    reasoningEffort: Netlify.env.get("OPENAI_REASONING_EFFORT"),
    allowedHosts: hosts ? hosts.split(",") : DEFAULT_HOSTS,
  });
};

export const config = {
  path: "/api/scan",
  method: "POST",
  rateLimit: {
    windowLimit: 30,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};
