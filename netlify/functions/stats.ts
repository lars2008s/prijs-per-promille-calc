// GET /api/stats?days=30   Authorization: Bearer <STATS_TOKEN>
import { handleStats } from "../../shared/analytics-core.ts";
import { blobKV } from "../lib/blob-kv.ts";

export default (req: Request) => handleStats(req, { store: blobKV(), token: process.env.STATS_TOKEN });

export const config = { path: "/api/stats", method: "GET" };
