// Runnable check for the partnered grammar turns — run with: npx tsx packages/core/test/grammar-together.test.ts
// Person ping-pong: the asker holds the answer and judges; the roles take turns; a fill-in is still tapped.
import assert from "node:assert/strict";
import { startGrammarTogether, currentTurn, judge, pick, score, type GrammarItem } from "../src/partner/grammar-together.js";

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
console.log("grammar-together.test.ts: all assertions passed");
