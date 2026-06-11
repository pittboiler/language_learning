// Dual-ASR confidence gate + feedback composer — the spike-proven speaking subsystem.
// Ported target: spike/server.js (runAsr, the feedback prompt + schema, the asrCaveat logic).
import type { AsrConfig, AsrEngine, ReviewItem } from "@ll/pack-schema";

export interface AsrResult {
  engine: AsrEngine;
  text: string;
  language?: string; // engine's detected language code, if it returns one
  ms: number;
  ok: boolean;
  error?: string;
}

export interface GateOutcome {
  agreed: boolean;
  canonical: string; // best-guess transcript to coach against
  confidence: "high" | "low"; // low ⇒ feedback must hedge, not mark the learner wrong
  transcripts: AsrResult[];
}

/**
 * The load-bearing mechanism from the spike: when the engines agree, trust the transcript;
 * when they disagree, drop to low confidence so the coach hedges ("likely ASR error") instead
 * of confidently marking correct speech wrong (the Teuida failure mode).
 */
export function confidenceGate(_results: AsrResult[], _cfg: AsrConfig): GateOutcome {
  throw new Error("not implemented: normalize + compare transcripts, set confidence");
}

export interface SpeakingFeedback {
  overall: string;
  words: { target: string; status: "correct" | "mispronounced" | "wrong" | "missed" | "uncertain"; note: string }[];
  pronunciation: string;
  stress: string;
  tip: string;
  asrCaveat: { likelyAsrError: boolean; explanation: string };
  score: number;
}

/** Builds the LLM coaching prompt from the target item, the gate outcome, and the pack's stress rules. */
export function composeFeedback(_target: ReviewItem, _gate: GateOutcome, _stressRule?: string): Promise<SpeakingFeedback> {
  throw new Error("not implemented: ported from spike/server.js /api/feedback");
}
