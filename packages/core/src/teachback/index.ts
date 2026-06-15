// @ll/core/teachback — the protégé effect: when the cross-partner diff shows a pace gap, prompt the
// AHEAD partner to record a short explanation for the other. Teaching a peer boosts the teacher's own
// learning the most — this converts a pace gap into a feature instead of a wound. Reads the diff from
// core/partner; the recording reuses core/speaking. Language-agnostic. See §2 / §3.3 / §5.6.
import type { ComplementaryDiff } from "../partner/familiarity-diff.js";

export interface TeachBackPrompt {
  lexKey: string;
  teacher: string; // userId of the ahead partner (does the explaining → larger learning gain)
  learner: string; // userId of the behind partner
  reason: "partner-lapsed" | "partner-new";
}

export interface TeachBackArtifact {
  id: string;
  lexKey: string;
  teacher: string;
  learner: string;
  audio?: string; // recorded explanation (data-URL for the MVP, like role-swap)
  transcript?: string;
  note?: string; // optional typed explanation
  status: "requested" | "recorded" | "seen";
  createdAt: string; // ISO (stamped by the app)
}

/** Turn the `iCanHelpPartner` side of the diff into teach-back prompts for the ahead partner,
 *  most-valuable-first (and capped, so it never nags). `reason` reflects the LEARNER's gap. */
export function proposeTeachBacks(
  diff: ComplementaryDiff,
  teacherId: string,
  learnerId: string,
  opts: { limit?: number } = {},
): TeachBackPrompt[] {
  const limit = opts.limit ?? 5;
  return diff.iCanHelpPartner.slice(0, limit).map((it) => ({
    lexKey: it.lexKey,
    teacher: teacherId,
    learner: learnerId,
    reason: it.partnerStrength <= 0 ? "partner-new" : "partner-lapsed",
  }));
}
