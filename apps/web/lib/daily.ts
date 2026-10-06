// Pure daily-flow pacing helpers, extracted from page.tsx so they can be unit-tested without React.
// These decide how much new material a session introduces and how long a story/scenario "unit" stays
// in rotation before Today advances — the levers for a deliberately slow, repetition-first cadence.
import type { MiniStory } from "@ll/pack-schema";
import type { Progress } from "./store";

// ---- pacing knobs (deliberately slow, favouring repetition over new volume) ----
/** How many brand-new words a single session introduces — a HARD cap, including the words the unit's
 *  conversation requires. (It used to be max(cap, required), so day 1 of every chapter actually taught
 *  6; the knob said 3 and never applied on the day it mattered.) A chapter's required vocabulary is
 *  spread across its days instead, and the conversation waits until it has all been taught. */
export const NEW_WORDS_PER_SESSION = 3;
/** Distinct days a story/scenario unit stays in the daily flow before Today advances — so the same
 *  unit is revisited a few times (a fast learner still advances early once its words are "known"). */
export const UNIT_MIN_DAYS = 4;
/** Every Nth session introduces nothing new: warm-up, production from words already met, and a revisit
 *  of something already read. Consolidation you can count on rather than hope for. */
export const REVIEW_DAY_EVERY = 4;
/** Is the NEXT session (the one after `completedSessions`) a review-only day? */
export const isReviewDay = (completedSessions: number): boolean =>
  completedSessions > 0 && (completedSessions + 1) % REVIEW_DAY_EVERY === 0;
/** Due items the warm-up pulls. Bigger than it was: with less new material per day, revisiting fills
 *  the session instead — same time on task, more of it spent on words already met. */
export const WARMUP_ITEMS = 8;
/** A review day leans harder on the back catalogue. */
export const REVIEW_DAY_ITEMS = 14;

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

/** A word the daily flow can introduce. */
export interface NewWordCandidate { lexKey: string; gloss?: string }

/** What a session teaches, and whether the unit's conversation is ready to be attempted.
 *
 *  All three inputs are the words still NEW to the learner: the paired scenario's required vocabulary,
 *  the story's own, and the day-rotated trickle of core words. Required words get first claim — but the
 *  cap holds, so a chapter needing six words teaches three today and three tomorrow. `requiredLeft`
 *  reports what's still untaught after this session, which is what tells the planner to hold the
 *  speaking step back: producing a word you met ninety seconds ago isn't practice. */
export function planNewWords(opts: {
  required: NewWordCandidate[];
  storyWords: NewWordCandidate[];
  coreWords: NewWordCandidate[];
  /** Words that would unlock a sentence the learner could then build — taught ahead of the blind
   *  trickle, so production keeps appearing in the daily flow instead of waiting on luck. */
  priority?: NewWordCandidate[];
  dayIndex: number;
  cap?: number;
}): { teach: NewWordCandidate[]; requiredLeft: number } {
  const cap = opts.cap ?? NEW_WORDS_PER_SESSION;
  // Interleave the story's words with the core trickle so both are represented under one cap.
  const rot = opts.coreWords.length ? opts.dayIndex % opts.coreWords.length : 0;
  const core = [...opts.coreWords.slice(rot), ...opts.coreWords.slice(0, rot)];
  const fill: NewWordCandidate[] = [];
  for (let i = 0; i < Math.max(opts.storyWords.length, core.length); i++) {
    if (opts.storyWords[i]) fill.push(opts.storyWords[i]!);
    if (core[i]) fill.push(core[i]!);
  }
  const merged = new Map<string, NewWordCandidate>();
  for (const v of [...opts.required, ...(opts.priority ?? []), ...fill]) if (!merged.has(v.lexKey)) merged.set(v.lexKey, v);
  const teach = [...merged.values()].slice(0, cap);
  const taught = new Set(teach.map((w) => w.lexKey));
  return { teach, requiredLeft: opts.required.filter((v) => !taught.has(v.lexKey)).length };
}
