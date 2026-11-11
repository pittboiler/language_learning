// "Again" on a lesson card (warm-up, checkpoint, stage review, the end-of-lesson pass) must visibly bring the
// card back: two cards on, not at the end where it looked just like "Good" (Jake, 2026-11-11). And a score
// counts first tries only, so pressing "Again" and then getting it right can't lift a checkpoint over the mark.
//   Run with: npx tsx apps/web/test/again.test.ts
import assert from "node:assert/strict";
import { AGAIN_GAP, firstTries, sendBack } from "../lib/today-plan.js";

// 1. Slotted back AGAIN_GAP cards on, or last when fewer are left; nothing lost or duplicated.
assert.equal(AGAIN_GAP, 2);
assert.deepEqual(sendBack(["b", "c", "d", "e"], "a"), { rest: ["b", "c", "a", "d", "e"], wait: 2 });
assert.deepEqual(sendBack(["b"], "a"), { rest: ["b", "a"], wait: 1 });
assert.deepEqual(sendBack([], "a"), { rest: ["a"], wait: 0 }); // the last card: it's straight back

// 2. Play a warm-up the way WarmupSession does: "Again" on card 1 of five shows it again as card 4, not card 6.
type Card = { id: string; again?: boolean };
let steps: Card[] = ["w1", "w2", "w3", "w4", "w5"].map((id) => ({ id }));
const shown: string[] = [];
const results: { ok: boolean; retry?: boolean }[] = [];
for (let i = 0; i < steps.length; i++) {
  const c = steps[i]!;
  shown.push(c.again ? `${c.id}*` : c.id);
  const ok = !(c.id === "w1" && !c.again) && !(c.id === "w5" && !c.again); // miss w1 and w5 the first time
  results.push({ ok, ...(c.again ? { retry: true } : {}) });
  if (!ok) steps = [...steps.slice(0, i + 1), ...sendBack(steps.slice(i + 1), { ...c, again: true }).rest];
  assert.ok(i < 20, "a card answered right must not keep coming back");
}
assert.deepEqual(shown, ["w1", "w2", "w3", "w1*", "w4", "w5", "w5*"]);

// 3. The score is on first tries: 3 of 5, not 5 of 7.
assert.deepEqual(firstTries(results), { got: 3, total: 5 });
assert.deepEqual(firstTries([]), { got: 0, total: 0 });
console.log("again: ok");
