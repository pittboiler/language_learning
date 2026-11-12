// The end of a chapter (Jake and a tester, 2026-11-12). The checkpoint stays the gate between chapters, but Today
// no longer drops you straight into it: the chapter's last session offers a choice: practise this chapter,
// practise everything so far, or take the checkpoint, with the chapter summary a tap away. A practice round
// counts as the day's lesson and never moves the course on.
//
// The checkpoint has two parts, each kept once passed, so a later go only asks for what's left:
//   the cards: every word and grammar card of the chapter, your weakest few from earlier chapters, and
//     "switch the person" (then a few lines to say, unscored). To pass: 7 in 10 right on the first try.
//   the conversation: finish it.
// Stopping part-way, or putting the conversation off, never counts as a fail.
import type { CheckpointParts, Progress } from "./store";

export const CHECKPOINT_PASS = 0.7;
/** Your weakest words from earlier chapters that join a chapter's checkpoint, so it covers the course so far. */
export const CHECKPOINT_EARLIER = 5;
/** A practice round: the checkpoint's shape, smaller. */
export const PRACTICE = { words: 8, cards: 2, switches: 1, say: 1 };
/** "Everything so far" takes at most this many words from any one chapter, so it really spans them. */
export const PRACTICE_PER_CHAPTER = 3;

/** How many of `total` must be right first time to pass (7 in 10, rounded up). */
export const needed = (total: number): number => Math.ceil(total * CHECKPOINT_PASS - 1e-9);
export const cardsPass = (s: { got: number; total: number }): boolean => s.got >= needed(s.total);

export const partsOf = (p: Progress, chapterId: string): CheckpointParts => p.checkpoints?.[chapterId] ?? {};

const withParts = (p: Progress, chapterId: string, parts: CheckpointParts): Progress =>
  ({ ...p, checkpoints: { ...(p.checkpoints ?? {}), [chapterId]: parts } });

/** The cards part is done: a pass is kept, and either way this go is remembered (its misses lead the next practice). */
export function recordCards(p: Progress, chapterId: string, score: { got: number; total: number }, missed: string[], at = new Date()): Progress {
  const was = partsOf(p, chapterId);
  return withParts(p, chapterId, { ...was, ...(cardsPass(score) ? { cards: was.cards ?? at.toISOString() } : {}), last: { at: at.toISOString(), got: score.got, total: score.total, missed } });
}

/** The conversation part is passed (kept). */
export const recordConversation = (p: Progress, chapterId: string, at = new Date()): Progress =>
  withParts(p, chapterId, { ...partsOf(p, chapterId), conversation: partsOf(p, chapterId).conversation ?? at.toISOString() });

/** The chapter is checked off: its parts are no longer needed. */
export function clearParts(p: Progress, chapterId: string): Progress {
  if (!p.checkpoints?.[chapterId]) return p;
  const { [chapterId]: _gone, ...rest } = p.checkpoints;
  return { ...p, checkpoints: rest };
}

/** Is the checkpoint passed, counting parts passed on an earlier go? */
export const checkpointPassed = (parts: CheckpointParts, hasConversation: boolean): boolean =>
  !!parts.cards && (!hasConversation || !!parts.conversation);

/** Rough minutes for a round: half a minute a card, switch or line to say, five for a conversation; to the
 *  nearest five, never under five. */
export function roundMinutes(r: { cards: number; switches: number; say: number; conversation: boolean }): number {
  const raw = (r.cards + r.switches + r.say) / 2 + (r.conversation ? 5 : 0);
  return Math.max(5, Math.round(raw / 5) * 5);
}
