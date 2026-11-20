import { describe, expect, it } from "vitest";
import {
  cleanRef,
  computeStats,
  dayKey,
  deviceOf,
  handleStats,
  isBot,
  lastDays,
  memoryKV,
  parseKey,
  recordHit,
} from "../shared/analytics-core.ts";

const HOSTS = ["ppp.larsschrijvers.be", "*--prijs-per-promille.netlify.app"];
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36";

const hit = (body: unknown, ua = IPHONE, origin = "https://ppp.larsschrijvers.be") =>
  new Request("https://ppp.larsschrijvers.be/api/hit", {
    method: "POST",
    headers: { "content-type": "text/plain", origin, "user-agent": ua },
    body: JSON.stringify(body),
  });

describe("helpers", () => {
  it("uses Belgian calendar days, also around midnight and DST", () => {
    expect(dayKey(new Date("2026-11-19T23:30:00Z"))).toBe("2026-11-20"); // 00:30 in Brussels
    expect(lastDays(3, new Date("2026-03-29T10:00:00Z"))).toEqual(["2026-03-27", "2026-03-28", "2026-03-29"]);
  });
  it("detects bots and devices", () => {
    expect(isBot("Mozilla/5.0 HeadlessChrome/141")).toBe(true);
    expect(isBot("curl/8.4")).toBe(true);
    expect(isBot("")).toBe(true);
    expect(isBot(IPHONE)).toBe(false);
    expect(deviceOf(IPHONE)).toBe("mobiel");
    expect(deviceOf(DESKTOP)).toBe("desktop");
    expect(deviceOf("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)")).toBe("tablet");
  });
  it("reduces referrers to a host and hides our own site", () => {
    expect(cleanRef("https://www.instagram.com/p/abc?x=1", HOSTS)).toBe("instagram.com");
    expect(cleanRef("https://ppp.larsschrijvers.be/", HOSTS)).toBe("-");
    expect(cleanRef("", HOSTS)).toBe("-");
    expect(cleanRef("not a url", HOSTS)).toBe("-");
  });
});

describe("recordHit + computeStats", () => {
  it("counts visitors once per day, pageviews and scans separately", async () => {
    const store = memoryKV();
    const env = (ip: string, now: string) => ({ store, secret: "s3cret", ip, country: "BE", allowedHosts: HOSTS, now: new Date(now) });

    // Day 1: two people, one of them reloads and scans twice.
    expect((await recordHit(hit({ type: "pageview", ref: "https://instagram.com/x" }), env("1.1.1.1", "2026-11-18T10:00:00Z"))).status).toBe(204);
    await recordHit(hit({ type: "pageview" }), env("1.1.1.1", "2026-11-18T10:05:00Z"));
    await recordHit(hit({ type: "scan" }), env("1.1.1.1", "2026-11-18T10:06:00Z"));
    await recordHit(hit({ type: "scan" }), env("1.1.1.1", "2026-11-18T10:07:00Z"));
    await recordHit(hit({ type: "pageview" }, DESKTOP), env("2.2.2.2", "2026-11-18T12:00:00Z"));
    // Day 2: the first person returns.
    await recordHit(hit({ type: "pageview" }), env("1.1.1.1", "2026-11-19T09:00:00Z"));
    // Not counted: bot, foreign origin, junk type.
    expect((await recordHit(hit({ type: "pageview" }, "Googlebot/2.1"), env("3.3.3.3", "2026-11-19T09:00:00Z"))).status).toBe(204);
    expect((await recordHit(hit({ type: "pageview" }, IPHONE, "https://evil.example"), env("3.3.3.3", "2026-11-19T09:00:00Z"))).status).toBe(403);
    expect((await recordHit(hit({ type: "hack" }), env("3.3.3.3", "2026-11-19T09:00:00Z"))).status).toBe(400);

    expect(store.keys.size).toBe(6);
    for (const k of store.keys) {
      expect(parseKey(k)).not.toBeNull();
      expect(k).not.toContain("1.1.1.1");
    }

    const s = await computeStats(store, 3, new Date("2026-11-19T15:00:00Z"));
    expect(s.days.map((d) => d.day)).toEqual(["2026-11-17", "2026-11-18", "2026-11-19"]);
    expect(s.days[1]).toMatchObject({ pageviews: 3, visitors: 2, scans: 2, scanners: 1 });
    expect(s.days[2]).toMatchObject({ pageviews: 1, visitors: 1, scans: 0 });
    expect(s.totals).toEqual({ pageviews: 4, visitors: 3, scans: 2, scanners: 1 });
    expect(s.referrers).toEqual([
      ["Direct", 2],
      ["instagram.com", 1],
    ]);
    expect(s.devices).toEqual([
      ["mobiel", 2],
      ["desktop", 1],
    ]);
    expect(s.countries).toEqual([["BE", 3]]);
  });

  it("protects the stats endpoint with the token", async () => {
    const store = memoryKV();
    const get = (auth?: string) =>
      new Request("https://x/api/stats?days=7", { headers: auth ? { authorization: auth } : {} });
    expect((await handleStats(get(), { store, token: "geheim" })).status).toBe(401);
    expect((await handleStats(get("Bearer fout"), { store, token: "geheim" })).status).toBe(401);
    const ok = await handleStats(get("Bearer geheim"), { store, token: "geheim" });
    expect(ok.status).toBe(200);
    expect((await ok.json()).days).toHaveLength(7);
  });
});
