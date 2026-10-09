// Runnable checks for the shared partnered session (@ll/core/partner/session) and its grammar step
// (@ll/core/partner/grammar-together).
//   Run with: npx tsx packages/core/test/joint-session.test.ts
import assert from "node:assert/strict";
import { advance, finish, joinState, startJointSession, stepOf, type JointSessionRefs } from "../src/partner/session.js";
import { currentTurn, doneReading, judge, pick, score, shuffleOptions, startGrammarTogether } from "../src/partner/grammar-together.js";

const A = "user-a", B = "user-b";
const full: JointSessionRefs = { drillRowId: "d", drillCount: 6, pointId: "pt", grammarRowId: "g", storyId: "st", storyLines: [1], storyRowId: "s", framing: "f" };

// 1. A full session walks warm-up → grammar → story → recap; members sorted; starter recorded.
let s = startJointSession("j1", "mk", "2026-10-09", B, A, B, full);
assert.deepEqual(s.members, [A, B]);
assert.equal(s.startedBy, B);
assert.equal(s.phase, "warmup");
assert.equal(stepOf(s.phase), 1);
s = advance(s, "warmup", "done");
assert.equal(s.phase, "grammar");
// Idempotent: both partners tap "Skip" on the warm-up → still only one section moved.
assert.equal(advance(s, "warmup", "skipped").phase, "grammar");
s = advance(s, "grammar", "skipped");
assert.equal(s.phase, "story");
s = advance(s, "story", "done");
assert.equal(s.phase, "recap");
assert.equal(stepOf(s.phase), 4);
assert.deepEqual(s.outcomes, { warmup: "done", grammar: "skipped", story: "done" });
s = finish(s);
assert.equal(s.status, "complete");
assert.equal(advance(s, "story", "done"), s, "a finished session doesn't move");

// 2. Sections with nothing to share are passed over as "empty".
let e = startJointSession("j2", "mk", "2026-10-09", A, B, A, { ...full, drillCount: 0 });
assert.equal(e.phase, "grammar");
assert.equal(e.outcomes.warmup, "empty");
e = advance(e, "grammar", "done");
assert.equal(e.phase, "story");
const none = startJointSession("j3", "mk", "2026-10-09", A, B, A, { storyLines: [], drillCount: 0, framing: "" });
assert.equal(none.phase, "recap");

// 3. The landing's button: start / join your partner's / pick yours back up / done — today only.
const today = "2026-10-09";
assert.equal(joinState(undefined, A, today), "none");
assert.equal(joinState(startJointSession("x", "mk", today, A, B, B, full), A, today), "join");
assert.equal(joinState(startJointSession("x", "mk", today, A, B, A, full), A, today), "resume");
assert.equal(joinState(startJointSession("x", "mk", "2026-08-21", A, B, B, full), A, today), "none", "yesterday's (or August's) session never offers Join");
assert.equal(joinState(finish(startJointSession("x", "mk", today, A, B, B, full)), A, today), "done");

// 4. Grammar together: read the rule → a rule question (asker judges) → gaps (answerer taps).
let g = startGrammarTogether("g1", "mk", "pt-sum", B, A, [
  { kind: "read" },
  { kind: "rule", question: "Can сум start a sentence?", answer: "No." },
  { kind: "blank", line: "Марко е доктор.", gloss: "Marko is a doctor.", answer: "е", options: ["е", "си", "сум"], why: "he → е" },
  { kind: "blank", line: "Ние сме тука", gloss: "We are here", answer: "сме", options: ["сте", "се"], why: "ние → сме" },
]);
assert.deepEqual(g.members, [A, B]);
assert.equal(currentTurn(g)!.asker, A, "turn 0: A reads the rule");
assert.throws(() => doneReading(g, B), /not your turn/);
g = doneReading(g, A);
assert.equal(currentTurn(g)!.kind, "rule");
assert.equal(currentTurn(g)!.answerer, B, "the first rule question goes to the one who listened");
assert.throws(() => judge(g, B, true), /not your turn/, "only the one holding the answer judges");
g = judge(g, A, true);
const t2 = currentTurn(g)!;
assert.equal(t2.kind, "blank");
assert.equal(t2.answerer, A, "the first fill-in goes to the reader");
assert.throws(() => pick(g, B, "е"), /not your turn/, "only the answerer taps");
g = pick(g, A, "си");
assert.equal(g.turns[2]!.result, "missed");
assert.equal(g.turns[2]!.choice, "си");
const t3 = currentTurn(g)!;
assert.ok(t3.kind === "blank" && t3.options.includes("сме"), "the answer is always among the options");
assert.equal(t3.answerer, B, "fill-ins alternate between the two of you");
g = pick(g, t3.answerer, "сме");
assert.equal(g.status, "complete");
assert.deepEqual(score(g), { got: 2, done: 3, total: 3 }, "the read turn isn't scored");

// 5. Options are shuffled the same way on both screens (seeded by the line), and keep every option once.
assert.deepEqual(shuffleOptions(["е", "си", "сум"], "Марко е доктор."), shuffleOptions(["е", "си", "сум"], "Марко е доктор."));
assert.deepEqual([...shuffleOptions(["е", "си", "сум", "е"], "x")].sort(), ["е", "си", "сум"]);

// 6. Over a longer quiz each partner answers half of each kind.
const long = startGrammarTogether("g2", "mk", "pt", A, B, [
  { kind: "read" },
  ...[1, 2, 3, 4].flatMap((i): Parameters<typeof startGrammarTogether>[5] => [
    { kind: "rule", question: `q${i}`, answer: "a" },
    { kind: "blank", line: `line ${i}`, gloss: "", answer: "x", options: ["x", "y"], why: "" },
  ]),
]);
for (const kind of ["rule", "blank"] as const) {
  const ts = long.turns.filter((t) => t.kind === kind);
  assert.equal(ts.filter((t) => t.answerer === A).length, ts.length / 2, `${kind}: half each`);
}

console.log("joint-session.test.ts: all assertions passed ✓");
