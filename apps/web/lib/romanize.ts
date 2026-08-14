// Display-only romanization fallback. Used ONLY to fill in a pronunciation guide where the content
// data has none — specifically the partner-role dialogue lines in the partnered views, which the
// generator authored without `translit` (so one partner saw guides and the other didn't). It is NOT
// wired into word look-ups, the story reader, or anything that already ships an authored translit —
// authored/curated transliteration always wins; this only covers the gaps.
//
// Macedonian is the primary target and its Cyrillic→Latin mapping is standard and effectively 1:1
// (with a few digraphs), so a deterministic table is accurate. Bulgarian letters are included as an
// approximate superset (both packs are Cyrillic) since this is a pronunciation aid, not a citation.

const MAP: Record<string, string> = {
  // shared / Macedonian
  а: "a", б: "b", в: "v", г: "g", д: "d", ѓ: "gj", е: "e", ж: "zh", з: "z", ѕ: "dz",
  и: "i", ј: "y", к: "k", л: "l", љ: "lj", м: "m", н: "n", њ: "nj", о: "o", п: "p",
  р: "r", с: "s", т: "t", ќ: "kj", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", џ: "dj", ш: "sh",
  // Bulgarian extras (approximate)
  й: "y", щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya", ѐ: "e", ѝ: "i",
};

/** Romanize target-language (Cyrillic) text for display. Non-Cyrillic characters pass through
 *  unchanged; capitalization of the source is preserved on the first output letter. */
export function romanize(text: string): string {
  let out = "";
  for (const ch of text) {
    const lower = ch.toLowerCase();
    const mapped = MAP[lower];
    if (!mapped) {
      out += ch; // punctuation, spaces, digits, already-Latin — leave as-is
      continue;
    }
    out += ch === lower ? mapped : mapped.charAt(0).toUpperCase() + mapped.slice(1);
  }
  return out;
}

/** The authored guide when present, else a computed fallback (empty string in, empty string out). */
export function translitOr(text: string, translit?: string): string {
  return translit && translit.trim() ? translit : romanize(text);
}
