import type { Confidence } from "@ll/pack-schema";
import { structuredCall, MODELS } from "@ll/core/llm";

// The trust layer's automated critic. Opus 4.8, offline. Checks each generated item for correctness,
// naturalness, and level-appropriateness, and promotes confidence "unreviewed" → "validated" when it
// passes (or keeps it gated + flags issues). Language-agnostic: target language injected via context.

export interface ValidatableItem {
  id: string;
  kind: string; // "phrase" | "scenario-line" | "drill" | "reader-line" | "vocab"
  text: string; // the target-language text to check
  gloss?: string; // claimed English meaning
  note?: string; // context (the task/prompt it came from)
}

export interface ValidatorContext {
  languageName: string;
  stressRule?: string;
  /** A hand-authored known-good reference (e.g. the order-a-drink scenario) to anchor style. */
  referenceStyle?: string;
}

export interface Verdict {
  itemId: string;
  ok: boolean;
  confidence: Confidence; // "validated" if it passes; stays "unreviewed" (gated) if not
  issues: string[];
  corrected?: string; // suggested correction when ok=false
}

function validatorSystem(ctx: ValidatorContext): string {
  return `You are a meticulous, strict NATIVE ${ctx.languageName} reviewer validating machine-generated beginner learning content. For the given item, check:
1. Grammatical correctness — especially agreement (gender, articles, number).${ctx.stressRule ? ` Stress rule: ${ctx.stressRule}.` : ""}
2. The English gloss accurately and fully matches the ${ctx.languageName}.
3. Naturalness — a native speaker would actually say this, not a calque.
4. Beginner-appropriateness — simple, high-frequency, level-appropriate.
${ctx.referenceStyle ? `\nMatch the register and style of this hand-authored reference:\n${ctx.referenceStyle}\n` : ""}
Be strict: if ANYTHING is off, set ok=false, list specific issues, and give a corrected version. Only set ok=true if the item is fully correct, natural, and level-appropriate. Better to flag a borderline item than to pass a wrong one — a beginner can't catch invisible errors.`;
}

const VALIDATOR_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    ok: { type: "boolean", description: "True only if fully correct, natural, and level-appropriate." },
    issues: { type: "array", items: { type: "string" }, description: "Specific problems found (empty if ok)." },
    corrected: { type: "string", description: "A corrected version of the text, or empty string if ok." },
  },
  required: ["ok", "issues", "corrected"],
};

/** Validate items one-by-one on Opus 4.8 (offline). Returns a verdict + confidence stamp per item. */
export async function validate(items: ValidatableItem[], ctx: ValidatorContext): Promise<Verdict[]> {
  const verdicts: Verdict[] = [];
  for (const item of items) {
    const user = [
      `ITEM (${item.kind}):`,
      `  ${ctx.languageName}: ${item.text}`,
      item.gloss ? `  English gloss: ${item.gloss}` : "",
      item.note ? `  Context: ${item.note}` : "",
      "",
      "Validate it.",
    ]
      .filter(Boolean)
      .join("\n");
    const { data } = await structuredCall<{ ok: boolean; issues: string[]; corrected: string }>({
      model: MODELS.offline,
      system: validatorSystem(ctx),
      user,
      schema: VALIDATOR_SCHEMA,
      effort: "high",
      thinking: true,
      maxTokens: 2000,
    });
    verdicts.push({
      itemId: item.id,
      ok: data.ok,
      confidence: data.ok ? "validated" : "unreviewed",
      issues: data.issues,
      corrected: data.corrected || undefined,
    });
  }
  return verdicts;
}

/** Convenience: how many items passed vs were flagged for human spot-check. */
export function summarize(verdicts: Verdict[]): { validated: number; flagged: number } {
  return {
    validated: verdicts.filter((v) => v.ok).length,
    flagged: verdicts.filter((v) => !v.ok).length,
  };
}
