// Word look-up for tap-to-capture. Pack-vocab match first (free, trusted); else a Haiku gloss —
// the MECHANICAL tier (produces ENGLISH, no novel target-language generation), ~$0.0005/word.
// Glosses from the LLM are best-effort aids, not authoritative pack content.
import { structuredCall, MODELS } from "@ll/core/llm";
import { normalize } from "@ll/core/familiarity";
import { getPack } from "../../../lib/packs";

export const runtime = "nodejs";
export const maxDuration = 20;

const GLOSS_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    gloss: { type: "string", description: "Concise English gloss (1-4 words)." },
    lemma: { type: "string", description: "Dictionary / base form in the target language." },
    translit: { type: "string", description: "Romanization of the word." },
  },
  required: ["gloss", "lemma", "translit"],
};

export async function POST(req: Request) {
  const { word, context, packId } = (await req.json()) as { word: string; context?: string; packId?: string };
  const pack = getPack(packId);
  const key = normalize(word);

  // 1. Trusted pack vocab (free, instant).
  const hit = pack.vocab.find((v) => normalize(v.answer) === key);
  if (hit) return Response.json({ gloss: hit.gloss, translit: hit.translit ?? "", source: "pack" });

  // 2. Haiku fallback (mechanical).
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ gloss: "", translit: "", source: "none" });
  try {
    const { data, costUsd } = await structuredCall<{ gloss: string; lemma: string; translit: string }>({
      model: MODELS.mechanical,
      system: `You gloss a single ${pack.name} word into English for an absolute beginner. Return a concise English gloss (1-4 words), the dictionary/base form, and a romanization. Use the sentence context to disambiguate meaning.`,
      user: `Word: "${word}"${context ? `\nSentence: "${context}"` : ""}`,
      schema: GLOSS_SCHEMA,
      maxTokens: 300,
    });
    return Response.json({ gloss: data.gloss, translit: data.translit, lemma: data.lemma, source: "llm", costUsd });
  } catch (e) {
    return Response.json({ gloss: "", translit: "", source: "error", error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
