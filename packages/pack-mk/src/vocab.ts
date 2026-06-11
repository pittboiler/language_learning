import type { ReviewItem } from "@ll/pack-schema";

// High-frequency bar/café vocab + phrases, all verified during the spike. Nouns carry gender in meta.
// confidence: "authored".
export const vocab: ReviewItem[] = [
  { id: "v-zdravo", kind: "phrase", prompt: "Hi / Hello", answer: "Здраво", translit: "Zdravo", gloss: "Hi", i1Level: 1, tags: ["greeting"], confidence: "authored" },
  { id: "v-pivo", kind: "vocab", prompt: "beer", answer: "пиво", translit: "pivo", gloss: "beer", i1Level: 1, tags: ["drinks"], meta: { gender: "neuter" }, confidence: "authored" },
  { id: "v-kafe", kind: "vocab", prompt: "coffee", answer: "кафе", translit: "kafe", gloss: "coffee", i1Level: 1, tags: ["drinks"], note: "Loanword with final stress (ka-FE) — an exception to the antepenultimate rule.", meta: { gender: "neuter" }, confidence: "authored" },
  { id: "v-voda", kind: "vocab", prompt: "water", answer: "вода", translit: "voda", gloss: "water", i1Level: 1, tags: ["drinks"], meta: { gender: "feminine" }, confidence: "authored" },
  { id: "v-sok", kind: "vocab", prompt: "juice", answer: "сок", translit: "sok", gloss: "juice", i1Level: 1, tags: ["drinks"], meta: { gender: "masculine" }, confidence: "authored" },
  { id: "v-edno-pivo", kind: "phrase", prompt: "One beer, please", answer: "Едно пиво, ве молам", translit: "Edno pivo, ve molam", gloss: "One beer, please", i1Level: 2, tags: ["ordering"], note: "ве молам = 'please' (literally 'I ask you').", confidence: "authored" },
  { id: "v-kolku-chini", kind: "phrase", prompt: "How much is it?", answer: "Колку чини?", translit: "Kolku chini?", gloss: "How much does it cost?", i1Level: 2, tags: ["ordering"], confidence: "authored" },
  { id: "v-smetka", kind: "phrase", prompt: "The bill, please", answer: "Сметката, ве молам", translit: "Smetkata, ve molam", gloss: "The bill, please", i1Level: 2, tags: ["paying"], confidence: "authored" },
  { id: "v-nazdravje", kind: "phrase", prompt: "Cheers!", answer: "Наздравје!", translit: "Nazdravje!", gloss: "Cheers!", i1Level: 1, tags: ["social"], confidence: "authored" },
  { id: "v-od-kade", kind: "phrase", prompt: "Where are you from?", answer: "Од каде си?", translit: "Od kade si?", gloss: "Where are you from?", i1Level: 2, tags: ["small-talk"], confidence: "authored" },
  { id: "v-ucam", kind: "phrase", prompt: "I'm learning Macedonian", answer: "Учам македонски", translit: "Učam makedonski", gloss: "I'm learning Macedonian", i1Level: 2, tags: ["small-talk"], confidence: "authored" },
];
