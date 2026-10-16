// Runnable check for the guided conversation — run with: npx tsx packages/core/test/guided.test.ts
// Turns alternate (answer the last line, then say the next cue), each member writes only their own row, the
// transcript is pieced together in turn order, and the review goes fix by fix: the one who made the mistake
// says it, the other says "Got it". Solo: the AI's turns are scripted and the learner judges their own fixes.
import assert from "node:assert/strict";
import type { GuidedCue } from "@ll/pack-schema";
import * as g from "../src/partner/guided.js";
import { finalizeReview, conversationPrompt, type ConversationInput } from "../src/coach/index.js";

const cue = (n: number): GuidedCue => ({ id: `c${n}`, en: `Ask {partner} thing ${n}.`, answer: `A${n}`, answerGloss: `a${n}`, replyEn: `about ${n}`, sampleReply: `R${n}`, sampleReplyGloss: `r${n}` });
const J = "jake", M = "madison";
const s = g.startGuided({ id: "s1", packId: "mk", members: [J, M], names: { [J]: "Jake", [M]: "Madison" }, cues: [cue(1), cue(2), cue(3)], startedAt: "2026-10-16T10:00:00Z" });
let rj = g.emptyRow("s1", J), rm = g.emptyRow("s1", M);
const rows = () => [rj, rm];

// Turns: 3 cues → 4 turns; Jake starts; turn 2 answers cue 1 and asks cue 2; the last only answers.
assert.equal(g.turnCount(s), 4);
assert.deepEqual([1, 2, 3, 4].map((t) => g.speakerOf(s, t)), [J, M, J, M]);
assert.deepEqual(g.turnSpec(s, 2), { turn: 2, speaker: M, answers: s.cues[0], asks: s.cues[1] });
assert.equal(g.turnSpec(s, 4).asks, undefined);
assert.equal(g.cueText(s, s.cues[0]!, J), "Ask Madison thing 1.");
assert.equal(g.phase(s, rows()), "talk");

// Only the one whose turn it is can end it.
assert.throws(() => g.endTurn(s, rows(), rm, { at: "t1" }), /not your turn/);
rj = g.endTurn(s, rows(), rj, { at: "t1" }).row;
assert.equal(g.nextTurn(s, rows()), 2);
rm = g.endTurn(s, rows(), rm, { at: "t2" }).row;
rj = g.endTurn(s, rows(), rj, { at: "t3", skipped: true }).row;
// A stray segment in the wrong row (a stale write) is ignored.
const stray = { ...rj, segments: [...rj.segments, { turn: 4, at: "x", text: "not mine" }] };
assert.equal(g.segments(s, [stray, rm]).has(4), false);
rm = g.endTurn(s, rows(), rm, { at: "t4" }).row;
assert.throws(() => g.endTurn(s, rows(), rj, { at: "t5" }), /over/);

// Talk is done, but turns 1, 2 and 4 are still being transcribed (turn 3 was skipped).
assert.equal(g.phase(s, rows()), "transcribing");
rj = g.addTranscripts(rj, 1, { scribe: "Каде живееш?", google: "каде живееш" });
rm = g.addTranscripts(rm, 2, { scribe: "Живеам во Скопје. Што работиш?" });
rm = g.addTranscripts(rm, 4, { scribe: "Да." });
assert.equal(g.phase(s, rows()), "reviewing");
assert.equal(g.reviewer(s), J);

// The transcript for the coach: in turn order, with what each turn answers and asks.
const tr = g.transcript(s, rows());
assert.deepEqual(tr.map((t) => [t.turn, t.speakerId, !!t.answers, !!t.asks, !!t.skipped]), [[1, J, false, true, false], [2, M, true, true, false], [3, J, true, true, true], [4, M, true, false, false]]);
assert.equal(tr[1]!.asks!.en, "Ask Jake thing 2.");

