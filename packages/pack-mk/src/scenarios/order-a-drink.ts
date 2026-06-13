import type { Scenario } from "@ll/pack-schema";

// HAND-AUTHORED reference scenario — the known-good standard everything generated is validated
// against. Verified Macedonian. confidence: "authored". Learner turns carry translit (beginner can't
// read Cyrillic yet) + `satisfies` (which success criteria the turn meets).
export const orderADrink: Scenario = {
  id: "bar-order-a-drink",
  title: "Order a drink at a bar",
  goal: "Greet, order a beer, ask the price, and pay.",
  setting: "relaxed bar in Skopje",
  theme: "Café & bar",
  requiredVocab: ["v-zdravo", "v-edno-pivo", "v-kolku-chini", "v-smetka"],
  requiredStructures: ["gender", "definite-articles"],
  script: [
    { speaker: "partner", text: "Здраво! Што сакаш?", gloss: "Hi! What would you like?" },
    { speaker: "learner", text: "Здраво! Едно пиво, ве молам.", translit: "Zdravo! Edno pivo, ve molam.", gloss: "Hi! One beer, please.", satisfies: ["greeted", "ordered"] },
    { speaker: "partner", text: "Секако. Скопско или Златен Даб?", gloss: "Of course. Skopsko or Zlaten Dab?" },
    { speaker: "learner", text: "Едно Скопско. Колку чини?", translit: "Edno Skopsko. Kolku chini?", gloss: "One Skopsko. How much is it?", satisfies: ["asked-price"] },
    { speaker: "partner", text: "Сто и педесет денари.", gloss: "A hundred and fifty denars." },
    { speaker: "learner", text: "Сметката, ве молам.", translit: "Smetkata, ve molam.", gloss: "The bill, please.", satisfies: ["paid"] },
    { speaker: "partner", text: "Повелете. Наздравје!", gloss: "Here you are. Cheers!" },
  ],
  successCriteria: [
    { id: "greeted", description: "Greeted the bartender" },
    { id: "ordered", description: "Ordered a drink" },
    { id: "asked-price", description: "Asked the price" },
    { id: "paid", description: "Asked for the bill / paid" },
  ],
  confidence: "authored",
};
