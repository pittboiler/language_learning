// @ll/core/partner/guided — the guided conversation (DESIGN-partnered-conversation.md): partners take turns,
// each turn answering the last line in their own words and then saying the next cue (English instruction →
// target language). Nothing is judged while they talk; each device records its own side, the turns are
// pieced into one transcript, reviewed once at the end (@ll/core/coach), and the fixes are gone through
// together: the one who made the mistake says the better line, the other taps "Got it" / "Not quite".
//
// Sync without lost updates: the SESSION row is written by one owner only (members[0]: at the start, and
// with the review), and each member has their OWN row (their turns, their verdicts) that only they write.
// Everything shared (whose turn, the transcript, the current fix) is derived from merging those rows.
// In "Practice with AI" the second member is AI_MEMBER: its turns are the cues' scripted lines, and the
// learner says "Got it" on their own fixes after hearing them.
// Pure logic, language-agnostic.
import type { GuidedCue } from "@ll/pack-schema";
import type { CoachFix, CoachTurn, ConversationReview } from "../coach/index.js";

export const AI_MEMBER = "ai";

export interface GuidedSession {
  id: string;
  packId: string;
  /** members[0] speaks first and owns the session row. */
  members: [string, string];
  /** Display names, for {partner} in the cues. */
  names: Record<string, string>;
  cues: GuidedCue[];
  startedAt: string;
  review?: ConversationReview;
  /** The review couldn't be made (shown, with a retry). */
  reviewError?: string;
}

export interface GuidedSegment {
  turn: number;
  at: string;
  /** What the speech engines heard (filled in once transcribed). */
  transcripts?: { scribe?: string; google?: string };
  /** The line itself: typed, or the AI's scripted line. */
  text?: string;
  skipped?: boolean;
}

export interface GuidedMemberRow {
  sessionId: string;
  userId: string;
  segments: GuidedSegment[];
  /** Verdicts on the OTHER member's fixes (solo: on your own). */
  judged: Record<string, "got" | "again">;
  /** Your own fixes you've dropped: "That's not what I said". */
  dismissed: string[];
}

export type GuidedPhase = "talk" | "transcribing" | "reviewing" | "review" | "done";

export function startGuided(o: { id: string; packId: string; members: [string, string]; names: Record<string, string>; cues: GuidedCue[]; startedAt: string }): GuidedSession {
  return { id: o.id, packId: o.packId, members: o.members, names: o.names, cues: o.cues, startedAt: o.startedAt };
}
export const emptyRow = (sessionId: string, userId: string): GuidedMemberRow => ({ sessionId, userId, segments: [], judged: {}, dismissed: [] });

/** N cues make N + 1 turns: the first only asks, the last only answers. */
export const turnCount = (s: GuidedSession): number => (s.cues.length ? s.cues.length + 1 : 0);
export const speakerOf = (s: GuidedSession, turn: number): string => s.members[(turn - 1) % 2]!;
export const otherOf = (s: GuidedSession, id: string): string => (s.members[0] === id ? s.members[1] : s.members[0]);

/** What a turn holds: the cue it answers (the last one asked) and the cue it says. */
export function turnSpec(s: GuidedSession, turn: number): { turn: number; speaker: string; answers?: GuidedCue; asks?: GuidedCue } {
  return { turn, speaker: speakerOf(s, turn), answers: turn > 1 ? s.cues[turn - 2] : undefined, asks: turn <= s.cues.length ? s.cues[turn - 1] : undefined };
}

/** A cue's English for the one saying it: {partner} → the other member's name. */
export const cueText = (s: GuidedSession, cue: GuidedCue, speaker: string): string =>
  cue.en.replaceAll("{partner}", s.names[otherOf(s, speaker)] ?? "your partner");

/** What the AI partner says on its turn ("Practice with AI"): a natural answer to the last cue, then the
 *  next cue's line, both from the deck (scripted, so every AI line is reviewed and nothing waits on a model). */
export function aiLine(s: GuidedSession, turn: number): { text: string; gloss: string } {
  const { answers, asks } = turnSpec(s, turn);
  const parts = [answers && { text: answers.sampleReply, gloss: answers.sampleReplyGloss }, asks && { text: asks.answer, gloss: asks.answerGloss }].filter((x): x is { text: string; gloss: string } => !!x);
  return { text: parts.map((p) => p.text).join(" "), gloss: parts.map((p) => p.gloss).join(" ") };
}

/** Each turn's segment, from the row of whoever's turn it was (anything else in a row is ignored). */
export function segments(s: GuidedSession, rows: GuidedMemberRow[]): Map<number, GuidedSegment> {
  const out = new Map<number, GuidedSegment>();
  for (const r of rows) for (const seg of r.segments) if (seg.turn >= 1 && seg.turn <= turnCount(s) && speakerOf(s, seg.turn) === r.userId && !out.has(seg.turn)) out.set(seg.turn, seg);
  return out;
}

/** The turn being spoken now: the first without a segment (turns are taken in order). */
export function nextTurn(s: GuidedSession, rows: GuidedMemberRow[]): number | undefined {
  const done = segments(s, rows);
  for (let t = 1; t <= turnCount(s); t++) if (!done.has(t)) return t;
  return undefined;
}

