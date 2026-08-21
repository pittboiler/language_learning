// Runnable check for the v2 Together-session turn logic (no test harness — run with:
//   npx tsx packages/core/test/together.test.ts   or   node --import tsx --test test/together.test.ts
// Pure logic only: queue construction (shared-gap selection + flipping roles) and the check/advance loop.
import assert from "node:assert/strict";
import { buildQueue, startTogether, checkTurn, currentTurn, isMyTurnToProduce, isMyTurnToCheck, isComplete, score, type TogetherCandidate } from "../src/together/index.js";
import type { FamiliarityProjection } from "../src/partner/familiarity-diff.js";

const A = "u-a";
const B = "u-b";
const members: [string, string] = [A, B]; // already sorted

const proj = (entries: FamiliarityProjection["entries"]): FamiliarityProjection => ({ packId: "mk", entries });

const cands: TogetherCandidate[] = [
  { lexKey: "leb", prompt: "bread", answer: "леб" },
  { lexKey: "voda", prompt: "water", answer: "вода" },
  { lexKey: "kafe", prompt: "coffee", answer: "кафе" },
  { lexKey: "maka", prompt: "known-by-both", answer: "мака" },
  { lexKey: "solo", prompt: "only-A-studied", answer: "соло" },
  { lexKey: "nov", prompt: "never-studied", answer: "нов" },
];

// Both are LEARNING leb/voda (studied, weak). A knows kafe strongly; B is learning it. Both KNOW maka
// (excluded). Only A has studied `solo` (B ahead-word — must be excluded so B is never drilled on it).
// NEITHER has studied nov (must be excluded — the queue never drills a word cold).
const projA = proj({
  leb: { status: "learning", strength: 0.1 },
  voda: { status: "learning", strength: 0.1 },
  kafe: { status: "known", strength: 0.9 },
  maka: { status: "known", strength: 0.95 },
  solo: { status: "learning", strength: 0.2 },
});
const projB = proj({
  leb: { status: "learning", strength: 0.1 },
  voda: { status: "learning", strength: 0.1 },
  kafe: { status: "learning", strength: 0.15 },
  maka: { status: "known", strength: 0.95 },
});

const q = buildQueue(members, [projA, projB], cands);

// --- selection ---
assert.ok(!q.some((t) => t.lexKey === "maka"), "an item both partners already know is excluded");
assert.ok(!q.some((t) => t.lexKey === "solo"), "a word only ONE partner has studied is excluded (never drill the other on it)");
assert.ok(!q.some((t) => t.lexKey === "nov"), "a word neither partner has studied is excluded (no cold drills)");
assert.equal(q.length, 3, "the three still-needed, both-studied items are queued");
// both-need items (leb, voda) lead; the one-needs item (kafe) trails.
assert.deepEqual(q.slice(0, 2).map((t) => t.lexKey).sort(), ["leb", "voda"], "both-need items come first");
assert.equal(q[2]!.lexKey, "kafe", "the one-needs item trails");

// --- roles ---
// kafe: A is more familiar (0.9 vs 0) ⇒ A checks, B produces (B gets the retrieval).
const kafeTurn = q.find((t) => t.lexKey === "kafe")!;
assert.equal(kafeTurn.checker, A, "the more-familiar member checks");
assert.equal(kafeTurn.producer, B, "the less-familiar member produces");

// leb/voda: both strength 0 (tie) ⇒ roles alternate by position.
assert.notEqual(q[0]!.producer, q[1]!.producer, "tied items alternate the producer role");
assert.ok(q.every((t) => t.producer !== t.checker), "producer and checker are always distinct");

// --- limit --- (both partners are learning all 30, so all are in play; the cap trims to 12)
const many: TogetherCandidate[] = Array.from({ length: 30 }, (_, i) => ({ lexKey: `w${i}`, prompt: `p${i}`, answer: `a${i}` }));
const manyProj = proj(Object.fromEntries(many.map((c) => [c.lexKey, { status: "learning" as const, strength: 0.1 }])));
assert.equal(buildQueue(members, [manyProj, manyProj], many, { limit: 12 }).length, 12, "queue respects the limit");

// --- check / advance loop ---
let s = startTogether("sess1", "mk", B, A, q); // pass members out of order — startTogether sorts them
assert.deepEqual(s.members, [A, B], "members are stored sorted regardless of arg order");
assert.equal(s.status, "active");

const t0 = currentTurn(s)!;
// only the checker may resolve the turn
assert.throws(() => checkTurn(s, t0.producer, true), /not your turn to check/, "the producer cannot check");
assert.equal(isMyTurnToProduce(s, t0.producer), true);
assert.equal(isMyTurnToCheck(s, t0.checker), true);

// walk the whole session: first got, rest missed
s = checkTurn(s, t0.checker, true);
assert.equal(s.turnIndex, 1, "resolving advances the pointer");
while (!isComplete(s)) {
  const t = currentTurn(s)!;
  s = checkTurn(s, t.checker, false);
}
assert.equal(s.status, "complete");
const sc = score(s);
assert.deepEqual(sc, { got: 1, done: 3, total: 3 }, "collaborative score counts got vs total resolved");

// --- empty queue ⇒ immediately complete ---
const empty = startTogether("s0", "mk", A, B, []);
assert.equal(empty.status, "complete");
assert.equal(isComplete(empty), true);

console.log("together.test.ts: all assertions passed");
