// End-to-end smoke test against a running dev server or deployed site.
// Usage: node scripts/e2e.ts [baseUrl] [outDir]
import { chromium, type Page } from "playwright-core";
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:5199";
const out = process.argv[3] ?? "test-results";
mkdirSync(out, { recursive: true });
const chrome = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const fixtures = path.resolve("tests/fixtures");
const fakeCam = path.join(out, "fake-cam.mjpeg");
copyFileSync(path.join(fixtures, "menu-page2.jpg"), fakeCam);

const browser = await chromium.launch({
  executablePath: chrome,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-video-capture=${path.resolve(fakeCam)}`,
  ],
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
  permissions: ["camera"],
});
const page = await ctx.newPage();
const errors: string[] = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

const shot = (name: string, full = false) => page.screenshot({ path: path.join(out, `${name}.png`), fullPage: full });
const sleep = (ms: number) => page.waitForTimeout(ms);
const rows = (p: Page) => p.locator(".board .row").count();

await page.goto(base);
await sleep(1500);
await shot("01-age-gate");
await page.getByRole("button", { name: "Ja, ik ben 18+" }).click();
await sleep(2200);
await shot("02-home");

// Gallery flow with both menu pages.
const t0 = Date.now();
await page.locator('input[type="file"]').setInputFiles([path.join(fixtures, "menu-page1.jpg"), path.join(fixtures, "menu-page2.jpg")]);
await sleep(1200);
await shot("03-scanning");
await page.waitForFunction(() => document.querySelectorAll(".board .row").length >= 4, null, { timeout: 30000 });
await sleep(300);
await shot("04-streaming");
await page.waitForFunction(
  () => document.querySelectorAll(".tile.st-scanning, .tile.st-queued").length === 0,
  null,
  { timeout: 60000 },
);
console.log(`scan finished in ${((Date.now() - t0) / 1000).toFixed(1)}s, rows=${await rows(page)}`);
await sleep(600);
await shot("05-done-toast");
await sleep(3500);
await shot("06-results-full", true);

const names = await page.locator(".board .row .row-name").allTextContents();
const values = await page.locator(".board .row .metric-value").allTextContents();
console.log(names.map((n, i) => `${i + 1}. ${n} — ${values[i]}`).join("\n"));

// Edit a drink: make #6 much stronger and watch it climb.
await page.locator(".board .row").nth(5).click();
await sleep(700);
await shot("07-edit-sheet");
const abv = page.locator("#f-abv");
await abv.fill("40");
await sleep(400);
await page.getByRole("button", { name: "Klaar" }).click();
await sleep(450);
await shot("08-after-edit-moving");
await sleep(900);
await shot("09-after-edit");

// Sort switch.
await page.getByRole("tab", { name: "Sterkst" }).click();
await sleep(250);
await shot("10-sort-mid");
await sleep(1200);
await shot("11-sort-strong");
await page.getByRole("tab", { name: "Beste deal" }).click();
await sleep(1200);

// Camera flow with the fake camera device.
await page.getByRole("button", { name: "Foto toevoegen" }).first().click();
await sleep(1800);
await shot("12-camera");
await page.getByRole("button", { name: "Foto nemen" }).click();
await sleep(200);
await shot("13-camera-flash");
await sleep(900);
await page.getByRole("button", { name: "Foto nemen" }).click();
await sleep(1500);
await shot("14-camera-two-shots");
await page.getByRole("button", { name: /Klaar/ }).click();
await page.waitForFunction(
  () => document.querySelectorAll(".tile.st-scanning, .tile.st-queued").length === 0,
  null,
  { timeout: 60000 },
);
await sleep(800);
console.log(`after camera: photos=${await page.locator(".strip .tile:not(.tile-add)").count()} rows=${await rows(page)}`);
await shot("15-after-camera", true);

// Info sheet.
await page.getByRole("button", { name: "Hoe werkt het?" }).click();
await sleep(800);
await shot("16-info");

console.log(errors.length ? `CONSOLE ERRORS:\n${errors.join("\n")}` : "no console errors");
await browser.close();
