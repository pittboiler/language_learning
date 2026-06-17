// PROMOTED from generated-stage2.ts — spot-checked + corrected (see pipeline/output/wave-mk-stage2.md),
// confidence:"validated". This is the SERVED copy (wired into index.ts); generated-stage2.ts stays as the raw audit trail.
import type { ReviewItem, Scenario, MiniStory, WritingTask, InfoGapTask } from "@ll/pack-schema";

export const promotedVocab: ReviewItem[] = [
  {
    "id": "gen-s2-smalltalk-v1",
    "kind": "phrase",
    "prompt": "I like it.",
    "answer": "Ми се допаѓа.",
    "translit": "Mi se dopaǵa.",
    "gloss": "I like it.",
    "note": "Lit. 'It pleases me'; subject is the liked thing.",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-smalltalk",
      "express-like",
      "express-dislike"
    ],
    "meta": {
      "freqRank": 1
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-smalltalk-v2",
    "kind": "phrase",
    "prompt": "I don't like it.",
    "answer": "Не ми се допаѓа.",
    "translit": "Ne mi se dopaǵa.",
    "gloss": "I don't like it.",
    "note": "Negation with 'не' before the verb phrase.",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-smalltalk",
      "express-like",
      "express-dislike"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-smalltalk-v3",
    "kind": "phrase",
    "prompt": "I want to …",
    "answer": "Сакам да …",
    "translit": "Sakam da …",
    "gloss": "I want to …",
    "note": "'да' + present verb follows.",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-smalltalk",
      "express-like",
      "express-dislike"
    ],
    "meta": {
      "freqRank": 1
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-smalltalk-v4",
    "kind": "phrase",
    "prompt": "I think that …",
    "answer": "Мислам дека …",
    "translit": "Mislam deka …",
    "gloss": "I think that …",
    "note": "'дека' = that; introduces a clause.",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-smalltalk",
      "express-like",
      "express-dislike"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-smalltalk-v5",
    "kind": "phrase",
    "prompt": "I agree.",
    "answer": "Се согласувам.",
    "translit": "Se soglasuvam.",
    "gloss": "I agree.",
    "note": "Reflexive verb; stress on so-gla-SU-vam.",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-smalltalk",
      "express-like",
      "express-dislike"
    ],
    "meta": {
      "freqRank": 3
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-smalltalk-v6",
    "kind": "phrase",
    "prompt": "nice / awful",
    "answer": "убаво / грозно",
    "translit": "ubavo / grozno",
    "gloss": "nice / awful",
    "note": "Neuter adverb/adjective forms.",
    "i1Level": 2,
    "tags": [
      "generated",
      "s2-smalltalk",
      "express-like",
      "express-dislike"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-smalltalk-v7",
    "kind": "vocab",
    "prompt": "the weather",
    "answer": "времето",
    "translit": "vremeto",
    "gloss": "the weather",
    "note": "'време' + definite article -то.",
    "i1Level": 2,
    "tags": [
      "generated",
      "s2-smalltalk",
      "express-like",
      "express-dislike"
    ],
    "meta": {
      "freqRank": 2,
      "gender": "neuter"
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-smalltalk-v8",
    "kind": "vocab",
    "prompt": "today",
    "answer": "денес",
    "translit": "denes",
    "gloss": "today",
    "note": "Stress on DE-nes.",
    "i1Level": 2,
    "tags": [
      "generated",
      "s2-smalltalk",
      "express-like",
      "express-dislike"
    ],
    "meta": {
      "freqRank": 1
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-smalltalk-v9",
    "kind": "phrase",
    "prompt": "and / but / so",
    "answer": "и / ама / затоа",
    "translit": "i / ama / zatoa",
    "gloss": "and / but / so",
    "note": "'ама' is colloquial 'но'; 'затоа' = therefore.",
    "i1Level": 2,
    "tags": [
      "generated",
      "s2-smalltalk",
      "express-like",
      "express-dislike"
    ],
    "meta": {
      "freqRank": 1
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-pasttime-v1",
    "kind": "phrase",
    "prompt": "yesterday / today / tomorrow",
    "answer": "вчера / денес / утре",
    "translit": "včera / denes / utre",
    "gloss": "yesterday / today / tomorrow",
    "note": "Three time adverbs; 'včera' stress on 1st syllable.",
    "i1Level": 2,
    "tags": [
      "generated",
      "s2-pasttime",
      "narrate-past",
      "state-plans"
    ],
    "meta": {
      "freqRank": 1
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-pasttime-v2",
    "kind": "vocab",
    "prompt": "I was",
    "answer": "бев",
    "translit": "bev",
    "gloss": "I was",
    "note": "Past tense of 'sum' (to be), 1st person singular.",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-pasttime",
      "narrate-past",
      "state-plans"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-pasttime-v3",
    "kind": "vocab",
    "prompt": "I had",
    "answer": "имав",
    "translit": "imav",
    "gloss": "I had",
    "note": "Imperfect of 'ima' (to have), 1st sg.",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-pasttime",
      "narrate-past",
      "state-plans"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-pasttime-v4",
    "kind": "vocab",
    "prompt": "I went",
    "answer": "отидов",
    "translit": "otidov",
    "gloss": "I went",
    "note": "Aorist of 'odi' (to go), 1st sg; stress on 'o-ti'.",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-pasttime",
      "narrate-past",
      "state-plans"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-pasttime-v5",
    "kind": "vocab",
    "prompt": "I ate",
    "answer": "јадев",
    "translit": "jadev",
    "gloss": "I ate",
    "note": "Imperfect of 'jade' (to eat), 1st sg.",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-pasttime",
      "narrate-past",
      "state-plans"
    ],
    "meta": {
      "freqRank": 3
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-pasttime-v6",
    "kind": "phrase",
    "prompt": "will … (future particle)",
    "answer": "Ќе …",
    "translit": "Ḱe …",
    "gloss": "will … (future particle)",
    "note": "Future particle placed before the verb.",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-pasttime",
      "narrate-past",
      "state-plans"
    ],
    "meta": {
      "freqRank": 1
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-pasttime-v7",
    "kind": "phrase",
    "prompt": "See you.",
    "answer": "Ќе се видиме.",
    "translit": "Ḱe se vidime.",
    "gloss": "See you.",
    "note": "Common parting phrase; literally 'we will see each other'.",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-pasttime",
      "narrate-past",
      "state-plans"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-pasttime-v8",
    "kind": "phrase",
    "prompt": "What were you doing?",
    "answer": "Што правеше?",
    "translit": "Što praveše?",
    "gloss": "What were you doing?",
    "note": "Imperfect, 2nd sg; informal question.",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-pasttime",
      "narrate-past",
      "state-plans"
    ],
    "meta": {
      "freqRank": 3
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-home-family-v1",
    "kind": "phrase",
    "prompt": "mother / father",
    "answer": "мајка / татко",
    "translit": "majka / tatko",
    "gloss": "mother / father",
    "note": "Two nouns: majka (f), tatko (m).",
    "i1Level": 2,
    "tags": [
      "generated",
      "s2-home-family",
      "describe-family",
      "describe-home"
    ],
    "meta": {
      "freqRank": 1
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-home-family-v2",
    "kind": "phrase",
    "prompt": "brother / sister",
    "answer": "брат / сестра",
    "translit": "brat / sestra",
    "gloss": "brother / sister",
    "note": "Two nouns: brat (m), sestra (f).",
    "i1Level": 2,
    "tags": [
      "generated",
      "s2-home-family",
      "describe-family",
      "describe-home"
    ],
    "meta": {
      "freqRank": 1
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-home-family-v3",
    "kind": "phrase",
    "prompt": "wife (woman) / husband (man)",
    "answer": "жена / маж",
    "translit": "žena / maž",
    "gloss": "wife (woman) / husband (man)",
    "note": "Two nouns: žena (f), maž (m).",
    "i1Level": 2,
    "tags": [
      "generated",
      "s2-home-family",
      "describe-family",
      "describe-home"
    ],
    "meta": {
      "freqRank": 1
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-home-family-v4",
    "kind": "phrase",
    "prompt": "child / children",
    "answer": "дете / деца",
    "translit": "dete / deca",
    "gloss": "child / children",
    "note": "dete (n, singular); deca (plural).",
    "i1Level": 2,
    "tags": [
      "generated",
      "s2-home-family",
      "describe-family",
      "describe-home"
    ],
    "meta": {
      "freqRank": 1
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-home-family-v5",
    "kind": "phrase",
    "prompt": "I live in …",
    "answer": "Живеам во …",
    "translit": "Živeam vo …",
    "gloss": "I live in …",
    "note": "živeam = I live; add a place after vo.",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-home-family",
      "describe-family",
      "describe-home"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-home-family-v6",
    "kind": "phrase",
    "prompt": "I work as …",
    "answer": "Работам како …",
    "translit": "Rabotam kako …",
    "gloss": "I work as …",
    "note": "Stress on 'ra-': RA-bo-tam; add a job after kako.",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-home-family",
      "describe-family",
      "describe-home"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-home-family-v7",
    "kind": "phrase",
    "prompt": "I have a brother and a sister.",
    "answer": "Имам брат и сестра.",
    "translit": "Imam brat i sestra.",
    "gloss": "I have a brother and a sister.",
    "note": "imam = I have; i = and.",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-home-family",
      "describe-family",
      "describe-home"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-home-family-v8",
    "kind": "phrase",
    "prompt": "How old are you?",
    "answer": "На колку години си?",
    "translit": "Na kolku godini si?",
    "gloss": "How old are you?",
    "note": "Literally 'At how many years are you?'",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-home-family",
      "describe-family",
      "describe-home"
    ],
    "meta": {
      "freqRank": 3
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-home-family-v9",
    "kind": "phrase",
    "prompt": "my (m / f)",
    "answer": "мојот / мојата",
    "translit": "mojot / mojata",
    "gloss": "my (m / f)",
    "note": "Possessive 'my' with definite article: m / f.",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-home-family",
      "describe-family",
      "describe-home"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-arrange-v1",
    "kind": "phrase",
    "prompt": "Hello? (on the phone)",
    "answer": "Ало?",
    "translit": "Alo?",
    "gloss": "Hello? (on the phone)",
    "note": "Telephone greeting; stress on first syllable.",
    "i1Level": 2,
    "tags": [
      "generated",
      "s2-arrange",
      "open-a-call",
      "ask-for-someone"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-arrange-v2",
    "kind": "phrase",
    "prompt": "Is … home?",
    "answer": "Дома ли е …?",
    "translit": "Doma li e …?",
    "gloss": "Is … home?",
    "note": "'li' marks a yes/no question.",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-arrange",
      "open-a-call",
      "ask-for-someone"
    ],
    "meta": {
      "freqRank": 3
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-arrange-v3",
    "kind": "vocab",
    "prompt": "When?",
    "answer": "Кога?",
    "translit": "Koga?",
    "gloss": "When?",
    "note": "Stress on first syllable: KO-ga.",
    "i1Level": 2,
    "tags": [
      "generated",
      "s2-arrange",
      "open-a-call",
      "ask-for-someone"
    ],
    "meta": {
      "freqRank": 1
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-arrange-v4",
    "kind": "phrase",
    "prompt": "At what time?",
    "answer": "Во колку часот?",
    "translit": "Vo kolku časot?",
    "gloss": "At what time?",
    "note": "'часот' = the hour, definite form.",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-arrange",
      "open-a-call",
      "ask-for-someone"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-arrange-v5",
    "kind": "phrase",
    "prompt": "Where shall we meet?",
    "answer": "Каде да се видиме?",
    "translit": "Kade da se vidime?",
    "gloss": "Where shall we meet?",
    "note": "'да' + verb expresses suggestion.",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-arrange",
      "open-a-call",
      "ask-for-someone"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-arrange-v6",
    "kind": "phrase",
    "prompt": "Let's …",
    "answer": "Ајде да …",
    "translit": "Ajde da …",
    "gloss": "Let's …",
    "note": "Common encouraging phrase; 'ajde' = come on.",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-arrange",
      "open-a-call",
      "ask-for-someone"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-arrange-v7",
    "kind": "phrase",
    "prompt": "Deal. / Agreed.",
    "answer": "Важи. / Договорено.",
    "translit": "Važi. / Dogovoreno.",
    "gloss": "Deal. / Agreed.",
    "note": "'Договорено' stressed do-go-VO-re-no (antepenult).",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-arrange",
      "open-a-call",
      "ask-for-someone"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-arrange-v8",
    "kind": "phrase",
    "prompt": "Leave a message.",
    "answer": "Оставете порака.",
    "translit": "Ostavete poraka.",
    "gloss": "Leave a message.",
    "note": "Polite plural imperative; 'порака' = message (fem.).",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-arrange",
      "open-a-call",
      "ask-for-someone"
    ],
    "meta": {
      "freqRank": 3
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-problems-v1",
    "kind": "phrase",
    "prompt": "There's a problem.",
    "answer": "Има проблем.",
    "translit": "Ima problem.",
    "gloss": "There's a problem.",
    "note": "'There is a problem.' problem is masculine",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-problems",
      "report-a-problem",
      "complain-politely"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-problems-v2",
    "kind": "phrase",
    "prompt": "It doesn't work.",
    "answer": "Не работи.",
    "translit": "Ne raboti.",
    "gloss": "It doesn't work.",
    "note": "Lit. 'It doesn't work/function.'",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-problems",
      "report-a-problem",
      "complain-politely"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-problems-v3",
    "kind": "phrase",
    "prompt": "This isn't …",
    "answer": "Ова не е …",
    "translit": "Ova ne e …",
    "gloss": "This isn't …",
    "note": "ova = 'this'; ne e = 'is not'",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-problems",
      "report-a-problem",
      "complain-politely"
    ],
    "meta": {
      "freqRank": 3
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-problems-v4",
    "kind": "phrase",
    "prompt": "Can you help?",
    "answer": "Можете ли да помогнете?",
    "translit": "Možete li da pomognete?",
    "gloss": "Can you help?",
    "note": "Polite/plural form; li marks the question",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-problems",
      "report-a-problem",
      "complain-politely"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-problems-v5",
    "kind": "vocab",
    "prompt": "wrong",
    "answer": "погрешно",
    "translit": "pogrešno",
    "gloss": "wrong",
    "note": "Adverb/neuter adj.; stress po-GREŠ-no",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-problems",
      "report-a-problem",
      "complain-politely"
    ],
    "meta": {
      "freqRank": 3
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-problems-v6",
    "kind": "phrase",
    "prompt": "I'd like to return (this).",
    "answer": "Сакам да вратам.",
    "translit": "Sakam da vratam.",
    "gloss": "I'd like to return (this).",
    "note": "Lit. 'I want to return (it).'",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-problems",
      "report-a-problem",
      "complain-politely"
    ],
    "meta": {
      "freqRank": 3
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-problems-v7",
    "kind": "phrase",
    "prompt": "Sorry, but …",
    "answer": "Извинете, ама …",
    "translit": "Izvinete, ama …",
    "gloss": "Sorry, but …",
    "note": "Polite 'excuse me'; ama = colloquial 'but'",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-problems",
      "report-a-problem",
      "complain-politely"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s2-problems-v8",
    "kind": "phrase",
    "prompt": "I don't understand why.",
    "answer": "Не разбирам зошто.",
    "translit": "Ne razbiram zošto.",
    "gloss": "I don't understand why.",
    "note": "zošto = 'why'",
    "i1Level": 3,
    "tags": [
      "generated",
      "s2-problems",
      "report-a-problem",
      "complain-politely"
    ],
    "meta": {
      "freqRank": 3
    },
    "confidence": "validated"
  }
];

export const promotedScenarios: Scenario[] = [
  {
    "id": "gen-s2-smalltalk",
    "title": "Small talk, likes & opinions",
    "goal": "Practise these functions: express-like, express-dislike, give-opinion, agree, connect-ideas. Use the taught chunks where natural: Ми се допаѓа.; Не ми се допаѓа.; Сакам да …; Мислам дека …; Се согласувам.; убаво / грозно. Recycle earlier material: s1-greet-intro, s1-cafe-order, s0-repair.",
    "setting": "lingering conversation after the basics are done",
    "requiredVocab": [
      "gen-s2-smalltalk-v1",
      "gen-s2-smalltalk-v2",
      "gen-s2-smalltalk-v3",
      "gen-s2-smalltalk-v4",
      "gen-s2-smalltalk-v5",
      "gen-s2-smalltalk-v6"
    ],
    "requiredStructures": [],
    "script": [
      {
        "speaker": "partner",
        "text": "Ти се допаѓа ли кафето овде?",
        "gloss": "Do you like the coffee here?"
      },
      {
        "speaker": "learner",
        "text": "Да, многу ми се допаѓа. Убаво е.",
        "gloss": "Yes, I like it a lot. It's nice.",
        "translit": "Da, mnogu mi se dopagja. Ubavo e.",
        "satisfies": [
          "expressed-like"
        ]
      },
      {
        "speaker": "partner",
        "text": "А музиката? Ти се допаѓа?",
        "gloss": "And the music? Do you like it?"
      },
      {
        "speaker": "learner",
        "text": "Не, не ми се допаѓа. Мислам дека е грозна.",
        "gloss": "No, I don't like it. I think it's awful.",
        "translit": "Ne, ne mi se dopagja. Mislam deka e grozna.",
        "satisfies": [
          "expressed-dislike",
          "gave-opinion"
        ]
      },
      {
        "speaker": "partner",
        "text": "Да, премногу е гласна.",
        "gloss": "Yes, it's too loud."
      },
      {
        "speaker": "learner",
        "text": "Се согласувам. Затоа сакам да одиме на друго место.",
        "gloss": "I agree. So I want us to go somewhere else.",
        "translit": "Se soglasuvam. Zatoa sakam da odime na drugo mesto.",
        "satisfies": [
          "agreed"
        ]
      },
      {
        "speaker": "partner",
        "text": "Добра идеја! Ајде.",
        "gloss": "Good idea! Let's go."
      }
    ],
    "successCriteria": [
      {
        "id": "expressed-like",
        "description": "Said they like something"
      },
      {
        "id": "expressed-dislike",
        "description": "Said they don't like something"
      },
      {
        "id": "gave-opinion",
        "description": "Gave an opinion using 'I think that...'"
      },
      {
        "id": "agreed",
        "description": "Agreed and connected ideas"
      }
    ],
    "confidence": "validated"
  },
  {
    "id": "gen-s2-pasttime",
    "title": "Your day: past & future",
    "goal": "Practise these functions: narrate-past, state-plans, ask-what-happened. Use the taught chunks where natural: вчера / денес / утре; бев; имав; отидов; јадев; Ќе …. Recycle earlier material: s1-greet-intro, s2-smalltalk, s1-cafe-order.",
    "setting": "talking about your day and your plans",
    "requiredVocab": [
      "gen-s2-pasttime-v1",
      "gen-s2-pasttime-v2",
      "gen-s2-pasttime-v3",
      "gen-s2-pasttime-v4",
      "gen-s2-pasttime-v5",
      "gen-s2-pasttime-v6"
    ],
    "requiredStructures": [],
    "script": [
      {
        "speaker": "partner",
        "text": "Здраво! Како си денес?",
        "gloss": "Hi! How are you today?"
      },
      {
        "speaker": "learner",
        "text": "Здраво! Добро сум. Вчера бев на работа.",
        "gloss": "Hi! I'm good. Yesterday I was at work.",
        "translit": "Zdravo! Dobro sum. Vchera bev na rabota.",
        "satisfies": [
          "greeted",
          "narrate-past"
        ]
      },
      {
        "speaker": "partner",
        "text": "А што правеше попладне?",
        "gloss": "And what did you do in the afternoon?"
      },
      {
        "speaker": "learner",
        "text": "Отидов во кафуле и јадев сендвич.",
        "gloss": "I went to a café and ate a sandwich.",
        "translit": "Otidov vo kafe i jadev sendvich.",
        "satisfies": [
          "narrate-past"
        ]
      },
      {
        "speaker": "partner",
        "text": "Убаво! А ти, што се случи со тебе вчера?",
        "gloss": "Nice! And you, what happened with you yesterday?"
      },
      {
        "speaker": "learner",
        "text": "А ти, што правеше вчера?",
        "gloss": "And you, what did you do yesterday?",
        "translit": "A ti, shto praveshe vchera?",
        "satisfies": [
          "ask-what-happened"
        ]
      },
      {
        "speaker": "partner",
        "text": "Имав многу работа. А утре?",
        "gloss": "I had a lot of work. And tomorrow?"
      },
      {
        "speaker": "learner",
        "text": "Утре ќе одам на кафе со пријател.",
        "gloss": "Tomorrow I will go for coffee with a friend.",
        "translit": "Utre kje odam na kafe so prijatel.",
        "satisfies": [
          "state-plans"
        ]
      }
    ],
    "successCriteria": [
      {
        "id": "greeted",
        "description": "Greeted and said how you are"
      },
      {
        "id": "narrate-past",
        "description": "Said what you did yesterday using past tense"
      },
      {
        "id": "ask-what-happened",
        "description": "Asked the partner what they did"
      },
      {
        "id": "state-plans",
        "description": "Stated a plan for tomorrow using Ќе"
      }
    ],
    "confidence": "validated"
  },
  {
    "id": "gen-s2-home-family",
    "title": "Home, family & work",
    "goal": "Practise these functions: describe-family, describe-home, describe-work, state-age. Use the taught chunks where natural: мајка / татко; брат / сестра; жена / маж; дете / деца; Живеам во …; Работам како …. Recycle earlier material: s1-greet-intro, s0-survive, s2-smalltalk.",
    "setting": "telling someone about your life",
    "requiredVocab": [
      "gen-s2-home-family-v1",
      "gen-s2-home-family-v2",
      "gen-s2-home-family-v3",
      "gen-s2-home-family-v4",
      "gen-s2-home-family-v5",
      "gen-s2-home-family-v6"
    ],
    "requiredStructures": [],
    "script": [
      {
        "speaker": "partner",
        "text": "Здраво! Кажи ми нешто за тебе.",
        "gloss": "Hi! Tell me something about yourself."
      },
      {
        "speaker": "learner",
        "text": "Здраво! Имам триесет години.",
        "gloss": "Hi! I am thirty years old.",
        "translit": "Zdravo! Imam trieset godini.",
        "satisfies": [
          "state-age"
        ]
      },
      {
        "speaker": "partner",
        "text": "Убаво! Каде живееш?",
        "gloss": "Nice! Where do you live?"
      },
      {
        "speaker": "learner",
        "text": "Живеам во Скопје, во голем стан.",
        "gloss": "I live in Skopje, in a big apartment.",
        "translit": "Zhiveam vo Skopje, vo golem stan.",
        "satisfies": [
          "describe-home"
        ]
      },
      {
        "speaker": "partner",
        "text": "А имаш ли семејство?",
        "gloss": "And do you have a family?"
      },
      {
        "speaker": "learner",
        "text": "Да, имам жена и едно дете.",
        "gloss": "Yes, I have a wife and one child.",
        "translit": "Da, imam zhena i edno dete.",
        "satisfies": [
          "describe-family"
        ]
      },
      {
        "speaker": "partner",
        "text": "Супер! А каде работиш?",
        "gloss": "Great! And where do you work?"
      },
      {
        "speaker": "learner",
        "text": "Работам како наставник.",
        "gloss": "I work as a teacher.",
        "translit": "Rabotam kako nastavnik.",
        "satisfies": [
          "describe-work"
        ]
      }
    ],
    "successCriteria": [
      {
        "id": "state-age",
        "description": "Stated your age"
      },
      {
        "id": "describe-home",
        "description": "Said where you live"
      },
      {
        "id": "describe-family",
        "description": "Described your family"
      },
      {
        "id": "describe-work",
        "description": "Said what work you do"
      }
    ],
    "confidence": "validated"
  },
  {
    "id": "gen-s2-arrange",
    "title": "Phone & arranging to meet",
    "goal": "Practise these functions: open-a-call, ask-for-someone, propose-time, propose-place, confirm. Use the taught chunks where natural: Ало?; Дома ли е …?; Кога?; Во колку часот?; Каде да се видиме?; Ајде да …. Recycle earlier material: s0-survive, s1-directions, s2-pasttime.",
    "setting": "a short phone call to make a plan",
    "requiredVocab": [
      "gen-s2-arrange-v1",
      "gen-s2-arrange-v2",
      "gen-s2-arrange-v3",
      "gen-s2-arrange-v4",
      "gen-s2-arrange-v5",
      "gen-s2-arrange-v6"
    ],
    "requiredStructures": [],
    "script": [
      {
        "speaker": "partner",
        "text": "Ало?",
        "gloss": "Hello?"
      },
      {
        "speaker": "learner",
        "text": "Ало, здраво! Дома ли е Ана?",
        "gloss": "Hello, hi! Is Ana home?",
        "translit": "Alo, zdravo! Doma li e Ana?",
        "satisfies": [
          "opened",
          "asked-for"
        ]
      },
      {
        "speaker": "partner",
        "text": "Да, јас сум. Што има?",
        "gloss": "Yes, it's me. What's up?"
      },
      {
        "speaker": "learner",
        "text": "Ајде да се видиме денес. Во колку часот?",
        "gloss": "Let's meet today. At what time?",
        "translit": "Ajde da se vidime denes. Vo kolku chasot?",
        "satisfies": [
          "proposed-time"
        ]
      },
      {
        "speaker": "partner",
        "text": "Може во седум. Каде да се видиме?",
        "gloss": "How about at seven. Where shall we meet?"
      },
      {
        "speaker": "learner",
        "text": "Ајде во кафулето на плоштадот.",
        "gloss": "Let's meet at the cafe on the square.",
        "translit": "Ajde vo kafeto na ploshtadot.",
        "satisfies": [
          "proposed-place"
        ]
      },
      {
        "speaker": "partner",
        "text": "Добро, важи! Се гледаме таму.",
        "gloss": "Okay, deal! See you there."
      },
      {
        "speaker": "learner",
        "text": "Во ред, во седум. Чао!",
        "gloss": "Alright, at seven. Bye!",
        "translit": "Vo red, vo sedum. Chao!",
        "satisfies": [
          "confirmed"
        ]
      }
    ],
    "successCriteria": [
      {
        "id": "opened",
        "description": "Opened the phone call"
      },
      {
        "id": "asked-for",
        "description": "Asked for the person they wanted to speak to"
      },
      {
        "id": "proposed-time",
        "description": "Proposed or asked about a time to meet"
      },
      {
        "id": "proposed-place",
        "description": "Proposed a place to meet"
      },
      {
        "id": "confirmed",
        "description": "Confirmed the plan"
      }
    ],
    "confidence": "validated"
  },
  {
    "id": "gen-s2-problems",
    "title": "Problems & complaints (repair kit, leveled up)",
    "goal": "Practise these functions: report-a-problem, complain-politely, ask-for-help, resolve. Use the taught chunks where natural: Има проблем.; Не работи.; Ова не е …; Можете ли да помогнете?; погрешно; Сакам да вратам.. Recycle earlier material: s0-repair, s1-market, s2-smalltalk.",
    "setting": "something went wrong (a shop, a café, a booking)",
    "requiredVocab": [
      "gen-s2-problems-v1",
      "gen-s2-problems-v2",
      "gen-s2-problems-v3",
      "gen-s2-problems-v4",
      "gen-s2-problems-v5",
      "gen-s2-problems-v6"
    ],
    "requiredStructures": [],
    "script": [
      {
        "speaker": "partner",
        "text": "Добар ден! Како можам да помогнам?",
        "gloss": "Good day! How can I help?"
      },
      {
        "speaker": "learner",
        "text": "Добар ден! Има проблем. Кафето не е топло.",
        "gloss": "Good day! There is a problem. The coffee is not hot.",
        "translit": "Dobar den! Ima problem. Kafeto ne e toplo.",
        "satisfies": [
          "reported"
        ]
      },
      {
        "speaker": "partner",
        "text": "О, извинете! Што не е во ред?",
        "gloss": "Oh, sorry! What is wrong?"
      },
      {
        "speaker": "learner",
        "text": "Ова не е тоа што нарачав. Сметката е погрешна.",
        "gloss": "This is not what I ordered. The bill is wrong.",
        "translit": "Ova ne e toa shto narachav. Smetkata e pogreshna.",
        "satisfies": [
          "complained"
        ]
      },
      {
        "speaker": "partner",
        "text": "Имате право. Многу се извинувам.",
        "gloss": "You are right. I am very sorry."
      },
      {
        "speaker": "learner",
        "text": "Може ли да помогнете? Сакам да вратам кафето.",
        "gloss": "Can you help? I want to return the coffee.",
        "translit": "Mozhe li da pomognete? Sakam da vratam kafeto.",
        "satisfies": [
          "asked-help",
          "resolve"
        ]
      },
      {
        "speaker": "partner",
        "text": "Секако. Носам ново кафе веднаш.",
        "gloss": "Of course. I'll bring a new coffee right away."
      },
      {
        "speaker": "learner",
        "text": "Благодарам многу! Сега е во ред.",
        "gloss": "Thank you very much! Now it's fine.",
        "translit": "Blagodaram mnogu! Sega e vo red.",
        "satisfies": [
          "resolve"
        ]
      }
    ],
    "successCriteria": [
      {
        "id": "reported",
        "description": "Reported a problem"
      },
      {
        "id": "complained",
        "description": "Complained politely about a mistake"
      },
      {
        "id": "asked-help",
        "description": "Asked for help"
      },
      {
        "id": "resolve",
        "description": "Worked toward a resolution (return/fix)"
      }
    ],
    "confidence": "validated"
  }
];

export const promotedStories: MiniStory[] = [
  {
    "id": "gen-s2-smalltalk-story",
    "title": "Времето денес",
    "titleGloss": "The weather today",
    "i1Level": 2,
    "level": "A2",
    "theme": "Small talk, likes & opinions",
    "audioSource": "tts",
    "body": [
      {
        "text": "Ова е Марко.",
        "translit": "Ova e Marko.",
        "gloss": "This is Marko."
      },
      {
        "text": "Денес времето е убаво.",
        "translit": "Denes vremeto e ubavo.",
        "gloss": "Today the weather is nice."
      },
      {
        "text": "„Ми се допаѓа“, вели Марко.",
        "translit": "„Mi se dopaǵa“, veli Marko.",
        "gloss": "\"I like it,\" says Marko."
      },
      {
        "text": "Ана вели: „Се согласувам.“",
        "translit": "Ana veli: „Se soglasuvam.“",
        "gloss": "Ana says: \"I agree.\""
      },
      {
        "text": "„Мислам дека денес е убав ден“, вели Ана.",
        "translit": "„Mislam deka denes e ubav den“, veli Ana.",
        "gloss": "\"I think that today is a nice day,\" says Ana."
      },
      {
        "text": "„Сакам да одам надвор“, вели Марко.",
        "translit": "„Sakam da odam nadvor“, veli Marko.",
        "gloss": "\"I want to go outside,\" says Marko."
      },
      {
        "text": "Ама Ана не сака дожд.",
        "translit": "Ama Ana ne saka dožd.",
        "gloss": "But Ana doesn't like rain."
      },
      {
        "text": "„Дождот е грозен, не ми се допаѓа“, вели Ана.",
        "translit": "„Doždot e grozen, ne mi se dopaǵa“, veli Ana.",
        "gloss": "\"The rain is awful, I don't like it,\" says Ana."
      },
      {
        "text": "Затоа денес тие одат надвор заедно.",
        "translit": "Zatoa denes tie odat nadvor zaedno.",
        "gloss": "So today they go outside together."
      }
    ],
    "qa": [
      {
        "id": "q1",
        "question": "Какво е времето денес?",
        "questionGloss": "What is the weather like today?",
        "answer": "Убаво е.",
        "answerGloss": "It is nice.",
        "answerTranslit": "Ubavo e."
      },
      {
        "id": "q2",
        "question": "Дали на Ана ѝ се допаѓа дождот?",
        "questionGloss": "Does Ana like the rain?",
        "answer": "Не, не ѝ се допаѓа.",
        "answerGloss": "No, she doesn't like it.",
        "answerTranslit": "Ne, ne ì se dopaǵa."
      },
      {
        "id": "q3",
        "question": "Кажи дека се согласуваш со Марко.",
        "questionGloss": "Say that you agree with Marko.",
        "answer": "Се согласувам.",
        "answerGloss": "I agree.",
        "answerTranslit": "Se soglasuvam.",
        "spokenPrompt": true
      }
    ],
    "registersVocab": [
      {
        "lexKey": "ми се допаѓа",
        "gloss": "I like it."
      },
      {
        "lexKey": "не ми се допаѓа",
        "gloss": "I don't like it."
      },
      {
        "lexKey": "се согласувам",
        "gloss": "I agree."
      },
      {
        "lexKey": "времето",
        "gloss": "the weather"
      },
      {
        "lexKey": "денес",
        "gloss": "today"
      }
    ],
    "confidence": "validated"
  },
  {
    "id": "gen-s2-pasttime-story",
    "title": "Денот на Марко",
    "titleGloss": "Marko's day",
    "i1Level": 2,
    "level": "A2",
    "theme": "Your day: past & future",
    "audioSource": "tts",
    "body": [
      {
        "text": "Вчера Марко беше дома.",
        "translit": "Vchera Marko beshe doma.",
        "gloss": "Yesterday Marko was at home."
      },
      {
        "text": "Тој имаше многу работа.",
        "translit": "Toj imav mnogu rabota.",
        "gloss": "He had a lot of work."
      },
      {
        "text": "Денес Марко отиде во паркот.",
        "translit": "Denes Marko otidov vo park.",
        "gloss": "Today Marko went to the park."
      },
      {
        "text": "Таму јадеше сендвич.",
        "translit": "Tamu jadev sendvich.",
        "gloss": "There he ate a sandwich."
      },
      {
        "text": "Ана праша: „Што правеше?“",
        "translit": "Ana prasha: „Shto praveshe?“",
        "gloss": "Ana asked: \"What were you doing?\""
      },
      {
        "text": "„Бев во паркот и читав книга“, вели Марко.",
        "translit": "„Bev vo park i chitav kniga“, veli Marko.",
        "gloss": "\"I was in the park and read a book,\" says Marko."
      },
      {
        "text": "Утре Марко ќе работи дома.",
        "translit": "Utre Marko kje raboti doma.",
        "gloss": "Tomorrow Marko will work at home."
      },
      {
        "text": "„Ќе се видиме!“, вели Ана.",
        "translit": "„Kje se vidime!“, veli Ana.",
        "gloss": "\"See you!\" says Ana."
      }
    ],
    "qa": [
      {
        "id": "q1",
        "question": "Каде отиде Марко денес?",
        "questionGloss": "Where did Marko go today?",
        "answer": "Во парк.",
        "answerGloss": "To the park.",
        "answerTranslit": "Vo park."
      },
      {
        "id": "q2",
        "question": "Што јадеше Марко во парк?",
        "questionGloss": "What did Marko eat in the park?",
        "answer": "Сендвич.",
        "answerGloss": "A sandwich.",
        "answerTranslit": "Sendvich."
      },
      {
        "id": "q3",
        "question": "Кажи му на пријател дека ќе се видите.",
        "questionGloss": "Tell a friend that you will see each other.",
        "answer": "Ќе се видиме.",
        "answerGloss": "See you.",
        "answerTranslit": "Kje se vidime.",
        "spokenPrompt": true
      }
    ],
    "registersVocab": [
      {
        "lexKey": "бев",
        "gloss": "I was"
      },
      {
        "lexKey": "имав",
        "gloss": "I had"
      },
      {
        "lexKey": "отидов",
        "gloss": "I went"
      },
      {
        "lexKey": "јадев",
        "gloss": "I ate"
      },
      {
        "lexKey": "ќе се видиме",
        "gloss": "See you."
      },
      {
        "lexKey": "што правеше",
        "gloss": "What were you doing?"
      }
    ],
    "confidence": "validated"
  },
  {
    "id": "gen-s2-home-family-story",
    "title": "Мојот живот",
    "titleGloss": "My life",
    "i1Level": 2,
    "level": "A2",
    "theme": "Home, family & work",
    "audioSource": "tts",
    "body": [
      {
        "text": "Јас сум Ана.",
        "translit": "Jas sum Ana.",
        "gloss": "I am Ana."
      },
      {
        "text": "Живеам во Скопје.",
        "translit": "Živeam vo Skopje.",
        "gloss": "I live in Skopje."
      },
      {
        "text": "Имам брат и сестра.",
        "translit": "Imam brat i sestra.",
        "gloss": "I have a brother and a sister."
      },
      {
        "text": "Мојата мајка работи како доктор.",
        "translit": "Mojata majka raboti kako doktor.",
        "gloss": "My mother works as a doctor."
      },
      {
        "text": "Мојот татко е добар маж.",
        "translit": "Mojot tatko e dobar maž.",
        "gloss": "My father is a good husband."
      },
      {
        "text": "Јас работам како учителка.",
        "translit": "Jas rabotam kako učitelka.",
        "gloss": "I work as a teacher."
      },
      {
        "text": "Имам едно дете.",
        "translit": "Imam edno dete.",
        "gloss": "I have one child."
      },
      {
        "text": "Мојата сестра прашува: „На колку години си?“",
        "translit": "Mojata sestra prašuva: „Na kolku godini si?“",
        "gloss": "My sister asks: \"How old are you?\""
      },
      {
        "text": "Јас имам триесет години.",
        "translit": "Jas imam trieset godini.",
        "gloss": "I am thirty years old."
      }
    ],
    "qa": [
      {
        "id": "q1",
        "question": "Каде живее Ана?",
        "questionGloss": "Where does Ana live?",
        "answer": "Во Скопје.",
        "answerGloss": "In Skopje.",
        "answerTranslit": "Vo Skopje."
      },
      {
        "id": "q2",
        "question": "Како работи мајката на Ана?",
        "questionGloss": "What does Ana's mother work as?",
        "answer": "Како доктор.",
        "answerGloss": "As a doctor.",
        "answerTranslit": "Kako doktor."
      },
      {
        "id": "q3",
        "question": "Кажи на глас: прашај некого за неговите години.",
        "questionGloss": "Say it aloud: ask someone about their age.",
        "answer": "На колку години си?",
        "answerGloss": "How old are you?",
        "answerTranslit": "Na kolku godini si?",
        "spokenPrompt": true
      }
    ],
    "registersVocab": [
      {
        "lexKey": "имам брат и сестра",
        "gloss": "I have a brother and a sister."
      },
      {
        "lexKey": "на колку години си",
        "gloss": "How old are you?"
      }
    ],
    "confidence": "validated"
  },
  {
    "id": "gen-s2-arrange-story",
    "title": "Телефонски повик",
    "titleGloss": "A phone call",
    "i1Level": 2,
    "level": "A2",
    "theme": "Phone & arranging to meet",
    "audioSource": "tts",
    "body": [
      {
        "text": "Марко ѝ телефонира на Ана.",
        "translit": "Marko telefonira na Ana.",
        "gloss": "Marko phones Ana."
      },
      {
        "text": "Ало? Дома ли е Ана?",
        "translit": "Alo? Doma li e Ana?",
        "gloss": "Hello? Is Ana home?"
      },
      {
        "text": "Да, јас сум. Здраво, Марко!",
        "translit": "Da, jas sum. Zdravo, Marko!",
        "gloss": "Yes, it's me. Hi, Marko!"
      },
      {
        "text": "Ајде да се видиме денес.",
        "translit": "Ajde da se vidime denes.",
        "gloss": "Let's meet today."
      },
      {
        "text": "Кога? Во колку часот?",
        "translit": "Koga? Vo kolku časot?",
        "gloss": "When? At what time?"
      },
      {
        "text": "Во шест часот. Каде да се видиме?",
        "translit": "Vo šest časot. Kade da se vidime?",
        "gloss": "At six o'clock. Where shall we meet?"
      },
      {
        "text": "Ајде во кафулето кај плоштадот.",
        "translit": "Ajde vo kafuleto kaj ploštadot.",
        "gloss": "Let's go to the café by the square."
      },
      {
        "text": "Важи! Договорено.",
        "translit": "Važi! Dogovoreno.",
        "gloss": "Deal! Agreed."
      }
    ],
    "qa": [
      {
        "id": "q1",
        "question": "Во колку часот се гледаат Марко и Ана?",
        "questionGloss": "At what time do Marko and Ana meet?",
        "answer": "Во шест часот.",
        "answerGloss": "At six o'clock.",
        "answerTranslit": "Vo šest časot."
      },
      {
        "id": "q2",
        "question": "Каде се гледаат?",
        "questionGloss": "Where do they meet?",
        "answer": "Во кафулето кај плоштадот.",
        "answerGloss": "At the café by the square.",
        "answerTranslit": "Vo kafuleto kaj ploštadot."
      },
      {
        "id": "q3",
        "question": "Кажи го гласно: како ќе се согласиш на крајот од разговорот?",
        "questionGloss": "Say it aloud: how do you agree at the end of the conversation?",
        "answer": "Важи. Договорено.",
        "answerGloss": "Deal. Agreed.",
        "answerTranslit": "Važi. Dogovoreno.",
        "spokenPrompt": true
      }
    ],
    "registersVocab": [
      {
        "lexKey": "ало",
        "gloss": "Hello? (on the phone)"
      },
      {
        "lexKey": "кога",
        "gloss": "When?"
      },
      {
        "lexKey": "во колку часот",
        "gloss": "At what time?"
      },
      {
        "lexKey": "каде да се видиме",
        "gloss": "Where shall we meet?"
      },
      {
        "lexKey": "оставете порака",
        "gloss": "Leave a message."
      }
    ],
    "confidence": "validated"
  },
  {
    "id": "gen-s2-problems-story",
    "title": "Кафето не е тоа",
    "titleGloss": "The coffee isn't that",
    "i1Level": 3,
    "level": "A2",
    "theme": "Problems & complaints (repair kit, leveled up)",
    "audioSource": "tts",
    "body": [
      {
        "text": "Марко е во едно кафуле.",
        "translit": "Marko e vo edno kafule.",
        "gloss": "Marko is in a café."
      },
      {
        "text": "Извинете, ама има проблем.",
        "translit": "Izvinete, ama ima problem.",
        "gloss": "Sorry, but there's a problem."
      },
      {
        "text": "Ова не е моето кафе.",
        "translit": "Ova ne e moeto kafe.",
        "gloss": "This isn't my coffee."
      },
      {
        "text": "Сметката е погрешна.",
        "translit": "Smetkata e pogreshna.",
        "gloss": "The bill is wrong."
      },
      {
        "text": "Не разбирам зошто.",
        "translit": "Ne razbiram zoshto.",
        "gloss": "I don't understand why."
      },
      {
        "text": "Можете ли да помогнете?",
        "translit": "Mozhete li da pomognete?",
        "gloss": "Can you help?"
      },
      {
        "text": "Сакам да вратам ова кафе.",
        "translit": "Sakam da vratam ova kafe.",
        "gloss": "I'd like to return this coffee."
      },
      {
        "text": "Жената вели: \"Се извинувам, веднаш!\"",
        "translit": "Zhenata veli: \"Se izvinuvam, vednash!\"",
        "gloss": "The woman says: \"I'm sorry, right away!\""
      }
    ],
    "qa": [
      {
        "id": "q1",
        "question": "Каде е Марко?",
        "questionGloss": "Where is Marko?",
        "answer": "Во кафуле.",
        "answerGloss": "In a café.",
        "answerTranslit": "Vo kafule."
      },
      {
        "id": "q2",
        "question": "Каква е сметката?",
        "questionGloss": "What is the bill like?",
        "answer": "Погрешна.",
        "answerGloss": "Wrong.",
        "answerTranslit": "Pogreshna."
      },
      {
        "id": "q3",
        "question": "Кажи дека сакаш да го вратиш кафето.",
        "questionGloss": "Say that you'd like to return the coffee.",
        "answer": "Сакам да вратам.",
        "answerGloss": "I'd like to return (this).",
        "answerTranslit": "Sakam da vratam.",
        "spokenPrompt": true
      }
    ],
    "registersVocab": [
      {
        "lexKey": "има проблем",
        "gloss": "There's a problem."
      },
      {
        "lexKey": "не работи",
        "gloss": "It doesn't work."
      },
      {
        "lexKey": "можете ли да помогнете",
        "gloss": "Can you help?"
      },
      {
        "lexKey": "погрешно",
        "gloss": "wrong"
      },
      {
        "lexKey": "сакам да вратам",
        "gloss": "I'd like to return (this)."
      },
      {
        "lexKey": "не разбирам зошто",
        "gloss": "I don't understand why."
      }
    ],
    "confidence": "validated"
  }
];

export const promotedWritingTasks: WritingTask[] = [
  {
    "id": "gen-s2-smalltalk-w1",
    "prompt": "Tell someone what you like to do, for example say that you like to read or to walk. Use a sentence with 'I like to...'",
    "targetConcepts": [
      "da-construction",
      "clitics"
    ],
    "i1Level": 3,
    "confidence": "validated"
  },
  {
    "id": "gen-s2-smalltalk-w2",
    "prompt": "Say what you don't like, for example that you don't like coffee or cold weather. Give your opinion in one short sentence.",
    "targetConcepts": [
      "clitics"
    ],
    "i1Level": 3,
    "confidence": "validated"
  },
  {
    "id": "gen-s2-smalltalk-w3",
    "prompt": "Agree with the other person and add one connected idea, for example: 'Yes, and I think it is nice.'",
    "targetConcepts": [
      "connect-ideas",
      "da-construction"
    ],
    "i1Level": 3,
    "confidence": "validated"
  },
  {
    "id": "gen-s2-pasttime-w1",
    "prompt": "Write two sentences in Macedonian saying what you did yesterday. For example, mention that you worked and ate lunch.",
    "targetConcepts": [
      "past-tense"
    ],
    "i1Level": 3,
    "confidence": "validated"
  },
  {
    "id": "gen-s2-pasttime-w2",
    "prompt": "Write two sentences in Macedonian about your plans for tomorrow, saying what you will do.",
    "targetConcepts": [
      "future-kje"
    ],
    "i1Level": 3,
    "confidence": "validated"
  },
  {
    "id": "gen-s2-pasttime-w3",
    "prompt": "Write a short message in Macedonian asking a friend what they did today and what they will do tonight.",
    "targetConcepts": [
      "past-tense",
      "future-kje"
    ],
    "i1Level": 3,
    "confidence": "validated"
  },
  {
    "id": "gen-s2-home-family-w1",
    "prompt": "Write 2-3 sentences introducing your family members (for example your mother, father, sister or brother). Use 'my' to show they belong to you.",
    "targetConcepts": [
      "possessive"
    ],
    "i1Level": 3,
    "confidence": "validated"
  },
  {
    "id": "gen-s2-home-family-w2",
    "prompt": "Describe where you live. Write 1-2 sentences about your home or apartment and say it is yours.",
    "targetConcepts": [
      "possessive"
    ],
    "i1Level": 3,
    "confidence": "validated"
  },
  {
    "id": "gen-s2-home-family-w3",
    "prompt": "Write a short sentence saying how old you are and what your job is.",
    "i1Level": 3,
    "confidence": "validated"
  }
];

export const promotedInfoGapTasks: InfoGapTask[] = [
  {
    "id": "gen-s2-arrange-gap",
    "title": "A call to make a plan (info-gap)",
    "goal": "Arrange to meet — agree a time and a place. Each of you knows only half.",
    "setting": "A short phone call between two friends to plan a meeting.",
    "roleA": {
      "role": "A",
      "brief": "You're calling your friend. Open the call, propose a time, and ask where to meet.",
      "secretInfo": [
        "You are free in the evening — you want to meet at 7 o'clock.",
        "You want to suggest meeting tomorrow, not today.",
        "You don't know a good place yet — ask your friend."
      ],
      "targetPhrases": [
        {
          "text": "Ало? Дома ли е Марко?",
          "gloss": "Hello? Is Marko home?",
          "translit": "Alo? Doma li e Marko?"
        },
        {
          "text": "Ајде да се видиме утре во седум часот.",
          "gloss": "Let's meet tomorrow at seven o'clock.",
          "translit": "Ajde da se vidime utre vo sedum chasot."
        },
        {
          "text": "Каде да се видиме?",
          "gloss": "Where shall we meet?",
          "translit": "Kade da se vidime?"
        }
      ]
    },
    "roleB": {
      "role": "B",
      "brief": "You answer the phone. Say who you are, agree on the time, and propose a place.",
      "secretInfo": [
        "You want to meet at the café near the square.",
        "Seven o'clock is fine for you — you are also free in the evening.",
        "The café is on the right, next to the bank."
      ],
      "targetPhrases": [
        {
          "text": "Ало, јас сум Марко!",
          "gloss": "Hello, it's me, Marko!",
          "translit": "Alo, jas sum Marko!"
        },
        {
          "text": "Во седум часот е добро. Кога? Утре?",
          "gloss": "Seven o'clock is good. When? Tomorrow?",
          "translit": "Vo sedum chasot e dobro. Koga? Utre?"
        },
        {
          "text": "Ајде да се видиме во кафулето кај плоштадот.",
          "gloss": "Let's meet at the café by the square.",
          "translit": "Ajde da se vidime vo kafuleto kaj ploshtadot."
        },
        {
          "text": "Тоа е надесно, до банката.",
          "gloss": "It's on the right, next to the bank.",
          "translit": "Toa e desno, do bankata."
        }
      ]
    },
    "successCriteria": [
      {
        "id": "open",
        "description": "Caller opened the call and asked for the friend by name."
      },
      {
        "id": "time",
        "description": "You agreed a time — seven o'clock tomorrow."
      },
      {
        "id": "place",
        "description": "You agreed a place — the café by the square."
      },
      {
        "id": "confirm",
        "description": "Both confirmed the plan to meet."
      }
    ],
    "confidence": "validated"
  },
  {
    "id": "gen-s2-problems-gap",
    "title": "Wrong coffee, please help (info-gap)",
    "goal": "Sort out the wrong order — the customer reports the problem, the waiter checks the bill and fixes it.",
    "setting": "A café: the customer got the wrong drink and the bill looks wrong too.",
    "roleA": {
      "role": "A",
      "brief": "You're the customer. Report the problem politely, say what you actually ordered, and ask for help to fix it.",
      "secretInfo": [
        "You ordered tea, but you got coffee.",
        "You want to return the coffee and get your tea.",
        "You think the bill is wrong — you only had one drink."
      ],
      "targetPhrases": [
        {
          "text": "Извинете, има проблем.",
          "gloss": "Excuse me, there's a problem.",
          "translit": "Izvinete, ima problem."
        },
        {
          "text": "Ова не е чај, ова е кафе.",
          "gloss": "This isn't tea, this is coffee.",
          "translit": "Ova ne e chaj, ova e kafe."
        },
        {
          "text": "Сакам да вратам кафе. Можете ли да помогнете?",
          "gloss": "I want to return the coffee. Can you help?",
          "translit": "Sakam da vratam kafe. Mozhete li da pomognete?"
        },
        {
          "text": "Мислам дека сметката е погрешна.",
          "gloss": "I think the bill is wrong.",
          "translit": "Mislam deka smetkata e pogreshna."
        }
      ]
    },
    "roleB": {
      "role": "B",
      "brief": "You're the waiter. Listen to the problem, apologise, check the bill, and fix everything.",
      "secretInfo": [
        "Tea costs 40 denars; the bill mistakenly shows two drinks (80 denars).",
        "The correct bill is one tea — 40 denars.",
        "You can bring the tea now and give a new bill."
      ],
      "targetPhrases": [
        {
          "text": "Каков е проблемот? Извинете.",
          "gloss": "What's the problem? Sorry.",
          "translit": "Shto ima problem? Izvinete."
        },
        {
          "text": "Имате право, сметката е погрешна.",
          "gloss": "You're right, the bill is wrong.",
          "translit": "Imate pravo, smetkata e pogreshna."
        },
        {
          "text": "Веднаш носам чај. Чајот е 40 денари.",
          "gloss": "I'll bring tea right away. The tea is 40 denars.",
          "translit": "Vednash nosam chaj. Chajot e 40 denari."
        },
        {
          "text": "Вкупно е 40 денари. Во ред?",
          "gloss": "The total is 40 denars. OK?",
          "translit": "Vkupno e 40 denari. Vo red?"
        }
      ]
    },
    "successCriteria": [
      {
        "id": "report",
        "description": "The customer reported the problem (got coffee instead of tea)."
      },
      {
        "id": "help",
        "description": "The customer asked to return the coffee and get help."
      },
      {
        "id": "bill",
        "description": "The waiter checked and corrected the bill to one tea — 40 denars."
      },
      {
        "id": "resolve",
        "description": "Both agreed the problem is fixed (tea coming, correct total)."
      }
    ],
    "confidence": "validated"
  }
];

