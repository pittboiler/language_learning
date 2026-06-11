// Open conversation loop — ported from spike/server.js (/api/chat).
// Generates target-language text live ⇒ runs on the live tier (Sonnet 4.6); cheaper models slip on
// low-resource grammar like gender agreement (DESIGN.md §0).
//
// Language-agnostic: the language name + setting are injected via TutorContext from the pack/scenario.
import type { Scenario } from "@ll/pack-schema";
import { MODELS, structuredCall } from "../llm/index.js";

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

export interface TutorContext {
  /** Pack-supplied language display name — NOT hardcoded in core. */
  languageName: string;
  /** Optional setting for color (e.g. "relaxed café"); defaults to a generic friendly one. */
  setting?: string;
}

export interface TutorReplyResult {
  reply: TutorReply;
  ms: number;
  costUsd: number;
}

function chatSystem(ctx: TutorContext): string {
  const setting = ctx.setting ? ` in a ${ctx.setting}` : " in a relaxed, friendly setting";
  return `You are a warm, patient ${ctx.languageName} conversation partner chatting with an ABSOLUTE BEGINNER${setting}. You receive the learner's spoken turn as an ASR transcript (which may contain recognition errors — be charitable).

Reply in SIMPLE, short, natural ${ctx.languageName} (one or two sentences). Provide a faithful English gloss. Gently correct ONE thing from their attempt — pick the most useful single fix, phrased kindly. If their turn was fine (or the transcript is too garbled to correct meaningfully), leave correction empty and instead keep the conversation going.

Also suggest 2-3 very simple, natural things the learner could say NEXT to continue the conversation, each with an English gloss — short enough for an absolute beginner to attempt out loud.`;
}

const CHAT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: { type: "string", description: "Your reply in simple target-language script." },
    replyGloss: { type: "string", description: "English gloss of your reply." },
    correction: { type: "string", description: "Gentle correction of one thing, or empty string." },
    suggestions: {
      type: "array",
      description: "2-3 short, simple things the learner could say NEXT to continue.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string", description: "Suggested learner line, in the target language." },
          gloss: { type: "string", description: "English gloss." },
        },
        required: ["text", "gloss"],
      },
    },
  },
  required: ["reply", "replyGloss", "correction", "suggestions"],
};

/** Run one tutor turn on the live tier. */
export async function respond(turn: TutorTurn, ctx: TutorContext): Promise<TutorReplyResult> {
  const convo = (turn.history || [])
    .map((h) => `${h.role === "learner" ? "Learner" : "You"}: ${h.text}`)
    .join("\n");
  const goal = turn.scenario ? `Scenario goal (keep the chat moving toward it): ${turn.scenario.goal}\n` : "";
  const user = [
    goal,
    convo ? `Conversation so far:\n${convo}\n` : "",
    `Learner's latest spoken turn (ASR transcript): ${turn.userText}`,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await structuredCall<TutorReply>({
    model: MODELS.live,
    system: chatSystem(ctx),
    user,
    schema: CHAT_SCHEMA,
    effort: "low",
    maxTokens: 1500,
  });
  return { reply: res.data, ms: res.ms, costUsd: res.costUsd };
}
