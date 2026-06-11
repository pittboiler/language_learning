import type { Reader } from "@ll/pack-schema";

// Graded reader at i+1 — short, simple, reinforces bar/café vocab + definite articles.
// Hand-authored. confidence: "authored" — but in Jake's native spot-check queue.
export const readers: Reader[] = [
  {
    id: "cafe",
    title: "Во кафулето",
    titleGloss: "At the café",
    i1Level: 2,
    confidence: "authored",
    body: [
      { speaker: "partner", text: "Марко влегува во кафуле.", translit: "Marko vleguva vo kafule.", gloss: "Marko enters a café." },
      { speaker: "partner", text: "Сака едно кафе.", translit: "Saka edno kafe.", gloss: "He wants a coffee." },
      { speaker: "partner", text: "Конобарот вели: Повелете!", translit: "Konobarot veli: Povelete!", gloss: "The waiter says: Here you go!" },
      { speaker: "partner", text: "Марко пие кафе и чита книга.", translit: "Marko pie kafe i chita kniga.", gloss: "Marko drinks coffee and reads a book." },
      { speaker: "partner", text: "Кафето е добро.", translit: "Kafeto e dobro.", gloss: "The coffee is good." },
    ],
  },
];
