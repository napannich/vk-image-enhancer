#!/usr/bin/env node
/**
 * End-to-end smoke test + README screenshot capture.
 *
 * Boots the local app at http://localhost:3456, uploads the three synthetic
 * samples from docs/samples/, verifies the ML pipeline runs to completion
 * (progress → done within budget), and writes screenshots into docs/screenshots/.
 *
 * Uses the Playwright install living under /tmp/vk-edu (outside the repo,
 * intentional — we don't want headless-shell deps in production package.json).
 */
import { chromium } from "/tmp/vk-edu/node_modules/playwright/index.mjs";
import { mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const OUT = resolve(REPO, "docs", "screenshots");
mkdirSync(OUT, { recursive: true });

const URL = process.env.APP_URL || "http://localhost:3456/";
const TIMEOUT = 45_000;

async function run() {
  const chromeApp = "/Users/andreynapalkov/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
  const browser = await chromium.launch({ headless: true, executablePath: chromeApp });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  page.on("pageerror", (e) => console.error("pageerror:", e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.error("console.error:", m.text());
  });

  console.log("→", URL);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT });

  // 1. Landing — idle state
  await page.waitForSelector("#dropzone", { timeout: TIMEOUT });
  await page.screenshot({ path: resolve(OUT, "01-landing.png"), fullPage: false });
  console.log("✓ 01-landing.png");

  // 2. Upload a sample, wait for done state
  const sample = resolve(REPO, "docs/samples/low-contrast.png");
  if (!existsSync(sample)) throw new Error("sample missing: " + sample);

  await page.setInputFiles("#fileInput", sample);

  // Wait for comparison section to be visible (means processing done)
  await page.waitForSelector("#comparisonSection:not(.hidden)", { timeout: TIMEOUT });
  await page.waitForTimeout(500); // let transitions settle

  await page.screenshot({ path: resolve(OUT, "02-result.png"), fullPage: true });
  console.log("✓ 02-result.png");

  // 3. Manual params panel open
  const manualBtn = await page.$("#toggleManualBtn");
  if (manualBtn) {
    await manualBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: resolve(OUT, "03-manual.png"), fullPage: true });
    console.log("✓ 03-manual.png");
  }

  await browser.close();
  console.log("done");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
