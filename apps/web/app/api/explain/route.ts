// "Have a question?" — a scoped, cached AI explainer for the conversation in a Today session step. Answers
// ONE beginner question about the given conversation's grammar/wording, in ≤3 sentences. Design: a helper,
// not a chatbot — see DESIGN-ai-explain.md. Resolution order: shared cache → the caller's daily cap (the
// usage ledger, 25 a day) → Haiku (scoped, refusing prompt), then cache for everyone. Server-only; keys never
// reach the client.
import { structuredCall, MODELS } from "@ll/core/llm";
import { getPack } from "../../../lib/packs";
import { getCachedExplain, putCachedExplain, normalizeQuestion } from "../../../lib/explain-cache";
import { requireCaller } from "../../../lib/server-auth";
import { recordCost, spend } from "../../../lib/usage";
import { EXPLAIN_SCHEMA, EXPLAIN_MAX_Q, explainSystem, explainUser, type ExplainCourse } from "@ll/core/explain";

export const runtime = "nodejs";
export const maxDuration = 20;

type Line = { text: string; gloss?: string };

export async function POST(req: Request) {
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;
  const { packId, convoId, lines, question, canned, course } = (await req.json()) as {
    packId?: string; convoId?: string; lines?: Line[]; question?: string; canned?: string; course?: ExplainCourse;
  };
  const pack = getPack(packId);
  if (!convoId) return Response.json({ error: "missing conversation" }, { status: 400 });

  // Cache key: a canned concept id, or the normalized free-text question. Same (convo, question) → one answer.
  // On the course the answer depends on what's been taught, so it's shared per chapter rather than by everyone.
  const asked = (canned ?? "").trim() || normalizeQuestion(question);
  if (!asked) return Response.json({ error: "empty question" }, { status: 400 });
  const qKey = course && Number.isFinite(course.chapter) ? `${asked}@ch${course.chapter}` : asked;

  // 1. Shared cross-user cache (first asker paid; everyone after is free).
  const cached = await getCachedExplain(pack.id, convoId, qKey);
  if (cached) return Response.json({ answer: cached.answer, source: "cache" });

  // 2. The caller's daily cap (a 429 "rate_limited", which the client words as a friendly message).
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "unconfigured" }, { status: 503 });
  const over = await spend(caller, "explain");
  if (over) return over;

  // 3. Haiku fallback (mechanical tier), scoped + refusing, short output.
  const q = (question ?? canned ?? "").slice(0, EXPLAIN_MAX_Q * 2);
  try {
    const { data, costUsd } = await structuredCall<{ answer: string }>({
      model: MODELS.mechanical,
      temperature: 0,
      maxTokens: 220,
      system: explainSystem(pack.name),
      user: explainUser((lines ?? []) as Line[], q, !!canned, course),
      schema: EXPLAIN_SCHEMA,
    });
    await putCachedExplain(pack.id, convoId, qKey, { answer: data.answer, model: MODELS.mechanical });
    recordCost(caller, "explain", costUsd);
    return Response.json({ answer: data.answer, source: "llm", costUsd });
  } catch (e) {
    return Response.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
