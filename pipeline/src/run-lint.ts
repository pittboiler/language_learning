// Standalone structural lint over the committed packs — no LLM, free, instant. Catches malformed
// grammar drills (duplicate options / answer-not-in-options / too-few-options) the line Validator
// can't see. Useful after any generation or hand-edit.
//
// Run:  pipeline/node_modules/.bin/tsx pipeline/src/run-lint.ts
import { macedonian } from "@ll/pack-mk";
import { bulgarian } from "@ll/pack-bg";
import { lintDrills, lintTranslit } from "./lint.js";

let total = 0;
for (const pack of [macedonian, bulgarian]) {
  const issues = lintDrills(pack.grammar);
  total += issues.length;
  console.log(`\n${pack.name} (${pack.id}): ${issues.length} structural drill issue(s)`);
  for (const i of issues) console.log(`  • [${i.kind}] ${i.conceptId} / ${i.drillId}: ${i.detail}`);

  const translit = lintTranslit(pack);
  total += translit.length;
  console.log(`${pack.name} (${pack.id}): ${translit.length} translit homoglyph issue(s)`);
  for (const i of translit) console.log(`  • ${i.location}: Cyrillic ${i.cyrillic.map((c) => `"${c}" (U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}")`).join(", ")} in "${i.value}"`);
}
console.log(`\n=== ${total} total issue(s) across packs ===`);
