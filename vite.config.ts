import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleScanRequest } from "./shared/scan-core.ts";
import { handleStats, memoryKV, recordHit } from "./shared/analytics-core.ts";

async function toRequest(req: IncomingMessage, path: string): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const headers = new Headers();
  for (const name of ["origin", "referer", "content-type", "user-agent", "authorization"]) {
    const v = req.headers[name];
    if (typeof v === "string") headers.set(name, v);
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(`http://localhost${path}${req.url ?? ""}`, {
    method: req.method,
    headers,
    body: hasBody ? Buffer.concat(chunks) : undefined,
  });
}

async function send(res: ServerResponse, response: Response) {
  res.statusCode = response.status;
  response.headers.forEach((v, k) => res.setHeader(k, v));
  if (response.body) for await (const chunk of response.body) res.write(chunk);
  res.end();
}

/** Local stand-ins for the Netlify functions, so `npm run dev` works without the Netlify CLI. */
function devApi(env: Record<string, string>): Plugin {
  const kv = memoryKV();
  return {
    name: "ppp-dev-api",
    configureServer(server) {
      server.middlewares.use("/api/scan", async (req, res) => {
        await send(
          res,
          await handleScanRequest(await toRequest(req, "/api/scan"), {
            apiKey: env.OPENAI_API_KEY,
            model: env.OPENAI_MODEL,
            reasoningEffort: env.OPENAI_REASONING_EFFORT,
          }),
        );
      });
      server.middlewares.use("/api/hit", async (req, res) => {
        await send(
          res,
          await recordHit(await toRequest(req, "/api/hit"), {
            store: kv,
            secret: env.ANALYTICS_SALT || "dev-salt",
            ip: req.socket.remoteAddress,
            country: "BE",
            allowedHosts: [],
          }),
        );
      });
      server.middlewares.use("/api/stats", async (req, res) => {
        await send(res, await handleStats(await toRequest(req, "/api/stats"), { store: kv, token: env.STATS_TOKEN || "dev" }));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), devApi(env)],
    server: { host: true },
    build: {
      target: "es2022",
      sourcemap: false,
      rollupOptions: { input: { main: "index.html", stats: "stats.html" } },
    },
  };
});
