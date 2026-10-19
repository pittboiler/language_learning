// SERVER-ONLY. Content-addressed TTS cache + pronunciation overrides (see DESIGN-tts-caching.md).
// Each unique line is synthesized ONCE on ElevenLabs and stored in the public `tts-audio` bucket keyed
// by sha256(speakText|voiceId|model); thereafter it's served from Storage (no ElevenLabs spend). Writes
// use the service-role key (bypasses RLS). Everything degrades to plain synthesis if Storage is absent
// or errors — playback never breaks. Never import this from client code (it holds the service-role key).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { romanize } from "./romanize";

const BUCKET = "tts-audio";
/** Default model — eleven_v3 won the MK A/B (more consistent, less rushed). Override via env. */
export const DEFAULT_MODEL = process.env.ELEVENLABS_TTS_MODEL || "eleven_v3";

/** Per-line pronunciation fixes: swap the model/voice or the SPOKEN text (display text is unchanged).
 *  Seeded with the one ѕ-line v3 mangles; grows via the review queue (DESIGN-tts-caching.md §3). */
export const PRONUNCIATION_OVERRIDES: Record<string, { model?: string; voice?: string; speakText?: string }> = {
  "ѕвезда": { model: "eleven_multilingual_v2" }, // v3 glitches on ѕ (dz); v2 says it cleanly. It's the Ѕ alphabet example.
  // 2026-10-19 (pipeline/src/audit-tts.ts → fix-tts.ts): on a bare "е" v3 gives nothing, a jingle, or English
  // ("This is for each"); said as a sentence of its own it's a clean "е". (The conjugation match plays it.)
  "е": { speakText: "Е." },
  "Ќе": { model: "eleven_multilingual_v2" }, // v3 says „че“; v2 the soft ќ. (A story word you can tap.)
  "пијам": { model: "eleven_multilingual_v2" }, // v3 keeps saying „бием“ / "PM".
  "воз": { speakText: "Воз." }, // a bare „воз“ comes out „возе“.
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
    const bytes = await data.arrayBuffer();
    return bytes.byteLength ? bytes : null; // an empty clip (a failed take, cached once) is a miss
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
  if (!sb || !bytes.byteLength) return; // never cache an empty take
  try {
    await sb.storage.from(BUCKET).upload(path, Buffer.from(bytes), { contentType: "audio/mpeg", upsert: true });
  } catch {
    /* ignore — cache is an optimization */
  }
}

/** Synthesize one clip at NATURAL speed (the slow/normal toggle is applied client-side via playbackRate).
 *  `languageCode` (ISO 639-1, e.g. "mk") asks the model to hold to that language. */
export async function synthesize(speakText: string, model: string, voice: string, languageCode?: string): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY!;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text: speakText, model_id: model, ...(languageCode ? { language_code: languageCode } : {}), voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.arrayBuffer();
}

// ---- Checked synthesis (2026-10-19, Jake: "english speaking sounds in the matching game") ----------------
// A take is random, and on a short word (тие, е, сум) eleven_v3 sometimes says it as English ("T", "This is
// for each", "Zoom"). Since a clip is cached forever, each new clip is checked once before it's kept: Scribe
// hears it as the pack's language, and the letters must match the line.

/** Letters only, romanized, so spelling noise and a Latin transcript of the same sound compare equal; a word's
 *  LAST consonant counts the same voiced or not (Macedonian devoices there: бев is said "беф"), nowhere else
 *  (тие is not дие). */
const letters = (s: string) => romanize(s.replace(/…/g, " ")).toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z\s]/g, "")
  .split(/\s+/).map((w) => w.replace(/b$/, "p").replace(/d$/, "t").replace(/g$/, "k").replace(/v$/, "f").replace(/z$/, "s")).join("");
/** 1 = the same letters, 0 = nothing alike (edit distance over the longer). */
export function lineSimilarity(a: string, b: string): number {
  const x = letters(a), y = letters(b);
  if (!x && !y) return 1;
  const d = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array<number>(y.length).fill(0)]);
  for (let j = 1; j <= y.length; j++) d[0]![j] = j;
  for (let i = 1; i <= x.length; i++) for (let j = 1; j <= y.length; j++) d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (x[i - 1] === y[j - 1] ? 0 : 1));
  return 1 - d[x.length]![y.length]! / Math.max(x.length, y.length);
}
/** How close a take must be to count as saying the line. */
export const TAKE_OK = 0.75;

/** What Scribe hears in a clip, as the given language (ISO 639-3, e.g. "mkd"). Undefined when there's no
 *  Scribe to ask; null when the request failed (an empty or broken take, an outage): that take isn't checked. */
export async function hear(bytes: ArrayBuffer, scribeLang: string): Promise<string | undefined | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return undefined;
  if (!bytes.byteLength) return null;
  const form = new FormData();
  form.append("model_id", process.env.SCRIBE_MODEL || "scribe_v2");
  form.append("language_code", scribeLang);
  form.append("file", new Blob([new Uint8Array(bytes)], { type: "audio/mpeg" }), "clip.mp3");
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": apiKey }, body: form });
    if (!res.ok) return null;
    return (((await res.json()) as { text?: string }).text ?? "").trim();
  } catch {
    return null;
  }
}

/** Synthesize until a take says the line (up to `tries`; from the second, holding the model to the language),
 *  and return the best take. A very short line (a word of three letters or fewer, where one hearing of a single
 *  syllable proves little) must be heard right twice. Lines without Cyrillic, or no Scribe, skip the check. */
export async function synthesizeChecked(line: string, r: Pick<TtsResolved, "speakText" | "model" | "voice">, o: { languageCode: string; scribeLang: string; tries?: number }): Promise<{ bytes: ArrayBuffer; ok: boolean; heard?: string; sim: number; tries: number }> {
  const tries = o.tries ?? 3;
  let best: { bytes: ArrayBuffer; heard?: string; sim: number } | undefined;
  for (let i = 0; i < tries; i++) {
    // eleven_multilingual_v2 takes no language_code (it refuses one it doesn't list, e.g. "mk").
    const bytes = await synthesize(r.speakText, r.model, r.voice, i > 0 && r.model !== "eleven_multilingual_v2" ? o.languageCode : undefined);
    if (!/\p{Script=Cyrillic}/u.test(line)) return { bytes, ok: true, sim: 1, tries: i + 1 };
    const heard = await hear(bytes, o.scribeLang);
    if (heard === undefined) return { bytes, ok: true, sim: 1, tries: i + 1 };
    // A take Scribe couldn't hear at all (or an empty one) counts as the worst take.
    let sim = heard === null || !bytes.byteLength ? -1 : lineSimilarity(line, heard);
    if (sim >= TAKE_OK && letters(line).length <= 3) {
      const again = await hear(bytes, o.scribeLang);
      if (typeof again === "string") sim = Math.min(sim, lineSimilarity(line, again));
    }
    if (!best || sim > best.sim) best = { bytes, heard: heard ?? undefined, sim };
    if (sim >= TAKE_OK) return { ...best, ok: true, tries: i + 1 };
  }
  return { ...best!, ok: false, tries };
}
