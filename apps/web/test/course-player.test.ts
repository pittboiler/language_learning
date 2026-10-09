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

// 5. The last chapter's checkpoint (also a stage end) → stage review → the final → finished.
const last = course.chapters.at(-1)!;
const finalOwed = cp.advance(course, cp.advance(course, { chapterId: last.chapterId, session: last.sessions.length, v: course.version }, { checkpointPassed: true }), {});
const finalPos = cp.position(course, finalOwed);
assert.equal(finalPos.kind, "exam");
assert.equal(finalPos.kind === "exam" && finalPos.exam.id, "final");
const fin = cp.advance(course, finalOwed, {});
assert.equal(fin.finished, true);
assert.equal(cp.position(course, fin).kind, "finished");

// 5b. The midterm sits after chapter 6: checkpoint → stage review (chapters 4–6) → midterm → chapter 7.
// Exams live outside the chapters, so they never change the course structure (the saved-place version).
{
  const ch6 = course.chapters.find((c) => c.order === 6)!;
  assert.equal(ch6.chapterId, "s1-market");
  const review = cp.advance(course, { chapterId: ch6.chapterId, session: ch6.sessions.length, v: course.version }, { checkpointPassed: true });
  assert.equal(cp.position(course, review).kind, "stage-review");
  const mid = cp.advance(course, review, {});
  const midPos = cp.position(course, mid);
  assert.ok(midPos.kind === "exam" && midPos.exam.id === "midterm", "the midterm follows the stage review");
  assert.equal(cp.sessionAgenda(macedonian, course, midPos)?.title, midPos.kind === "exam" ? midPos.exam.title : "");
  assert.deepEqual(cp.currentSlot(course, prog({ course: mid })), { order: 6, n: 999 }, "chapter 6 counts as fully taught at the exam");
  assert.equal(cp.positionShare(macedonian, prog({ course: mid, settings: { courseV2: true } }))?.session, ch6.sessions.length + 2);
  const ch7 = cp.advance(course, mid, {});
  assert.deepEqual(ch7, { chapterId: course.chapters.find((c) => c.order === 7)!.chapterId, session: 1, v: course.version }, "taken or set aside, the course moves on");
  const ov = cp.courseOverview(macedonian, course, prog({ course: mid }));
  assert.equal(ov.chapters.find((c) => c.order === 6)!.exam?.state, "current");
  assert.equal(ov.chapters.find((c) => c.order === 12)!.exam?.state, "upcoming");
  assert.equal(cp.positionOf(course, { chapterId: "s1-market", n: 0, exam: true })?.kind, "exam");
}

// 5c. Every exam is well-formed: its can-dos, points and chapters exist, every task's can-dos are its exam's,
// and every model line still matches the line it quotes (so its cached audio plays).
{
  const lineText = new Map<string, string>();
  for (const sc of macedonian.scenarios) sc.script.forEach((t, i) => lineText.set(`scenario:${sc.id}#${i}`, t.text));
  for (const v of macedonian.vocab) lineText.set(`vocab:${v.id}`, v.answer);
  const chapterIds = new Set(course.chapters.map((c) => c.chapterId));
  const pointIds = new Set(course.points.map((p) => p.id));
  assert.deepEqual((course.exams ?? []).map((e) => e.id), ["midterm", "final"]);
  for (const e of course.exams ?? []) {
    assert.ok(chapterIds.has(e.afterChapterId), e.id);
    const canDo = new Set(e.canDos.map((c) => c.id));
    for (const c of e.canDos) {
      assert.ok(c.chapterIds.every((id) => chapterIds.has(id)), `${e.id}/${c.id} chapters`);
      assert.ok(c.pointIds.every((id) => pointIds.has(id)), `${e.id}/${c.id} points`);
    }
    assert.ok(e.tasks.some((t) => t.mode === "speak") && e.tasks.some((t) => t.mode === "write"), `${e.id}: speaking and writing`);
    for (const t of e.tasks) {
      assert.ok(t.canDoIds.length && t.canDoIds.every((id) => canDo.has(id)), `${t.id} can-dos`);
      assert.ok(t.pointIds.every((id) => pointIds.has(id)), `${t.id} points`);
      for (const m of t.model) assert.equal(lineText.get(m.source)?.trim(), m.text.trim(), `${t.id} model ${m.source}`);
    }
    // Every can-do is assessed by at least one task.
    for (const c of e.canDos) assert.ok(e.tasks.some((t) => t.canDoIds.includes(c.id)), `${e.id}/${c.id} is assessed`);
  }
}

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
const slotOf = cp.slotOfKey(course);
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
const warm = cp.pickWarmup({ pool: [...currentWords, ...earlyWords], progress: prog({ familiarity: fam }), now, current: { order: 4, n: 99 }, slotOf, size: 8, share: 2 });
assert.equal(warm.length, 8);
const fromEarlier = warm.filter((it) => (slotOf.get(familiarity.deriveKeyForItem(it).lexKey)?.order ?? 99) < 4);
assert.equal(fromEarlier.length, 2, "two earlier-chapter cards even though none are due");
assert.equal(familiarity.deriveKeyForItem(fromEarlier[0]!).lexKey, familiarity.deriveKeyForItem(earlyWords[0]!).lexKey, "weakest earlier card first");

