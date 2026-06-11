// Phase-0/1 content. Mirrors @ll/pack-mk (the monorepo target) so the loop runs standalone.
// NOTE: hand-authored by AI — kept to high-confidence forms; flagged for native spot-check.

// Full 31-letter Macedonian Cyrillic alphabet. `unique` = one of the 7 letters special to
// Macedonian; `falseFriend` = looks like a Latin letter but sounds different (the usual traps).
export const alphabet = [
  { glyph: "А", name: "a", sound: "a (father)", example: "ама", exampleGloss: "but" },
  { glyph: "Б", name: "be", sound: "b", example: "бел", exampleGloss: "white" },
  { glyph: "В", name: "ve", sound: "v", example: "вода", exampleGloss: "water", falseFriend: true },
  { glyph: "Г", name: "ge", sound: "g (go)", example: "град", exampleGloss: "city" },
  { glyph: "Д", name: "de", sound: "d", example: "дома", exampleGloss: "home" },
  { glyph: "Ѓ", name: "gje", sound: "soft 'dj' (ɟ)", example: "допаѓа", exampleGloss: "likes", unique: true },
  { glyph: "Е", name: "e", sound: "e (bet)", example: "еден", exampleGloss: "one" },
  { glyph: "Ж", name: "zhe", sound: "'zh' (measure)", example: "жена", exampleGloss: "woman" },
  { glyph: "З", name: "ze", sound: "z", example: "здраво", exampleGloss: "hello" },
  { glyph: "Ѕ", name: "dze", sound: "'dz'", example: "ѕвезда", exampleGloss: "star", unique: true },
  { glyph: "И", name: "i", sound: "i (machine)", example: "има", exampleGloss: "there is" },
  { glyph: "Ј", name: "je", sound: "'y' (yes)", example: "јас", exampleGloss: "I", unique: true },
  { glyph: "К", name: "ka", sound: "k", example: "кафе", exampleGloss: "coffee" },
  { glyph: "Л", name: "le", sound: "l", example: "лето", exampleGloss: "summer" },
  { glyph: "Љ", name: "lje", sound: "soft 'l' (ʎ)", example: "љубов", exampleGloss: "love", unique: true },
  { glyph: "М", name: "me", sound: "m", example: "мајка", exampleGloss: "mother" },
  { glyph: "Н", name: "ne", sound: "n", example: "не", exampleGloss: "no", falseFriend: true },
  { glyph: "Њ", name: "nje", sound: "soft 'n' (ɲ)", example: "њива", exampleGloss: "field", unique: true },
  { glyph: "О", name: "o", sound: "o", example: "око", exampleGloss: "eye" },
  { glyph: "П", name: "pe", sound: "p", example: "пиво", exampleGloss: "beer" },
  { glyph: "Р", name: "re", sound: "rolled r", example: "река", exampleGloss: "river", falseFriend: true },
  { glyph: "С", name: "se", sound: "s", example: "сонце", exampleGloss: "sun", falseFriend: true },
  { glyph: "Т", name: "te", sound: "t", example: "тато", exampleGloss: "dad" },
  { glyph: "Ќ", name: "kje", sound: "soft 'tj' (c)", example: "ноќ", exampleGloss: "night", unique: true },
  { glyph: "У", name: "u", sound: "u (boot)", example: "утро", exampleGloss: "morning", falseFriend: true },
  { glyph: "Ф", name: "fe", sound: "f", example: "фала", exampleGloss: "thanks" },
  { glyph: "Х", name: "ha", sound: "h", example: "храна", exampleGloss: "food", falseFriend: true },
  { glyph: "Ц", name: "tse", sound: "'ts'", example: "цвет", exampleGloss: "flower" },
  { glyph: "Ч", name: "che", sound: "'ch'", example: "чај", exampleGloss: "tea" },
  { glyph: "Џ", name: "dzhe", sound: "'j' (jam)", example: "џезве", exampleGloss: "coffee pot", unique: true },
  { glyph: "Ш", name: "sha", sound: "'sh'", example: "шума", exampleGloss: "forest" },
];

