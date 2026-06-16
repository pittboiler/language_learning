// pipeline/src/infogap.ts — OFFLINE generation of asymmetric InfoGapTask pairs (each partner gets
// different info). Reuses the existing structured Opus generation + the validator (confidence gate) —
// no parallel critic, exactly like import.ts. Runs once per situation; output is gated `unreviewed`
// until human spot-check, the same trust discipline as all pack content.
import type { InfoGapTask, InfoGapRole, Criterion } from "@ll/pack-schema";
import { structuredCall, MODELS } from "@ll/core/llm";

export interface InfoGapGenRequest {
  situation: { id: string; title: string; goal: string; setting: string };
  /** How the two roles diverge: each holds secret facts, or each owns half of a task. */
  splitRule: "secret-info" | "task-swap";
}

export interface InfoGapGenContext {
  languageName: string;
  grammarConceptIds: string[];
  /** A hand-authored known-good info-gap (e.g. cafe-order-gap) rendered as text, to anchor style. */
  referenceStyle?: string;
  /** Taught chunks the roles' targetPhrases should lean on (the unit's core lexis). */
  targetLexis?: string[];
}

export interface GeneratedInfoGap {
  task: InfoGapTask; // confidence: "unreviewed" until spot-checked
  costUsd: number;
}

const ROLE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    brief: { type: "string", description: "English: what THIS partner is trying to accomplish." },
    secretInfo: { type: "array", items: { type: "string" }, description: "Facts (in English) ONLY this partner holds — never shown to the other." },
    targetPhrases: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string", description: "Scaffolding line in the target language." },
          gloss: { type: "string", description: "English gloss." },
          translit: { type: "string", description: "Romanization." },
        },
        required: ["text", "gloss", "translit"],
      },
    },
  },
  required: ["brief", "secretInfo", "targetPhrases"],
};

const INFOGAP_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    goal: { type: "string", description: "The shared goal both partners work toward." },
    setting: { type: "string" },
    roleA: ROLE_SCHEMA,
    roleB: ROLE_SCHEMA,
    successCriteria: {
      type: "array",
      items: { type: "object", additionalProperties: false, properties: { id: { type: "string" }, description: { type: "string" } }, required: ["id", "description"] },
    },
  },
  required: ["title", "goal", "setting", "roleA", "roleB", "successCriteria"],
};

interface RoleData {
  brief: string;
  secretInfo: string[];
  targetPhrases: { text: string; gloss: string; translit: string }[];
}
interface InfoGapData {
  title: string;
  goal: string;
  setting: string;
  roleA: RoleData;
  roleB: RoleData;
  successCriteria: { id: string; description: string }[];
}

function system(ctx: InfoGapGenContext, splitRule: string): string {
  return `You are an expert ${ctx.languageName} curriculum author creating an ASYMMETRIC INFO-GAP task for two ABSOLUTE BEGINNERS. The two roles must hold DIFFERENT information so NEITHER can finish alone — that gap is what forces real ${ctx.languageName} exchange.

${ctx.referenceStyle ? `Match the style, level, and format of this hand-authored reference:\n${ctx.referenceStyle}\n` : ""}
Requirements:
- Split rule: "${splitRule}" — ${splitRule === "secret-info" ? "each role holds secret facts the other needs." : "each role owns half of the task and must coordinate."}
- roleA and roleB each get: a short English brief, 2-3 secretInfo facts (English, held privately), and 2-4 targetPhrases (scaffolding) in natural ${ctx.languageName} with romanization + gloss.
- The two roles' secretInfo MUST differ and MUST be complementary (A needs what B holds and vice-versa).
- 3-4 successCriteria (short id + English description), satisfied only when the gap is bridged.
- Use ONLY beginner-appropriate, correct, natural ${ctx.languageName} (correct gender agreement, articles, stress).${ctx.targetLexis?.length ? ` Lean on these taught chunks where natural: ${ctx.targetLexis.join("; ")}.` : ""}`;
}

/** Generate one asymmetric, gated info-gap task pair (Opus 4.8, offline). Caller runs the Validator over
 *  each role's targetPhrases, exactly like the batch does for scenario lines. */
export async function generateInfoGapPair(req: InfoGapGenRequest, ctx: InfoGapGenContext): Promise<GeneratedInfoGap> {
  const user = `SITUATION: "${req.situation.title}" — ${req.situation.goal} (setting: ${req.situation.setting}). Produce the asymmetric info-gap pair.`;
  const { data, costUsd } = await structuredCall<InfoGapData>({
    model: MODELS.offline,
    system: system(ctx, req.splitRule),
    user,
    schema: INFOGAP_SCHEMA,
    effort: "high",
    thinking: true,
    maxTokens: 3000,
  });

  const role = (r: RoleData, which: "A" | "B"): InfoGapRole => ({
    role: which,
    brief: r.brief,
    secretInfo: r.secretInfo,
    targetPhrases: r.targetPhrases.map((p) => ({ text: p.text, gloss: p.gloss, ...(p.translit ? { translit: p.translit } : {}) })),
  });
  const successCriteria: Criterion[] = data.successCriteria.map((c) => ({ id: c.id, description: c.description }));

  const task: InfoGapTask = {
    id: `gen-${req.situation.id}-gap`,
    title: data.title,
    goal: data.goal,
    setting: data.setting,
    roleA: role(data.roleA, "A"),
    roleB: role(data.roleB, "B"),
    successCriteria,
    confidence: "unreviewed",
  };
  return { task, costUsd };
}
