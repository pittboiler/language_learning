// Runnable check for the info-gap session logic. Run with:
//   npx tsx packages/core/test/infogap.test.ts
import assert from "node:assert/strict";
import type { InfoGapTask } from "@ll/pack-schema";
import { startInfoGap, briefFor, roleOf, markMet, toggleCriterion, isComplete, progress } from "../src/infogap/index.js";

const task: InfoGapTask = {
  id: "gap-1",
  title: "Order at the café",
  goal: "order + agree the total",
  setting: "café",
  roleA: { role: "A", brief: "customer", secretInfo: ["you want 2 coffees"], targetPhrases: [{ text: "Сакам кафе", gloss: "I want coffee" }] },
  roleB: { role: "B", brief: "waiter", secretInfo: ["coffee is 60"], targetPhrases: [{ text: "Повелете?", gloss: "What would you like?" }] },
  successCriteria: [
    { id: "order", description: "order said" },
    { id: "prices", description: "prices given" },
  ],
  confidence: "authored",
};

const A = "user-a";
const B = "user-b";

const s0 = startInfoGap("sess-1", "mk", task, { [A]: "A", [B]: "B" });
assert.equal(s0.status, "open");
assert.deepEqual(s0.metCriteria, []);
assert.equal(roleOf(s0, A), "A");
assert.equal(roleOf(s0, B), "B");

// asymmetry: each role sees only their half
assert.equal(briefFor(task, "A").brief, "customer");
assert.deepEqual(briefFor(task, "A").secretInfo, ["you want 2 coffees"]);
assert.deepEqual(briefFor(task, "B").secretInfo, ["coffee is 60"]);
assert.notDeepEqual(briefFor(task, "A").secretInfo, briefFor(task, "B").secretInfo);

// tick one criterion → still open
const s1 = toggleCriterion(s0, task, "order");
assert.deepEqual(s1.metCriteria, ["order"]);
assert.equal(s1.status, "open");
assert.deepEqual(progress(s1, task), { met: 1, total: 2 });

// untick is idempotent toggle
assert.deepEqual(toggleCriterion(s1, task, "order").metCriteria, []);

// meeting all criteria → complete
const s2 = markMet(s1, task, ["prices"]);
assert.equal(isComplete(s2, task), true);
assert.equal(s2.status, "complete");
assert.deepEqual(progress(s2, task), { met: 2, total: 2 });

// markMet is an idempotent union
assert.deepEqual(markMet(s2, task, ["order"]).metCriteria.sort(), ["order", "prices"]);

console.log("✓ infogap session logic: all assertions passed");