// The coach's answer is clamped: a fix on the wrong speaker's turn, a non-fix, and a fix on a skipped turn go.
const input: ConversationInput = { languageName: "Macedonian", register: "ти", speakers: [{ id: J, name: "Jake", taughtWords: [], taughtGrammar: [] }, { id: M, name: "Madison", taughtWords: [], taughtGrammar: [] }], turns: tr, maxFixes: 4 };
const review = finalizeReview(input, {
  turns: [{ turn: 1, askOk: "yes", answered: "yes", unclear: false }, { turn: 2, askOk: "partly", answered: "yes", unclear: false }],
  fixes: [
    { turn: 2, speakerId: M, said: "Што работиш?", better: "Што работиш ти?", betterEn: "", why: "m1", kind: "word" },
    { turn: 2, speakerId: M, said: "Живеам во Скопје.", better: "Живеам во Скопје", betterEn: "", why: "same", kind: "grammar" },
    { turn: 1, speakerId: M, said: "x", better: "y", betterEn: "", why: "wrong speaker", kind: "grammar" },
    { turn: 3, speakerId: J, said: "x", better: "y", betterEn: "", why: "skipped turn", kind: "grammar" },
    { turn: 1, speakerId: J, said: "Каде живееш?", better: "Каде живееш ти?", betterEn: "", why: "j1", kind: "word" },
    { turn: 2, speakerId: M, said: "a", better: "b", betterEn: "", why: "m2", kind: "grammar" },
    { turn: 4, speakerId: M, said: "c", better: "d", betterEn: "", why: "m3 (over the per-speaker cap)", kind: "grammar" },
  ],
  highlights: [{ speakerId: J, text: "good" }, { speakerId: "nobody", text: "x" }],
});
assert.deepEqual(review.fixes.map((f) => f.why), ["j1", "m1", "m2"], "alternating, the first speaker first; capped at 2 each");
assert.equal(review.turns.find((t) => t.turn === 1)!.answered, "n/a", "the first turn answers nothing");
assert.deepEqual(review.highlights.map((h) => h.speakerId), [J]);
assert.ok(conversationPrompt(input).includes("Turn 3") && conversationPrompt(input).includes("(skipped this one)"));

// The review together: Jake's fix first; Madison says "Got it"; Jake can't judge his own; then Madison's fixes.
const sr = g.withReview(s, review);
assert.equal(g.phase(sr, rows()), "review");
assert.equal(g.currentFix(sr, rows())!.speakerId, J);
assert.throws(() => g.judgeFix(sr, rows(), rj, true), /not yours/);
rm = g.judgeFix(sr, rows(), rm, true);
assert.equal(g.currentFix(sr, rows())!.why, "m1");
assert.throws(() => g.dismissFix(sr, rows(), rj), /only the one/);
rm = g.dismissFix(sr, rows(), rm); // "That's not what I said"
rj = g.judgeFix(sr, rows(), rj, false);
assert.equal(g.phase(sr, rows()), "done");
assert.deepEqual(g.reviewScore(sr, rows()), { turns: 4, asks: 2, asksRight: 1, fixes: 3, got: 1, dismissed: 1 });
assert.deepEqual(g.keptFixes(sr, rows(), M).map((f) => f.why), ["m2"], "a dropped fix isn't kept");

// Solo: the AI's turns are its scripted lines (never corrected), and the learner judges their own fixes.
const solo = g.startGuided({ id: "s2", packId: "mk", members: [J, g.AI_MEMBER], names: { [J]: "Jake", [g.AI_MEMBER]: "Ана" }, cues: [cue(1), cue(2)], startedAt: "x" });
let me = g.emptyRow("s2", J), ai = g.emptyRow("s2", g.AI_MEMBER);
me = g.endTurn(solo, [me, ai], me, { at: "1", transcripts: { scribe: "A1" } }).row;
ai = g.endTurn(solo, [me, ai], ai, { at: "2", text: "R1 A2" }).row;
me = g.endTurn(solo, [me, ai], me, { at: "3", transcripts: { scribe: "R2" } }).row;
assert.equal(g.phase(solo, [me, ai]), "reviewing");
assert.equal(g.transcript(solo, [me, ai])[1]!.ai, true);
assert.equal(g.cueText(solo, solo.cues[0]!, J), "Ask Ана thing 1.");
assert.deepEqual(g.aiLine(solo, 2), { text: "R1 A2", gloss: "r1 a2" }, "the AI answers the last cue, then says the next");
assert.deepEqual(g.aiLine(solo, 3), { text: "R2", gloss: "r2" }, "the last turn only answers");
const soloReview = g.withReview(solo, { turns: [], fixes: [{ id: "f", turn: 1, speakerId: J, said: "x", better: "y", betterEn: "", why: "", kind: "grammar" }], highlights: [] });
assert.equal(g.checkerOf(soloReview, soloReview.review!.fixes[0]!), J);
me = g.judgeFix(soloReview, [me, ai], me, true);
assert.equal(g.phase(soloReview, [me, ai]), "done");

console.log("guided.test.ts: all assertions passed");
