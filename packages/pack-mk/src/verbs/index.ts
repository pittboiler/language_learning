// Verbs by pattern: the bank (bank.ts) run through the rule engine (engine.ts), and the patterns they follow.
import { bank } from "./bank.js";
import { conjugate } from "./engine.js";
export { verbPatterns } from "./patterns.js";
export { bank } from "./bank.js";
export * as engine from "./engine.js";

export const verbs = bank.map(conjugate);
