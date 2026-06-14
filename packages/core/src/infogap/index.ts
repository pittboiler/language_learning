// @ll/core/infogap — forced interdependence: each partner holds DIFFERENT information and a shared task
// neither can finish alone, forcing real target-language exchange with genuine stakes (no free-riding,
// no carrying). Runs over asymmetric InfoGapTask pack content (generated offline by pipeline/infogap).
// Reuses core/speaking (spoken turns) + core/tutor (discreet rescue hint). Language-agnostic.
// See §3.3 / §3.4 / §5.7. Stubs only — bodies throw `not implemented`.
import type { InfoGapTask, InfoGapRole } from "@ll/pack-schema";

export interface InfoGapSession {
  id: string;
  taskId: string;
  packId: string;
  roles: Record<string /*userId*/, "A" | "B">;
  metCriteria: string[];
  status: "open" | "complete";
}

/** Begin a run of an asymmetric task by a specific pair (each user pinned to role A or B). */
export function startInfoGap(task: InfoGapTask, roles: Record<string, "A" | "B">): InfoGapSession {
  throw new Error("not implemented");
}

/** The brief THIS partner sees — their half only (their secret-info, never the other's). The asymmetry
 *  IS the task; never return both roles to one client. */
export function briefFor(task: InfoGapTask, role: "A" | "B"): InfoGapRole {
  throw new Error("not implemented");
}

export function markMet(session: InfoGapSession, criterionIds: string[]): InfoGapSession {
  throw new Error("not implemented");
}

/** Complete only when the gap is bridged — all success criteria met through real exchange. */
export function isComplete(session: InfoGapSession, task: InfoGapTask): boolean {
  throw new Error("not implemented");
}
