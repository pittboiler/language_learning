// Calibration runner: profile a language (default "bg") on Opus 4.8 and save the teaching profile.
// Cheap (one call) and the most fact-checkable artifact — run it FIRST, before building generators.
//
// Run:  pipeline/node_modules/.bin/tsx pipeline/src/run-profile.ts   (LANG_CODE=bg by default)
import "./env.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { profile } from "./profiler.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

async function main() {
  const code = process.env.LANG_CODE || "bg";
  console.log(`\n=== Language Profiler: "${code}" (Opus 4.8, offline) ===\n`);
  const p = await profile(code);
  console.log(JSON.stringify(p, null, 2));
  const outDir = join(ROOT, "pipeline", "output");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `profile-${code}.json`), JSON.stringify(p, null, 2));
  console.log(`\n=== done · $${p.costUsd.toFixed(4)} · wrote pipeline/output/profile-${code}.json ===\n`);
}

main().catch((e) => {
  console.error("profile failed:", e);
  process.exit(1);
});
