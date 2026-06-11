// Task-based scenario engine. Runs a Scenario and judges whether the learner met its goals.
import type { Scenario, Criterion } from "@ll/pack-schema";

export interface ScenarioRun {
  scenarioId: string;
  turnIndex: number;
  metCriteria: string[]; // Criterion ids satisfied so far
  done: boolean;
}

export function start(_s: Scenario): ScenarioRun {
  throw new Error("not implemented");
}

/** Advance the run with the learner's utterance; mark any newly-satisfied success criteria. */
export function evaluateTurn(_run: ScenarioRun, _utterance: string, _criteria: Criterion[]): ScenarioRun {
  throw new Error("not implemented");
}
