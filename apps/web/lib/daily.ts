// Pure daily-flow pacing helpers, extracted from page.tsx so they can be unit-tested without React.
// These decide how much new material a session introduces and how long a story/scenario "unit" stays
// in rotation before Today advances — the levers for a deliberately slow, repetition-first cadence.
import type { MiniStory } from "@ll/pack-schema";
import type { Progress } from "./store";

// ---- pacing knobs (deliberately slow, favouring repetition over new volume) ----
/** How many brand-new words a single session introduces. Small so each day is light and the same
 *  words recur (via warm-up + the unit repeating) instead of a big one-time dump. */
export const NEW_WORDS_PER_SESSION = 4;
/** Distinct days a story/scenario unit stays in the daily flow before Today advances — so the same
 *  unit is revisited a few times (a fast learner still advances early once its words are "known"). */
export const UNIT_MIN_DAYS = 2;

const pad2 = (n: number) => String(n).padStart(2, "0");
/** Local calendar day as YYYY-MM-DD (not UTC) — so streaks/repetition follow the learner's own days. */
export const localDay = (d = new Date()): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Record that today's daily-flow reading of a story happened (idempotent per local day). A unit
 *  repeats across UNIT_MIN_DAYS days before storyDone() lets Today advance to the next one. */
export const markStorySeen = (p: Progress, storyId: string, today = localDay()): Progress => {
  const days = p.storyReads?.[storyId] ?? [];
  if (days.includes(today)) return p;
  return { ...p, storyReads: { ...p.storyReads, [storyId]: [...days, today] } };
};

/** A story is "done" for the daily flow once it's been read on UNIT_MIN_DAYS distinct days (so the
 *  unit repeats), OR once every word it teaches is truly mastered ("known", so a returning learner
 *  isn't marched back through it). Words a story just seeded are only "learning", so a fresh unit is
 *  never retired early by the mastery clause. The legacy read-once flag still counts. */
export function storyDone(progress: Progress, story: MiniStory): boolean {
  if (progress.seenStories?.[story.id]) return true;
  if ((progress.storyReads?.[story.id]?.length ?? 0) >= UNIT_MIN_DAYS) return true;
  return story.registersVocab.length > 0 && story.registersVocab.every((v) => {
    const e = progress.familiarity[v.lexKey];
    return !!e && e.status === "known";
  });
}
