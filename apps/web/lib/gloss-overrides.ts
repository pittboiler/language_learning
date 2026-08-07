// SERVER-SIDE gloss correction, consulted by /api/gloss BEFORE the shared cache and the LLM.
//
// Two layers, both aimed at the same failure mode: an inflected surface form (e.g. the definite
// "лебот") misses the trusted pack-vocab lookup, falls through to the LLM, and gets a wrong,
// now-cached gloss shared across every reader (лебот → "swan", confusing леб/bread with лебед/swan).
//
//  1. GLOSS_OVERRIDES — a small curated map that WINS over cache and LLM. The highest-authority
//     correction for any word the LLM reliably botches, whether or not it's in pack vocab.
//  2. baseFormCandidates — strips the language's definite-article suffixes so a form like "лебот"
//     can be re-checked against pack vocab (леб → "bread"). Only accepted by the caller when the
//     stripped stem actually matches a known vocab word, so a bad strip can't invent a meaning.
import type { CachedGloss } from "./gloss-cache";

/** Curated per-pack corrections, keyed by NORMALIZED word (see @ll/core normalize: NFC + lowercase). */
const OVERRIDES: Record<string, Record<string, CachedGloss>> = {
  mk: {
    // лебот = the bread (леб + def. -от). The LLM once glossed it "swan" (confusing лебед); pin it.
    "лебот": { gloss: "the bread", lemma: "леб", translit: "lebot" },
  },
};

/** A curated correction for (pack, normalized word), or null. Wins over the shared cache and the LLM. */
export function glossOverride(packId: string, normWord: string): CachedGloss | null {
  return OVERRIDES[packId]?.[normWord] ?? null;
}

// Macedonian definite-article suffixes (the common set), longest-first so we peel the whole article.
// Masc: -от/-ов/-он · Fem: -та/-ва/-на · Neut: -то/-во/-но · Plural: -те/-ве/-не and -ите/-вите/-ните.
const MK_ARTICLE_SUFFIXES = ["вите", "ните", "ите", "от", "ов", "он", "та", "ва", "на", "то", "во", "но", "те", "ве", "не"];

/** Candidate base (article-stripped) forms for a normalized word, for RE-CHECKING against pack vocab.
 *  Language-specific and gated by pack; unknown packs get no candidates (surface form only). The caller
 *  must validate each candidate against trusted vocab before using it — this only proposes stems. */
export function baseFormCandidates(packId: string, normWord: string): string[] {
  if (packId !== "mk") return [];
  const out: string[] = [];
  for (const suf of MK_ARTICLE_SUFFIXES) {
    if (normWord.endsWith(suf)) {
      const stem = normWord.slice(0, -suf.length);
      if (stem.length >= 2) out.push(stem); // avoid chopping to a meaningless 0-1 char stub
    }
  }
  return out;
}
