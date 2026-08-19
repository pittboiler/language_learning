// "Have a question?" — a scoped, cached AI explainer for the conversation in a Today session step. Answers
// ONE beginner question about the given conversation's grammar/wording, in ≤3 sentences. Design: a helper,
// not a chatbot — see DESIGN-ai-explain.md. Resolution order: shared cache → per-user daily rate limit →
// Haiku (scoped, refusing prompt), then cache for everyone. Server-only; keys never reach the client.
import { structuredCall, MODELS } from "@ll/core/llm";
import { getPack } from "../../../lib/packs";
import { getCachedExplain, putCachedExplain, bumpUsage, normalizeQuestion } from "../../../lib/explain-cache";
import { EXPLAIN_SCHEMA, EXPLAIN_MAX_Q, explainSystem, explainUser } from "@ll/core/explain";

export const runtime = "nodejs";
export const maxDuration = 20;

const DAILY_LIMIT = 25; // asks per user per day (DESIGN-ai-explain.md §5)

type Line = { text: string; gloss?: string };

export async function POST(req: Request) {
  const { packId, convoId, lines, question, canned, userId } = (await req.json()) as {
    packId?: string; convoId?: string; lines?: Line[]; question?: string; canned?: string; userId?: string;
  };
  const pack = getPack(packId);
  if (!convoId) return Response.json({ error: "missing conversation" }, { status: 400 });

  // Cache key: a canned concept id, or the normalized free-text question. Same (convo, question) → one answer.
  const qKey = (canned ?? "").trim() || normalizeQuestion(question);
  if (!qKey) return Response.json({ error: "empty question" }, { status: 400 });

  // 1. Shared cross-user cache (first asker paid; everyone after is free).
  const cached = await getCachedExplain(pack.id, convoId, qKey);
  if (cached) return Response.json({ answer: cached.answer, source: "cache" });

  // 2. Per-user daily rate limit (soft; degrades to a friendly message client-side).
  const under = await bumpUsage(userId ?? "", DAILY_LIMIT);
  if (!under) return Response.json({ error: "rate_limited" }, { status: 429 });

  // 3. Haiku fallback (mechanical tier), scoped + refusing, short output.
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "unconfigured" }, { status: 503 });
  const q = (question ?? canned ?? "").slice(0, EXPLAIN_MAX_Q * 2);
  try {
    const { data, costUsd } = await structuredCall<{ answer: string }>({
      model: MODELS.mechanical,
      temperature: 0,
      maxTokens: 220,
      system: explainSystem(pack.name),
      user: explainUser((lines ?? []) as Line[], q, !!canned),
      schema: EXPLAIN_SCHEMA,
    });
    await putCachedExplain(pack.id, convoId, qKey, { answer: data.answer, model: MODELS.mechanical });
    return Response.json({ answer: data.answer, source: "llm", costUsd });
  } catch (e) {
    return Response.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
