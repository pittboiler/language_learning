import type { GlyphLesson } from "@ll/pack-schema";

// Cyrillic onboarding seed. The full 31-letter set expands from this reference; the 7 letters
// unique to Macedonian get dedicated lessons (shown here). Examples are real Macedonian words.
export const alphabet: GlyphLesson[] = [
  { glyph: "ѓ", name: "gje", sound: "ɟ — soft 'dj'", examples: ["допаѓа (likes)"] },
  { glyph: "ќ", name: "kje", sound: "c — soft 'tj'", examples: ["ноќ (night)"] },
  { glyph: "ѕ", name: "dze", sound: "dz", examples: ["ѕвезда (star)"] },
  { glyph: "џ", name: "dzhe", sound: "dʒ — 'j' in jam", examples: ["џезве (coffee pot)"] },
  { glyph: "љ", name: "lje", sound: "ʎ — soft 'l'", examples: ["љубов (love)"] },
  { glyph: "њ", name: "nje", sound: "ɲ — soft 'n'", examples: ["њива (field)"] },
  { glyph: "ј", name: "je", sound: "j — 'y' in yes", examples: ["јас (I)"] },
];