// 7b. ...but only what the course has taught in an EARLIER session: at chapter 1 session 1, cards met out
//     of order (session 2's не, its words, a word tapped in a story) are due but stay out of the warm-up.
{
  const ch1 = course.chapters.find((c) => c.order === 1)!;
  const neSession = ch1.sessions.find((x) => x.pointId === "pt-ne")!;
  const neCards = cp.pointItems(course.points.find((p) => p.id === "pt-ne")!);
  const neWords = neSession.words.map((w) => vocabFor(w.lexKey)).filter(Boolean);
  const tapped: ReviewItem = { id: "tap-навистина", kind: "vocab", prompt: "Really?", answer: "Навистина?", gloss: "Really?", i1Level: 0, tags: [] } as ReviewItem;
  const early = [...neCards, ...neWords, tapped];
  const famEarly = Object.fromEntries(early.map((it) => entry(it, "2026-10-09T00:00:00Z", 0.3)));
  const at = (n: number) => cp.pickWarmup({ pool: early, progress: prog({ familiarity: famEarly }), now, current: { order: 1, n }, slotOf, size: 8, share: 2 });
  assert.equal(at(1).length, 0, "nothing from later sessions or off-course at ch1 s1");
  const later = at(neSession.n + 1).map((it) => familiarity.deriveKeyForItem(it).lexKey);
  assert.ok(later.length > 0 && later.every((k) => slotOf.has(k)), "once taught, не's cards and words come back; the tapped word never does");
  assert.equal(cp.needsTeaching(prog({ familiarity: famEarly }), neWords[0] ? familiarity.deriveKeyForItem(neWords[0]).lexKey : ""), true, "a word met out of order is still taught in its session");
}

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
assert.match(ag.items[0]!, /^3 new words:/, "agenda follows the lesson's order: new words first");
assert.equal(ag.items[1], course.points.find((p) => p.id === "pt-ne")!.agenda);
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

// 14. What's known by a session: a session's words, a point's card forms with the point, and every form of
//     a verb once one form is known and its group's endings are taught.
{
  const slots = cp.formSlots(macedonian, course);
  const at = (o: number, n: number) => ({ order: o, n });
  const knownBy = (t: string, s: cp.CourseSlot) => { const x = slots.get(t); return !!x && cp.cmpSlot(x, s) <= 0; };
  assert.ok(knownBy("јас", at(1, 1)) && knownBy("сум", at(1, 1)), "ch1 s1 teaches јас and сум");
  assert.ok(!knownBy("не", at(1, 1)) && knownBy("не", at(1, 2)), "не comes with its point in s2");
  const verbsA = cp.pointSlots(course).get("pt-verbs-a")!;
  assert.ok(knownBy("сакам", at(3, 1)) && !knownBy("сакаш", at(3, 1)), "сакам is a word in ch3; сакаш waits for the -а endings");
  assert.ok(knownBy("сакаш", verbsA), "once -а endings are taught, every form of a known -а verb is known");
}

// 15. Agenda: a practice day names the point it practises; Build-a-sentence is listed when the session has
//     it; "First try" only labels the chapter's first conversation.
for (const c of course.chapters) {
  const firstSpeak = c.sessions.find((x) => x.speak)?.n;
  for (const x of c.sessions) {
    if (x.letters) continue;
    if (x.build.length) assert.ok(x.agenda.some((b) => b.startsWith("Build a sentence")), `ch${c.order} s${x.n} lists Build`);
    if (x.agenda.some((b) => b.startsWith("First try"))) assert.equal(x.n, firstSpeak, `ch${c.order} s${x.n}: "First try" only on the first conversation`);
    if (x.role === "practice") assert.ok(x.agenda.some((b) => b.startsWith("Practice: ")), `ch${c.order} s${x.n} names its point`);
  }
}

