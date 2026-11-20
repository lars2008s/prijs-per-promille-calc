import { afterEach, describe, expect, it, vi } from "vitest";
import { buildOpenAIRequest, handleScanRequest, hostAllowed } from "../shared/scan-core.ts";

const IMG = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://ppp.larsschrijvers.be/api/scan", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://ppp.larsschrijvers.be", ...headers },
    body: JSON.stringify(body),
  });
const env = { apiKey: "sk-test", allowedHosts: ["ppp.larsschrijvers.be", "*--prijs-per-promille.netlify.app"] };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("hostAllowed", () => {
  it("matches exact hosts and wildcard suffixes", () => {
    const r = (origin: string) => new Request("https://x/", { headers: { origin } });
    expect(hostAllowed(r("https://ppp.larsschrijvers.be"), env.allowedHosts)).toBe(true);
    expect(hostAllowed(r("https://deploy-preview-3--prijs-per-promille.netlify.app"), env.allowedHosts)).toBe(true);
    expect(hostAllowed(r("https://evil.example"), env.allowedHosts)).toBe(false);
    expect(hostAllowed(new Request("https://x/"), env.allowedHosts)).toBe(false);
  });
});

describe("handleScanRequest", () => {
  it("rejects bad input before calling OpenAI", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    expect((await handleScanRequest(new Request("https://x/", { method: "GET" }), env)).status).toBe(405);
    expect((await handleScanRequest(post({ image: "http://example.com/a.jpg" }), env)).status).toBe(400);
    expect((await handleScanRequest(post({ image: IMG }, { origin: "https://evil.example" }), env)).status).toBe(403);
    expect((await handleScanRequest(post({ image: IMG }), { ...env, apiKey: undefined })).status).toBe(500);
    expect(spy).not.toHaveBeenCalled();
  });

  it("streams the upstream body through and never leaks the key", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response('data: {"type":"response.completed"}\n\n', { status: 200, headers: { "content-type": "text/event-stream" } }),
      );
    const res = await handleScanRequest(post({ image: IMG }), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(await res.text()).toContain("response.completed");
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ authorization: "Bearer sk-test" });
    const sent = JSON.parse(init.body as string);
    expect(sent.stream).toBe(true);
    expect(sent.store).toBe(false);
    expect(sent.text.format.strict).toBe(true);
  });

  it("maps upstream rate limits to a friendly 429", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: { code: "rate_limit" } }), { status: 429 }));
    const res = await handleScanRequest(post({ image: IMG }), env);
    expect(res.status).toBe(429);
    expect(JSON.stringify(await res.json())).not.toContain("sk-test");
  });
});

describe("buildOpenAIRequest", () => {
  it("only sends reasoning settings to reasoning models", () => {
    expect(buildOpenAIRequest(IMG).reasoning).toEqual({ effort: "low" });
    expect(buildOpenAIRequest(IMG, { model: "gpt-5.4-mini", reasoningEffort: "none" }).reasoning).toEqual({ effort: "none" });
    expect(buildOpenAIRequest(IMG, { model: "gpt-4.1-mini" }).reasoning).toBeUndefined();
  });
});
