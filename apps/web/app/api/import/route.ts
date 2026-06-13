// Import-anything (interactive). Paste target-language text → ONE structured call (Sonnet, the live
// tier — it reads the low-resource language and emits English glosses + romanization) → segments +
// chunk suggestions, returned GATED (confidence:"unreviewed"). The client renders it as a tap-to-
// capture, difficulty-scored reader. The OFFLINE pipeline (pipeline/import.ts) adds the Validator pass
// for content you want to promote into a pack — that's the trusted path; this is the quick look-up.
import { structuredCall, MODELS } from "@ll/core/llm";
import { getPack } from "../../../lib/packs";

export const runtime = "nodejs";
export const maxDuration = 30;

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
          text: { type: "string", description: "One short natural segment (sentence/clause), verbatim from the input." },
          gloss: { type: "string", description: "Faithful English translation of the segment." },
          translit: { type: "string", description: "Romanization of the segment." },
        },
        required: ["text", "gloss", "translit"],
      },
    },
    chunks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          phrase: { type: "string", description: "A useful multi-word collocation/phrase to capture." },
          gloss: { type: "string", description: "English gloss of the phrase." },
        },
        required: ["phrase", "gloss"],
      },
    },
  },
  required: ["segments", "chunks"],
};

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "Anthropic not configured" }, { status: 400 });
  const { text, packId } = (await req.json()) as { text: string; packId?: string };
  const pack = getPack(packId);
  if (!text?.trim()) return Response.json({ error: "no text provided" }, { status: 400 });
  try {
    const { data, costUsd } = await structuredCall<{ segments: { text: string; gloss: string; translit: string }[]; chunks: { phrase: string; gloss: string }[] }>({
      model: MODELS.live,
      system: `You prepare imported ${pack.name} text for an absolute beginner's reader. Split the text into short, natural segments (sentences or clauses), keeping the original wording verbatim. For each segment give a faithful English gloss and a romanization. Also suggest up to 8 high-value multi-word CHUNKS (collocations/phrases) worth learning, each with an English gloss. Be accurate; never invent or alter words.`,
      user: text.slice(0, 4000),
      schema: IMPORT_SCHEMA,
      maxTokens: 4000,
    });
    return Response.json({ segments: data.segments, chunks: data.chunks, costUsd, confidence: "unreviewed" });
  } catch (e) {
    return Response.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