export const scenarios = [
  {
    id: "bar-order-a-drink",
    title: "Order a drink",
    goal: "Greet, order a beer, ask the price, and pay.",
    setting: "A relaxed bar in Skopje.",
    criteria: [
      { id: "greeted", label: "Greeted" },
      { id: "ordered", label: "Ordered a drink" },
      { id: "asked-price", label: "Asked the price" },
      { id: "paid", label: "Asked for the bill" },
    ],
    turns: [
      { speaker: "partner", text: "Здраво! Што сакаш?", gloss: "Hi! What would you like?" },
      { speaker: "learner", text: "Здраво! Едно пиво, ве молам.", translit: "Zdravo! Edno pivo, ve molam.", gloss: "Hi! One beer, please.", criteria: ["greeted", "ordered"] },
      { speaker: "partner", text: "Секако. Скопско или Златен Даб?", gloss: "Of course. Skopsko or Zlaten Dab?" },
      { speaker: "learner", text: "Едно Скопско. Колку чини?", translit: "Edno Skopsko. Kolku chini?", gloss: "One Skopsko. How much is it?", criteria: ["asked-price"] },
      { speaker: "partner", text: "Сто и педесет денари.", gloss: "A hundred and fifty denars." },
      { speaker: "learner", text: "Сметката, ве молам.", translit: "Smetkata, ve molam.", gloss: "The bill, please.", criteria: ["paid"] },
      { speaker: "partner", text: "Повелете. Наздравје!", gloss: "Here you are. Cheers!" },
    ],
  },
  {
    id: "bar-small-talk",
    title: "Small talk with someone",
    goal: "Greet a stranger, say where you're from, and that you're learning Macedonian.",
    setting: "Standing next to someone at the bar.",
    criteria: [
      { id: "greeted", label: "Said hello" },
      { id: "origin", label: "Said where you're from" },
      { id: "learning", label: "Said you're learning" },
    ],
    turns: [
      { speaker: "partner", text: "Здраво! Како се викаш?", gloss: "Hi! What's your name?" },
      { speaker: "learner", text: "Здраво! Јас сум Џејкоб.", translit: "Zdravo! Jas sum Jacob.", gloss: "Hi! I'm Jacob.", criteria: ["greeted"] },
      { speaker: "partner", text: "Мило ми е! Од каде си?", gloss: "Nice to meet you! Where are you from?" },
      { speaker: "learner", text: "Од Америка сум.", translit: "Od Amerika sum.", gloss: "I'm from America.", criteria: ["origin"] },
      { speaker: "partner", text: "Супер! Зборуваш македонски?", gloss: "Cool! Do you speak Macedonian?" },
      { speaker: "learner", text: "Учам македонски.", translit: "Učam makedonski.", gloss: "I'm learning Macedonian.", criteria: ["learning"] },
      { speaker: "partner", text: "Браво! Одлично ти оди.", gloss: "Well done! You're doing great." },
    ],
  },
];

// Grammar concepts that matter for Macedonian, each with quick multiple-choice drills (factual).
export const grammar = [
  {
    id: "gender",
    name: "Gender agreement — едно / една / еден",
    explain: "Nouns are neuter, feminine, or masculine, and 'one/a' agrees: едно (n), една (f), еден (m). Always learn a noun with its gender.",
    examples: ["едно пиво (n)", "една вода (f)", "еден сок (m)"],
    drills: [
      { id: "g-pivo", prompt: "___ пиво  (a beer)", options: ["едно", "една", "еден"], answer: "едно", why: "пиво is neuter → едно" },
      { id: "g-voda", prompt: "___ вода  (a water)", options: ["едно", "една", "еден"], answer: "една", why: "вода is feminine → една" },
      { id: "g-sok", prompt: "___ сок  (a juice)", options: ["едно", "една", "еден"], answer: "еден", why: "сок is masculine → еден" },
      { id: "g-kafe", prompt: "___ кафе  (a coffee)", options: ["едно", "една", "еден"], answer: "едно", why: "кафе is neuter → едно" },
    ],
  },
  {
    id: "articles",
    name: "The 'the' that points — книгата / книгава / книгана",
    explain: "The definite article attaches to the END of the noun and marks distance: -та neutral, -ва near ('this'), -на far ('that'). Example noun: книга (book).",
    examples: ["книгата (neutral)", "книгава (this/near)", "книгана (that/far)"],
    drills: [
      { id: "a-neutral", prompt: "the book  (neutral)", options: ["книгата", "книгава", "книгана"], answer: "книгата", why: "-та = neutral 'the'" },
      { id: "a-near", prompt: "this book  (near you)", options: ["книгата", "книгава", "книгана"], answer: "книгава", why: "-ва = near ('this')" },
      { id: "a-far", prompt: "that book  (far away)", options: ["книгата", "книгава", "книгана"], answer: "книгана", why: "-на = far ('that')" },
    ],
  },
];

// Graded reader at i+1 — short, simple, reinforces the bar/café vocab + definite articles.
export const readers = [
  {
    id: "cafe",
    title: "Во кафулето",
    titleGloss: "At the café",
    lines: [
      { mk: "Марко влегува во кафуле.", gloss: "Marko enters a café." },
      { mk: "Сака едно кафе.", gloss: "He wants a coffee." },
      { mk: "Конобарот вели: Повелете!", gloss: "The waiter says: Here you go!" },
      { mk: "Марко пие кафе и чита книга.", gloss: "Marko drinks coffee and reads a book." },
      { mk: "Кафето е добро.", gloss: "The coffee is good." },
    ],
  },
];

export const reviewItems = [
  { id: "v-zdravo", cyrillic: "Здраво", translit: "Zdravo", english: "Hi / Hello" },
  { id: "v-edno-pivo", cyrillic: "Едно пиво, ве молам", translit: "Edno pivo, ve molam", english: "One beer, please" },
  { id: "v-kolku-chini", cyrillic: "Колку чини?", translit: "Kolku chini?", english: "How much is it?" },
  { id: "v-smetka", cyrillic: "Сметката, ве молам", translit: "Smetkata, ve molam", english: "The bill, please" },
  { id: "v-nazdravje", cyrillic: "Наздравје!", translit: "Nazdravje!", english: "Cheers!" },
  { id: "v-od-kade", cyrillic: "Од каде си?", translit: "Od kade si?", english: "Where are you from?" },
  { id: "v-ucam", cyrillic: "Учам македонски", translit: "Učam makedonski", english: "I'm learning Macedonian" },
];
