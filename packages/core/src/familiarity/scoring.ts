// @ll/core/familiarity/scoring — the reusable content-difficulty service. Given any text + a
// FamiliarityIndex, compute the learner's known-word/known-chunk percentage so content can be
// selected or ranked at i+1. This is what makes the leveling engine's i+1 ACTUALLY computable
// (today it filters on a static authored i1Level). See DESIGN-comprehensible-input.md §2.2.
//
// Language-agnostic: tokenization is surface-form normalization (lowercase, strip punctuation).
// True lemmatization is language-specific and deferred — a pack may later supply normalizeHints.
import { normalize, type FamiliarityIndex } from "./index.js";

export interface Token {
  surface: string; // as it appears in the text
  lexKey: string; // normalized key, joins to FamiliarityIndex ("" for non-word runs)
  isWord: boolean; // false for punctuation/whitespace
}

/** Optional, pack-supplied normalization hints (e.g. clitic splits). Deferred; surface-form for MVP. */
export interface NormalizeHints {
  stripClitics?: string[];
  multiWordChunks?: string[]; // reserved: greedy chunk matching before single words
}

// A word run (letters/numbers, with internal apostrophes/hyphens) OR a run of everything else.
const TOKEN_RE = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*|[^\p{L}\p{N}]+/gu;

/** Split text into tokens with normalized lexKeys. */
export function tokenize(text: string, _hints?: NormalizeHints): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    const surface = m[0];
    const isWord = /[\p{L}\p{N}]/u.test(surface);
    out.push({ surface, lexKey: isWord ? normalize(surface) : "", isWord });
  }
  return out;
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** i+1 fit curve: 1 in the comprehensible-input sweet spot (~85–98% known), a gentle penalty when
 *  too easy (>98%, little new), ramping to 0 below ~50% known (frustrating). Tunable. */
export function iPlusOneCurve(knownPct: number): number {
  if (knownPct >= 0.85 && knownPct <= 0.98) return 1;
  if (knownPct > 0.98) return 0.7;
  return clamp01((knownPct - 0.5) / (0.85 - 0.5));
}

export interface TextScore {
  totalTokens: number; // word tokens only
  knownTokens: number;
  knownPct: number; // 0..1 — the headline comprehensibility number
  knownChunkPct: number; // 0..1 over recognized chunks (1 when none present)
  newItems: string[]; // lexKeys present but not yet tracked (capture candidates)
  learningItems: string[];
  /** 0..1 — how close this text is to ideal i+1. Drives ranking. */
  iPlusOneFit: number;
}

/** Score a text's comprehensibility for THIS learner. The reusable service the scenario engine,
 *  content selector, and import recommender all call. "known" counts status known + ignored. */
export function scoreText(text: string, index: FamiliarityIndex, hints?: NormalizeHints): TextScore {
  const words = tokenize(text, hints).filter((t) => t.isWord);
  const total = words.length;
  let known = 0;
  const newItems = new Set<string>();
  const learningItems = new Set<string>();
  for (const t of words) {
    const e = index[t.lexKey];
    if (!e || e.status === "new") newItems.add(t.lexKey);
    else if (e.status === "known" || e.status === "ignored") known++;
    else if (e.status === "learning") learningItems.add(t.lexKey);
  }
  // Known-chunk coverage: of the multi-word chunks that appear in the text, how many are known?
  const norm = normalize(text);
  const present = Object.values(index).filter((e) => e.kind === "chunk" && norm.includes(e.lexKey));
  const knownChunks = present.filter((e) => e.status === "known" || e.status === "ignored").length;
  const knownChunkPct = present.length ? knownChunks / present.length : 1;
  const knownPct = total ? known / total : 0;
  return {
    totalTokens: total,
    knownTokens: known,
    knownPct,
    knownChunkPct,
    newItems: [...newItems],
    learningItems: [...learningItems],
    iPlusOneFit: iPlusOneCurve(knownPct),
  };
}

/** Rank candidate texts by i+1 fit (closest to the comprehensible-input sweet spot first). */
export function rankByIPlusOne<T extends { text: string }>(items: T[], index: FamiliarityIndex): T[] {
  return [...items]
    .map((it) => ({ it, fit: scoreText(it.text, index).iPlusOneFit }))
    .sort((a, b) => b.fit - a.fit)
    .map((x) => x.it);
}

/** Compounding, functional progress metrics (preferred over raw streaks) — both motivational and the
 *  inputs to content selection. */
export interface ProgressMetrics {
  knownWordCount: number;
  learningCount: number;
  movedToKnownThisWeek: number;
}

export function computeMetrics(index: FamiliarityIndex, now: Date = new Date()): ProgressMetrics {
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  let knownWordCount = 0;
  let learningCount = 0;
  let movedToKnownThisWeek = 0;
  for (const e of Object.values(index)) {
    if (e.status === "known") {
      knownWordCount++;
      if (e.knownAt && new Date(e.knownAt) >= weekAgo) movedToKnownThisWeek++;
    } else if (e.status === "learning") {
      learningCount++;
    }
  }
  return { knownWordCount, learningCount, movedToKnownThisWeek };
}
