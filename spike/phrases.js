// Hand-authored bar/café scenario phrases, graded from a single word up to a
// short sentence. These are the "known-good reference" — keep them small and
// verified. Stress is left to the feedback LLM (antepenultimate rule + loanword
// exceptions like кафе), so transliteration here is plain, not stress-marked.

export const phrases = [
  {
    id: "zdravo",
    cyrillic: "Здраво.",
    translit: "Zdravo.",
    english: "Hi. / Hello.",
    note: "Two syllables, stress on the first: ZDRA-vo.",
  },
  {
    id: "edno-pivo",
    cyrillic: "Едно пиво, ве молам.",
    translit: "Edno pivo, ve molam.",
    english: "One beer, please.",
    note: "ве молам = 'please' (literally 'I ask you').",
  },
  {
    id: "kolku-chini",
    cyrillic: "Колку чини?",
    translit: "Kolku chini?",
    english: "How much is it?",
  },
  {
    id: "sakam-kafe",
    cyrillic: "Сакам кафе.",
    translit: "Sakam kafe.",
    english: "I want a coffee.",
    note: "кафе is a loanword with final stress (ka-FE) — an exception to the antepenultimate rule.",
  },
  {
    id: "kade-toalet",
    cyrillic: "Каде е тоалетот?",
    translit: "Kade e toaletot?",
    english: "Where is the toilet?",
    note: "тоалетот = 'the toilet' (postposed definite article -от).",
  },
  {
    id: "smetkata",
    cyrillic: "Сметката, ве молам.",
    translit: "Smetkata, ve molam.",
    english: "The bill, please.",
  },
  {
    id: "nazdravje",
    cyrillic: "Наздравје!",
    translit: "Nazdravje!",
    english: "Cheers!",
  },
  {
    id: "dopaga-mesto",
    cyrillic: "Ми се допаѓа ова место.",
    translit: "Mi se dopagja ova mesto.",
    english: "I like this place.",
    note: "Uses the unique letter ѓ; ова место = 'this place' (neuter).",
  },
];
