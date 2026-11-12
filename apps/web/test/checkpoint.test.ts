// The end of a chapter (2026-11-12): the checkpoint is cumulative and says what it takes to pass; its two parts
// (cards, conversation) are kept once passed; practice rounds copy its shape, smaller, starting with what you
// missed. Runs against the real Macedonian course.
//   Run with: npx tsx apps/web/test/checkpoint.test.ts
import assert from "node:assert/strict";
import { macedonian as pack } from "@ll/pack-mk";
import * as familiarity from "@ll/core/familiarity";
import type { Progress } from "../lib/store.js";
import { CHECKPOINT_EARLIER, PRACTICE, PRACTICE_PER_CHAPTER, cardsPass, checkpointPassed, clearParts, needed, partsOf, recordCards, recordConversation, roundMinutes } from "../lib/checkpoint.js";
import { chapterEndStep } from "../lib/today-plan.js";

// 1. The pass mark: 7 in 10 right first time, rounded up.
assert.equal(needed(10), 7);
assert.equal(needed(29), 21);
assert.equal(needed(3), 3);
assert.ok(cardsPass({ got: 7, total: 10 }) && !cardsPass({ got: 6, total: 10 }) && cardsPass({ got: 0, total: 0 }));

// 2. Parts are kept: a pass stays passed (its date isn't moved by a later go), a miss is remembered for practice.
const blank = { familiarity: {}, scenarios: {} } as unknown as Progress;
let p = recordCards(blank, "ch", { got: 5, total: 10 }, ["a", "b"], new Date("2026-11-10"));
assert.equal(partsOf(p, "ch").cards, undefined, "5 of 10 isn't a pass");
assert.deepEqual(partsOf(p, "ch").last?.missed, ["a", "b"]);
assert.ok(!checkpointPassed(partsOf(p, "ch"), true));
p = recordConversation(p, "ch", new Date("2026-11-10"));
assert.ok(!checkpointPassed(partsOf(p, "ch"), true), "the conversation alone isn't a pass");
p = recordCards(p, "ch", { got: 8, total: 10 }, ["c"], new Date("2026-11-11"));
assert.equal(partsOf(p, "ch").cards, new Date("2026-11-11").toISOString());
assert.ok(checkpointPassed(partsOf(p, "ch"), true), "both parts, on different days: passed");
assert.equal(recordCards(p, "ch", { got: 2, total: 10 }, [], new Date("2026-11-12")).checkpoints?.ch?.cards, new Date("2026-11-11").toISOString(), "a later miss doesn't undo a pass");
assert.ok(checkpointPassed({ cards: "x" }, false), "no conversation: the cards are the whole checkpoint");
assert.equal(clearParts(p, "ch").checkpoints?.ch, undefined);

// 3. The chapter 3 checkpoint, for a learner who has studied everything so far.
const course = pack.course!;
const letters = Object.fromEntries(pack.alphabet.map((a) => [a.glyph, true]));
const past = new Date("2026-01-01T00:00:00Z");
const ch3 = course.chapters.find((c) => c.order === 3)!;
const upTo = course.chapters.filter((c) => c.order >= 1 && c.order <= 3);
const fam: Progress["familiarity"] = {};
const seen: Record<string, boolean> = {};
for (const c of upTo) for (const s of c.sessions) {
  for (const w of s.words) fam[w.lexKey] = familiarity.markStudied(familiarity.capture({ lexKey: w.lexKey, kind: w.lexKey.includes(" ") ? "chunk" : "word", display: w.display, gloss: w.gloss }, past));
  if (s.pointId) seen[s.pointId] = true;
}
const learner = { familiarity: fam, scenarios: {}, settings: { courseV2: true }, letters, seenGrammar: seen, course: { chapterId: ch3.chapterId, session: ch3.sessions.length, v: course.version } } as unknown as Progress;
const chapter = pack.chapters!.find((c) => c.id === ch3.chapterId)!;
const end = chapterEndStep(pack, learner, ch3, chapter);
const chapterOf = new Map(upTo.flatMap((c) => c.words.map((w) => [w.lexKey, c.order] as const)));
const orderOf = (it: { id: string }) => chapterOf.get(familiarity.deriveKeyForItem(pack.vocab.find((v) => v.id === it.id)!).lexKey);
const cpWords = end.checkpoint.items.filter((i) => i.kind !== "grammar");
assert.equal(end.checkpoint.earlier, CHECKPOINT_EARLIER, "a few words from earlier chapters");
assert.equal(cpWords.filter((i) => orderOf(i) === 3).length, ch3.words.length, "still every word of the chapter");
assert.equal(cpWords.filter((i) => (orderOf(i) ?? 9) < 3).length, CHECKPOINT_EARLIER, "the earlier ones come from chapters 1 and 2");
assert.ok(end.checkpoint.scenario && end.checkpoint.switches.length > 0, "the person round and the conversation");

// 4. Practice: the checkpoint's shape, smaller.
const pc = end.practice.chapter;
assert.equal(pc.items.filter((i) => i.kind !== "grammar").length, PRACTICE.words);
assert.equal(pc.items.filter((i) => i.kind === "grammar").length, PRACTICE.cards);
assert.ok(pc.items.filter((i) => i.kind !== "grammar").every((i) => orderOf(i) === 3), "this chapter only");
assert.ok(pc.switches.length <= PRACTICE.switches && pc.say.length <= PRACTICE.say && !!pc.scenario);
const pa = end.practice.all;
const allWords = pa.items.filter((i) => i.kind !== "grammar");
assert.equal(allWords.length, PRACTICE.words);
const per = new Map<number, number>();
for (const w of allWords) per.set(orderOf(w)!, (per.get(orderOf(w)!) ?? 0) + 1);
assert.ok(per.size >= 3 && [...per.values()].every((n) => n <= PRACTICE_PER_CHAPTER), `everything so far spans the chapters: ${[...per.entries()].join(" ")}`);
assert.ok(pa.items.filter((i) => i.kind === "grammar").every((i) => seen[(i.meta as { point: string }).point]), "grammar cards only from points you've been taught");

// 5. What you missed at your last go leads the next practice round.
const missedWord = cpWords.find((i) => orderOf(i) === 3)!;
const after = chapterEndStep(pack, recordCards(learner, ch3.chapterId, { got: 3, total: 10 }, [missedWord.id]), ch3, chapter);
assert.equal(after.practice.chapter.items[0]!.id, missedWord.id, "the missed word comes first");

// 6. Rough times.
assert.equal(roundMinutes({ cards: 29, switches: 2, say: 3, conversation: true }), 20);
assert.equal(roundMinutes({ cards: 10, switches: 1, say: 1, conversation: false }), 5);
assert.equal(roundMinutes({ cards: 0, switches: 0, say: 0, conversation: true }), 5);
console.log("checkpoint.test.ts: all assertions passed ✓");
