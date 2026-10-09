// HAND-AUTHORED midterm (after chapter 6) and final (after chapter 12), 2026-10-09 — Jake's spec: open book,
// speaking AND writing, not a gate (the learner leaves with a review list). Each exam names what you should
// be able to do by then (can-dos, drawn from the chapters' conversations and grammar), then sets situations
// that use them. Model answers are EXISTING lines (their audio is already cached); apps/web/test checks every
// model line's text against its source, and every can-do / point / chapter id.
import type { CourseExam } from "@ll/pack-schema";

export const exams: CourseExam[] = [
  {
    id: "midterm",
    afterChapterId: "s1-market",
    title: "Midterm · A morning in Skopje",
    intro: "Halfway. This checks you can get through an ordinary morning: meet someone, order, shop, and keep going when you don't catch something. It's open book: each task starts with a prep screen with the grammar and words you'll need, and you can take as long as you like there. Say or write it your own way; there's no one right answer. Whatever happens, the course carries on, and you'll get a short list of what to look at again.",
    canDos: [
      { id: "m-repair", text: "Keep going when you don't understand: ask someone to repeat, slow down, or explain a word", chapterIds: ["s0-repair"], pointIds: ["pt-ne"] },
      { id: "m-greet", text: "Greet someone, ask how they are and say goodbye, casually (ти) or politely (вие)", chapterIds: ["s0-greet"], pointIds: ["pt-sum", "pt-ti-vie"] },
      { id: "m-ask", text: "Ask what, where and how much, and yes/no questions with ли", chapterIds: ["s0-greet"], pointIds: ["pt-question-words", "pt-yes-no"] },
      { id: "m-buy", text: "Buy something small: ask if they have it and what it costs, and understand the price", chapterIds: ["s0-survive"], pointIds: ["pt-gender", "pt-numbers"] },
      { id: "m-cafe", text: "Order at a café and pay, saying what you want", chapterIds: ["s1-cafe-order"], pointIds: ["pt-verbs-a", "pt-the", "pt-da"] },
      { id: "m-intro", text: "Introduce yourself: your name, where you're from, what you do, and that you're learning Macedonian", chapterIds: ["s1-greet-intro"], pointIds: ["pt-sum", "pt-verbs-e-i", "pt-se"] },
      { id: "m-market", text: "Shop at the market: how much of something, more than one, cheap or expensive, and “I'll take them”", chapterIds: ["s1-market"], pointIds: ["pt-plurals", "pt-adjectives", "pt-go-ja-gi"] },
    ],
    tasks: [
      {
        id: "m-s-meet", mode: "speak", title: "Meet someone at the café",
        scene: "You sit down at a café in Skopje next to someone your age. Start a conversation.",
        steps: ["Say hello and ask how they are", "Say your name and ask theirs", "Say where you're from and that you're learning Macedonian", "Say what you do (your job, or that you're a student)"],
        canDoIds: ["m-greet", "m-intro"], pointIds: ["pt-sum", "pt-se", "pt-ti-vie", "pt-verbs-e-i"],
        model: [
          { text: "Здраво! Јас сум Ана. А ти?", gloss: "Hi! I am Ana. And you?", source: "scenario:gen-s1-greet-intro#1" },
          { text: "Мило ми е! Од каде си?", gloss: "Nice to meet you! Where are you from?", source: "scenario:gen-s1-greet-intro#3" },
          { text: "Од Лондон сум. Учам македонски.", gloss: "I'm from London. I'm learning Macedonian.", source: "scenario:gen-s1-greet-intro#5" },
          { text: "Јас сум учителка.", gloss: "I am a teacher.", source: "scenario:gen-s1-greet-intro#7" },
        ],
      },
      {
        id: "m-s-order", mode: "speak", title: "Order and pay",
        scene: "The waiter comes over. You're with a friend, and you want something to drink for both of you.",
        steps: ["Greet the waiter and order two drinks, politely", "Ask how much it is", "You didn't catch the price: say so, and ask them to repeat it more slowly", "Ask for the bill"],
        canDoIds: ["m-cafe", "m-repair", "m-ask", "m-buy"], pointIds: ["pt-gender", "pt-numbers", "pt-the", "pt-ne"],
        model: [
          { text: "Добар ден! Едно кафе, ве молам.", gloss: "Good day! One coffee, please.", source: "scenario:gen-s1-cafe-order#1" },
          { text: "Едно кафе и една вода. Колку чини?", gloss: "One coffee and one water. How much is it?", source: "scenario:gen-s1-cafe-order#3" },
          { text: "Извинете. Не разбирам. Побавно, ве молам.", gloss: "Sorry. I don't understand. Slower, please.", source: "scenario:gen-s0-repair#1" },
          { text: "Можете ли да повторите? Уште еднаш, ве молам.", gloss: "Can you repeat? Once more, please.", source: "scenario:gen-s0-repair#3" },
          { text: "Повелете. Сметката, ве молам.", gloss: "Here you are. The bill, please.", source: "scenario:gen-s1-cafe-order#5" },
        ],
      },
      {
        id: "m-s-market", mode: "speak", title: "At the market",
        scene: "At the green market you want apples, and maybe some bread.",
        steps: ["Greet the seller and say what you want", "Ask for a kilo of apples", "Ask how much a kilo is, and say whether that's cheap or expensive", "Say you'll take them"],
        canDoIds: ["m-market", "m-buy", "m-ask"], pointIds: ["pt-plurals", "pt-adjectives", "pt-go-ja-gi", "pt-numbers"],
        model: [
          { text: "Добар ден! Сакам јаболка, ве молам.", gloss: "Good day! I want apples, please.", source: "scenario:gen-s1-market#1" },
          { text: "Едно кило, ве молам.", gloss: "One kilo, please.", source: "scenario:gen-s1-market#3" },
          { text: "Колку чини килото?", gloss: "How much is a kilo?", source: "scenario:gen-s1-market#5" },
          { text: "Добро, ќе ги земам. Повелете.", gloss: "Good, I'll take them. Here you are.", source: "scenario:gen-s1-market#7" },
        ],
      },
      {
        id: "m-w-intro", mode: "write", title: "Introduce yourself in writing",
        scene: "Write a short message introducing yourself to a new Macedonian friend.",
        steps: ["Hello, and your name", "Where you're from", "What you do", "That you're learning Macedonian, and one thing you don't know or understand yet (with не)"],
        canDoIds: ["m-intro", "m-greet", "m-repair"], pointIds: ["pt-sum", "pt-ne", "pt-verbs-e-i", "pt-se"],
        model: [
          { text: "Здраво! Јас сум Ана. А ти?", gloss: "Hi! I am Ana. And you?", source: "scenario:gen-s1-greet-intro#1" },
          { text: "Од Лондон сум. Учам македонски.", gloss: "I'm from London. I'm learning Macedonian.", source: "scenario:gen-s1-greet-intro#5" },
          { text: "Јас сум учителка.", gloss: "I am a teacher.", source: "scenario:gen-s1-greet-intro#7" },
          { text: "Сѐ уште учам.", gloss: "I'm still learning.", source: "vocab:gen-s0-repair-v8" },
        ],
      },
      {
        id: "m-w-list", mode: "write", title: "A shopping list, and a question",
        scene: "Write your list for the market: three things and how much of each. Then write one question for the seller.",
        steps: ["Three things, each with an amount (one kilo, two …)", "The right form after a number bigger than one (the plural)", "One question for the seller, with колку or ли"],
        canDoIds: ["m-market", "m-buy", "m-ask"], pointIds: ["pt-numbers", "pt-plurals", "pt-gender", "pt-yes-no"],
        model: [
          { text: "Едно кило, ве молам.", gloss: "One kilo, please.", source: "scenario:gen-s1-market#3" },
          { text: "Колку чини килото?", gloss: "How much is a kilo?", source: "scenario:gen-s1-market#5" },
          { text: "Имате ли вода? Колку чини?", gloss: "Do you have water? How much is it?", source: "scenario:gen-s0-survive#3" },
        ],
      },
    ],
  },
  {
    id: "final",
    afterChapterId: "s2-problems",
    title: "Final · A week in Macedonia",
    intro: "The whole course. This checks you can make plans, find your way, talk about yourself and your days, and sort out a problem, as well as the everyday basics from the first half. Open book again: prep as long as you like, with the grammar and words for each task one tap away. The last speaking task is a short talk you prepare in advance, so notes are fine. Afterwards you'll see what you can do, and what's worth another look.",
    canDos: [
      { id: "f-way", text: "Ask for and follow directions, and say which way to go", chapterIds: ["s1-directions"], pointIds: ["pt-prepositions", "pt-commands", "pt-more-most"] },
      { id: "f-likes", text: "Say what you like and what you think, agree, and talk about plans", chapterIds: ["s2-smalltalk"], pointIds: ["pt-mi-ti-mu", "pt-future"] },
      { id: "f-past", text: "Say what you did, and ask someone about their day", chapterIds: ["s2-pasttime"], pointIds: ["pt-past", "pt-aspect"] },
      { id: "f-family", text: "Talk about your family, your home, your work and your age", chapterIds: ["s2-home-family"], pointIds: ["pt-possessives", "pt-irregular-plurals"] },
      { id: "f-plans", text: "Make a plan by phone: a day, a time and a place, and confirm it", chapterIds: ["s2-arrange"], pointIds: ["pt-time", "pt-ajde-da"] },
      { id: "f-problem", text: "Report a problem, complain politely, and get it put right", chapterIds: ["s2-problems"], pointIds: ["pt-ima-nema", "pt-ti-vie"] },
      { id: "f-basics", text: "Still handle the basics from the first half: greeting, asking, ordering, introducing yourself", chapterIds: ["s0-greet", "s1-cafe-order", "s1-greet-intro"], pointIds: ["pt-sum", "pt-ne", "pt-yes-no"] },
    ],
    tasks: [
      {
        id: "f-s-phone", mode: "speak", title: "Plans for Saturday",
        scene: "You phone a friend to meet up at the weekend.",
        steps: ["Open the call and ask for your friend", "Ask what they did yesterday", "Suggest meeting on Saturday, and a time", "Suggest a place, and confirm the plan"],
        canDoIds: ["f-plans", "f-past", "f-basics"], pointIds: ["pt-time", "pt-ajde-da", "pt-past"],
        model: [
          { text: "Ало, здраво! Дома ли е Ана?", gloss: "Hello, hi! Is Ana home?", source: "scenario:gen-s2-arrange#1" },
          { text: "А ти, што правеше вчера?", gloss: "And you, what did you do yesterday?", source: "scenario:gen-s2-pasttime#5" },
          { text: "во сабота", gloss: "on Saturday", source: "vocab:add-vo-sabota" },
          { text: "Ајде да се видиме денес. Во колку часот?", gloss: "Let's meet today. At what time?", source: "scenario:gen-s2-arrange#3" },
          { text: "Ајде во кафулето на плоштадот.", gloss: "Let's meet at the cafe on the square.", source: "scenario:gen-s2-arrange#5" },
          { text: "Во ред, во седум. Чао!", gloss: "Alright, at seven. Bye!", source: "scenario:gen-s2-arrange#7" },
        ],
      },
      {
        id: "f-s-way", mode: "speak", title: "Finding the bus station",
        scene: "You're on a street in the city and need the bus station.",
        steps: ["Stop someone politely and ask where it is", "Check whether it's left or right, near or far", "Ask whether you can go by bus", "Thank them"],
        canDoIds: ["f-way", "f-basics"], pointIds: ["pt-prepositions", "pt-yes-no", "pt-ti-vie"],
        model: [
          { text: "Извинете! Каде е автобуската станица?", gloss: "Excuse me! Where is the bus station?", source: "scenario:gen-s1-directions#0" },
          { text: "Лево? Дали е близу?", gloss: "Left? Is it near?", source: "scenario:gen-s1-directions#2" },
          { text: "Може со автобус или со трамвај?", gloss: "Can I go by bus or by tram?", source: "scenario:gen-s1-directions#4" },
          { text: "Ви благодарам! Пријатно!", gloss: "Thank you! Have a nice day!", source: "scenario:gen-s1-directions#6" },
        ],
      },
      {
        id: "f-s-problem", mode: "speak", title: "Something's wrong",
        scene: "At a café your coffee arrives cold, and then the bill is wrong.",
        steps: ["Say there's a problem, and what it is", "Say the bill is wrong", "Ask for help, or say you want to send the coffee back", "Thank them once it's sorted"],
        canDoIds: ["f-problem", "f-basics"], pointIds: ["pt-ima-nema", "pt-ne", "pt-da"],
        model: [
          { text: "Добар ден! Има проблем. Кафето не е топло.", gloss: "Good day! There is a problem. The coffee is not hot.", source: "scenario:gen-s2-problems#1" },
          { text: "Ова не е тоа што нарачав. Сметката е погрешна.", gloss: "This is not what I ordered. The bill is wrong.", source: "scenario:gen-s2-problems#3" },
          { text: "Може ли да помогнете? Сакам да вратам кафето.", gloss: "Can you help? I want to return the coffee.", source: "scenario:gen-s2-problems#5" },
          { text: "Благодарам многу! Сега е во ред.", gloss: "Thank you very much! Now it's fine.", source: "scenario:gen-s2-problems#7" },
        ],
      },
      {
        id: "f-s-me", mode: "speak", title: "About me (prepared)",
        scene: "A one-minute talk about yourself. Prepare it first; notes are fine.",
        steps: ["How old you are and where you live", "Your family", "What you did yesterday", "What you'll do tomorrow, and something you like"],
        canDoIds: ["f-family", "f-past", "f-likes"], pointIds: ["pt-possessives", "pt-past", "pt-future", "pt-mi-ti-mu"],
        model: [
          { text: "Здраво! Имам триесет години.", gloss: "Hi! I am thirty years old.", source: "scenario:gen-s2-home-family#1" },
          { text: "Живеам во Скопје, во голем стан.", gloss: "I live in Skopje, in a big apartment.", source: "scenario:gen-s2-home-family#3" },
          { text: "Да, имам жена и едно дете.", gloss: "Yes, I have a wife and one child.", source: "scenario:gen-s2-home-family#5" },
          { text: "Отидов во кафуле и јадев сендвич.", gloss: "I went to a café and ate a sandwich.", source: "scenario:gen-s2-pasttime#3" },
          { text: "Утре ќе одам на кафе со пријател.", gloss: "Tomorrow I will go for coffee with a friend.", source: "scenario:gen-s2-pasttime#7" },
          { text: "Да, многу ми се допаѓа. Убаво е.", gloss: "Yes, I like it a lot. It's nice.", source: "scenario:gen-s2-smalltalk#1" },
        ],
      },
      {
        id: "f-w-day", mode: "write", title: "Yesterday and tomorrow",
        scene: "Text a friend about your days.",
        steps: ["Two things you did yesterday", "One thing you'll do tomorrow (with ќе)", "Ask what they did"],
        canDoIds: ["f-past", "f-likes"], pointIds: ["pt-past", "pt-future"],
        model: [
          { text: "Здраво! Добро сум. Вчера бев на работа.", gloss: "Hi! I'm good. Yesterday I was at work.", source: "scenario:gen-s2-pasttime#1" },
          { text: "Отидов во кафуле и јадев сендвич.", gloss: "I went to a café and ate a sandwich.", source: "scenario:gen-s2-pasttime#3" },
          { text: "Утре ќе одам на кафе со пријател.", gloss: "Tomorrow I will go for coffee with a friend.", source: "scenario:gen-s2-pasttime#7" },
          { text: "А ти, што правеше вчера?", gloss: "And you, what did you do yesterday?", source: "scenario:gen-s2-pasttime#5" },
        ],
      },
      {
        id: "f-w-family", mode: "write", title: "My family and my home",
        scene: "A short paragraph for a pen pal.",
        steps: ["Who's in your family (my …)", "Where you live, and what it's like", "What you do"],
        canDoIds: ["f-family"], pointIds: ["pt-possessives", "pt-adjectives"],
        model: [
          { text: "Имам брат и сестра.", gloss: "I have a brother and a sister.", source: "vocab:gen-s2-home-family-v7" },
          { text: "Живеам во Скопје, во голем стан.", gloss: "I live in Skopje, in a big apartment.", source: "scenario:gen-s2-home-family#3" },
          { text: "Работам како учител.", gloss: "I work as a teacher.", source: "scenario:gen-s2-home-family#7" },
        ],
      },
      {
        id: "f-w-invite", mode: "write", title: "An invitation",
        scene: "Invite a friend to meet up.",
        steps: ["Suggest a day and a time", "Suggest a place", "Say what you'll do together (let's …)"],
        canDoIds: ["f-plans"], pointIds: ["pt-time", "pt-ajde-da", "pt-future"],
        model: [
          { text: "во сабота", gloss: "on Saturday", source: "vocab:add-vo-sabota" },
          { text: "Ајде да се видиме денес. Во колку часот?", gloss: "Let's meet today. At what time?", source: "scenario:gen-s2-arrange#3" },
          { text: "Ајде во кафулето на плоштадот.", gloss: "Let's meet at the cafe on the square.", source: "scenario:gen-s2-arrange#5" },
        ],
      },
      {
        id: "f-w-complaint", mode: "write", title: "A polite complaint",
        scene: "Write to a shop: something you bought there doesn't work.",
        steps: ["Say there's a problem with what you bought", "Say what's wrong (it doesn't work)", "Say what you'd like: to return it, or help", "Keep it polite (the вие forms)"],
        canDoIds: ["f-problem", "f-basics"], pointIds: ["pt-ima-nema", "pt-ti-vie", "pt-da"],
        model: [
          { text: "Има проблем.", gloss: "There's a problem.", source: "vocab:gen-s2-problems-v1" },
          { text: "Не работи.", gloss: "It doesn't work.", source: "vocab:gen-s2-problems-v2" },
          { text: "Сакам да вратам.", gloss: "I want to return (it).", source: "vocab:gen-s2-problems-v6" },
          { text: "Можете ли да помогнете?", gloss: "Can you help?", source: "vocab:gen-s2-problems-v4" },
        ],
      },
    ],
  },
];
