// Runnable checks for how a recall card is graded once answered (2026-11-20: in a checkpoint, "Show answer"
// then "Got it" counted as right, and a wrong typed word could be passed the same way).
//   Run with: npx tsx apps/web/test/answer-check.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterAnswer, typedMatches } from "../lib/answer-check.js";

// The typing check: Cyrillic or Latin, case and punctuation aside, marks and digraphs optional.
assert.ok(typedMatches("кафе", "кафе"));
assert.ok(typedMatches("Kafe!", "кафе"));
assert.ok(typedMatches("zhena", "жена"));
assert.ok(typedMatches("žena", "жена"));
assert.ok(typedMatches("zena", "жена"), "no digraph needed");
assert.ok(typedMatches("kukja", "куќа"));
assert.ok(typedMatches("kuka", "куќа"));
assert.ok(typedMatches("moyot", "мојот"));
assert.ok(typedMatches("mojot", "мојот"));
assert.ok(!typedMatches("caj", "кафе"), "a different word is a miss");
assert.ok(!typedMatches("kaf", "кафе"), "part of the word is a miss");
assert.ok(!typedMatches("...", "кафе"), "nothing typed is a miss");

// Typed: the check decides, in a checkpoint and out of one. Nothing to self-grade.
assert.deepEqual(afterAnswer("sakam", "сакам", true), { kind: "marked", ok: true });
assert.deepEqual(afterAnswer("imam", "сакам", true), { kind: "marked", ok: false });
assert.deepEqual(afterAnswer("imam", "сакам", false), { kind: "marked", ok: false });
// Looked without typing: a miss in a checkpoint; elsewhere you say whether you had it.
assert.deepEqual(afterAnswer(null, "сакам", true), { kind: "miss" });
assert.deepEqual(afterAnswer(null, "сакам", false), { kind: "ask" });

// The cards use it, and no button says "Got it" or "Good" after a look any more.
const cards = readFileSync(new URL("../features/flashcards/Cards.tsx", import.meta.url), "utf8");
assert.match(cards, /afterAnswer\(typedVal/, "word and phrase cards are graded by afterAnswer");
assert.doesNotMatch(cards, /GradeRow|"Got it"|"Good"/, "no self-grade row that reads as 'carry on'");
assert.match(cards, /Did you have it before you looked\?/);
// The checkpoint turns it on (WarmupSession without second goes).
const warm = readFileSync(new URL("../features/today/Warmup.tsx", import.meta.url), "utf8");
assert.match(warm, /requeue \? card : <CheckpointCards\.Provider value>/);
const checkpoint = readFileSync(new URL("../features/today/Checkpoint.tsx", import.meta.url), "utf8");
assert.match(checkpoint, /<WarmupSession[^>]*requeue=\{false\}/, "the checkpoint's cards run without second goes");
console.log("answer-check.test.ts: all assertions passed ✓");
