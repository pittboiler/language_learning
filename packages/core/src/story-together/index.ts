// @ll/core/story-together — the "Read it together" activity: a dyad walks a mini-story LINE BY LINE,
// taking turns. On your line you read the target-language line aloud and SAY what it means; your partner
// holds the English gloss and validates (✓ got it / ↻ not quite). Roles alternate per line so both stay
// active. Pure turn-state logic; the app drives it over Supabase Realtime, exactly like @ll/core/live and
// @ll/core/together. Language-agnostic. Turns come straight from the story body (no selection) — the point
// is active, checked comprehension of a shared text, not spaced review.

/** One line of the story as a turn: one partner READS + gives the meaning, the other CHECKS it. */
export interface StoryTurn {
  index: number;
  text: string; // the target-language line (read aloud + paraphrased)
  translit?: string;
  gloss: string; // English meaning — held by the checker to validate against
  reader: string; // userId whose turn it is (reads aloud, says what it means)
  checker: string; // userId who holds the gloss and taps got/missed
  result?: "got" | "missed"; // the checker's verdict; absent ⇒ not done yet
}

export interface StorySession {
  id: string;
  packId: string;
  storyId: string;
  /** The two members, SORTED — so both clients build an identical session regardless of who starts. */
  members: [string, string];
  turnIndex: number; // pointer to the current (next) line
  turns: StoryTurn[];
  status: "active" | "complete";
}

/** A story line the app feeds in (straight from MiniStory.body). */
export interface StoryLine {
  text: string;
  translit?: string;
  gloss: string;
}

/** Build the session: every line becomes a turn, roles ALTERNATING by line so the reading passes back and
 *  forth. Members are sorted and roles derived from the sorted order + line index, so both partners' clients
 *  compute an IDENTICAL session (the dual-start convergence guarantee, mirroring @ll/core/live). */
export function startStoryTogether(id: string, packId: string, storyId: string, memberA: string, memberB: string, lines: StoryLine[]): StorySession {
  const members = [memberA, memberB].sort() as [string, string];
  const [a, b] = members;
  const turns: StoryTurn[] = lines.map((l, index) => ({
    index,
    text: l.text,
    translit: l.translit,
    gloss: l.gloss,
    reader: index % 2 === 0 ? a : b,
    checker: index % 2 === 0 ? b : a,
  }));
  return { id, packId, storyId, members, turnIndex: 0, turns, status: turns.length ? "active" : "complete" };
}

export function currentTurn(session: StorySession): StoryTurn | undefined {
  return session.turns[session.turnIndex];
}

/** Am I the one reading + giving the meaning on the current line? */
export function isMyTurnToRead(session: StorySession, userId: string): boolean {
  const t = currentTurn(session);
  return !!t && t.reader === userId;
}

/** Am I the one holding the gloss + validating the current line? */
export function isMyTurnToCheck(session: StorySession, userId: string): boolean {
  const t = currentTurn(session);
  return !!t && t.checker === userId;
}

/** Record the checker's verdict on the current line and advance. Only the checker may resolve a turn —
 *  the roles are the structure, exactly like @ll/core/live guards the current speaker. */
export function checkTurn(session: StorySession, userId: string, got: boolean): StorySession {
  const turn = currentTurn(session);
  if (!turn) return session;
  if (turn.checker !== userId) throw new Error("not your turn to check");
  const turns = session.turns.map((t) => (t.index === turn.index ? { ...t, result: got ? ("got" as const) : ("missed" as const) } : t));
  const turnIndex = session.turnIndex + 1;
  return { ...session, turns, turnIndex, status: turnIndex >= turns.length ? "complete" : "active" };
}

export function isComplete(session: StorySession): boolean {
  return session.turnIndex >= session.turns.length;
}

/** Shared read-through score: meanings got vs lines resolved. Drives the "you read it together" wrap. */
export function score(session: StorySession): { got: number; done: number; total: number } {
  const resolved = session.turns.filter((t) => t.result);
  return { got: resolved.filter((t) => t.result === "got").length, done: resolved.length, total: session.turns.length };
}
