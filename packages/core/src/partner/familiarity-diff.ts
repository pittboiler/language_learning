// @ll/core/partner/familiarity-diff — the cross-partner familiarity substrate shared by complementary
// SRS and teach-back. "Two people forget different things" is literally a diff of two familiarity
// projections. Language-agnostic: operates on lexKeys + the FSRS-derived {status,strength}. Privacy by
// construction — only the learning-state vector is projected, never gloss / context / personal state.
// See DESIGN-partnered-learning.md §1.1 / §3.2.
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
  /** Below this strength (and not already "known") a learner is treated as "needs help". Default 0.5. */
  needThreshold?: number;
  /** Cap each set (most-valuable-first). Default 50. */
  limit?: number;
}

/** Project a full familiarity index down to the publishable {status,strength} vector (§1.1). Ignored
 *  items are withheld — they aren't learning signal and needn't be shared. */
export function projectFamiliarity(index: FamiliarityIndex, packId: string): FamiliarityProjection {
  const entries: FamiliarityProjection["entries"] = {};
  for (const [lexKey, e] of Object.entries(index)) {
    if (!e || e.status === "ignored") continue;
    entries[lexKey] = { status: e.status, strength: e.strength };
  }
  return { packId, entries };
}

/** Does a learner (status,strength) still need help on an item the other partner knows? */
function needsHelp(m: { status: FamiliarityStatus; strength: number } | undefined, needThreshold: number): boolean {
  if (!m) return true; // untracked
  if (m.status === "new" || m.status === "learning") return true;
  return m.strength < needThreshold; // "known" but still shaky
}

/** Compute the two complementary help-sets from two projections. The single engine consumed by both
 *  complementary SRS (review surface) and teach-back (production surface). Each list carries the
 *  "mine"/"partner" fields from THIS learner's perspective; sorted by the helpfulness gap, biggest first. */
export function complementaryDiff(
  mine: FamiliarityProjection,
  theirs: FamiliarityProjection,
  opts: DiffOptions = {},
): ComplementaryDiff {
  const needThreshold = opts.needThreshold ?? 0.5;
  const limit = opts.limit ?? 50;

  const partnerCanHelpMe: ComplementaryItem[] = [];
  for (const [lexKey, t] of Object.entries(theirs.entries)) {
    if (t.status !== "known") continue; // the helper must actually know it
    const m = mine.entries[lexKey];
    if (!needsHelp(m, needThreshold)) continue;
    partnerCanHelpMe.push({ lexKey, mineStatus: m?.status ?? "untracked", mineStrength: m?.strength ?? 0, partnerStrength: t.strength });
  }

  const iCanHelpPartner: ComplementaryItem[] = [];
  for (const [lexKey, m] of Object.entries(mine.entries)) {
    if (m.status !== "known") continue;
    const t = theirs.entries[lexKey];
    if (!needsHelp(t, needThreshold)) continue;
    iCanHelpPartner.push({ lexKey, mineStatus: m.status, mineStrength: m.strength, partnerStrength: t?.strength ?? 0 });
  }

  partnerCanHelpMe.sort((a, b) => b.partnerStrength - b.mineStrength - (a.partnerStrength - a.mineStrength));
  iCanHelpPartner.sort((a, b) => b.mineStrength - b.partnerStrength - (a.mineStrength - a.partnerStrength));
  return { partnerCanHelpMe: partnerCanHelpMe.slice(0, limit), iCanHelpPartner: iCanHelpPartner.slice(0, limit) };
}
