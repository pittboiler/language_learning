// Runnable checks for Build-a-sentence scoping (run with: npx tsx packages/core/test/sentences.test.ts).
// The rules that matter: a sentence isn't offered before the course has introduced its VERB (which its
// supportWords never mention), and the tier is capped by course position as well as by cards built.
import assert from "node:assert/strict";
import type { Chapter, LanguagePack, SentenceItem } from "@ll/pack-schema";
import { introducedBy, requiredChapter, tierCapForChapter, tierCapForBuilds, maxTier, inScope } from "../src/sentences/index.js";

const chapter = (id: string, order: number): Chapter =>
  ({ id, order, stage: 0, stageTitle: "S", title: `Chapter ${order}`, shortTitle: `C${order}`, cefr: "A1", goal: "g" });

const word = (id: string, answer: string) => ({ id, kind: "vocab" as const, prompt: answer, answer, gloss: answer, i1Level: 1, tags: [] });
const scenario = (id: string, lines: string[]) => ({
  id, title: id, goal: "", setting: "", requiredVocab: [], requiredStructures: [],
  script: lines.map((text) => ({ speaker: "partner" as const, text, gloss: "" })),
  successCriteria: [], confidence: "authored" as const,
});
const sentence = (id: string, verbLemma: string, supportWords: string[], tier?: 1 | 2 | 3 | 4): SentenceItem =>
  ({ id, conceptIds: ["verb-conjugation"], verbLemma, supportWords, variants: [{ person: "1sg", en: "x", mk: "x" }], ...(tier ? { tier } : {}) });

// c1 teaches "вода"; c2's scenario line is where the verb пие is first heard; c3 teaches "кафе".
const pack: LanguagePack = {
  id: "t", languageCode: "t", name: "T", voiceId: "v",
  asr: { engines: ["scribe"], languageHints: ["t"], gate: "single" },
  alphabet: [], phonology: { rules: [] as never[] } as LanguagePack["phonology"], grammar: [],
  vocab: [word("gen-c1-v1", "вода"), word("gen-c3-v1", "кафе")],
  scenarios: [scenario("gen-c2", ["Пијам вода секој ден"])],
  readers: [], stories: [], srsSeed: [],
  chapters: [chapter("c1", 1), chapter("c2", 2), chapter("c3", 3)],
  conjugations: [
    { lemma: "пие", gloss: "drink", group: "e", forms: { "1sg": "Пијам", "2sg": "пиеш", "3sg": "пие", "1pl": "пиеме", "2pl": "пиете", "3pl": "пијат" } },
    { lemma: "лета", gloss: "fly", group: "a", forms: { "1sg": "летам", "2sg": "леташ", "3sg": "лета", "1pl": "летаме", "2pl": "летате", "3pl": "летаат" } },
  ],
  sentences: [],
};

// ---- where things are introduced ----
const intro = introducedBy(pack);
assert.equal(intro.get("вода"), 1, "a taught word is introduced by its chapter");
assert.equal(intro.get("пијам"), 2, "a verb form first HEARD in a scenario line counts as introduced");
assert.equal(intro.get("кафе"), 3);
assert.equal(intro.get("лета"), undefined, "a verb that appears nowhere is never introduced");

// ---- what a sentence requires ----
// Water + пие: the word lands in c1 but the verb isn't heard until c2, so the sentence waits for c2.
assert.equal(requiredChapter(pack, sentence("s1", "пие", ["вода"])), 2, "the verb gates the sentence, not just its words");
// Coffee arrives later still.
assert.equal(requiredChapter(pack, sentence("s2", "пие", ["вода", "кафе"])), 3, "the latest-introduced piece decides");
// A verb the course never shows can't be drilled at all.
assert.equal(requiredChapter(pack, sentence("s3", "лета", ["вода"])), undefined, "an unintroduced verb ⇒ never serveable");
// Nor can an unknown support word.
assert.equal(requiredChapter(pack, sentence("s4", "пие", ["чај"])), undefined);

// ---- tier caps ----
assert.equal(tierCapForChapter(1), 1, "chapter 1 builds two-word sentences");
assert.equal(tierCapForChapter(4), 1);
assert.equal(tierCapForChapter(5), 2);
assert.equal(tierCapForChapter(9), 3);
assert.equal(tierCapForChapter(12), 4);
assert.equal(tierCapForBuilds(0), 1);
assert.equal(tierCapForBuilds(6), 2);
assert.equal(tierCapForBuilds(40), 4);
// Both gates apply: the lower one wins in each direction.
assert.equal(maxTier({ chapterOrder: 2, builtCount: 999 }), 1, "a prolific builder in chapter 2 still gets short sentences");
assert.equal(maxTier({ chapterOrder: 12, builtCount: 0 }), 1, "a late-course learner who has never built still starts short");
assert.equal(maxTier({ chapterOrder: 12, builtCount: 40 }), 4);

// ---- the whole filter ----
const full: LanguagePack = {
  ...pack,
  sentences: [
    sentence("short", "пие", ["вода"]),
    sentence("long", "пие", ["вода"], 3),
    sentence("later", "пие", ["кафе"]),
    sentence("never", "лета", ["вода"]),
  ],
};
const met = (keys: string[]) => (k: string) => keys.includes(k);

assert.deepEqual(
  inScope(full, { chapterOrder: 1, builtCount: 99, hasMet: met(["вода", "кафе"]) }).map((s) => s.id),
  [],
  "nothing before the verb has been introduced",
);
assert.deepEqual(
  inScope(full, { chapterOrder: 2, builtCount: 99, hasMet: met(["вода", "кафе"]) }).map((s) => s.id),
  ["short"],
  "chapter 2: the short sentence only — the tier-3 one is above the chapter's cap, coffee isn't taught yet",
);
assert.deepEqual(
  inScope(full, { chapterOrder: 3, builtCount: 99, hasMet: met(["вода", "кафе"]) }).map((s) => s.id),
  ["short", "later"],
  "chapter 3 adds the coffee sentence; the unintroduced verb never appears",
);
assert.deepEqual(
  inScope(full, { chapterOrder: 3, builtCount: 99, hasMet: met(["вода"]) }).map((s) => s.id),
  ["short"],
  "a word the learner hasn't met still holds its sentence back",
);

console.log("✓ sentences: verb-aware gating, chapter + build tier caps, scope filter");
