// MACHINE-GENERATED (Opus 4.8), confidence: "unreviewed" — GATED, not served until Jake spot-checks.
// 4 scenarios, 24 vocab. Validator flagged 0 item(s) (see validatorReport).
import type { Scenario, ReviewItem } from "@ll/pack-schema";

export const generatedScenarios: Scenario[] = [
  {
    "id": "gen-directions",
    "title": "Asking for directions",
    "goal": "Ask where a place is and understand the answer.",
    "setting": "a street in Skopje",
    "theme": "Out & about",
    "requiredVocab": [
      "gen-directions-v1",
      "gen-directions-v2",
      "gen-directions-v3",
      "gen-directions-v4",
      "gen-directions-v5",
      "gen-directions-v6"
    ],
    "requiredStructures": [],
    "script": [
      {
        "speaker": "learner",
        "text": "Извинете, каде е плоштадот?",
        "gloss": "Excuse me, where is the square?",
        "translit": "Izvinete, kade e ploshtadot?",
        "satisfies": [
          "asked-location"
        ]
      },
      {
        "speaker": "partner",
        "text": "Здраво! Плоштадот е право, потоа лево.",
        "gloss": "Hi! The square is straight ahead, then left."
      },
      {
        "speaker": "learner",
        "text": "Дали е далеку?",
        "gloss": "Is it far?",
        "translit": "Dali e daleku?",
        "satisfies": [
          "asked-distance"
        ]
      },
      {
        "speaker": "partner",
        "text": "Не, близу е. Пет минути пешки.",
        "gloss": "No, it's near. Five minutes on foot."
      },
      {
        "speaker": "learner",
        "text": "Право и потоа лево, така?",
        "gloss": "Straight and then left, right?",
        "translit": "Pravo i potoa levo, taka?",
        "satisfies": [
          "confirmed"
        ]
      },
      {
        "speaker": "partner",
        "text": "Точно. Не можеш да промашиш.",
        "gloss": "Exactly. You can't miss it."
      },
      {
        "speaker": "learner",
        "text": "Благодарам многу!",
        "gloss": "Thank you very much!",
        "translit": "Blagodaram mnogu!",
        "satisfies": [
          "thanked"
        ]
      },
      {
        "speaker": "partner",
        "text": "Нема на што. Пријатно!",
        "gloss": "You're welcome. Have a nice day!"
      }
    ],
    "successCriteria": [
      {
        "id": "asked-location",
        "description": "Asked where a place is"
      },
      {
        "id": "asked-distance",
        "description": "Asked if it is far"
      },
      {
        "id": "confirmed",
        "description": "Confirmed the directions"
      },
      {
        "id": "thanked",
        "description": "Thanked the person"
      }
    ],
    "confidence": "unreviewed"
  },
  {
    "id": "gen-shopping",
    "title": "Buying something at a shop",
    "goal": "Ask for an item, ask the price, and pay.",
    "setting": "a small shop",
    "theme": "Out & about",
    "requiredVocab": [
      "gen-shopping-v1",
      "gen-shopping-v2",
      "gen-shopping-v3",
      "gen-shopping-v4",
      "gen-shopping-v5",
      "gen-shopping-v6"
    ],
    "requiredStructures": [],
    "script": [
      {
        "speaker": "partner",
        "text": "Добар ден! Изволете?",
        "gloss": "Good day! Can I help you?"
      },
      {
        "speaker": "learner",
        "text": "Добар ден! Сакам леб, ве молам.",
        "gloss": "Good day! I want bread, please.",
        "translit": "Dobar den! Sakam leb, ve molam.",
        "satisfies": [
          "greeted",
          "asked-item"
        ]
      },
      {
        "speaker": "partner",
        "text": "Секако. Уште нешто?",
        "gloss": "Of course. Anything else?"
      },
      {
        "speaker": "learner",
        "text": "Едно млеко. Колку чини?",
        "gloss": "One milk. How much is it?",
        "translit": "Edno mleko. Kolku chini?",
        "satisfies": [
          "asked-price"
        ]
      },
      {
        "speaker": "partner",
        "text": "Сто и дваесет денари.",
        "gloss": "A hundred and twenty denars."
      },
      {
        "speaker": "learner",
        "text": "Повелете. Благодарам!",
        "gloss": "Here you are. Thank you!",
        "translit": "Povelete. Blagodaram!",
        "satisfies": [
          "paid"
        ]
      },
      {
        "speaker": "partner",
        "text": "Благодарам и вие! Пријатен ден.",
        "gloss": "Thank you too! Have a nice day."
      }
    ],
    "successCriteria": [
      {
        "id": "greeted",
        "description": "Greeted the shopkeeper"
      },
      {
        "id": "asked-item",
        "description": "Asked for an item"
      },
      {
        "id": "asked-price",
        "description": "Asked the price"
      },
      {
        "id": "paid",
        "description": "Paid / handed over the money"
      }
    ],
    "confidence": "unreviewed"
  },
  {
    "id": "gen-introductions",
    "title": "Introducing yourself",
    "goal": "Say your name, where you're from, and what you do.",
    "setting": "meeting someone new",
    "theme": "Meeting people",
    "requiredVocab": [
      "gen-introductions-v1",
      "gen-introductions-v2",
      "gen-introductions-v3",
      "gen-introductions-v4",
      "gen-introductions-v5",
      "gen-introductions-v6"
    ],
    "requiredStructures": [],
    "script": [
      {
        "speaker": "partner",
        "text": "Здраво! Јас сум Ана. Како се викаш?",
        "gloss": "Hi! I'm Ana. What's your name?"
      },
      {
        "speaker": "learner",
        "text": "Здраво! Јас се викам Марко.",
        "gloss": "Hi! My name is Marko.",
        "translit": "Zdravo! Jas se vikam Marko.",
        "satisfies": [
          "greeted",
          "said-name"
        ]
      },
      {
        "speaker": "partner",
        "text": "Драго ми е! Од каде си?",
        "gloss": "Nice to meet you! Where are you from?"
      },
      {
        "speaker": "learner",
        "text": "Јас сум од Англија.",
        "gloss": "I'm from England.",
        "translit": "Jas sum od Anglija.",
        "satisfies": [
          "said-origin"
        ]
      },
      {
        "speaker": "partner",
        "text": "Супер! А што работиш?",
        "gloss": "Great! And what do you do?"
      },
      {
        "speaker": "learner",
        "text": "Јас сум студент.",
        "gloss": "I'm a student.",
        "translit": "Jas sum student.",
        "satisfies": [
          "said-job"
        ]
      },
      {
        "speaker": "partner",
        "text": "Одлично! Добредојде во Скопје.",
        "gloss": "Excellent! Welcome to Skopje."
      },
      {
        "speaker": "learner",
        "text": "Благодарам! Драго ми е.",
        "gloss": "Thank you! Nice to meet you.",
        "translit": "Blagodaram! Drago mi e.",
        "satisfies": [
          "greeted"
        ]
      }
    ],
    "successCriteria": [
      {
        "id": "greeted",
        "description": "Greeted the other person"
      },
      {
        "id": "said-name",
        "description": "Said your name"
      },
      {
        "id": "said-origin",
        "description": "Said where you're from"
      },
      {
        "id": "said-job",
        "description": "Said what you do"
      }
    ],
    "confidence": "unreviewed"
  },
  {
    "id": "gen-phone",
    "title": "A short phone call",
    "goal": "Greet, ask for someone, and leave a short message.",
    "setting": "a phone call",
    "theme": "Out & about",
    "requiredVocab": [
      "gen-phone-v1",
      "gen-phone-v2",
      "gen-phone-v3",
      "gen-phone-v4",
      "gen-phone-v5",
      "gen-phone-v6"
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
        "text": "Здраво! Дали е Марко таму?",
        "gloss": "Hi! Is Marko there?",
        "translit": "Zdravo! Dali e Marko tamu?",
        "satisfies": [
          "greeted",
          "asked-for-someone"
        ]
      },
      {
        "speaker": "partner",
        "text": "Не, Марко не е тука сега.",
        "gloss": "No, Marko is not here now."
      },
      {
        "speaker": "learner",
        "text": "Може ли да оставам порака?",
        "gloss": "Can I leave a message?",
        "translit": "Mozhe li da ostavam poraka?",
        "satisfies": [
          "left-message"
        ]
      },
      {
        "speaker": "partner",
        "text": "Секако. Кажете.",
        "gloss": "Of course. Go ahead."
      },
      {
        "speaker": "learner",
        "text": "Јас сум Ана. Ве молам, нека ме повика.",
        "gloss": "I am Ana. Please, have him call me.",
        "translit": "Jas sum Ana. Ve molam, neka me povika.",
        "satisfies": [
          "left-message"
        ]
      },
      {
        "speaker": "partner",
        "text": "Во ред. Ќе му кажам.",
        "gloss": "All right. I will tell him."
      },
      {
        "speaker": "learner",
        "text": "Благодарам! Пријатно.",
        "gloss": "Thank you! Have a nice day.",
        "translit": "Blagodaram! Prijatno.",
        "satisfies": [
          "said-bye"
        ]
      }
    ],
    "successCriteria": [
      {
        "id": "greeted",
        "description": "Greeted the person on the phone"
      },
      {
        "id": "asked-for-someone",
        "description": "Asked for a specific person"
      },
      {
        "id": "left-message",
        "description": "Left a short message"
      },
      {
        "id": "said-bye",
        "description": "Said goodbye / thanks"
      }
    ],
    "confidence": "unreviewed"
  }
];