// 16. The course map: chapters and sessions marked from the learner's place; a stage review owed after a
//     chapter shows as "current" on that chapter's row; finished sessions carry their saved record.
{
  const ch1 = course.chapters.find((c) => c.order === 1)!;
  const at = { chapterId: ch1.chapterId, session: 3, v: course.version };
  const entry = cp.logEntry(cp.position(course, { ...at, session: 1 }), new Date("2026-10-08T15:00:00Z"), new Date("2026-10-08T15:20:00Z"), [{ answer: "сум", gloss: "am" }])!;
  const ov = cp.courseOverview(macedonian, course, prog({ course: at, courseLog: [entry], seenGrammar: { "pt-sum": true } }));
  const o1 = ov.chapters.find((c) => c.chapterId === ch1.chapterId)!;
  assert.equal(ov.chapters[0]!.state, "done", "chapter 0 is behind the learner");
  assert.equal(o1.state, "current");
  assert.deepEqual(o1.sessions.slice(0, 4).map((x) => x.state), ["done", "done", "current", "upcoming"]);
  assert.equal(o1.sessions[0]!.log?.missed?.[0]?.answer, "сум", "session 1 carries its record");
  assert.ok(o1.points.find((x) => x.id === "pt-sum")!.taught && !o1.points.find((x) => x.id === "pt-ne")!.taught);
  assert.equal(ov.done, 2, "two curriculum sessions done (chapter 0 isn't counted)");
  assert.equal(ov.total, course.chapters.filter((c) => c.order > 0).reduce((n, c) => n + c.sessions.length, 0));
  assert.ok(o1.sessions[0]!.headline.startsWith("New: ") && o1.sessions[0]!.headline.includes("јас"), "headline names the point and words");
  const stage = course.stageReviews[0]!;
  const owed = cp.courseOverview(macedonian, course, prog({ course: { chapterId: stage.afterChapterId, session: 99, stageReviewAfter: stage.afterChapterId, v: course.version } }));
  const row = owed.chapters.find((c) => c.chapterId === stage.afterChapterId)!;
  assert.equal(row.state, "done");
  assert.equal(row.stageReview?.state, "current");
  // A record points back at its session; a passed checkpoint names what comes next.
  const back = cp.positionOf(course, entry);
  assert.ok(back?.kind === "session" && back.session.n === 1 && back.chapter.chapterId === ch1.chapterId);
  const lastOfStage = course.chapters.find((c) => c.chapterId === stage.afterChapterId)!;
  assert.equal(cp.afterCheckpoint(macedonian, course, { chapterId: lastOfStage.chapterId, session: lastOfStage.sessions.length, v: course.version }), "a stage review of everything so far");
  assert.match(cp.afterCheckpoint(macedonian, course, { chapterId: ch1.chapterId, session: ch1.sessions.length, v: course.version }), /^chapter 2, /);
  // Saved notes only pick up words tapped during the session.
  const inside = familiarity.capture({ lexKey: "мажот", kind: "word", display: "Мажот" }, new Date("2026-10-08T15:10:00Z"));
  const later = familiarity.capture({ lexKey: "навистина", kind: "word", display: "Навистина" }, new Date("2026-10-09T09:00:00Z"));
  const notes = cp.sessionRecap(macedonian, course, back!, prog({ familiarity: { мажот: inside, навистина: later } }), new Date(entry.startedAt), new Date(entry.at));
  assert.ok(notes.words.some((w) => w.lexKey === "мажот") && !notes.words.some((w) => w.lexKey === "навистина"));
}

