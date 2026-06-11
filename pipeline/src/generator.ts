import type { Scenario, ReviewItem, DialogueTurn, Criterion } from "@ll/pack-schema";
import { structuredCall, MODELS } from "@ll/core/llm";

// Opus 4.8, offline. Generates a task-based scenario + supporting vocab for an everyday situation,
// anchored to a hand-authored reference scenario for style/level. Everything is emitted with
// confidence: "unreviewed" and must pass the Validator + human spot-check before being served.
// Language-agnostic: target language injected via GenContext.

export interface Situation {
  id: string;
  title: string;
  goal: string;
  setting: string;
}

export interface GenContext {
  languageName: string;
  referenceScenario: Scenario; // the authored order-a-drink, as a style + format anchor
  grammarConceptIds: string[];
}

export interface GeneratedScenario {
  scenario: Scenario; // confidence: "unreviewed"
  vocab: ReviewItem[]; // confidence: "unreviewed"
  costUsd: number;
}

function referenceText(s: Scenario): string {
  return [
    `Title: ${s.title}`,
    `Goal: ${s.goal}`,
    `Setting: ${s.setting}`,
    "Script:",
    ...s.script.map(
      (t) => `  [${t.speaker}] ${t.text} — ${t.gloss}${t.translit ? ` (${t.translit})` : ""}${t.satisfies?.length ? ` {satisfies: ${t.satisfies.join(", ")}}` : ""}`,
    ),
    "Success criteria:",
    ...s.successCriteria.map((c) => `  ${c.id}: ${c.description}`),
  ].join("\n");
}

function generatorSystem(ctx: GenContext): string {
  return `You are an expert ${ctx.languageName} curriculum author creating content for an ABSOLUTE BEGINNER. Produce a task-based SCENARIO for the given everyday situation, in the SAME style, format, and difficulty as this hand-authored reference:

${referenceText(ctx.referenceScenario)}

Requirements:
- 6 to 8 short dialogue turns, alternating "partner" and "learner", natural and simple.
- Learner turns must be things an absolute beginner can realistically say; include accurate transliteration for every learner turn (and "" for partner turns).
- Define 3 to 4 success criteria (a short id like "greeted" + an English description). Each LEARNER turn lists the criterion ids it satisfies (partner turns satisfy none → []).
- Also produce 3 to 6 vocab items (the key words/phrases the learner needs), each with the ${ctx.languageName} answer, transliteration, and a faithful English gloss.
- Use ONLY beginner-appropriate, natural ${ctx.languageName}. Apply correct gender agreement, definite articles, and stress. Do not invent words.`;
}

const GEN_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    script: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          speaker: { type: "string", enum: ["learner", "partner"] },
          text: { type: "string", description: "The line in the target language." },
          gloss: { type: "string", description: "English gloss." },
          translit: { type: "string", description: "Transliteration for learner turns; empty for partner turns." },
          satisfies: { type: "array", items: { type: "string" }, description: "Criterion ids this learner turn meets (empty for partner)." },
        },
        required: ["speaker", "text", "gloss", "translit", "satisfies"],
      },
    },
    successCriteria: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { id: { type: "string" }, description: { type: "string" } },
        required: ["id", "description"],
      },
    },
    vocab: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          answer: { type: "string", description: "Word/phrase in the target language." },
          translit: { type: "string" },
          gloss: { type: "string", description: "English." },
        },
        required: ["answer", "translit", "gloss"],
      },
    },
  },
  required: ["script", "successCriteria", "vocab"],
};

interface GenData {
  script: { speaker: "learner" | "partner"; text: string; gloss: string; translit: string; satisfies: string[] }[];
  successCriteria: { id: string; description: string }[];
  vocab: { answer: string; translit: string; gloss: string }[];
}

export async function generateScenario(sit: Situation, ctx: GenContext): Promise<GeneratedScenario> {
  const user = `SITUATION: "${sit.title}" — ${sit.goal} (setting: ${sit.setting}). Grammar concepts available: ${ctx.grammarConceptIds.join(", ")}.`;
  const { data, costUsd } = await structuredCall<GenData>({
    model: MODELS.offline,
    system: generatorSystem(ctx),
    user,
    schema: GEN_SCHEMA,
    effort: "high",
    thinking: true,
    maxTokens: 3000,
  });

  const script: DialogueTurn[] = data.script.map((t) => ({
    speaker: t.speaker,
    text: t.text,
    gloss: t.gloss,
    ...(t.speaker === "learner" && t.translit ? { translit: t.translit } : {}),
    ...(t.satisfies.length ? { satisfies: t.satisfies } : {}),
  }));
  const successCriteria: Criterion[] = data.successCriteria.map((c) => ({ id: c.id, description: c.description }));

  const vocab: ReviewItem[] = data.vocab.map((v, i) => ({
    id: `gen-${sit.id}-v${i + 1}`,
    kind: "phrase",
    prompt: v.gloss,
    answer: v.answer,
    translit: v.translit,
    gloss: v.gloss,
    i1Level: 2,
    tags: ["generated", sit.id],
    confidence: "unreviewed",
  }));

  const scenario: Scenario = {
    id: `gen-${sit.id}`,
    title: sit.title,
    goal: sit.goal,
    setting: sit.setting,
    requiredVocab: vocab.map((v) => v.id),
    requiredStructures: [],
    script,
    successCriteria,
    confidence: "unreviewed",
  };

  return { scenario, vocab, costUsd };
}
