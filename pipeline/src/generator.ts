import type { Scenario, Reader, ReviewItem } from "@ll/pack-schema";
import type { Curriculum } from "./architect.js";

export interface TtsJob {
  itemId: string;
  text: string; // synthesized once, offline; resulting audioUrl is cached onto the item
}

export interface GeneratedContent {
  scenarios: Scenario[];
  readers: Reader[];
  items: ReviewItem[];
  ttsJobs: TtsJob[];
}

/**
 * Opus 4.8, offline. Produce graded content at i+1. Everything is emitted with
 * `confidence: "unreviewed"` and validated for style/correctness against the hand-authored
 * reference scenario in @ll/pack-mk before a human spot-check.
 */
export async function generate(_curriculum: Curriculum): Promise<GeneratedContent> {
  throw new Error("not implemented");
}
