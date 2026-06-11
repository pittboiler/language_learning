import type { ReviewItem } from "@ll/pack-schema";

// High-frequency bar/café vocab + phrases, all verified during the spike. Nouns carry gender in meta.
export const vocab: ReviewItem[] = [
  { id: "v-zdravo", kind: "phrase", prompt: "Hi / Hello", answer: "Здраво", gloss: "Hi", i1Level: 1, tags: ["greeting"] },
  { id: "v-pivo", kind: "vocab", prompt: "beer", answer: "пиво", gloss: "beer", i1Level: 1, tags: ["drinks"], meta: { gender: "neuter" } },
  { id: "v-kafe", kind: "vocab", prompt: "coffee", answer: "кафе", gloss: "coffee", i1Level: 1, tags: ["drinks"], meta: { gender: "neuter", stress: "final (ka-FE) — loanword exception" } },
  { id: "v-edno-pivo", kind: "phrase", prompt: "One beer, please", answer: "Едно пиво, ве молам", gloss: "One beer, please", i1Level: 2, tags: ["ordering"] },
  { id: "v-kolku-chini", kind: "phrase", prompt: "How much is it?", answer: "Колку чини?", gloss: "How much does it cost?", i1Level: 2, tags: ["ordering"] },
  { id: "v-smetka", kind: "phrase", prompt: "The bill, please", answer: "Сметката, ве молам", gloss: "The bill, please", i1Level: 2, tags: ["paying"] },
  { id: "v-nazdravje", kind: "phrase", prompt: "Cheers!", answer: "Наздравје!", gloss: "Cheers!", i1Level: 1, tags: ["social"] },
];
