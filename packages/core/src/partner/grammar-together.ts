// @ll/core/partner/grammar-together — the partnered grammar step: one shared point, worked through in turns
// on two devices. Three kinds of turn, roles alternating so both stay active:
//   read  — one of you reads the rule aloud to the other (both see it); the reader taps on when done.
//   rule  — the ASKER holds a rule question and its answer; the ANSWERER says the answer aloud; the asker
//           judges it (✓ / ↻), exactly like the drill.
//   blank — the asker reads a line aloud with a gap; the answerer TAPS one of the options on their own
//           screen. The pick is checked against the answer, and both screens show it with the "why".
// Pure turn-state logic, language-agnostic; synced over Realtime like @ll/core/story-together.

export type GrammarTurnKind = "read" | "rule" | "blank";

/** One item as the app feeds it in (from the point's rule + cards, and gaps in lines you've both read). */
export type GrammarItem =
  | { kind: "read" }
  | { kind: "rule"; question: string; answer: string }
  | { kind: "blank"; line: string; gloss: string; answer: string; options: string[]; why: string; source?: string; cardId?: string };

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

/** A stable shuffle (seeded by the line) so both screens show the options in the same order, and the answer
 *  isn't always first. */
export function shuffleOptions(options: string[], seed: string): string[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
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
 *  one who read it. */
export function startGrammarTogether(id: string, packId: string, pointId: string, memberA: string, memberB: string, items: GrammarItem[]): GrammarTogetherSession {
  const members = [memberA, memberB].sort() as [string, string];
  const [a, b] = members;
  const seen: Record<GrammarTurnKind, number> = { read: 0, rule: 0, blank: 0 };
  const turns: GrammarTurn[] = items.map((it, index) => {
    const k = seen[it.kind]++;
    // read: a reads to b. rule: a asks b first. blank: b asks a first. Then each kind alternates.
    const [asker, answerer] = it.kind === "blank" ? (k % 2 === 0 ? [b, a] : [a, b]) : (k % 2 === 0 ? [a, b] : [b, a]);
    return {
      ...(it.kind === "blank" ? { ...it, options: shuffleOptions(it.options.includes(it.answer) ? it.options : [it.answer, ...it.options], it.line) } : it),
      index,
      asker,
      answerer,
    };
  });
  return { id, packId, pointId, members, turnIndex: 0, turns, status: turns.length ? "active" : "complete" };
}

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

/** rule: the asker judges the spoken answer. */
export function judge(s: GrammarTogetherSession, userId: string, got: boolean): GrammarTogetherSession {
  const t = currentTurn(s);
  if (!t || t.kind !== "rule") return s;
  if (t.asker !== userId) throw new Error("not your turn to judge");
  return resolve(s, { result: got ? "got" : "missed" });
}

/** blank: the answerer taps an option; it's checked against the answer. */
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
