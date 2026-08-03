// Word look-up for tap-to-capture. Pack-vocab match first (free, trusted); else a Haiku gloss —
// the MECHANICAL tier (produces ENGLISH, no novel target-language generation), ~$0.0005/word.
// Glosses from the LLM are best-effort aids, not authoritative pack content.
import { structuredCall, MODELS } from "@ll/core/llm";
import { normalize } from "@ll/core/familiarity";
import { getPack } from "../../../lib/packs";
import { getCachedGloss, putCachedGloss, normalizeContext } from "../../../lib/gloss-cache";
import { romanize } from "../../../lib/romanize";

// Transliteration is a deterministic property of the (Cyrillic) spelling, so we compute it locally
// rather than trust the LLM — the LLM occasionally slips a homoglyph (надвор → "nadvop"). For a
// non-Cyrillic word there's nothing to romanize, so we fall back to the authored/LLM value.
const hasCyrillic = (s: string) => /[Ѐ-ӿ]/.test(s);
const translitFor = (word: string, fallback?: string) => (hasCyrillic(word) ? romanize(word) : fallback ?? "");

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

  // 1. Trusted pack vocab (free, instant). Authored translit wins; compute only to fill a gap.
  const hit = pack.vocab.find((v) => normalize(v.answer) === key);
  if (hit) return Response.json({ gloss: hit.gloss, translit: hit.translit || translitFor(word), source: "pack" });

  // 2. Shared cross-user cache (see gloss-cache.ts): the first resolution of a (pack, word, sentence)
  //    is reused by every later reader — so two partners tapping the same word get the SAME definition.
  const ctxKey = normalizeContext(context);
  const cached = await getCachedGloss(pack.id, key, ctxKey);
  // Compute translit fresh (deterministic) so a Cyrillic word is right even if an older cached row
  // stored a bad LLM romanization.
  if (cached) return Response.json({ gloss: cached.gloss, translit: translitFor(word, cached.translit), lemma: cached.lemma, source: "cache" });

  // 3. Haiku fallback (mechanical), temperature 0 so the same word+sentence resolves reproducibly.
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ gloss: "", translit: "", source: "none" });
  try {
    const { data, costUsd } = await structuredCall<{ gloss: string; lemma: string; translit: string }>({
      model: MODELS.mechanical,
      temperature: 0,
      system: `You gloss a single ${pack.name} word into English for an absolute beginner. Return a concise English gloss (1-4 words), the dictionary/base form, and a romanization. Use the sentence context to disambiguate meaning.`,
      user: `Word: "${word}"${context ? `\nSentence: "${context}"` : ""}`,
      schema: GLOSS_SCHEMA,
      maxTokens: 300,
    });
    // Prefer the computed romanization; keep the LLM's only for non-Cyrillic scripts.
    const translit = translitFor(word, data.translit);
    // Store for everyone else (best-effort; keyed by normalized word + sentence).
    await putCachedGloss(pack.id, key, ctxKey, { gloss: data.gloss, translit, lemma: data.lemma });
    return Response.json({ gloss: data.gloss, translit, lemma: data.lemma, source: "llm", costUsd });
  } catch (e) {
    return Response.json({ gloss: "", translit: "", source: "error", error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
