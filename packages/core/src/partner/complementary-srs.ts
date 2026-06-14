// @ll/core/partner/complementary-srs — route review through the cross-partner diff: a lapsed item the
// PARTNER knows well becomes a collaborative "your partner knows this — ask them" prompt instead of a
// lonely drill. Helping replaces drilling. A pure consumer of familiarity-diff; there is NO second SRS
// store — it reorders/annotates the learner's OWN due queue. Language-agnostic. See §2 (one engine,
// two surfaces) / §5.6. Stubs only — bodies throw `not implemented`.
import type { FamiliarityIndex } from "../familiarity/index.js";
import type { ComplementaryDiff } from "./familiarity-diff.js";

export interface ComplementaryReviewItem {
  lexKey: string;
  /** Why this surfaced: the partner is strong on an item the learner is lapsing/new on. */
  source: "partner-strong";
  partnerStrength: number; // 0..1
}

/** Of the learner's own due lexKeys, surface those the partner knows well as collaborative prompts,
 *  most-helpful-first. Does not invent reviews — it annotates/orders the existing due set. */
export function routeComplementary(
  dueKeys: string[],
  diff: ComplementaryDiff,
  index: FamiliarityIndex,
): ComplementaryReviewItem[] {
  throw new Error("not implemented");
}
