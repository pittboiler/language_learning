// @ll/core/live — live synchronous scaffolded conversation (Phase 4, the crown jewel): the app coaches
// a real-time conversation BETWEEN two learners — sets a scenario, assigns roles, walks turn-by-turn,
// scaffolds each turn (target line + rescue hint at the app layer), and scores each spoken turn. Pure
// turn-state logic; the app drives it over Supabase Realtime (presence + postgres_changes on the 'live'
// partner_artifact). Language-agnostic. See DESIGN-partnered-learning.md §2 (Tier 1, deferred here) / §1.4.
import type { Scenario } from "@ll/pack-schema";

export type LiveRole = "learner" | "partner";

export interface LiveTurn {
  index: number;
  speaker: LiveRole;
  text: string; // the scripted target-language line
  gloss: string;
  translit?: string;
  spokenBy?: string; // userId who completed this turn
  transcript?: string; // what the ASR heard
  score?: number; // 0..100 from the speaking feedback
}

export interface LiveSession {
  id: string;
  scenarioId: string;
  packId: string;
  assignment: Record<string /*userId*/, LiveRole>;
  turnIndex: number; // pointer to the current (next-to-speak) turn
  turns: LiveTurn[];
  status: "active" | "complete";
}

/** Assign one partner the 'learner' lines and the other the 'partner' lines. */
export function assignLiveRoles(learnerUserId: string, partnerUserId: string): Record<string, LiveRole> {
  return { [learnerUserId]: "learner", [partnerUserId]: "partner" };
}

/**
 * Stable, ORDER-INDEPENDENT role assignment: the same two users always get the same roles regardless of
 * who creates the session. This is load-bearing for sync — if both partners hit "Start" at once and each
 * created a session with themselves passed first, each would make THEMSELVES the learner (the "we both
 * say 'you are the learner'" + deadlock bug). Sorting the ids first makes the two creates identical.
 */
export function assignLiveRolesStable(userA: string, userB: string): Record<string, LiveRole> {
  const [first, second] = [userA, userB].sort();
  return assignLiveRoles(first!, second!);
}

export function startLive(id: string, packId: string, s: Scenario, assignment: Record<string, LiveRole>): LiveSession {
  const turns: LiveTurn[] = s.script.map((t, index) => ({ index, speaker: t.speaker, text: t.text, gloss: t.gloss, translit: t.translit }));
  return { id, scenarioId: s.id, packId, assignment, turnIndex: 0, turns, status: turns.length ? "active" : "complete" };
}

export function roleOf(session: LiveSession, userId: string): LiveRole | undefined {
  return session.assignment[userId];
}

export function currentTurn(session: LiveSession): LiveTurn | undefined {
  return session.turns[session.turnIndex];
}

/** Is it this partner's turn to speak right now? */
export function isMyTurn(session: LiveSession, userId: string): boolean {
  const t = currentTurn(session);
  return !!t && t.speaker === session.assignment[userId];
}

/** Record the CURRENT turn as spoken (by the current speaker) and advance the pointer. Guards that only
 *  the current speaker can speak — the turn order is the live structure. */
export function speakTurn(session: LiveSession, userId: string, transcript: string, score: number): LiveSession {
  const turn = currentTurn(session);
  if (!turn) return session;
  if (session.assignment[userId] !== turn.speaker) throw new Error("not your turn");
  const turns = session.turns.map((t) => (t.index === turn.index ? { ...t, spokenBy: userId, transcript, score } : t));
  const turnIndex = session.turnIndex + 1;
  return { ...session, turns, turnIndex, status: turnIndex >= turns.length ? "complete" : "active" };
}

export function isComplete(session: LiveSession): boolean {
  return session.turnIndex >= session.turns.length;
}

export function progress(session: LiveSession): { done: number; total: number } {
  return { done: session.turns.filter((t) => t.spokenBy).length, total: session.turns.length };
}
