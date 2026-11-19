// Who each partner plays in an info-gap challenge, shown at the top of the screen ("You're the shopkeeper").
// Hand-kept beside the generated tasks (promote.ts doesn't re-run over them), keyed by task id: [role A, role B].
// (Until 2026-11-14 every challenge said "the customer" / "the waiter", wrong for six of the eight.)
export const infoGapRoleNames: Record<string, [string, string]> = {
  "cafe-order-gap": ["the customer", "the waiter"],
  "gen-s0-repair-gap": ["the tourist", "the local"],
  "gen-s0-survive-gap": ["the customer", "the shopkeeper"],
  "gen-s1-cafe-order-gap": ["the customer", "the bartender"],
  "gen-s1-market-gap": ["the customer", "the seller"],
  "gen-s1-directions-gap": ["the visitor", "the local"],
  "gen-s2-arrange-gap": ["the one calling", "the friend who answers"],
  "gen-s2-problems-gap": ["the customer", "the waiter"],
};

// When each "Stuck? Ideas" phrase fits the conversation (Jake, 2026-11-14: "label when you may use them, e.g. if
// the other person says X, say…"). Keyed by task id, then the phrase exactly as written. Drafted 2026-11-14 for
// Jake's review; English only, so the Macedonian stays the learner's to find.
export const infoGapWhen: Record<string, Record<string, string>> = {
  "cafe-order-gap": {
    "Сакам две кафиња и една вода.": "When the waiter asks what you'd like",
    "Колку чини сѐ заедно?": "Once you've ordered, to find the total",
    "Во ред, имам доволно.": "If the total fits your 200 denars",
    "Повелете, што сакате?": "To start: greet the customer",
    "Кафето е 60, водата е 30 денари.": "If the customer asks the prices",
    "Вкупно е 150 денари.": "When the customer asks for the total",
  },
  "gen-s0-repair-gap": {
    "Извинете, не разбирам.": "If the local speaks too fast",
    "Можете ли да повторите? Побавно, ве молам.": "To get them to say it again, slowly",
    "Како се вели „pharmacy“ на македонски?": "To start, or when you need the missing word",
    "Аха, лево до банката. Фала!": "Once you've got the directions, to say them back",
    "Аптеката е лево, до банката.": "When the tourist asks where the pharmacy is",
    "Уште еднаш, побавно: лево, па право.": "If the tourist asks you to repeat or slow down",
    "„Pharmacy“ на македонски се вели „аптека“.": "If the tourist asks how to say “pharmacy”",
  },
  "gen-s0-survive-gap": {
    "Добар ден! Каде се јаболката?": "To start: greet, then ask where the apples are",
    "Сакам три јаболка и еден леб.": "To say what you want",
    "Имате ли леб? Колку чини сѐ?": "To check there's bread and ask the total",
    "Може ли да повторите? Имам сто денари.": "If you didn't catch a price, or to check the total fits",
    "Добар ден! Јаболката се таму, десно.": "When the customer asks where the apples are",
    "Да, имаме леб. Едно јаболко чини 20 денари.": "If the customer asks about bread or prices",
    "Лебот е 30 денари.": "If the customer asks what the bread costs",
    "Вкупно е 90 денари.": "When the customer asks for the total",
  },
  "gen-s1-cafe-order-gap": {
    "Добровечер! Едно пиво и еден сок, ве молам.": "To start: greet and order",
    "Колку чини?": "Once you've ordered, to ask the price",
    "Еве петстотини денари.": "When you know the total, to pay",
    "Наздравје!": "To finish: the toast",
    "Добровечер! Повелете, што сакате?": "To start: greet the customer",
    "Пивото е 90, сокот е 60 денари.": "If the customer asks the prices",
    "Вкупно е 150 денари.": "When the customer asks for the total",
    "Еве кусур, на здравје!": "When the customer pays: give the change and toast back",
  },
  "gen-s1-market-gap": {
    "Сакам едно кило јаболка и половина кило домати.": "When the seller asks what you'd like",
    "Колку чини килото?": "To ask the price per kilo",
    "Во ред, ќе земам. Колку е сѐ заедно?": "If the prices fit your 150 denars: buy, and ask the total",
    "Повелете, што сакате?": "To start: greet the customer",
    "Јаболката се 40 денари килото, доматите се 60.": "If the customer asks the prices",
    "Вкупно е 70 денари.": "When the customer asks for the total",
  },
  "gen-s1-directions-gap": {
    "Извинете, каде е автобуската станица?": "To start: ask the way",
    "Дали е близу или далеку?": "Once you have the directions, to ask how far",
    "Кој автобус оди до центарот?": "To find out which bus to take",
    "Одете право, потоа лево.": "When the visitor asks where the bus station is",
    "Близу е, не е далеку.": "If the visitor asks whether it's far",
    "Автобус број пет оди до центарот.": "If the visitor asks which bus to take",
  },
  "gen-s2-arrange-gap": {
    "Ало? Дома ли е Марко?": "To start the call",
    "Ајде да се видиме утре во седум часот.": "To suggest the day and the time",
    "Каде да се видиме?": "Once you've agreed the time, to ask where",
    "Ало, јас сум Марко!": "When you pick up: say who you are",
    "Во седум часот е добро. Кога? Утре?": "When your friend suggests seven o'clock",
    "Ајде да се видиме во кафулето кај плоштадот.": "When your friend asks where to meet",
    "Тоа е надесно, до банката.": "If your friend asks where the café is",
  },
  "gen-s2-problems-gap": {
    "Извинете, има проблем.": "To start: get the waiter's attention",
    "Ова не е чај, ова е кафе.": "When the waiter asks what the problem is",
    "Сакам да вратам кафе. Можете ли да помогнете?": "To ask for it to be put right",
    "Мислам дека сметката е погрешна.": "When the bill comes: you only had one drink",
    "Каков е проблемот? Извинете.": "When the customer says there's a problem",
    "Имате право, сметката е погрешна.": "When the customer says the bill is wrong",
    "Веднаш носам чај. Чајот е 40 денари.": "To put the order right: bring the tea",
    "Вкупно е 40 денари. Во ред?": "To give the corrected total",
  },
};
