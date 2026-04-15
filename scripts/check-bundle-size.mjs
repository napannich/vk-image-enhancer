#!/usr/bin/env node
/**
 * Bundle-size guard for the VK Education Practice TZ requirement «код ≤ 10 МБ».
 *
 * Counts every file a user actually downloads on first visit:
 *   index.html            — main UI
 *   models/*.onnx         — Real-ESRGAN weights (only fetched in SR mode)
 *   vendor/*              — self-hosted ONNX Runtime + WASM
 *
 * Intentionally excludes docs/, tests/, scripts/, src/ (build sources) and dist/.
 *
 * Fails with exit code 1 when the total exceeds BUDGET_BYTES.
 */
import { readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BUDGET_BYTES = 10 * 1024 * 1024;

const INCLUDE = [
  "index.html",
  "models",
  "vendor",
];

function walk(path) {
  const st = statSync(path);
  if (st.isFile()) return [{ path, size: st.size }];
  const out = [];
  for (const entry of readdirSync(path)) {
    out.push(...walk(join(path, entry)));
  }
  return out;
}

const files = INCLUDE.flatMap((p) => walk(join(ROOT, p)));
const total = files.reduce((sum, f) => sum + f.size, 0);

const fmt = (b) => (b / 1024 / 1024).toFixed(2) + " MB";

console.log("Bundle contents:");
for (const f of files.sort((a, b) => b.size - a.size)) {
  console.log(`  ${fmt(f.size).padStart(9)}  ${f.path.replace(ROOT + "/", "")}`);
}
console.log("-".repeat(40));
console.log(`  ${fmt(total).padStart(9)}  TOTAL  (budget: ${fmt(BUDGET_BYTES)})`);

if (total > BUDGET_BYTES) {
  console.error(`\nFAIL: bundle exceeds budget by ${fmt(total - BUDGET_BYTES)}`);
  process.exit(1);
}
console.log(`\nOK: under budget by ${fmt(BUDGET_BYTES - total)}`);
