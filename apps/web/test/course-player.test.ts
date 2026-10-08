// Runnable checks for the course player (lib/course-player.ts): position, advancing (incl. checkpoint
// retry and stage reviews), point cards as drills, and the warm-up's earlier-chapter share. Runs against
// the real Macedonian blueprint so a regenerated course.ts that breaks an assumption fails here.
//   Run with: npx tsx apps/web/test/course-player.test.ts
import assert from "node:assert/strict";
import { macedonian } from "@ll/pack-mk";
import * as familiarity from "@ll/core/familiarity";
import type { ReviewItem } from "@ll/pack-schema";
import type { Progress } from "../lib/store.js";
import * as cp from "../lib/course-player.js";

const course = macedonian.course!;
const prog = (over: Partial<Progress> = {}): Progress => ({ familiarity: {}, scenarios: {}, settings: {}, ...over } as Progress);

// 0. The switch: off by default, on when the learner opts in.
assert.equal(cp.courseV2On(macedonian, prog()), cp.COURSE_V2_DEFAULT);
assert.equal(cp.courseV2On(macedonian, prog({ settings: { courseV2: true } })), true);

// 1. A new learner starts at chapter 0 (letters & sounds), session 1: a letters lesson.
const start = cp.position(course, undefined);
assert.equal(start.kind, "session");
if (start.kind === "session") {
  assert.equal(start.chapter.chapterId, "s0-letters");
  assert.equal(start.chapter.order, 0);
  assert.equal(start.session.n, 1);
  assert.ok(start.session.letters?.glyphs.length, "a letters session");
}
// 1b. A position saved on another course structure is re-placed at the start; the current one is kept.
assert.equal(cp.position(course, { chapterId: "s0-repair", session: 2 }).kind === "session" && (cp.position(course, { chapterId: "s0-repair", session: 2 }) as { chapter: { chapterId: string } }).chapter.chapterId, "s0-letters", "an unversioned (pre-chapter-0) position restarts");
const kept = cp.position(course, { chapterId: "s0-repair", session: 2, v: course.version });
assert.ok(kept.kind === "session" && kept.chapter.chapterId === "s0-repair" && kept.session.n === 2);
assert.equal(cp.advance(course, undefined, {}).v, course.version, "advancing stamps the structure version");

// 2. Walking a chapter: sessions advance one at a time up to the checkpoint.
const ch1 = course.chapters[0]!;
let st = cp.initialState(course);
for (let i = 1; i < ch1.sessions.length; i++) st = cp.advance(course, st, {});
assert.equal(st.session, ch1.sessions.length);
assert.equal(ch1.sessions.at(-1)!.role, "checkpoint");

// 3. A failed checkpoint stays put and flags a retry; passing moves to the next chapter.
const failed = cp.advance(course, st, { checkpointPassed: false });
assert.equal(failed.chapterId, ch1.chapterId);
assert.equal(failed.retry, true);
const pos = cp.position(course, failed);
assert.ok(pos.kind === "session" && pos.retry, "the retry is visible on the position");
const passed = cp.advance(course, failed, { checkpointPassed: true });
assert.deepEqual(passed, { chapterId: course.chapters[1]!.chapterId, session: 1, v: course.version });

// 4. Passing a stage-ending chapter's checkpoint owes a stage review, then the next chapter.
const stageEnd = course.stageReviews[0]!.afterChapterId;
const endCh = course.chapters.find((c) => c.chapterId === stageEnd)!;
const atCheckpoint = { chapterId: stageEnd, session: endCh.sessions.length, v: course.version };
const owed = cp.advance(course, atCheckpoint, { checkpointPassed: true });
assert.equal(owed.stageReviewAfter, stageEnd);
assert.equal(cp.position(course, owed).kind, "stage-review");
const after = cp.advance(course, owed, {});
const nextId = course.chapters[course.chapters.indexOf(endCh) + 1]!.chapterId;
assert.deepEqual(after, { chapterId: nextId, session: 1, v: course.version });

