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
];
