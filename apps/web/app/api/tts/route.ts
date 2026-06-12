// ElevenLabs TTS — holds the key server-side. Voice comes from the ACTIVE pack (override via env).
import { getPack } from "../../../lib/packs";

export const runtime = "nodejs";

const TTS_MODEL = process.env.ELEVENLABS_TTS_MODEL || "eleven_multilingual_v2";

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key || key.startsWith("PASTE_")) return Response.json({ error: "ElevenLabs not configured" }, { status: 400 });
  const { text, speed, packId } = (await req.json()) as { text: string; speed?: number; packId?: string };
  const voiceId = process.env.ELEVENLABS_VOICE_ID || getPack(packId).voiceId;
  const voice_settings: Record<string, number> = { stability: 0.5, similarity_boost: 0.75 };
  if (speed) voice_settings.speed = Math.max(0.7, Math.min(1.2, Number(speed)));
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: TTS_MODEL, voice_settings }),
  });
  if (!res.ok) return Response.json({ error: `TTS ${res.status}: ${await res.text()}` }, { status: 500 });
  return new Response(await res.arrayBuffer(), { headers: { "Content-Type": "audio/mpeg" } });
}
