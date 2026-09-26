// Runnable check for the chapter spine (no test harness — run with:
//   npx tsx packages/core/test/chapters.test.ts
// Pure logic: artifact→chapter resolution (id convention, tags, extraIds, wordTags) and the
// four-strand progress/state machine, over a tiny synthetic pack — core never imports a language
// pack. Coverage of the REAL pack (every story/reader chaptered, no double-placed vocab) is asserted
// by pipeline/src/run-lint.ts, which is allowed to see packs.
import assert from "node:assert/strict";
import type { Chapter, LanguagePack, ReviewItem } from "@ll/pack-schema";
import { resolveChapters, chapterMap, chapterOf, unchaptered, MIN_WORDS_KNOWN, type ChapterProgressInput } from "../src/chapters/index.js";

const chapter = (id: string, order: number, extra: Partial<Chapter> = {}): Chapter => ({
  id, order, stage: 0, stageTitle: "Stage", title: `Chapter ${order}`, shortTitle: `C${order}`, cefr: "A1", goal: "g", ...extra,
});

const item = (id: string, answer: string, tags: string[] = []): ReviewItem =>
  ({ id, kind: "vocab", prompt: answer, answer, gloss: answer, i1Level: 1, tags });

const scenario = (id: string, criteria: string[], structures: string[] = []) => ({
  id, title: id, goal: "", setting: "", requiredVocab: [], requiredStructures: structures,
  script: [], successCriteria: criteria.map((c) => ({ id: c, description: c })), confidence: "authored" as const,
});

const story = (id: string) => ({
  id, title: id, i1Level: 1, level: "A1" as const, body: [], audioSource: "tts" as const, qa: [],
  registersVocab: [], confidence: "authored" as const,
});

const pack: LanguagePack = {
  id: "t", languageCode: "t", name: "Test", voiceId: "v",
  asr: { engines: ["scribe"], languageHints: ["t"], gate: "single" },
  alphabet: [], phonology: { rules: [] as never[] } as LanguagePack["phonology"], grammar: [],
  vocab: [
    item("gen-c1-v1", "aa"),                       // by id prefix
    item("gen-c1-v2", "bb"),
    item("word-1", "cc", ["numbers"]),             // by wordTags
    item("v-legacy", "dd", ["c1"]),                // by chapter id in tags
    item("word-9", "zz", ["astronomy"]),           // belongs to no chapter
  ],
  scenarios: [scenario("gen-c1", ["ordered"], ["gender"]), scenario("legacy-bar", ["chatted"]), scenario("gen-c2", ["asked"])],
  readers: [], stories: [story("gen-c1-story"), story("gen-c2-story")], srsSeed: [],
  chapters: [chapter("c1", 1, { wordTags: ["numbers"], extraIds: ["legacy-bar"] }), chapter("c2", 2)],
};

// ---- resolution ----
const [c1, c2] = resolveChapters(pack);
assert.deepEqual(c1!.vocab.map((v) => v.id), ["gen-c1-v1", "gen-c1-v2", "word-1", "v-legacy"], "vocab joins by prefix, wordTag and tag");
assert.deepEqual(c1!.scenarios.map((s) => s.id), ["gen-c1", "legacy-bar"], "extraIds pull in hand-authored content");
assert.deepEqual(c1!.grammarIds, ["gender"], "grammar comes from the scenario's requiredStructures");
assert.deepEqual(c2!.vocab, [], "a chapter with no vocab resolves empty, not everything");
assert.equal(chapterOf(pack, "gen-c2-story")?.id, "c2");
assert.equal(chapterOf(pack, "word-9"), undefined);
assert.deepEqual(unchaptered(pack).vocab, ["word-9"], "leftovers are reported, not hidden");

// ---- progress ----
const known = (...answers: string[]): ChapterProgressInput["familiarity"] =>
  Object.fromEntries(answers.map((a) => [a, { lexKey: a, kind: "word", display: a, srs: null, status: "known", strength: 1, createdAt: new Date(), lastSeenAt: new Date() }]));

const empty: ChapterProgressInput = { familiarity: {} };
let map = chapterMap(pack, empty);
assert.equal(map[0]!.state, "current", "first incomplete chapter is current");
assert.equal(map[1]!.state, "upcoming");
assert.equal(map[0]!.percent, 0);
assert.equal(map[0]!.wordsTotal, 4);

// Partway: words known but nothing else done.
map = chapterMap(pack, { familiarity: known("aa", "bb", "cc", "dd") });
assert.equal(map[0]!.wordsKnown, 4);
assert.ok(map[0]!.percent > 0 && map[0]!.percent < 1, "one strand of four doesn't finish a chapter");
assert.equal(map[0]!.state, "current");

// All four strands satisfied ⇒ done, and the NEXT chapter becomes current.
const finished: ChapterProgressInput = {
  familiarity: known("aa", "bb", "cc", "dd"),
  seenGrammar: { gender: true },
  storyReads: { "gen-c1-story": ["2026-01-01"] },
  scenarios: { "gen-c1": { turnIndex: 0, metCriteria: ["ordered"] }, "legacy-bar": { turnIndex: 0, metCriteria: ["chatted"] } },
};
map = chapterMap(pack, finished);
assert.equal(map[0]!.state, "done");
assert.equal(map[0]!.percent, 1);
assert.equal(map[1]!.state, "current", "completing a chapter advances the current marker");

// The words bar is relative to MIN_WORDS_KNOWN, not 100%: 3 of 4 known (75%) clears a 70% gate.
const mostly = { ...finished, familiarity: known("aa", "bb", "cc") };
assert.ok(3 / 4 >= MIN_WORDS_KNOWN);
assert.equal(chapterMap(pack, mostly)[0]!.state, "done", "70% of words is enough to finish a chapter");

console.log("✓ chapters: resolution (prefix/tag/extraIds/wordTags), leftovers, four-strand progress, current-marker advance");
