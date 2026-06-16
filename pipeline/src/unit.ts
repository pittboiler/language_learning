// pipeline/src/unit.ts — CURRICULUM-driven content generation. Each generator takes a CurriculumUnit
// (from architect.ts / curriculum-<code>.json) and emits gated pack content for THAT unit: its
// vocab/chunks, a mini-story, and (via the proven generator.ts) a task-based scenario. Opus 4.8,
// offline; everything `confidence:"unreviewed"`. Language-agnostic — the unit + a GenContext carry the
// target language; nothing is hardcoded. Scenario generation reuses generator.ts verbatim (anchored to
// the authored reference); info-gap reuses infogap.ts. This module adds the vocab + mini-story pieces
// the curriculum needs that did not exist before (the old content.ts generators were café-only).
import type { ReviewItem, MiniStory, StorySegment, StoryQA, GrammarConcept, Reader, WritingTask, DialogueTurn } from "@ll/pack-schema";
import { structuredCall, MODELS } from "@ll/core/llm";
import { normalize } from "@ll/core/familiarity";
import type { CurriculumUnit } from "./architect.js";
import { generateScenario, type Situation, type GenContext, type GeneratedScenario } from "./generator.js";

export interface UnitGenContext {
  languageName: string;
  stressRule?: string;
  /** Style anchor for scenarios (the authored order-a-drink), passed straight to generator.ts. */
  scenario: GenContext;
}

// ----------------------------------------------------------------------------------------------
// Vocab / chunks — enrich the unit's curated coreLexis into ReviewItems (translit + gender + note).
// The target TEXT is copied verbatim from the curriculum (no drift); the model only supplies the
// romanization, gender, and an optional note. i1Level / freqRank / kind come straight from the unit.
// ----------------------------------------------------------------------------------------------

const VOCAB_ENRICH_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string", description: "The target-language form, COPIED EXACTLY from the input (never altered)." },
          translit: { type: "string", description: "Romanization of text." },
          gender: { type: "string", description: "masculine|feminine|neuter for a SINGLE noun only; otherwise empty string." },
          note: { type: "string", description: "Optional short usage/stress note; empty string if none." },
        },
        required: ["text", "translit", "gender", "note"],
      },
    },
  },
  required: ["items"],
};

interface VocabEnrichData {
  items: { text: string; translit: string; gender: string; note: string }[];
}

export interface GeneratedUnitVocab {
  items: ReviewItem[];
  costUsd: number;
}

/** Turn the unit's coreLexis into gated ReviewItems (translit/gender/note via Opus; text verbatim). */
export async function generateUnitVocab(unit: CurriculumUnit, ctx: UnitGenContext): Promise<GeneratedUnitVocab> {
  const list = unit.coreLexis.map((l, i) => `${i + 1}. ${l.text}  —  ${l.gloss}`).join("\n");
  const system = `You are an expert ${ctx.languageName} lexicographer preparing beginner flashcards. For EACH given item, return an accurate romanization, the grammatical gender (ONLY for a single noun; otherwise empty), and an optional short usage/stress note.${ctx.stressRule ? ` Stress rule: ${ctx.stressRule}.` : ""}

CRITICAL: COPY each item's target-language text EXACTLY as given — never translate, correct, reorder, or alter it (not even punctuation or the "…" placeholder). Return the items in the same order.`;

  const { data, costUsd } = await structuredCall<VocabEnrichData>({
    model: MODELS.offline,
    system,
    user: `Items (target — gloss):\n${list}\n\nEnrich each.`,
    schema: VOCAB_ENRICH_SCHEMA,
    effort: "high",
    thinking: true,
    maxTokens: 3000,
  });

  const items: ReviewItem[] = unit.coreLexis.map((l, i) => {
    const e = data.items[i];
    const gender = (e?.gender ?? "").trim();
    const note = (e?.note ?? "").trim();
    return {
      id: `gen-${unit.id}-v${i + 1}`,
      kind: l.kind === "chunk" ? "phrase" : "vocab",
      prompt: l.gloss,
      answer: l.text,
      ...(e?.translit ? { translit: e.translit } : {}),
      gloss: l.gloss,
      ...(note ? { note } : {}),
      i1Level: l.i1Level,
      tags: ["generated", unit.id, ...unit.functions.slice(0, 2)],
      meta: { freqRank: l.freqRank, ...(gender ? { gender } : {}) },
      confidence: "unreviewed" as const,
    };
  });
  return { items, costUsd };
}

// ----------------------------------------------------------------------------------------------
// Mini-story — the comprehensible-input spine for the unit (synced segments + Q&A + spoken prompt).
// Anchored to the authored ana-coffee style; uses the unit's lexis; pitched at the unit's level.
// ----------------------------------------------------------------------------------------------

