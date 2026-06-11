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
export const grammar: GrammarConcept[] = [
  {
    id: "definite-articles",
    name: "Postposed definite articles (three-way deixis)",
    explanation:
      "The article attaches to the END of the noun and encodes proximity: книга → книгата (neutral) / книгава (this, near) / книгана (that, far). Unusual cross-linguistically; needs dedicated drilling.",
    examples: ["книга → книгата", "книга → книгава", "книга → книгана"],
    confidence: "authored",
    drills: [
      drill("a-neutral", "definite-articles", "the book  (neutral)", ["книгата", "книгава", "книгана"], "книгата", "-та = neutral 'the'", "the book (neutral)"),
      drill("a-near", "definite-articles", "this book  (near you)", ["книгата", "книгава", "книгана"], "книгава", "-ва = near ('this')", "this book (near)"),
      drill("a-far", "definite-articles", "that book  (far away)", ["книгата", "книгава", "книгана"], "книгана", "-на = far ('that')", "that book (far)"),
    ],
  },
  {
    id: "gender",
    name: "Three genders + agreement (едно / една / еден)",
    explanation:
      "Nouns are neuter, feminine, or masculine, and 'one/a' agrees: едно (n), една (f), еден (m). ALWAYS learn a noun with its gender, because numbers/articles/adjectives agree.",
    examples: ["едно пиво (n)", "една вода (f)", "еден сок (m)"],
    confidence: "authored",
    drills: [
      drill("g-pivo", "gender", "___ пиво  (a beer)", ["едно", "една", "еден"], "едно", "пиво is neuter → едно", "a beer"),
      drill("g-voda", "gender", "___ вода  (a water)", ["едно", "една", "еден"], "една", "вода is feminine → една", "a water"),
      drill("g-sok", "gender", "___ сок  (a juice)", ["едно", "една", "еден"], "еден", "сок is masculine → еден", "a juice"),
      drill("g-kafe", "gender", "___ кафе  (a coffee)", ["едно", "една", "еден"], "едно", "кафе is neuter → едно", "a coffee"),
    ],
  },
  {
    id: "verb-aspect",
    name: "Verb aspect (perfective / imperfective)",
    explanation: "Most verbs come in an aspect pair; the choice marks completed vs ongoing action. Taught across the core tenses.",
    examples: ["пие (impf) / испие (pf) — to drink"],
    confidence: "authored",
    drills: [],
  },
  {
    id: "clitics",
    name: "Clitic pronoun ordering",
    explanation: "Short (clitic) pronoun forms cluster in a fixed order in front of the verb.",
    examples: ["Ми се допаѓа — 'I like it' (to-me + refl + pleases)"],
    confidence: "authored",
    drills: [],
  },
];
