import type { LanguagePack, WritingTask } from "@ll/pack-schema";
import {
  generatedAlphabet,
  generatedPhonology,
  generatedGrammar,
  generatedVocab,
  generatedScenarios,
  generatedReader,
} from "./generated.js";

// Writing tasks are English instructions (language-agnostic — the learner produces Bulgarian, the
// tutor corrects), so they're hand-authored, not generated. Same prompts as the MK pack.
const writingTasks: WritingTask[] = [
  { id: "w-greet-name", prompt: "Greet someone and tell them your name.", i1Level: 1, confidence: "authored" },
  { id: "w-order-coffee", prompt: "Order one coffee, and say please.", i1Level: 2, confidence: "authored" },
  { id: "w-from", prompt: "Say which country you are from.", i1Level: 2, confidence: "authored" },
  { id: "w-ask-price", prompt: "Ask how much a beer costs.", i1Level: 2, confidence: "authored" },
];

/**
 * The Bulgarian language pack — DATA ONLY, conforming to @ll/pack-schema (same shape as pack-mk).
 *
 * Content is MACHINE-GENERATED (Opus 4.8) and validated by the automated critic, but stays
 * confidence:"unreviewed" (gated) until a native Bulgarian review — Jake doesn't speak Bulgarian.
 * See pipeline/output/review-bg.md for the spot-check queue. This pack exists to prove the
 * generalization seam: it was produced touching ZERO packages/core code.
 */
export const bulgarian: LanguagePack = {
  id: "bg",
  languageCode: "bg",
  name: "Bulgarian",
  // ElevenLabs multilingual voice — eleven_multilingual_v2 renders Bulgarian from any multilingual
  // voice (language is inferred from the text). Reuses the MK voice; native-sounding BG TTS is a
  // known weak spot, flagged for a human/dedicated voice later. (Env ELEVENLABS_VOICE_ID overrides
  // this per-deployment.)
  voiceId: "21m00Tcm4TlvDq8ikWAM",
  asr: { engines: ["scribe", "google"], languageHints: ["bg", "bg-BG"], gate: "agreement" },
  alphabet: generatedAlphabet,
  phonology: generatedPhonology,
  grammar: generatedGrammar,
  vocab: generatedVocab,
  scenarios: generatedScenarios,
  readers: [generatedReader],
  srsSeed: generatedVocab.slice(0, 6),
  writingTasks,
};

export default bulgarian;
