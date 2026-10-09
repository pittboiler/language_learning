// @ll/core/exam/results — the pure half of exam marking (no LLM): the grade shape, a self-check grade, and
// the roll-up of task results into the exam's can-do results. Safe to import in the browser.

export type CanDoResult = "met" | "partly" | "not-yet";

export interface ExamGrade {
  /** One per task step, by 0-based index: was it got across? */
  steps: { index: number; done: "yes" | "partly" | "no" }[];
  canDos: { id: string; result: CanDoResult; note: string }[];
  /** Up to four, most useful first: what they wrote/said, the corrected line, and why. */
  corrections: { wrote: string; better: string; why: string }[];
  summary: string;
  /** Speech only: neither transcript was usable, so nothing was judged (the learner checks themselves). */
  unclear: boolean;
}

/** A self-check (speech the engines couldn't hear, or no mic): the learner compares themselves with the
 *  model answer, step by step, and the can-dos follow from the steps they say they got across. */
export function selfCheckGrade(steps: ("yes" | "partly" | "no")[], canDoIds: string[]): ExamGrade {
  const score = steps.reduce((n, s) => n + (s === "yes" ? 1 : s === "partly" ? 0.5 : 0), 0) / (steps.length || 1);
  const result: CanDoResult = score >= 0.8 ? "met" : score >= 0.25 ? "partly" : "not-yet";
  return {
    steps: steps.map((done, index) => ({ index, done })),
    canDos: canDoIds.map((id) => ({ id, result, note: "From your own check against the model answer." })),
    corrections: [],
    summary: "",
    unclear: false,
  };
}

/** Roll the tasks' can-do results up into the exam's. A can-do assessed by several tasks counts as met only
 *  if every one of them met it, not-yet only if none did, and partly otherwise; one never assessed is absent. */
export function combineResults(grades: Pick<ExamGrade, "canDos">[]): Record<string, CanDoResult> {
  const by = new Map<string, CanDoResult[]>();
  for (const g of grades) for (const c of g.canDos) by.set(c.id, [...(by.get(c.id) ?? []), c.result]);
  const out: Record<string, CanDoResult> = {};
  for (const [id, rs] of by) out[id] = rs.every((r) => r === "met") ? "met" : rs.every((r) => r === "not-yet") ? "not-yet" : "partly";
  return out;
}
