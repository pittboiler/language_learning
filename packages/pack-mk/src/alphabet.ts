import type { GlyphLesson } from "@ll/pack-schema";

// Full 31-letter Macedonian Cyrillic alphabet (source of truth: spike/pack.js).
// `unique` = one of the 7 letters special to Macedonian; `falseFriend` = looks Latin, sounds different.
// confidence: "authored" (hand-authored). NOTE: the 31 example words are in Jake's native spot-check queue.
export const alphabet: GlyphLesson[] = [
  { glyph: "А", name: "a", sound: "a (father)", examples: [{ text: "ама", gloss: "but" }] },
  { glyph: "Б", name: "be", sound: "b", examples: [{ text: "бел", gloss: "white" }] },
  { glyph: "В", name: "ve", sound: "v", examples: [{ text: "вода", gloss: "water" }], falseFriend: true },
  { glyph: "Г", name: "ge", sound: "g (go)", examples: [{ text: "град", gloss: "city" }] },
  { glyph: "Д", name: "de", sound: "d", examples: [{ text: "дома", gloss: "home" }] },
  { glyph: "Ѓ", name: "gje", sound: "soft 'dj' (ɟ)", examples: [{ text: "допаѓа", gloss: "likes" }], unique: true },
  { glyph: "Е", name: "e", sound: "e (bet)", examples: [{ text: "еден", gloss: "one" }] },
  { glyph: "Ж", name: "zhe", sound: "'zh' (measure)", examples: [{ text: "жена", gloss: "woman" }] },
  { glyph: "З", name: "ze", sound: "z", examples: [{ text: "здраво", gloss: "hello" }] },
  { glyph: "Ѕ", name: "dze", sound: "'dz'", examples: [{ text: "ѕвезда", gloss: "star" }], unique: true },
  { glyph: "И", name: "i", sound: "i (machine)", examples: [{ text: "има", gloss: "there is" }] },
  { glyph: "Ј", name: "je", sound: "'y' (yes)", examples: [{ text: "јас", gloss: "I" }], unique: true },
  { glyph: "К", name: "ka", sound: "k", examples: [{ text: "кафе", gloss: "coffee" }] },
  { glyph: "Л", name: "le", sound: "l", examples: [{ text: "лето", gloss: "summer" }] },
  { glyph: "Љ", name: "lje", sound: "soft 'l' (ʎ)", examples: [{ text: "љубов", gloss: "love" }], unique: true },
  { glyph: "М", name: "me", sound: "m", examples: [{ text: "мајка", gloss: "mother" }] },
  { glyph: "Н", name: "ne", sound: "n", examples: [{ text: "не", gloss: "no" }], falseFriend: true },
  { glyph: "Њ", name: "nje", sound: "soft 'n' (ɲ)", examples: [{ text: "њива", gloss: "field" }], unique: true },
  { glyph: "О", name: "o", sound: "o", examples: [{ text: "око", gloss: "eye" }] },
  { glyph: "П", name: "pe", sound: "p", examples: [{ text: "пиво", gloss: "beer" }] },
  { glyph: "Р", name: "re", sound: "rolled r", examples: [{ text: "река", gloss: "river" }], falseFriend: true },
  { glyph: "С", name: "se", sound: "s", examples: [{ text: "сонце", gloss: "sun" }], falseFriend: true },
  { glyph: "Т", name: "te", sound: "t", examples: [{ text: "тато", gloss: "dad" }] },
  { glyph: "Ќ", name: "kje", sound: "soft 'tj' (c)", examples: [{ text: "ноќ", gloss: "night" }], unique: true },
  { glyph: "У", name: "u", sound: "u (boot)", examples: [{ text: "утро", gloss: "morning" }], falseFriend: true },
  { glyph: "Ф", name: "fe", sound: "f", examples: [{ text: "фала", gloss: "thanks" }] },
  { glyph: "Х", name: "ha", sound: "h", examples: [{ text: "храна", gloss: "food" }], falseFriend: true },
  { glyph: "Ц", name: "tse", sound: "'ts'", examples: [{ text: "цвет", gloss: "flower" }] },
  { glyph: "Ч", name: "che", sound: "'ch'", examples: [{ text: "чај", gloss: "tea" }] },
  { glyph: "Џ", name: "dzhe", sound: "'j' (jam)", examples: [{ text: "џезве", gloss: "coffee pot" }], unique: true },
  { glyph: "Ш", name: "sha", sound: "'sh'", examples: [{ text: "шума", gloss: "forest" }] },
];
