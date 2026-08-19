// Writing correction: corrected text + per-issue explanations of WHY (core, Sonnet 4.6).
import * as writing from "@ll/core/writing";
import { getPack } from "../../../lib/packs";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "Anthropic not configured" }, { status: 400 });
  const { attempt, taskId, packId, prompt } = (await req.json()) as { attempt: string; taskId: string; packId?: string; prompt?: string };
  const pack = getPack(packId);
  // An inline prompt (the Today writing capstone, scoped to the unit) wins; else look up a pack task.
  const promptText = (prompt ?? "").trim() || pack.writingTasks?.find((t) => t.id === taskId)?.prompt;
  if (!promptText) return Response.json({ error: "unknown task" }, { status: 400 });
  try {
    const out = await writing.correct(attempt, promptText, { languageName: pack.name });
    return Response.json({ ...out.correction, ms: out.ms, costUsd: out.costUsd });
  } catch (e) {
    return Response.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
