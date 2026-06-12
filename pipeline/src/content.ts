import type { GlyphLesson, GrammarConcept, ReviewItem, Reader, DialogueTurn } from "@ll/pack-schema";
import { structuredCall, MODELS } from "@ll/core/llm";
import type { LanguageProfile } from "./profiler.js";

// Opus 4.8, offline content generators for the NON-scenario pieces of a pack (alphabet onboarding,
// grammar concepts + drills, vocab, a graded reader). Each is anchored to the LanguageProfile and
// emits confidence:"unreviewed" — gated until the Validator + a human spot-check clear it. Scenarios
// have their own generator (generator.ts); this module covers everything else the pack needs.
// Language-agnostic: the target language comes from the profile, nothing is hardcoded.

export interface GenOutput<T> {
  data: T;
  costUsd: number;
}

// ----------------------------------------------------------------------------------------------
// Alphabet onboarding
// ----------------------------------------------------------------------------------------------

const ALPHABET_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    letters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          glyph: { type: "string", description: "Single uppercase letter." },
          name: { type: "string", description: "The letter's name (how it's called)." },
          sound: { type: "string", description: "Informal sound description for an English speaker, e.g. \"'zh' (measure)\"." },
          exampleText: { type: "string", description: "A common beginner word that uses this letter, in the target language." },
          exampleGloss: { type: "string", description: "English gloss of the example word." },
          unique: { type: "boolean", description: "A distinctive/hard letter for this language worth dedicated focus." },
          falseFriend: { type: "boolean", description: "Looks like a Latin letter but sounds different." },
        },
        required: ["glyph", "name", "sound", "exampleText", "exampleGloss", "unique", "falseFriend"],
      },
    },
  },
  required: ["letters"],
};

interface AlphabetData {
  letters: { glyph: string; name: string; sound: string; exampleText: string; exampleGloss: string; unique: boolean; falseFriend: boolean }[];
}

/** Generate the COMPLETE alphabet as glyph lessons, anchored to the profile's inventory facts. */
export async function generateAlphabet(profile: LanguageProfile): Promise<GenOutput<GlyphLesson[]>> {
  const system = `You are an expert ${profile.languageName} teacher building Cyrillic/script onboarding for an ABSOLUTE BEGINNER (English speaker).

Produce the COMPLETE modern ${profile.languageName} alphabet, in standard alphabetical order, EVERY letter exactly once and NO letters that don't belong.

Authoritative inventory facts (do not contradict these):
- ${profile.alphabet.note}
- Distinctive letters worth dedicated focus: ${profile.alphabet.distinctiveLetters.join(" ")}
- False friends (look like a Latin letter but sound different): ${profile.alphabet.falseFriends.join(" ")}

For each letter: its name, an informal English-speaker sound description, and ONE common beginner example word (in ${profile.languageName}) with an English gloss. Set unique=true for the distinctive letters above, falseFriend=true for the false friends above (a letter can be one or neither; don't set both). Example words must be real, correctly spelled, and beginner-appropriate.`;

  const { data, costUsd } = await structuredCall<AlphabetData>({
    model: MODELS.offline,
    system,
    user: `Produce the full ${profile.languageName} alphabet as glyph lessons.`,
    schema: ALPHABET_SCHEMA,
    effort: "high",
    thinking: true,
    maxTokens: 6000,
  });

  const letters: GlyphLesson[] = data.letters.map((l) => ({
    glyph: l.glyph,
    name: l.name,
    sound: l.sound,
    examples: [{ text: l.exampleText, gloss: l.exampleGloss }],
    ...(l.unique ? { unique: true } : {}),
    ...(l.falseFriend ? { falseFriend: true } : {}),
    confidence: "unreviewed" as const,
  }));
  return { data: letters, costUsd };
}

// ----------------------------------------------------------------------------------------------
// Grammar concepts + drills
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
          id: { type: "string", description: "Short stable kebab-case id." },
          name: { type: "string" },
          explanation: { type: "string", description: "1-3 sentences a beginner can follow." },
          examples: { type: "array", items: { type: "string" }, description: "2-3 'target → gloss' example strings." },
          drills: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                prompt: { type: "string", description: "The question/cue, e.g. 'the book (neutral)' or a fill-in." },
                options: { type: "array", items: { type: "string" }, description: "2-4 target-language options." },
                answer: { type: "string", description: "The correct option — MUST be exactly one of options." },
                why: { type: "string", description: "One line explaining why the answer is correct." },
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
  concepts: {
    id: string;
    name: string;
    explanation: string;
    examples: string[];
    drills: { prompt: string; options: string[]; answer: string; why: string; gloss: string }[];
  }[];
}

/** Generate beginner grammar concepts with multiple-choice drills, anchored to the profile's
 *  load-bearing features. */