// 5. The last chapter's checkpoint (also a stage end) → stage review → finished.
const last = course.chapters.at(-1)!;
const fin = cp.advance(course, cp.advance(course, { chapterId: last.chapterId, session: last.sessions.length, v: course.version }, { checkpointPassed: true }), {});
assert.equal(fin.finished, true);
assert.equal(cp.position(course, fin).kind, "finished");

// 6. Point cards become graded drills with a blank and their options.
const yesNo = course.points.find((p) => p.id === "pt-yes-no")!;
const items = cp.blankCardItems(yesNo);
assert.ok(items.length >= 1);
for (const it of items) {
  assert.ok(it.prompt.includes("___"), "the prompt shows the gap");
  assert.ok(it.options!.includes(it.answer), "the answer is among the options");
  assert.equal(familiarity.deriveKeyForItem(it).lexKey, `grammar:${it.id}`);
}

// 7. Warm-up: the earlier-chapter share is honoured even when only current-chapter cards are due.
const now = new Date("2026-10-10T12:00:00Z");
const chapterOf = cp.chapterOfKey(course);
const vocabFor = (lexKey: string) => macedonian.vocab.find((v) => familiarity.deriveKeyForItem(v).lexKey === lexKey)!;
const earlyWords = course.chapters[1]!.words.slice(0, 3).map((w) => vocabFor(w.lexKey)).filter(Boolean);
const currentWords = course.chapters.find((c) => c.order === 4)!.words.slice(0, 8).map((w) => vocabFor(w.lexKey)).filter(Boolean);
const entry = (it: ReviewItem, dueAt: string, strength: number) => {
  const spec = familiarity.deriveKeyForItem(it);
  const e = familiarity.capture(spec, new Date("2026-10-01T00:00:00Z"));
  return [spec.lexKey, { ...e, strength, srs: { ...e.srs!, due: new Date(dueAt) } }] as const;
};
const fam = Object.fromEntries([
  ...earlyWords.map((it, i) => entry(it, "2026-12-01T00:00:00Z", 0.1 * (i + 1))), // not due, but earlier
  ...currentWords.map((it) => entry(it, "2026-10-09T00:00:00Z", 0.5)), // due, current chapter
]);
const warm = cp.pickWarmup({ pool: [...currentWords, ...earlyWords], progress: prog({ familiarity: fam }), now, currentOrder: 4, chapterOf, size: 8, share: 2 });
assert.equal(warm.length, 8);
const fromEarlier = warm.filter((it) => (chapterOf.get(familiarity.deriveKeyForItem(it).lexKey) ?? 99) < 4);
assert.equal(fromEarlier.length, 2, "two earlier-chapter cards even though none are due");
assert.equal(familiarity.deriveKeyForItem(fromEarlier[0]!).lexKey, familiarity.deriveKeyForItem(earlyWords[0]!).lexKey, "weakest earlier card first");

// 8. Stage review samples studied words from each chapter of the stage, plus one card per point.
const stage = course.stageReviews[0]!;
const studiedFam = Object.fromEntries(stage.chapterIds.flatMap((cid) => course.chapters.find((c) => c.chapterId === cid)!.words.slice(0, 4))
  .map((w) => [w.lexKey, familiarity.capture({ lexKey: w.lexKey, kind: "word", display: w.display })]));
const sr = cp.stageReviewContent(macedonian, course, stage.afterChapterId, prog({ familiarity: studiedFam }));
assert.ok(sr.items.some((it) => it.kind === "grammar"), "grammar cards included");
assert.ok(sr.items.filter((it) => it.kind !== "grammar").length >= stage.chapterIds.length, "words from every chapter");
assert.ok(sr.scenarioId && stage.scenarioIds.includes(sr.scenarioId));

// 9. Blanks land on whole words: не must not hit the не inside Извинете.
assert.equal(cp.blankOut("„Извинете, не разбирам.“", "не"), "„Извинете, ___ разбирам.“");
assert.equal(cp.blankOut("Не сакам чај", "Не"), "___ сакам чај");
assert.equal(cp.blankOut("Можете ли да повторите?", "ли"), "Можете ___ да повторите?");
for (const p of course.points) for (const it of cp.blankCardItems(p)) assert.equal((it.prompt.match(/___/g) ?? []).length, 1, `${it.id}: exactly one gap`);

