// @ll/core/familiarity/scoring — the reusable content-difficulty service. Given any text + a
// FamiliarityIndex, compute the learner's known-word/known-chunk percentage so content can be
// selected or ranked at i+1. This is what makes the leveling engine's i+1 ACTUALLY computable
// (today it filters on a static authored i1Level). See DESIGN-comprehensible-input.md §2.2.
//
// Language-agnostic: tokenization is surface-form normalization (lowercase, strip punctuation/clitics).
// True lemmatization is language-specific and deferred — a pack may later supply normalizeHints.
//
// STATUS: stubs only — bodies throw `not implemented`.
import type { FamiliarityIndex } from "./index.js";

export interface Token {
  surface: string; // as it appears in the text
  lexKey: string; // normalized key, joins to FamiliarityIndex
  isWord: boolean; // false for punctuation/whitespace
}

/** Optional, pack-supplied normalization hints (e.g. clitic splits). Deferred; surface-form for MVP. */
export interface NormalizeHints {
  stripClitics?: string[];
  multiWordChunks?: string[]; // known chunk surfaces to match greedily before single words
}

/** Split text into tokens with normalized lexKeys (greedy multi-word chunk match when hints provided). */
export function tokenize(_text: string, _hints?: NormalizeHints): Token[] {
  throw new Error("not implemented: normalize → tokens (+ greedy chunk matching)");
}

export interface TextScore {
  totalTokens: number; // word tokens only
  knownTokens: number;
  knownPct: number; // 0..1 — the headline comprehensibility number
  knownChunkPct: number; // 0..1 over recognized chunks
  newItems: string[]; // lexKeys present but not yet tracked (capture candidates)
  learningItems: string[];
  /** 0..1 — how close this text is to ideal i+1 (peaks ~0.85–0.95 known). Drives ranking. */
  iPlusOneFit: number;
}

/** Score a text's comprehensibility for THIS learner. The reusable service the scenario engine,
 *  content selector, and import recommender all call. */
export function scoreText(_text: string, _index: FamiliarityIndex, _hints?: NormalizeHints): TextScore {
  throw new Error("not implemented: tokenize → join to index → known%/i+1 fit");
}

/** Rank candidate texts by i+1 fit (closest to the comprehensible-input sweet spot first). */
export function rankByIPlusOne<T extends { text: string }>(_items: T[], _index: FamiliarityIndex): T[] {
  throw new Error("not implemented: scoreText each → sort by iPlusOneFit desc");
}

/** Compounding, functional progress metrics (preferred over raw streaks) — both motivational and the
 *  inputs to content selection. */
export interface ProgressMetrics {
  knownWordCount: number;
  learningCount: number;
  movedToKnownThisWeek: number;
}

export function computeMetrics(_index: FamiliarityIndex, _now?: Date): ProgressMetrics {
  throw new Error("not implemented: tally by status + status-transition timestamps");
}
