// Interleaving session builder — assembles a mixed-skill practice session (review, glyph, speak,
// grammar, write, read) instead of siloed blocks. Pure + language-agnostic (operates on the pack
// shape + generic progress signals; no language knowledge).
import type { LanguagePack } from "@ll/pack-schema";

export type ActivityKind = "review" | "glyph" | "scenario" | "grammar" | "writing" | "reading";

export interface Activity {
  kind: ActivityKind;
  ref: string; // id of the review item / glyph / scenario / grammar concept / writing task / reader
}

export interface SessionInputs {
  dueReviewIds: string[]; // from srs.dueItems, urgency-ordered
  lettersDone: boolean;
  unknownGlyphs: string[]; // focus glyphs not yet known
  completedScenarioIds: string[];
  completedWritingTaskIds?: string[];
}

export interface SessionPlan {
  activities: Activity[];
  estMinutes: number;
}

// Round-robin across skills so no two same-kind activities sit back-to-back while alternatives
// exist; review leads each round (spaced throughout the session).
const ORDER: ActivityKind[] = ["review", "glyph", "scenario", "grammar", "writing", "reading"];

export function buildSession(inputs: SessionInputs, pack: LanguagePack, opts?: { size?: number }): SessionPlan {
  const size = opts?.size ?? 8;
  const writingDone = new Set(inputs.completedWritingTaskIds ?? []);
  const pools: Record<ActivityKind, Activity[]> = {
    review: inputs.dueReviewIds.map((ref) => ({ kind: "review", ref })),
    glyph: (inputs.lettersDone ? [] : inputs.unknownGlyphs).map((ref) => ({ kind: "glyph", ref })),
    scenario: pack.scenarios.filter((s) => !inputs.completedScenarioIds.includes(s.id)).map((s) => ({ kind: "scenario", ref: s.id })),
    grammar: pack.grammar.filter((c) => c.drills.length > 0).map((c) => ({ kind: "grammar", ref: c.id })),
    writing: (pack.writingTasks ?? []).filter((t) => !writingDone.has(t.id)).map((t) => ({ kind: "writing", ref: t.id })),
    reading: pack.readers.map((r) => ({ kind: "reading", ref: r.id })),
  };

  const out: Activity[] = [];
  let progressed = true;
  while (out.length < size && progressed) {
    progressed = false;
    for (const k of ORDER) {
      const pool = pools[k];
      if (pool.length > 0 && out[out.length - 1]?.kind !== k) {
        out.push(pool.shift()!);
        progressed = true;
        if (out.length >= size) break;
      }
    }
  }
  return { activities: out, estMinutes: Math.max(1, Math.ceil(out.length * 1.5)) };
}
