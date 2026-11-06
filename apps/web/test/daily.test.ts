// Runnable checks for the daily-flow pacing helpers: the new-words cap, and the multi-day rule that
// keeps a story/scenario unit in rotation for repetition before Today advances. The subtle case is the
// "mastery" escape hatch — freshly-seeded story words are only "learning", so they must NOT retire a
// unit after one day; only genuinely "known" vocab (mastered elsewhere) should.
//   Run with: npx tsx apps/web/test/daily.test.ts
import assert from "node:assert/strict";
import type { MiniStory } from "@ll/pack-schema";
import type { Progress } from "../lib/store.js";
import { NEW_WORDS_PER_SESSION, UNIT_MIN_DAYS, REVIEW_DAY_EVERY, bumpStreak, currentStreak, isReviewDay, lastWeek, localDay, markStorySeen, planNewWords, practiceDays, storyDone } from "../lib/daily.js";

// Minimal builders — storyDone/markStorySeen only touch the fields below.
const prog = (over: Partial<Progress> = {}): Progress => ({ familiarity: {}, seenStories: {}, storyReads: {}, ...over } as Progress);
const story = (id: string, vocab: { lexKey: string }[] = []): MiniStory => ({ id, registersVocab: vocab } as MiniStory);
const fam = (lexKey: string, status: string) => ({ [lexKey]: { lexKey, status } });

// 0. Pacing knobs are the slowed-down values.
assert.equal(NEW_WORDS_PER_SESSION, 3, "at most 3 brand-new words in a session — a hard cap, required vocab included");
assert.equal(UNIT_MIN_DAYS, 4, "a unit repeats across 4 distinct days");

// 1. markStorySeen records a distinct local day, idempotent within the same day.
const p1 = markStorySeen(prog(), "s1", "2026-07-13");
assert.deepEqual(p1.storyReads!["s1"], ["2026-07-13"], "first read recorded");
const p1again = markStorySeen(p1, "s1", "2026-07-13");
assert.equal(p1again, p1, "same-day re-read is a no-op (identity returned)");
const p2 = markStorySeen(p1, "s1", "2026-07-14");
assert.deepEqual(p2.storyReads!["s1"], ["2026-07-13", "2026-07-14"], "a second day accumulates");

// 2. storyDone follows the day count: not done until UNIT_MIN_DAYS distinct days have been read.
const s = story("s1", [{ lexKey: "здраво" }]);
assert.equal(storyDone(prog({ storyReads: { s1: ["2026-07-13"] } }), s), false, "one day read ⇒ still in rotation (repeats)");
assert.equal(storyDone(prog({ storyReads: { s1: ["2026-07-13", "2026-07-14", "2026-07-15"] } }), s), false, "three days ⇒ still repeating");
assert.equal(storyDone(prog({ storyReads: { s1: ["2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16"] } }), s), true, "four distinct days ⇒ advance");

// 3. Mastery escape hatch: only truly "known" vocab retires a unit early — NOT freshly-seeded
//    "learning" words (the bug the capture-status fix guards against).
assert.equal(storyDone(prog({ familiarity: fam("здраво", "learning") as Progress["familiarity"] }), s), false,
  "just-seeded 'learning' vocab must NOT retire a fresh unit after day one");
assert.equal(storyDone(prog({ familiarity: fam("здраво", "known") as Progress["familiarity"] }), s), true,
  "genuinely mastered ('known') vocab ⇒ don't march a returning learner back through it");

// 4. Legacy read-once flag is still honored (old profiles stay done).
assert.equal(storyDone(prog({ seenStories: { s1: true } }), s), true, "legacy seenStories flag still counts");

// 4b. Every REVIEW_DAY_EVERY-th session is review-only, counted from sessions already finished. The
//     very first session is never one (there'd be nothing to review).
assert.equal(isReviewDay(0), false, "no review day before anything has been learned");
assert.deepEqual(
  [1, 2, 3, 4, 5, 6, 7, 8].map(isReviewDay),
  [false, false, true, false, false, false, true, false],
  "the 4th and 8th sessions are review days",
);
assert.equal(REVIEW_DAY_EVERY, 4);