export async function generateGrammar(profile: LanguageProfile): Promise<GenOutput<GrammarConcept[]>> {
  const features = profile.grammarFeaturesThatMatter.map((f) => `- ${f.id} — ${f.name}: ${f.why}`).join("\n");
  const system = `You are an expert ${profile.languageName} curriculum author. Produce 3-4 GRAMMAR CONCEPTS that matter most for an ABSOLUTE BEGINNER, drawn from this language's load-bearing features:

${features}

Requirements:
- Choose the 3-4 features that are most useful AND most drillable for a beginner aiming at simple café/small-talk conversation (e.g. the definite article, gender agreement, a core verb construction). Skip features that can only be recognized, not yet produced.
- Each concept: a short id, a name, a 1-3 sentence explanation, and 2-3 "target → gloss" examples.
- Each concept has 2-3 MULTIPLE-CHOICE drills. Each drill: a prompt, 2-4 options in ${profile.languageName}, the correct answer (EXACTLY one of the options), a one-line "why", and an English gloss.
- Everything must be correct, natural ${profile.languageName} with correct agreement and forms. Do not invent forms.`;

  const { data, costUsd } = await structuredCall<GrammarData>({
    model: MODELS.offline,
    system,
    user: `Produce the beginner grammar concepts + drills for ${profile.languageName}.`,
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
      id: `${c.id}-d${i + 1}`,
      kind: "grammar" as const,
      prompt: d.prompt,
      answer: d.answer,
      gloss: d.gloss,
      options: d.options,
      why: d.why,
      i1Level: 2,
      tags: ["grammar", c.id],
      confidence: "unreviewed" as const,
    })),
  }));
  return { data: concepts, costUsd };
}

// ----------------------------------------------------------------------------------------------
// Vocab
// ----------------------------------------------------------------------------------------------

const VOCAB_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    vocab: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          answer: { type: "string", description: "Word/phrase in the target language." },
          translit: { type: "string", description: "Romanization." },
          gloss: { type: "string", description: "English." },
          kind: { type: "string", enum: ["vocab", "phrase"] },
          gender: { type: "string", description: "For a noun: masculine|feminine|neuter; otherwise empty string." },
          note: { type: "string", description: "Optional short usage/stress note; empty string if none." },
        },
        required: ["answer", "translit", "gloss", "kind", "gender", "note"],
      },
    },
  },
  required: ["vocab"],
};

interface VocabData {
  vocab: { answer: string; translit: string; gloss: string; kind: "vocab" | "phrase"; gender: string; note: string }[];
}

/** Generate high-frequency beginner vocab/phrases for café + small-talk, anchored to the profile. */
export async function generateVocab(profile: LanguageProfile): Promise<GenOutput<ReviewItem[]>> {
  const system = `You are an expert ${profile.languageName} curriculum author. Produce 10-12 of the most useful beginner VOCAB items and PHRASES for ordering at a bar/café and basic small-talk (greetings, drinks, "please/thanks", asking price/the bill, "where are you from", "I'm learning ${profile.languageName}").

For each: the ${profile.languageName} answer, a romanization, a faithful English gloss, kind ("vocab" for single words, "phrase" for multi-word), gender (for nouns only: masculine/feminine/neuter; else ""), and an optional short note (stress/usage; else ""). Use correct, natural, beginner-appropriate ${profile.languageName}. High-frequency starting points: ${profile.highFrequencyVocab.join(", ")}.`;

  const { data, costUsd } = await structuredCall<VocabData>({
    model: MODELS.offline,
    system,
    user: `Produce the beginner café + small-talk vocab for ${profile.languageName}.`,
    schema: VOCAB_SCHEMA,
    effort: "high",
    thinking: true,
    maxTokens: 4000,
  });

  const vocab: ReviewItem[] = data.vocab.map((v, i) => ({
    id: `v-bg-${i + 1}`,
    kind: v.kind,
    prompt: v.gloss,
    answer: v.answer,
    translit: v.translit,
    gloss: v.gloss,
    ...(v.note.trim() ? { note: v.note.trim() } : {}),
    i1Level: v.kind === "phrase" ? 2 : 1,
    tags: ["generated"],
    ...(v.gender.trim() ? { meta: { gender: v.gender.trim() } } : {}),
    confidence: "unreviewed" as const,
  }));
  return { data: vocab, costUsd };
}

// ----------------------------------------------------------------------------------------------
// Graded reader
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

/** Generate a short graded reader (5-6 simple lines) reinforcing café vocab + the definite article. */
export async function generateReader(profile: LanguageProfile): Promise<GenOutput<Reader>> {
  const system = `You are an expert ${profile.languageName} curriculum author. Write a SHORT graded reader for an ABSOLUTE BEGINNER: 5-6 very simple sentences telling a tiny story set in a café (someone enters, orders a drink, the waiter responds, they enjoy it). Reinforce high-frequency café vocab and the definite article. Each line: ${profile.languageName} text, a romanization, and an English gloss. Keep sentences short and natural; correct grammar and agreement throughout.`;

  const { data, costUsd } = await structuredCall<ReaderData>({
    model: MODELS.offline,
    system,
    user: `Write the beginner café reader in ${profile.languageName}.`,
    schema: READER_SCHEMA,
    effort: "high",
    thinking: true,
    maxTokens: 3000,
  });

  const reader: Reader = {
    id: "cafe",
    title: data.title,
    titleGloss: data.titleGloss,
    i1Level: 2,
    confidence: "unreviewed",
    body: data.body.map<DialogueTurn>((l) => ({ speaker: "partner", text: l.text, translit: l.translit, gloss: l.gloss })),
  };
  return { data: reader, costUsd };
}
