// Dual-ASR confidence gate + feedback composer — the spike-proven speaking subsystem.
// Ported from spike/server.js (runAsr agreement logic, the feedback prompt + schema, asrCaveat).
//
// Language-agnostic: the prompt is built from pack-supplied language facts (name, stress rule,
// exceptions) passed in via SpeakingContext. No hardcoded language lives here.
import type { AsrConfig, AsrEngine, ReviewItem } from "@ll/pack-schema";
import { MODELS, structuredCall } from "../llm/index.js";

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

/** Normalize for cross-engine comparison: lowercase, strip punctuation, collapse whitespace. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?;:()«»„“”"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickLongest(rs: AsrResult[]): AsrResult {
  return rs.slice().sort((a, b) => b.text.length - a.text.length)[0]!;
}

/**
 * The load-bearing mechanism from the spike: when the engines agree, trust the transcript (high
 * confidence); when they disagree (or only one is available), drop to low confidence so the coach
 * hedges ("likely ASR error") instead of confidently marking correct speech wrong — the Teuida
 * false-negative failure mode.
 */
export function confidenceGate(results: AsrResult[], cfg: AsrConfig): GateOutcome {
  const ok = results.filter((r) => r.ok && r.text.trim().length > 0);
  if (ok.length === 0) return { agreed: false, canonical: "", confidence: "low", transcripts: results };

  if (cfg.gate === "single") {
    return { agreed: true, canonical: pickLongest(ok).text, confidence: "high", transcripts: results };
  }
  // agreement gate
  if (ok.length === 1) return { agreed: false, canonical: ok[0]!.text, confidence: "low", transcripts: results };
  const norms = ok.map((r) => normalize(r.text));
  const agreed = norms.every((n) => n === norms[0]);
  return {
    agreed,
    canonical: agreed ? ok[0]!.text : pickLongest(ok).text,
    confidence: agreed ? "high" : "low",
    transcripts: results,
  };
}

export interface SpeakingContext {
  /** Pack-supplied language display name — NOT hardcoded in core. */
  languageName: string;
  stressRule?: string;
  stressExceptions?: string[];
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

export interface SpeakingFeedbackResult {
  feedback: SpeakingFeedback;
  ms: number;
  costUsd: number;
}

function feedbackSystem(ctx: SpeakingContext): string {
  const stress = ctx.stressRule
    ? `\n- Apply this language's stress rule and flag obvious violations: ${ctx.stressRule}` +
      (ctx.stressExceptions?.length ? ` Known exceptions: ${ctx.stressExceptions.join("; ")}.` : "")
    : "";
  return `You are an expert, encouraging ${ctx.languageName} tutor coaching an ABSOLUTE BEGINNER who has just spoken a target phrase aloud.

You receive: the TARGET phrase (target-language script + transliteration + English) and one or two ASR (speech-to-text) transcripts of the learner's spoken attempt.

CRITICAL — ASR on beginner ${ctx.languageName} is unreliable. The transcripts may misrecognise correct speech. Before judging the learner:
- If the two transcripts disagree with each other, or a transcript contains an implausible word/substitution, treat the discrepancy as a likely ASR artifact, NOT a learner error. Set asrCaveat.likelyAsrError = true and explain.
- Never harshly mark the learner "wrong" for something that is plausibly just a recognition error.

Pedagogy:${stress}
- Keep coaching short, warm, and level-appropriate. One concrete tip only.
- Be honest but kind; this learner cannot yet read the script fluently.`;
}

const FEEDBACK_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    overall: { type: "string", description: "One short, friendly paragraph assessing the attempt." },
    words: {
      type: "array",
      description: "Per-word judgement of the target phrase.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          target: { type: "string" },
          status: { type: "string", enum: ["correct", "mispronounced", "wrong", "missed", "uncertain"] },
          note: { type: "string" },
        },
        required: ["target", "status", "note"],
      },
    },
    pronunciation: { type: "string", description: "Pronunciation/accuracy assessment." },
    stress: { type: "string", description: "Stress comment (apply the pack's stress rule; note exceptions)." },
    tip: { type: "string", description: "One concrete improvement tip." },
    asrCaveat: {
      type: "object",
      additionalProperties: false,
      properties: {
        likelyAsrError: { type: "boolean", description: "True if the diff looks like an ASR artifact, not a learner error." },
        explanation: { type: "string" },
      },
      required: ["likelyAsrError", "explanation"],
    },
    score: { type: "integer", description: "Rough accuracy 0-100." },
  },
  required: ["overall", "words", "pronunciation", "stress", "tip", "asrCaveat", "score"],
};

/**
 * Build the coaching prompt from the target item, the gate outcome, and the pack's language facts,
 * then run it on the live tier (Sonnet 4.6). The gate's agreement signal is fed into the prompt so
 * the model knows when to hedge.
 */
export async function composeFeedback(
  target: ReviewItem,
  gate: GateOutcome,
  ctx: SpeakingContext,
): Promise<SpeakingFeedbackResult> {
  const scribe = gate.transcripts.find((t) => t.engine === "scribe");
  const google = gate.transcripts.find((t) => t.engine === "google");
  const user = [
    "TARGET (what they were asked to say):",
    `  Script: ${target.answer}`,
    `  Translit: ${target.translit ?? "(n/a)"}`,
    `  English: ${target.gloss}`,
    target.note ? `  Note: ${target.note}` : "",
    "",
    `ASR engine agreement: ${
      gate.agreed
        ? "the engines AGREE — higher confidence"
        : "the engines DISAGREE or only one is available — treat mismatches as likely ASR error, hedge rather than mark wrong"
    }`,
    "ASR TRANSCRIPTS of the learner's spoken attempt:",
    `  Scribe: ${scribe?.ok ? scribe.text || "(empty)" : "(not available)"}`,
    `  Google: ${google?.ok ? google.text || "(empty)" : "(not available)"}`,
    "",
    "Give structured coaching feedback for an absolute beginner.",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await structuredCall<SpeakingFeedback>({
    model: MODELS.live,
    system: feedbackSystem(ctx),
    user,
    schema: FEEDBACK_SCHEMA,
    effort: "medium",
    maxTokens: 4000,
  });
  return { feedback: res.data, ms: res.ms, costUsd: res.costUsd };
}
