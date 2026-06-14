// @ll/core/roleswap — async voice role-swap: split a 2-role Scenario.script across two partners, each
// records their lines, stitch into a replayable conversation, coach each line via core/speaking. The
// flagship collaborative feature — it rehearses the north-star goal (two humans conversing). Reuses the
// existing Scenario (pack data) + the dual-ASR gate — NO language data here. Pure session logic; the
// session (incl. recorded audio as data-URLs for the MVP) is persisted by the app as a partner_artifact.
// See DESIGN-partnered-learning.md §3.3 / §5.3.
import type { Scenario } from "@ll/pack-schema";
import type { SpeakingFeedback } from "../speaking/index.js";

/** The two Scenario speaker roles — now both assigned to humans instead of learner-vs-app. */
export type RoleSlot = "learner" | "partner";

export interface RoleSwapTurn {
  index: number; // position in Scenario.script
  speaker: RoleSlot; // which role owes this line
  text: string; // the scripted target-language line (what the assignee says)
  gloss: string; // English
  translit?: string;
  recordedBy?: string; // userId who recorded it (undefined ⇒ awaiting)
  audio?: string; // recorded audio as a data-URL (MVP; Storage is the scale path)
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

/** Assign one partner the 'learner' lines and the other the 'partner' lines. */
export function assignRoles(learnerUserId: string, partnerUserId: string): Record<string, RoleSlot> {
  return { [learnerUserId]: "learner", [partnerUserId]: "partner" };
}

/** Build a session from a scenario + a role assignment (one turn per scripted line). */
export function startRoleSwap(id: string, packId: string, s: Scenario, assignment: Record<string, RoleSlot>): RoleSwapSession {
  const turns: RoleSwapTurn[] = s.script.map((t, index) => ({ index, speaker: t.speaker, text: t.text, gloss: t.gloss, translit: t.translit }));
  return { id, scenarioId: s.id, packId, assignment, turns, status: turns.length ? "recording" : "complete" };
}

/** All turns this partner is responsible for (their assigned role). */
export function myTurns(session: RoleSwapSession, userId: string): RoleSwapTurn[] {
  const role = session.assignment[userId];
  return session.turns.filter((t) => t.speaker === role);
}

/** The next line THIS partner owes (their role, not yet recorded), or undefined if they're caught up. */
export function nextOpenTurn(session: RoleSwapSession, userId: string): RoleSwapTurn | undefined {
  const role = session.assignment[userId];
  return session.turns.find((t) => t.speaker === role && !t.recordedBy);
}

const allRecorded = (turns: RoleSwapTurn[]): boolean => turns.length > 0 && turns.every((t) => !!t.recordedBy);

/** Attach a partner's recording (data-URL) + transcripts to a turn. Guards that you only record your
 *  own role's lines. Flips the session to 'complete' once every line is in. */
export function recordTurn(
  session: RoleSwapSession,
  index: number,
  userId: string,
  audio: string,
  transcripts: { scribe?: string; google?: string },
): RoleSwapSession {
  const turn = session.turns[index];
  if (!turn) throw new Error(`no turn ${index}`);
  if (session.assignment[userId] !== turn.speaker) throw new Error("can only record your own role's lines");
  const turns = session.turns.map((t) => (t.index === index ? { ...t, recordedBy: userId, audio, transcripts } : t));
  return { ...session, turns, status: allRecorded(turns) ? "complete" : "recording" };
}

/** Attach dual-ASR coaching (from core/speaking) to a recorded turn. */
export function attachFeedback(session: RoleSwapSession, index: number, feedback: SpeakingFeedback): RoleSwapSession {
  const turns = session.turns.map((t) => (t.index === index ? { ...t, feedback } : t));
  return { ...session, turns };
}

/** True once every turn is recorded — the conversation can be stitched + replayed end-to-end. */
export function isStitchable(session: RoleSwapSession): boolean {
  return session.turns.length > 0 && session.turns.every((t) => !!t.audio);
}

/** Progress for a partner (how many of their lines are done) + overall. */
export function progress(session: RoleSwapSession, userId: string): { mine: { done: number; total: number }; overall: { done: number; total: number } } {
  const mine = myTurns(session, userId);
  return {
    mine: { done: mine.filter((t) => t.recordedBy).length, total: mine.length },
    overall: { done: session.turns.filter((t) => t.recordedBy).length, total: session.turns.length },
  };
}
