import type { PhonologyRules, GrammarConcept } from "@ll/pack-schema";

export const phonology: PhonologyRules = {
  notes: "Highly phonetic: ~one letter, one sound. Lean on this in alphabet onboarding.",
  stressRule: "Antepenultimate — stress on the 3rd-from-last syllable (words of 3+ syllables).",
  exceptions: ["Many loanwords keep their own stress, e.g. кафе → ka-FE (final syllable)."],
};

// The grammar features that ACTUALLY matter for Macedonian — deliberately NO Slavic case system.
export const grammar: GrammarConcept[] = [
  {
    id: "definite-articles",
    name: "Postposed definite articles (three-way deixis)",
    explanation:
      "The article attaches to the END of the noun and encodes proximity: книга → книгата (neutral) / книгава (this, near) / книгана (that, far). Unusual cross-linguistically; needs dedicated drilling.",
    examples: ["книга → книгата", "книга → книгава", "книга → книгана"],
    drills: [],
  },
  {
    id: "gender",
    name: "Three genders + agreement",
    explanation:
      "Nouns are masculine, feminine, or neuter; ALWAYS learn a noun with its gender, because numbers/articles/adjectives agree. едно пиво (n) vs една вода (f) vs еден сок (m).",
    examples: ["пиво (n) → едно пиво", "вода (f) → една вода", "сок (m) → еден сок"],
    drills: [],
  },
  {
    id: "verb-aspect",
    name: "Verb aspect (perfective / imperfective)",
    explanation:
      "Most verbs come in an aspect pair; the choice marks completed vs ongoing action. Taught across the core tenses.",
    examples: ["пие (impf) / испие (pf) — to drink"],
    drills: [],
  },
  {
    id: "clitics",
    name: "Clitic pronoun ordering",
    explanation: "Short (clitic) pronoun forms cluster in a fixed order in front of the verb.",
    examples: ["Ми се допаѓа — 'I like it' (to-me + refl + pleases)"],
    drills: [],
  },
];