const STORY_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", description: "Short title in the target language." },
    titleGloss: { type: "string", description: "English gloss of the title." },
    body: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string", description: "One short, simple sentence in the target language." },
          translit: { type: "string", description: "Romanization." },
          gloss: { type: "string", description: "English gloss." },
        },
        required: ["text", "translit", "gloss"],
      },
    },
    qa: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          question: { type: "string", description: "Target-language comprehension question." },
          questionGloss: { type: "string" },
          answer: { type: "string", description: "Expected short answer in the target language." },
          answerGloss: { type: "string" },
          answerTranslit: { type: "string" },
          spokenPrompt: { type: "boolean", description: "True for EXACTLY ONE item — a 'say it aloud' production prompt." },
        },
        required: ["question", "questionGloss", "answer", "answerGloss", "answerTranslit", "spokenPrompt"],
      },
    },
  },
  required: ["title", "titleGloss", "body", "qa"],
};

interface StoryData {
  title: string;
  titleGloss: string;
  body: { text: string; translit: string; gloss: string }[];
  qa: { question: string; questionGloss: string; answer: string; answerGloss: string; answerTranslit: string; spokenPrompt: boolean }[];
}

export interface GeneratedUnitStory {
  story: MiniStory;
  costUsd: number;
}

/** Generate a short gated mini-story for the unit (CI on-ramp; ends in a spoken production prompt). */
export async function generateUnitMiniStory(unit: CurriculumUnit, ctx: UnitGenContext): Promise<GeneratedUnitStory> {
  const lexis = unit.coreLexis.map((l) => `${l.text} (${l.gloss})`).join("; ");
  const system = `You are an expert ${ctx.languageName} curriculum author writing a SHORT mini-story for an ABSOLUTE BEGINNER, in the comprehensible-input tradition (simple, high-frequency, a tiny narrative arc). Match this hand-authored style: a named character, 6-9 very short sentences, present tense, lots of dialogue, reusing the unit's taught chunks.

The unit teaches the FUNCTION(S): ${unit.functions.join(", ")} — in the situation: ${unit.situation}. Weave in these taught chunks naturally: ${lexis}.

Requirements:
- 6-9 short body sentences, each with romanization + a faithful English gloss. Correct ${ctx.languageName} throughout (gender agreement, definite articles${ctx.stressRule ? ", stress" : ""}).
- 2-3 Q&A items that re-use the story's vocabulary in a new frame. EXACTLY ONE qa item has spokenPrompt=true — phrase it as a 'say it aloud' production task whose answer is one of the unit's taught chunks.
- Keep it at the unit's level (${unit.cefr}). Do not introduce hard grammar the unit hasn't taught.`;

  const { data, costUsd } = await structuredCall<StoryData>({
    model: MODELS.offline,
    system,
    user: `Write the mini-story for unit "${unit.title}".`,
    schema: STORY_SCHEMA,
    effort: "high",
    thinking: true,
    maxTokens: 4000,
  });

  const body: StorySegment[] = data.body.map((s) => ({ text: s.text, translit: s.translit, gloss: s.gloss }));
  const qa: StoryQA[] = data.qa.map((q, i) => ({
    id: `q${i + 1}`,
    question: q.question,
    questionGloss: q.questionGloss,
    answer: q.answer,
    answerGloss: q.answerGloss,
    ...(q.answerTranslit ? { answerTranslit: q.answerTranslit } : {}),
    ...(q.spokenPrompt ? { spokenPrompt: true } : {}),
  }));
  const i1Level = Math.min(...unit.coreLexis.map((l) => l.i1Level));
  const registersVocab = unit.coreLexis
    .filter((l) => !l.text.includes("…") && !l.text.includes("/") && !l.text.includes(","))
    .map((l) => ({ lexKey: normalize(l.text), gloss: l.gloss }));

  const story: MiniStory = {
    id: `gen-${unit.id}-story`,
    title: data.title,
    titleGloss: data.titleGloss,
    i1Level: Number.isFinite(i1Level) ? i1Level : 1,
    level: unit.cefr,
    theme: unit.title,
    audioSource: "tts",
    body,
    qa,
    registersVocab,
    confidence: "unreviewed",
  };
  return { story, costUsd };
}

// ----------------------------------------------------------------------------------------------
// Scenario — reuse generator.ts verbatim, driving it with a Situation synthesized from the unit
// (functions + situation + the taught chunks to use + the earlier units to recycle).
// ----------------------------------------------------------------------------------------------

/** Adapt a CurriculumUnit into the generator's Situation shape (goal encodes the taught chunks + the
 *  units to recycle, so the proven generator.ts produces unit-appropriate, spiraling dialogue). */
