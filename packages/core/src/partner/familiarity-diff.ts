// @ll/core/partner/familiarity-diff — the cross-partner familiarity substrate shared by complementary
// SRS and teach-back. "Two people forget different things" is literally a diff of two familiarity
// projections. Language-agnostic: operates on lexKeys + the FSRS-derived {status,strength}. Privacy by
// construction — only the learning-state vector is projected, never gloss / context / personal state.
// See DESIGN-partnered-learning.md §1.1 / §3.2. Stubs only — bodies throw `not implemented`.
import type { FamiliarityIndex, FamiliarityStatus } from "../familiarity/index.js";

/** The privacy-safe snapshot one member publishes for the partner (gated by `shareFamiliarity`).
 *  Just the per-lexKey learning state — enough for the diff, nothing sensitive crosses the boundary. */
export interface FamiliarityProjection {
  packId: string;
  entries: Record<string /*lexKey*/, { status: FamiliarityStatus; strength: number }>;
}

export interface ComplementaryItem {
  lexKey: string;
  mineStatus: FamiliarityStatus | "untracked";
  mineStrength: number; // 0..1
  partnerStrength: number; // 0..1
}

/** The two asymmetric help-sets a dyad can exploit. `iCanHelpPartner` drives teach-back; both drive
 *  complementary-SRS routing — the single engine behind both Tier-1 familiarity features (§2). */
export interface ComplementaryDiff {
  partnerCanHelpMe: ComplementaryItem[]; // partner strong/known; I'm new/learning/lapsed
  iCanHelpPartner: ComplementaryItem[]; // the mirror
}

export interface DiffOptions {
  helpThreshold?: number; // min partner strength to count as "can help" (default ≈ known)
  needThreshold?: number; // max of my own strength to count as "needs help"
  limit?: number; // cap each set, most-valuable-first, so the UI/SRS isn't flooded
}

/** Project a full familiarity index down to the publishable {status,strength} vector (§1.1). */
export function projectFamiliarity(index: FamiliarityIndex, packId: string): FamiliarityProjection {
  throw new Error("not implemented");
}

/** Compute the two complementary help-sets from two projections. The single engine consumed by both
 *  complementary SRS (review surface) and teach-back (production surface). */
export function complementaryDiff(
  mine: FamiliarityProjection,
  theirs: FamiliarityProjection,
  opts?: DiffOptions,
): ComplementaryDiff {
  throw new Error("not implemented");
}
