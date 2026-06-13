// Comprehensible-input (i+1) model: estimate the learner's level from generic progress signals,
// then serve content just above it. Generic: inputs are counts, not language facts.
import type { CefrBand, Skill } from "@ll/pack-schema";
import { rankByIPlusOne } from "../familiarity/scoring.js";
import type { FamiliarityIndex } from "../familiarity/index.js";

export interface LevelState {
  cefrBand: CefrBand;
  skillVector: Record<Skill, number>; // 0..1 per skill
}

/** Generic progress signals the app can compute from its own state (no language knowledge). */
export interface LevelInputs {
  glyphsKnown: number;
  glyphsTotal: number;
  criteriaMet: number; // success criteria met across scenarios
  reviewStrength: number; // e.g. sum of SRS reps / count of maturing items
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** Map a CEFR band to an i+1 numeric ceiling (pre-A1→1, A1→2, A2→3). */
export function bandToLevel(band: CefrBand): number {
  return band === "pre-A1" ? 1 : band === "A1" ? 2 : 3;
}

/** Estimate current level from progress signals. */
export function currentLevel(inputs: LevelInputs): LevelState {
  const xp = inputs.glyphsKnown * 5 + inputs.criteriaMet * 10 + inputs.reviewStrength * 3;
  const cefrBand: CefrBand = xp < 40 ? "pre-A1" : xp < 150 ? "A1" : "A2";
  const skillVector: Record<Skill, number> = {
    alphabet: clamp01(inputs.glyphsTotal ? inputs.glyphsKnown / inputs.glyphsTotal : 0),
    speaking: clamp01(inputs.criteriaMet / 12),
    listening: clamp01(inputs.criteriaMet / 12),
    reading: clamp01(inputs.reviewStrength / 30),
    writing: 0,
  };
  return { cefrBand, skillVector };
}

/** Pick items at or just above the learner's current level (i+1) by the STATIC authored i1Level.
 *  The cold-start prior; superseded by rankAtIPlusOne once the learner has real familiarity data. */
export function selectAtIPlusOne<T extends { i1Level: number }>(pool: T[], level: LevelState): T[] {
  const ceiling = bandToLevel(level.cefrBand) + 1;
  return pool.filter((it) => it.i1Level <= ceiling).sort((a, b) => a.i1Level - b.i1Level);
}

/** Rank content at i+1 using the learner's COMPUTED comprehension (familiarity/scoring) once the
 *  index has enough known items; falls back to the static i1Level prior at cold start. This is the
 *  "i+1 made computable" payoff — content with `text` is ranked by real known-word %, not authoring. */
export function rankAtIPlusOne<T extends { text: string; i1Level?: number }>(
  items: T[],
  index: FamiliarityIndex,
  opts?: { minKnown?: number },
): T[] {
  const known = Object.values(index).filter((e) => e.status === "known").length;
  if (known < (opts?.minKnown ?? 15)) {
    return [...items].sort((a, b) => (a.i1Level ?? 0) - (b.i1Level ?? 0)); // cold start: static prior
  }
  return rankByIPlusOne(items, index);
}
