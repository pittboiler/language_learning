// Spaced repetition over ReviewItems. Wraps `ts-fsrs` (FSRS) — we own the item↔card mapping
// and due selection; the library owns the scheduling math.
import type { ReviewItem } from "@ll/pack-schema";

export type Grade = "again" | "hard" | "good" | "easy";

export interface ReviewState {
  userId: string;
  itemId: string;
  due: Date;
  // fsrs card fields (stability, difficulty, reps, …) — shape provided by ts-fsrs
  card?: unknown;
}

/** Apply a grade to an item's state and return the next state (new items pass state=null). */
export function schedule(_state: ReviewState | null, _grade: Grade, _now: Date): ReviewState {
  throw new Error("not implemented: wrap ts-fsrs");
}

/** Items whose `due` <= now, ordered by urgency. */
export function dueItems(_states: ReviewState[], _now: Date): string[] {
  throw new Error("not implemented");
}

/** Assemble the next review batch from due ids + the active pack's item pool. */
export function nextBatch(_dueIds: string[], _pool: ReviewItem[], _size: number): ReviewItem[] {
  throw new Error("not implemented");
}
