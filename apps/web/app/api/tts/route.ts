// ElevenLabs TTS — cache-aside. Each unique line is synthesized once on ElevenLabs (default eleven_v3)
// and cached in the public `tts-audio` bucket; later plays are served from Storage with no ElevenLabs
// spend. Clips are NATURAL speed — the slow/normal toggle is applied client-side via playbackRate.
// Keys are held server-side. See DESIGN-tts-caching.md.
import { getPack } from "../../../lib/packs";
import { resolveTts, getCached, putCached, synthesize } from "../../../lib/tts-cache";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key || key.startsWith("PASTE_")) return Response.json({ error: "ElevenLabs not configured" }, { status: 400 });
  const { text, packId } = (await req.json()) as { text: string; packId?: string };
  if (!text?.trim()) return Response.json({ error: "no text" }, { status: 400 });

  const voiceId = process.env.ELEVENLABS_VOICE_ID || getPack(packId).voiceId;
  const r = resolveTts(text, voiceId);

  // Cache hit → serve from Storage (no ElevenLabs call).
  const cached = await getCached(r.path);
  if (cached) return new Response(cached, { headers: { "Content-Type": "audio/mpeg", "X-TTS-Cache": "hit" } });

  // Miss → synthesize, cache best-effort, return. (Storage absent/erroring just means we always
  // synthesize = the old behavior; playback never breaks.)
  let bytes: ArrayBuffer;
  try {
    bytes = await synthesize(r.speakText, r.model, r.voice);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "TTS failed" }, { status: 500 });
  }
  await putCached(r.path, bytes);
  return new Response(bytes, { headers: { "Content-Type": "audio/mpeg", "X-TTS-Cache": "miss" } });
}
