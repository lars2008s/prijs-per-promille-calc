// Renders PNG app icons and the social preview image from the SVG logo.
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

const svg = readFileSync("public/favicon.svg", "utf8");
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const page = await browser.newPage();

async function icon(size: number, file: string, pad: number, bg: string) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:${bg};display:grid;place-items:center;width:${size}px;height:${size}px">
    <div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${svg.replace("<svg ", '<svg width="100%" height="100%" ')}</div></body></html>`);
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: bg === "transparent" });
}

await icon(192, "icon-192.png", 6, "#120b07");
await icon(512, "icon-512.png", 16, "#120b07");
await icon(512, "maskable-512.png", 92, "#120b07");
await icon(180, "apple-touch-icon.png", 14, "#120b07");

await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(`<html><body style="margin:0;width:1200px;height:630px;background:radial-gradient(circle at 30% 20%,#3a220f,#120b07 70%);display:flex;align-items:center;gap:60px;padding:0 90px;box-sizing:border-box;font-family:'Arial Black',sans-serif;color:#f8ecd6">
  <div style="width:300px;height:300px;flex-shrink:0">${svg.replace("<svg ", '<svg width="100%" height="100%" ')}</div>
  <div><div style="font-size:92px;line-height:.9">PRIJS<br><span style="color:#f7a928">PER PROMILLE</span></div>
  <div style="font-family:Georgia,serif;font-size:30px;margin-top:26px;color:#c4ad8a">Scan de drankkaart. Zie meteen de beste deal.</div>
  <div style="font-size:18px;margin-top:22px;color:#ffcf5c;letter-spacing:2px">ALCOHOL SCHAADT DE GEZONDHEID</div></div></body></html>`);
await page.screenshot({ path: "public/icons/og.png" });
await browser.close();
console.log("icons done");
