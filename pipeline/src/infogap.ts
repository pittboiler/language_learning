// pipeline/src/infogap.ts — OFFLINE generation of asymmetric InfoGapTask pairs (each partner gets
// different info). Reuses the existing generator (Opus structured generation) + validator (confidence
// gate) — no parallel critic, exactly like import.ts. Runs once per situation; output is gated
// `unreviewed` until human spot-check, the same trust discipline as all pack content. Stub only.
import type { InfoGapTask } from "@ll/pack-schema";

export interface InfoGapGenRequest {
  situation: { id: string; title: string; goal: string; setting: string };
  /** How the two roles diverge: each holds secret facts, or each owns half of a task. */
  splitRule: "secret-info" | "task-swap";
}

export interface InfoGapGenContext {
  languageName: string;
  grammarConceptIds: string[];
}

export interface GeneratedInfoGap {
  task: InfoGapTask; // confidence: "unreviewed" until spot-checked
  costUsd: number;
}

/** Generate one asymmetric, validated info-gap task pair. Reuses `generator` + `validator`. */
export async function generateInfoGapPair(
  req: InfoGapGenRequest,
  ctx: InfoGapGenContext,
): Promise<GeneratedInfoGap> {
  throw new Error("not implemented: generator (asymmetric pair) → validator (per-role gating)");
}
