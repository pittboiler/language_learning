// Standalone structural lint over the committed packs — no LLM, free, instant. Catches malformed
// grammar drills (duplicate options / answer-not-in-options / too-few-options) the line Validator
// can't see. Useful after any generation or hand-edit.
//
// Run:  pipeline/node_modules/.bin/tsx pipeline/src/run-lint.ts
import { macedonian } from "@ll/pack-mk";
import { bulgarian } from "@ll/pack-bg";
import { lintDrills, lintTranslit, lintSynonyms, type SynonymGroup } from "./lint.js";

// One word per everyday concept, decided once and enforced here so a later generation wave can't quietly
// reintroduce the other one. Add a group whenever a review turns up two words doing the same job.
const SYNONYMS: Record<string, SynonymGroup[]> = {
  mk: [
    { concept: "teacher", preferred: "учител/учителка", avoid: ["наставник", "nastavnik"] },
    { concept: "doctor", preferred: "доктор", avoid: ["лекар", "lekar"] },
  ],
};

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

  const synonyms = lintSynonyms(pack, SYNONYMS[pack.id] ?? []);
  total += synonyms.length;
  console.log(`${pack.name} (${pack.id}): ${synonyms.length} vocabulary-consistency issue(s)`);
  for (const i of synonyms) console.log(`  • ${i.location}: "${i.found}" (${i.concept}) — the pack teaches ${i.preferred} — in "${i.value}"`);
}
console.log(`\n=== ${total} total issue(s) across packs ===`);
