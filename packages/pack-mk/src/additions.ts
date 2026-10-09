// HAND-AUTHORED Level 1 gap-fill (2026-10-09, Jake OK'd new Macedonian lines): numbers past ten up to the
// thousands, the days of the week, the polite "I'd like" (би сакал/а), "I need" / "it hurts" for when
// things go wrong, and one market line showing the doubled object pronoun (Ги земам јаболката). Each item
// is tagged with the chapter that teaches it, so the course planner places it in a session there (it fits
// the chapter's existing sessions — the course structure, and so everyone's saved place, is unchanged).
// `meta.wordNote` is shown on the new-word card; breakdown + takeaway on the flashcard.
import type { ReviewItem } from "@ll/pack-schema";

type Add = Omit<ReviewItem, "prompt" | "i1Level" | "confidence"> & { i1Level?: number };
const item = (a: Add): ReviewItem => ({ prompt: a.gloss, i1Level: 1, confidence: "validated", ...a });
const parts = (forms: string, glosses: string) => {
  const f = forms.split(", "), g = glosses.split(", ");
  return f.map((part, i) => ({ part, gloss: g[i] ?? "" }));
};

export const level1Additions: ReviewItem[] = [
  // ---- chapter 3 (numbers & prices): the teens, the tens, and how a two-part number joins ----
  item({
    id: "add-teens-a", kind: "vocab", tags: ["s0-survive"],
    answer: "единаесет, дванаесет, тринаесет, четиринаесет, петнаесет", translit: "edinaeset, dvanaeset, trinaeset, chetirinaeset, petnaeset",
    gloss: "eleven, twelve, thirteen, fourteen, fifteen",
    breakdown: parts("единаесет, дванаесет, тринаесет, четиринаесет, петнаесет", "eleven, twelve, thirteen, fourteen, fifteen"),
    takeaway: "The teens are a small number + наесет (“on ten”): еди-наесет, два-наесет, пет-наесет.",
    meta: { wordNote: "11 to 19 are a small number + наесет (“on ten”): единаесет, дванаесет … деветнаесет." },
  }),
  item({
    id: "add-teens-b", kind: "vocab", tags: ["s0-survive"],
    answer: "шеснаесет, седумнаесет, осумнаесет, деветнаесет", translit: "shesnaeset, sedumnaeset, osumnaeset, devetnaeset",
    gloss: "sixteen, seventeen, eighteen, nineteen",
    breakdown: parts("шеснаесет, седумнаесет, осумнаесет, деветнаесет", "sixteen, seventeen, eighteen, nineteen"),
    takeaway: "Same pattern: the number + наесет. Six drops a letter: шес-наесет.",
  }),
  item({
    id: "add-tens-a", kind: "vocab", tags: ["s0-survive"],
    answer: "дваесет, триесет, четириесет, педесет, шеесет", translit: "dvaeset, trieset, chetirieset, pedeset, sheeset",
    gloss: "twenty, thirty, forty, fifty, sixty",
    breakdown: parts("дваесет, триесет, четириесет, педесет, шеесет", "twenty, thirty, forty, fifty, sixty"),
    takeaway: "The tens are a small number + есет / десет (“ten”): два-есет, три-есет, пе-десет.",
    meta: { wordNote: "The tens are a small number + есет or десет (“ten”): дваесет, триесет … деведесет." },
  }),
  item({
    id: "add-tens-b", kind: "vocab", tags: ["s0-survive"],
    answer: "седумдесет, осумдесет, деведесет", translit: "sedumdeset, osumdeset, devedeset",
    gloss: "seventy, eighty, ninety",
    breakdown: parts("седумдесет, осумдесет, деведесет", "seventy, eighty, ninety"),
    takeaway: "From seventy up it's the number + десет: седум-десет, осум-десет, деве-десет.",
  }),
  item({
    id: "add-25", kind: "phrase", tags: ["s0-survive"],
    answer: "дваесет и пет", translit: "dvaeset i pet",
    gloss: "twenty-five",
    breakdown: [{ part: "дваесет", gloss: "twenty" }, { part: "и", gloss: "and" }, { part: "пет", gloss: "five" }],
    takeaway: "Join the tens and the last number with и (“and”): дваесет и пет = 25.",
    meta: { wordNote: "Between the tens and the last number goes и (“and”): дваесет и пет (25), триесет и два (32)." },
  }),

  // ---- chapter 4 (the café): the hundreds and a thousand, a bigger price, and the polite “I'd like” ----
  item({
    id: "add-hundreds-a", kind: "vocab", tags: ["s1-cafe-order"],
    answer: "сто, двесте, триста, четиристотини, петстотини", translit: "sto, dveste, trista, chetiristotini, petstotini",
    gloss: "a hundred, two hundred, three hundred, four hundred, five hundred",
    breakdown: parts("сто, двесте, триста, четиристотини, петстотини", "a hundred, two hundred, three hundred, four hundred, five hundred"),
    takeaway: "200 двесте and 300 триста are their own words; from 400 on it's the number + стотини (“hundreds”).",
    meta: { wordNote: "200 (двесте) and 300 (триста) are their own words. From 400 on it's the number + стотини, “hundreds”: четиристотини, петстотини." },
  }),
  item({
    id: "add-hundreds-b", kind: "vocab", tags: ["s1-cafe-order"],
    answer: "шестотини, седумстотини, осумстотини, деветстотини, илјада", translit: "shestotini, sedumstotini, osumstotini, devetstotini, ilyada",
    gloss: "six hundred, seven hundred, eight hundred, nine hundred, a thousand",
    breakdown: parts("шестотини, седумстотини, осумстотини, деветстотини, илјада", "six hundred, seven hundred, eight hundred, nine hundred, a thousand"),
    takeaway: "The number + стотини up to 900; a thousand is илјада.",
  }),
  item({
    id: "add-250", kind: "phrase", tags: ["s1-cafe-order"],
    answer: "двесте и педесет денари", translit: "dveste i pedeset denari",
    gloss: "two hundred and fifty denars",
    breakdown: [{ part: "двесте", gloss: "two hundred" }, { part: "и", gloss: "and" }, { part: "педесет", gloss: "fifty" }, { part: "денари", gloss: "denars" }],
    takeaway: "In a big number, и goes before the last part: двесте и педесет (250), сто дваесет и пет (125).",
    meta: { wordNote: "In a big number, и goes just before the last part: двесте и педесет (250), сто дваесет и пет (125)." },
  }),
  item({
    id: "add-bi-sakal", kind: "phrase", tags: ["s1-cafe-order"],
    answer: "Би сакал / Би сакала …", translit: "Bi sakal / Bi sakala …",
    gloss: "I'd like … (a man says сакал, a woman сакала)",
    breakdown: [{ part: "Би", gloss: "would" }, { part: "сакал", gloss: "like (a man speaking)" }, { part: "сакала", gloss: "like (a woman speaking)" }],
    takeaway: "Би сакал(а) is the polite “I'd like”: softer than Сакам. The ending follows who's speaking.",
    meta: { wordNote: "The polite “I'd like”, softer than Сакам: Би сакал едно кафе. A woman says Би сакала. How it's built comes in a later course; for now it's a set phrase." },
  }),

  // ---- chapter 6 (the market): the doubled object pronoun, heard everywhere ----
  item({
    id: "add-gi-zemam", kind: "phrase", tags: ["s1-market"],
    answer: "Ги земам јаболката.", translit: "Gi zemam yabolkata.",
    gloss: "I'll take the apples.",
    breakdown: [{ part: "Ги", gloss: "them" }, { part: "земам", gloss: "I take" }, { part: "јаболката", gloss: "the apples" }],
    takeaway: "With a “the” object, Macedonian adds the short pronoun too: Ги земам јаболката (“them I take the apples”).",
    meta: { wordNote: "When the object has “the” (јаболката, the apples), Macedonian adds го / ја / ги as well: Ги земам јаболката, literally “them I take the apples”. You'll hear this all the time." },
  }),

  // ---- chapter 9 (what you did): the days of the week, and “on” a day ----
  item({
    id: "add-days-a", kind: "vocab", tags: ["s2-pasttime"],
    answer: "понеделник, вторник, среда, четврток", translit: "ponedelnik, vtornik, sreda, chetvrtok",
    gloss: "Monday, Tuesday, Wednesday, Thursday",
    breakdown: parts("понеделник, вторник, среда, четврток", "Monday, Tuesday, Wednesday, Thursday"),
    takeaway: "Days aren't capitalized in Macedonian. вторник is “second” day, четврток “fourth”.",
  }),
  item({
    id: "add-days-b", kind: "vocab", tags: ["s2-pasttime"],
    answer: "петок, сабота, недела", translit: "petok, sabota, nedela",
    gloss: "Friday, Saturday, Sunday",
    breakdown: parts("петок, сабота, недела", "Friday, Saturday, Sunday"),
    takeaway: "недела is both “Sunday” and “week”.",
    meta: { wordNote: "недела means both “Sunday” and “week”." },
  }),
  item({
    id: "add-vo-sabota", kind: "phrase", tags: ["s2-pasttime"],
    answer: "во сабота", translit: "vo sabota",
    gloss: "on Saturday",
    breakdown: [{ part: "во", gloss: "on (in)" }, { part: "сабота", gloss: "Saturday" }],
    takeaway: "“On” a day is во: во сабота, во понеделник.",
    meta: { wordNote: "“On” a day is во: во сабота, во понеделник." },
  }),

  // ---- chapter 12 (when things go wrong): “I need …” and “… hurts” ----
  item({
    id: "add-mi-treba", kind: "phrase", tags: ["s2-problems"],
    answer: "Ми треба помош.", translit: "Mi treba pomosh.",
    gloss: "I need help.",
    breakdown: [{ part: "Ми", gloss: "to me" }, { part: "треба", gloss: "is needed" }, { part: "помош", gloss: "help" }],
    takeaway: "Ми треба … is “I need …”, literally “… is needed to me”, with ми from chapter 8.",
    meta: { wordNote: "Ми треба … is “I need …”, literally “… is needed to me” (ми, “to me”, from chapter 8)." },
  }),
  item({
    id: "add-me-boli", kind: "phrase", tags: ["s2-problems"],
    answer: "Ме боли глава.", translit: "Me boli glava.",
    gloss: "I have a headache.",
    breakdown: [{ part: "Ме", gloss: "me" }, { part: "боли", gloss: "hurts" }, { part: "глава", gloss: "head" }],
    takeaway: "Ме боли … is “my … hurts”, literally “… hurts me”: Ме боли глава.",
    meta: { wordNote: "Ме боли … is “my … hurts”, literally “… hurts me”: Ме боли глава, my head hurts." },
  }),
];
