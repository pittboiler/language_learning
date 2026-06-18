// Typed client for the server API routes (which hold the provider keys).

export interface Config {
  engines: { eleven: boolean; google: boolean; anthropic: boolean };
  models: { live: string; offline: string; tts: string };
}

export async function getConfig(): Promise<Config> {
  return (await fetch("/api/config")).json();
}

/** Synthesize (cached) + play TTS for the active pack's voice. The clip is natural speed; `rate` is the
 *  client-side playbackRate for the slow/normal toggle (1 = normal, 0.75 = slow) — pitch-preserved. */
export async function playTts(text: string, rate = 1, packId?: string): Promise<void> {
  const r = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, packId }),
  });
  if (!r.ok) throw new Error((await r.json()).error || "TTS failed");
  const audio = new Audio(URL.createObjectURL(await r.blob()));
  audio.preservesPitch = true;
  audio.playbackRate = rate;
  await audio.play();
}

/** Play a TTS clip and resolve when it FINISHES — for sequential, synced story playback. `rate` =
 *  client-side playbackRate (1 normal / 0.75 slow), pitch-preserved. */
export async function playClip(text: string, rate = 1, packId?: string): Promise<void> {
  const r = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, packId }),
  });
  if (!r.ok) throw new Error((await r.json()).error || "TTS failed");
  const audio = new Audio(URL.createObjectURL(await r.blob()));
  audio.preservesPitch = true;
  audio.playbackRate = rate;
  await new Promise<void>((resolve, reject) => {
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error("audio playback error"));
    audio.play().catch(reject);
  });
}

export interface EngineResult {
  text?: string;
  ms: number;
  ok: boolean;
  error?: string;
}
export interface AsrResponse {
  eleven?: EngineResult;
  google?: EngineResult;
  error?: string;
}

export async function asr(blob: Blob, packId?: string): Promise<AsrResponse> {
  const fd = new FormData();
  fd.append("audio", blob, "rec.webm");
  if (packId) fd.append("packId", packId);
  return (await fetch("/api/asr", { method: "POST", body: fd })).json();
}

export interface FeedbackResponse {
  overall: string;
  words: { target: string; status: string; note: string }[];
  pronunciation: string;
  stress: string;
  tip: string;
  asrCaveat: { likelyAsrError: boolean; explanation: string };
  score: number;
  ms: number;
  costUsd: number;
  gate: { agreed: boolean; confidence: "high" | "low" };
  error?: string;
}

export async function feedback(
  target: { answer: string; translit?: string; gloss: string; note?: string },
  transcripts: { scribe?: string; google?: string },
  packId?: string,
): Promise<FeedbackResponse> {
  return (
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, transcripts, packId }),
    })
  ).json();
}

export interface ChatResponse {
  reply: string;
  replyGloss: string;
  correction: string;
  suggestions: { text: string; gloss: string }[];
  ms: number;
  costUsd: number;
  error?: string;
}

export async function chat(
  userText: string,
  history: { role: "learner" | "tutor"; text: string }[],
  scenarioId?: string,
  packId?: string,
): Promise<ChatResponse> {
  return (
    await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userText, history, scenarioId, packId }),
    })
  ).json();
}

export interface WriteResponse {
  corrected: string;
  correctedTranslit?: string;
  isCorrect: boolean;
  issues: { original: string; fix: string; why: string }[];
  overall: string;
  encouragement: string;
  ms: number;
  costUsd: number;
  error?: string;
}

export async function writeCorrect(attempt: string, taskId: string, packId?: string): Promise<WriteResponse> {
  return (
    await fetch("/api/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attempt, taskId, packId }),
    })
  ).json();
}

export interface GlossResponse {
  gloss: string;
  translit?: string;
  lemma?: string;
  source: "pack" | "llm" | "none" | "error";
  costUsd?: number;
  error?: string;
}

// In-memory gloss cache (+ inflight dedup): tap-to-look-up hits Haiku (~1-3s) for any non-pack word, so
// without this a re-tap re-pays and a prefetch + immediate tap would double-fetch. Keyed by word+context
// (context can change the gloss). Lives for the page session — cheap, and reading is a read-only aid.
const glossCache = new Map<string, GlossResponse>();
const glossInflight = new Map<string, Promise<GlossResponse>>();
const glossKey = (word: string, context: string, packId?: string) => `${packId ?? ""}|${word.toLowerCase().trim()}|${context}`;

/** Look up a single word (pack-vocab first, else a Haiku gloss). For tap-to-capture in the reader.
 *  Cached + inflight-deduped so re-taps and prefetch are instant and never fire a duplicate request. */
export async function gloss(word: string, context: string, packId?: string): Promise<GlossResponse> {
  const key = glossKey(word, context, packId);
  const cached = glossCache.get(key);
  if (cached) return cached;
  const inflight = glossInflight.get(key);
  if (inflight) return inflight;
  const p = (async () => {
    try {
      const r: GlossResponse = await (
        await fetch("/api/gloss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word, context, packId }),
        })
      ).json();
      if (r.gloss && r.source !== "error") glossCache.set(key, r); // only cache useful results
      return r;
    } finally {
      glossInflight.delete(key);
    }
  })();
  glossInflight.set(key, p);
  return p;
}

export interface ImportResponse {
  segments: { text: string; gloss: string; translit: string }[];
  chunks: { phrase: string; gloss: string }[];
  costUsd?: number;
  confidence?: string;
  error?: string;
}

/** Import + segment + gloss arbitrary target-language text into a gated reader (confidence:"unreviewed"). */
export async function importText(text: string, packId?: string): Promise<ImportResponse> {
  return (
    await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, packId }),
    })
  ).json();
}
