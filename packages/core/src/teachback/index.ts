// @ll/core/teachback — the protégé effect: when the cross-partner diff shows a pace gap, prompt the
// AHEAD partner to record a short explanation for the other. Teaching a peer boosts the teacher's own
// learning the most — this converts a pace gap into a feature instead of a wound. Reads the diff from
// core/partner; the recording reuses core/speaking. Language-agnostic. See §2 / §3.3 / §5.6.
// Stubs only — bodies throw `not implemented`.
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
  audioUrl?: string; // partner-media recording
  transcript?: string;
  note?: string; // optional typed explanation
  status: "requested" | "recorded" | "seen";
  createdAt: Date;
}

/** Turn the `iCanHelpPartner` side of the diff into teach-back prompts for the ahead partner,
 *  most-valuable-first (and capped, so it never nags). */
export function proposeTeachBacks(
  diff: ComplementaryDiff,
  teacherId: string,
  learnerId: string,
  opts?: { limit?: number },
): TeachBackPrompt[] {
  throw new Error("not implemented");
}
