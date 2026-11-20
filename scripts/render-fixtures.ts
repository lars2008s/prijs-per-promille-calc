// Renders the HTML test menus to JPEG "photos" for scanner tests.
import { chromium } from "playwright-core";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(root, "..", "tests", "fixtures");
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const page = await browser.newPage({ viewport: { width: 1200, height: 1600 } });
for (const name of ["menu-page1", "menu-page2"]) {
  await page.goto(pathToFileURL(path.join(fixtures, `${name}.html`)).href);
  await page.screenshot({ path: path.join(fixtures, `${name}.jpg`), type: "jpeg", quality: 78 });
  console.log("wrote", name);
}
await browser.close();
