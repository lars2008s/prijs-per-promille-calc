// Screenshots of the demo at key moments. Usage: node scripts/demo-shots.ts [baseUrl] [outDir]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:5179";
const out = process.argv[3] ?? "test-results/demo";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors: string[] = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
const shot = (name: string) => page.screenshot({ path: path.join(out, `${name}.png`) });

await page.goto(base);
await page.getByRole("button", { name: "Ja, ik ben 18+" }).click();
await page.waitForTimeout(1200);
await shot("00-home");
await page.getByRole("button", { name: /demo/i }).click();
const t0 = Date.now();
const at = async (s: number, name: string) => {
  const wait = t0 + s * 1000 - Date.now();
  if (wait > 0) await page.waitForTimeout(wait);
  const caption = await page.locator(".demo-caption span").last().textContent().catch(() => "");
  const top = await page.locator(".board .row .row-name").first().textContent().catch(() => "");
  const rows = await page.locator(".board .row").count();
  console.log(`${s}s  rows=${rows}  #1=${top}  caption=${caption}`);
  await shot(name);
};
await at(1.2, "01-start");
const tabs = await page.evaluate(() => {
  const el = document.querySelector(".tabs")!;
  return { scroll: el.scrollWidth, client: el.clientWidth };
});
console.log("tabs", tabs);
await at(5, "02-reading");
await at(9.5, "03-beers");
await at(19, "04-winner");
await page.waitForSelector(".demo-finger", { state: "attached", timeout: 15000 });
await page.waitForTimeout(650);
await shot("04b-finger");
await at(23.2, "05-sort-cheap");
await at(26.5, "06-strong");
await at(33.5, "07-filter-wijn");
await at(41.8, "08-happy-hour");
await at(43.5, "09-after-happy-hour");
await at(47.3, "10-profile");
await at(52, "11-end");
console.log("errors:", errors.length ? errors : "none");
await browser.close();
