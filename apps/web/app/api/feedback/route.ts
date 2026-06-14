// Speaking feedback: build AsrResult[] → dual-engine confidence gate → compose coaching (core,
// Sonnet 4.6). Language facts (name, stress rule, exceptions) are injected from the pack.
import * as speaking from "@ll/core/speaking";
import { getPack } from "../../../lib/packs";
import type { ReviewItem } from "@ll/pack-schema";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "Anthropic not configured" }, { status: 400 });
  const { target, transcripts, packId } = (await req.json()) as {
    target: { answer: string; translit?: string; gloss: string; note?: string };
    transcripts: { scribe?: string; google?: string };
    packId?: string;
  };
  const pack = getPack(packId);

  const results: speaking.AsrResult[] = [
    { engine: "scribe", text: transcripts?.scribe ?? "", ms: 0, ok: !!transcripts?.scribe },
    { engine: "google", text: transcripts?.google ?? "", ms: 0, ok: !!transcripts?.google },
  ];
  const gate = speaking.confidenceGate(results, pack.asr, target.answer);

  const item: ReviewItem = {
    id: "live-target", kind: "phrase", prompt: "", answer: target.answer, translit: target.translit,
    gloss: target.gloss, note: target.note, i1Level: 1, tags: [],
  };

  try {
    const out = await speaking.composeFeedback(item, gate, {
      languageName: pack.name,
      stressRule: pack.phonology.stressRule,
      stressExceptions: pack.phonology.exceptions,
    });
    return Response.json({ ...out.feedback, ms: out.ms, costUsd: out.costUsd, gate: { agreed: gate.agreed, confidence: gate.confidence } });
  } catch (e) {
    return Response.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
