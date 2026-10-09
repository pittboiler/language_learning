// Runnable checks for exam marking's pure parts (@ll/core/exam): the roll-up of task results into can-do
// results, the self-check grade, and the prompt carrying everything the marker needs.
//   Run with: npx tsx packages/core/test/exam.test.ts
import assert from "node:assert/strict";
import { combineResults, selfCheckGrade, taskPrompt } from "../src/exam/index.js";

// 1. Roll-up: met only if every task that assessed it met it; not-yet only if none did.
const r = combineResults([
  { canDos: [{ id: "a", result: "met", note: "" }, { id: "b", result: "met", note: "" }, { id: "c", result: "not-yet", note: "" }] },
  { canDos: [{ id: "a", result: "met", note: "" }, { id: "b", result: "partly", note: "" }, { id: "c", result: "not-yet", note: "" }] },
  { canDos: [{ id: "d", result: "not-yet", note: "" }, { id: "b", result: "not-yet", note: "" }] },
]);
assert.deepEqual(r, { a: "met", b: "partly", c: "not-yet", d: "not-yet" });
assert.ok(!("e" in r), "a can-do no task assessed is absent, not failed");

// 2. Self-check: the steps the learner says they got across set the task's can-dos.
assert.equal(selfCheckGrade(["yes", "yes", "yes", "partly"], ["x"]).canDos[0]!.result, "met");
assert.equal(selfCheckGrade(["yes", "no", "partly", "no"], ["x"]).canDos[0]!.result, "partly");
assert.equal(selfCheckGrade(["no", "no", "partly", "no"], ["x", "y"]).canDos.map((c) => c.result).join(), "not-yet,not-yet");

// 3. The marker sees the situation, every step (indexed), the can-dos, the grammar and BOTH transcripts.
const p = taskPrompt({
  languageName: "Macedonian", mode: "speak", title: "Order and pay", scene: "At a café.",
  steps: ["Order two drinks", "Ask the price"], canDos: [{ id: "m-cafe", text: "Order at a café" }],
  grammar: ["Saying “the”: it goes on the end"], response: "", transcripts: { scribe: "Две кафиња", google: "две кафиња ве молам" },
});
for (const want of ["At a café.", "0. Order two drinks", "1. Ask the price", "m-cafe", "Saying “the”", "Две кафиња", "две кафиња ве молам"]) assert.ok(p.includes(want), want);

console.log("exam.test.ts: all assertions passed ✓");
