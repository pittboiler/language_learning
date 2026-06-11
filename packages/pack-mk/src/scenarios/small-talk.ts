import type { Scenario } from "@ll/pack-schema";

// Social bar scenario (the other patrons, not just the waiter). Hand-authored.
// confidence: "authored" — but this dialogue is in Jake's native spot-check queue.
export const smallTalk: Scenario = {
  id: "bar-small-talk",
  title: "Small talk with someone",
  goal: "Greet a stranger, say where you're from, and that you're learning Macedonian.",
  setting: "standing next to someone at the bar",
  requiredVocab: ["v-zdravo", "v-od-kade", "v-ucam"],
  requiredStructures: [],
  script: [
    { speaker: "partner", text: "Здраво! Како се викаш?", gloss: "Hi! What's your name?" },
    { speaker: "learner", text: "Здраво! Јас сум Џејкоб.", translit: "Zdravo! Jas sum Jacob.", gloss: "Hi! I'm Jacob.", satisfies: ["greeted"] },
    { speaker: "partner", text: "Мило ми е! Од каде си?", gloss: "Nice to meet you! Where are you from?" },
    { speaker: "learner", text: "Од Америка сум.", translit: "Od Amerika sum.", gloss: "I'm from America.", satisfies: ["origin"] },
    { speaker: "partner", text: "Супер! Зборуваш македонски?", gloss: "Cool! Do you speak Macedonian?" },
    { speaker: "learner", text: "Учам македонски.", translit: "Učam makedonski.", gloss: "I'm learning Macedonian.", satisfies: ["learning"] },
    { speaker: "partner", text: "Браво! Одлично ти оди.", gloss: "Well done! You're doing great." },
  ],
  successCriteria: [
    { id: "greeted", description: "Said hello" },
    { id: "origin", description: "Said where you're from" },
    { id: "learning", description: "Said you're learning" },
  ],
  confidence: "authored",
};
