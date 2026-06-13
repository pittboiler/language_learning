// Import-anything — turn arbitrary target-language text (paste / URL / transcript) into a
// familiarity-tracked, glossed, audio-backed reader, WITHOUT crowd-sourced glosses (LingQ's weak spot
// for low-resource languages). It REUSES the existing pipeline agents — no parallel critic:
//   • generator-style structured call → segment the text + generate accurate glosses + chunk
//     suggestions + emit TTS jobs (Opus 4.8, offline; mirrors generator.ts).
//   • validator.ts (the SAME Validator/Critic) → gate the generated glosses, flag low-confidence.
//   • core/familiarity scoring → difficulty-score the result so it's only recommended near i+1.
// See DESIGN-comprehensible-input.md §2.4 / Part C.
import type { MiniStory, StorySegment } from "@ll/pack-schema";
import { structuredCall, MODELS } from "@ll/core/llm";
import { normalize } from "@ll/core/familiarity";
import { validate, type Verdict, type ValidatorContext, type ValidatableItem } from "./validator.js";

export interface ImportRequest {
  source: "paste" | "url" | "transcript";
  raw: string; // pasted text, a URL to fetch+extract, or a transcript blob
  title?: string;
}

export interface ImportContext {
  languageName: string;
  /** Reuse the same Validator context (languageName, stressRule, referenceStyle) as the batch. */
  validator: ValidatorContext;
}

export interface ImportedReader {
  /** The imported content as a MiniStory (segments + glosses), confidence:"unreviewed". */
  reader: MiniStory;
  /** Per-gloss verdicts from the reused Validator — low-confidence glosses flagged, not authoritative. */
  verdicts: Verdict[];
  /** TTS jobs to synthesize offline + cache (audioSource:"tts"). */
  ttsJobs: { segmentId: string; text: string }[];
  /** Lex keys discovered (chunks), for difficulty scoring + familiarity recommendation (Part A). */
  lexKeys: string[];
  costUsd: number;
}

const IMPORT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    segments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string", description: "One short natural segment, verbatim from the input." },
          gloss: { type: "string", description: "Faithful English translation." },
          translit: { type: "string", description: "Romanization." },
        },
        required: ["text", "gloss", "translit"],
      },
    },
    chunks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { phrase: { type: "string" }, gloss: { type: "string" } },
        required: ["phrase", "gloss"],
      },
    },
  },
  required: ["segments", "chunks"],
};

interface ImportData {
  segments: { text: string; gloss: string; translit: string }[];
  chunks: { phrase: string; gloss: string }[];
}

/**
 * Import + structure outside content. Offline, gated. Reuses generator-style generation (Opus 4.8) +
 * the Validator (the SAME critic as the batch). Difficulty scoring (core/familiarity/scoring) is
 * applied by the caller so the reader is recommended only near the learner's i+1 level.
 */
export async function importContent(req: ImportRequest, ctx: ImportContext): Promise<ImportedReader> {
  // 1. Segment + gloss + chunk-suggest (Opus 4.8, offline — same quality bar as generator.ts).
  const gen = await structuredCall<ImportData>({
    model: MODELS.offline,
    system: `You prepare imported ${ctx.languageName} text for an absolute beginner's reader. Split it into short natural segments (sentences/clauses), keeping the wording verbatim. For each segment give a faithful English gloss + romanization. Suggest up to 10 high-value multi-word CHUNKS with glosses. Be accurate; never invent or alter words.`,
    user: req.raw.slice(0, 6000),
    schema: IMPORT_SCHEMA,
    effort: "high",
    thinking: true,
    maxTokens: 6000,
  });
  let costUsd = gen.costUsd;

  // 2. Gate the glosses through the REUSED Validator (no parallel critic).
  const items: ValidatableItem[] = gen.data.segments.map((s, i) => ({ id: `imp-l${i + 1}`, kind: "reader-line", text: s.text, gloss: s.gloss }));
  const verdicts = await validate(items, ctx.validator);
  costUsd += verdicts.reduce((sum, v) => sum + v.costUsd, 0);

  // 3. Assemble a gated MiniStory + TTS jobs.
  const body: StorySegment[] = gen.data.segments.map((s) => ({ text: s.text, translit: s.translit, gloss: s.gloss }));
  const slug = (req.title ?? "text").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "text";
  const reader: MiniStory = {
    id: `import-${slug}`,
    title: req.title ?? "Imported text",
    i1Level: 3,
    level: "A2",
    audioSource: "tts",
    body,
    qa: [],
    registersVocab: gen.data.chunks.map((c) => ({ lexKey: normalize(c.phrase), gloss: c.gloss })),
    confidence: "unreviewed",
  };
  const ttsJobs = body.map((s, i) => ({ segmentId: `imp-l${i + 1}`, text: s.text }));

  return { reader, verdicts, ttsJobs, lexKeys: reader.registersVocab.map((v) => v.lexKey), costUsd };
}
