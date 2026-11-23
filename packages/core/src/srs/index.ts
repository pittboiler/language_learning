// Spaced repetition over ReviewItems. Wraps `ts-fsrs` (FSRS) — we own the item↔card mapping and due
// selection; the library owns the scheduling math. Generic: no language knowledge.
import { fsrs, createEmptyCard, Rating, type Card, type Grade as FsrsGrade } from "ts-fsrs";
import type { ReviewItem } from "@ll/pack-schema";

export type Grade = "again" | "hard" | "good" | "easy";

export interface ReviewState {
  userId: string;
  itemId: string;
  due: Date;
  card: Card; // ts-fsrs card (stability, difficulty, reps, …)
}

const engine = fsrs(); // default FSRS-6 parameters

const GRADE_TO_RATING: Record<Grade, FsrsGrade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

/** Fresh state for a brand-new item. */
export function initState(userId: string, itemId: string, now: Date = new Date()): ReviewState {
  const card = createEmptyCard(now);
  return { userId, itemId, due: card.due, card };
}

/** Apply a grade and return the next state. */
export function schedule(state: ReviewState, grade: Grade, now: Date = new Date()): ReviewState {
  const { card } = engine.next(state.card, now, GRADE_TO_RATING[grade]);
  return { ...state, due: card.due, card };
}

/** How likely the item is still remembered at `now`, 0–1 (FSRS retrievability). A card never reviewed is 0:
 *  it has nothing to recall from yet. */
export function recallChance(state: ReviewState, now: Date = new Date()): number {
  if (!state.card.reps) return 0;
  const r = engine.get_retrievability(state.card, now, false);
  return Number.isFinite(r) ? r : 0;
}

/** Item ids whose `due` <= now, ordered by urgency (soonest first). */
export function dueItems(states: ReviewState[], now: Date = new Date()): string[] {
  return states
    .filter((s) => new Date(s.due).getTime() <= now.getTime())
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime())
    .map((s) => s.itemId);
}

/** Assemble the next review batch from due ids + the active pack's item pool. */
export function nextBatch(dueIds: string[], pool: ReviewItem[], size: number): ReviewItem[] {
  const byId = new Map(pool.map((it) => [it.id, it]));
  const out: ReviewItem[] = [];
  for (const id of dueIds) {
    const it = byId.get(id);
    if (it) out.push(it);
    if (out.length >= size) break;
  }
  return out;
}
