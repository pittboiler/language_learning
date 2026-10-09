// @ll/core/exam — marking one task of an open-book exam (midterm / final), with the pure roll-up of task
// results re-exported from ./results. Language-agnostic: the pack supplies the task, the can-dos and the
// grammar; the learner's answer arrives as written text or as what two speech engines heard.
import { MODELS, structuredCall } from "../llm/index.js";
import type { ExamGrade } from "./results.js";
export * from "./results.js";

export interface ExamTaskInput {
  languageName: string;
  mode: "speak" | "write";
  title: string;
  scene: string;
  steps: string[];
  canDos: { id: string; text: string }[];
  /** The grammar this task leans on: "title: rule" lines. Only these are held to accuracy. */
  grammar: string[];
  /** What they wrote (write), or the better transcript (speak). */
  response: string;
  /** Speak: what each speech engine heard. */
  transcripts?: { scribe?: string; google?: string };
}

const SYSTEM = (lang: string) => `You mark one task of an open-book exam for an adult beginner learning ${lang} (around CEFR A1–A2).

Judge communication first: did they get each step across in ${lang}, so that a friendly native speaker would understand? Then accuracy, but only on the grammar listed for this task; don't mark down things the course hasn't taught yet. It is open book, so a polished answer is expected and fine. Different wording from the model is fine; any natural way of saying it counts.

For a spoken answer you get what two speech-recognition engines heard. They often mishear beginners: treat small spelling differences, missing punctuation and odd word boundaries as noise, and give the benefit of the doubt when either transcript shows the right words. If neither transcript is usable (empty, the wrong language, or clearly garbled), set "unclear" to true and leave the judgment neutral ("partly", no corrections).

Results per can-do: "met" = got it across, with at most small slips; "partly" = some of it, or with errors that get in the way; "not-yet" = missing or not understandable. Judge only the can-dos listed.

Corrections: at most four, the most useful first. Quote exactly what they wrote or said, give the corrected ${lang}, and say why in one short English sentence. Never correct transcript noise, and never correct something that is already right.

Summary: one or two warm, specific sentences in English, addressed to the learner as "you": what went well, and the one thing to work on.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["steps", "canDos", "corrections", "summary", "unclear"],
  properties: {
    steps: { type: "array", items: { type: "object", additionalProperties: false, required: ["index", "done"], properties: { index: { type: "integer" }, done: { type: "string", enum: ["yes", "partly", "no"] } } } },
    canDos: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "result", "note"], properties: { id: { type: "string" }, result: { type: "string", enum: ["met", "partly", "not-yet"] }, note: { type: "string" } } } },
    corrections: { type: "array", items: { type: "object", additionalProperties: false, required: ["wrote", "better", "why"], properties: { wrote: { type: "string" }, better: { type: "string" }, why: { type: "string" } } } },
    summary: { type: "string" },
    unclear: { type: "boolean" },
  },
} as const;

export function taskPrompt(t: ExamTaskInput): string {
  const answer = t.mode === "write"
    ? `What they wrote:\n${t.response.trim() || "(nothing)"}`
    : `What they said (two speech engines):\n- engine 1: ${t.transcripts?.scribe?.trim() || "(nothing)"}\n- engine 2: ${t.transcripts?.google?.trim() || "(nothing)"}`;
  return [
    `Task (${t.mode === "write" ? "writing" : "speaking"}): ${t.title}`,
    `Situation: ${t.scene}`,
    `Steps to get across, in order:\n${t.steps.map((s, i) => `${i}. ${s}`).join("\n")}`,
    `Can-dos to judge:\n${t.canDos.map((c) => `- ${c.id}: ${c.text}`).join("\n")}`,
    `Grammar held to accuracy here:\n${t.grammar.map((g) => `- ${g}`).join("\n")}`,
    answer,
  ].join("\n\n");
}

/** Mark one task. Results are clamped to the task's own steps and can-dos (the model can't invent others). */
export async function gradeExamTask(t: ExamTaskInput): Promise<{ grade: ExamGrade; ms: number; costUsd: number }> {
  const out = await structuredCall<ExamGrade>({
    model: MODELS.grade,
    system: SYSTEM(t.languageName),
    user: taskPrompt(t),
    schema: SCHEMA as unknown as Record<string, unknown>,
    effort: "medium",
    maxTokens: 16000,
    fallback: true,
  });
  const ids = new Set(t.canDos.map((c) => c.id));
  const g = out.data;
  const grade: ExamGrade = {
    steps: t.steps.map((_, index) => g.steps.find((s) => s.index === index) ?? { index, done: "no" as const }),
    canDos: t.canDos.map((c) => g.canDos.find((x) => x.id === c.id && ids.has(x.id)) ?? { id: c.id, result: "partly" as const, note: "" }),
    corrections: g.corrections.slice(0, 4),
    summary: g.summary,
    unclear: t.mode === "speak" && g.unclear,
  };
  return { grade, ms: out.ms, costUsd: out.costUsd };
}

