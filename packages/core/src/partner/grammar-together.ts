// @ll/core/partner/grammar-together — the partnered grammar step: one shared point, worked through in turns
// on two devices. Three kinds of turn, roles alternating so both stay active:
//   read  — one of you reads the rule aloud to the other (both see it); the reader taps on when done.
//   rule  — the ASKER holds a rule question and its answer; the ANSWERER says the answer aloud; the asker
//           judges it (✓ / ↻), exactly like the drill.
//   blank — "spot the slip" (2026-10-23, replacing the read-it-with-a-gap version): the asker reads a whole
//           line aloud, which may have one wrong form planted in it (behind a peek on their screen, and they
//           don't say: 2026-10-31); the answerer,
//           with only its meaning on screen, says whether it sounded right and, if not, TAPS the right form.
//           The pick is checked against the answer, and both screens show it with the "why".
//   switch — "person ping-pong" (2026-10-16): the asker reads a line from a story you've both read; the
//           answerer says it about someone else (the person on their screen, e.g. тие); the asker holds the
//           answer and judges (✓ / ↻). The grammar section is now these plus a couple of fill-ins — the rule
//           sits on both screens instead of being read aloud, and there are no rule quiz questions.
// Pure turn-state logic, language-agnostic; synced over Realtime like @ll/core/story-together.

export type GrammarTurnKind = "read" | "rule" | "blank" | "switch";

/** One item as the app feeds it in (from the point's rule + cards, and gaps in lines you've both read). */
export type GrammarItem =
  | { kind: "read" }
  | { kind: "rule"; question: string; answer: string }
  | { kind: "blank"; line: string; gloss: string; answer: string; options: string[]; why: string; source?: string; cardId?: string;
      /** The wrong form planted in the line as it's read aloud (from `options`); absent when it's read right. */
      slip?: string }
  /** The line as read aloud, who to say it about now (pronoun + English), and the line said that way. */
  | { kind: "switch"; line: string; gloss: string; pronoun: string; personEn: string; answer: string; why: string };

export type GrammarTurn = GrammarItem & {
  index: number;
  /** read: the one reading the rule aloud; rule/blank: the one holding the answer. */
  asker: string;
  /** read: the listener; rule/blank: the one answering. */
  answerer: string;
  /** blank: the option the answerer tapped. */
  choice?: string;
  result?: "got" | "missed";
};

export interface GrammarTogetherSession {
  id: string;
  packId: string;
  pointId: string;
  members: [string, string];
  turnIndex: number;
  turns: GrammarTurn[];
  status: "active" | "complete";
}

const hash = (seed: string): number => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

/** A stable shuffle (seeded by the line) so both screens show the options in the same order, and the answer
 *  isn't always first. */
export function shuffleOptions(options: string[], seed: string): string[] {
  let h = hash(seed);
  const out = [...new Set(options)];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Build the session. Members are sorted so both clients agree. Roles alternate WITHIN each kind — rule
 *  questions and fill-ins are interleaved, so alternating by turn number would have one partner answer every
 *  fill-in. The first rule question goes to the one who just listened to the rule; the first fill-in to the
 *  one who read it. Fill-ins take turns being read with a slip and read right (which comes first is seeded by
 *  the first one's line), so a pair with two of them always gets one of each. */
export function startGrammarTogether(id: string, packId: string, pointId: string, memberA: string, memberB: string, items: GrammarItem[]): GrammarTogetherSession {
  const members = [memberA, memberB].sort() as [string, string];
  const [a, b] = members;
  const seen: Record<GrammarTurnKind, number> = { read: 0, rule: 0, blank: 0, switch: 0 };
  const firstBlank = items.find((it) => it.kind === "blank");
  const slipFirst = !!firstBlank && hash(firstBlank.line) % 2 === 0;
  const turns: GrammarTurn[] = items.map((it, index) => {
    const k = seen[it.kind]++;
    // read: a reads to b. rule / switch: a asks b first. blank: b asks a first. Then each kind alternates,
    // so you each answer half of every kind.
    const [asker, answerer] = it.kind === "blank" ? (k % 2 === 0 ? [b, a] : [a, b]) : (k % 2 === 0 ? [a, b] : [b, a]);
    return {
      ...(it.kind === "blank" ? blankTurn(it, (k % 2 === 0) === slipFirst) : it),
      index,
      asker,
      answerer,
    };
  });
  return { id, packId, pointId, members, turnIndex: 0, turns, status: turns.length ? "active" : "complete" };
}

/** A fill-in as played: the options shuffled (the answer among them), and a wrong one planted when `slipped`. */
function blankTurn(it: Extract<GrammarItem, { kind: "blank" }>, slipped: boolean): Extract<GrammarItem, { kind: "blank" }> {
  const options = shuffleOptions(it.options.includes(it.answer) ? it.options : [it.answer, ...it.options], it.line);
  const wrong = options.filter((o) => o !== it.answer);
  const slip = slipped && wrong.length ? wrong[hash(`${it.line}#slip`) % wrong.length] : undefined;
  return { ...it, options, ...(slip ? { slip } : {}) };
}

/** The form the asker reads out: the slip when there is one, else the answer. "Sounds right" picks this. */
export const readForm = (t: Extract<GrammarItem, { kind: "blank" }>): string => t.slip ?? t.answer;

export const currentTurn = (s: GrammarTogetherSession): GrammarTurn | undefined => s.turns[s.turnIndex];

const resolve = (s: GrammarTogetherSession, patch: Partial<GrammarTurn>): GrammarTogetherSession => {
  const t = currentTurn(s)!;
  const turns = s.turns.map((x) => (x.index === t.index ? ({ ...x, ...patch } as GrammarTurn) : x));
  const turnIndex = s.turnIndex + 1;
  return { ...s, turns, turnIndex, status: turnIndex >= turns.length ? "complete" : "active" };
};

/** read: the reader is done reading the rule aloud. */
export function doneReading(s: GrammarTogetherSession, userId: string): GrammarTogetherSession {
  const t = currentTurn(s);
  if (!t || t.kind !== "read") return s;
  if (t.asker !== userId) throw new Error("not your turn to read");
  return resolve(s, {});
}

/** rule / switch: the asker judges the spoken answer. */
export function judge(s: GrammarTogetherSession, userId: string, got: boolean): GrammarTogetherSession {
  const t = currentTurn(s);
  if (!t || (t.kind !== "rule" && t.kind !== "switch")) return s;
  if (t.asker !== userId) throw new Error("not your turn to judge");
  return resolve(s, { result: got ? "got" : "missed" });
}

/** blank: the answerer picks the form they think belongs there ("Sounds right" = the one read out); it's
 *  checked against the answer. */
export function pick(s: GrammarTogetherSession, userId: string, choice: string): GrammarTogetherSession {
  const t = currentTurn(s);
  if (!t || t.kind !== "blank") return s;
  if (t.answerer !== userId) throw new Error("not your turn to answer");
  return resolve(s, { choice, result: choice === t.answer ? "got" : "missed" });
}

/** Questions answered right vs answered (the read turn doesn't count). */
export function score(s: GrammarTogetherSession): { got: number; done: number; total: number } {
  const qs = s.turns.filter((t) => t.kind !== "read");
  const done = qs.filter((t) => t.result);
  return { got: done.filter((t) => t.result === "got").length, done: done.length, total: qs.length };
}
