// SERVER-ONLY. Content-addressed TTS cache + pronunciation overrides (see DESIGN-tts-caching.md).
// Each unique line is synthesized ONCE on ElevenLabs and stored in the public `tts-audio` bucket keyed
// by sha256(speakText|voiceId|model); thereafter it's served from Storage (no ElevenLabs spend). Writes
// use the service-role key (bypasses RLS). Everything degrades to plain synthesis if Storage is absent
// or errors — playback never breaks. Never import this from client code (it holds the service-role key).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const BUCKET = "tts-audio";
/** Default model — eleven_v3 won the MK A/B (more consistent, less rushed). Override via env. */
export const DEFAULT_MODEL = process.env.ELEVENLABS_TTS_MODEL || "eleven_v3";

/** Per-line pronunciation fixes: swap the model/voice or the SPOKEN text (display text is unchanged).
 *  Seeded with the one ѕ-line v3 mangles; grows via the review queue (DESIGN-tts-caching.md §3). */
export const PRONUNCIATION_OVERRIDES: Record<string, { model?: string; voice?: string; speakText?: string }> = {
  "ѕвезда": { model: "eleven_multilingual_v2" }, // v3 glitches on ѕ (dz); v2 says it cleanly. It's the Ѕ alphabet example.
};

let _svc: SupabaseClient | null | undefined;
function svc(): SupabaseClient | null {
  if (_svc !== undefined) return _svc;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  _svc = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return _svc;
}

export interface TtsResolved {
  speakText: string; // what we send to ElevenLabs (override or the display text)
  model: string;
  voice: string;
  path: string; // <hash>.mp3 in the bucket
}

/** Map a display line → the effective (speakText, model, voice) + content-addressed cache path. */
export function resolveTts(text: string, voiceId: string): TtsResolved {
  const o = PRONUNCIATION_OVERRIDES[text.trim()] ?? {};
  const speakText = o.speakText ?? text;
  const model = o.model ?? DEFAULT_MODEL;
  const voice = o.voice ?? voiceId;
  const hash = createHash("sha256").update(`${speakText}|${voice}|${model}`).digest("hex");
  return { speakText, model, voice, path: `${hash}.mp3` };
}

/** Cached clip bytes, or null on miss / no-Storage / any error (caller then synthesizes). */
export async function getCached(path: string): Promise<ArrayBuffer | null> {
  const sb = svc();
  if (!sb) return null;
  try {
    const { data, error } = await sb.storage.from(BUCKET).download(path);
    if (error || !data) return null;
    return await data.arrayBuffer();
  } catch {
    return null;
  }
}

/** All object names currently in the bucket (one listing, for the offline pre-warm to skip hits). */
export async function listCachedPaths(): Promise<Set<string>> {
  const sb = svc();
  const set = new Set<string>();
  if (!sb) return set;
  try {
    for (let offset = 0; ; offset += 1000) {
      const { data } = await sb.storage.from(BUCKET).list("", { limit: 1000, offset });
      if (!data?.length) break;
      for (const o of data) set.add(o.name);
      if (data.length < 1000) break;
    }
  } catch {
    /* ignore — caller treats unknown as miss */
  }
  return set;
}

/** Best-effort upload — a failure here must never fail the play (we already have the bytes). */
export async function putCached(path: string, bytes: ArrayBuffer): Promise<void> {
  const sb = svc();
  if (!sb) return;
  try {
    await sb.storage.from(BUCKET).upload(path, Buffer.from(bytes), { contentType: "audio/mpeg", upsert: true });
  } catch {
    /* ignore — cache is an optimization */
  }
}

/** Synthesize one clip at NATURAL speed (the slow/normal toggle is applied client-side via playbackRate). */
export async function synthesize(speakText: string, model: string, voice: string): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY!;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text: speakText, model_id: model, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.arrayBuffer();
}
