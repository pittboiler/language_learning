// @ll/core/infogap — forced interdependence: each partner holds DIFFERENT information and a shared task
// neither can finish alone, forcing real target-language exchange with genuine stakes (no free-riding,
// no carrying). Runs over asymmetric InfoGapTask pack content. Reuses core/speaking (spoken turns) +
// core/tutor (discreet rescue hint) at the app layer. Language-agnostic; the session is persisted by
// the app as a partner_artifact. See DESIGN-partnered-learning.md §3.3 / §3.4 / §5.7.
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
export function startInfoGap(id: string, packId: string, task: InfoGapTask, roles: Record<string, "A" | "B">): InfoGapSession {
  return { id, taskId: task.id, packId, roles, metCriteria: [], status: task.successCriteria.length ? "open" : "complete" };
}

/** The brief THIS partner sees — their half only (their secret-info, never the other's). The asymmetry
 *  IS the task; never return both roles to one client. */
export function briefFor(task: InfoGapTask, role: "A" | "B"): InfoGapRole {
  return role === "A" ? task.roleA : task.roleB;
}

export function roleOf(session: InfoGapSession, userId: string): "A" | "B" | undefined {
  return session.roles[userId];
}

const withStatus = (session: InfoGapSession, task: InfoGapTask): InfoGapSession => ({
  ...session,
  status: isComplete(session, task) ? "complete" : "open",
});

/** Mark criteria satisfied (idempotent union), recomputing completion. */
export function markMet(session: InfoGapSession, task: InfoGapTask, criterionIds: string[]): InfoGapSession {
  return withStatus({ ...session, metCriteria: [...new Set([...session.metCriteria, ...criterionIds])] }, task);
}

/** Tick/untick one criterion (for the shared checklist UI), recomputing completion. */
export function toggleCriterion(session: InfoGapSession, task: InfoGapTask, criterionId: string): InfoGapSession {
  const has = session.metCriteria.includes(criterionId);
  const metCriteria = has ? session.metCriteria.filter((c) => c !== criterionId) : [...session.metCriteria, criterionId];
  return withStatus({ ...session, metCriteria }, task);
}

/** Complete only when the gap is bridged — all success criteria met through real exchange. */
export function isComplete(session: InfoGapSession, task: InfoGapTask): boolean {
  return task.successCriteria.length > 0 && task.successCriteria.every((c) => session.metCriteria.includes(c.id));
}

export function progress(session: InfoGapSession, task: InfoGapTask): { met: number; total: number } {
  return { met: task.successCriteria.filter((c) => session.metCriteria.includes(c.id)).length, total: task.successCriteria.length };
}
