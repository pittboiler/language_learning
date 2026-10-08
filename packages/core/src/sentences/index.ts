// Which Build-a-sentence items a learner should be offered, and how long those sentences may be.
//
// A sentence item names its non-verb content words (`supportWords`) but NOT its verb — the verb is the
// thing being drilled. Scoping on supportWords alone therefore hands a beginner a conjugation of a verb
// the course hasn't introduced yet ("Работат многу" before работи appears anywhere). And the complexity
// tier is a property of the SENTENCE, so it has to be capped by where the learner is in the course, not
// only by how many cards they've built.
//
// Both rules resolve against the chapter spine (see ../chapters): a sentence is in scope once the chapter
// that introduces its verb AND every chapter that introduces its words have been reached.
import type { LanguagePack, SentenceItem } from "@ll/pack-schema";
import { normalize } from "../familiarity/index.js";
import { resolveChapters } from "../chapters/index.js";

/** Longest sentence tier a learner at this chapter should be asked to build. Early chapters stay at
 *  verb + one word; the longer rungs arrive as the course does. Mirrors when the content itself becomes
 *  available — tier-2 material needs chapter 5's vocabulary at the earliest. */
export function tierCapForChapter(chapterOrder: number): 1 | 2 | 3 | 4 {
  if (chapterOrder >= 11) return 4;
  if (chapterOrder >= 8) return 3;
  if (chapterOrder >= 5) return 2;
  return 1;
}

/** Earliest chapter in which each surface token is introduced — as a taught word or phrase, or in a line
 *  of that chapter's scenario or story. Scenario/story lines count because that's where a verb is first
 *  met in context, long before it's ever a flashcard. */
export function introducedBy(pack: LanguagePack): Map<string, number> {
  const seen = new Map<string, number>();
  const note = (text: string, order: number) => {
    for (const raw of text.split(/\s+/)) {
      const tok = normalize(raw);
      if (!tok) continue;
      const prev = seen.get(tok);
      if (prev === undefined || prev > order) seen.set(tok, order);
    }
  };
  for (const content of resolveChapters(pack)) {
    const order = content.chapter.order;
    for (const v of content.vocab) note(v.answer, order);
    for (const s of content.scenarios) for (const t of s.script) note(t.text, order);
    for (const s of content.stories) for (const b of s.body) note(b.text, order);
    for (const r of content.readers) for (const b of r.body) note(b.text, order);
  }
  return seen;
}

/** The chapter a learner must have reached for this sentence to make sense: the latest of the chapters
 *  introducing its verb and each of its support words. `undefined` ⇒ something in it is never introduced
 *  by any chapter, so the course can't honestly ask for it (see lintSentences in the pipeline). */
export function requiredChapter(pack: LanguagePack, item: SentenceItem, intro = introducedBy(pack)): number | undefined {
  const at = (surface: string) => intro.get(normalize(surface));
  let need = 1;
  if (item.verbLemma) {
    const conj = (pack.conjugations ?? []).find((c) => c.lemma === item.verbLemma);
    const forms = [item.verbLemma, ...(conj ? Object.values(conj.forms) : [])].map(at).filter((o): o is number => o !== undefined);
    if (!forms.length) return undefined; // the verb is never shown — drilling it would be a cold ask
    need = Math.max(need, Math.min(...forms)); // the first form to appear is when the verb enters the course
  }
  for (const w of item.supportWords) {
    const o = at(w);
    if (o === undefined) return undefined;
    need = Math.max(need, o);
  }
  return need;
}

export interface ScopeOptions {
  /** Order of the chapter the learner is currently working through. */
  chapterOrder: number;
  /** Has the learner met this word? (lexKey ⇒ boolean) — their own knowledge, on top of course position. */
  hasMet: (lexKey: string) => boolean;
  /** Distinct sentence cards already built, which gates the tier ladder alongside course position. */
  builtCount: number;
  /** A course blueprint decides instead of the chapter spine: has the course taught this sentence's verb
   *  and grammar by now? (Words are still checked against `hasMet`.) */
  allow?: (item: SentenceItem) => boolean;
}

/** Hard cap on tier from both directions: where the learner is in the course, and how much building
 *  they've actually done. Whichever is lower wins — a fast builder still doesn't get A2 sentences in
 *  chapter 2, and a learner deep in the course still ramps up rather than jumping straight to clauses. */
export const TIER_UNLOCK_BY_BUILDS = [0, 6, 18, 36] as const;
export const tierCapForBuilds = (builtCount: number): number =>
  TIER_UNLOCK_BY_BUILDS.reduce((t, need, i) => (builtCount >= need ? i + 1 : t), 1);

export function maxTier(opts: Pick<ScopeOptions, "chapterOrder" | "builtCount">): number {
  return Math.min(tierCapForChapter(opts.chapterOrder), tierCapForBuilds(opts.builtCount));
}

