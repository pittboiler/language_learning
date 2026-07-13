// Runnable checks for the daily-flow pacing helpers: the new-words cap, and the multi-day rule that
// keeps a story/scenario unit in rotation for repetition before Today advances. The subtle case is the
// "mastery" escape hatch — freshly-seeded story words are only "learning", so they must NOT retire a
// unit after one day; only genuinely "known" vocab (mastered elsewhere) should.
//   Run with: npx tsx apps/web/test/daily.test.ts
import assert from "node:assert/strict";
import type { MiniStory } from "@ll/pack-schema";
import type { Progress } from "../lib/store.js";
import { NEW_WORDS_PER_SESSION, UNIT_MIN_DAYS, localDay, markStorySeen, storyDone } from "../lib/daily.js";

// Minimal builders — storyDone/markStorySeen only touch the fields below.
const prog = (over: Partial<Progress> = {}): Progress => ({ familiarity: {}, seenStories: {}, storyReads: {}, ...over } as Progress);
const story = (id: string, vocab: { lexKey: string }[] = []): MiniStory => ({ id, registersVocab: vocab } as MiniStory);
const fam = (lexKey: string, status: string) => ({ [lexKey]: { lexKey, status } });

// 0. Pacing knobs are the slowed-down values.
assert.equal(NEW_WORDS_PER_SESSION, 4, "new words per session dialed down to 4");
assert.equal(UNIT_MIN_DAYS, 2, "a unit repeats across 2 distinct days");

// 1. markStorySeen records a distinct local day, idempotent within the same day.
const p1 = markStorySeen(prog(), "s1", "2026-07-13");
assert.deepEqual(p1.storyReads!["s1"], ["2026-07-13"], "first read recorded");
const p1again = markStorySeen(p1, "s1", "2026-07-13");
assert.equal(p1again, p1, "same-day re-read is a no-op (identity returned)");
const p2 = markStorySeen(p1, "s1", "2026-07-14");
assert.deepEqual(p2.storyReads!["s1"], ["2026-07-13", "2026-07-14"], "a second day accumulates");

// 2. storyDone follows the day count: not done after one day, done after UNIT_MIN_DAYS.
const s = story("s1", [{ lexKey: "здраво" }]);
assert.equal(storyDone(prog({ storyReads: { s1: ["2026-07-13"] } }), s), false, "one day read ⇒ still in rotation (repeats)");
assert.equal(storyDone(prog({ storyReads: { s1: ["2026-07-13", "2026-07-14"] } }), s), true, "two distinct days ⇒ advance");

// 3. Mastery escape hatch: only truly "known" vocab retires a unit early — NOT freshly-seeded
//    "learning" words (the bug the capture-status fix guards against).
assert.equal(storyDone(prog({ familiarity: fam("здраво", "learning") as Progress["familiarity"] }), s), false,
  "just-seeded 'learning' vocab must NOT retire a fresh unit after day one");
assert.equal(storyDone(prog({ familiarity: fam("здраво", "known") as Progress["familiarity"] }), s), true,
  "genuinely mastered ('known') vocab ⇒ don't march a returning learner back through it");

// 4. Legacy read-once flag is still honored (old profiles stay done).
assert.equal(storyDone(prog({ seenStories: { s1: true } }), s), true, "legacy seenStories flag still counts");

// 5. localDay is zero-padded YYYY-MM-DD.
assert.match(localDay(new Date(2026, 0, 5)), /^2026-01-05$/, "localDay zero-pads month/day");

console.log("daily.test.ts: all assertions passed ✓");
