// Runnable check for the live-conversation turn machine. Run with:
//   npx tsx packages/core/test/live.test.ts
import assert from "node:assert/strict";
import type { Scenario } from "@ll/pack-schema";
import { startLive, assignLiveRoles, roleOf, currentTurn, isMyTurn, speakTurn, isComplete, progress } from "../src/live/index.js";

const A = "user-a";
const B = "user-b";

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

console.log("✓ live conversation turn machine: all assertions passed");
