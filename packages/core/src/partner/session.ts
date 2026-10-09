// @ll/core/partner/session — the partnered session as ONE shared, synced flow: warm-up → grammar → story →
// recap. Both partners' screens follow the same record (one row per partnership per day), so a section
// finished — or skipped — by either of you moves you both on. What each section holds (the drill words, the
// grammar point, the story) is decided once, by whoever starts, and saved here: the two screens never plan
// separately. Pure + language-agnostic; the app syncs it over Supabase Realtime like the other partner rows.

export type JointPhase = "warmup" | "grammar" | "story" | "recap";
export type JointSection = Exclude<JointPhase, "recap">;
export const JOINT_SECTIONS: readonly JointSection[] = ["warmup", "grammar", "story"];

/** How a section ended: finished, skipped by one of you, or empty (nothing you can share there yet). */
export type SectionOutcome = "done" | "skipped" | "empty";

/** What the starter planned: the shared rows each section plays, and the content refs behind them. */
export interface JointSessionRefs {
  /** The warm-up drill row (empty drill ⇒ the warm-up is skipped as "empty"). */
  drillRowId?: string;
  drillCount: number;
  /** The grammar point quizzed, and its quiz row. */
  pointId?: string;
  grammarRowId?: string;
  /** The story read, its lines using the point, and its read-through row. */
  storyId?: string;
  storyLines: number[];
  storyRowId?: string;
  /** The plan's framing line + the "next together" line, for the landing and the recap. */
  framing: string;
  next?: string;
}

export interface JointSessionState {
  id: string;
  packId: string;
  /** Local day it was started (the row is per day). */
  day: string;
  members: [string, string];
  startedBy: string;
  phase: JointPhase;
  outcomes: Partial<Record<JointSection, SectionOutcome>>;
  refs: JointSessionRefs;
  status: "active" | "complete";
}

const hasContent = (refs: JointSessionRefs, s: JointSection): boolean =>
  s === "warmup" ? !!refs.drillRowId && refs.drillCount > 0 : s === "grammar" ? !!refs.pointId && !!refs.grammarRowId : !!refs.storyId && !!refs.storyRowId;

/** Move past any section with nothing in it (marking it "empty"), starting at `from`. */
function settle(s: JointSessionState, from: number): JointSessionState {
  const outcomes = { ...s.outcomes };
  for (let i = from; i < JOINT_SECTIONS.length; i++) {
    const sec = JOINT_SECTIONS[i]!;
    if (hasContent(s.refs, sec)) return { ...s, outcomes, phase: sec };
    outcomes[sec] = "empty";
  }
  return { ...s, outcomes, phase: "recap" };
}

export function startJointSession(id: string, packId: string, day: string, memberA: string, memberB: string, startedBy: string, refs: JointSessionRefs): JointSessionState {
  const members = [memberA, memberB].sort() as [string, string];
  return settle({ id, packId, day, members, startedBy, phase: "warmup", outcomes: {}, refs, status: "active" }, 0);
}

/** Leave section `from` (finished or skipped) for the next one with something in it. Idempotent: if the
 *  session has already moved past `from` — your partner tapped first — nothing changes, so two taps never
 *  skip two sections. */
export function advance(s: JointSessionState, from: JointSection, outcome: "done" | "skipped"): JointSessionState {
  if (s.phase !== from || s.status === "complete") return s;
  const i = JOINT_SECTIONS.indexOf(from);
  return settle({ ...s, outcomes: { ...s.outcomes, [from]: outcome } }, i + 1);
}

/** Close the session from the recap. */
export function finish(s: JointSessionState): JointSessionState {
  return s.status === "complete" ? s : { ...s, phase: "recap", status: "complete" };
}

/** What the landing offers for today's row: nothing yet (start one), your partner's session in progress
 *  (join), your own (pick it back up), or today's already finished. A row from another day doesn't count. */
export type JoinState = "none" | "join" | "resume" | "done";
export function joinState(s: JointSessionState | undefined, me: string, today: string): JoinState {
  if (!s || s.day !== today) return "none";
  if (s.status === "complete") return "done";
  return s.startedBy === me ? "resume" : "join";
}

/** 1-based step number of the current phase among the four (for "Step 2 of 4"). */
export const stepOf = (p: JointPhase): number => (p === "recap" ? 4 : JOINT_SECTIONS.indexOf(p) + 1);
