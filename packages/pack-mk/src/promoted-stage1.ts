// PROMOTED from generated-stage1.ts — spot-checked + corrected (see pipeline/output/wave-mk-stage1.md),
// confidence:"validated". This is the SERVED copy (wired into index.ts); generated-stage1.ts stays as the raw audit trail.
import type { ReviewItem, Scenario, MiniStory, GrammarConcept, Reader, WritingTask, InfoGapTask } from "@ll/pack-schema";

export const promotedVocab: ReviewItem[] = [
  {
    "id": "gen-s1-cafe-order-v1",
    "kind": "phrase",
    "prompt": "One beer, please.",
    "answer": "Едно пиво, ве молам.",
    "translit": "Edno pivo, ve molam.",
    "gloss": "One beer, please.",
    "note": "Polite request; 'ве молам' = please (formal).",
    "i1Level": 2,
    "tags": [
      "generated",
      "s1-cafe-order",
      "greet",
      "order"
    ],
    "meta": {
      "freqRank": 1
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-cafe-order-v2",
    "kind": "vocab",
    "prompt": "coffee",
    "answer": "кафе",
    "translit": "kafe",
    "gloss": "coffee",
    "note": "Stress on first syllable: KA-fe.",
    "i1Level": 1,
    "tags": [
      "generated",
      "s1-cafe-order",
      "greet",
      "order"
    ],
    "meta": {
      "freqRank": 1,
      "gender": "neuter"
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-cafe-order-v3",
    "kind": "vocab",
    "prompt": "beer",
    "answer": "пиво",
    "translit": "pivo",
    "gloss": "beer",
    "note": "Stress: PI-vo.",
    "i1Level": 1,
    "tags": [
      "generated",
      "s1-cafe-order",
      "greet",
      "order"
    ],
    "meta": {
      "freqRank": 1,
      "gender": "neuter"
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-cafe-order-v4",
    "kind": "vocab",
    "prompt": "water",
    "answer": "вода",
    "translit": "voda",
    "gloss": "water",
    "note": "Stress: VO-da.",
    "i1Level": 1,
    "tags": [
      "generated",
      "s1-cafe-order",
      "greet",
      "order"
    ],
    "meta": {
      "freqRank": 1,
      "gender": "feminine"
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-cafe-order-v5",
    "kind": "vocab",
    "prompt": "tea",
    "answer": "чај",
    "translit": "čaj",
    "gloss": "tea",
    "note": "One syllable; 'č' as in 'church'.",
    "i1Level": 1,
    "tags": [
      "generated",
      "s1-cafe-order",
      "greet",
      "order"
    ],
    "meta": {
      "freqRank": 2,
      "gender": "masculine"
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-cafe-order-v6",
    "kind": "vocab",
    "prompt": "juice",
    "answer": "сок",
    "translit": "sok",
    "gloss": "juice",
    "note": "One syllable.",
    "i1Level": 1,
    "tags": [
      "generated",
      "s1-cafe-order",
      "greet",
      "order"
    ],
    "meta": {
      "freqRank": 2,
      "gender": "masculine"
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-cafe-order-v7",
    "kind": "phrase",
    "prompt": "What would you like? (formal)",
    "answer": "Што ќе сакате?",
    "translit": "Što ḱe sakate?",
    "gloss": "What would you like? (formal)",
    "note": "Formal/plural; 'ќе' marks future tense.",
    "i1Level": 2,
    "tags": [
      "generated",
      "s1-cafe-order",
      "greet",
      "order"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-cafe-order-v8",
    "kind": "phrase",
    "prompt": "Here you go / Go ahead",
    "answer": "Повелете",
    "translit": "Povelete",
    "gloss": "Here you go / Go ahead",
    "note": "Stress: po-VE-le-te; polite, very common.",
    "i1Level": 1,
    "tags": [
      "generated",
      "s1-cafe-order",
      "greet",
      "order"
    ],
    "meta": {
      "freqRank": 1
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-cafe-order-v9",
    "kind": "phrase",
    "prompt": "The bill, please.",
    "answer": "Сметката, ве молам.",
    "translit": "Smetkata, ve molam.",
    "gloss": "The bill, please.",
    "note": "'сметката' = the bill, with definite article -та.",
    "i1Level": 2,
    "tags": [
      "generated",
      "s1-cafe-order",
      "greet",
      "order"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-cafe-order-v10",
    "kind": "phrase",
    "prompt": "Cheers!",
    "answer": "Наздравје!",
    "translit": "Nazdravje!",
    "gloss": "Cheers!",
    "note": "Stress: na-ZDRAV-je; toast.",
    "i1Level": 1,
    "tags": [
      "generated",
      "s1-cafe-order",
      "greet",
      "order"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-cafe-order-v11",
    "kind": "phrase",
    "prompt": "fifty / a hundred / a hundred and fifty (prices)",
    "answer": "педесет / сто / сто и педесет",
    "translit": "pedeset / sto / sto i pedeset",
    "gloss": "fifty / a hundred / a hundred and fifty (prices)",
    "note": "'и' = and, links hundreds and tens.",
    "i1Level": 2,
    "tags": [
      "generated",
      "s1-cafe-order",
      "greet",
      "order"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-greet-intro-v1",
    "kind": "phrase",
    "prompt": "What's your name? (informal)",
    "answer": "Како се викаш?",
    "translit": "Kako se vikaš?",
    "gloss": "What's your name? (informal)",
    "note": "Lit. 'How do you call yourself?'; informal address.",
    "i1Level": 1,
    "tags": [
      "generated",
      "s1-greet-intro",
      "introduce-self",
      "ask-name"
    ],
    "meta": {
      "freqRank": 1
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-greet-intro-v2",
    "kind": "phrase",
    "prompt": "I am …",
    "answer": "Јас сум …",
    "translit": "Jas sum …",
    "gloss": "I am …",
    "note": "'Јас' (I) often dropped since verb shows person.",
    "i1Level": 1,
    "tags": [
      "generated",
      "s1-greet-intro",
      "introduce-self",
      "ask-name"
    ],
    "meta": {
      "freqRank": 1
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-greet-intro-v3",
    "kind": "phrase",
    "prompt": "Nice to meet you.",
    "answer": "Мило ми е.",
    "translit": "Milo mi e.",
    "gloss": "Nice to meet you.",
    "note": "Lit. 'It is dear to me'; standard polite phrase.",
    "i1Level": 1,
    "tags": [
      "generated",
      "s1-greet-intro",
      "introduce-self",
      "ask-name"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-greet-intro-v4",
    "kind": "phrase",
    "prompt": "Where are you from?",
    "answer": "Од каде си?",
    "translit": "Od kade si?",
    "gloss": "Where are you from?",
    "note": "Informal; 'си' is 2sg of 'to be'.",
    "i1Level": 2,
    "tags": [
      "generated",
      "s1-greet-intro",
      "introduce-self",
      "ask-name"
    ],
    "meta": {
      "freqRank": 1
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-greet-intro-v5",
    "kind": "phrase",
    "prompt": "I'm from …",
    "answer": "Од … сум.",
    "translit": "Od … sum.",
    "gloss": "I'm from …",
    "note": "Fill blank with place; 'од' = from.",
    "i1Level": 2,
    "tags": [
      "generated",
      "s1-greet-intro",
      "introduce-self",
      "ask-name"
    ],
    "meta": {
      "freqRank": 1
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-greet-intro-v6",
    "kind": "phrase",
    "prompt": "What do you do?",
    "answer": "Што работиш?",
    "translit": "Što rabotiš?",
    "gloss": "What do you do?",
    "note": "Stress on RA-bo-tiš; literally 'what do you work?'",
    "i1Level": 2,
    "tags": [
      "generated",
      "s1-greet-intro",
      "introduce-self",
      "ask-name"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-greet-intro-v7",
    "kind": "phrase",
    "prompt": "I'm learning Macedonian.",
    "answer": "Учам македонски.",
    "translit": "Učam makedonski.",
    "gloss": "I'm learning Macedonian.",
    "note": "Language name lowercase; 'учам' = I learn/study.",
    "i1Level": 2,
    "tags": [
      "generated",
      "s1-greet-intro",
      "introduce-self",
      "ask-name"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-greet-intro-v8",
    "kind": "phrase",
    "prompt": "I speak a little.",
    "answer": "Зборувам малку.",
    "translit": "Zboruvam malku.",
    "gloss": "I speak a little.",
    "note": "Stress zbo-RU-vam; 'малку' = a little.",
    "i1Level": 2,
    "tags": [
      "generated",
      "s1-greet-intro",
      "introduce-self",
      "ask-name"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-greet-intro-v9",
    "kind": "vocab",
    "prompt": "am / are / is",
    "answer": "сум / си / е",
    "translit": "sum / si / e",
    "gloss": "am / are / is",
    "note": "Present of 'to be': 1sg/2sg/3sg.",
    "i1Level": 1,
    "tags": [
      "generated",
      "s1-greet-intro",
      "introduce-self",
      "ask-name"
    ],
    "meta": {
      "freqRank": 1
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-market-v1",
    "kind": "phrase",
    "prompt": "I'd like …",
    "answer": "Сакам …",
    "translit": "Sakam …",
    "gloss": "I'd like …",
    "note": "Stress on 'Sa-'; common way to order/request",
    "i1Level": 2,
    "tags": [
      "generated",
      "s1-market",
      "request-item",
      "specify-quantity"
    ],
    "meta": {
      "freqRank": 1
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-market-v2",
    "kind": "phrase",
    "prompt": "a kilo",
    "answer": "едно кило",
    "translit": "edno kilo",
    "gloss": "a kilo",
    "note": "'edno' = one (neuter), agrees with 'kilo'",
    "i1Level": 2,
    "tags": [
      "generated",
      "s1-market",
      "request-item",
      "specify-quantity"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-market-v3",
    "kind": "phrase",
    "prompt": "half a kilo",
    "answer": "половина кило",
    "translit": "polovina kilo",
    "gloss": "half a kilo",
    "note": "'polovina' = half",
    "i1Level": 2,
    "tags": [
      "generated",
      "s1-market",
      "request-item",
      "specify-quantity"
    ],
    "meta": {
      "freqRank": 3
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-market-v4",
    "kind": "phrase",
    "prompt": "How much per kilo?",
    "answer": "Колку чини килото?",
    "translit": "Kolku chini kiloto?",
    "gloss": "How much per kilo?",
    "note": "'kiloto' = the kilo (definite)",
    "i1Level": 2,
    "tags": [
      "generated",
      "s1-market",
      "request-item",
      "specify-quantity"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-market-v5",
    "kind": "vocab",
    "prompt": "bread",
    "answer": "леб",
    "translit": "leb",
    "gloss": "bread",
    "note": "One syllable, no stress shift",
    "i1Level": 1,
    "tags": [
      "generated",
      "s1-market",
      "request-item",
      "specify-quantity"
    ],
    "meta": {
      "freqRank": 1,
      "gender": "masculine"
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-market-v6",
    "kind": "vocab",
    "prompt": "milk",
    "answer": "млеко",
    "translit": "mleko",
    "gloss": "milk",
    "note": "Stress on 'mle-'",
    "i1Level": 1,
    "tags": [
      "generated",
      "s1-market",
      "request-item",
      "specify-quantity"
    ],
    "meta": {
      "freqRank": 2,
      "gender": "neuter"
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-market-v7",
    "kind": "vocab",
    "prompt": "cheese",
    "answer": "сирење",
    "translit": "sirenje",
    "gloss": "cheese",
    "note": "'nj' = soft н; stress on 'si-'",
    "i1Level": 2,
    "tags": [
      "generated",
      "s1-market",
      "request-item",
      "specify-quantity"
    ],
    "meta": {
      "freqRank": 2,
      "gender": "neuter"
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-market-v8",
    "kind": "vocab",
    "prompt": "apples",
    "answer": "јаболка",
    "translit": "jabolka",
    "gloss": "apples",
    "note": "Plural of 'јаболко' (neuter); stress on 'ja-'",
    "i1Level": 2,
    "tags": [
      "generated",
      "s1-market",
      "request-item",
      "specify-quantity"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-market-v9",
    "kind": "phrase",
    "prompt": "Do you have …?",
    "answer": "Имате ли …?",
    "translit": "Imate li …?",
    "gloss": "Do you have …?",
    "note": "'li' marks yes/no question; polite plural form",
    "i1Level": 1,
    "tags": [
      "generated",
      "s1-market",
      "request-item",
      "specify-quantity"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-market-v10",
    "kind": "phrase",
    "prompt": "That's all, thanks.",
    "answer": "Само тоа, фала.",
    "translit": "Samo toa, fala.",
    "gloss": "That's all, thanks.",
    "note": "'fala' is informal thanks; 'toa' = that",
    "i1Level": 2,
    "tags": [
      "generated",
      "s1-market",
      "request-item",
      "specify-quantity"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-directions-v1",
    "kind": "phrase",
    "prompt": "Where is …?",
    "answer": "Каде е …?",
    "translit": "Kade e …?",
    "gloss": "Where is …?",
    "note": "Common way to ask for location",
    "i1Level": 1,
    "tags": [
      "generated",
      "s1-directions",
      "ask-the-way",
      "understand-directions"
    ],
    "meta": {
      "freqRank": 1
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-directions-v2",
    "kind": "vocab",
    "prompt": "left",
    "answer": "лево",
    "translit": "levo",
    "gloss": "left",
    "note": "Stress on first syllable",
    "i1Level": 2,
    "tags": [
      "generated",
      "s1-directions",
      "ask-the-way",
      "understand-directions"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-directions-v3",
    "kind": "vocab",
    "prompt": "right",
    "answer": "десно",
    "translit": "desno",
    "gloss": "right",
    "note": "Stress on first syllable",
    "i1Level": 2,
    "tags": [
      "generated",
      "s1-directions",
      "ask-the-way",
      "understand-directions"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-directions-v4",
    "kind": "vocab",
    "prompt": "straight ahead",
    "answer": "право",
    "translit": "pravo",
    "gloss": "straight ahead",
    "note": "Stress: PRA-vo",
    "i1Level": 2,
    "tags": [
      "generated",
      "s1-directions",
      "ask-the-way",
      "understand-directions"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-directions-v5",
    "kind": "phrase",
    "prompt": "near / far",
    "answer": "близу / далеку",
    "translit": "blizu / daleku",
    "gloss": "near / far",
    "note": "Two opposites: near/far",
    "i1Level": 2,
    "tags": [
      "generated",
      "s1-directions",
      "ask-the-way",
      "understand-directions"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-directions-v6",
    "kind": "phrase",
    "prompt": "here / there",
    "answer": "тука / таму",
    "translit": "tuka / tamu",
    "gloss": "here / there",
    "note": "Here vs there",
    "i1Level": 1,
    "tags": [
      "generated",
      "s1-directions",
      "ask-the-way",
      "understand-directions"
    ],
    "meta": {
      "freqRank": 1
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-directions-v7",
    "kind": "vocab",
    "prompt": "bus",
    "answer": "автобус",
    "translit": "avtobus",
    "gloss": "bus",
    "note": "Stress: av-TO-bus",
    "i1Level": 2,
    "tags": [
      "generated",
      "s1-directions",
      "ask-the-way",
      "understand-directions"
    ],
    "meta": {
      "freqRank": 2,
      "gender": "masculine"
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-directions-v8",
    "kind": "vocab",
    "prompt": "taxi",
    "answer": "такси",
    "translit": "taksi",
    "gloss": "taxi",
    "note": "Indeclinable loanword",
    "i1Level": 1,
    "tags": [
      "generated",
      "s1-directions",
      "ask-the-way",
      "understand-directions"
    ],
    "meta": {
      "freqRank": 2,
      "gender": "neuter"
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-directions-v9",
    "kind": "vocab",
    "prompt": "ticket",
    "answer": "билет",
    "translit": "bilet",
    "gloss": "ticket",
    "note": "Stress: bi-LET",
    "i1Level": 2,
    "tags": [
      "generated",
      "s1-directions",
      "ask-the-way",
      "understand-directions"
    ],
    "meta": {
      "freqRank": 2,
      "gender": "masculine"
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-directions-v10",
    "kind": "phrase",
    "prompt": "in/to the centre",
    "answer": "во центарот",
    "translit": "vo centarot",
    "gloss": "in/to the centre",
    "note": "'centar' is masculine",
    "i1Level": 2,
    "tags": [
      "generated",
      "s1-directions",
      "ask-the-way",
      "understand-directions"
    ],
    "meta": {
      "freqRank": 2
    },
    "confidence": "validated"
  },
  {
    "id": "gen-s1-directions-v11",
    "kind": "phrase",
    "prompt": "Turn left.",
    "answer": "Свртете лево.",
    "translit": "Svrtete levo.",
    "gloss": "Turn left.",
    "note": "Polite/plural imperative",
    "i1Level": 3,
    "tags": [
      "generated",
      "s1-directions",
      "ask-the-way",
      "understand-directions"
    ],
    "meta": {
      "freqRank": 3
    },
    "confidence": "validated"
  }
];

export const promotedScenarios: Scenario[] = [
  {
    "id": "gen-s1-cafe-order",
    "title": "Café & bar: order and pay (the anchor)",
    "goal": "Practise these functions: greet, order, ask-price, pay, toast. Use the taught chunks where natural: Едно пиво, ве молам.; кафе; пиво; вода; чај; сок. Recycle earlier material: s0-survive, s0-greet, s0-repair.",
    "setting": "a relaxed bar/café in Skopje",
    "requiredVocab": [
      "gen-s1-cafe-order-v1",
      "gen-s1-cafe-order-v2",
      "gen-s1-cafe-order-v3",
      "gen-s1-cafe-order-v4",
      "gen-s1-cafe-order-v5",
      "gen-s1-cafe-order-v6"
    ],
    "requiredStructures": ["definite-articles", "gender", "verb-conjugation"],
    "script": [
      {
        "speaker": "partner",
        "text": "Добар ден! Што сакате?",
        "gloss": "Good day! What would you like?"
      },
      {
        "speaker": "learner",
        "text": "Добар ден! Едно кафе, ве молам.",
        "gloss": "Good day! One coffee, please.",
        "translit": "Dobar den! Edno kafe, ve molam.",
        "satisfies": [
          "greeted",
          "ordered"
        ]
      },
      {
        "speaker": "partner",
        "text": "Секако. Сакате ли уште нешто?",
        "gloss": "Of course. Would you like anything else?"
      },
      {
        "speaker": "learner",
        "text": "Едно кафе и една вода. Колку чини?",
        "gloss": "One coffee and one water. How much is it?",
        "translit": "Edno kafe i edna voda. Kolku chini?",
        "satisfies": [
          "asked-price"
        ]
      },
      {
        "speaker": "partner",
        "text": "Сто денари.",
        "gloss": "One hundred denars."
      },
      {
        "speaker": "learner",
        "text": "Повелете. Сметката, ве молам.",
        "gloss": "Here you are. The bill, please.",
        "translit": "Povelete. Smetkata, ve molam.",
        "satisfies": [
          "paid"
        ]
      },
      {
        "speaker": "partner",
        "text": "Благодарам. Пријатно!",
        "gloss": "Thank you. Enjoy!"
      },
      {
        "speaker": "learner",
        "text": "Благодарам. Наздравје!",
        "gloss": "Thank you. Cheers!",
        "translit": "Blagodaram. Nazdravje!",
        "satisfies": [
          "toasted"
        ]
      }
    ],
    "successCriteria": [
      {
        "id": "greeted",
        "description": "Greeted the waiter"
      },
      {
        "id": "ordered",
        "description": "Ordered a drink"
      },
      {
        "id": "asked-price",
        "description": "Asked the price"
      },
      {
        "id": "paid",
        "description": "Asked for the bill / paid"
      },
      {
        "id": "toasted",
        "description": "Made a toast or said cheers"
      }
    ],
    "confidence": "validated"
  },
  {
    "id": "gen-s1-greet-intro",
    "title": "Greetings & introductions",
    "goal": "Practise these functions: introduce-self, ask-name, ask-origin, state-occupation, state-learning. Use the taught chunks where natural: Како се викаш?; Јас сум …; Мило ми е.; Од каде си?; Од … сум.; Што работиш?. Recycle earlier material: s0-greet, s0-repair, s1-cafe-order.",
    "setting": "meeting another patron at the bar / someone new",
    "requiredVocab": [
      "gen-s1-greet-intro-v1",
      "gen-s1-greet-intro-v2",
      "gen-s1-greet-intro-v3",
      "gen-s1-greet-intro-v4",
      "gen-s1-greet-intro-v5",
      "gen-s1-greet-intro-v6"
    ],
    "requiredStructures": [],
    "script": [
      {
        "speaker": "partner",
        "text": "Здраво! Како се викаш?",
        "gloss": "Hi! What's your name?"
      },
      {
        "speaker": "learner",
        "text": "Здраво! Јас сум Ана. А ти?",
        "gloss": "Hi! I am Ana. And you?",
        "translit": "Zdravo! Jas sum Ana. A ti?",
        "satisfies": [
          "introduced",
          "asked-name"
        ]
      },
      {
        "speaker": "partner",
        "text": "Јас сум Марко. Мило ми е!",
        "gloss": "I am Marko. Nice to meet you!"
      },
      {
        "speaker": "learner",
        "text": "Мило ми е! Од каде си?",
        "gloss": "Nice to meet you! Where are you from?",
        "translit": "Milo mi e! Od kade si?",
        "satisfies": [
          "asked-origin"
        ]
      },
      {
        "speaker": "partner",
        "text": "Од Скопје сум. А ти?",
        "gloss": "I'm from Skopje. And you?"
      },
      {
        "speaker": "learner",
        "text": "Од Лондон сум. Учам македонски.",
        "gloss": "I'm from London. I'm learning Macedonian.",
        "translit": "Od London sum. Ucham makedonski.",
        "satisfies": [
          "stated-origin",
          "stated-learning"
        ]
      },
      {
        "speaker": "partner",
        "text": "Супер! Што работиш?",
        "gloss": "Great! What do you do?"
      },
      {
        "speaker": "learner",
        "text": "Јас сум учителка.",
        "gloss": "I am a teacher.",
        "translit": "Jas sum uchitelka.",
        "satisfies": [
          "stated-occupation"
        ]
      }
    ],
    "successCriteria": [
      {
        "id": "introduced",
        "description": "Introduced self with name"
      },
      {
        "id": "asked-name",
        "description": "Asked the other person's name"
      },
      {
        "id": "asked-origin",
        "description": "Asked where the person is from"
      },
      {
        "id": "stated-origin",
        "description": "Said where they are from"
      },
      {
        "id": "stated-learning",
        "description": "Said they are learning Macedonian"
      },
      {
        "id": "stated-occupation",
        "description": "Said their occupation"
      }
    ],
    "confidence": "validated"
  },
  {
    "id": "gen-s1-market",
    "title": "Shopping at the market",
    "goal": "Practise these functions: request-item, specify-quantity, ask-price, buy. Use the taught chunks where natural: Сакам …; едно кило; половина кило; Колку чини килото?; леб; млеко. Recycle earlier material: s0-survive, s1-cafe-order, s0-repair.",
    "setting": "a small shop / the pazar",
    "requiredVocab": [
      "gen-s1-market-v1",
      "gen-s1-market-v2",
      "gen-s1-market-v3",
      "gen-s1-market-v4",
      "gen-s1-market-v5",
      "gen-s1-market-v6"
    ],
    "requiredStructures": [],
    "script": [
      {
        "speaker": "partner",
        "text": "Добар ден! Што сакате?",
        "gloss": "Good day! What would you like?"
      },
      {
        "speaker": "learner",
        "text": "Добар ден! Сакам јаболка, ве молам.",
        "gloss": "Good day! I want apples, please.",
        "translit": "Dobar den! Sakam jabolka, ve molam.",
        "satisfies": [
          "greeted",
          "requested-item"
        ]
      },
      {
        "speaker": "partner",
        "text": "Секако. Колку сакате?",
        "gloss": "Of course. How much would you like?"
      },
      {
        "speaker": "learner",
        "text": "Едно кило, ве молам.",
        "gloss": "One kilo, please.",
        "translit": "Edno kilo, ve molam.",
        "satisfies": [
          "specified-quantity"
        ]
      },
      {
        "speaker": "partner",
        "text": "Повелете. Уште нешто?",
        "gloss": "Here you are. Anything else?"
      },
      {
        "speaker": "learner",
        "text": "Колку чини килото?",
        "gloss": "How much is a kilo?",
        "translit": "Kolku chini kiloto?",
        "satisfies": [
          "asked-price"
        ]
      },
      {
        "speaker": "partner",
        "text": "Шеесет денари килото.",
        "gloss": "Sixty denars a kilo."
      },
      {
        "speaker": "learner",
        "text": "Добро, ќе ги земам. Повелете.",
        "gloss": "Good, I'll take them. Here you are.",
        "translit": "Dobro, kje gi zemam. Povelete.",
        "satisfies": [
          "bought"
        ]
      }
    ],
    "successCriteria": [
      {
        "id": "greeted",
        "description": "Greeted the seller"
      },
      {
        "id": "requested-item",
        "description": "Asked for an item"
      },
      {
        "id": "specified-quantity",
        "description": "Specified a quantity"
      },
      {
        "id": "asked-price",
        "description": "Asked the price"
      },
      {
        "id": "bought",
        "description": "Agreed to buy / completed the purchase"
      }
    ],
    "confidence": "validated"
  },
  {
    "id": "gen-s1-directions",
    "title": "Directions & getting around",
    "goal": "Practise these functions: ask-the-way, understand-directions, name-transport. Use the taught chunks where natural: Каде е …?; лево; десно; право; близу / далеку; тука / таму. Recycle earlier material: s0-survive, s0-repair, s1-cafe-order.",
    "setting": "a street in the city",
    "requiredVocab": [
      "gen-s1-directions-v1",
      "gen-s1-directions-v2",
      "gen-s1-directions-v3",
      "gen-s1-directions-v4",
      "gen-s1-directions-v5",
      "gen-s1-directions-v6"
    ],
    "requiredStructures": ["verb-conjugation-i"],
    "script": [
      {
        "speaker": "learner",
        "text": "Извинете! Каде е автобуската станица?",
        "gloss": "Excuse me! Where is the bus station?",
        "translit": "Izvinete! Kade e avtobuskata stanica?",
        "satisfies": [
          "asked-way"
        ]
      },
      {
        "speaker": "partner",
        "text": "Здраво! Оди право, па лево.",
        "gloss": "Hi! Go straight, then left."
      },
      {
        "speaker": "learner",
        "text": "Лево? Дали е близу?",
        "gloss": "Left? Is it near?",
        "translit": "Levo? Dali e blizu?",
        "satisfies": [
          "understood"
        ]
      },
      {
        "speaker": "partner",
        "text": "Да, многу близу. Таму е, десно.",
        "gloss": "Yes, very near. It's there, on the right."
      },
      {
        "speaker": "learner",
        "text": "Може со автобус или со трамвај?",
        "gloss": "Can I go by bus or by tram?",
        "translit": "Mozhe so avtobus ili so tramvaj?",
        "satisfies": [
          "named-transport"
        ]
      },
      {
        "speaker": "partner",
        "text": "Со автобус. Бројот десет.",
        "gloss": "By bus. Number ten."
      },
      {
        "speaker": "learner",
        "text": "Ви благодарам! Пријатно!",
        "gloss": "Thank you! Have a nice day!",
        "translit": "Vi blagodaram! Prijatno!",
        "satisfies": [
          "thanked"
        ]
      },
      {
        "speaker": "partner",
        "text": "Нема за што. Пријатно!",
        "gloss": "You're welcome. Take care!"
      }
    ],
    "successCriteria": [
      {
        "id": "asked-way",
        "description": "Asked where a place is"
      },
      {
        "id": "understood",
        "description": "Understood and confirmed directions (left/right/near)"
      },
      {
        "id": "named-transport",
        "description": "Asked about a means of transport"
      },
      {
        "id": "thanked",
        "description": "Thanked the person politely"
      }
    ],
    "confidence": "validated"
  }
];

export const promotedStories: MiniStory[] = [
  {
    "id": "gen-s1-cafe-order-story",
    "title": "Марко во кафето",
    "titleGloss": "Marko at the café",
    "i1Level": 1,
    "level": "A1",
    "theme": "Café & bar: order and pay (the anchor)",
    "audioSource": "tts",
    "body": [
      {
        "text": "Марко влегува во едно кафе во Скопје.",
        "translit": "Marko vleguva vo edno kafe vo Skopje.",
        "gloss": "Marko enters a café in Skopje."
      },
      {
        "text": "„Добар ден!“ вели Марко.",
        "translit": "„Dobar den!“ veli Marko.",
        "gloss": "\"Good day!\" says Marko."
      },
      {
        "text": "„Што ќе сакате?“ прашува келнерот.",
        "translit": "„Što ḱe sakate?“ prašuva kelnerot.",
        "gloss": "\"What would you like?\" asks the waiter."
      },
      {
        "text": "„Едно пиво, ве молам“, вели Марко.",
        "translit": "„Edno pivo, ve molam“, veli Marko.",
        "gloss": "\"One beer, please,\" says Marko."
      },
      {
        "text": "„Повелете“, вели келнерот.",
        "translit": "„Povelete“, veli kelnerot.",
        "gloss": "\"Here you go,\" says the waiter."
      },
      {
        "text": "„Наздравје!“ вели Марко.",
        "translit": "„Nazdravje!“ veli Marko.",
        "gloss": "\"Cheers!\" says Marko."
      },
      {
        "text": "„Сметката, ве молам“, вели Марко.",
        "translit": "„Smetkata, ve molam“, veli Marko.",
        "gloss": "\"The bill, please,\" says Marko."
      },
      {
        "text": "Пивото чини педесет.",
        "translit": "Pivoto čini pedeset.",
        "gloss": "The beer costs fifty."
      }
    ],
    "qa": [
      {
        "id": "q1",
        "question": "Што сака Марко?",
        "questionGloss": "What does Marko want?",
        "answer": "Едно пиво.",
        "answerGloss": "One beer.",
        "answerTranslit": "Edno pivo."
      },
      {
        "id": "q2",
        "question": "Колку чини пивото?",
        "questionGloss": "How much does the beer cost?",
        "answer": "Педесет.",
        "answerGloss": "Fifty.",
        "answerTranslit": "Pedeset."
      },
      {
        "id": "q3",
        "question": "Кажи го гласно: како нарачуваш едно пиво?",
        "questionGloss": "Say it aloud: how do you order one beer?",
        "answer": "Едно пиво, ве молам.",
        "answerGloss": "One beer, please.",
        "answerTranslit": "Edno pivo, ve molam.",
        "spokenPrompt": true
      }
    ],
    "registersVocab": [
      {
        "lexKey": "кафе",
        "gloss": "coffee"
      },
      {
        "lexKey": "пиво",
        "gloss": "beer"
      },
      {
        "lexKey": "вода",
        "gloss": "water"
      },
      {
        "lexKey": "чај",
        "gloss": "tea"
      },
      {
        "lexKey": "сок",
        "gloss": "juice"
      },
      {
        "lexKey": "што ќе сакате",
        "gloss": "What would you like? (formal)"
      },
      {
        "lexKey": "повелете",
        "gloss": "Here you go / Go ahead"
      },
      {
        "lexKey": "наздравје",
        "gloss": "Cheers!"
      }
    ],
    "confidence": "validated"
  },
  {
    "id": "gen-s1-greet-intro-story",
    "title": "Во барот",
    "titleGloss": "At the bar",
    "i1Level": 1,
    "level": "A1",
    "theme": "Greetings & introductions",
    "audioSource": "tts",
    "body": [
      {
        "text": "Ана е во барот.",
        "translit": "Ana e vo barot.",
        "gloss": "Ana is at the bar."
      },
      {
        "text": "Марко седи до неа.",
        "translit": "Marko sedi do nea.",
        "gloss": "Marko sits next to her."
      },
      {
        "text": "„Здраво! Како се викаш?“ прашува Марко.",
        "translit": "„Zdravo! Kako se vikash?“ prashuva Marko.",
        "gloss": "\"Hi! What's your name?\" asks Marko."
      },
      {
        "text": "„Јас сум Ана. Мило ми е.“",
        "translit": "„Jas sum Ana. Milo mi e.“",
        "gloss": "\"I am Ana. Nice to meet you.\""
      },
      {
        "text": "„Од каде си?“ прашува Марко.",
        "translit": "„Od kade si?“ prashuva Marko.",
        "gloss": "\"Where are you from?\" asks Marko."
      },
      {
        "text": "„Од Англија сум. Учам македонски.“",
        "translit": "„Od Anglija sum. Ucham makedonski.“",
        "gloss": "\"I'm from England. I'm learning Macedonian.\""
      },
      {
        "text": "„Што работиш?“ прашува Ана.",
        "translit": "„Shto rabotish?“ prashuva Ana.",
        "gloss": "\"What do you do?\" asks Ana."
      },
      {
        "text": "„Јас сум доктор. Зборувам малку англиски.“",
        "translit": "„Jas sum doktor. Zboruvam malku angliski.“",
        "gloss": "\"I am a doctor. I speak a little English.\""
      }
    ],
    "qa": [
      {
        "id": "q1",
        "question": "Од каде е Ана?",
        "questionGloss": "Where is Ana from?",
        "answer": "Од Англија е.",
        "answerGloss": "She is from England.",
        "answerTranslit": "Od Anglija e."
      },
      {
        "id": "q2",
        "question": "Што работи Марко?",
        "questionGloss": "What does Marko do?",
        "answer": "Марко е доктор.",
        "answerGloss": "Marko is a doctor.",
        "answerTranslit": "Marko e doktor."
      },
      {
        "id": "q3",
        "question": "Кажи: што учи Ана?",
        "questionGloss": "Say: what is Ana learning?",
        "answer": "Учам македонски.",
        "answerGloss": "I'm learning Macedonian.",
        "answerTranslit": "Ucham makedonski.",
        "spokenPrompt": true
      }
    ],
    "registersVocab": [
      {
        "lexKey": "како се викаш",
        "gloss": "What's your name? (informal)"
      },
      {
        "lexKey": "мило ми е",
        "gloss": "Nice to meet you."
      },
      {
        "lexKey": "од каде си",
        "gloss": "Where are you from?"
      },
      {
        "lexKey": "што работиш",
        "gloss": "What do you do?"
      },
      {
        "lexKey": "учам македонски",
        "gloss": "I'm learning Macedonian."
      },
      {
        "lexKey": "зборувам малку",
        "gloss": "I speak a little."
      }
    ],
    "confidence": "validated"
  },
  {
    "id": "gen-s1-market-story",
    "title": "Ана на пазар",
    "titleGloss": "Ana at the market",
    "i1Level": 1,
    "level": "A1",
    "theme": "Shopping at the market",
    "audioSource": "tts",
    "body": [
      {
        "text": "Ана оди на пазар.",
        "translit": "Ana odi na pazar.",
        "gloss": "Ana goes to the market."
      },
      {
        "text": "„Добар ден! Сакам леб.“",
        "translit": "„Dobar den! Sakam leb.“",
        "gloss": "\"Good day! I'd like bread.\""
      },
      {
        "text": "„Имате ли млеко?“ прашува Ана.",
        "translit": "„Imate li mleko?“ prašuva Ana.",
        "gloss": "\"Do you have milk?\" asks Ana."
      },
      {
        "text": "„Да, имаме. Сакам едно кило јаболка.“",
        "translit": "„Da, imame. Sakam edno kilo jabolka.“",
        "gloss": "\"Yes, we have. I'd like a kilo of apples.\""
      },
      {
        "text": "„Колку чини килото?“",
        "translit": "„Kolku čini kiloto?“",
        "gloss": "\"How much per kilo?\""
      },
      {
        "text": "„Педесет денари.“",
        "translit": "„Pedeset denari.“",
        "gloss": "\"Fifty denars.\""
      },
      {
        "text": "„Сакам и половина кило сирење.“",
        "translit": "„Sakam i polovina kilo sirenje.“",
        "gloss": "\"I'd also like half a kilo of cheese.\""
      },
      {
        "text": "„Само тоа, фала.“",
        "translit": "„Samo toa, fala.“",
        "gloss": "\"That's all, thanks.\""
      }
    ],
    "qa": [
      {
        "id": "q1",
        "question": "Што сака Ана прво?",
        "questionGloss": "What does Ana want first?",
        "answer": "Сака леб.",
        "answerGloss": "She wants bread.",
        "answerTranslit": "Saka leb."
      },
      {
        "id": "q2",
        "question": "Колку јаболка сака Ана?",
        "questionGloss": "How many apples does Ana want?",
        "answer": "Едно кило.",
        "answerGloss": "One kilo.",
        "answerTranslit": "Edno kilo."
      },
      {
        "id": "q3",
        "question": "Кажи дека сакаш половина кило сирење.",
        "questionGloss": "Say that you'd like half a kilo of cheese.",
        "answer": "Сакам половина кило сирење.",
        "answerGloss": "I'd like half a kilo of cheese.",
        "answerTranslit": "Sakam polovina kilo sirenje.",
        "spokenPrompt": true
      }
    ],
    "registersVocab": [
      {
        "lexKey": "едно кило",
        "gloss": "a kilo"
      },
      {
        "lexKey": "половина кило",
        "gloss": "half a kilo"
      },
      {
        "lexKey": "колку чини килото",
        "gloss": "How much per kilo?"
      },
      {
        "lexKey": "леб",
        "gloss": "bread"
      },
      {
        "lexKey": "млеко",
        "gloss": "milk"
      },
      {
        "lexKey": "сирење",
        "gloss": "cheese"
      },
      {
        "lexKey": "јаболка",
        "gloss": "apples"
      }
    ],
    "confidence": "validated"
  },
  {
    "id": "gen-s1-directions-story",
    "title": "Ана бара центар",
    "titleGloss": "Ana looks for the centre",
    "i1Level": 1,
    "level": "A1",
    "theme": "Directions & getting around",
    "audioSource": "tts",
    "body": [
      {
        "text": "Ана е тука, на улицата.",
        "translit": "Ana e tuka, na ulicata.",
        "gloss": "Ana is here, on the street."
      },
      {
        "text": "„Каде е центарот?“ прашува Ана.",
        "translit": "„Kade e centarot?“ prašuva Ana.",
        "gloss": "\"Where is the centre?\" asks Ana."
      },
      {
        "text": "„Свртете лево,“ вели човекот.",
        "translit": "„Svrtete levo,“ veli čovekot.",
        "gloss": "\"Turn left,\" says the man."
      },
      {
        "text": "„Потоа одете право. Тоа е близу.“",
        "translit": "„Potoa odete naravo. Toa e blizu.“",
        "gloss": "\"Then go straight ahead. It is near.\""
      },
      {
        "text": "Ана сака да оди со автобус.",
        "translit": "Ana saka da odi so avtobus.",
        "gloss": "Ana wants to go by bus."
      },
      {
        "text": "Таму има автобус за центарот.",
        "translit": "Tamu ima avtobus vo centar.",
        "gloss": "There is a bus to the centre there."
      },
      {
        "text": "Ана купува билет.",
        "translit": "Ana kupuva bilet.",
        "gloss": "Ana buys a ticket."
      },
      {
        "text": "„Благодарам! Центарот не е далеку,“ вели Ана.",
        "translit": "„Blagodaram! Centarot ne e daleku,“ veli Ana.",
        "gloss": "\"Thank you! The centre is not far,\" says Ana."
      }
    ],
    "qa": [
      {
        "id": "q1",
        "question": "Каде сака да оди Ана?",
        "questionGloss": "Where does Ana want to go?",
        "answer": "Во центарот.",
        "answerGloss": "To the centre.",
        "answerTranslit": "Vo centar."
      },
      {
        "id": "q2",
        "question": "Со што патува Ана?",
        "questionGloss": "By what does Ana travel?",
        "answer": "Со автобус.",
        "answerGloss": "By bus.",
        "answerTranslit": "So avtobus."
      },
      {
        "id": "q3",
        "question": "Кажи гласно: како велиш да некој сврти лево?",
        "questionGloss": "Say it aloud: how do you tell someone to turn left?",
        "answer": "Свртете лево.",
        "answerGloss": "Turn left.",
        "answerTranslit": "Svrtete levo.",
        "spokenPrompt": true
      }
    ],
    "registersVocab": [
      {
        "lexKey": "лево",
        "gloss": "left"
      },
      {
        "lexKey": "десно",
        "gloss": "right"
      },
      {
        "lexKey": "право",
        "gloss": "straight ahead"
      },
      {
        "lexKey": "автобус",
        "gloss": "bus"
      },
      {
        "lexKey": "такси",
        "gloss": "taxi"
      },
      {
        "lexKey": "билет",
        "gloss": "ticket"
      },
      {
        "lexKey": "во центарот",
        "gloss": "in/to the centre"
      },
      {
        "lexKey": "свртете лево",
        "gloss": "Turn left."
      }
    ],
    "confidence": "validated"
  }
];

export const promotedGrammar: GrammarConcept[] = [
  {
    "id": "gender",
    "name": "Gender agreement with numbers/articles",
    "explanation": "The number 'one' and gender must agree with the noun: use еден for masculine, една for feminine, едно for neuter. Choose the form that matches the noun's gender.",
    "examples": [
      "едно пиво → one beer (neuter)",
      "една вода → one water (feminine)",
      "еден сок → one juice (masculine)"
    ],
    "confidence": "validated",
    "drills": [
      {
        "id": "gen-s1-cafe-order-gender-d1",
        "kind": "grammar",
        "prompt": "___ кафе (one coffee)",
        "answer": "едно",
        "gloss": "one coffee",
        "options": [
          "еден",
          "една",
          "едно"
        ],
        "why": "кафе is neuter, so it takes едно.",
        "i1Level": 2,
        "tags": [
          "grammar",
          "gender",
          "s1-cafe-order"
        ],
        "confidence": "validated"
      },
      {
        "id": "gen-s1-cafe-order-gender-d2",
        "kind": "grammar",
        "prompt": "___ вода (one water)",
        "answer": "една",
        "gloss": "one water",
        "options": [
          "еден",
          "една",
          "едно"
        ],
        "why": "вода is feminine, so it takes една.",
        "i1Level": 2,
        "tags": [
          "grammar",
          "gender",
          "s1-cafe-order"
        ],
        "confidence": "validated"
      },
      {
        "id": "gen-s1-cafe-order-gender-d3",
        "kind": "grammar",
        "prompt": "___ сок (one juice)",
        "answer": "еден",
        "gloss": "one juice",
        "options": [
          "еден",
          "една",
          "едно"
        ],
        "why": "сок is masculine, so it takes еден.",
        "i1Level": 2,
        "tags": [
          "grammar",
          "gender",
          "s1-cafe-order"
        ],
        "confidence": "validated"
      }
    ]
  },
  {
    "id": "definite-articles",
    "name": "Definite article (the) at the end",
    "explanation": "To say 'the', attach the article to the END of the noun, not before it. Common endings: -от/-от for masculine, -та for feminine, -то for neuter.",
    "examples": [
      "сметка → сметката → the bill",
      "кафе → кафето → the coffee",
      "сок → сокот → the juice"
    ],
    "confidence": "validated",
    "drills": [
      {
        "id": "gen-s1-cafe-order-definite-articles-d1",
        "kind": "grammar",
        "prompt": "the bill (сметка + the)",
        "answer": "сметката",
        "gloss": "the bill",
        "options": [
          "сметката",
          "сметкаот",
          "тасметка"
        ],
        "why": "Feminine сметка takes -та at the end.",
        "i1Level": 2,
        "tags": [
          "grammar",
          "definite-articles",
          "s1-cafe-order"
        ],
        "confidence": "validated"
      },
      {
        "id": "gen-s1-cafe-order-definite-articles-d2",
        "kind": "grammar",
        "prompt": "the coffee (кафе + the)",
        "answer": "кафето",
        "gloss": "the coffee",
        "options": [
          "кафето",
          "кафеот",
          "токафе"
        ],
        "why": "Neuter кафе takes -то at the end.",
        "i1Level": 2,
        "tags": [
          "grammar",
          "definite-articles",
          "s1-cafe-order"
        ],
        "confidence": "validated"
      },
      {
        "id": "gen-s1-cafe-order-definite-articles-d3",
        "kind": "grammar",
        "prompt": "the juice (сок + the)",
        "answer": "сокот",
        "gloss": "the juice",
        "options": [
          "сокот",
          "сокта",
          "отсок"
        ],
        "why": "Masculine сок takes -от at the end.",
        "i1Level": 2,
        "tags": [
          "grammar",
          "definite-articles",
          "s1-cafe-order"
        ],
        "confidence": "validated"
      }
    ]
  }
];

export const promotedReaders: Reader[] = [
  {
    "id": "gen-s1-cafe-order-reader",
    "title": "Во кафулето",
    "titleGloss": "In the café",
    "theme": "Café & bar: order and pay (the anchor)",
    "i1Level": 2,
    "confidence": "validated",
    "body": [
      {
        "speaker": "partner",
        "text": "Марко влегува во кафулето во Скопје.",
        "translit": "Marko vleguva vo kafuleto vo Skopje.",
        "gloss": "Marko enters the café in Skopje."
      },
      {
        "speaker": "partner",
        "text": "Келнерот вели: Што ќе сакате?",
        "translit": "Kelnerot veli: Shto kje sakate?",
        "gloss": "The waiter says: What would you like?"
      },
      {
        "speaker": "partner",
        "text": "Едно пиво, ве молам.",
        "translit": "Edno pivo, ve molam.",
        "gloss": "One beer, please."
      },
      {
        "speaker": "partner",
        "text": "Повелете, вели келнерот.",
        "translit": "Povelete, veli kelnerot.",
        "gloss": "Here you go, says the waiter."
      },
      {
        "speaker": "partner",
        "text": "Наздравје! вели Марко.",
        "translit": "Nazdravje! veli Marko.",
        "gloss": "Cheers! says Marko."
      },
      {
        "speaker": "partner",
        "text": "Сметката, ве молам. Педесет денари.",
        "translit": "Smetkata, ve molam. Pedeset denari.",
        "gloss": "The bill, please. Fifty denars."
      }
    ]
  },
  {
    "id": "gen-s1-market-reader",
    "title": "На пазар",
    "titleGloss": "At the market",
    "theme": "Shopping at the market",
    "i1Level": 2,
    "confidence": "validated",
    "body": [
      {
        "speaker": "partner",
        "text": "Сакам едно кило јаболка.",
        "translit": "Sakam edno kilo jabolka.",
        "gloss": "I want one kilo of apples."
      },
      {
        "speaker": "partner",
        "text": "Колку чини килото?",
        "translit": "Kolku chini kiloto?",
        "gloss": "How much does the kilo cost?"
      },
      {
        "speaker": "partner",
        "text": "Имате ли сирење и млеко?",
        "translit": "Imate li sirenje i mleko?",
        "gloss": "Do you have cheese and milk?"
      },
      {
        "speaker": "partner",
        "text": "Сакам половина кило сирење.",
        "translit": "Sakam polovina kilo sirenje.",
        "gloss": "I want half a kilo of cheese."
      },
      {
        "speaker": "partner",
        "text": "Сакам и леб.",
        "translit": "Sakam i leb.",
        "gloss": "I also want bread."
      },
      {
        "speaker": "partner",
        "text": "Само тоа, фала.",
        "translit": "Samo toa, fala.",
        "gloss": "Just that, thanks."
      }
    ]
  },
  {
    "id": "gen-s1-directions-reader",
    "title": "Каде е автобусот?",
    "titleGloss": "Where is the bus?",
    "theme": "Directions & getting around",
    "i1Level": 3,
    "confidence": "validated",
    "body": [
      {
        "speaker": "partner",
        "text": "Ана е на улица во центарот.",
        "translit": "Ana e na ulica vo centar.",
        "gloss": "Ana is on a street in the center."
      },
      {
        "speaker": "partner",
        "text": "Таа прашува: Каде е автобусот?",
        "translit": "Taa prašuva: Kade e avtobusot?",
        "gloss": "She asks: Where is the bus?"
      },
      {
        "speaker": "partner",
        "text": "Еден човек вели: Свртете лево.",
        "translit": "Eden čovek veli: Svrtete levo.",
        "gloss": "A man says: Turn left."
      },
      {
        "speaker": "partner",
        "text": "Автобусот е таму, близу.",
        "translit": "Avtobusot e tamu, blizu.",
        "gloss": "The bus is there, close."
      },
      {
        "speaker": "partner",
        "text": "Ана нема билет за такси.",
        "translit": "Ana nema bilet za taksi.",
        "gloss": "Ana has no ticket for a taxi."
      },
      {
        "speaker": "partner",
        "text": "Таа оди десно и патува во центарот.",
        "translit": "Taa odi desno i patuva vo centar.",
        "gloss": "She goes right and travels to the center."
      }
    ]
  }
];

export const promotedWritingTasks: WritingTask[] = [
  {
    "id": "gen-s1-greet-intro-w1",
    "prompt": "You're at the bar and want to introduce yourself to the person next to you. Write: 'Hello, I am Marko. I am from Skopje.'",
    "targetConcepts": [
      "present-sum"
    ],
    "i1Level": 2,
    "confidence": "validated"
  },
  {
    "id": "gen-s1-greet-intro-w2",
    "prompt": "Ask the new person their name and where they are from. Write: 'What is your name? Where are you from?'",
    "targetConcepts": [
      "present-sum",
      "present-verbs"
    ],
    "i1Level": 2,
    "confidence": "validated"
  },
  {
    "id": "gen-s1-greet-intro-w3",
    "prompt": "Tell them what you do and that you are learning Macedonian. Write: 'I work as a teacher and I am learning Macedonian.'",
    "targetConcepts": [
      "present-sum",
      "present-verbs"
    ],
    "i1Level": 2,
    "confidence": "validated"
  }
];

export const promotedInfoGapTasks: InfoGapTask[] = [
  {
    "id": "gen-s1-cafe-order-gap",
    "title": "At the bar: order and pay (info-gap)",
    "goal": "Order the drinks, agree the price, pay, and toast — each of you knows only half.",
    "setting": "A relaxed bar/café in Skopje on a warm evening.",
    "roleA": {
      "role": "A",
      "brief": "You're the customer. Greet, order your drinks, ask the price, pay, and make a toast.",
      "secretInfo": [
        "You want one beer and one juice.",
        "You have a 500-denar note and want to pay with it.",
        "You don't know any of the prices."
      ],
      "targetPhrases": [
        {
          "text": "Добровечер! Едно пиво и еден сок, ве молам.",
          "gloss": "Good evening! One beer and one juice, please.",
          "translit": "Dobar vecher! Edno pivo i eden sok, ve molam."
        },
        {
          "text": "Колку чини?",
          "gloss": "How much is it?",
          "translit": "Kolku chini?"
        },
        {
          "text": "Еве петстотини денари.",
          "gloss": "Here is five hundred denars.",
          "translit": "Eve petstotini denari."
        },
        {
          "text": "Наздравје!",
          "gloss": "Cheers! (to health)",
          "translit": "Na zdravje!"
        }
      ]
    },
    "roleB": {
      "role": "B",
      "brief": "You're the bartender. Greet, take the order, give the prices and total, take the money, and toast back.",
      "secretInfo": [
        "A beer costs 90 denars.",
        "A juice costs 60 denars.",
        "You must give back change from the customer's note."
      ],
      "targetPhrases": [
        {
          "text": "Добровечер! Повелете, што сакате?",
          "gloss": "Good evening! Go ahead, what would you like?",
          "translit": "Dobar vecher! Povelete, shto sakate?"
        },
        {
          "text": "Пивото е 90, сокот е 60 денари.",
          "gloss": "The beer is 90, the juice is 60 denars.",
          "translit": "Pivoto e 90, sokot e 60 denari."
        },
        {
          "text": "Вкупно е 150 денари.",
          "gloss": "The total is 150 denars.",
          "translit": "Vkupno e 150 denari."
        },
        {
          "text": "Еве кусур, на здравје!",
          "gloss": "Here's the change, cheers!",
          "translit": "Eve kusur, na zdravje!"
        }
      ]
    },
    "successCriteria": [
      {
        "id": "greet",
        "description": "Both partners greeted each other."
      },
      {
        "id": "order",
        "description": "The customer ordered one beer and one juice."
      },
      {
        "id": "price",
        "description": "The bartender gave the prices and the total (150 denars)."
      },
      {
        "id": "pay-toast",
        "description": "The customer paid with the 500-denar note, got change, and they toasted."
      }
    ],
    "confidence": "validated"
  },
  {
    "id": "gen-s1-market-gap",
    "title": "At the market (info-gap)",
    "goal": "Buy the fruit and agree the total — each of you knows only half.",
    "setting": "A small fruit stall at the pazar (open-air market).",
    "roleA": {
      "role": "A",
      "brief": "You're the customer. Say what you want, give the quantity, ask the price, and buy.",
      "secretInfo": [
        "You want one kilo of apples and half a kilo of tomatoes.",
        "You have 150 denars — make sure the total fits."
      ],
      "targetPhrases": [
        {
          "text": "Сакам едно кило јаболка и половина кило домати.",
          "gloss": "I want one kilo of apples and half a kilo of tomatoes.",
          "translit": "Sakam edno kilo jabolka i polovina kilo domati."
        },
        {
          "text": "Колку чини килото?",
          "gloss": "How much is a kilo?",
          "translit": "Kolku chini kiloto?"
        },
        {
          "text": "Во ред, ќе земам. Колку е сè заедно?",
          "gloss": "OK, I'll take it. How much is it all together?",
          "translit": "Vo red, kje zemam. Kolku e se zaedno?"
        }
      ]
    },
    "roleB": {
      "role": "B",
      "brief": "You're the seller. Take the order, tell the prices per kilo, then give the total.",
      "secretInfo": [
        "Apples cost 40 denars per kilo.",
        "Tomatoes cost 60 denars per kilo (so half a kilo is 30).",
        "The total comes to 70 denars."
      ],
      "targetPhrases": [
        {
          "text": "Повелете, што сакате?",
          "gloss": "Go ahead, what would you like?",
          "translit": "Povelete, shto sakate?"
        },
        {
          "text": "Јаболката се 40 денари килото, доматите се 60.",
          "gloss": "Apples are 40 denars a kilo, tomatoes are 60.",
          "translit": "Jabolkata se 40 denari kiloto, domatite se 60."
        },
        {
          "text": "Вкупно е 70 денари.",
          "gloss": "The total is 70 denars.",
          "translit": "Vkupno e 70 denari."
        }
      ]
    },
    "successCriteria": [
      {
        "id": "order",
        "description": "The customer requested the items and quantities (one kilo apples, half a kilo tomatoes)."
      },
      {
        "id": "prices",
        "description": "The seller gave the price per kilo for each item."
      },
      {
        "id": "total",
        "description": "You agreed the total — 70 denars."
      },
      {
        "id": "buy",
        "description": "The customer confirmed the purchase and that it fits the budget."
      }
    ],
    "confidence": "validated"
  },
  {
    "id": "gen-s1-directions-gap",
    "title": "Where is the bus stop? (info-gap)",
    "goal": "Find the bus stop and agree how to get there — each of you knows only half.",
    "setting": "A street in the city",
    "roleA": {
      "role": "A",
      "brief": "You're a visitor. Ask where the bus stop is, understand the directions, and ask which bus to take.",
      "secretInfo": [
        "You are looking for the bus stop.",
        "You don't know the way or which bus goes to the centre.",
        "You want to get to the city centre."
      ],
      "targetPhrases": [
        {
          "text": "Извинете, каде е автобуската станица?",
          "gloss": "Excuse me, where is the bus stop?",
          "translit": "Izvinete, kade e avtobuskata stanica?"
        },
        {
          "text": "Дали е близу или далеку?",
          "gloss": "Is it near or far?",
          "translit": "Dali e blizu ili daleku?"
        },
        {
          "text": "Кој автобус оди до центарот?",
          "gloss": "Which bus goes to the centre?",
          "translit": "Koj avtobus odi do centarot?"
        }
      ]
    },
    "roleB": {
      "role": "B",
      "brief": "You're a local. Tell the visitor the way to the bus stop and which bus to take.",
      "secretInfo": [
        "The bus stop is near — go straight, then left.",
        "It is close, not far.",
        "Bus number 5 goes to the centre."
      ],
      "targetPhrases": [
        {
          "text": "Одете право, потоа лево.",
          "gloss": "Go straight, then left.",
          "translit": "Odete pravo, potoa levo."
        },
        {
          "text": "Близу е, не е далеку.",
          "gloss": "It's near, it's not far.",
          "translit": "Blizu e, ne e daleku."
        },
        {
          "text": "Автобус број пет оди до центарот.",
          "gloss": "Bus number five goes to the centre.",
          "translit": "Avtobus broj pet odi do centarot."
        }
      ]
    },
    "successCriteria": [
      {
        "id": "ask",
        "description": "The visitor asked where the bus stop is."
      },
      {
        "id": "directions",
        "description": "The local gave directions (straight, then left) and said it's near."
      },
      {
        "id": "bus",
        "description": "The visitor learned which bus (number 5) goes to the centre."
      },
      {
        "id": "confirm",
        "description": "The visitor confirmed understanding the way and the bus."
      }
    ],
    "confidence": "validated"
  }
];

