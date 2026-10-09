// Walks the whole course as a learner who does every session, and checks before each one that the agenda
// names exactly the steps Today will play (same order, nothing missing, nothing extra), and after it that the
// recap covers what the session taught or practised. Runs against the real Macedonian blueprint.
//   Run with: npx tsx apps/web/test/today-plan.test.ts
import assert from "node:assert/strict";
import { macedonian as pack } from "@ll/pack-mk";
import * as familiarity from "@ll/core/familiarity";
import type { CourseSession } from "@ll/pack-schema";
import type { Progress } from "../lib/store.js";
import * as cp from "../lib/course-player.js";
import { courseSteps, type TodayStep } from "../lib/today-plan.js";

const course = pack.course!;
const letters = Object.fromEntries(pack.alphabet.map((a) => [a.glyph, true]));
const past = new Date("2026-01-01T00:00:00Z");
let progress: Progress = { familiarity: {}, scenarios: {}, settings: { courseV2: true }, letters, seenGrammar: {} } as unknown as Progress;

/** The step an agenda bullet promises (undefined: a headline bullet, like "Review day: nothing new"). */
function promised(b: string, s: CourseSession): TodayStep["kind"] | undefined {
  if (/^Warm-up:/.test(b)) return "warmup";
  if (/^\d+ new words?:/.test(b)) return "newwords";
  if (/^Say it:|^Say example words out loud/.test(b)) return "sayit";
  if (/^(Read|Reread) “/.test(b)) return "story";
  if (/^Build a sentence/.test(b)) return "build";
  if (/^(Conversation|First try at the conversation):/.test(b)) return "speak";
  if (/^Write a few lines/.test(b)) return "writing";
  if (/^Checkpoint:/.test(b)) return s.letters ? "letters" : "checkpoint";
  if (/^Then the conversation once more/.test(b)) return "checkpoint";
  if (s.letters && b.startsWith(`${s.letters.title}:`)) return "letters";
  if (/^Practice: /.test(b) || (s.role === "teach" && !!s.pointId && b === course.points.find((p) => p.id === s.pointId)?.agenda)) return "point";
  return undefined;
}

let sessions = 0;
for (const ch of course.chapters) {
  for (const s of ch.sessions) {
    const where = `ch${ch.order} s${s.n} (${s.role})`;
    progress = { ...progress, course: { chapterId: ch.chapterId, session: s.n, v: course.version } };
    const steps = courseSteps(pack, progress);
    assert.ok(steps.length > 1 && steps[0]!.kind === "agenda", `${where}: opens with its agenda`);
    const agenda = (steps[0] as Extract<TodayStep, { kind: "agenda" }>).agenda;
    const played = steps.slice(1);

    // Every bullet that promises a step points at one, in the order they're played…
    let last = -1;
    const covered = new Set<number>();
    for (const b of agenda.items) {
      const kind = promised(b, s);
      if (!kind) continue;
      const at = played.findIndex((x, i) => x.kind === kind && i >= Math.max(0, last));
      assert.ok(at !== -1, `${where}: the agenda promises “${b}” but there's no ${kind} step`);
      assert.ok(at >= last, `${where}: “${b}” is out of order`);
      last = at;
      covered.add(at);
      const step = played[at]!;
      if (step.kind === "newwords") for (const w of step.words) assert.ok(b.includes(s.words.find((x) => x.lexKey === w.lexKey)!.display.replace(/\.+$/, "")), `${where}: new word ${w.lexKey} isn't named`);
      if (step.kind === "story") assert.ok(b.includes(step.story.title), `${where}: the agenda names another story`);
      if (step.kind === "speak") assert.ok(b.includes(step.scenario.title), `${where}: the agenda names another conversation`);
      if (step.kind === "point") assert.equal(step.mode, s.role === "teach" ? "teach" : "practice", `${where}: the lesson's mode`);
    }
    // …and no step goes unmentioned.
    played.forEach((x, i) => assert.ok(covered.has(i), `${where}: the ${x.kind} step isn't on the agenda`));

    // Do the session: learn its words, be taught its point, then check the recap and move on.
    const since = new Date(past.getTime() + sessions * 3600_000);
    const fam = { ...progress.familiarity };
    for (const w of s.words) fam[w.lexKey] = familiarity.capture({ lexKey: w.lexKey, kind: w.lexKey.includes(" ") ? "chunk" : "word", display: w.display, gloss: w.gloss }, since);
    progress = { ...progress, familiarity: fam, seenGrammar: { ...progress.seenGrammar, ...(s.role === "teach" && s.pointId ? { [s.pointId]: true } : {}) } };
    const rc = cp.sessionRecap(pack, course, cp.position(course, progress.course), progress, since);
    if (!s.letters) {
      const recapped = rc.points.map((x) => x.point.id);
      const expect = s.role === "teach" ? [s.pointId!]
        : s.role === "practice" ? [cp.practisedPoint(ch, s)!]
        : [...new Set([...ch.pointIds.filter((id) => ch.sessions.some((x) => x.n <= s.n && x.pointId === id)), ...(s.story?.lens ?? [])])];
      assert.deepEqual(recapped, expect, `${where}: the recap covers what the session taught or practised`);
      for (const w of s.words) assert.ok(rc.words.some((x) => x.lexKey === w.lexKey), `${where}: the recap lists ${w.display}`);
    } else assert.ok(rc.letters.length > 0, `${where}: the recap lists the letters`);
    assert.equal(rc.next, s.next, `${where}: the recap's "next" is the blueprint's`);
    sessions++;
  }
  // A stage review after this chapter: its agenda promises a review with a conversation.
  if (course.stageReviews.some((r) => r.afterChapterId === ch.chapterId)) {
    progress = { ...progress, course: { chapterId: ch.chapterId, session: ch.sessions.length, stageReviewAfter: ch.chapterId, v: course.version } };
    const steps = courseSteps(pack, progress);
    assert.equal(steps[0]?.kind, "agenda");
    const stage = steps.find((x): x is Extract<TodayStep, { kind: "stage" }> => x.kind === "stage");
    assert.ok(stage && stage.items.length > 0 && !!stage.scenario, `stage review after ${ch.chapterId}: a sample of the stage and a conversation`);
  }
}
assert.equal(sessions, course.chapters.reduce((n, c) => n + c.sessions.length, 0));
console.log(`today-plan.test.ts: ${sessions} sessions — every agenda matches its session and every recap its lesson ✓`);