// 10. A point shows its lesson's table only as the LAST point drawing on it (no preview of later chapters).
const pt = (id: string) => course.points.find((p) => p.id === id)!;
assert.equal(cp.patternConceptFor(course, pt("pt-ne")), undefined, "не (ch 1) mustn't show the нема да / нема table");
assert.equal(cp.patternConceptFor(course, pt("pt-ima-nema")), "negation", "the last negation point shows it");
assert.equal(cp.patternConceptFor(course, pt("pt-yes-no")), "questions", "ли/дали now closes chapter 2's questions, so it shows the table");
assert.equal(cp.patternConceptFor(course, pt("pt-gender")), "gender");

// 11. Agenda + recap for a teach session: the agenda names the point; the recap quotes today's story lines
//     that use it, lists the session's words plus anything captured during it, and today's cards.
const s1 = cp.position(course, { chapterId: "s0-repair", session: 2, v: course.version }); // не is taught in chapter 1, session 2
const ag = cp.sessionAgenda(macedonian, course, s1)!;
assert.match(ag.title, /^Chapter 1 · .* · session 2$/);
assert.equal(ag.items[0], course.points.find((p) => p.id === "pt-ne")!.agenda);
const l0 = cp.sessionAgenda(macedonian, course, start)!;
assert.match(l0.title, /^Chapter 0 · Letters & sounds · session 1$/);
const lr = cp.sessionRecap(macedonian, course, start, prog(), new Date());
assert.equal(lr.letters.length, (start as { session: { letters: { glyphs: string[] } } }).session.letters.glyphs.length, "the letters recap lists today's letters");
const since = new Date("2026-10-10T09:00:00Z");
const tapped = familiarity.capture({ lexKey: "мажот", kind: "word", display: "Мажот" }, new Date("2026-10-10T09:05:00Z"));
const old = familiarity.capture({ lexKey: "фала", kind: "word", display: "фала" }, new Date("2026-10-01T09:00:00Z"));
const rc = cp.sessionRecap(macedonian, course, s1, prog({ familiarity: { мажот: tapped, фала: old } }), since);
assert.equal(rc.points.length, 1);
assert.equal(rc.points[0]!.point.id, "pt-ne");
assert.ok(rc.points[0]!.fresh);
assert.ok(rc.points[0]!.lines.some((l) => l.text.includes("не разбирам")), "quotes today's story line with не");
assert.ok(rc.words.some((w) => w.lexKey === "мажот"), "a word tapped during the session is in the recap");
assert.ok(!rc.words.some((w) => w.lexKey === "фала"), "an older word isn't");
assert.ok(course.chapters[1]!.sessions[1]!.words.every((w) => rc.words.some((x) => x.lexKey === w.lexKey)), "all the session's words");
assert.ok(rc.cards.length >= 1);
assert.ok(rc.next.startsWith("Next:"));

// 12. Rule cards: question → one-line answer, flagged for the reveal card, keyed apart from blank cards;
//     the Grammar deck holds only taught points' cards.
const rules = cp.ruleCardItems(yesNo);
assert.ok(rules.length >= 1 && rules.every((r) => r.meta?.ruleCard && !r.options && r.id.includes(":r")));
assert.equal(cp.pointItems(yesNo).length, rules.length + cp.blankCardItems(yesNo).length);
assert.deepEqual(cp.taughtPointItems(course, prog()), []);
assert.ok(cp.taughtPointItems(course, prog({ seenGrammar: { "pt-yes-no": true } })).every((it) => it.tags.includes("pt-yes-no")));

// 13. Chapter 0 can be skipped (straight to chapter 1, session 1); a curriculum chapter can't.
assert.ok(cp.canSkipChapter(start), "chapter 0 is skippable");
assert.deepEqual(cp.skipChapter(course, { chapterId: "s0-letters", session: 3, v: course.version }), { chapterId: "s0-repair", session: 1, v: course.version });
assert.ok(!cp.canSkipChapter(cp.position(course, { chapterId: "s0-repair", session: 1, v: course.version })), "chapter 1 isn't");

console.log("course-player.test.ts: all assertions passed ✓");
