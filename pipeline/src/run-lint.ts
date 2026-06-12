// Standalone structural lint over the committed packs — no LLM, free, instant. Catches malformed
// grammar drills (duplicate options / answer-not-in-options / too-few-options) the line Validator
// can't see. Useful after any generation or hand-edit.
//
// Run:  pipeline/node_modules/.bin/tsx pipeline/src/run-lint.ts
import { macedonian } from "@ll/pack-mk";
import { bulgarian } from "@ll/pack-bg";
import { lintDrills } from "./lint.js";

let total = 0;
for (const pack of [macedonian, bulgarian]) {
  const issues = lintDrills(pack.grammar);
  total += issues.length;
  console.log(`\n${pack.name} (${pack.id}): ${issues.length} structural drill issue(s)`);
  for (const i of issues) console.log(`  • [${i.kind}] ${i.conceptId} / ${i.drillId}: ${i.detail}`);
}
console.log(`\n=== ${total} total structural issue(s) across packs ===`);
