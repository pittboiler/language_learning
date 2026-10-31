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

  // ---- 2026-10-16: the rest of the question words, taught with the others in chapter 2 ----
  item({
    id: "add-qwords", kind: "vocab", tags: ["s0-greet"],
    answer: "кој / кога / зошто", translit: "koy / koga / zoshto",
    gloss: "who / when / why",
    breakdown: parts("кој, кога, зошто", "who, when, why"),
    takeaway: "Like што, каде, како and колку, each one opens its question: Кој е тој? · Кога? · Зошто?",
    meta: { wordNote: "The rest of the question words, each at the start of its question: Кој е тој? (Who is he?) · Кога? (When?) · Зошто? (Why?)" },
  }),

  // ---- 2026-10-14 (DESIGN-story-variety §2e): every person, once its grammar is taught ----
  // Chapter 8: “to you all” and “to them”, so likes are practised for every person (ми, ти, му, ѝ, ни, ви, им).
  item({
    id: "add-vi-se-dopagja", kind: "phrase", tags: ["s2-smalltalk"],
    answer: "Ви се допаѓа ли?", translit: "Vi se dopagja li?",
    gloss: "Do you all like it? (also polite: Do you like it?)",
    breakdown: [{ part: "Ви", gloss: "to you all" }, { part: "се допаѓа", gloss: "is pleasing" }, { part: "ли", gloss: "(yes/no question)" }],
    takeaway: "ви is “to you all” (and polite “to you”): Ви се допаѓа ли? Ни се допаѓа — we like it.",
    meta: { wordNote: "ви is “to you all” (or polite “to you”). The whole set: ми, ти, му, ѝ, ни, ви, им." },
  }),
  item({
    id: "add-im-se-dopagja", kind: "phrase", tags: ["s2-smalltalk"],
    answer: "Им се допаѓа.", translit: "Im se dopagja.",
    gloss: "They like it.",
    breakdown: [{ part: "Им", gloss: "to them" }, { part: "се допаѓа", gloss: "is pleasing" }],
    takeaway: "им is “to them”: Им се допаѓа — they like it (it pleases them).",
    meta: { wordNote: "им is “to them”: Им се допаѓа, “it pleases them”." },
  }),
  // Chapter 9: the past for we / you all / they (the chapter's lesson gave I / you / he-she).
  item({
    id: "add-past-bevme", kind: "vocab", tags: ["s2-pasttime"],
    answer: "бевме / бевте / беа", translit: "bevme / bevte / bea",
    gloss: "we were / you all were / they were",
    breakdown: parts("бевме, бевте, беа", "we were, you all were, they were"),
    takeaway: "The past of сум: бев, беше, беше, бевме, бевте, беа.",
    meta: { wordNote: "The past of сум for every person: бев, беше, беше, бевме, бевте, беа." },
  }),
  item({
    id: "add-past-imavme", kind: "vocab", tags: ["s2-pasttime"],
    answer: "имавме / имавте / имаа", translit: "imavme / imavte / imaa",
    gloss: "we had / you all had / they had",
    breakdown: parts("имавме, имавте, имаа", "we had, you all had, they had"),
    takeaway: "имав, имаше, имаше, имавме, имавте, имаа: -ме we, -те you all, -а they.",
    meta: { wordNote: "All six: имав, имаше, имаше, имавме, имавте, имаа. The endings -ме (we), -те (you all), -а (they) work for every past verb." },
  }),
  item({
    id: "add-past-otidovme", kind: "vocab", tags: ["s2-pasttime"],
    answer: "отидовме / отидовте / отидоа", translit: "otidovme / otidovte / otidoa",
    gloss: "we went / you all went / they went",
    breakdown: parts("отидовме, отидовте, отидоа", "we went, you all went, they went"),
    takeaway: "отидов, отиде, отиде, отидовме, отидовте, отидоа.",
    meta: { wordNote: "All six: отидов, отиде, отиде, отидовме, отидовте, отидоа." },
  }),
  item({
    id: "add-past-jadevme", kind: "vocab", tags: ["s2-pasttime"],
    answer: "јадевме / јадевте / јадеа", translit: "yadevme / yadevte / yadea",
    gloss: "we ate / you all ate / they ate",
    breakdown: parts("јадевме, јадевте, јадеа", "we ate, you all ate, they ate"),
    takeaway: "јадев, јадеше, јадеше, јадевме, јадевте, јадеа.",
    meta: { wordNote: "All six: јадев, јадеше, јадеше, јадевме, јадевте, јадеа." },
  }),

  // ---- 2026-10-16 (Jake: "similar things are just never taught"): each word family as one card, taught
  // where the course first needs it. A part already taught on its own isn't taught again (pipeline plan.ts).
  // Chapter 2: every greeting, thanks and goodbye, and the little joining words the stories use from the start.
  item({
    id: "add-greet-times", kind: "phrase", tags: ["s0-greet"],
    answer: "Добро утро / Добра вечер / Добра ноќ", translit: "Dobro utro / Dobra vecher / Dobra nokj",
    gloss: "good morning / good evening / good night",
    breakdown: parts("Добро утро, Добра вечер, Добра ноќ", "good morning, good evening, good night"),
    takeaway: "Добро утро, Добар ден, Добра вечер: a greeting for each time of day. Добра ноќ is goodnight, said when you leave.",
    meta: { wordNote: "A greeting for each time of day: Добро утро (morning), Добар ден (daytime), Добра вечер (evening). Добра ноќ is goodnight, a goodbye. добро / добар / добра changes with the word after it; chapter 3 shows why." },
  }),
  item({
    id: "add-thanks", kind: "phrase", tags: ["s0-greet"],
    answer: "Благодарам / Нема за што", translit: "Blagodaram / Nema za shto",
    gloss: "thank you (formal) / you're welcome",
    breakdown: parts("Благодарам, Нема за што", "thank you, you're welcome"),
    takeaway: "Благодарам is a fuller thank-you than Фала. The answer to both: Нема за што.",
    meta: { wordNote: "Благодарам is a fuller thank-you than Фала. The answer to either one: Нема за што (you're welcome; literally “there's nothing for which”)." },
  }),
  item({
    id: "add-bye", kind: "phrase", tags: ["s0-greet"],
    answer: "Пријатно / Чао", translit: "Priyatno / Chao",
    gloss: "goodbye, have a nice day (formal) / bye (casual)",
    breakdown: parts("Пријатно, Чао", "goodbye (have a nice day), bye"),
    takeaway: "Three goodbyes: Догледање (until we see each other), Пријатно (have a nice day), Чао (to friends).",
    meta: { wordNote: "Ways to say goodbye: Догледање (until we see each other), Пријатно (have a nice day; also said before a meal: enjoy!), Чао (bye, to friends)." },
  }),
  item({
    id: "add-conj", kind: "vocab", tags: ["s0-greet"],
    answer: "и / а / или", translit: "i / a / ili",
    gloss: "and / and (by contrast) / or",
    breakdown: parts("и, а, или", "and, and (by contrast), or"),
    takeaway: "и joins two things; а is “and” turning to someone or something else (Добро сум, а ти?); или is “or”.",
    meta: { wordNote: "и joins two things: Ана и Марко. а is “and” with a turn to someone or something else: Добро сум, а ти? (I'm fine, and you?). или is “or”: Ти или Марко?" },
  }),
  // Chapter 3: “this” for every gender, with еден / една / едно; and “a lot / a little”.
  item({
    id: "add-this", kind: "vocab", tags: ["s0-survive"],
    answer: "овој / оваа / овие", translit: "ovoy / ovaa / ovie",
    gloss: "this (m) / this (f) / these",
    breakdown: parts("овој, оваа, овие", "this (m), this (f), these"),
    takeaway: "“This” matches its noun, like еден / една / едно: овој (m), оваа (f), ова (n), овие (more than one).",
    meta: { wordNote: "“This” matches its noun, like еден / една / едно: овој (masculine), оваа (feminine), ова (neuter), овие (more than one)." },
  }),
  item({
    id: "add-lot", kind: "vocab", tags: ["s0-survive"],
    answer: "многу / малку", translit: "mnogu / malku",
    gloss: "a lot, very / a little",
    breakdown: parts("многу, малку", "a lot or very, a little"),
    takeaway: "многу is “very” before a word like добро (Многу добро!) and “a lot” on its own; малку is “a little”.",
    meta: { wordNote: "многу: very, a lot (Многу добро! · Многу фала!). малку: a little, a bit." },
  }),
  // Chapter 6: the everyday adjective pairs, with “adjectives match their noun”.
  item({
    id: "add-bigsmall", kind: "vocab", tags: ["s1-market"],
    answer: "голем / мал", translit: "golem / mal",
    gloss: "big / small",
    breakdown: parts("голем, мал", "big, small"),
    takeaway: "голем, голема, големо, големи · мал, мала, мало, мали: the ending follows the noun.",
    meta: { wordNote: "Each matches its noun: голем, голема, големо, големи · мал, мала, мало, мали." },
  }),
  item({
    id: "add-newold", kind: "vocab", tags: ["s1-market"],
    answer: "нов / стар", translit: "nov / star",
    gloss: "new / old",
    breakdown: parts("нов, стар", "new, old"),
    takeaway: "нов, нова, ново, нови · стар, стара, старо, стари: the ending follows the noun.",
    meta: { wordNote: "Each matches its noun: нов, нова, ново, нови · стар, стара, старо, стари." },
  }),
  // Chapter 7: the rest of the everyday prepositions, with во, на, од, до.
  item({
    id: "add-prep-with", kind: "vocab", tags: ["s1-directions"],
    answer: "со / за / кај", translit: "so / za / kay",
    gloss: "with / for, about / at (someone's)",
    breakdown: parts("со, за, кај", "with, for or about, at someone's"),
    takeaway: "со: with (кафе со млеко) · за: for, about · кај: at someone's place, or by something (кај Ана).",
    meta: { wordNote: "со: with (кафе со млеко). за: for, about (за Ана). кај: at someone's place or by something (кај Ана: at Ana's)." },
  }),
  item({
    id: "add-prep-place", kind: "vocab", tags: ["s1-directions"],
    answer: "пред / зад", translit: "pred / zad",
    gloss: "in front of / behind",
    breakdown: parts("пред, зад", "in front of, behind"),
    takeaway: "пред: in front of (and “before”) · зад: behind.",
    meta: { wordNote: "пред: in front of (and, for time, “before”). зад: behind." },
  }),
  // Chapter 8: the “but / so” words together (и has been taught since chapter 2).
  item({
    id: "add-but-so", kind: "vocab", tags: ["s2-smalltalk"],
    answer: "ама / но / затоа", translit: "ama / no / zatoa",
    gloss: "but / but / so, that's why",
    breakdown: parts("ама, но, затоа", "but, but, so or that's why"),
    takeaway: "ама and но both mean “but”: ама is everyday speech, но a little more careful. затоа: so, that's why.",
    meta: { wordNote: "ама and но both mean “but”: ама is everyday speech, но a little more careful. затоа: so, that's why." },
  }),
  // Chapter 10: every possessive with мој and твој, and “friend”.
  item({
    id: "add-poss-3", kind: "vocab", tags: ["s2-home-family"],
    answer: "негов / нејзин", translit: "negov / neyzin",
    gloss: "his / her",
    breakdown: parts("негов, нејзин", "his, her"),
    takeaway: "Like мој, they match what's owned and usually take the article: неговиот стан, нејзиниот стан.",
    meta: { wordNote: "негов (his), нејзин (her). Like мој, they match what's owned and usually take the article: неговиот стан, нејзиниот стан." },
  }),
  item({
    id: "add-poss-pl", kind: "vocab", tags: ["s2-home-family"],
    answer: "наш / ваш / нивен", translit: "nash / vash / niven",
    gloss: "our / your (you all, or polite) / their",
    breakdown: parts("наш, ваш, нивен", "our, your (you all or polite), their"),
    takeaway: "нашиот стан, вашиот стан, нивниот стан: like мој, they match what's owned.",
    meta: { wordNote: "наш (our), ваш (your, for you all or polite вие), нивен (their): нашиот стан, вашиот стан, нивниот стан." },
  }),
  item({
    id: "add-friend", kind: "vocab", tags: ["s2-home-family"],
    answer: "пријател / пријателка", translit: "priyatel / priyatelka",
    gloss: "friend (a man) / friend (a woman)",
    breakdown: parts("пријател, пријателка", "friend (a man), friend (a woman)"),
    takeaway: "-ка makes the woman's word: пријател → пријателка (like студент → студентка).",
  }),
];
