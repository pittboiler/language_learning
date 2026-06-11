// Open conversation: tutor reply + gloss + correction + suggestions (core, Sonnet 4.6).
// Language name + setting are injected from the pack/scenario.
import * as tutor from "@ll/core/tutor";
import { macedonian as mk } from "@ll/pack-mk";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "Anthropic not configured" }, { status: 400 });
  const { userText, history, scenarioId } = (await req.json()) as {
    userText: string;
    history?: { role: "learner" | "tutor"; text: string }[];
    scenarioId?: string;
  };
  const scenario = scenarioId ? mk.scenarios.find((s) => s.id === scenarioId) : undefined;
  try {
    const out = await tutor.respond(
      { userText, history: history ?? [], scenario },
      { languageName: mk.name, setting: scenario?.setting },
    );
    return Response.json({ ...out.reply, ms: out.ms, costUsd: out.costUsd });
  } catch (e) {
    return Response.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
