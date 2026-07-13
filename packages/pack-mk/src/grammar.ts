import type { PhonologyRules, GrammarConcept, ReviewItem } from "@ll/pack-schema";

export const phonology: PhonologyRules = {
  notes: "Highly phonetic: ~one letter, one sound. Lean on this in alphabet onboarding.",
  stressRule: "Antepenultimate — stress on the 3rd-from-last syllable (words of 3+ syllables).",
  exceptions: ["Many loanwords keep their own stress, e.g. кафе → ka-FE (final syllable)."],
};

// MC drill helper → ReviewItem (kind "grammar"). confidence: "authored".
function drill(id: string, conceptId: string, prompt: string, options: string[], answer: string, why: string, gloss: string): ReviewItem {
  return { id, kind: "grammar", prompt, answer, gloss, options, why, i1Level: 2, tags: ["grammar", conceptId], confidence: "authored" };
}

// The grammar features that ACTUALLY matter for Macedonian — deliberately NO Slavic case system.
// Written learner-first: a plain-English hook + a pattern table, with the technical term kept as a
// subtitle so it's accurate without leading with jargon.
export const grammar: GrammarConcept[] = [
  {
    id: "definite-articles",
    name: "Saying “the” — it goes on the end",
    technicalName: "Definite articles (postposed)",
    plain: "Macedonian has no separate word for “the.” You attach it to the END of the noun, and the ending matches the noun’s gender.",
    explanation:
      "The ending is -от for masculine, -та for feminine, -то for neuter. Want to point at something instead of just saying “the”? Swap the ending: -ва for something near you (“this”), -на for something further off (“that”).",
    pattern: {
      headers: ["noun", "+ “the”", "gender"],
      rows: [
        ["леб (bread)", "лебот", "masculine · -от"],
        ["книга (book)", "книгата", "feminine · -та"],
        ["пиво (beer)", "пивото", "neuter · -то"],
      ],
      spotlightCol: 1,
    },
    examples: [
      "лебот — the bread",
      "книгата — the book",
      "пивото — the beer",
      "книгава — this book (near me)",
      "книгана — that book (over there)",
    ],
    confidence: "authored",
    drills: [
      drill("a-masc", "definite-articles", "the bread  (леб + “the”)", ["лебот", "лебта", "отлеб"], "лебот", "леб is masculine, so “the” is -от on the end.", "the bread"),
      drill("a-fem", "definite-articles", "the book  (книга + “the”)", ["книгата", "книгаот", "такнига"], "книгата", "книга is feminine, so “the” is -та on the end.", "the book"),
      drill("a-neut", "definite-articles", "the beer  (пиво + “the”)", ["пивото", "пивата", "топиво"], "пивото", "пиво is neuter, so “the” is -то on the end.", "the beer"),
      drill("a-near", "definite-articles", "this book  (near you)", ["книгава", "книгата", "книгана"], "книгава", "-ва points at something near: “this”.", "this book (near)"),
      drill("a-far", "definite-articles", "that book  (over there)", ["книгана", "книгата", "книгава"], "книгана", "-на points at something far: “that”.", "that book (far)"),
    ],
  },
  {
    id: "verb-conjugation",
    name: "Verb endings — who's doing it",
    technicalName: "Present-tense conjugation (-а verbs)",
    plain:
      "Macedonian verbs change their ENDING to show who's doing the action — so сакам already means “I want” and сакаш means “you want”, with no separate pronoun needed.",
    explanation:
      "For the big “-а” group of verbs, swap the ending by person: -ам (I), -аш (you), -а (he/she), -аме (we), -ате (you all), -аат (they). You can add the pronoun (јас, ти, …) for emphasis, but the ending already carries it. (Two other groups, -е and -и verbs, follow the same idea with their own vowel.)",
    pattern: {
      headers: ["person", "verb form", "ending"],
      rows: [
        ["јас (I)", "сакам", "-ам"],
        ["ти (you)", "сакаш", "-аш"],
        ["тој/таа (he/she)", "сака", "-а"],
        ["ние (we)", "сакаме", "-аме"],
        ["вие (you all)", "сакате", "-ате"],
        ["тие (they)", "сакаат", "-аат"],
      ],
      spotlightCol: 2,
    },
    examples: [
      "сакам кафе — I want a coffee",
      "сакаш чај? — do you want tea?",
      "тие сакаат вода — they want water",
    ],
    confidence: "authored",
    drills: [
      drill("vc-i", "verb-conjugation", "“I want” (јас)", ["сакам", "сакаш", "сака"], "сакам", "јас → -ам", "I want"),
      drill("vc-you", "verb-conjugation", "“you want” (ти)", ["сакаш", "сакам", "сакаат"], "сакаш", "ти → -аш", "you want"),
      drill("vc-they", "verb-conjugation", "“they want” (тие)", ["сакаат", "сакаме", "сака"], "сакаат", "тие → -аат", "they want"),
    ],
  },
  {
    id: "gender",
    name: "Three genders — and matching “a/one”",
    technicalName: "Grammatical gender & agreement",
    plain: "Every noun is masculine, feminine, or neuter. Little words around it — like “a/one” — change their ending to match.",
    explanation:
      "Always learn a noun together with its gender, because the gender decides the form of “a/one”, “the”, and any adjective. Rough rule of thumb: nouns ending in -а are usually feminine, -о or -е usually neuter, and a consonant usually masculine.",
    pattern: {
      headers: ["gender", "“a / one”", "example"],
      rows: [
        ["masculine", "еден", "еден сок — a juice"],
        ["feminine", "една", "една вода — a water"],
        ["neuter", "едно", "едно пиво — a beer"],
      ],
      spotlightCol: 1,
    },
    examples: [
      "еден сок — a juice (masculine)",
      "една вода — a water (feminine)",
      "едно пиво — a beer (neuter)",
    ],
    confidence: "authored",
    drills: [
      drill("g-sok", "gender", "___ сок  (a juice)", ["еден", "една", "едно"], "еден", "сок is masculine → еден.", "a juice"),
      drill("g-voda", "gender", "___ вода  (a water)", ["еден", "една", "едно"], "една", "вода is feminine → една.", "a water"),
      drill("g-pivo", "gender", "___ пиво  (a beer)", ["еден", "една", "едно"], "едно", "пиво is neuter → едно.", "a beer"),
      drill("g-kafe", "gender", "___ кафе  (a coffee)", ["еден", "една", "едно"], "едно", "кафе is neuter → едно.", "a coffee"),
    ],
  },
  {
    id: "verb-conjugation-e",
    name: "“-е” verbs (eat, drink, write…)",
    technicalName: "Present tense — e-conjugation",
    plain: "A second verb group carries an -е- in the middle: јаде (eats), јадеш (you eat). The endings echo the -а verbs, just with -е- instead of -а-.",
    explanation:
      "For -е verbs like јаде (eat): -ам (I), -еш (you), -е (he/she), -еме (we), -ете (you all), -ат (they). The I-form is still -ам and the they-form -ат, exactly like the -а group — only the middle vowel changes.",
    pattern: {
      headers: ["person", "јаде (eat)", "ending"],
      rows: [
        ["јас (I)", "јадам", "-ам"],
        ["ти (you)", "јадеш", "-еш"],
        ["тој/таа (he/she)", "јаде", "-е"],
        ["ние (we)", "јадеме", "-еме"],
        ["вие (you all)", "јадете", "-ете"],
        ["тие (they)", "јадат", "-ат"],
      ],
      spotlightCol: 2,
    },
    examples: [
      "јадам леб — I eat bread",
      "што јадеш? — what are you eating?",
      "тие јадат бавно — they eat slowly",
    ],
    confidence: "authored",
    drills: [
      drill("vce-i", "verb-conjugation-e", "“I eat” (јас)", ["јадам", "јадеш", "јаде"], "јадам", "-е verb, јас → -ам", "I eat"),
      drill("vce-you", "verb-conjugation-e", "“you eat” (ти)", ["јадеш", "јадам", "јадат"], "јадеш", "ти → -еш", "you eat"),
      drill("vce-they", "verb-conjugation-e", "“they eat” (тие)", ["јадат", "јадеме", "јаде"], "јадат", "тие → -ат", "they eat"),
    ],
  },
  {
    id: "verb-conjugation-i",
    name: "“-и” verbs (learn, go, carry…)",
    technicalName: "Present tense — i-conjugation",
    plain: "The third verb group carries an -и- in the middle: учи (learns), учиш (you learn). Same idea, with -и- as the middle vowel.",
    explanation:
      "For -и verbs like учи (learn): -ам (I), -иш (you), -и (he/she), -име (we), -ите (you all), -ат (they). Again the I-form (-ам) and they-form (-ат) match the other groups — only the middle vowel is -и-.",
    pattern: {
      headers: ["person", "учи (learn)", "ending"],
      rows: [
        ["јас (I)", "учам", "-ам"],
        ["ти (you)", "учиш", "-иш"],
        ["тој/таа (he/she)", "учи", "-и"],
        ["ние (we)", "учиме", "-име"],
        ["вие (you all)", "учите", "-ите"],
        ["тие (they)", "учат", "-ат"],
      ],
      spotlightCol: 2,
    },
    examples: [
      "учам македонски — I'm learning Macedonian",
      "што учиш? — what are you studying?",
      "тие учат заедно — they study together",
    ],
    confidence: "authored",
    drills: [
      drill("vci-i", "verb-conjugation-i", "“I learn” (јас)", ["учам", "учиш", "учи"], "учам", "-и verb, јас → -ам", "I learn"),
      drill("vci-you", "verb-conjugation-i", "“you learn” (ти)", ["учиш", "учам", "учат"], "учиш", "ти → -иш", "you learn"),
      drill("vci-they", "verb-conjugation-i", "“they learn” (тие)", ["учат", "учиме", "учи"], "учат", "тие → -ат", "they learn"),
    ],
  },
  {
    id: "verb-aspect",
    name: "Two versions of every verb",
    technicalName: "Verb aspect (imperfective / perfective)",
    plain: "Most verbs come as a pair: one for an action that’s ongoing or repeated, one for a single, finished action.",
    explanation:
      "Reach for the ongoing form for habits and actions in progress (“I drink coffee every morning”), and the completed form for one finished action (“I drank it all up”). You’ll meet both members of the pair as you learn each verb.",
    pattern: {
      headers: ["ongoing / repeated", "done once", "meaning"],
      rows: [
        ["пие", "испие", "drink"],
        ["чита", "прочита", "read"],
        ["пишува", "напише", "write"],
      ],
      spotlightCol: 1,
    },
    examples: [
      "пие кафе секое утро — drinks coffee every morning (ongoing)",
      "го испи кафето — drank up the coffee (finished)",
    ],
    confidence: "authored",
    drills: [
      drill("asp-habit", "verb-aspect", "“I drink coffee every morning.” Which form?", ["пие — ongoing", "испие — finished"], "пие — ongoing", "A repeated habit → the ongoing (imperfective) form.", "ongoing action"),
      drill("asp-done", "verb-aspect", "“I drank it all up.” Which form?", ["пие — ongoing", "испие — finished"], "испие — finished", "One finished action → the completed (perfective) form.", "finished action"),
    ],
  },
  {
    id: "future-tense",
    name: "The future — just add “ќе”",
    technicalName: "Future tense (ќе + present)",
    plain: "To talk about the future, put ќе in front of the normal present-tense verb. That's the whole trick: ќе јадам = “I will eat.”",
    explanation:
      "Macedonian has no special future endings — it's just ќе + the present form you already know. So сакам → ќе сакам, читаме → ќе читаме. (To say “won't”, you'd use нема да, but ќе covers the basics.)",
    pattern: {
      headers: ["meaning", "Macedonian"],
      rows: [
        ["I will eat", "ќе јадам"],
        ["you will read", "ќе читаш"],
        ["we will go", "ќе одиме"],
        ["they will want", "ќе сакаат"],
      ],
      spotlightCol: 1,
    },
    examples: [
      "ќе гледам филм — I'll watch a film",
      "ќе одиме утре — we'll go tomorrow",
      "ќе јадам подоцна — I'll eat later",
    ],
    confidence: "authored",
    drills: [
      drill("fut-read", "future-tense", "“I will read” →", ["ќе читам", "читам", "читав"], "ќе читам", "future = ќе + present", "I will read"),
      drill("fut-which", "future-tense", "Which one is in the FUTURE?", ["ќе јаде", "јаде", "јадеше"], "ќе јаде", "ќе marks the future", "will eat"),
    ],
  },
  {
    id: "past-tense",
    name: "Talking about the past",
    technicalName: "Past tense (aorist)",
    plain: "For a finished past action, swap the endings: гледам (I watch) → гледав (I watched). Heads-up: the “you” and “he/she” past forms look identical — context tells them apart.",
    explanation:
      "The simple past (aorist) endings: -в (I), bare stem (you / he-she), -вме (we), -вте (you all), -а (they). So гледа (watch) → гледав, гледа, гледавме, гледавте, гледаа. Use it for completed actions: гледав филм = “I watched a film.”",
    pattern: {
      headers: ["person", "past of гледа", "ending"],
      rows: [
        ["јас (I)", "гледав", "-в"],
        ["ти / тој (you / he)", "гледа", "(bare)"],
        ["ние (we)", "гледавме", "-вме"],
        ["вие (you all)", "гледавте", "-вте"],
        ["тие (they)", "гледаа", "-а"],
      ],
      spotlightCol: 1,
    },
    examples: [
      "гледав филм — I watched a film",
      "сакав вода — I wanted water",
      "тие гледаа телевизија — they watched TV",
    ],
    confidence: "authored",
    drills: [
      drill("pst-i", "past-tense", "“I watched” (јас)", ["гледав", "гледам", "гледаа"], "гледав", "past, јас → -в", "I watched"),
      drill("pst-we", "past-tense", "“we watched” (ние)", ["гледавме", "гледаме", "гледав"], "гледавме", "past, ние → -вме", "we watched"),
      drill("pst-they", "past-tense", "“they watched” (тие)", ["гледаа", "гледаат", "гледавме"], "гледаа", "past, тие → -а", "they watched"),
    ],
  },
  {
    id: "clitics",
    name: "Little pronouns sit before the verb",
    technicalName: "Clitic pronoun order",
    plain: "Short pronouns like “it”, “to me”, and “self” cluster together in a fixed order, right in front of the verb.",
    explanation:
      "The order never changes: the “to-whom” pronoun (ми = to me) comes first, then the “what” or reflexive (го = it, се = self), and the verb comes last. They stay glued together — you can’t split them or reorder them.",
    pattern: {
      headers: ["to whom", "what / self", "verb"],
      rows: [
        ["ми (to me)", "се (self)", "допаѓа (pleases)"],
        ["ми (to me)", "го (it)", "дава (gives)"],
      ],
    },
    examples: [
      "Ми се допаѓа — I like it (to-me + self + pleases)",
      "Ми го дава — he gives it to me (to-me + it + gives)",
    ],
    confidence: "authored",
    drills: [
      drill("cl-like", "clitics", "“I like it.” Pick the right order:", ["Ми се допаѓа", "Се ми допаѓа", "Допаѓа ми се"], "Ми се допаѓа", "“To-me” (ми) comes first, then “self” (се), then the verb.", "I like it"),
      drill("cl-give", "clitics", "“He gives it to me.” Pick the right order:", ["Ми го дава", "Го ми дава", "Дава ми го"], "Ми го дава", "“To-me” (ми) before “it” (го), then the verb.", "he gives it to me"),
    ],
  },
  {
    id: "to-be",
    name: "“Am / is / are” — the verb сум",
    technicalName: "The verb “to be” (сум) — present tense",
    plain: "The word for am/is/are is сум, and it changes by person: сум, си, е, сме, сте, се. It’s unstressed, so it leans on the word before it — “Јас сум…”, never starting a sentence.",
    explanation:
      "сум (I am), си (you are), е (he/she/it is), сме (we are), сте (you all are), се (they are). Put a subject or another word first: Јас сум Ана, Тоа е кафе. To make it negative, just add не in front: не сум, не е.",
    pattern: {
      headers: ["person", "form of “to be”", ""],
      rows: [
        ["јас (I)", "сум", "Јас сум тука"],
        ["ти (you)", "си", "Ти си добар"],
        ["тој/таа/тоа (he/she/it)", "е", "Тоа е кафе"],
        ["ние (we)", "сме", "Ние сме тука"],
        ["вие (you all)", "сте", "Вие сте добри"],
        ["тие (they)", "се", "Тие се тука"],
      ],
      spotlightCol: 1,
    },
    examples: [
      "Јас сум Ана — I am Ana",
      "Тоа е кафе — That's coffee",
      "Ние сме тука — We are here",
      "Не е точно — It isn't right",
    ],
    confidence: "authored",
    drills: [
      drill("be-i", "to-be", "“I am” (јас)", ["сум", "си", "е"], "сум", "јас → сум", "I am"),
      drill("be-you", "to-be", "“you are” (ти)", ["си", "сум", "сте"], "си", "ти → си", "you are"),
      drill("be-heshe", "to-be", "“it is” (тоа)", ["е", "се", "сум"], "е", "тој/таа/тоа → е", "it is"),
      drill("be-we", "to-be", "“we are” (ние)", ["сме", "сте", "се"], "сме", "ние → сме", "we are"),
      drill("be-they", "to-be", "“they are” (тие)", ["се", "сме", "е"], "се", "тие → се", "they are"),
    ],
  },
  {
    id: "negation",
    name: "Saying “not” — не and нема",
    technicalName: "Negation (не / нема)",
    plain: "Put не right before the verb to make it negative: не сакам = “I don’t want.” For “there isn’t / doesn’t have”, use нема.",
    explanation:
      "не goes directly in front of the verb (and before any little pronouns): не знам, не ми се допаѓа. нема means “there isn’t”: нема вода. For “won’t” (negative future) use нема да, not ќе: нема да одам. And unlike English, double negatives are required: Немам ништо = “I have nothing.”",
    pattern: {
      headers: ["meaning", "Macedonian", ""],
      rows: [
        ["I don’t want", "не сакам", "не + verb"],
        ["it isn’t", "не е", "не + сум"],
        ["there’s no water", "нема вода", "нема = there isn’t"],
        ["I won’t go", "нема да одам", "negative future"],
      ],
      spotlightCol: 1,
    },
    examples: [
      "Не сакам чај — I don't want tea",
      "Тоа не е точно — That isn't right",
      "Нема проблем — No problem (there's none)",
      "Немам ништо — I have nothing",
    ],
    confidence: "authored",
    drills: [
      drill("neg-want", "negation", "“I don’t want” →", ["не сакам", "сакам не", "нема сакам"], "не сакам", "не sits right before the verb.", "I don't want"),
      drill("neg-none", "negation", "“there’s no water” →", ["нема вода", "не вода", "вода нема"], "нема вода", "нема = “there isn’t / doesn’t have.”", "there's no water"),
      drill("neg-future", "negation", "“I won’t go” (negative future) →", ["нема да одам", "не ќе одам", "не одам"], "нема да одам", "Negative future is нема да + verb, not ќе.", "I won't go"),
      drill("neg-double", "negation", "“I have nothing” →", ["Немам ништо", "Имам ништо", "Немам нешто"], "Немам ништо", "Macedonian doubles the negative: “I don't-have nothing.”", "I have nothing"),
    ],
  },
  {
    id: "questions",
    name: "Asking questions",
    technicalName: "Yes/no (дали) and question words",
    plain: "For a yes/no question, start with дали (Дали сакаш кафе?). For everything else, lead with a question word: што, кој, каде, кога, зошто, како, колку.",
    explanation:
      "дали turns any statement into a yes/no question: Дали си тука? (You can also just add ли after the verb — Сакаш ли кафе? — or rely on a rising tone.) The wh-words go at the front: што (what), кој/која (who/which), каде (where), кога (when), зошто (why), како (how), колку (how much/many).",
    pattern: {
      headers: ["word", "meaning", "example"],
      rows: [
        ["дали", "(yes/no)", "Дали сакаш кафе?"],
        ["што", "what", "Што е тоа?"],
        ["кој", "who", "Кој си ти?"],
        ["каде", "where", "Каде е?"],
        ["колку", "how much", "Колку чини?"],
        ["зошто", "why", "Зошто?"],
      ],
      spotlightCol: 0,
    },
    examples: [
      "Дали сакаш кафе? — Do you want coffee?",
      "Што е тоа? — What is that?",
      "Каде е тоалетот? — Where's the toilet?",
      "Колку чини? — How much is it?",
    ],
    confidence: "authored",
    drills: [
      drill("q-yesno", "questions", "“___ сакаш вода?” (do you want water?)", ["Дали", "Што", "Каде"], "Дали", "дали opens a yes/no question.", "do you…?"),
      drill("q-where", "questions", "“___ е кафето?” (where is the coffee?)", ["Каде", "Кога", "Колку"], "Каде", "каде = where.", "where"),
      drill("q-howmuch", "questions", "“___ чини?” (how much does it cost?)", ["Колку", "Кој", "Како"], "Колку", "колку = how much / how many.", "how much"),
      drill("q-what", "questions", "“___ е тоа?” (what is that?)", ["Што", "Каде", "Зошто"], "Што", "што = what.", "what"),
    ],
  },
  {
    id: "da-modals",
    name: "“Want to / have to / can” — the да trick",
    technicalName: "да-constructions and modal verbs",
    plain: "There’s no “to eat” infinitive. You say да + the conjugated verb, and stack it after сакам (want), можам (can), морам (must), треба (need to): Сакам да јадам = “I want to eat.”",
    explanation:
      "Both verbs match the same person: Сакам да јадам (I…I), Сакаш да јадеш (you…you). треба is impersonal and stays put — треба да учам = “I need to study.” This да + present pattern is everywhere in everyday Macedonian.",
    pattern: {
      headers: ["modal", "+ да + verb", "meaning"],
      rows: [
        ["сакам", "сакам да јадам", "I want to eat"],
        ["можам", "можам да платам", "I can pay"],
        ["морам", "морам да одам", "I must go"],
        ["треба", "треба да учам", "I need to study"],
      ],
      spotlightCol: 1,
    },
    examples: [
      "Сакам да учам македонски — I want to learn Macedonian",
      "Можам да платам? — Can I pay?",
      "Морам да одам — I have to go",
      "Треба да јадам — I need to eat",
    ],
    confidence: "authored",
    drills: [
      drill("mod-eat", "da-modals", "“I want to eat” →", ["Сакам да јадам", "Сакам јадам", "Сакам да јаде"], "Сакам да јадам", "да + a verb that agrees: сакам…јадам.", "I want to eat"),
      drill("mod-pay", "da-modals", "“Can I pay?” →", ["Можам да платам", "Можам платам", "Можам да плати"], "Можам да платам", "можам да + verb (both “I”).", "can I pay?"),
      drill("mod-you", "da-modals", "“you want to study” →", ["Сакаш да учиш", "Сакаш да учам", "Сакаш учиш"], "Сакаш да учиш", "Both verbs take the “you” ending: сакаш…учиш.", "you want to study"),
      drill("mod-need", "da-modals", "“___ да учам” (I need to study)", ["треба", "сакаш", "мора"], "треба", "треба да + verb = “need to.”", "need to"),
    ],
  },
  {
    id: "adjective-agreement",
    name: "Adjectives match their noun",
    technicalName: "Adjective agreement (gender & number)",
    plain: "An adjective copies its noun’s gender and number. “Good” is добар (m), добра (f), добро (n), and добри (plural): добар човек, добра книга, добро кафе.",
    explanation:
      "Learn the masculine form, then swap the ending to match: -∅ (m), -а (f), -о (n), -и (plural). It works for almost every adjective — студен → студено пиво (cold beer), убав → убави места (beautiful places). The adjective goes before the noun.",
    pattern: {
      headers: ["noun’s gender", "“good”", "example"],
      rows: [
        ["masculine", "добар", "добар човек (a good man)"],
        ["feminine", "добра", "добра книга (a good book)"],
        ["neuter", "добро", "добро кафе (good coffee)"],
        ["plural", "добри", "добри луѓе (good people)"],
      ],
      spotlightCol: 1,
    },
    examples: [
      "добар ден — good day",
      "добра идеја — a good idea",
      "студено пиво — cold beer",
      "убави места — beautiful places",
    ],
    confidence: "authored",
    drills: [
      drill("adj-coffee", "adjective-agreement", "“good coffee” (кафе, neuter)", ["добро", "добар", "добра"], "добро", "кафе is neuter → добро.", "good coffee"),
      drill("adj-book", "adjective-agreement", "“a good book” (книга, feminine)", ["добра", "добар", "добри"], "добра", "книга is feminine → добра.", "a good book"),
      drill("adj-man", "adjective-agreement", "“a good man” (човек, masculine)", ["добар", "добра", "добро"], "добар", "човек is masculine → добар.", "a good man"),
      drill("adj-people", "adjective-agreement", "“good people” (луѓе, plural)", ["добри", "добар", "добро"], "добри", "plural → добри.", "good people"),
    ],
  },
  {
    id: "noun-plurals",
    name: "Making things plural",
    technicalName: "Noun plurals",
    plain: "Most plurals swap the ending: masculine usually adds -и (short ones add -ови), feminine -а becomes -и, and neuter -о/-е becomes -а. A few are irregular (дете → деца “children”).",
    explanation:
      "маж → мажи (add -и), but short masculine nouns take -ови: град → градови. Feminine книга → книги (-а → -и). Neuter село → села (-о → -а). Watch for irregulars: дете → деца, човек → луѓе (person → people).",
    pattern: {
      headers: ["singular", "plural", "pattern"],
      rows: [
        ["маж (man)", "мажи", "masc + -и"],
        ["град (city)", "градови", "short masc + -ови"],
        ["книга (book)", "книги", "fem -а → -и"],
        ["село (village)", "села", "neut -о → -а"],
      ],
      spotlightCol: 1,
    },
    examples: [
      "маж → мажи — man → men",
      "книга → книги — book → books",
      "град → градови — city → cities",
      "село → села — village → villages",
    ],
    confidence: "authored",
    drills: [
      drill("pl-books", "noun-plurals", "plural of книга (book)", ["книги", "книгови", "книга"], "книги", "Feminine -а → -и.", "books"),
      drill("pl-cities", "noun-plurals", "plural of град (city)", ["градови", "гради", "градот"], "градови", "Short masculine noun → -ови.", "cities"),
      drill("pl-villages", "noun-plurals", "plural of село (village)", ["села", "селови", "селој"], "села", "Neuter -о → -а.", "villages"),
      drill("pl-women", "noun-plurals", "plural of жена (woman)", ["жени", "женови", "жена"], "жени", "Feminine -а → -и.", "women"),
    ],
  },
  {
    id: "possessives",
    name: "“My / your” — and the family shortcut",
    technicalName: "Possessives (мој…) and the short dative",
    plain: "“My/your” agree with the noun’s gender, usually with “the” attached: мојот стол (my chair), мојата книга (my book), моето пиво (my beer). For family there’s a shortcut — a little pronoun after the noun: мајка ми = “my mom.”",
    explanation:
      "мој/моја/мое/мои = my; твој/твоја/твое/твои = your; then негов (his), нејзин (her), наш (our), ваш (your all), нивен (their). In everyday speech they usually carry the article: мојот, мојата, моето. The short form (мајка ми, брат ми, татко му) is the natural way to talk about relatives.",
    pattern: {
      headers: ["noun", "my", "your"],
      rows: [
        ["стол (chair, m)", "мојот стол", "твојот стол"],
        ["книга (book, f)", "мојата книга", "твојата книга"],
        ["пиво (beer, n)", "моето пиво", "твоето пиво"],
      ],
      spotlightCol: 1,
    },
    examples: [
      "мојот стол — my chair",
      "мојата книга — my book",
      "твоето пиво — your beer",
      "мајка ми — my mom (short form)",
    ],
    confidence: "authored",
    drills: [
      drill("pos-book", "possessives", "“my book” (книга, feminine)", ["мојата книга", "мојот книга", "моето книга"], "мојата книга", "Feminine → мојата.", "my book"),
      drill("pos-beer", "possessives", "“my beer” (пиво, neuter)", ["моето пиво", "мојот пиво", "мојата пиво"], "моето пиво", "Neuter → моето.", "my beer"),
      drill("pos-chair", "possessives", "“your chair” (стол, masculine)", ["твојот стол", "твојата стол", "твоето стол"], "твојот стол", "Masculine → твојот.", "your chair"),
      drill("pos-mom", "possessives", "“my mom” (short form)", ["мајка ми", "ми мајка", "мајка мене"], "мајка ми", "The short dative sits right after the noun: мајка ми.", "my mom"),
    ],
  },
  {
    id: "prepositions",
    name: "Little linking words (in, on, with…)",
    technicalName: "Common prepositions",
    plain: "Small words before a noun: во (in), на (on/to), со (with), од (from), до (to / next to). Macedonian leans hard on на — it also covers “to (someone)” and “of.”",
    explanation:
      "во = in/into (во Скопје), на = on/onto and “to” for a person (на масата; му реков на Марко), со = with (кафе со млеко), од = from/of (од Македонија), до = up to / next to (до банката). They don’t change the noun’s form — Macedonian dropped cases.",
    pattern: {
      headers: ["preposition", "meaning", "example"],
      rows: [
        ["во", "in", "во Скопје"],
        ["на", "on / to", "на масата"],
        ["со", "with", "кафе со млеко"],
        ["од", "from", "од Македонија"],
        ["до", "to / next to", "до банката"],
      ],
      spotlightCol: 0,
    },
    examples: [
      "Живеам во Скопје — I live in Skopje",
      "Кафе со млеко — Coffee with milk",
      "Јас сум од Америка — I'm from America",
      "До банката — Next to the bank",
    ],
    confidence: "authored",
    drills: [
      drill("prep-with", "prepositions", "“кафе ___ млеко” (coffee with milk)", ["со", "од", "во"], "со", "со = with.", "with"),
      drill("prep-from", "prepositions", "“Јас сум ___ Скопје” (from Skopje)", ["од", "до", "на"], "од", "од = from.", "from"),
      drill("prep-in", "prepositions", "“Живеам ___ Скопје” (in Skopje)", ["во", "со", "до"], "во", "во = in.", "in"),
      drill("prep-on", "prepositions", "“___ масата” (on the table)", ["на", "во", "со"], "на", "на = on / onto.", "on"),
    ],
  },
  {
    id: "numbers",
    name: "Counting things",
    technicalName: "Numbers and counted nouns",
    plain: "“One” matches gender (еден/една/едно). “Two” is два for masculine, две for feminine and neuter. From two up, the noun goes plural: три пива. For people there’s a special form — двајца (“two [people]”).",
    explanation:
      "еден маж / една вода / едно пиво. Then два (m) vs две (f/n): два сока, две кафиња. Higher numbers just take the plural noun: три пива, пет денари. Counting people uses -ица forms: двајца, тројца, четворица (two/three/four people).",
    pattern: {
      headers: ["number", "with a noun", "note"],
      rows: [
        ["1", "една вода", "matches gender (еден/една/едно)"],
        ["2", "два сока / две кафиња", "два (m), две (f/n)"],
        ["3", "три пива", "noun goes plural"],
        ["2 people", "двајца пријатели", "special counting form"],
      ],
      spotlightCol: 1,
    },
    examples: [
      "една вода — one water",
      "две кафиња — two coffees",
      "три пива — three beers",
      "двајца пријатели — two friends",
    ],
    confidence: "authored",
    drills: [
      drill("num-coffee", "numbers", "“two coffees” (кафе, neuter)", ["две кафиња", "два кафиња", "две кафе"], "две кафиња", "Neuter → две, and the noun is plural (кафиња).", "two coffees"),
      drill("num-water", "numbers", "“one water” (вода, feminine)", ["една", "еден", "едно"], "една", "вода is feminine → една.", "one water"),
      drill("num-beers", "numbers", "“three beers” (пиво)", ["три пива", "три пиво", "три пивови"], "три пива", "From two up, the noun is plural: пива.", "three beers"),
      drill("num-people", "numbers", "“two friends” (people)", ["двајца", "две", "два"], "двајца", "Counting people uses двајца.", "two (people)"),
    ],
  },
  {
    id: "imperatives",
    name: "Telling someone to do something",
    technicalName: "The imperative (commands)",
    plain: "To give a command: -а/-е verbs take -ј (гледај! “look!”), while -и and consonant verbs take -и (дојди! “come!”). Add -те for a group. For “don’t”, use немој да: Немој да одиш!",
    explanation:
      "One person: слушај! (listen), пиј! (drink), дојди! (come), земи! (take). A group: add -те — слушајте!, дојдете!. Negative commands lead with немој (да): Немој да одиш! = “Don’t go!”",
    pattern: {
      headers: ["verb", "to one person", "to a group"],
      rows: [
        ["гледа (look)", "гледај!", "гледајте!"],
        ["слуша (listen)", "слушај!", "слушајте!"],
        ["пие (drink)", "пиј!", "пијте!"],
        ["дојде (come)", "дојди!", "дојдете!"],
      ],
      spotlightCol: 1,
    },
    examples: [
      "Слушај! — Listen!",
      "Пиј вода! — Drink water!",
      "Дојди тука! — Come here!",
      "Немој да одиш! — Don't go!",
    ],
    confidence: "authored",
    drills: [
      drill("imp-look", "imperatives", "“Look!” (to one person)", ["Гледај", "Гледаш", "Гледа"], "Гледај", "-а verb → -ј in the command.", "look!"),
      drill("imp-come", "imperatives", "“Come here!” (to one person)", ["Дојди", "Доаѓа", "Дојде"], "Дојди", "consonant stem → -и: дојди.", "come!"),
      drill("imp-listen", "imperatives", "“Listen!” (to a group)", ["Слушајте", "Слушај", "Слушаат"], "Слушајте", "Add -те for more than one person.", "listen! (pl)"),
      drill("imp-dont", "imperatives", "“Don’t go!” →", ["Немој да одиш", "Не одиме", "Одиш не"], "Немој да одиш", "Negative command = немој да + verb.", "don't go!"),
    ],
  },
  {
    id: "comparatives",
    name: "“More” and “most”",
    technicalName: "Comparatives & superlatives (по- / нај-)",
    plain: "Stick по- on the front for “more” and нај- for “most”: убав → поубав → најубав. It works on almost any adjective or adverb, as one word. “Than” is од.",
    explanation:
      "поголем (bigger), најголем (biggest); добро → подобро (better), најдобро (best). To compare, use од for “than”: Тој е повисок од мене (He's taller than me).",
    pattern: {
      headers: ["base", "more (по-)", "most (нај-)"],
      rows: [
        ["убав (nice)", "поубав", "најубав"],
        ["голем (big)", "поголем", "најголем"],
        ["добар (good)", "подобар", "најдобар"],
        ["брзо (fast)", "побрзо", "најбрзо"],
      ],
      spotlightCol: 1,
    },
    examples: [
      "Ова кафе е подобро — This coffee is better",
      "Тој е најдобар — He's the best",
      "Побрзо, ве молам! — Faster, please!",
      "Таа е повисока од мене — She's taller than me",
    ],
    confidence: "authored",
    drills: [
      drill("cmp-bigger", "comparatives", "“bigger” (голем)", ["поголем", "најголем", "големи"], "поголем", "по- = more.", "bigger"),
      drill("cmp-best", "comparatives", "“the best” (добар)", ["најдобар", "подобар", "добри"], "најдобар", "нај- = most.", "the best"),
      drill("cmp-than", "comparatives", "“повисок ___ мене” (taller than me)", ["од", "по", "нај"], "од", "“than” = од.", "than"),
      drill("cmp-nicer", "comparatives", "“nicer” (убав)", ["поубав", "најубав", "убави"], "поубав", "по- = more.", "nicer"),
    ],
  },
  {
    id: "perfect-tense",
    name: "The “have done” past",
    technicalName: "The сум-perfect (l-form)",
    plain: "A second past built from сум + a special verb form ending in -л/-ла/-ло/-ле. Use it for experiences and things you didn’t witness: Дали си бил во Охрид? = “Have you been to Ohrid?”",
    explanation:
      "Present of сум + the l-form: сум бил / сум била (I have been, m/f), си бил, сме биле. In he/she/they, drop the сум — just the l-form: тој видел (he has seen), тие виделе. It contrasts with the plain past (бев “I was”), which is for things you witnessed directly.",
    pattern: {
      headers: ["person", "“have been”", "note"],
      rows: [
        ["јас (I)", "сум бил / сум била", "сум + l-form"],
        ["ти (you)", "си бил / си била", "си + l-form"],
        ["тој/таа (he/she)", "бил / била", "no сум in 3rd person"],
        ["ние (we)", "сме биле", "сме + l-form"],
        ["тие (they)", "се биле", "се + l-form"],
      ],
      spotlightCol: 1,
    },
    examples: [
      "Сум бил во Скопје — I've been to Skopje (m)",
      "Сум била во Скопје — I've been to Skopje (f)",
      "Дали си јадел баклава? — Have you eaten baklava?",
      "Тој видел сè — He has seen everything",
    ],
    confidence: "authored",
    drills: [
      drill("prf-been-m", "perfect-tense", "“I have been” (male speaker)", ["сум бил", "сум била", "бев"], "сум бил", "сум + l-form; male → бил.", "I have been"),
      drill("prf-you", "perfect-tense", "“Have you been…?” (ти)", ["си бил", "сум бил", "е бил"], "си бил", "ти → си + l-form.", "you have been"),
      drill("prf-third", "perfect-tense", "“he has seen” →", ["тој видел", "тој е видел", "тој видев"], "тој видел", "3rd person drops сум — just the l-form.", "he has seen"),
      drill("prf-we", "perfect-tense", "“we have been” (ние)", ["сме биле", "сме бил", "се биле"], "сме биле", "ние → сме + l-form (plural биле).", "we have been"),
    ],
  },
];
