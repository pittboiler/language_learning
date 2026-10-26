// @ll/core/coach — the end-of-conversation review (DESIGN-partnered-conversation.md §3.3). A guided
// conversation is recorded turn by turn, nothing is judged while it runs, and at the end ONE call reads the
// whole transcript: each answer against the question actually asked, each guided line against its cue, both
// speakers against what they've been taught. Out come a few fixes to say aloud together, and what went well.
// Language-agnostic: the language name, the cues and the taught words come from the pack via the app.
import { MODELS, structuredCall } from "../llm/index.js";

export interface CoachSpeaker {
  id: string;
  name: string;
  /** Words and phrases this speaker has been taught (target language). */
  taughtWords: string[];
  /** Grammar this speaker has been taught: "title: one-line rule". */
  taughtGrammar: string[];
}

/** One turn as recorded: the speaker answers the last line in their own words, then says the next cue. */
export interface CoachTurn {
  turn: number;
  speakerId: string;
  /** The line this turn answers (the other speaker's last turn) and what an answer is about. */
  answers?: { about: string };
  /** The cue this turn says: the English instruction, the model line and other right lines. */
  asks?: { en: string; model: string; also: string[] };
  /** What the speech engines heard, or the line itself (typed, or the AI's scripted line). */
  heard: { scribe?: string; google?: string; text?: string };
  skipped?: boolean;
  /** The AI partner's turn in "Practice with AI": context only, never corrected. */
  ai?: boolean;
}

export interface ConversationInput {
  languageName: string;
  /** How the partners address each other, e.g. "ти (informal): they are friends". */
  register: string;
  speakers: CoachSpeaker[];
  turns: CoachTurn[];
  /** Most fixes in the review, all speakers together. */
  maxFixes?: number;
}

export type FixKind = "grammar" | "word" | "person" | "meaning" | "sound";
export interface CoachFix {
  id: string;
  turn: number;
  speakerId: string;
  /** What they said: the sentence being corrected, as heard. */
  said: string;
  /** The corrected sentence, to say aloud in the review. */
  better: string;
  /** Its romanization (added by the app). */
  betterTranslit?: string;
  betterEn: string;
  why: string;
  kind: FixKind;
}
export type Judged = "yes" | "partly" | "no" | "n/a";
export interface TurnJudgement { turn: number; askOk: Judged; answered: Judged; unclear: boolean }
export interface ConversationReview {
  turns: TurnJudgement[];
  /** In review order: alternating speakers, each speaker's most useful first. */
  fixes: CoachFix[];
  highlights: { speakerId: string; text: string }[];
  ms?: number;
  costUsd?: number;
}

export const DEFAULT_MAX_FIXES = 8;

