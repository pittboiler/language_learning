// Runnable check for the "Read it together" turn logic. Run with:
//   npx tsx packages/core/test/story-together.test.ts
import assert from "node:assert/strict";
import { startStoryTogether, currentTurn, isMyTurnToRead, isMyTurnToCheck, checkTurn, isComplete, score, type StoryLine } from "../src/story-together/index.js";

const A = "u-a";
const B = "u-b";
const lines: StoryLine[] = [
  { text: "Марко влезе во кафето.", gloss: "Marko entered the café." },
  { text: "„Едно кафе, ве молам.“", gloss: "\"One coffee, please.\"" },
  { text: "Келнерот се насмевна.", gloss: "The waiter smiled." },
];

// pass members out of order — startStoryTogether sorts them, so both clients converge
const s0 = startStoryTogether("st1", "mk", "story-1", B, A, lines);
assert.deepEqual(s0.members, [A, B], "members stored sorted regardless of arg order");
assert.equal(s0.status, "active");
assert.equal(s0.turns.length, 3);

// --- roles alternate per line ---
assert.equal(s0.turns[0]!.reader, A, "line 0: A reads");
assert.equal(s0.turns[0]!.checker, B, "line 0: B checks");
assert.equal(s0.turns[1]!.reader, B, "line 1: roles flip → B reads");
assert.equal(s0.turns[1]!.checker, A);
assert.equal(s0.turns[2]!.reader, A);
assert.ok(s0.turns.every((t) => t.reader !== t.checker), "reader and checker are always distinct");
// the checker holds the gloss to validate against
assert.equal(s0.turns[0]!.gloss, "Marko entered the café.");

// --- turn guards ---
const t0 = currentTurn(s0)!;
assert.equal(isMyTurnToRead(s0, A), true);
assert.equal(isMyTurnToCheck(s0, B), true);
assert.equal(isMyTurnToRead(s0, B), false);
assert.throws(() => checkTurn(s0, t0.reader, true), /not your turn to check/, "the reader cannot resolve their own line");

// --- walk the story: got, missed, got ---
let s = checkTurn(s0, A === t0.checker ? A : B, true); // B checks line 0
assert.equal(s.turnIndex, 1, "resolving advances the pointer");
assert.equal(currentTurn(s)!.reader, B, "now B reads line 1");
s = checkTurn(s, currentTurn(s)!.checker, false); // A checks line 1 → missed
s = checkTurn(s, currentTurn(s)!.checker, true); // B checks line 2 → got
assert.equal(s.status, "complete");
assert.equal(isComplete(s), true);
assert.deepEqual(score(s), { got: 2, done: 3, total: 3 }, "score counts meanings got vs lines resolved");

// --- empty story ⇒ immediately complete ---
const empty = startStoryTogether("st0", "mk", "story-0", A, B, []);
assert.equal(empty.status, "complete");
assert.equal(isComplete(empty), true);

console.log("story-together.test.ts: all assertions passed");