// 17. "Use it": exercises built from the story's own lines that use today's focus, easiest first; a fill-in
//     comes from the line's focus when there is one, else from the point's quick checks; a story with no line
//     on the focus falls back to the point's examples.
{
  const story = macedonian.stories!.find((x) => x.id === "gen-s0-repair-story")!;
  const onSum = story.body.map((_, i) => `story:${story.id}#${i}`).filter((src) => (course.lineTags[src] ?? []).includes("pt-sum"));
  assert.ok(onSum.length > 0, "the chapter 1 story has a сум line");
  const withFocus = { ...course, lineFocus: { [onSum[0]!]: { "pt-sum": { words: ["е"], blank: { word: "е", options: ["е", "си", "сум"], why: "Ana is “she” → е." } } } } };
  const items = cp.useItItems(withFocus, story, ["pt-sum"], 0);
  assert.deepEqual(items.map((x) => x.kind), ["understand", "complete", "build", "say"].filter((k) => items.some((x) => x.kind === k)), "easiest first");
  const complete = items.find((x) => x.kind === "complete");
  assert.ok(complete && complete.kind === "complete" && complete.blank === "е" && complete.options.includes("си"), "the line's own fill-in");
  const understand = items.find((x) => x.kind === "understand");
  assert.ok(understand && understand.kind === "understand" && understand.options.includes(understand.line.gloss) && understand.options.length === 3);
  const sumPoint = course.points.find((x) => x.id === "pt-sum")!;
  assert.ok(items.filter((x) => x.kind !== "complete").every((x) => onSum.includes(x.line.source) || sumPoint.examples.some((e) => e.source === x.line.source)), "every line uses today's point (the story's, or the lesson's examples)");
  assert.ok(new Set(items.map((x) => x.line.source)).size >= 3, "a story with one сум line borrows the lesson's examples, so the exercises vary");
  const build = items.find((x) => x.kind === "build");
  assert.ok(!build || !/[„“"]/.test(build.line.text), "tiles carry no quotation marks");
  // No line on the focus in this story → the point's own examples / quick checks stand in.
  const fallback = cp.useItItems(course, story, ["pt-go-ja-gi"], 0);
  const goPoint = course.points.find((x) => x.id === "pt-go-ja-gi")!;
  assert.ok(fallback.length > 0 && fallback.filter((x) => x.kind !== "complete").every((x) => goPoint.examples.some((e) => cp.bareLine(e.text) === x.line.text || e.source === x.line.source)));
  // Focus words for highlighting; the session's focus points.
  assert.deepEqual(cp.focusWords(withFocus, onSum[0]!, ["pt-sum", "pt-ne"]), ["е"]);
  const ch1 = course.chapters.find((c) => c.order === 1)!;
  assert.deepEqual(cp.sessionFocus(ch1, ch1.sessions[0]!), ["pt-sum"]);
  // The question helper knows the chapter, what's taught, and what comes later (with its chapter).
  const ctx = cp.explainContext(course, prog({ course: { chapterId: ch1.chapterId, session: 2, v: course.version }, seenGrammar: { "pt-sum": true } }));
  assert.equal(ctx.chapter, 1);
  assert.ok(ctx.taught.length === 1 && ctx.later.some((l) => l.chapter === 8));
}

// 18. Practice tools follow the course: Build-a-sentence only reaches sentences whose verb and grammar the
//     course has taught; the verb drill only taught verbs; words are filed under the chapter that teaches
//     them (a bundle's words under the bundle's chapter); review days bring back your own picks.
{
  const at = (chapterOrder: number, session = 1) => prog({ course: { chapterId: course.chapters.find((c) => c.order === chapterOrder)!.chapterId, session, v: course.version } });
  const allowEarly = cp.sentenceAllowed(macedonian, course, at(2));
  const allowLate = cp.sentenceAllowed(macedonian, course, at(12));
  const sentences = macedonian.sentences ?? [];
  assert.ok(sentences.filter(allowEarly).every((x) => x.verbLemma === "е"), "before any verb endings are taught, only сум sentences (сум is chapter 1)");
  assert.ok(sentences.filter(allowLate).length > sentences.filter(cp.sentenceAllowed(macedonian, course, at(5))).length, "more sentences come into reach as the course goes on");
  const miTreba = sentences.find((x) => x.variants.some((v) => /^Ми треба/.test(v.mk)));
  if (miTreba && course.lineTags[`sentence:${miTreba.id}`]) assert.ok(!cp.sentenceAllowed(macedonian, course, at(6))(miTreba), "ми-grammar (chapter 8) isn't offered in chapter 6");
  const verbs3 = cp.taughtVerbs(macedonian, course, at(3));
  const verbs5 = cp.taughtVerbs(macedonian, course, at(5, 7));
  assert.ok(!verbs3.has("доаѓа") && !verbs5.has("спие"), "never-taught verbs never come up");
  assert.ok(verbs5.size > verbs3.size);
  const twoAt = cp.chapterOfWord(course, "два");
  assert.equal(twoAt?.order, 3, "два is taught (in a bundle) in chapter 3");
  assert.equal(cp.chapterOfWord(course, "јас")?.order, 1, "јас is a chapter 1 word");
  const bundle = course.chapters.flatMap((c) => c.words).find((w) => w.lexKey.split(/[\s,/]+/).includes("два"))!;
  assert.ok(cp.learnedInBundle(course, prog({ familiarity: { [bundle.lexKey]: familiarity.capture({ lexKey: bundle.lexKey, kind: "chunk", display: bundle.display }) } }), "два"));
  const due = (e: ReturnType<typeof familiarity.capture>) => ({ ...e, srs: { ...e.srs!, due: new Date("2026-10-01T00:00:00Z") } });
  const picked = due(familiarity.markPicked(familiarity.capture({ lexKey: "сега", kind: "word", display: "сега", gloss: "now" })));
  const starred = due(familiarity.markStarred(familiarity.capture({ lexKey: "многу", kind: "word", display: "многу", gloss: "very" })));
  const tapped = due(familiarity.capture({ lexKey: "навистина", kind: "word", display: "Навистина", gloss: "really" }));
  const own = cp.ownWordsDue(macedonian, prog({ familiarity: { сега: picked, многу: starred, навистина: tapped } }), new Date("2026-10-10T00:00:00Z"), 4);
  assert.deepEqual(own.map((x) => familiarity.deriveKeyForItem(x).lexKey).sort(), ["многу", "сега"], "★ and ＋Learn picks, not a word only tapped");
}

// The partnered warm-up pool: only words BOTH partners have been taught, in sessions each has finished.
{
  const ch1 = course.chapters.find((c) => c.order === 1)!;
  const s1 = ch1.sessions[0]!.words.map((w) => w.lexKey);
  const s2 = ch1.sessions[1]!.words.map((w) => w.lexKey);
  assert.ok(s1.length && s2.length, "ch1 sessions 1–2 teach words");
  // Me at ch1 s3 (finished s1–s2), partner at ch1 s2 (finished s1): only session 1's words are shared.
  const both = cp.wordsTaughtToBoth(course, { order: 1, n: 3 }, cp.slotOfShare({ chapterId: ch1.chapterId, chapterOrder: 1, session: 2, points: [] })).map((w) => w.lexKey);
  assert.deepEqual([...both].sort(), [...new Set(s1)].sort(), "the partner hasn't done session 2 yet");
  assert.ok(!both.includes("видам"), "a chapter 5 word never reaches a chapter 1 pair");
  // Nobody has finished a session yet → nothing to drill.
  assert.equal(cp.wordsTaughtToBoth(course, { order: 1, n: 1 }, { order: 3, n: 1 }).length, 0);
}

// The partnered grammar step: rule read aloud first, then the point's questions and fill-ins (each fill-in
// carrying the right answer among its options), then gaps from story lines both partners have read.
{
  const items = cp.grammarTogetherItems(macedonian, course, "pt-sum", { order: 1, n: 3 }, { order: 1, n: 3 });
  assert.equal(items[0]!.kind, "read");
  assert.ok(items.some((x) => x.kind === "rule") && items.some((x) => x.kind === "blank"));
  for (const x of items) if (x.kind === "blank") assert.ok([x.answer, ...x.options].includes(x.answer) && x.options.length >= 2, x.line);
  const cardBlank = items.find((x) => x.kind === "blank" && x.cardId);
  assert.ok(cardBlank && cardBlank.kind === "blank" && cp.blankCardItems(course.points.find((p) => p.id === "pt-sum")!).some((it) => it.id === cardBlank.cardId), "a card fill-in grades that card");
  // Nobody has read a story yet → only the point's own cards, no extra gaps from story lines.
  const early = cp.grammarTogetherItems(macedonian, course, "pt-sum", { order: 1, n: 1 }, { order: 1, n: 1 });
  assert.ok(early.every((x) => x.kind !== "blank" || !!x.cardId));
  assert.ok(items.length >= early.length);
}

console.log("course-player.test.ts: all assertions passed ✓");
