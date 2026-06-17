// Runnable check for the live-conversation turn machine. Run with:
//   npx tsx packages/core/test/live.test.ts
import assert from "node:assert/strict";
import type { Scenario } from "@ll/pack-schema";
import { startLive, assignLiveRoles, assignLiveRolesStable, roleOf, currentTurn, isMyTurn, speakTurn, setTurnScore, isComplete, progress } from "../src/live/index.js";

const A = "user-a";
const B = "user-b";

// Stable roles are ORDER-INDEPENDENT: whoever creates the session first, both partners resolve to the
// SAME assignment — so two simultaneous "starts" can never both make themselves the learner (the bug).
const stableAB = assignLiveRolesStable(A, B);
const stableBA = assignLiveRolesStable(B, A);
assert.deepEqual(stableAB, stableBA, "role assignment must not depend on argument order");
assert.equal(Object.values(stableAB).filter((r) => r === "learner").length, 1, "exactly one learner");
assert.equal(Object.values(stableAB).filter((r) => r === "partner").length, 1, "exactly one partner");

const scenario: Scenario = {
  id: "cafe-1",
  title: "Order a coffee",
  goal: "order a drink",
  setting: "café",
  requiredVocab: [],
  requiredStructures: [],
  script: [
    { speaker: "learner", text: "Здраво", gloss: "Hi" },
    { speaker: "partner", text: "Повелете?", gloss: "What would you like?" },
    { speaker: "learner", text: "Едно кафе", gloss: "One coffee" },
  ],
  successCriteria: [],
  confidence: "authored",
};

const assignment = assignLiveRoles(A, B);
assert.deepEqual(assignment, { [A]: "learner", [B]: "partner" });

const s0 = startLive("live-1", "mk", scenario, assignment);
assert.equal(s0.status, "active");
assert.equal(s0.turnIndex, 0);
assert.equal(currentTurn(s0)!.text, "Здраво");
assert.equal(roleOf(s0, A), "learner");

// turn 0 is the learner's (A's) turn
assert.equal(isMyTurn(s0, A), true);
assert.equal(isMyTurn(s0, B), false);

// B can't speak out of turn
assert.throws(() => speakTurn(s0, B, "x", 50), /not your turn/);

// A speaks turn 0 → advance to turn 1 (partner / B)
const s1 = speakTurn(s0, A, "Здраво", 95);
assert.equal(s1.turnIndex, 1);
assert.equal(s1.turns[0]!.spokenBy, A);
assert.equal(s1.turns[0]!.score, 95);
assert.equal(isMyTurn(s1, B), true);
assert.equal(isMyTurn(s1, A), false);
assert.deepEqual(progress(s1), { done: 1, total: 3 });

// B speaks turn 1, A speaks turn 2 → complete
const s2 = speakTurn(s1, B, "Повелете?", 88);
const s3 = speakTurn(s2, A, "Едно кафе", 90);
assert.equal(s3.status, "complete");
assert.equal(isComplete(s3), true);
assert.equal(currentTurn(s3), undefined);
assert.deepEqual(progress(s3), { done: 3, total: 3 });

// Advance-then-backfill: a turn can be spoken with NO score (conversation flows on ASR), then the slower
// coaching backfills the score off the critical path.
const p0 = speakTurn(s0, A, "Здраво");
assert.equal(p0.turnIndex, 1, "advanced without a score");
assert.equal(p0.turns[0]!.spokenBy, A);
assert.equal(p0.turns[0]!.score, undefined, "score pending until coaching lands");
const p1 = setTurnScore(p0, 0, 92);
assert.equal(p1.turns[0]!.score, 92, "score backfilled onto the right turn");
assert.equal(p1.turnIndex, 1, "backfilling a score does not move the turn pointer");

console.log("✓ live conversation turn machine: all assertions passed");
