// Deterministic Cyrillic → Latin transliteration in the app's standard sh/ch/kj style, so pipeline-authored
// content matches what the app renders (the LLM otherwise returns academic diacritics like č/š/ḱ).
//
// MIRRORS apps/web/lib/romanize.ts — keep the two maps in step. Note ј → "y" (not "j"); an LLM
// regeneration has regressed that before.
const ROMAN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ѓ: "gj", е: "e", ж: "zh", з: "z", ѕ: "dz", и: "i", ј: "y",
  к: "k", л: "l", љ: "lj", м: "m", н: "n", њ: "nj", о: "o", п: "p", р: "r", с: "s", т: "t", ќ: "kj",
  у: "u", ф: "f", х: "h", ц: "c", ч: "ch", џ: "dj", ш: "sh", ѐ: "e", ѝ: "i",
};

export const romanize = (text: string): string => {
  let out = "";
  for (const ch of text) {
    const lower = ch.toLowerCase();
    const m = ROMAN[lower];
    if (!m) { out += ch; continue; }
    out += ch === lower ? m : m.charAt(0).toUpperCase() + m.slice(1);
  }
  return out;
};
