// Dual-ASR transcription (ElevenLabs Scribe + Google STT). Ported from spike/server.js.
// Language hints come from the pack's AsrConfig. Google client is built from inline env credentials
// (Vercel) or falls back to the GOOGLE_APPLICATION_CREDENTIALS file (local dev).
import speech from "@google-cloud/speech";
import { macedonian as mk } from "@ll/pack-mk";

export const runtime = "nodejs";

const SCRIBE_MODEL = process.env.SCRIBE_MODEL || "scribe_v2";
const SCRIBE_LANG = process.env.SCRIBE_LANG || mk.asr.languageHints[0] || "mkd";
const GOOGLE_LANG = mk.asr.languageHints[1] || "mk-MK";

let _g: InstanceType<typeof speech.SpeechClient> | null = null;
function googleClient(): InstanceType<typeof speech.SpeechClient> {
  if (_g) return _g;
  const json = process.env.GOOGLE_CREDENTIALS_JSON;
  _g = json ? new speech.SpeechClient({ credentials: JSON.parse(json) }) : new speech.SpeechClient();
  return _g;
}
const hasGoogle = () => !!process.env.GOOGLE_CREDENTIALS_JSON || !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
const hasEleven = () => {
  const k = process.env.ELEVENLABS_API_KEY;
  return !!k && !k.startsWith("PASTE_");
};

type EngineResult = { text?: string; language?: string | null; ms: number; ok: boolean; error?: string };

async function timed(fn: () => Promise<{ text: string; language?: string | null }>): Promise<EngineResult> {
  const t = Date.now();
  try {
    const r = await fn();
    return { ...r, ms: Date.now() - t, ok: true };
  } catch (e) {
    return { error: String(e instanceof Error ? e.message : e), ms: Date.now() - t, ok: false };
  }
}

async function transcribeEleven(buf: Buffer, mime: string): Promise<{ text: string; language?: string | null }> {
  const key = process.env.ELEVENLABS_API_KEY as string;
  const attempts = [
    { model: SCRIBE_MODEL, lang: SCRIBE_LANG as string | null },
    { model: SCRIBE_MODEL, lang: null },
    { model: "scribe_v1", lang: null },
  ];
  let lastErr = "";
  for (const a of attempts) {
    const form = new FormData();
    form.append("model_id", a.model);
    if (a.lang) form.append("language_code", a.lang);
    form.append("file", new Blob([new Uint8Array(buf)], { type: mime }), "audio.webm");
    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": key },
      body: form,
    });
    if (res.ok) {
      const d = (await res.json()) as { text?: string; language_code?: string };
      return { text: (d.text ?? "").trim(), language: d.language_code ?? null };
    }
    lastErr = `${res.status}: ${await res.text()}`;
    if (res.status !== 400 && res.status !== 422) break;
  }
  throw new Error(`Scribe ${lastErr}`);
}

function googleEncoding(mime: string): { encoding: "WEBM_OPUS" | "OGG_OPUS" | "MP3" | "LINEAR16"; sampleRateHertz?: number } {
  if (mime.includes("webm")) return { encoding: "WEBM_OPUS" };
  if (mime.includes("ogg")) return { encoding: "OGG_OPUS" };
  if (mime.includes("mpeg") || mime.includes("mp3")) return { encoding: "MP3", sampleRateHertz: 44100 };
  if (mime.includes("wav")) return { encoding: "LINEAR16", sampleRateHertz: 16000 };
  return { encoding: "WEBM_OPUS" };
}

async function transcribeGoogle(buf: Buffer, mime: string): Promise<{ text: string }> {
  const [resp] = await googleClient().recognize({
    config: { ...googleEncoding(mime), languageCode: GOOGLE_LANG, enableAutomaticPunctuation: true },
    audio: { content: buf.toString("base64") },
  });
  const text = (resp.results || [])
    .map((r) => r.alternatives?.[0]?.transcript || "")
    .join(" ")
    .trim();
  return { text };
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("audio");
  if (!(file instanceof File)) return Response.json({ error: "no audio uploaded" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "audio/webm";
  const out: { eleven?: EngineResult; google?: EngineResult } = {};
  if (hasEleven()) out.eleven = await timed(() => transcribeEleven(buf, mime));
  if (hasGoogle()) out.google = await timed(() => transcribeGoogle(buf, mime));
  return Response.json(out);
}
