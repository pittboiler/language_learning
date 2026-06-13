// Writing subsystem — short prompted production + correction that explains WHY. Generates target
// language live ⇒ runs on the live tier (Sonnet 4.6). Language-agnostic: the language name is
// injected via WritingContext from the pack.
import { MODELS, structuredCall } from "../llm/index.js";

export interface WritingContext {
  languageName: string;
}

export interface WritingIssue {
  original: string; // the problematic fragment from the attempt
  fix: string; // the corrected fragment
  why: string; // the rule/reason, in English
}

export interface WritingCorrection {
  corrected: string; // the full corrected sentence in the target language (native script)
  correctedTranslit: string; // romanization of `corrected`, so a beginner can read it
  isCorrect: boolean; // attempt already acceptable? (ignoring Latin-vs-native script choice)
  issues: WritingIssue[];
  overall: string; // friendly assessment (English)
  encouragement: string;
}

export interface WritingCorrectionResult {
  correction: WritingCorrection;
  ms: number;
  costUsd: number;
}

function writingSystem(ctx: WritingContext): string {
  return `You are an encouraging ${ctx.languageName} writing tutor for an ABSOLUTE BEGINNER. The learner was given a short TASK (an instruction in English) and wrote an attempt in ${ctx.languageName}.

- Provide a corrected version in natural, simple ${ctx.languageName}.
- If the attempt is already correct (or an acceptable variant), set isCorrect=true and leave issues empty — still give warm encouragement.
- For each meaningful error, explain WHAT to change and WHY (the underlying rule), kindly and simply. Prioritise the most useful fixes; don't overwhelm a beginner.
- The learner usually CANNOT type the native script yet, so they will often write in LATIN / romanized ${ctx.languageName} (e.g. "sakam kafe" for "сакам кафе"). Accept Latin or native script equally and interpret romanized input charitably — romanizing is NOT an error. Judge only the actual language (words, grammar, meaning), never the script choice.
- Always give 'corrected' in the native script, plus 'correctedTranslit' as its simple romanization so the beginner can read it aloud.
- The learner can barely read the script, so keep all explanations in English.`;
}

const WRITING_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    corrected: { type: "string", description: "The full corrected sentence in the target language (native script)." },
    correctedTranslit: { type: "string", description: "Simple romanization of the corrected sentence, so a beginner can read it aloud." },
    isCorrect: { type: "boolean", description: "True if the attempt was already correct/acceptable (ignoring Latin-vs-native-script choice)." },
    issues: {
      type: "array",
      description: "Specific fixes, most useful first.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          original: { type: "string", description: "The problematic fragment from the attempt." },
          fix: { type: "string", description: "The corrected fragment." },
          why: { type: "string", description: "The rule/reason, in English." },
        },
        required: ["original", "fix", "why"],
      },
    },
    overall: { type: "string", description: "One short, friendly assessment in English." },
    encouragement: { type: "string", description: "A brief encouraging line." },
  },
  required: ["corrected", "correctedTranslit", "isCorrect", "issues", "overall", "encouragement"],
};

/** Correct a learner's written attempt at a task, explaining the key fixes. Live tier (Sonnet 4.6). */
export async function correct(attempt: string, task: string, ctx: WritingContext): Promise<WritingCorrectionResult> {
  const user = [
    `TASK (what they were asked to write, in English): ${task}`,
    "",
    `Learner's written attempt: ${attempt}`,
    "",
    "Correct it and explain the key fixes for a beginner.",
  ].join("\n");
  const res = await structuredCall<WritingCorrection>({
    model: MODELS.live,
    system: writingSystem(ctx),
    user,
    schema: WRITING_SCHEMA,
    effort: "low",
    maxTokens: 1500,
  });
  return { correction: res.data, ms: res.ms, costUsd: res.costUsd };
}
