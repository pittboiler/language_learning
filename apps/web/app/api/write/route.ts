// Writing correction: corrected text + per-issue explanations of WHY (core, Sonnet 4.6).
import * as writing from "@ll/core/writing";
import { macedonian as mk } from "@ll/pack-mk";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "Anthropic not configured" }, { status: 400 });
  const { attempt, taskId } = (await req.json()) as { attempt: string; taskId: string };
  const task = mk.writingTasks?.find((t) => t.id === taskId);
  if (!task) return Response.json({ error: "unknown task" }, { status: 400 });
  try {
    const out = await writing.correct(attempt, task.prompt, { languageName: mk.name });
    return Response.json({ ...out.correction, ms: out.ms, costUsd: out.costUsd });
  } catch (e) {
    return Response.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
