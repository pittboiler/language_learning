// Import-anything — turn arbitrary target-language text (paste / URL / transcript) into a
// familiarity-tracked, glossed, audio-backed reader, WITHOUT crowd-sourced glosses (LingQ's weak spot
// for low-resource languages). It REUSES the existing pipeline agents — no parallel critic:
//   • generator-style structured call → segment the text + generate accurate glosses + chunk
//     suggestions + emit TTS jobs (Opus 4.8, offline; mirrors generator.ts).
//   • validator.ts (the SAME Validator/Critic) → gate the generated glosses, flag low-confidence.
//   • core/familiarity scoring → difficulty-score the result so it's only recommended near i+1.
// See DESIGN-comprehensible-input.md §2.4 / Part C.
//
// STATUS: stub only — interfaces are stable; body throws `not implemented`.
import type { MiniStory } from "@ll/pack-schema";
import type { Verdict, ValidatorContext } from "./validator.js";

export interface ImportRequest {
  source: "paste" | "url" | "transcript";
  raw: string; // pasted text, a URL to fetch+extract, or a transcript blob
  title?: string;
}

export interface ImportContext {
  languageName: string;
  /** Reuse the same Validator context (languageName, stressRule, referenceStyle) as the batch. */
  validator: ValidatorContext;
}

export interface ImportedReader {
  /** The imported content as a MiniStory (segments + glosses + Q&A optional), confidence:"unreviewed". */
  reader: MiniStory;
  /** Per-gloss verdicts from the reused Validator — low-confidence glosses flagged, not shown as authoritative. */
  verdicts: Verdict[];
  /** TTS jobs to synthesize offline + cache (audioSource:"tts"). */
  ttsJobs: { segmentId: string; text: string }[];
  /** Lex keys discovered, for difficulty scoring + familiarity recommendation (Part A). */
  lexKeys: string[];
}

/**
 * Import + structure outside content. Offline, gated. Reuses generator-style generation + the
 * Validator; difficulty scoring (core/familiarity/scoring.scoreText) is applied by the caller so the
 * reader is recommended only near the learner's i+1 level.
 */
export async function importContent(_req: ImportRequest, _ctx: ImportContext): Promise<ImportedReader> {
  throw new Error("not implemented: fetch/extract → segment+gloss (generator) → validate (validator) → TTS jobs → MiniStory");
}
