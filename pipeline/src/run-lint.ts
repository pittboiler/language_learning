// Standalone structural lint over the committed packs — no LLM, free, instant. Catches malformed
// grammar drills (duplicate options / answer-not-in-options / too-few-options) the line Validator
// can't see. Useful after any generation or hand-edit.
//
// Run:  pipeline/node_modules/.bin/tsx pipeline/src/run-lint.ts
import { macedonian } from "@ll/pack-mk";
import { bulgarian } from "@ll/pack-bg";
import { lintDrills, lintTranslit, lintSynonyms, lintChapters, lintHints, lintSentences, lintCourse, lintScriptMix, type SynonymGroup } from "./lint.js";

// One word per everyday concept, decided once and enforced here so a later generation wave can't quietly
// reintroduce the other one. Add a group whenever a review turns up two words doing the same job.
const SYNONYMS: Record<string, SynonymGroup[]> = {
  mk: [
    { concept: "teacher", preferred: "учител/учителка", avoid: ["наставник", "nastavnik"] },
    { concept: "doctor", preferred: "доктор", avoid: ["лекар", "lekar"] },
    { concept: "nice to meet you", preferred: "Мило ми е", avoid: ["Драго ми е", "Drago mi e"] },
    { concept: "you're welcome", preferred: "Нема за што", avoid: ["Нема на што", "Nema na što", "Nema na shto"] },
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

  const chapterIssues = lintChapters(pack);
  total += chapterIssues.length;
  console.log(`${pack.name} (${pack.id}): ${chapterIssues.length} chapter-coverage issue(s)${pack.chapters?.length ? "" : " (no chapters declared)"}`);
  for (const i of chapterIssues) console.log(`  • [${i.kind}] ${i.location}: ${i.detail}`);

  const hintIssues = lintHints(pack);
  total += hintIssues.length;
  console.log(`${pack.name} (${pack.id}): ${hintIssues.length} hint issue(s) over ${Object.keys(pack.hints ?? {}).length} hint(s)`);
  for (const i of hintIssues) console.log(`  • [${i.kind}] ${i.lexKey}: ${i.detail}`);

  const sentenceIssues = lintSentences(pack);
  total += sentenceIssues.length;
  console.log(`${pack.name} (${pack.id}): ${sentenceIssues.length} unserveable sentence(s) of ${pack.sentences?.length ?? 0}`);
  for (const i of sentenceIssues) console.log(`  • [${i.kind}] ${i.id}: ${i.detail}`);

  const mix = lintScriptMix(pack);
  total += mix.length;
  console.log(`${pack.name} (${pack.id}): ${mix.length} mixed-script word(s)`);
  for (const i of mix) console.log(`  • ${i.location}: "${i.word}" in "${i.value}"`);

  // Points not written yet are progress, not defects — report them separately from real issues.
  const courseIssues = lintCourse(pack);
  const pending = courseIssues.filter((i) => i.kind === "missing-point");
  const real = courseIssues.filter((i) => i.kind !== "missing-point");
  total += real.length;
  console.log(`${pack.name} (${pack.id}): ${real.length} course-blueprint issue(s)${pending.length ? `, ${pending.length} point(s) not written yet` : ""}`);
  for (const i of real) console.log(`  • [${i.kind}] ${i.where}: ${i.detail}`);
}
console.log(`\n=== ${total} total issue(s) across packs ===`);
