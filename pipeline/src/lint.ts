import type { GrammarConcept } from "@ll/pack-schema";

// Language-agnostic STRUCTURAL lint for grammar drills. The line-level Validator checks whether the
// answer text is correct, natural Bulgarian/etc. — but it never sees the option SET, so it can't
// catch a malformed multiple-choice (duplicate distractors, an answer missing from its own options,
// or too few options). This pure structural check fills that gap with no LLM call. Run it in the
// batch (every generation) and standalone over any committed pack.

export type DrillLintKind = "duplicate-options" | "answer-not-in-options" | "too-few-options";

export interface DrillLintIssue {
  conceptId: string;
  drillId: string;
  kind: DrillLintKind;
  detail: string;
}

/** Structural issues across a pack's grammar drills (empty array ⇒ all drills are well-formed). */
export function lintDrills(concepts: GrammarConcept[]): DrillLintIssue[] {
  const issues: DrillLintIssue[] = [];
  for (const c of concepts) {
    for (const d of c.drills) {
      const opts = d.options ?? [];
      if (opts.length < 2) {
        issues.push({ conceptId: c.id, drillId: d.id, kind: "too-few-options", detail: `${opts.length} option(s) — a multiple-choice drill needs ≥2` });
      }
      const dupes = [...new Set(opts.filter((o, i) => opts.indexOf(o) !== i))];
      if (dupes.length) {
        issues.push({ conceptId: c.id, drillId: d.id, kind: "duplicate-options", detail: `duplicate option(s): ${dupes.map((o) => `"${o}"`).join(", ")}` });
      }
      if (opts.length > 0 && !opts.includes(d.answer)) {
        issues.push({ conceptId: c.id, drillId: d.id, kind: "answer-not-in-options", detail: `answer "${d.answer}" is not among the options` });
      }
    }
  }
  return issues;
}
