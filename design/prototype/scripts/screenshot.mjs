/*
 * Takes a screenshot of the running prototype.
 *
 *   node scripts/screenshot.mjs --out screenshots/desktop-obsidian.png
 *     [--url http://localhost:3100] [--width 1440] [--height 900]
 *     [--bg obsidian] [--text vellum] [--scale 1] [--reduced-motion]
 *
 * Presets are applied through the same <html> attributes and CSS variable the app uses.
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { chromium } from "playwright";

function readOptions(argumentsList) {
  const options = { url: "http://localhost:3100", width: 1440, height: 900, bg: "obsidian", text: "vellum", scale: 1 };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--reduced-motion") options.reducedMotion = true;
    else if (argument.startsWith("--")) options[argument.slice(2)] = argumentsList[(index += 1)];
  }
  return options;
}

const options = readOptions(process.argv.slice(2));
if (!options.out) throw new Error("Missing --out <file.png>");
mkdirSync(dirname(options.out), { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: Number(options.width), height: Number(options.height) },
  reducedMotion: options.reducedMotion ? "reduce" : "no-preference",
});
const page = await context.newPage();
await page.goto(options.url, { waitUntil: "networkidle" });
await page.evaluate(({ bg, text, scale }) => {
  const root = document.documentElement;
  root.dataset.bg = bg;
  root.dataset.text = text;
  root.style.setProperty("--text-scale", String(scale));
}, options);
await page.waitForTimeout(400);
await page.screenshot({ path: options.out });
await browser.close();
console.log(`Saved ${options.out}`);
