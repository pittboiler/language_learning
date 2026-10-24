// Open conversation: tutor reply + gloss + correction + suggestions (core, Sonnet 4.6).
// Language name + setting are injected from the pack/scenario.
import * as tutor from "@ll/core/tutor";
import { getPack } from "../../../lib/packs";
import { requireCaller } from "../../../lib/server-auth";
import { recordCost, spend } from "../../../lib/usage";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "Anthropic not configured" }, { status: 400 });
  const { userText, history, scenarioId, packId } = (await req.json()) as {
    userText: string;
    history?: { role: "learner" | "tutor"; text: string }[];
    scenarioId?: string;
    packId?: string;
  };
  const pack = getPack(packId);
  const scenario = scenarioId ? pack.scenarios.find((s) => s.id === scenarioId) : undefined;
  const over = await spend(caller, "chat");
  if (over) return over;
  try {
    const out = await tutor.respond(
      { userText, history: history ?? [], scenario },
      { languageName: pack.name, setting: scenario?.setting },
    );
    recordCost(caller, "chat", out.costUsd);
    return Response.json({ ...out.reply, ms: out.ms, costUsd: out.costUsd });
  } catch (e) {
    return Response.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
