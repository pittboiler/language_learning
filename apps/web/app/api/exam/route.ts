// Exam marking: one task of the midterm / final, judged against its steps, can-dos and grammar (core/exam,
// Opus 5.5 with the server-side refusal fallback). The task is looked up here by id, never taken from the
// client, so the rubric can't be edited from the browser.
import * as exam from "@ll/core/exam";
import { getPack } from "../../../lib/packs";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "Anthropic not configured" }, { status: 400 });
  const { packId, examId, taskId, response, transcripts } = (await req.json()) as {
    packId?: string; examId: string; taskId: string; response?: string; transcripts?: { scribe?: string; google?: string };
  };
  const pack = getPack(packId);
  const ex = pack.course?.exams?.find((e) => e.id === examId);
  const task = ex?.tasks.find((t) => t.id === taskId);
  if (!ex || !task) return Response.json({ error: "unknown exam task" }, { status: 400 });
  const points = task.pointIds.map((id) => pack.course!.points.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);
  try {
    const out = await exam.gradeExamTask({
      languageName: pack.name,
      mode: task.mode,
      title: task.title,
      scene: task.scene,
      steps: task.steps,
      canDos: ex.canDos.filter((c) => task.canDoIds.includes(c.id)).map((c) => ({ id: c.id, text: c.text })),
      grammar: points.map((p) => `${p.title}: ${p.rule}`),
      response: (response ?? "").slice(0, 4000),
      transcripts: task.mode === "speak" ? { scribe: transcripts?.scribe?.slice(0, 2000), google: transcripts?.google?.slice(0, 2000) } : undefined,
    });
    return Response.json({ ...out.grade, ms: out.ms, costUsd: out.costUsd });
  } catch (e) {
    return Response.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
