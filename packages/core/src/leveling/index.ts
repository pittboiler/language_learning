// Comprehensible-input (i+1) model: estimate the learner's level, serve content just above it.
import type { CefrBand, Skill } from "@ll/pack-schema";

export interface LevelState {
  cefrBand: CefrBand;
  skillVector: Record<Skill, number>; // 0..1 per skill
}

/** Estimate current level from progress/review history. */
export function currentLevel(_history: unknown): LevelState {
  throw new Error("not implemented");
}

/** Pick items just above the learner's current level (i+1). */
export function selectAtIPlusOne<T extends { i1Level: number }>(_pool: T[], _level: LevelState): T[] {
  throw new Error("not implemented");
}
