// Derives the CHAPTER SPINE from the curriculum the architect already produced — no LLM, instant, free.
// The 12 curriculum units are the chapters; every generated artifact already encodes its unit in its id
// (`gen-<unit>`, `gen-<unit>-story`, `gen-<unit>-v3`, …) or in `tags`, so this only names them, fixes
// their order, and records the two things the ids can't express:
//   • wordTags  — which semantic buckets of the hand-authored core word list (words.ts: "food & drink",
//                 "numbers", …) each chapter teaches, so those 150 words get a home in the spine;
//   • extraIds  — hand-authored artifacts that predate the pipeline's id convention.
// Writes packages/pack-mk/src/chapters.ts.
//
// Run:  pipeline/node_modules/.bin/tsx pipeline/src/run-chapters.ts
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Chapter, CefrBand } from "@ll/pack-schema";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CURRICULUM = join(ROOT, "pipeline", "output", "curriculum-mk.json");
const OUT = join(ROOT, "packages", "pack-mk", "src", "chapters.ts");

interface CurriculumFile {
  stages: { stage: number; name: string; cefr: CefrBand; goal: string }[];
  sequence: string[];
  units: { id: string; stage: number; title: string; cefr: CefrBand; situation: string }[];
}
const curriculum: CurriculumFile = JSON.parse(readFileSync(CURRICULUM, "utf8"));

// What learners see. The curriculum's unit titles are authoring names ("Survival operators + numbers 1–10",
// "(the anchor)"); chapters are named for what you can do by the end, in plain words (2026-10-09). `short`
// is for chips and headings, `title` for the chapter page, `goal` the one-line "by the end you can…".
const NAMES: Record<string, { short: string; title: string; goal: string }> = {
  "s0-repair": { short: "First words", title: "First words: I am…, I don't understand", goal: "say who you are, and keep going when you don't understand" },
  "s0-greet": { short: "Hello, how are you?", title: "Hello, how are you?", goal: "greet people, ask simple questions, and choose casual ти or polite вие" },
  "s0-survive": { short: "Numbers & prices", title: "Numbers and a first purchase", goal: "count, point at things, and ask what they cost" },
  "s1-cafe-order": { short: "At the café", title: "At the café: order and pay", goal: "order a drink, ask for the bill, and pay" },
  "s1-greet-intro": { short: "Meeting people", title: "Meeting someone new", goal: "say your name, where you're from and what you do" },
  "s1-market": { short: "At the market", title: "At the market", goal: "buy fruit, bread and more, by the kilo" },
  "s1-directions": { short: "Finding your way", title: "Finding your way", goal: "ask for directions and follow them" },
  "s2-smalltalk": { short: "Likes & plans", title: "Likes, opinions and plans", goal: "say what you like and think, and what you'll do" },
  "s2-pasttime": { short: "What you did", title: "What you did today", goal: "tell someone what you did" },
  "s2-home-family": { short: "Family & home", title: "Family, home and work", goal: "tell someone about your family and your life" },
  "s2-arrange": { short: "Making plans", title: "Making plans on the phone", goal: "call someone and agree a time and place to meet" },
  "s2-problems": { short: "When things go wrong", title: "When things go wrong", goal: "explain a problem and ask for it to be put right" },
};

// The hand-authored core word list (packages/pack-mk/src/words.ts) is tagged semantically, not by unit.
// Each bucket is assigned to the chapter whose situation actually uses it, so browsing a chapter shows
// its words. Every tag in words.ts must appear exactly once here (asserted below).
const WORD_TAGS: Record<string, string[]> = {
  "s0-repair": ["question words"],
  "s0-greet": ["pronouns", "this & that", "greeting", "social"],
  "s0-survive": ["numbers", "common adverbs"],
  "s1-cafe-order": ["food & drink", "drinks", "ordering", "paying"],
  "s1-greet-intro": ["common verbs", "introductions"],
  "s1-market": ["money & shopping", "common adjectives", "shopping"],
  "s1-directions": ["places & travel", "prepositions", "directions"],
  "s2-smalltalk": ["nature & weather", "conjunctions", "small-talk"],
  "s2-pasttime": ["time & days"],
  "s2-arrange": ["phone"],
  "s2-home-family": ["family & people", "home & everyday objects", "possessives"],
  "s2-problems": ["body & health"],
};

// Hand-authored content that predates `gen-<unit>` ids, mapped onto the chapter it belongs with.
const EXTRA_IDS: Record<string, string[]> = {
  "s1-cafe-order": ["bar-order-a-drink", "ana-coffee", "cafe", "cafe-order-gap", "w-order-coffee"],
  "s1-greet-intro": ["bar-small-talk", "gen-introductions", "w-greet-name", "w-from"],
  "s1-market": ["gen-shopping", "w-ask-price"],
  "s1-directions": ["gen-directions"],
  "s2-arrange": ["gen-phone"],
};
// Chapter 0: the writing system, ahead of the curriculum units (DESIGN-course-spine.md, 2026-10-08). A
// "script" chapter: letters and sounds only — no words, stories or scenarios — so it keeps the units
// numbered 1-12.
const PRELUDE: Chapter = {
  id: "s0-letters",
  order: 0,
  stage: 0,
  stageTitle: curriculum.stages.find((s) => s.stage === 0)?.name ?? "Decode & survive",
  title: "Letters & sounds",
  shortTitle: "Letters & sounds",
  cefr: "pre-A1",
  goal: "read and say any Macedonian word",
  kind: "script",
};

const units: Chapter[] = curriculum.sequence.map((id, i) => {
  const unit = curriculum.units.find((u) => u.id === id);
  if (!unit) throw new Error(`curriculum.sequence references unknown unit "${id}"`);
  const stage = curriculum.stages.find((s) => s.stage === unit.stage);
  return {
    id,
    order: i + 1,
    stage: unit.stage,
    stageTitle: stage?.name ?? `Stage ${unit.stage}`,
    title: NAMES[id]?.title ?? unit.title,
    shortTitle: NAMES[id]?.short ?? unit.title,
    cefr: unit.cefr,
    goal: NAMES[id]?.goal ?? unit.situation,
    ...(EXTRA_IDS[id] ? { extraIds: EXTRA_IDS[id] } : {}),
    ...(WORD_TAGS[id] ? { wordTags: WORD_TAGS[id] } : {}),
  };
});
const chapters: Chapter[] = [PRELUDE, ...units];

// Guard: a word tag assigned to two chapters would put the same words in two places.
const seen = new Map<string, string>();
for (const c of chapters) {
  for (const t of c.wordTags ?? []) {
    if (seen.has(t)) throw new Error(`word tag "${t}" claimed by both ${seen.get(t)} and ${c.id}`);
    seen.set(t, c.id);
  }
}

const header =
  `// MACHINE-GENERATED by pipeline/src/run-chapters.ts from pipeline/output/curriculum-mk.json.\n` +
  `// The course spine: chapter 0 (letters & sounds) + 12 ordered chapters over content that already exists (artifacts join by the\n` +
  `// \`gen-<chapterId>\` id convention / tags — see packages/core/src/chapters). Edit the maps in\n` +
  `// run-chapters.ts and re-run; don't hand-edit this file.\n` +
  `import type { Chapter } from "@ll/pack-schema";\n\n` +
  `export const chapters: Chapter[] = ${JSON.stringify(chapters, null, 2)};\n`;
writeFileSync(OUT, header);
console.log(`Wrote ${chapters.length} chapters to ${OUT}:`);
for (const c of chapters) console.log(`  ${String(c.order).padStart(2)}. [s${c.stage} ${c.cefr}] ${c.shortTitle} — ${c.title}`);
