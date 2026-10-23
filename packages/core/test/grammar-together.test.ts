// Runnable check for the partnered grammar turns — run with: npx tsx packages/core/test/grammar-together.test.ts
// Person ping-pong: the asker holds the answer and judges; the roles take turns; a fill-in is still tapped.
import assert from "node:assert/strict";
import { startGrammarTogether, currentTurn, judge, pick, readForm, score, type GrammarItem } from "../src/partner/grammar-together.js";

const A = "u-a";
const B = "u-b";
const sw = (n: number): GrammarItem => ({ kind: "switch", line: `L${n}`, gloss: `g${n}`, pronoun: "тие", personEn: "they", answer: `A${n}`, why: "тие (they) → …" });
const blank: GrammarItem = { kind: "blank", line: "Јас сум Ана.", gloss: "I am Ana.", answer: "сум", options: ["си", "е"], why: "јас → сум" };

let s = startGrammarTogether("g1", "mk", "pt-sum", B, A, [sw(0), sw(1), blank, sw(2)]);
assert.deepEqual(s.turns.filter((t) => t.kind === "switch").map((t) => t.answerer), [B, A, B], "switch turns alternate who answers");
const t0 = currentTurn(s)!;
assert.throws(() => judge(s, t0.answerer, true), /not your turn/, "only the one holding the answer judges");
s = judge(s, t0.asker, true);
s = judge(s, currentTurn(s)!.asker, false);
const tb = currentTurn(s)!;
assert.equal(tb.kind, "blank");
assert.ok(tb.kind === "blank" && tb.options.includes("сум"), "the answer is among the options");
s = pick(s, tb.answerer, "сум");
s = judge(s, currentTurn(s)!.asker, true);
assert.equal(s.status, "complete");
assert.deepEqual(score(s), { got: 3, done: 4, total: 4 });

// Spot the slip: of two fill-ins one is read with a wrong form planted (one of its own options), one read
// right; "Sounds right" picks what was read, so it only scores on the line read right.
const blank2: GrammarItem = { kind: "blank", line: "Ние сме тука.", gloss: "We are here.", answer: "сме", options: ["сте", "се"], why: "ние → сме" };
for (const [x, y] of [[blank, blank2], [blank2, blank]] as const) {
  const g = startGrammarTogether("g2", "mk", "pt-sum", A, B, [x, y]);
  const bs = g.turns.filter((t) => t.kind === "blank");
  assert.equal(bs.filter((t) => t.slip).length, 1, "one slipped, one read right");
  const slipped = bs.find((t) => t.slip)!;
  assert.ok(slipped.slip !== slipped.answer && slipped.options.includes(slipped.slip!), "the slip is one of the wrong options");
  const again = startGrammarTogether("g2", "mk", "pt-sum", B, A, [x, y]);
  assert.deepEqual(again.turns.map((t) => t.kind === "blank" && t.slip), g.turns.map((t) => t.kind === "blank" && t.slip), "both screens plant the same slip");
  let h = g;
  for (const t of bs) { const tt = currentTurn(h)!; assert.equal(tt.index, t.index); h = pick(h, tt.answerer, t.kind === "blank" ? readForm(t) : ""); }
  assert.deepEqual(score(h), { got: 1, done: 2, total: 2 }, "\"Sounds right\" is right only where nothing was planted");
}
console.log("grammar-together.test.ts: all assertions passed");
