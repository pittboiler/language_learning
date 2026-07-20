// Tap-to-capture logic, extracted from page.tsx so the "which words become flashcards" rules are pure
// and testable. Tapping a word in a reader enrolls it into familiarity/SRS and remembers the sentence
// (and its English) it was met in — EXCEPT proper nouns, which get captured for lookup but kept out of
// review because a name ("Ана") tests nothing.
import * as familiarity from "@ll/core/familiarity";
import type { LanguagePack } from "@ll/pack-schema";
import type { Progress } from "./store";

/** Map every story/reader line (target text → English gloss) so a captured word's stored sentence can
 *  be back-translated at review time — even for words captured before we started saving the gloss. */
export const buildLineGlosses = (pack: LanguagePack): Map<string, string> => {
  const m = new Map<string, string>();
  const add = (text?: string, gloss?: string) => { const k = (text ?? "").trim(); if (k && gloss && !m.has(k)) m.set(k, gloss); };
  for (const s of pack.stories ?? []) for (const b of s.body) add(b.text, b.gloss);
  for (const r of pack.readers ?? []) for (const b of r.body) add(b.text, b.gloss);
  return m;
};

/** A tapped word not worth a flashcard: a proper noun — capitalized AND not a curated vocab/story word.
 *  normalize() is case-insensitive, so genuine content words still match (even sentence-initial), and
 *  only names / uncurated capitalized tokens fall through as "name-like". */
export const properNounLike = (surface: string, pack: LanguagePack): boolean => {
  const norm = familiarity.normalize(surface);
  if (!norm) return false;
  if (pack.vocab.some((v) => familiarity.normalize(v.answer) === norm)) return false;
  if ((pack.stories ?? []).some((s) => s.registersVocab.some((v) => v.lexKey === norm))) return false;
  const c = surface[0] ?? "";
  return c !== c.toLowerCase() && c === c.toUpperCase(); // starts with an uppercase letter
};

/** Capture a tapped word into familiarity + SRS if it's new, remembering the sentence + its English
 *  (for in-context cloze review that shows what to say). Non-reviewable words (names) are captured as
 *  "ignored" so they show their meaning on tap but never become flashcards. Returns the lexKey ("" if
 *  not a word). Pure w.r.t. `progress`; side effects go through the passed `persist`. */
export const captureWord = (
  progress: Progress,
  persist: (p: Progress) => void,
  surface: string,
  context?: string,
  opts?: { gloss?: string; reviewable?: boolean },
): string => {
  const lexKey = familiarity.normalize(surface);
  if (!lexKey) return "";
  const reviewable = opts?.reviewable ?? true;
  const existing = progress.familiarity[lexKey];
  const isNew = !existing;
  const needContext = !!context && !progress.contexts?.[lexKey];
  const needGloss = !!opts?.gloss && !progress.contextGlosses?.[lexKey];
  // Tapping a word is deliberate engagement — promote an exposed (story-seeded) entry to studied so it
  // becomes review-eligible. (Names are captured "ignored" and never carry the exposed tag.)
  const needPromote = !isNew && reviewable && !familiarity.isStudied(existing!);
  if (!isNew && !needContext && !needGloss && !needPromote) return lexKey;
  let entry = isNew ? familiarity.capture({ lexKey, kind: "word", display: surface }) : needPromote ? familiarity.markStudied(existing!) : undefined;
  if (entry && isNew && !reviewable) entry = familiarity.setStatus(entry, "ignored");
  persist({
    ...progress,
    familiarity: entry ? { ...progress.familiarity, [lexKey]: entry } : progress.familiarity,
    contexts: needContext ? { ...progress.contexts, [lexKey]: context! } : progress.contexts,
    contextGlosses: needGloss ? { ...progress.contextGlosses, [lexKey]: opts!.gloss! } : progress.contextGlosses,
  });
  return lexKey;
};
