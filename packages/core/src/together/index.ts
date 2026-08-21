// @ll/core/together — the v2 "Together session": a short, live, two-device co-op drill two matched
// beginners run at the same time. Pure turn-state logic; the app drives it over Supabase Realtime (the
// same presence + postgres_changes mechanism @ll/core/live already uses). Language-agnostic.
//
// The shape mirrors @ll/core/live, but the unit is a RECALL turn with two roles instead of a scripted
// dialogue line: for each item one partner PRODUCES (says the target from the English prompt) and the
// other CHECKS (holds the answer on screen and taps ✓/↻). Roles flip per item so a small, shifting level
// gap always feels even — see DESIGN-partnered-v2.md §3–§4.
import type { FamiliarityProjection } from "../partner/familiarity-diff.js";

/** Extensible; Phase 1 ships "recall" (produce target from gloss, partner validates). Later: call-response,
 *  info-gap, coop-clear all reuse this same turn shell. */
export type TogetherMode = "recall";

export interface TogetherTurn {
  index: number;
  lexKey: string;
  prompt: string; // English gloss — what the producer must say
  answer: string; // target-language surface form the checker validates against
  translit?: string;
  producer: string; // userId who says it
  checker: string; // userId who holds the answer and validates
  result?: "got" | "missed"; // the checker's verdict; absent ⇒ not yet done
}

export interface TogetherSession {
  id: string;
  packId: string;
  mode: TogetherMode;
  /** The two members, SORTED — so both clients build an identical session regardless of who starts. */
  members: [string, string];
  turnIndex: number; // pointer to the current (next) turn
  turns: TogetherTurn[];
  status: "active" | "complete";
}

/** A candidate the app offers for the queue: one drillable word/phrase with its display fields. */
export interface TogetherCandidate {
  lexKey: string;
  prompt: string; // English gloss
  answer: string; // target surface
  translit?: string;
}

export interface QueueOptions {
  /** How many turns a session runs. Default 12 (~6 min). */
  limit?: number;
  /** Below this strength (and not "known") a member still needs the item. Default 0.5. */
  needThreshold?: number;
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** Does this member still need practice on the item? new / learning / shaky-known qualify. Untracked does
 *  NOT — a word this member has never studied isn't something to drill them on here (the queue only draws
 *  from what at least one partner has actually encountered; see buildQueue). */
function needs(entry: { status: string; strength: number } | undefined, needThreshold: number): boolean {
  if (!entry) return false; // not studied by this member
  if (entry.status === "new" || entry.status === "learning") return true;
  return entry.strength < needThreshold;
}

/**
 * Build the shared-gap queue for a session from BOTH members' familiarity projections. Symmetric and
 * deterministic: pass `members` sorted and `projections` in that same order, so both partners' clients
 * compute an IDENTICAL session (the dual-start convergence guarantee, mirroring @ll/core/live).
 *
 * Selection (matched-beginner bias): only words BOTH members have STUDIED are eligible — nobody is ever
 * asked to produce (or drilled on) a word the other has never met, so being ahead never pushes your words
 * onto your partner before they've studied them. Among those, items both still need come first (learn the
 * same words at the same time → you can use them with each other), then items one needs; within a tier, the
 * lowest combined strength (the rawest material) leads.
 *
 * Role per item: the MORE-familiar member CHECKS (validates against the answer), the other PRODUCES (gets
 * the retrieval practice they need). When strengths tie — the common case for two beginners — roles
 * ALTERNATE by position so it flips turn to turn.
 */
