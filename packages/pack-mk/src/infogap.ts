import type { InfoGapTask } from "@ll/pack-schema";

// Hand-authored info-gap reference task (forced interdependence): the customer knows the order + the
// budget, the waiter knows the prices — neither can finish alone, so they MUST exchange information.
// Macedonian correctness-checked (gender agreement: две кафиња/една вода; definite кафето/водата).
export const infoGapTasks: InfoGapTask[] = [
  {
    id: "cafe-order-gap",
    title: "Order at the café (info-gap)",
    goal: "Order the drinks and agree the total — each of you knows only half.",
    setting: "café",
    roleA: {
      role: "A",
      brief: "You're the customer. Say what you want, ask the price, and check it fits your budget.",
      secretInfo: ["You want two coffees and one water.", "You have 200 denars — make sure the total fits."],
      targetPhrases: [
        { text: "Сакам две кафиња и една вода.", gloss: "I want two coffees and one water.", translit: "Sakam dve kafinja i edna voda." },
        { text: "Колку чини сè заедно?", gloss: "How much is it all together?", translit: "Kolku chini sè zaedno?" },
        { text: "Во ред, имам доволно.", gloss: "OK, I have enough.", translit: "Vo red, imam dovolno." },
      ],
    },
    roleB: {
      role: "B",
      brief: "You're the waiter. Take the order, then tell the prices and the total.",
      secretInfo: ["Coffee costs 60 denars each.", "Water costs 30 denars."],
      targetPhrases: [
        { text: "Повелете, што сакате?", gloss: "Go ahead, what would you like?", translit: "Povelete, shto sakate?" },
        { text: "Кафето е 60, водата е 30 денари.", gloss: "The coffee is 60, the water is 30 denars.", translit: "Kafeto e 60, vodata e 30 denari." },
        { text: "Вкупно е 150 денари.", gloss: "The total is 150 denars.", translit: "Vkupno e 150 denari." },
      ],
    },
    successCriteria: [
      { id: "order", description: "The customer said the order (two coffees, one water)." },
      { id: "prices", description: "The waiter gave the prices." },
      { id: "total", description: "You agreed the total — 150 denars." },
      { id: "afford", description: "The customer confirmed it fits the budget." },
    ],
    confidence: "authored",
  },
];
