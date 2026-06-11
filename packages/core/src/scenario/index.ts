// Task-based scenario engine. Walks a Scenario's scripted turns and tracks which success criteria
// the learner has met (a learner turn marks its `satisfies` criteria when completed). Pure + generic.
import type { Scenario, DialogueTurn } from "@ll/pack-schema";

export interface ScenarioRun {
  scenarioId: string;
  turnIndex: number;
  metCriteria: string[]; // Criterion ids satisfied so far
  done: boolean; // walked past the last scripted turn
}

export function start(s: Scenario): ScenarioRun {
  return { scenarioId: s.id, turnIndex: 0, metCriteria: [], done: s.script.length === 0 };
}

export function currentTurn(run: ScenarioRun, s: Scenario): DialogueTurn | undefined {
  return s.script[run.turnIndex];
}

/** Mark criteria as met (idempotent). */
export function markMet(run: ScenarioRun, criterionIds: string[]): ScenarioRun {
  const set = new Set(run.metCriteria);
  for (const id of criterionIds) set.add(id);
  return { ...run, metCriteria: [...set] };
}

/** Advance to the next scripted turn; `done` flips true once past the end. */
export function advance(run: ScenarioRun, s: Scenario): ScenarioRun {
  const turnIndex = Math.min(run.turnIndex + 1, s.script.length);
  return { ...run, turnIndex, done: turnIndex >= s.script.length };
}

/**
 * Complete the current turn: if it's a learner turn, mark the criteria it satisfies, then advance.
 * (Partner turns just advance.) This mirrors the spike's per-turn criteria marking.
 */
export function completeTurn(run: ScenarioRun, s: Scenario): ScenarioRun {
  const turn = currentTurn(run, s);
  let next = run;
  if (turn?.speaker === "learner" && turn.satisfies?.length) next = markMet(next, turn.satisfies);
  return advance(next, s);
}

/** All success criteria satisfied? */
export function isComplete(run: ScenarioRun, s: Scenario): boolean {
  return s.successCriteria.every((c) => run.metCriteria.includes(c.id));
}

/** Progress as met/total criteria, for a checklist or nav badge. */
export function progress(run: ScenarioRun, s: Scenario): { met: number; total: number } {
  return { met: s.successCriteria.filter((c) => run.metCriteria.includes(c.id)).length, total: s.successCriteria.length };
}