export function buildQueue(
  members: [string, string],
  projections: [FamiliarityProjection, FamiliarityProjection],
  candidates: TogetherCandidate[],
  opts: QueueOptions = {},
): TogetherTurn[] {
  const limit = opts.limit ?? 12;
  const needThreshold = opts.needThreshold ?? 0.5;
  const [a, b] = members;
  const [projA, projB] = projections;
  const eps = 0.05;

  type Scored = { c: TogetherCandidate; sa: number; sb: number; bothNeed: boolean; combined: number };
  const inPlay: Scored[] = [];
  const seenKeys = new Set<string>();
  for (const c of candidates) {
    if (seenKeys.has(c.lexKey)) continue; // dedupe: the same word can appear as several pack items
    seenKeys.add(c.lexKey);
    const ea = projA.entries[c.lexKey];
    const eb = projB.entries[c.lexKey];
    if (!ea || !eb) continue; // BOTH must have studied it — never drill (or make someone produce) a word
    //                           the other has never met; new words come only after both have studied them.
    const needA = needs(ea, needThreshold);
    const needB = needs(eb, needThreshold);
    if (!needA && !needB) continue; // both already own it — nothing to drill together
    const sa = clamp(ea?.strength ?? 0);
    const sb = clamp(eb?.strength ?? 0);
    inPlay.push({ c, sa, sb, bothNeed: needA && needB, combined: sa + sb });
  }

  // both-need first, then rawest (lowest combined strength), then a stable lexKey tiebreak for determinism.
  inPlay.sort((x, y) => Number(y.bothNeed) - Number(x.bothNeed) || x.combined - y.combined || x.c.lexKey.localeCompare(y.c.lexKey));

  return inPlay.slice(0, limit).map((s, index) => {
    let producer: string;
    let checker: string;
    if (Math.abs(s.sa - s.sb) < eps) {
      // tie → alternate by position so roles flip across the session
      [producer, checker] = index % 2 === 0 ? [a, b] : [b, a];
    } else if (s.sa > s.sb) {
      checker = a;
      producer = b; // the less-familiar member produces (needs the retrieval)
    } else {
      checker = b;
      producer = a;
    }
    return { index, lexKey: s.c.lexKey, prompt: s.c.prompt, answer: s.c.answer, translit: s.c.translit, producer, checker };
  });
}

/** Create a session from a pre-built queue. Members are sorted here too, so callers can pass either order. */
export function startTogether(id: string, packId: string, memberA: string, memberB: string, turns: TogetherTurn[], mode: TogetherMode = "recall"): TogetherSession {
  const members = [memberA, memberB].sort() as [string, string];
  return { id, packId, mode, members, turnIndex: 0, turns, status: turns.length ? "active" : "complete" };
}

export function currentTurn(session: TogetherSession): TogetherTurn | undefined {
  return session.turns[session.turnIndex];
}

/** Am I the one who must SAY the current item? */
export function isMyTurnToProduce(session: TogetherSession, userId: string): boolean {
  const t = currentTurn(session);
  return !!t && t.producer === userId;
}

/** Am I the one holding the answer + validating the current item? */
export function isMyTurnToCheck(session: TogetherSession, userId: string): boolean {
  const t = currentTurn(session);
  return !!t && t.checker === userId;
}

/** Record the checker's verdict on the current turn and advance. Only the checker may resolve a turn —
 *  the roles are the structure, exactly like @ll/core/live guards the current speaker. */
export function checkTurn(session: TogetherSession, userId: string, got: boolean): TogetherSession {
  const turn = currentTurn(session);
  if (!turn) return session;
  if (turn.checker !== userId) throw new Error("not your turn to check");
  const turns = session.turns.map((t) => (t.index === turn.index ? { ...t, result: got ? ("got" as const) : ("missed" as const) } : t));
  const turnIndex = session.turnIndex + 1;
  return { ...session, turns, turnIndex, status: turnIndex >= turns.length ? "complete" : "active" };
}

export function isComplete(session: TogetherSession): boolean {
  return session.turnIndex >= session.turns.length;
}

/** Collaborative score: got vs total resolved. Drives the shared "we cleared N together" wrap. */
export function score(session: TogetherSession): { got: number; done: number; total: number } {
  const resolved = session.turns.filter((t) => t.result);
  return { got: resolved.filter((t) => t.result === "got").length, done: resolved.length, total: session.turns.length };
}