export function unitToSituation(unit: CurriculumUnit): Situation {
  const chunks = unit.coreLexis.slice(0, 6).map((l) => l.text).join("; ");
  const recycle = unit.recycles.length ? ` Recycle earlier material: ${unit.recycles.join(", ")}.` : "";
  return {
    id: unit.id,
    title: unit.title,
    goal: `Practise these functions: ${unit.functions.join(", ")}. Use the taught chunks where natural: ${chunks}.${recycle}`,
    setting: unit.situation,
  };
}

/** Generate the unit's scenario via the proven generator.ts (anchored to the authored reference). */
export async function generateUnitScenario(unit: CurriculumUnit, ctx: UnitGenContext): Promise<GeneratedScenario> {
  return generateScenario(unitToSituation(unit), ctx.scenario);
}

// ----------------------------------------------------------------------------------------------
// Grammar concepts + MC drills — only the unit's produce:true grammar points (rule-first, minimal).
// Mirrors content.ts's grammar shape; keyed by the point's id so concept ids match the profile/pack.
// ----------------------------------------------------------------------------------------------

const GRAMMAR_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    concepts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", description: "Use the EXACT id from the given grammar point." },
          name: { type: "string" },
          explanation: { type: "string", description: "1-3 sentences, RULE FIRST, a beginner can follow." },
          examples: { type: "array", items: { type: "string" }, description: "2-3 'target → gloss' example strings." },
          drills: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                prompt: { type: "string", description: "The question/cue (e.g. a fill-in)." },
                options: { type: "array", items: { type: "string" }, description: "2-4 DISTINCT target-language options." },
                answer: { type: "string", description: "The correct option — MUST be exactly one of options." },
                why: { type: "string", description: "One line: why the answer is correct." },
                gloss: { type: "string", description: "English gloss of the correct answer." },
              },
              required: ["prompt", "options", "answer", "why", "gloss"],
            },
          },
        },
        required: ["id", "name", "explanation", "examples", "drills"],
      },
    },
  },
  required: ["concepts"],
};

interface GrammarData {
  concepts: { id: string; name: string; explanation: string; examples: string[]; drills: { prompt: string; options: string[]; answer: string; why: string; gloss: string }[] }[];
}

export interface GeneratedUnitGrammar {
  concepts: GrammarConcept[];
  costUsd: number;
}

/** Expand the unit's produce:true grammar points into gated GrammarConcepts with MC drills. */
export async function generateUnitGrammar(unit: CurriculumUnit, ctx: UnitGenContext): Promise<GeneratedUnitGrammar> {
  const points = unit.grammarPoints.filter((p) => p.produce);
  if (!points.length) return { concepts: [], costUsd: 0 };
  const pts = points.map((p) => `- ${p.id}: ${p.rule}`).join("\n");
  const system = `You are an expert ${ctx.languageName} curriculum author. For an ABSOLUTE BEGINNER, expand EACH given grammar point into a CONCEPT with multiple-choice drills, RULE FIRST.

Grammar points to teach (use these EXACT ids and rules; one concept each):
${pts}

Requirements:
- One concept per point, keyed by the given id. A short name, a 1-3 sentence explanation that states the RULE FIRST, and 2-3 "target → gloss" examples.
- 2-3 MULTIPLE-CHOICE drills per concept: a prompt, 2-4 options in ${ctx.languageName}, the correct answer (EXACTLY one of the options), a one-line "why", and an English gloss. Distractors must be DISTINCT and plausible.
- Correct, natural ${ctx.languageName} with correct agreement/forms${ctx.stressRule ? ` and stress (${ctx.stressRule})` : ""}. Do not invent forms.`;

  const { data, costUsd } = await structuredCall<GrammarData>({
    model: MODELS.offline,
    system,
    user: `Produce the grammar concepts for unit "${unit.title}".`,
    schema: GRAMMAR_SCHEMA,
    effort: "high",
    thinking: true,
    maxTokens: 5000,
  });

  const concepts: GrammarConcept[] = data.concepts.map((c) => ({
    id: c.id,
    name: c.name,
    explanation: c.explanation,
    examples: c.examples,
    confidence: "unreviewed" as const,
    drills: c.drills.map((d, i) => ({
      id: `gen-${unit.id}-${c.id}-d${i + 1}`,
      kind: "grammar" as const,
      prompt: d.prompt,
      answer: d.answer,
      gloss: d.gloss,
      options: d.options,
      why: d.why,
      i1Level: 2,
      tags: ["grammar", c.id, unit.id],
      confidence: "unreviewed" as const,
    })),
  }));
  return { concepts, costUsd };
}

