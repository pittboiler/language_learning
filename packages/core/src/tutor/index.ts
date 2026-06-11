// Open conversation loop — ported from spike/server.js (/api/chat).
// Generates target-language text live ⇒ run on the strong-enough tier (Sonnet 4.6); cheaper models
// slip on low-resource grammar like gender agreement — see DESIGN.md §0.
import type { Scenario } from "@ll/pack-schema";

export interface SuggestedReply {
  text: string; // a line the learner could say next, in the target language
  gloss: string; // English
}

export interface TutorReply {
  reply: string; // simple, short target-language reply — spoken aloud via TTS
  replyGloss: string; // English gloss
  correction: string; // one gentle fix, or "" if nothing useful to correct
  suggestions: SuggestedReply[]; // response scaffolding so a beginner knows what they can say next
}

export interface TutorTurn {
  userText: string; // the learner's turn (from ASR or a tapped suggestion)
  history: { role: "learner" | "tutor"; text: string }[];
  scenario?: Scenario; // optional: anchor the conversation to a scenario's goal + vocab
}

export function respond(_turn: TutorTurn): Promise<TutorReply> {
  throw new Error("not implemented: ported from spike/server.js /api/chat");
}
