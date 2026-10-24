// Writing correction: corrected text + per-issue explanations of WHY (core, Sonnet 4.6).
import * as writing from "@ll/core/writing";
import { getPack } from "../../../lib/packs";
import { requireCaller } from "../../../lib/server-auth";
import { recordCost, spend } from "../../../lib/usage";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "Anthropic not configured" }, { status: 400 });
  const { attempt, taskId, packId, prompt, reference } = (await req.json()) as { attempt: string; taskId: string; packId?: string; prompt?: string; reference?: string };
  const pack = getPack(packId);
  // An inline prompt (a Today writing line, or the free capstone) wins; else look up a pack task. A writing
  // line also sends its model answer as the reference.
  const promptText = (prompt ?? "").trim() || pack.writingTasks?.find((t) => t.id === taskId)?.prompt;
  if (!promptText) return Response.json({ error: "unknown task" }, { status: 400 });
  const over = await spend(caller, "write");
  if (over) return over;
  try {
    const out = await writing.correct(attempt, promptText, { languageName: pack.name }, reference?.trim() || undefined);
    recordCost(caller, "write", out.costUsd);
    return Response.json({ ...out.correction, ms: out.ms, costUsd: out.costUsd });
  } catch (e) {
    return Response.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
