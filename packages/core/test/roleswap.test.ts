// Runnable check for the role-swap session logic. Run with:
//   npx tsx packages/core/test/roleswap.test.ts
import assert from "node:assert/strict";
import type { Scenario } from "@ll/pack-schema";
import { startRoleSwap, assignRoles, myTurns, nextOpenTurn, recordTurn, attachFeedback, isStitchable, progress } from "../src/roleswap/index.js";
import type { SpeakingFeedback } from "../src/speaking/index.js";

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
    { speaker: "partner", text: "Здраво, повелете?", gloss: "Hi, what would you like?" },
    { speaker: "learner", text: "Едно кафе, ве молам", gloss: "One coffee, please" },
  ],
  successCriteria: [],
  confidence: "authored",
};

const assignment = assignRoles(A, B);
assert.deepEqual(assignment, { [A]: "learner", [B]: "partner" });

const s0 = startRoleSwap("sess-1", "mk", scenario, assignment);
assert.equal(s0.status, "recording");
assert.equal(s0.turns.length, 3);
assert.deepEqual(s0.turns.map((t) => t.speaker), ["learner", "partner", "learner"]);
assert.equal(s0.turns[0]!.text, "Здраво");

// who owes what
assert.deepEqual(myTurns(s0, A).map((t) => t.index), [0, 2]);
assert.deepEqual(myTurns(s0, B).map((t) => t.index), [1]);
assert.equal(nextOpenTurn(s0, A)!.index, 0);
assert.equal(nextOpenTurn(s0, B)!.index, 1);

// A records turn 0
const s1 = recordTurn(s0, 0, A, "data:audio/webm;base64,AAA", { scribe: "Здраво", google: "Здраво" });
assert.equal(s1.turns[0]!.recordedBy, A);
assert.equal(s1.turns[0]!.audio, "data:audio/webm;base64,AAA");
assert.equal(nextOpenTurn(s1, A)!.index, 2, "A's next open line is turn 2");
assert.equal(s1.status, "recording");

// guard: A cannot record B's line (turn 1 is the 'partner' role)
assert.throws(() => recordTurn(s1, 1, A, "x", {}), /own role/, "A must not record the partner's line");

// progress
assert.deepEqual(progress(s1, A).mine, { done: 1, total: 2 });
assert.deepEqual(progress(s1, A).overall, { done: 1, total: 3 });

// finish it: A records turn 2, B records turn 1
const s2 = recordTurn(s1, 2, A, "data:audio/webm;base64,CCC", {});
const s3 = recordTurn(s2, 1, B, "data:audio/webm;base64,BBB", { scribe: "Здраво, повелете?" });
assert.equal(s3.status, "complete", "all lines recorded ⇒ complete");
assert.equal(isStitchable(s3), true);
assert.equal(nextOpenTurn(s3, A), undefined);

// feedback attaches to a turn
const fb = { overall: "Clear!", words: [], pronunciation: "", stress: "", tip: "", asrCaveat: { likelyAsrError: false, explanation: "" }, score: 90 } as SpeakingFeedback;
const s4 = attachFeedback(s3, 0, fb);
assert.equal(s4.turns[0]!.feedback!.score, 90);
assert.equal(s4.turns[1]!.feedback, undefined);

console.log("✓ roleswap session logic: all assertions passed");
