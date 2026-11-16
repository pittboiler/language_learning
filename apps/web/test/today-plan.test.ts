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
import { courseConjVerb, courseSteps, drillableVerbs, type TodayStep } from "../lib/today-plan.js";

const course = pack.course!;
const letters = Object.fromEntries(pack.alphabet.map((a) => [a.glyph, true]));
const past = new Date("2026-01-01T00:00:00Z");
let progress: Progress = { familiarity: {}, scenarios: {}, settings: { courseV2: true }, letters, seenGrammar: {} } as unknown as Progress;

/** The step an agenda bullet promises (undefined: a headline bullet, like "Review day: nothing new"). */
function promised(b: string, s: CourseSession): TodayStep["kind"] | undefined {
  if (/^Warm-up:/.test(b)) return "warmup";
  if (/^\d+ new words?:|^Catch-up:/.test(b)) return "newwords";
  if (/^Say it:|^Say example words out loud/.test(b)) return "sayit";
  if (/^(Read|Reread) “/.test(b)) return "story";
  if (/^Build a sentence/.test(b)) return "build";
  if (/^(Conversation|First try at the conversation):/.test(b)) return "speak";
  if (/^Write it:/.test(b)) return "writing";
  if (/^Checkpoint:/.test(b)) return s.letters ? "letters" : "checkpoint";
  if (/^(Then the conversation once more|Switch the person:|Out loud:)/.test(b)) return "checkpoint";
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
    if (s.role === "checkpoint" && !s.letters) {
      // A chapter's end opens on its own choice screen, no menu: the checkpoint, or a practice round.
      const end = steps.find((x): x is Extract<TodayStep, { kind: "chapterEnd" }> => x.kind === "chapterEnd");
      assert.ok(end && steps.every((x) => x.kind === "chapterEnd" || x.kind === "newwords"), `${where}: the chapter's end, and nothing else but catch-up words`);
      assert.ok(end.checkpoint.items.length > 0 && end.practice.chapter.items.length > 0 && end.practice.all.items.length > 0, `${where}: a checkpoint and two practice rounds`);
    }
    const hasAgenda = steps[0]?.kind === "agenda";
    assert.ok(hasAgenda || (s.role === "checkpoint" && !s.letters), `${where}: opens with its agenda`);
    const agenda = hasAgenda ? (steps[0] as Extract<TodayStep, { kind: "agenda" }>).agenda : { title: "", items: [] as string[] };
    const played = hasAgenda ? steps.slice(1) : [];

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
      if (step.kind === "newwords") for (const w of step.words) assert.ok(agenda.items.some((x) => /^(\d+ new words?|Catch-up):/.test(x) && x.includes((s.words.find((y) => y.lexKey === w.lexKey)?.display ?? w.lexKey).replace(/\.+$/, ""))), `${where}: new word ${w.lexKey} isn't named`);
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

// The chapter's last session takes in the whole chapter: every word learned and every grammar card, then
// "Switch the person" (one person per line) and lines to say for the persons it didn't reach.
{
  const ch1 = course.chapters.find((c) => c.chapterId === "s0-repair")!;
  const fam: Progress["familiarity"] = {};
  for (const w of ch1.words) fam[w.lexKey] = familiarity.capture({ lexKey: w.lexKey, kind: "word", display: w.display, gloss: w.gloss }, past);
  const at = { familiarity: fam, scenarios: {}, settings: { courseV2: true }, letters, seenGrammar: { "pt-sum": true, "pt-ne": true }, course: { chapterId: "s0-repair", session: 8, v: course.version } } as unknown as Progress;
  const cpStep = courseSteps(pack, at).find((x): x is Extract<TodayStep, { kind: "chapterEnd" }> => x.kind === "chapterEnd")!.checkpoint;
  const cards = ch1.pointIds.flatMap((id) => cp.blankCardItems(course.points.find((p) => p.id === id)!));
  assert.equal(cpStep.earlier, 0, "chapter 1 has no earlier chapter to draw on");
  assert.equal(cpStep.items.filter((i) => i.kind !== "grammar").length, ch1.words.length, "every word of the chapter");
  assert.equal(cpStep.items.filter((i) => i.kind === "grammar").length, cards.length, "every grammar card of the chapter");
  const sw = cpStep.switches;
  assert.ok(sw.length >= 3 && new Set(sw.map((x) => x.person)).size === sw.length, "switches cover different persons");
  assert.ok(cpStep.say.length >= 1, "lines to say for the other persons");
}

// Catch-up: a learner who finished chapter 1 before вие / тие joined its session 6 is taught them at the start
// of the checkpoint (the agenda says why), and not again once met.
{
  const ch1 = course.chapters.find((c) => c.chapterId === "s0-repair")!;
  const at6 = ch1.sessions.find((s) => s.words.some((w) => w.lexKey === "вие"))!;
  assert.ok(at6.words.some((w) => w.lexKey === "тие"), "вие and тие are taught together in chapter 1");
  const fam: Progress["familiarity"] = {};
  for (const s of ch1.sessions.filter((x) => x.n < 8)) for (const w of s.words) if (w.lexKey !== "вие" && w.lexKey !== "тие") fam[w.lexKey] = familiarity.capture({ lexKey: w.lexKey, kind: "word", display: w.display, gloss: w.gloss }, past);
  const before = { familiarity: fam, scenarios: {}, settings: { courseV2: true }, letters, seenGrammar: { "pt-sum": true, "pt-ne": true }, course: { chapterId: "s0-repair", session: 8, v: course.version } } as unknown as Progress;
  const steps = courseSteps(pack, before);
  const nw = steps.find((x): x is Extract<TodayStep, { kind: "newwords" }> => x.kind === "newwords");
  assert.deepEqual(nw?.words.map((w) => w.lexKey), ["вие", "тие"], "the checkpoint opens by teaching the two words");
  assert.ok(steps.findIndex((x) => x.kind === "newwords") < steps.findIndex((x) => x.kind === "chapterEnd"));
  for (const k of ["вие", "тие"]) fam[k] = familiarity.capture({ lexKey: k, kind: "word", display: k, gloss: k }, past);
  assert.ok(!courseSteps(pack, { ...before, familiarity: fam }).some((x) => x.kind === "newwords"), "once met, nothing to catch up");
}
console.log(`today-plan.test.ts: ${sessions} sessions — every agenda matches its session and every recap its lesson ✓`);

// The verb drill spaces itself out (Jake, 2026-10-31): a verb drilled in the last two lessons sits out, so сум,
// the only verb until chapter 4, comes every third lesson; a verb not drilled yet never waits; with several
// verbs the daily rotation is unchanged.
{
  const base = { ...progress, seenGrammar: {}, courseLog: [] as NonNullable<Progress["courseLog"]>, seenConjugations: [] as string[] };
  const log = (...drilled: string[][]) => drilled.map((d, i) => ({ chapterId: "x", n: i + 1, startedAt: "", at: "", ...(d.length ? { drilled: d } : {}) }));
  const sum = new Set(["е"]);
  assert.equal(courseConjVerb(pack, base, sum)?.lemma, "е", "first time: drilled");
  assert.equal(courseConjVerb(pack, { ...base, courseLog: log(["е"]) }, sum), undefined, "drilled last lesson: sits out");
  assert.equal(courseConjVerb(pack, { ...base, courseLog: log(["е"], []) }, sum), undefined, "two lessons ago: still out");
  assert.equal(courseConjVerb(pack, { ...base, courseLog: log(["е"], [], []) }, sum)?.lemma, "е", "three lessons on: back");
  assert.equal(courseConjVerb(pack, { ...base, seenConjugations: ["е"], courseLog: log(["е"]) }, new Set(["е", "сака"]))?.lemma, "сака", "a new verb doesn't wait");
  // Walk chapters 1–4 drilling whatever comes up: сум about every third lesson until the -а verbs arrive, then daily.
  let p: Progress = { ...base };
  const byLesson: (string | undefined)[] = [];
  for (const ch of course.chapters.filter((c) => c.order <= 5)) for (const s of ch.sessions) {
    p = { ...p, course: { chapterId: ch.chapterId, session: s.n, v: course.version }, seenGrammar: { ...p.seenGrammar } };
    const verbs = drillableVerbs(pack, p);
    const v = verbs.size ? courseConjVerb(pack, p, verbs)?.lemma : undefined;
    byLesson.push(verbs.size ? v ?? "-" : undefined);
    p = { ...p, seenGrammar: { ...p.seenGrammar, ...(s.role === "teach" && s.pointId ? { [s.pointId]: true } : {}) }, courseLog: [...(p.courseLog ?? []), ...log(v ? [v] : [])], seenConjugations: [...(p.seenConjugations ?? []), ...(v ? [v] : [])] };
  }
  const sumOnly = byLesson.filter((x) => x === "е" || x === "-");
  assert.ok(sumOnly.length > 20, "сум is the only verb for a long stretch");
  assert.ok(sumOnly.slice(0, 21).filter((x) => x === "е").length === 7, `сум every third lesson: ${sumOnly.slice(0, 21).join(" ")}`);
  const later = byLesson.slice(byLesson.findIndex((x) => x && x !== "е" && x !== "-"));
  assert.ok(later.slice(0, 8).every((x) => x && x !== "-"), `with several verbs, one every lesson: ${later.slice(0, 8).join(" ")}`);
}
console.log("today-plan.test.ts (verb drill spacing): all assertions passed ✓");

// Words already studied aren't taught again as new (2026-11-16, Jake at chapter 4: "it shows things I've already
// learned as new words… Едно пиво, ве молам"). A learner who did every new-words step through chapter 3 starts
// chapter 4: the drinks were taught in chapter 3, „Едно пиво, ве молам“ is no longer a chapter-4 word, and a word
// studied early (tapped in a story) is left out of its session and out of the agenda's "new words" line.
{
  const ch = (o: number) => course.chapters.find((c) => c.order === o)!;
  const studiedAll = (upTo: number) => Object.fromEntries(course.chapters.filter((c) => c.order <= upTo).flatMap((c) => c.sessions.flatMap((s) => s.words))
    .map((w) => [w.lexKey, familiarity.capture({ lexKey: w.lexKey, kind: w.lexKey.includes(" ") ? "chunk" : "word", display: w.display }, past)]));
  const at = (o: number, n: number, fam: Progress["familiarity"]): Progress =>
    ({ familiarity: fam, scenarios: {}, settings: { courseV2: true }, letters, seenGrammar: {}, course: { chapterId: ch(o).chapterId, session: n, v: course.version } }) as unknown as Progress;
  const newWords = (p: Progress) => courseSteps(pack, p).filter((x): x is Extract<TodayStep, { kind: "newwords" }> => x.kind === "newwords").flatMap((x) => x.words.map((w) => w.lexKey));
  const agendaOf = (p: Progress) => { const a = courseSteps(pack, p)[0]; return a?.kind === "agenda" ? a.agenda.items : []; };

  const ch3words = ch(3).sessions.flatMap((s) => s.words.map((w) => w.lexKey));
  assert.ok(ch3words.includes("сок / вода / пиво"), "chapter 3 teaches the drinks its lessons use");
  const ch4words = ch(4).sessions.flatMap((s) => s.words.map((w) => w.lexKey));
  assert.ok(ch4words.includes("кафе / чај"), "chapter 4 teaches coffee and tea");
  for (const k of ["кафе", "пиво", "вода", "чај", "сок", "сок / вода / пиво", "едно пиво, ве молам"]) assert.ok(!ch4words.includes(k), `chapter 4 doesn't teach ${k} as new`);

  const fam = studiedAll(3);
  assert.deepEqual(newWords(at(4, 1, fam)), ["имам", "давам"], "chapter 4, day 1 teaches only what's new");
  const line = agendaOf(at(4, 1, fam)).find((b) => /new words?:/.test(b));
  assert.equal(line, "2 new words: имам · давам", "the agenda names the words the lesson teaches");

  // Studied early (tapped in a story): left out of its lesson, and the agenda says why when nothing's left.
  const early = { ...fam, ...studiedAll(4) };
  const day3 = ch(4).sessions.find((s) => s.n === 3)!;
  assert.deepEqual(newWords(at(4, 3, early)), [], "nothing studied is taught again");
  const none = agendaOf(at(4, 3, early)).find((b) => b.startsWith("No new words"));
  assert.ok(none && day3.words.every((w) => none.includes(w.display.replace(/\.+$/, ""))), `the agenda says they're studied: ${none}`);

  // Someone who'd passed chapter 3 before the drinks moved there gets them as a catch-up (not as chapter 4 words)…
  const before = Object.fromEntries(Object.entries(fam).filter(([k]) => k !== "сок / вода / пиво"));
  assert.deepEqual(newWords(at(4, 1, before)), ["сок / вода / пиво", "имам", "давам"], "the drinks come back as a catch-up");
  assert.ok(agendaOf(at(4, 1, before)).some((b) => b.startsWith("Catch-up: 1 word") && b.includes("сок / вода / пиво")), "and the agenda says so");
  // …unless they'd studied every drink on its own.
  const each = Object.fromEntries(["сок", "вода", "пиво"].map((k) => [k, familiarity.capture({ lexKey: k, kind: "word", display: k }, past)]));
  assert.deepEqual(newWords(at(4, 1, { ...before, ...each })), ["имам", "давам"], "drinks studied one by one aren't caught up");
}
console.log("today-plan.test.ts (studied words aren't new): all assertions passed ✓");
