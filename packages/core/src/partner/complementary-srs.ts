// @ll/core/partner/complementary-srs — route review through the cross-partner diff: a lapsed item the
// PARTNER knows well becomes a collaborative "your partner knows this — ask them" prompt instead of a
// lonely drill. Helping replaces drilling. A pure consumer of familiarity-diff; there is NO second SRS
// store — it annotates/orders the learner's OWN due queue. Language-agnostic. See §2 (one engine,
// two surfaces) / §5.6.
import type { FamiliarityIndex } from "../familiarity/index.js";
import type { ComplementaryDiff } from "./familiarity-diff.js";

export interface ComplementaryReviewItem {
  lexKey: string;
  /** Why this surfaced: the partner is strong on an item the learner is lapsing/new on. */
  source: "partner-strong";
  partnerStrength: number; // 0..1
}

/** Of the learner's own due lexKeys, surface those the partner knows well as collaborative prompts,
 *  most-helpful-first. Does not invent reviews — it filters/orders the existing due set. `index` is
 *  accepted for callers that want to cross-reference the live entry (unused at MVP). */
export function routeComplementary(
  dueKeys: string[],
  diff: ComplementaryDiff,
  _index?: FamiliarityIndex,
): ComplementaryReviewItem[] {
  const help = new Map(diff.partnerCanHelpMe.map((i) => [i.lexKey, i.partnerStrength]));
  return dueKeys
    .filter((k) => help.has(k))
    .map((k) => ({ lexKey: k, source: "partner-strong" as const, partnerStrength: help.get(k)! }))
    .sort((a, b) => b.partnerStrength - a.partnerStrength);
}
