import type { MiniStory } from "@ll/pack-schema";

// Hand-authored A1 mini-story — the comprehensible-input on-ramp + the Validator's gold standard.
// High-frequency café vocabulary, reusing the bar/café benchmark and patterns already authored
// elsewhere in the pack (so it stays internally consistent). confidence:"authored" — verified
// consistent, but (like the reader) in Jake's native spot-check queue. audioSource:"tts" — no native
// recording yet; played via ElevenLabs multilingual TTS (flagged for a human voice later).
export const stories: MiniStory[] = [
  {
    id: "ana-coffee",
    title: "Ана и кафето",
    titleGloss: "Ana and the coffee",
    i1Level: 1,
    level: "A1",
    theme: "Café & bar",
    audioSource: "tts",
    confidence: "authored",
    body: [
      { text: "Ана сака кафе.", translit: "Ana saka kafe.", gloss: "Ana likes coffee." },
      { text: "Таа влегува во кафуле.", translit: "Taa vleguva vo kafule.", gloss: "She enters a café." },
      { text: "Ана вели: „Здраво! Едно кафе, ве молам.“", translit: "Ana veli: Zdravo! Edno kafe, ve molam.", gloss: "Ana says: \"Hi! One coffee, please.\"" },
      { text: "Конобарот вели: „Повелете.“", translit: "Konobarot veli: Povelete.", gloss: "The waiter says: \"Here you go.\"" },
      { text: "Ана пие кафе. Кафето е добро.", translit: "Ana pie kafe. Kafeto e dobro.", gloss: "Ana drinks coffee. The coffee is good." },
      { text: "„Колку чини?“ прашува Ана.", translit: "Kolku chini? prašuva Ana.", gloss: "\"How much is it?\" asks Ana." },
      { text: "„Педесет денари.“", translit: "Pedeset denari.", gloss: "\"Fifty denars.\"" },
      { text: "Ана плаќа и вели: „Фала!“", translit: "Ana plakja i veli: Fala!", gloss: "Ana pays and says: \"Thanks!\"" },
    ],
    qa: [
      { id: "q1", question: "Што сака Ана?", questionGloss: "What does Ana like?", answer: "Кафе.", answerGloss: "Coffee." },
      { id: "q2", question: "Каде влегува Ана?", questionGloss: "Where does Ana go in?", answer: "Во кафуле.", answerGloss: "Into a café." },
      {
        id: "q3",
        question: "Нарачај едно кафе — кажи го гласно!",
        questionGloss: "Order one coffee — say it aloud!",
        answer: "Едно кафе, ве молам.",
        answerGloss: "One coffee, please.",
        answerTranslit: "Edno kafe, ve molam.",
        spokenPrompt: true,
      },
    ],
    registersVocab: [
      { lexKey: "сака", gloss: "likes / wants" },
      { lexKey: "кафе", gloss: "coffee" },
      { lexKey: "влегува", gloss: "enters / goes in" },
      { lexKey: "кафуле", gloss: "café" },
      { lexKey: "здраво", gloss: "hi / hello" },
      { lexKey: "едно", gloss: "one (neuter)" },
      { lexKey: "ве молам", gloss: "please" },
      { lexKey: "повелете", gloss: "here you go" },
      { lexKey: "пие", gloss: "drinks" },
      { lexKey: "добро", gloss: "good (neuter)" },
      { lexKey: "колку чини", gloss: "how much is it" },
      { lexKey: "денари", gloss: "denars (currency)" },
      { lexKey: "плаќа", gloss: "pays" },
      { lexKey: "фала", gloss: "thanks" },
    ],
  },
];
