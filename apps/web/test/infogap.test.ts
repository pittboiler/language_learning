// Info-gap challenges (2026-11-14): every task names both roles, and every "Stuck? Ideas" phrase says when it
// fits (pack-mk/infogap-roles.ts), so a phrase edited in the content can't silently lose its label.
//   Run with: npx tsx apps/web/test/infogap.test.ts
import assert from "node:assert/strict";
import { macedonian as pack } from "@ll/pack-mk";

const tasks = pack.infoGapTasks ?? [];
assert.ok(tasks.length >= 8);
for (const t of tasks) {
  for (const r of [t.roleA, t.roleB]) {
    assert.ok(r.name && /^the /.test(r.name), `${t.id} ${r.role}: a role name ("the …")`);
    for (const p of r.targetPhrases) assert.ok(p.when && p.when.length < 70, `${t.id} ${r.role}: “${p.text}” needs a short "when"`);
  }
  assert.ok(t.goal.trim().length > 0, `${t.id}: a goal`);
}
console.log(`infogap.test.ts: ${tasks.length} tasks, ${tasks.reduce((n, t) => n + t.roleA.targetPhrases.length + t.roleB.targetPhrases.length, 0)} phrases, all named and labelled ✓`);
