import type { WritingTask } from "@ll/pack-schema";

// Short beginner writing prompts (English instructions; the learner produces Macedonian, which the
// tutor corrects). confidence: "authored".
export const writingTasks: WritingTask[] = [
  { id: "w-greet-name", prompt: "Greet someone and tell them your name.", i1Level: 1, confidence: "authored" },
  { id: "w-order-coffee", prompt: "Order one coffee, and say please.", targetConcepts: ["gender"], i1Level: 2, confidence: "authored" },
  { id: "w-from", prompt: "Say which country you are from.", i1Level: 2, confidence: "authored" },
  { id: "w-ask-price", prompt: "Ask how much a beer costs.", targetConcepts: ["gender"], i1Level: 2, confidence: "authored" },
];
