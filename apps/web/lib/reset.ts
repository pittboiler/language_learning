// The course cutover's fresh start (DESIGN-course-spine.md §10): keep only what the learner explicitly
// SAVED (★ starred words and grammar cards, with their review schedule and the sentences they were met in),
// their settings and alphabet, and clear everything else so they start the new course at chapter 1.
// Pure — the cutover script (scripts/cutover-course.ts) backs up first and applies this.
import * as familiarity from "@ll/core/familiarity";
import type { Progress } from "./store";
import { emptyProgress } from "./store";

export interface ResetSummary { kept: string[]; cleared: number; clearedFields: string[] }

export function freshStart(p: Progress, opts: { courseV2?: boolean } = {}): { next: Progress; summary: ResetSummary } {
  const kept = Object.entries(p.familiarity ?? {}).filter(([, e]) => !!e && familiarity.isStarred(e));
  const keys = new Set(kept.map(([k]) => k));
  const pick = (m?: Record<string, string>) => Object.fromEntries(Object.entries(m ?? {}).filter(([k]) => keys.has(k)));
  const next: Progress = {
    ...emptyProgress(),
    activePackId: p.activePackId ?? null,
    letters: p.letters ?? {},
    settings: { ...p.settings, ...(opts.courseV2 !== undefined ? { courseV2: opts.courseV2 } : {}) },
    familiarity: Object.fromEntries(kept),
    contexts: pick(p.contexts),
    contextGlosses: pick(p.contextGlosses),
  };
  const clearedFields = (Object.keys(p) as (keyof Progress)[]).filter((k) =>
    !["activePackId", "letters", "settings", "familiarity", "contexts", "contextGlosses", "savedAt"].includes(k) &&
    JSON.stringify(p[k] ?? null) !== JSON.stringify((next as unknown as Record<string, unknown>)[k] ?? null));
  return { next, summary: { kept: [...keys], cleared: Object.keys(p.familiarity ?? {}).length - keys.size, clearedFields } };
}
