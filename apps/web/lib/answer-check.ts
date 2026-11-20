// How a recall card (a word or phrase to say, one missing word to type) is graded once it's answered.
// Until 2026-11-20 every answer was self-graded: type a word or press "Show answer", then press a button. In a
// checkpoint that button read "Got it" and counted as right, so a tester who looked at the answer and pressed
// it to move on passed the card (Build a sentence's "Got it" after a reveal means "OK, next"), and a wrong
// typed word could be passed the same way. Now the check marks what you type, and only looking is your call.
import { writingKey } from "./course-player";
import { romanize } from "./romanize";

/** Is a typed answer the target? Latin or Cyrillic, case, spaces and punctuation aside; Latin without the
 *  marks or digraphs counts too ("zena" for жена, "kuka" for куќа), the same rule as the writing lines. */
export function typedMatches(typed: string, target: string): boolean {
  const norm = (x: string) => x.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}]/gu, "");
  if (norm(typed) === norm(target) || norm(romanize(typed)) === norm(romanize(target))) return true;
  const k = writingKey(typed);
  return !!k && k === writingKey(target);
}

/** What an answered card offers next.
 *  - `marked`: you typed, the check decides (one "Next"; right counts, wrong is a miss).
 *  - `miss`: you looked in a checkpoint, which is a test: it counts as a miss (one "Next").
 *  - `ask`: you looked anywhere else (say it aloud, then check): "Did you have it before you looked?" */
export type AfterAnswer = { kind: "marked"; ok: boolean } | { kind: "miss" } | { kind: "ask" };
export function afterAnswer(typed: string | null, target: string, checkpoint: boolean): AfterAnswer {
  if (typed !== null) return { kind: "marked", ok: typedMatches(typed, target) };
  return checkpoint ? { kind: "miss" } : { kind: "ask" };
}
