// One-off promotion transform: read the gated generated-stage{0,1}.ts, apply the spot-check
// corrections (the major issues found in human + LLM review), flip confidence "unreviewed"→"validated",
// and write promoted-stage{0,1}.ts (SEPARATE files, so re-running a wave can't clobber reviewed
// content). index.ts serves the promoted-* files. Pure transform — no API calls.
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as s0 from "../../packages/pack-mk/src/generated-stage0.js";
import * as s1 from "../../packages/pack-mk/src/generated-stage1.js";
import * as s2 from "../../packages/pack-mk/src/generated-stage2.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Substring fixes — safe to apply anywhere (each string is unambiguous, no bad superstrings).
const SUB: [string, string][] = [
  ["една кафе", "едно кафе"], // gender: кафе is neuter
  ["направо", "право"], // Serbianism → standard MK "straight ahead"
  ["napravo", "pravo"],
  ["na-PRA-vo", "PRA-vo"],
  ["Добар вечер", "Добровечер"], // вечер is feminine; "Добар вечер" is a Serbian calque
  ["На здравје", "Наздравје"], // standardize on the authored pack's one-word toast
  ["Nice to meet you / Take care", "Have a nice time / enjoy (a parting pleasantry)"], // Пријатно gloss
];

// Whole-string fixes — replace ONLY when the entire string equals the key (avoids the
// "во центар" ⊂ "во центарот" substring trap, and surgically removes the out-of-place coffee order).
const WHOLE: Record<string, string> = {
  "Јас сум учителка. Една кафа, ве молам.": "Јас сум учителка.", // кафа = Serbian; and a coffee order doesn't belong in an intro
  "I am a teacher. One coffee, please.": "I am a teacher.",
  "во центар": "во центарот", // definite article
  "vo centar": "vo centarot",
  "to the centre": "in/to the centre",
  "Во центар.": "Во центарот.",
  "Таму има автобус во центар.": "Таму има автобус за центарот.",
  "Ана е на улица во центар.": "Ана е на улица во центарот.",
  "Таа оди десно и патува во центар.": "Таа оди десно и патува во центарот.",
  // --- Stage 2: past-tense person agreement (narration is 3rd-person Marko; the 1st-person vocab
  //     forms имав/отидов/јадев are CORRECT and untouched — these are full-sentence matches). ---
  "Тој имав многу работа.": "Тој имаше многу работа.",
  "Денес Марко отидов во парк.": "Денес Марко отиде во паркот.",
  "Таму јадев сендвич.": "Таму јадеше сендвич.",
  "„Бев во парк и читав книга“, вели Марко.": "„Бев во паркот и читав книга“, вели Марко.",
  "Каде отидов Марко денес?": "Каде отиде Марко денес?", // Q&A — the runner never validated qa lines
  "Што јадев Марко во парк?": "Што јадеше Марко во парк?", // Q&A — likewise
  // Stage 2: café (venue) vs кафе (coffee); dative clitic doubling; calque; direction.
  "Отидов во кафе и јадев сендвич.": "Отидов во кафуле и јадев сендвич.",
  "Ајде во кафето на плоштадот.": "Ајде во кафулето на плоштадот.",
  "Марко телефонира на Ана.": "Марко ѝ телефонира на Ана.",
  "Што има проблем? Извинете.": "Каков е проблемот? Извинете.",
  "Тоа е десно, до банката.": "Тоа е надесно, до банката.",
};

function fix(v: unknown): unknown {
  if (typeof v === "string") {
    let s = Object.prototype.hasOwnProperty.call(WHOLE, v) ? WHOLE[v]! : v;
    for (const [a, b] of SUB) s = s.split(a).join(b);
    return s;
  }
  if (Array.isArray(v)) return v.map(fix);
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>)) {
      const val = (v as Record<string, unknown>)[k];
      o[k] = k === "confidence" && val === "unreviewed" ? "validated" : fix(val);
    }
    return o;
  }
  return v;
}

function block(name: string, type: string, data: unknown): string {
  return `export const ${name}: ${type} = ${JSON.stringify(fix(data), null, 2)};\n\n`;
}

function write(stage: number, types: string, blocks: string) {
  const header = `// PROMOTED from generated-stage${stage}.ts — spot-checked + corrected (see pipeline/output/wave-mk-stage${stage}.md),\n// confidence:"validated". This is the SERVED copy (wired into index.ts); generated-stage${stage}.ts stays as the raw audit trail.\n`;
  const body = `import type { ${types} } from "@ll/pack-schema";\n\n${blocks}`;
  writeFileSync(join(ROOT, "packages", "pack-mk", "src", `promoted-stage${stage}.ts`), header + body);
}

write(
  0,
  "ReviewItem, Scenario, MiniStory, InfoGapTask",
  block("promotedVocab", "ReviewItem[]", s0.generatedVocab) +
    block("promotedScenarios", "Scenario[]", s0.generatedScenarios) +
    block("promotedStories", "MiniStory[]", s0.generatedStories) +
    block("promotedInfoGapTasks", "InfoGapTask[]", s0.generatedInfoGapTasks),
);

write(
  1,
  "ReviewItem, Scenario, MiniStory, GrammarConcept, Reader, WritingTask, InfoGapTask",
  block("promotedVocab", "ReviewItem[]", s1.generatedVocab) +
    block("promotedScenarios", "Scenario[]", s1.generatedScenarios) +
    block("promotedStories", "MiniStory[]", s1.generatedStories) +
    block("promotedGrammar", "GrammarConcept[]", s1.generatedGrammar) +
    block("promotedReaders", "Reader[]", s1.generatedReaders) +
    block("promotedWritingTasks", "WritingTask[]", s1.generatedWritingTasks) +
    block("promotedInfoGapTasks", "InfoGapTask[]", s1.generatedInfoGapTasks),
);

write(
  2,
  "ReviewItem, Scenario, MiniStory, WritingTask, InfoGapTask",
  block("promotedVocab", "ReviewItem[]", s2.generatedVocab) +
    block("promotedScenarios", "Scenario[]", s2.generatedScenarios) +
    block("promotedStories", "MiniStory[]", s2.generatedStories) +
    block("promotedWritingTasks", "WritingTask[]", s2.generatedWritingTasks) +
    block("promotedInfoGapTasks", "InfoGapTask[]", s2.generatedInfoGapTasks),
);

console.log("wrote packages/pack-mk/src/promoted-stage{0,1,2}.ts (corrected, confidence:validated)");
