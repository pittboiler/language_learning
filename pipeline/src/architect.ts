import type { LanguageProfile } from "./profiler.js";

export interface SkillNode {
  id: string;
  dependsOn: string[];
  scenarioIds: string[];
}

export interface Curriculum {
  skillTree: SkillNode[];
  scenarioSequence: string[]; // ordered toward the conversation goal
}

/** Opus 4.8, offline. Turn a profile into a leveled skill tree + scenario sequence, built
 *  BACKWARDS from the bar-conversation goal. */
export async function architect(_profile: LanguageProfile): Promise<Curriculum> {
  throw new Error("not implemented");
}