/** The sentences worth offering right now: introduced by the course already, built from words the learner
 *  has met, and no longer than their current rung allows. */
export function inScope(pack: LanguagePack, opts: ScopeOptions): SentenceItem[] {
  const intro = introducedBy(pack);
  const cap = maxTier(opts);
  return (pack.sentences ?? []).filter((it) => {
    if ((it.tier ?? 1) > cap) return false;
    if (!introduced(pack, it, opts, intro)) return false;
    return it.supportWords.every((w) => opts.hasMet(normalize(w)));
  });
}

/** Has the course reached this sentence: the blueprint's say (`allow`) when there is one, else the chapter
 *  that introduces its verb and words. */
function introduced(pack: LanguagePack, it: SentenceItem, opts: Pick<ScopeOptions, "chapterOrder" | "allow">, intro: Map<string, number>): boolean {
  if (opts.allow) return opts.allow(it);
  const need = requiredChapter(pack, it, intro);
  return need !== undefined && need <= opts.chapterOrder;
}

/** Words that would unlock a sentence if taught next — the daily flow uses this to aim its trickle of
 *  core vocabulary instead of rotating through the word list blindly. Nearly every sentence depends on at
 *  least one word that only the trickle reaches, so without this, whether the builder has anything to
 *  offer is luck. Ordered by how many sentences each word unlocks, counting a sentence that needs only
 *  this one word for more than one still two words away. */
export function unlockingWords(pack: LanguagePack, opts: ScopeOptions, limit = 8): string[] {
  const intro = introducedBy(pack);
  const cap = maxTier(opts);
  const score = new Map<string, number>();
  for (const it of pack.sentences ?? []) {
    if ((it.tier ?? 1) > cap) continue;
    if (!introduced(pack, it, opts, intro)) continue;
    const missing = it.supportWords.map((w) => normalize(w)).filter((w) => !opts.hasMet(w));
    if (!missing.length || missing.length > 2) continue; // already buildable, or too far off to aim at
    for (const w of missing) score.set(w, (score.get(w) ?? 0) + (missing.length === 1 ? 3 : 1));
  }
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([w]) => w);
}

/** Early-course production. Before any verb paradigm has been introduced — chapters 1-2 — there is no
 *  sentence to conjugate, but a beginner has plenty of taught multi-word phrases ("Не разбирам", "Можете
 *  ли да повторите?"). Putting one back together from its own words is production at exactly the right
 *  difficulty, and it means the builder earns its place in the day from the first chapter rather than
 *  appearing out of nowhere in chapter 3. */
export function phraseCards(pack: LanguagePack, opts: Pick<ScopeOptions, "chapterOrder" | "hasMet">, limit = 12): SentenceItem[] {
  const out: SentenceItem[] = [];
  for (const content of resolveChapters(pack)) {
    if (content.chapter.order > opts.chapterOrder) break;
    for (const it of content.vocab) {
      const answer = it.answer.trim();
      const words = answer.split(/\s+/).filter(Boolean);
      if (words.length < 2 || words.length > 5) continue; // one word isn't a build; a long chunk is a slog
      if (!opts.hasMet(normalize(answer))) continue;
      out.push({
        id: `phrase-${it.id}`,
        conceptIds: [],
        supportWords: [],
        variants: [{ en: it.gloss, mk: answer }],
        tier: 1,
      });
    }
  }
  return out.slice(0, limit);
}

/** What the builder should actually show, and what kind of deck it is:
 *   • "scope"    — the real thing: sentences whose verb and words the learner has met.
 *   • "phrases"  — early course: reassemble a taught phrase (no verb paradigm exists yet).
 *   • "fallback" — the shortest sentence rung the course has introduced, when the learner's own
 *                  vocabulary hasn't caught up. The tiles carry each word with its audio, so this is an
 *                  introduction, not an ambush.
 *  The point of the chain is that production never silently disappears from the day. */
export function withFallback(
  pack: LanguagePack,
  opts: ScopeOptions,
): { items: SentenceItem[]; usedFallback: boolean; source: "scope" | "phrases" | "fallback" | "none" } {
  const strict = inScope(pack, opts);
  if (strict.length) return { items: strict, usedFallback: false, source: "scope" };
  const phrases = phraseCards(pack, opts);
  if (phrases.length) return { items: phrases, usedFallback: false, source: "phrases" };
  const intro = introducedBy(pack);
  const items = (pack.sentences ?? []).filter((it) => {
    if ((it.tier ?? 1) !== 1) return false; // the fallback never reaches past the shortest rung
    return introduced(pack, it, opts, intro);
  });
  return { items, usedFallback: items.length > 0, source: items.length ? "fallback" : "none" };
}