// ----------------------------------------------------------------------------------------------
// Graded reader — a short, simple text in the unit's situation, reusing its lexis. Mirrors content.ts.
// ----------------------------------------------------------------------------------------------

const READER_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", description: "Short title in the target language." },
    titleGloss: { type: "string", description: "English gloss of the title." },
    body: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string", description: "One short sentence in the target language." },
          translit: { type: "string", description: "Romanization." },
          gloss: { type: "string", description: "English gloss." },
        },
        required: ["text", "translit", "gloss"],
      },
    },
  },
  required: ["title", "titleGloss", "body"],
};

interface ReaderData {
  title: string;
  titleGloss: string;
  body: { text: string; translit: string; gloss: string }[];
}

export interface GeneratedUnitReader {
  reader: Reader;
  costUsd: number;
}

/** Generate a short gated graded reader for the unit (5-6 lines, reusing the unit's lexis). */
export async function generateUnitReader(unit: CurriculumUnit, ctx: UnitGenContext): Promise<GeneratedUnitReader> {
  const lexis = unit.coreLexis.map((l) => l.text).join("; ");
  const system = `You are an expert ${ctx.languageName} curriculum author. Write a SHORT graded reader for an ABSOLUTE BEGINNER: 5-6 very simple sentences telling a tiny story set in "${unit.situation}", reusing these taught chunks where natural: ${lexis}. Each line: ${ctx.languageName} text, a romanization, and an English gloss. Keep sentences short and natural; correct grammar and agreement${ctx.stressRule ? " and stress" : ""} throughout.`;

  const { data, costUsd } = await structuredCall<ReaderData>({
    model: MODELS.offline,
    system,
    user: `Write the reader for unit "${unit.title}".`,
    schema: READER_SCHEMA,
    effort: "high",
    thinking: true,
    maxTokens: 3000,
  });

  const i1Level = Math.max(...unit.coreLexis.map((l) => l.i1Level));
  const reader: Reader = {
    id: `gen-${unit.id}-reader`,
    title: data.title,
    titleGloss: data.titleGloss,
    theme: unit.title,
    i1Level: Number.isFinite(i1Level) ? i1Level : 2,
    confidence: "unreviewed",
    body: data.body.map<DialogueTurn>((l) => ({ speaker: "partner", text: l.text, translit: l.translit, gloss: l.gloss })),
  };
  return { reader, costUsd };
}

// ----------------------------------------------------------------------------------------------
// Writing tasks — English production prompts tied to the unit's functions/grammar. No target language
// is generated, so these need no Validator pass (cheap).
// ----------------------------------------------------------------------------------------------

const WRITING_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          prompt: { type: "string", description: "A single clear ENGLISH instruction; the learner produces the target language." },
          targetConcepts: { type: "array", items: { type: "string" }, description: "Grammar concept ids this exercises (may be empty)." },
        },
        required: ["prompt", "targetConcepts"],
      },
    },
  },
  required: ["tasks"],
};

export interface GeneratedUnitWriting {
  tasks: WritingTask[];
  costUsd: number;
}

/** Generate 2-3 gated writing prompts (English instructions) for the unit. No target language → no validation. */
export async function generateUnitWriting(unit: CurriculumUnit, ctx: UnitGenContext): Promise<GeneratedUnitWriting> {
  const grammarIds = unit.grammarPoints.filter((p) => p.produce).map((p) => p.id);
  const system = `You are an expert ${ctx.languageName} curriculum author. Produce 2-3 short WRITING prompts for an ABSOLUTE BEGINNER to practise the functions: ${unit.functions.join(", ")}, in the situation "${unit.situation}". Each prompt is ONE clear instruction in ENGLISH (the learner will write ${ctx.languageName}; the tutor corrects). Tag which grammar concepts it exercises from: ${grammarIds.join(", ") || "(none available)"}.`;

  const { data, costUsd } = await structuredCall<{ tasks: { prompt: string; targetConcepts: string[] }[] }>({
    model: MODELS.offline,
    system,
    user: `Produce the writing prompts for unit "${unit.title}".`,
    schema: WRITING_SCHEMA,
    effort: "medium",
    thinking: true,
    maxTokens: 1500,
  });

  const i1Level = Math.max(...unit.coreLexis.map((l) => l.i1Level));
  const tasks: WritingTask[] = data.tasks.map((t, i) => ({
    id: `gen-${unit.id}-w${i + 1}`,
    prompt: t.prompt,
    ...(t.targetConcepts.length ? { targetConcepts: t.targetConcepts } : {}),
    i1Level: Number.isFinite(i1Level) ? i1Level : 2,
    confidence: "unreviewed",
  }));
  return { tasks, costUsd };
}