const SYSTEM = (lang: string) => `You review a short guided conversation between adult beginners learning ${lang} (around CEFR A1). Nothing was corrected while they talked; your review is all the feedback they get, and they will go through it together, each saying their own corrected lines aloud.

How the conversation works: speakers take turns. In each turn the speaker first ANSWERS the other person's last line in their own words (free: any true or invented answer is fine), then says the next line from an English CUE (guided: you get the cue, a model line, and other lines that are just as right). The first turn only asks; the last turn only answers.

What you get for each turn is what two speech-recognition engines heard. They often mishear beginners: ignore spelling, punctuation, capitals and odd word breaks; give the benefit of the doubt when either engine shows the right words. If the engines disagree about the very word a fix would be about, don't make that fix. If neither engine is usable for a turn (empty, the wrong language, garbled), mark it unclear and make no fixes on it. A turn marked "AI" is the app playing the partner: use it as context, never judge or correct it. Everything you write is shown to the learner as if you had listened yourself: never mention transcripts, speech recognition, engines, ASR or any product name. When you can't tell whether something was said, say we may not have caught it; never suggest the learner did something wrong.

Judge each turn:
- askOk: did the guided line do what the cue asked? A different natural wording is fully right. "n/a" when the turn has no cue.
- answered: did the free part respond sensibly to what was actually said to them? Short natural answers ("Во Скопје.") are right. "n/a" on the first turn.

Fixes (the review):
- Only real errors a native speaker would notice: wrong verb form or person, agreement, word order, a wrong or missing word, a line that doesn't do what the cue asked, or the wrong register for the partner.
- Hold each speaker only to what THEY have been taught (their lists below). Never correct toward grammar or words they haven't been taught: if the natural fix needs untaught language, leave it.
- "better" is THEIR sentence, minimally fixed, so they recognise it. Keep it in taught language. Never "fix" something already right, and never replace a correct answer with the model line.
- If the same mistake comes up more than once, make one fix (the clearest instance) and say so in "why" ("twice").
- Most useful first. Fewer is fine; none is fine if they made no real errors.
- "said" quotes the sentence being corrected as heard. "why" is one short, kind sentence in plain English, addressed to that speaker as "you", naming the rule. "betterEn" translates "better".
- kind: grammar (forms, agreement, word order), person (wrong person or ти/вие), word (wrong or missing word), meaning (didn't do what the cue asked, or didn't answer), sound (the engines both heard a near-miss of the right word, so it was probably said unclearly).

Highlights: for each speaker, one or two specific things they did well, quoting their ${lang} ("You used сме for ние every time"). Warm, specific, never generic praise.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["turns", "fixes", "highlights"],
  properties: {
    turns: { type: "array", items: { type: "object", additionalProperties: false, required: ["turn", "askOk", "answered", "unclear"], properties: {
      turn: { type: "integer" }, askOk: { type: "string", enum: ["yes", "partly", "no", "n/a"] }, answered: { type: "string", enum: ["yes", "partly", "no", "n/a"] }, unclear: { type: "boolean" },
    } } },
    fixes: { type: "array", items: { type: "object", additionalProperties: false, required: ["turn", "speakerId", "said", "better", "betterEn", "why", "kind"], properties: {
      turn: { type: "integer" }, speakerId: { type: "string" }, said: { type: "string" }, better: { type: "string" }, betterEn: { type: "string" }, why: { type: "string" },
      kind: { type: "string", enum: ["grammar", "word", "person", "meaning", "sound"] },
    } } },
    highlights: { type: "array", items: { type: "object", additionalProperties: false, required: ["speakerId", "text"], properties: { speakerId: { type: "string" }, text: { type: "string" } } } },
  },
} as const;

const heardLines = (h: CoachTurn["heard"]): string =>
  h.text !== undefined ? `  said: ${h.text.trim() || "(nothing)"}`
    : `  engine 1 heard: ${h.scribe?.trim() || "(nothing)"}\n  engine 2 heard: ${h.google?.trim() || "(nothing)"}`;

export function conversationPrompt(c: ConversationInput): string {
  const name = new Map(c.speakers.map((s) => [s.id, s.name]));
  const max = c.maxFixes ?? DEFAULT_MAX_FIXES;
  const speakers = c.speakers.map((s) => [
    `Speaker ${s.id} (${s.name})`,
    `  taught words: ${s.taughtWords.join(" · ") || "(none yet)"}`,
    `  taught grammar:\n${s.taughtGrammar.map((g) => `   - ${g}`).join("\n") || "   (none yet)"}`,
  ].join("\n"));
  const turns = c.turns.map((t) => {
    const who = `${name.get(t.speakerId) ?? t.speakerId} [${t.speakerId}]${t.ai ? " — AI" : ""}`;
    const parts = [`Turn ${t.turn} — ${who}`];
    if (t.answers) parts.push(`  first answers the last line (about: ${t.answers.about})`);
    if (t.asks) parts.push(`  then the cue: "${t.asks.en}" · model: ${t.asks.model}${t.asks.also.length ? ` · also right: ${t.asks.also.join(" | ")}` : ""}`);
    parts.push(t.skipped ? "  (skipped this one)" : heardLines(t.heard));
    return parts.join("\n");
  });
  return [
    `Register: ${c.register}.`,
    `Speakers:\n${speakers.join("\n\n")}`,
    `The conversation:\n${turns.join("\n\n")}`,
    `Make at most ${max} fixes in all, at most ${Math.ceil(max / 2)} for any one speaker. Use the speaker ids in brackets.`,
  ].join("\n\n");
}

const norm = (s: string) => s.toLowerCase().replace(/[\p{P}\s]+/gu, " ").trim();

/** Clamp the model's answer to the real turns and speakers, drop non-fixes, cap per speaker, and order the
 *  fixes for the review: alternating speakers (the first to speak first), each one's most useful first. */
export function finalizeReview(c: ConversationInput, raw: Omit<ConversationReview, "ms" | "costUsd">): ConversationReview {
  const max = c.maxFixes ?? DEFAULT_MAX_FIXES;
  const perSpeaker = Math.ceil(max / 2);
  const byTurn = new Map(c.turns.map((t) => [t.turn, t]));
  const people = c.speakers.map((s) => s.id);
  const turns = c.turns.map((t): TurnJudgement => {
    const j = raw.turns.find((x) => x.turn === t.turn);
    return { turn: t.turn, askOk: t.asks ? j?.askOk ?? "n/a" : "n/a", answered: t.answers ? j?.answered ?? "n/a" : "n/a", unclear: !!j?.unclear };
  });
  const unclear = new Set(turns.filter((t) => t.unclear).map((t) => t.turn));
  const queues = new Map(people.map((p) => [p, [] as Omit<CoachFix, "id">[]]));
  for (const f of raw.fixes) {
    const t = byTurn.get(f.turn);
    if (!t || t.ai || t.skipped || t.speakerId !== f.speakerId || unclear.has(f.turn)) continue;
    if (!f.better.trim() || norm(f.better) === norm(f.said)) continue;
    const q = queues.get(f.speakerId);
    if (q && q.length < perSpeaker && !q.some((x) => norm(x.better) === norm(f.better))) q.push({ turn: f.turn, speakerId: f.speakerId, said: f.said.trim(), better: f.better.trim(), betterEn: f.betterEn.trim(), why: f.why.trim(), kind: f.kind });
  }
  const first = c.turns[0]?.speakerId;
  const order = [...people].sort((a, b) => Number(b === first) - Number(a === first));
  const fixes: CoachFix[] = [];
  for (let i = 0; fixes.length < max && order.some((p) => queues.get(p)!.length > i); i++) {
    for (const p of order) { const f = queues.get(p)![i]; if (f && fixes.length < max) fixes.push({ ...f, id: `fix-${f.turn}-${i}` }); }
  }
  const humans = new Set(c.turns.filter((t) => !t.ai).map((t) => t.speakerId));
  const highlights = people.filter((p) => humans.has(p)).flatMap((p) => raw.highlights.filter((h) => h.speakerId === p && h.text.trim()).slice(0, 2));
  return { turns, fixes, highlights };
}

/** Review a finished conversation (Opus 5.5, like the exam marker: the end of a session can wait a few
 *  seconds for a careful read). */
export async function reviewConversation(c: ConversationInput): Promise<ConversationReview> {
  const out = await structuredCall<Omit<ConversationReview, "ms" | "costUsd">>({
    model: MODELS.grade,
    system: SYSTEM(c.languageName),
    user: conversationPrompt(c),
    schema: SCHEMA as unknown as Record<string, unknown>,
    effort: "medium",
    maxTokens: 16000,
    fallback: true,
  });
  return { ...finalizeReview(c, out.data), ms: out.ms, costUsd: out.costUsd };
}
