// Corrections to the older stories (2026-10-16, Jake: a story "all over the place, hard to follow", English
// that didn't match the Macedonian). Applied over the generated / authored stories in index.ts, so those files
// stay as generated. The rule: every spoken line names its speaker IN the Macedonian (a label, or narration
// like „…“ вели Ана), and the English translates exactly the Macedonian — nothing added.
export interface StoryFix {
  why: string;
  title?: string;
  lines?: Record<number, { text: string; translit: string; gloss: string }>;
  qa?: Record<string, { question?: string; questionGloss?: string; answer?: string; answerGloss?: string; answerTranslit?: string }>;
}

export const storyFixes: Record<string, StoryFix> = {
  "ana-coffee": {
    "why": "one word for “waiter” (келнер, as everywhere else)",
    "lines": {
      "3": {
        "text": "Келнерот вели: „Повелете.“",
        "translit": "Kelnerot veli: Povelete.",
        "gloss": "The waiter says: \"Here you go.\""
      }
    }
  },
  "gen-s0-repair-story": {
    "why": "say who's speaking",
    "lines": {
      "2": {
        "text": "Ана: „Извинете, не разбирам.“",
        "translit": "Ana: Izvinete, ne razbiram.",
        "gloss": "Ana: \"Excuse me, I don't understand.\""
      },
      "3": {
        "text": "Ана: „Побавно, ве молам.“",
        "translit": "Ana: Pobavno, ve molam.",
        "gloss": "Ana: \"Slower, please.\""
      },
      "5": {
        "text": "Ана: „Можете ли да повторите?“",
        "translit": "Ana: Mozhete li da povtorite?",
        "gloss": "Ana: \"Can you repeat?\""
      },
      "6": {
        "text": "Ана: „Аха. Што значи 'фала'?“",
        "translit": "Ana: Aha. Shto znachi 'fala'?",
        "gloss": "Ana: \"Uh-huh. What does 'fala' mean?\""
      }
    }
  },
  "gen-s0-greet-story": {
    "why": "say who's speaking",
    "lines": {
      "1": {
        "text": "Ана: „Здраво, Марко! Како си?“",
        "translit": "Ana: Zdravo, Marko! Kako si?",
        "gloss": "Ana: \"Hi, Marko! How are you?\""
      },
      "2": {
        "text": "Марко: „Добро сум, фала. А ти?“",
        "translit": "Marko: Dobro sum, fala. A ti?",
        "gloss": "Marko: \"I'm well, thanks. And you?\""
      },
      "3": {
        "text": "Ана: „Добро сум.“",
        "translit": "Ana: Dobro sum.",
        "gloss": "Ana: \"I'm well.\""
      },
      "6": {
        "text": "Марко: „Чај?“ Ана: „Не, фала.“",
        "translit": "Marko: Chay? Ana: Ne, fala.",
        "gloss": "Marko: \"Tea?\" Ana: \"No, thanks.\""
      },
      "7": {
        "text": "Марко: „Пријатно, Ана!“ Ана: „Догледање, Марко!“",
        "translit": "Marko: Priyatno, Ana! Ana: Dogledanje, Marko!",
        "gloss": "Marko: \"Take care, Ana!\" Ana: \"Goodbye, Marko!\""
      }
    }
  },
  "gen-s0-survive-story": {
    "why": "say who's speaking",
    "lines": {
      "1": {
        "text": "Ана: „Добар ден! Сакам јаболка.“",
        "translit": "Ana: Dobar den! Sakam yabolka.",
        "gloss": "Ana: \"Good day! I want apples.\""
      },
      "2": {
        "text": "Ана: „Имате ли јаболка?“",
        "translit": "Ana: Imate li yabolka?",
        "gloss": "Ana: \"Do you have apples?\""
      },
      "5": {
        "text": "Ана: „Сакам пет јаболка и еден леб.“",
        "translit": "Ana: Sakam pet yabolka i eden leb.",
        "gloss": "Ana: \"I want five apples and one bread.\""
      },
      "6": {
        "text": "Ана: „Колку чини ова?“",
        "translit": "Ana: Kolku chini ova?",
        "gloss": "Ana: \"How much is this?\""
      }
    }
  },
  "gen-s1-cafe-order-story": {
    "why": "кафето is “the coffee”; the café is кафулето",
    "title": "Марко во кафулето"
  },
  "gen-s1-greet-intro-story": {
    "why": "say who's speaking",
    "lines": {
      "3": {
        "text": "Ана: „Јас сум Ана. Мило ми е.“",
        "translit": "Ana: Yas sum Ana. Milo mi e.",
        "gloss": "Ana: \"I am Ana. Nice to meet you.\""
      },
      "5": {
        "text": "Ана: „Од Англија сум. Учам македонски.“",
        "translit": "Ana: Od Angliya sum. Ucham makedonski.",
        "gloss": "Ana: \"I'm from England. I'm learning Macedonian.\""
      },
      "7": {
        "text": "Марко: „Јас сум доктор. Зборувам малку англиски.“",
        "translit": "Marko: Yas sum doktor. Zboruvam malku angliski.",
        "gloss": "Marko: \"I am a doctor. I speak a little English.\""
      }
    }
  },
  "gen-s1-market-story": {
    "why": "say who's speaking",
    "lines": {
      "1": {
        "text": "Ана: „Добар ден! Сакам леб.“",
        "translit": "Ana: Dobar den! Sakam leb.",
        "gloss": "Ana: \"Good day! I'd like bread.\""
      },
      "4": {
        "text": "Ана: „Сакам едно кило јаболка. Колку чини?“",
        "translit": "Ana: Sakam edno kilo yabolka. Kolku chini?",
        "gloss": "Ana: \"I'd like a kilo of apples. How much is it?\""
      },
      "5": {
        "text": "Продавачот: „Педесет денари.“",
        "translit": "Prodavachot: Pedeset denari.",
        "gloss": "The seller: \"Fifty denars.\""
      },
      "6": {
        "text": "Ана: „Сакам и половина кило сирење.“",
        "translit": "Ana: Sakam i polovina kilo sirenje.",
        "gloss": "Ana: \"I'd also like half a kilo of cheese.\""
      },
      "7": {
        "text": "Ана: „Само тоа, фала.“",
        "translit": "Ana: Samo toa, fala.",
        "gloss": "Ana: \"That's all, thanks.\""
      }
    }
  },
  "gen-s1-directions-story": {
    "why": "say who's speaking",
    "lines": {
      "3": {
        "text": "Човекот: „Потоа одете право. Тоа е близу.“",
        "translit": "Chovekot: Potoa odete pravo. Toa e blizu.",
        "gloss": "The man: \"Then go straight ahead. It is near.\""
      }
    }
  },
  "gen-s2-arrange-story": {
    "why": "a phone call with nobody named was hard to follow",
    "lines": {
      "1": {
        "text": "Марко: „Ало? Дома ли е Ана?“",
        "translit": "Marko: Alo? Doma li e Ana?",
        "gloss": "Marko: \"Hello? Is Ana home?\""
      },
      "2": {
        "text": "Ана: „Да, јас сум. Здраво, Марко!“",
        "translit": "Ana: Da, yas sum. Zdravo, Marko!",
        "gloss": "Ana: \"Yes, it's me. Hi, Marko!\""
      },
      "3": {
        "text": "Марко: „Ајде да се видиме денес.“",
        "translit": "Marko: Ayde da se vidime denes.",
        "gloss": "Marko: \"Let's meet today.\""
      },
      "4": {
        "text": "Ана: „Кога? Во колку часот?“",
        "translit": "Ana: Koga? Vo kolku chasot?",
        "gloss": "Ana: \"When? At what time?\""
      },
      "5": {
        "text": "Марко: „Во шест часот. Каде да се видиме?“",
        "translit": "Marko: Vo shest chasot. Kade da se vidime?",
        "gloss": "Marko: \"At six o'clock. Where shall we meet?\""
      },
      "6": {
        "text": "Ана: „Ајде во кафулето кај плоштадот.“",
        "translit": "Ana: Ayde vo kafuleto kay ploshtadot.",
        "gloss": "Ana: \"Let's go to the café by the square.\""
      },
      "7": {
        "text": "Марко: „Важи! Договорено.“",
        "translit": "Marko: Vazhi! Dogovoreno.",
        "gloss": "Marko: \"Deal! Agreed.\""
      }
    }
  },
  "gen-s2-problems-story": {
    "why": "say who's speaking; the answer names what's returned",
    "lines": {
      "1": {
        "text": "Марко: „Извинете, ама има проблем.“",
        "translit": "Marko: Izvinete, ama ima problem.",
        "gloss": "Marko: \"Sorry, but there's a problem.\""
      },
      "2": {
        "text": "Марко: „Ова не е моето кафе.“",
        "translit": "Marko: Ova ne e moeto kafe.",
        "gloss": "Marko: \"This isn't my coffee.\""
      },
      "3": {
        "text": "Марко: „Сметката е погрешна.“",
        "translit": "Marko: Smetkata e pogreshna.",
        "gloss": "Marko: \"The bill is wrong.\""
      },
      "4": {
        "text": "Марко: „Не разбирам зошто.“",
        "translit": "Marko: Ne razbiram zoshto.",
        "gloss": "Marko: \"I don't understand why.\""
      },
      "5": {
        "text": "Марко: „Можете ли да помогнете?“",
        "translit": "Marko: Mozhete li da pomognete?",
        "gloss": "Marko: \"Can you help?\""
      },
      "6": {
        "text": "Марко: „Сакам да вратам ова кафе.“",
        "translit": "Marko: Sakam da vratam ova kafe.",
        "gloss": "Marko: \"I'd like to return this coffee.\""
      },
      "7": {
        "text": "Жената вели: „Се извинувам, веднаш!“",
        "translit": "Zhenata veli: Se izvinuvam, vednash!",
        "gloss": "The woman says: \"I'm sorry, right away!\""
      }
    },
    "qa": {
      "q3": {
        "answer": "Сакам да го вратам кафето.",
        "answerGloss": "I'd like to return the coffee.",
        "answerTranslit": "Sakam da go vratam kafeto."
      }
    }
  },
  "gen-s2-pasttime-story": {
    "why": "the story says во паркот",
    "qa": {
      "q1": {
        "answer": "Во паркот.",
        "answerGloss": "To the park.",
        "answerTranslit": "Vo parkot."
      },
      "q2": {
        "question": "Што јадеше Марко во паркот?",
        "questionGloss": "What did Marko eat in the park?"
      }
    }
  },
  "gen-s2-home-family-story": {
    "why": "a whole answer, not a fragment",
    "qa": {
      "q2": {
        "answer": "Работи како доктор.",
        "answerGloss": "She works as a doctor.",
        "answerTranslit": "Raboti kako doktor."
      }
    }
  }
};
