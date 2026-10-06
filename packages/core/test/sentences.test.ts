// Runnable checks for Build-a-sentence scoping (run with: npx tsx packages/core/test/sentences.test.ts).
// The rules that matter: a sentence isn't offered before the course has introduced its VERB (which its
// supportWords never mention), and the tier is capped by course position as well as by cards built.
import assert from "node:assert/strict";
import type { Chapter, LanguagePack, SentenceItem } from "@ll/pack-schema";
import { introducedBy, requiredChapter, tierCapForChapter, tierCapForBuilds, maxTier, inScope, unlockingWords, withFallback, phraseCards } from "../src/sentences/index.js";

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
  vocab: [
    word("gen-c1-v1", "вода"),
    word("gen-c3-v1", "кафе"),
    { id: "gen-c1-v2", kind: "phrase" as const, prompt: "I don't understand", answer: "Не разбирам", gloss: "I don't understand", i1Level: 1, tags: [] },
  ],
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

// ---- aiming the trickle, and never silently dropping the step ----
// "later" needs кафе, which the learner hasn't met: that's the word worth teaching next.
assert.deepEqual(
  unlockingWords(full, { chapterOrder: 3, builtCount: 99, hasMet: met(["вода"]) }),
  ["кафе"],
  "the word standing between the learner and a buildable sentence is the one to teach",
);
// Nothing is one or two words away ⇒ nothing to aim at (rather than arbitrary suggestions).
assert.deepEqual(unlockingWords(full, { chapterOrder: 3, builtCount: 99, hasMet: met(["вода", "кафе"]) }), []);

// With a word unmet the strict scope still has the other sentence, so no fallback is needed.
const normal = withFallback(full, { chapterOrder: 3, builtCount: 99, hasMet: met(["вода"]) });
assert.deepEqual(normal.items.map((s) => s.id), ["short"]);
assert.equal(normal.usedFallback, false);

// Learner has met NOTHING: rather than drop production from the day, fall back to the shortest rung of
// what the course has already introduced.
const fallback = withFallback(full, { chapterOrder: 3, builtCount: 99, hasMet: met([]) });
assert.deepEqual(fallback.items.map((s) => s.id), ["short", "later"], "fallback offers tier-1 sentences the course has introduced");
assert.equal(fallback.usedFallback, true);
assert.ok(fallback.items.every((s) => (s.tier ?? 1) === 1), "the fallback never reaches past the shortest rung");

// Before any verb exists, a learner who has met a taught PHRASE builds that instead — production still
// happens on day one of the course, at the right difficulty.
const early = withFallback(full, { chapterOrder: 1, builtCount: 99, hasMet: met(["вода", "не разбирам"]) });
assert.equal(early.source, "phrases");
assert.deepEqual(early.items.map((s) => s.variants[0]!.mk), ["Не разбирам"]);
assert.deepEqual(phraseCards(full, { chapterOrder: 1, hasMet: met(["не разбирам"]) }).map((s) => s.id), ["phrase-gen-c1-v2"]);
// A phrase the learner hasn't met isn't offered, and a single word is not a "build".
assert.deepEqual(phraseCards(full, { chapterOrder: 1, hasMet: met(["вода"]) }), []);
// Nothing met and no verb introduced ⇒ genuinely nothing, rather than a bogus card.
const nothing = withFallback(full, { chapterOrder: 1, builtCount: 99, hasMet: met([]) });
assert.deepEqual(nothing.items, []);
assert.equal(nothing.source, "none");

console.log("✓ sentences: verb-aware gating, chapter + build tier caps, scope filter, unlocking words, fallback");
