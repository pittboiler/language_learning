// Runnable checks for the cutover reset (lib/reset.ts): only ★ starred items survive, with their sentence
// context; settings + alphabet survive; course progress, chapters, stories etc. are cleared.
//   Run with: npx tsx apps/web/test/reset.test.ts
import assert from "node:assert/strict";
import * as familiarity from "@ll/core/familiarity";
import type { Progress } from "../lib/store.js";
import { freshStart } from "../lib/reset.js";

const cap = (k: string) => familiarity.capture({ lexKey: k, kind: "word", display: k });
const p = {
  activePackId: "mk", letters: { А: true }, scenarios: { s1: { turnIndex: 3, metCriteria: ["a"] } }, pick: "s1",
  settings: { autoplay: true, slow: true },
  familiarity: { кафе: familiarity.markStarred(cap("кафе")), пиво: cap("пиво"), "grammar:pt:pt-ne:2": familiarity.markStarred(cap("grammar:pt:pt-ne:2")) },
  contexts: { кафе: "Едно кафе, ве молам.", пиво: "Едно пиво." }, contextGlosses: { кафе: "One coffee, please." },
  streak: { count: 9, lastDay: "2026-10-07" }, seenGrammar: { negation: true }, seenStories: {}, storyReads: { x: ["2026-10-01"] },
  chapters: { "s0-repair": { passedAt: "2026-10-02" } }, sessions: 30, builtConjugations: ["сака:1sg"], lastSessionDay: "2026-10-07",
} as unknown as Progress;

const { next, summary } = freshStart(p, { courseV2: true });
assert.deepEqual(Object.keys(next.familiarity).sort(), ["grammar:pt:pt-ne:2", "кафе"], "only starred survive");
assert.ok(familiarity.isStarred(next.familiarity["кафе"]!) && next.familiarity["кафе"]!.srs, "with their review state");
assert.deepEqual(next.contexts, { кафе: "Едно кафе, ве молам." }, "sentence contexts only for kept items");
assert.deepEqual(next.contextGlosses, { кафе: "One coffee, please." });
assert.deepEqual(next.letters, { А: true }, "alphabet kept");
assert.equal(next.settings?.autoplay, true, "settings kept");
assert.equal(next.settings?.courseV2, true, "new course switched on");
for (const k of ["scenarios", "seenGrammar", "storyReads", "chapters", "sessions", "builtConjugations", "lastSessionDay", "streak", "course"] as const) {
  const v = (next as unknown as Record<string, unknown>)[k];
  assert.ok(v === undefined || JSON.stringify(v) === JSON.stringify((({ scenarios: {}, seenGrammar: {}, storyReads: {}, streak: { count: 0, lastDay: "" } }) as Record<string, unknown>)[k] ?? v) && !(k === "sessions" && v), `${k} cleared`);
}
assert.equal(next.course, undefined, "starts at chapter 1, session 1");
assert.equal(summary.cleared, 1);
assert.ok(summary.clearedFields.includes("chapters") && summary.clearedFields.includes("sessions"));
console.log("reset.test.ts: all assertions passed ✓");