/** End your turn (the tap): your segment goes into your own row. Only the one whose turn it is. */
export function endTurn(s: GuidedSession, rows: GuidedMemberRow[], mine: GuidedMemberRow, seg: Omit<GuidedSegment, "turn">): { row: GuidedMemberRow; turn: number } {
  const turn = nextTurn(s, rows);
  if (turn === undefined) throw new Error("the conversation is over");
  if (speakerOf(s, turn) !== mine.userId) throw new Error("not your turn");
  return { row: { ...mine, segments: [...mine.segments, { ...seg, turn }] }, turn };
}

/** The speech engines are back for one of your turns. */
export const addTranscripts = (mine: GuidedMemberRow, turn: number, transcripts: GuidedSegment["transcripts"]): GuidedMemberRow =>
  ({ ...mine, segments: mine.segments.map((x) => (x.turn === turn ? { ...x, transcripts } : x)) });

const heard = (seg: GuidedSegment) => seg.skipped || seg.text !== undefined || seg.transcripts !== undefined;

export function phase(s: GuidedSession, rows: GuidedMemberRow[]): GuidedPhase {
  if (!turnCount(s)) return "done";
  const segs = segments(s, rows);
  if (segs.size < turnCount(s)) return "talk";
  if (![...segs.values()].every(heard)) return "transcribing";
  if (!s.review) return "reviewing";
  return currentFix(s, rows) ? "review" : "done";
}

/** The session owner makes the review (one writer); in solo, that's the learner. */
export const reviewer = (s: GuidedSession): string => s.members[0];

/** The whole conversation, in turn order, for the coach. */
export function transcript(s: GuidedSession, rows: GuidedMemberRow[]): CoachTurn[] {
  const segs = segments(s, rows);
  const out: CoachTurn[] = [];
  for (let t = 1; t <= turnCount(s); t++) {
    const seg = segs.get(t);
    if (!seg) break;
    const { speaker, answers, asks } = turnSpec(s, t);
    out.push({
      turn: t,
      speakerId: speaker,
      ...(answers ? { answers: { about: answers.replyEn } } : {}),
      ...(asks ? { asks: { en: cueText(s, asks, speaker), model: asks.answer, also: asks.also ?? [] } } : {}),
      heard: seg.text !== undefined ? { text: seg.text } : { ...seg.transcripts },
      ...(seg.skipped ? { skipped: true } : {}),
      ...(speaker === AI_MEMBER ? { ai: true } : {}),
    });
  }
  return out;
}

export const withReview = (s: GuidedSession, review: ConversationReview): GuidedSession => ({ ...s, review, reviewError: undefined });

// ---- the review, together ----------------------------------------------------------------------------
/** Who says "Got it" on a fix: the other member, or (solo) the one who made it. */
export const checkerOf = (s: GuidedSession, fix: CoachFix): string => {
  const other = otherOf(s, fix.speakerId);
  return other === AI_MEMBER ? fix.speakerId : other;
};

const rowOf = (rows: GuidedMemberRow[], id: string) => rows.find((r) => r.userId === id);

export function fixState(s: GuidedSession, rows: GuidedMemberRow[], fix: CoachFix): "open" | "got" | "again" | "dismissed" {
  if (rowOf(rows, fix.speakerId)?.dismissed.includes(fix.id)) return "dismissed";
  return rowOf(rows, checkerOf(s, fix))?.judged[fix.id] ?? "open";
}

export const currentFix = (s: GuidedSession, rows: GuidedMemberRow[]): CoachFix | undefined =>
  (s.review?.fixes ?? []).find((f) => fixState(s, rows, f) === "open");

/** The checker's verdict on the current fix. */
export function judgeFix(s: GuidedSession, rows: GuidedMemberRow[], mine: GuidedMemberRow, got: boolean): GuidedMemberRow {
  const f = currentFix(s, rows);
  if (!f) return mine;
  if (checkerOf(s, f) !== mine.userId) throw new Error("not yours to judge");
  return { ...mine, judged: { ...mine.judged, [f.id]: got ? "got" : "again" } };
}

/** "That's not what I said": the one the fix is about drops it (the speech engines misheard). */
export function dismissFix(s: GuidedSession, rows: GuidedMemberRow[], mine: GuidedMemberRow): GuidedMemberRow {
  const f = currentFix(s, rows);
  if (!f) return mine;
  if (f.speakerId !== mine.userId) throw new Error("only the one who said it can drop it");
  return { ...mine, dismissed: [...mine.dismissed, f.id] };
}

export function reviewScore(s: GuidedSession, rows: GuidedMemberRow[]): { turns: number; asksRight: number; asks: number; fixes: number; got: number; dismissed: number } {
  const r = s.review;
  const fixes = r?.fixes ?? [];
  const states = fixes.map((f) => fixState(s, rows, f));
  const asks = (r?.turns ?? []).filter((t) => t.askOk !== "n/a" && speakerOf(s, t.turn) !== AI_MEMBER);
  return {
    turns: segments(s, rows).size,
    asks: asks.length,
    asksRight: asks.filter((t) => t.askOk === "yes").length,
    fixes: fixes.length,
    got: states.filter((x) => x === "got").length,
    dismissed: states.filter((x) => x === "dismissed").length,
  };
}

/** The fixes that are yours to keep (Flashcards): not dropped. */
export const keptFixes = (s: GuidedSession, rows: GuidedMemberRow[], userId: string): CoachFix[] =>
  (s.review?.fixes ?? []).filter((f) => f.speakerId === userId && fixState(s, rows, f) !== "dismissed");