export const generatedVocab: ReviewItem[] = [
  {
    "id": "gen-directions-v1",
    "kind": "phrase",
    "prompt": "where is",
    "answer": "каде е",
    "translit": "kade e",
    "gloss": "where is",
    "i1Level": 2,
    "tags": [
      "generated",
      "directions"
    ],
    "confidence": "unreviewed"
  },
  {
    "id": "gen-directions-v2",
    "kind": "phrase",
    "prompt": "the square",
    "answer": "плоштадот",
    "translit": "ploshtadot",
    "gloss": "the square",
    "i1Level": 2,
    "tags": [
      "generated",
      "directions"
    ],
    "confidence": "unreviewed"
  },
  {
    "id": "gen-directions-v3",
    "kind": "phrase",
    "prompt": "straight ahead",
    "answer": "право",
    "translit": "pravo",
    "gloss": "straight ahead",
    "i1Level": 2,
    "tags": [
      "generated",
      "directions"
    ],
    "confidence": "unreviewed"
  },
  {
    "id": "gen-directions-v4",
    "kind": "phrase",
    "prompt": "left",
    "answer": "лево",
    "translit": "levo",
    "gloss": "left",
    "i1Level": 2,
    "tags": [
      "generated",
      "directions"
    ],
    "confidence": "unreviewed"
  },
  {
    "id": "gen-directions-v5",
    "kind": "phrase",
    "prompt": "far",
    "answer": "далеку",
    "translit": "daleku",
    "gloss": "far",
    "i1Level": 2,
    "tags": [
      "generated",
      "directions"
    ],
    "confidence": "unreviewed"
  },
  {
    "id": "gen-directions-v6",
    "kind": "phrase",
    "prompt": "near",
    "answer": "близу",
    "translit": "blizu",
    "gloss": "near",
    "i1Level": 2,
    "tags": [
      "generated",
      "directions"
    ],
    "confidence": "unreviewed"
  },
  {
    "id": "gen-shopping-v1",
    "kind": "phrase",
    "prompt": "I want",
    "answer": "сакам",
    "translit": "sakam",
    "gloss": "I want",
    "i1Level": 2,
    "tags": [
      "generated",
      "shopping"
    ],
    "confidence": "unreviewed"
  },
  {
    "id": "gen-shopping-v2",
    "kind": "phrase",
    "prompt": "bread",
    "answer": "леб",
    "translit": "leb",
    "gloss": "bread",
    "i1Level": 2,
    "tags": [
      "generated",
      "shopping"
    ],
    "confidence": "unreviewed"
  },
  {
    "id": "gen-shopping-v3",
    "kind": "phrase",
    "prompt": "milk",
    "answer": "млеко",
    "translit": "mleko",
    "gloss": "milk",
    "i1Level": 2,
    "tags": [
      "generated",
      "shopping"
    ],
    "confidence": "unreviewed"
  },
  {
    "id": "gen-shopping-v4",
    "kind": "phrase",
    "prompt": "how much is it?",
    "answer": "колку чини?",
    "translit": "kolku chini?",
    "gloss": "how much is it?",
    "i1Level": 2,
    "tags": [
      "generated",
      "shopping"
    ],
    "confidence": "unreviewed"
  },
  {
    "id": "gen-shopping-v5",
    "kind": "phrase",
    "prompt": "here you are / go ahead",
    "answer": "повелете",
    "translit": "povelete",
    "gloss": "here you are / go ahead",
    "i1Level": 2,
    "tags": [
      "generated",
      "shopping"
    ],
    "confidence": "unreviewed"
  },
  {
    "id": "gen-shopping-v6",
    "kind": "phrase",
    "prompt": "thank you",
    "answer": "благодарам",
    "translit": "blagodaram",
    "gloss": "thank you",
    "i1Level": 2,
    "tags": [
      "generated",
      "shopping"
    ],
    "confidence": "unreviewed"
  },
  {
    "id": "gen-introductions-v1",
    "kind": "phrase",
    "prompt": "What's your name?",
    "answer": "Како се викаш?",
    "translit": "Kako se vikash?",
    "gloss": "What's your name?",
    "i1Level": 2,
    "tags": [
      "generated",
      "introductions"
    ],
    "confidence": "unreviewed"
  },
  {
    "id": "gen-introductions-v2",
    "kind": "phrase",
    "prompt": "My name is...",
    "answer": "Јас се викам...",
    "translit": "Jas se vikam...",
    "gloss": "My name is...",
    "i1Level": 2,
    "tags": [
      "generated",
      "introductions"
    ],
    "confidence": "unreviewed"
  },
  {
    "id": "gen-introductions-v3",
    "kind": "phrase",
    "prompt": "Where are you from?",
    "answer": "Од каде си?",
    "translit": "Od kade si?",
    "gloss": "Where are you from?",
    "i1Level": 2,
    "tags": [
      "generated",
      "introductions"
    ],
    "confidence": "unreviewed"
  },
  {
    "id": "gen-introductions-v4",
    "kind": "phrase",
    "prompt": "I'm from...",
    "answer": "Јас сум од...",
    "translit": "Jas sum od...",
    "gloss": "I'm from...",
    "i1Level": 2,
    "tags": [
      "generated",
      "introductions"
    ],
    "confidence": "unreviewed"
  },
  {
    "id": "gen-introductions-v5",
    "kind": "phrase",
    "prompt": "student",
    "answer": "студент",
    "translit": "student",
    "gloss": "student",
    "i1Level": 2,
    "tags": [
      "generated",
      "introductions"
    ],
    "confidence": "unreviewed"
  },
  {
    "id": "gen-introductions-v6",
    "kind": "phrase",
    "prompt": "Nice to meet you",
    "answer": "Драго ми е",
    "translit": "Drago mi e",
    "gloss": "Nice to meet you",
    "i1Level": 2,
    "tags": [
      "generated",
      "introductions"
    ],
    "confidence": "unreviewed"
  },
  {
    "id": "gen-phone-v1",
    "kind": "phrase",
    "prompt": "Hello? (on phone)",
    "answer": "Ало?",
    "translit": "Alo?",
    "gloss": "Hello? (on phone)",
    "i1Level": 2,
    "tags": [
      "generated",
      "phone"
    ],
    "confidence": "unreviewed"
  },
  {
    "id": "gen-phone-v2",
    "kind": "phrase",
    "prompt": "Is ... there?",
    "answer": "Дали е ... таму?",
    "translit": "Dali e ... tamu?",
    "gloss": "Is ... there?",
    "i1Level": 2,
    "tags": [
      "generated",
      "phone"
    ],
    "confidence": "unreviewed"
  },
  {
    "id": "gen-phone-v3",
    "kind": "phrase",
    "prompt": "message",
    "answer": "порака",
    "translit": "poraka",
    "gloss": "message",
    "i1Level": 2,
    "tags": [
      "generated",
      "phone"
    ],
    "confidence": "unreviewed"
  },
  {
    "id": "gen-phone-v4",
    "kind": "phrase",
    "prompt": "to leave a message",
    "answer": "да оставам порака",
    "translit": "da ostavam poraka",
    "gloss": "to leave a message",
    "i1Level": 2,
    "tags": [
      "generated",
      "phone"
    ],
    "confidence": "unreviewed"
  },
  {
    "id": "gen-phone-v5",
    "kind": "phrase",
    "prompt": "have him call me",
    "answer": "нека ме повика",
    "translit": "neka me povika",
    "gloss": "have him call me",
    "i1Level": 2,
    "tags": [
      "generated",
      "phone"
    ],
    "confidence": "unreviewed"
  },
  {
    "id": "gen-phone-v6",
    "kind": "phrase",
    "prompt": "Have a nice day / goodbye",
    "answer": "Пријатно",
    "translit": "Prijatno",
    "gloss": "Have a nice day / goodbye",
    "i1Level": 2,
    "tags": [
      "generated",
      "phone"
    ],
    "confidence": "unreviewed"
  }
];

export const validatorReport = [
  {
    "itemId": "gen-directions-l1",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-directions-l2",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-directions-l3",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-directions-l4",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-directions-v1",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-directions-v2",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-directions-v3",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-directions-v4",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-directions-v5",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-directions-v6",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-shopping-l1",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-shopping-l2",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-shopping-l3",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-shopping-v1",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-shopping-v2",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-shopping-v3",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-shopping-v4",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-shopping-v5",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-shopping-v6",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-introductions-l1",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-introductions-l2",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-introductions-l3",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-introductions-l4",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-introductions-v1",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-introductions-v2",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-introductions-v3",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-introductions-v4",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-introductions-v5",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-introductions-v6",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-phone-l1",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-phone-l2",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-phone-l3",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-phone-l4",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-phone-v1",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-phone-v2",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-phone-v3",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-phone-v4",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-phone-v5",
    "ok": true,
    "issues": []
  },
  {
    "itemId": "gen-phone-v6",
    "ok": true,
    "issues": []
  }
] as const;
