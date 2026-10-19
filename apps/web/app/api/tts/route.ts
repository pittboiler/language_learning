// ElevenLabs TTS — cache-aside. Each unique line is synthesized once on ElevenLabs (default eleven_v3)
// and cached in the public `tts-audio` bucket; later plays are served from Storage with no ElevenLabs
// spend. Clips are NATURAL speed — the slow/normal toggle is applied client-side via playbackRate.
// Keys are held server-side. See DESIGN-tts-caching.md.
import { getPack } from "../../../lib/packs";
import { resolveTts, getCached, putCached, synthesizeChecked } from "../../../lib/tts-cache";

export const runtime = "nodejs";
// A first play can take a few checked takes (synthesize + hear, up to three times).
export const maxDuration = 30;

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key || key.startsWith("PASTE_")) return Response.json({ error: "ElevenLabs not configured" }, { status: 400 });
  const { text, packId } = (await req.json()) as { text: string; packId?: string };
  if (!text?.trim()) return Response.json({ error: "no text" }, { status: 400 });

  const pack = getPack(packId);
  const voiceId = process.env.ELEVENLABS_VOICE_ID || pack.voiceId;
  const r = resolveTts(text, voiceId);

  // Cache hit → serve from Storage (no ElevenLabs call).
  const cached = await getCached(r.path);
  if (cached) return new Response(cached, { headers: { "Content-Type": "audio/mpeg", "X-TTS-Cache": "hit" } });

  // Miss → synthesize (checked: a take that doesn't say the line is redone, up to three takes), cache
  // best-effort, return. (Storage absent/erroring just means we always synthesize; playback never breaks.)
  let bytes: ArrayBuffer;
  try {
    bytes = (await synthesizeChecked(text.trim(), r, { languageCode: pack.languageCode, scribeLang: pack.asr.languageHints[0] ?? pack.languageCode })).bytes;
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "TTS failed" }, { status: 500 });
  }
  await putCached(r.path, bytes);
  return new Response(bytes, { headers: { "Content-Type": "audio/mpeg", "X-TTS-Cache": "miss" } });
}
