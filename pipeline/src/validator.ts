import type { Confidence } from "@ll/pack-schema";

export interface Verdict {
  itemId: string;
  confidence: Confidence; // promotes "unreviewed" → "validated" when it passes
  issues: string[];
}

/**
 * DEFERRED for v1 (DESIGN.md §5). The trust layer in v1 is a human spot-check — items stay
 * "unreviewed" and are gated from being served as authoritative until reviewed.
 *
 * When enabled: an Opus 4.8 critic checks each item for correctness, naturalness, and
 * level-appropriateness, flagging low-confidence items for native-speaker review.
 */
export async function validate(_items: { id: string }[]): Promise<Verdict[]> {
  throw new Error("deferred: human spot-check is the v1 trust layer");
}