// 4c. planNewWords: the cap is HARD, and the conversation waits for its vocabulary.
const w = (n: number, p = "r") => Array.from({ length: n }, (_, i) => ({ lexKey: `${p}${i}` }));
// A chapter needing six words no longer dumps all six on day one.
const day1 = planNewWords({ required: w(6), storyWords: w(4, "s"), coreWords: w(9, "c"), dayIndex: 0 });
assert.equal(day1.teach.length, NEW_WORDS_PER_SESSION, "day 1 teaches the cap, not the whole required set");
assert.deepEqual(day1.teach.map((x) => x.lexKey), ["r0", "r1", "r2"], "required words get first claim");
assert.equal(day1.requiredLeft, 3, "three required words still untaught ⇒ the speaking step waits");
// Day 2: the three it couldn't fit are what's still new, so they're taught and the conversation opens.
const day2 = planNewWords({ required: w(3), storyWords: w(4, "s"), coreWords: w(9, "c"), dayIndex: 1 });
assert.equal(day2.requiredLeft, 0, "once the required words are taught, the conversation is ready");
// Later days: nothing required left, so the slots go to the story's words and the core trickle.
const day3 = planNewWords({ required: [], storyWords: w(4, "s"), coreWords: w(9, "c"), dayIndex: 2 });
assert.equal(day3.teach.length, 3);
assert.equal(day3.requiredLeft, 0);
assert.ok(day3.teach.some((x) => x.lexKey.startsWith("s")) && day3.teach.some((x) => x.lexKey.startsWith("c")),
  "story words and the core trickle are interleaved under the one cap");
// The trickle rotates by day, so a learner doesn't see the same core words every session.
const rotA = planNewWords({ required: [], storyWords: [], coreWords: w(9, "c"), dayIndex: 0 }).teach.map((x) => x.lexKey);
const rotB = planNewWords({ required: [], storyWords: [], coreWords: w(9, "c"), dayIndex: 3 }).teach.map((x) => x.lexKey);
assert.notDeepEqual(rotA, rotB, "the core trickle rotates with the day");
// Priority words (ones that unlock a buildable sentence) are taught ahead of the blind trickle, but
// still behind the chapter's own required vocabulary and still under the cap.
const aimed = planNewWords({ required: w(1), storyWords: w(4, "s"), coreWords: w(9, "c"), priority: [{ lexKey: "unlock" }], dayIndex: 0 });
assert.deepEqual(aimed.teach.map((x) => x.lexKey), ["r0", "unlock", "s0"], "required first, then the word that unlocks production");
const aimedFull = planNewWords({ required: w(3), storyWords: w(4, "s"), coreWords: w(9, "c"), priority: [{ lexKey: "unlock" }], dayIndex: 0 });
assert.ok(!aimedFull.teach.some((x) => x.lexKey === "unlock"), "a full day of required words still isn't overflowed by the priority word");

// Nothing new left anywhere ⇒ an empty teach list (the step is skipped), not a crash.
assert.deepEqual(planNewWords({ required: [], storyWords: [], coreWords: [], dayIndex: 5 }), { teach: [], requiredLeft: 0 });

// 5. localDay is zero-padded YYYY-MM-DD.
assert.match(localDay(new Date(2026, 0, 5)), /^2026-01-05$/, "localDay zero-pads month/day");

// The habit (Jake, 2026-11-06: "I did it multiple times this past week and it only shows me having done one").
{
  const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 18);
  // Practice Mon 2, Wed 4, Thu 5, Sat 7 Nov: the streak restarts after each gap, but every day is kept.
  let p = prog();
  for (const d of [2, 4, 5, 7]) p = bumpStreak(p, at(2026, 11, d));
  p = bumpStreak(p, at(2026, 11, 7)); // a second activity the same day changes nothing
  assert.deepEqual(p.activeDays, ["2026-11-02", "2026-11-04", "2026-11-05", "2026-11-07"]);
  assert.deepEqual(p.streak, { count: 1, lastDay: "2026-11-07" }, "Saturday follows a gap: a run of one");
  const week = lastWeek(p, at(2026, 11, 8));
  assert.equal(week.filter((d) => d.on).length, 4, "the week shows all four days, not just the latest run");
  assert.deepEqual(week.map((d) => d.on), [true, false, true, true, false, true, false]);
  assert.ok(week[6]!.today && !week[5]!.today);
  assert.equal(currentStreak(p, at(2026, 11, 8)), 1, "yesterday counts");
  assert.equal(currentStreak(p, at(2026, 11, 9)), 0, "two days later it has lapsed");
  // Back-to-back days grow the streak, across a month end.
  let q = prog();
  for (const [m, d] of [[10, 30], [10, 31], [11, 1]] as const) q = bumpStreak(q, at(2026, m, d));
  assert.deepEqual(q.streak, { count: 3, lastDay: "2026-11-01" });
  // Practice from before days were recorded still shows: each lesson in the course log, and the streak's run.
  const old = prog({ streak: { count: 2, lastDay: "2026-11-06" }, courseLog: [
    { chapterId: "c", n: 1, startedAt: at(2026, 11, 2).toISOString(), at: at(2026, 11, 2).toISOString() },
    { chapterId: "c", n: 2, startedAt: at(2026, 11, 4).toISOString(), at: at(2026, 11, 4).toISOString() },
  ] });
  assert.deepEqual([...practiceDays(old)].sort(), ["2026-11-02", "2026-11-04", "2026-11-05", "2026-11-06"]);
  assert.equal(lastWeek(old, at(2026, 11, 7)).filter((d) => d.on).length, 4);
}

console.log("daily.test.ts: all assertions passed ✓");
