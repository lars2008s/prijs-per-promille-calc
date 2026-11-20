// POST /api/hit  {"type":"pageview"|"scan","ref":"<document.referrer>"}
import { recordHit } from "../../shared/analytics-core.ts";
import { blobKV, DEFAULT_HOSTS } from "../lib/blob-kv.ts";

interface Ctx {
  ip?: string;
  geo?: { country?: { code?: string } };
}

export default (req: Request, context: Ctx) =>
  recordHit(req, {
    store: blobKV(),
    secret: process.env.ANALYTICS_SALT,
    ip: context?.ip,
    country: context?.geo?.country?.code,
    allowedHosts: process.env.ALLOWED_HOSTS ? process.env.ALLOWED_HOSTS.split(",") : DEFAULT_HOSTS,
  });

export const config = { path: "/api/hit", method: "POST" };
