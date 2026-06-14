// @ll/core/roleswap — async voice role-swap: split a 2-role Scenario.script across two partners, each
// records their lines, stitch into a replayable conversation, coach each line via core/speaking. The
// flagship collaborative feature — it rehearses the north-star goal (two humans conversing). Reuses the
// existing Scenario (pack data) + the dual-ASR gate — NO language data here. See §3.3 / §5.3.
// Stubs only — bodies throw `not implemented`.
import type { Scenario } from "@ll/pack-schema";
import type { GateOutcome, SpeakingFeedback } from "../speaking/index.js";

/** The two Scenario speaker roles — now both assigned to humans instead of learner-vs-app. */
export type RoleSlot = "learner" | "partner";

export interface RoleSwapTurn {
  index: number; // position in Scenario.script
  speaker: RoleSlot; // which role owes this line
  recordedBy?: string; // userId who recorded it (undefined ⇒ awaiting)
  audioUrl?: string; // partner-media blob
  transcripts?: { scribe?: string; google?: string };
  feedback?: SpeakingFeedback; // per-line dual-ASR coaching
}

export interface RoleSwapSession {
  id: string;
  scenarioId: string;
  packId: string;
  assignment: Record<string /*userId*/, RoleSlot>;
  turns: RoleSwapTurn[];
  status: "recording" | "complete";
}

/** Build a session from a scenario + a role assignment (one turn per scripted line). */
export function startRoleSwap(s: Scenario, assignment: Record<string, RoleSlot>): RoleSwapSession {
  throw new Error("not implemented");
}

/** The next line THIS partner owes (their role, not yet recorded), or undefined if they're caught up. */
export function nextOpenTurn(session: RoleSwapSession, userId: string): RoleSwapTurn | undefined {
  throw new Error("not implemented");
}

/** Attach a partner's recording + transcripts to a turn (audio already uploaded to partner-media). */
export function recordTurn(
  session: RoleSwapSession,
  index: number,
  userId: string,
  audioUrl: string,
  transcripts: { scribe?: string; google?: string },
): RoleSwapSession {
  throw new Error("not implemented");
}

/** Attach dual-ASR coaching (from core/speaking) to a recorded turn. */
export function attachFeedback(
  session: RoleSwapSession,
  index: number,
  gate: GateOutcome,
  feedback: SpeakingFeedback,
): RoleSwapSession {
  throw new Error("not implemented");
}

/** True once every turn is recorded — the conversation can be stitched + replayed end-to-end. */
export function isStitchable(session: RoleSwapSession): boolean {
  throw new Error("not implemented");
}
