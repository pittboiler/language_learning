// Typed client for the server API routes (which hold the provider keys).
import { supabase, uid } from "./supabase";

// Every /api route checks the caller's Supabase session (lib/server-auth.ts), so each request carries it as a
// bearer token. A session is made first when there isn't one (anonymous, as the stores do), and a 401 gets
// one retry with a refreshed token.
async function bearer(): Promise<Record<string, string>> {
  const sb = supabase();
  if (!sb) return {};
  try {
    await uid();
    const { data } = await sb.auth.getSession();
    return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
  } catch {
    return {};
  }
}
async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const send = async () => fetch(path, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), ...(await bearer()) } });
  const res = await send();
  const sb = supabase();
  if (res.status !== 401 || !sb) return res;
  await sb.auth.refreshSession().catch(() => {});
  return send();
}

export interface Config {
  engines: { eleven: boolean; google: boolean; anthropic: boolean };
  models: { live: string; offline: string; tts: string };
}

export async function getConfig(): Promise<Config> {
  return (await call("/api/config")).json();
}

// ---- Spoken lines: one voice at a time (2026-10-22, Jake: in Build a sentence the line sometimes came "well
// after I hit next"). A clip can take a few seconds the first time it's made (checked synthesis), so:
// a line can be fetched AHEAD (prefetchTts, when its card appears), the newest play wins (a line still
// loading is dropped once another is asked for), and stopTts drops whatever's loading or playing (a card
// moving on). Fetched clips are kept for the session, so a replay is instant.
const CLIPS_KEPT = 200;
const clips = new Map<string, Promise<Blob>>();
function clipBlob(text: string, packId?: string): Promise<Blob> {
  const key = `${packId ?? ""}|${text}`;
  let p = clips.get(key);
  if (!p) {
    p = call("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, packId }) })
      .then(async (r) => { if (!r.ok) throw new Error((await r.json()).error || "TTS failed"); return r.blob(); });
    p.catch(() => clips.delete(key)); // a failure isn't kept: the next play tries again
    clips.set(key, p);
    if (clips.size > CLIPS_KEPT) clips.delete(clips.keys().next().value!);
  }
  return p;
}
let playing: HTMLAudioElement | null = null;
let generation = 0;

/** Start fetching a line now, so it plays at once when asked for. */
export function prefetchTts(text: string, packId?: string): void {
  if (text.trim()) clipBlob(text, packId).catch(() => {});
}

/** Stop the line playing, and drop any line still loading. */
export function stopTts(): void {
  generation++;
  playing?.pause();
  playing = null;
}

/** Synthesize (cached) + play TTS for the active pack's voice. The clip is natural speed; `rate` is the
 *  client-side playbackRate for the slow/normal toggle (1 = normal, 0.75 = slow) — pitch-preserved. The
 *  newest call wins: a line that arrives after another was asked for (or after stopTts) isn't played. */
export async function playTts(text: string, rate = 1, packId?: string): Promise<void> {
  const mine = ++generation;
  const blob = await clipBlob(text, packId);
  if (mine !== generation) return;
  playing?.pause();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.preservesPitch = true;
  audio.playbackRate = rate;
  audio.onended = () => URL.revokeObjectURL(url);
  playing = audio;
  await audio.play();
}

/** Play a TTS clip and resolve when it FINISHES — for sequential, synced story playback. `rate` =
 *  client-side playbackRate (1 normal / 0.75 slow), pitch-preserved. */
export async function playClip(text: string, rate = 1, packId?: string): Promise<void> {
  const audio = new Audio(URL.createObjectURL(await clipBlob(text, packId)));
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
  return (await call("/api/asr", { method: "POST", body: fd })).json();
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
  /** Both engines heard exactly the line, so the server answered without the LLM. */
  fastPath?: boolean;
  error?: string;
}

export async function feedback(
  target: { answer: string; translit?: string; gloss: string; note?: string },
  transcripts: { scribe?: string; google?: string },
  packId?: string,
): Promise<FeedbackResponse> {
  return (
    await call("/api/feedback", {
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
    await call("/api/chat", {
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

export async function writeCorrect(attempt: string, taskId: string, packId?: string, prompt?: string, reference?: string): Promise<WriteResponse> {
  return (
    await call("/api/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attempt, taskId, packId, prompt, reference }),
    })
  ).json();
}

export type ExamGradeResponse = import("@ll/core/exam/results").ExamGrade & { ms?: number; costUsd?: number; error?: string };

/** Mark one exam task (the server looks the task up by id). A reading task sends `answers`: what the engines
 *  heard for each question, in order. */
export async function gradeExam(body: { examId: string; taskId: string; response?: string; transcripts?: { scribe?: string; google?: string }; answers?: { scribe?: string; google?: string }[] }, packId?: string): Promise<ExamGradeResponse> {
  return (
    await call("/api/exam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, packId }),
    })
  ).json();
}

export interface GlossResponse {
  gloss: string;
  translit?: string;
  lemma?: string;
  source: "override" | "pack" | "pack-lemma" | "cache" | "llm" | "none" | "error";
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
        await call("/api/gloss", {
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
    await call("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, packId }),
    })
  ).json();
}

export interface ExplainResponse {
  answer?: string;
  source?: string;
  error?: string;
  costUsd?: number;
}

/** "Have a question?" — ask one scoped question about a Today conversation. Server caches the answer
 *  cross-user and limits each signed-in caller (25 a day). `canned` carries a grammar-concept id for the
 *  derived chips (cacheable); free-text goes in `question`. */
export async function explain(opts: { packId?: string; convoId: string; lines: { text: string; gloss?: string }[]; question?: string; canned?: string; course?: { chapter: number; taught: string[]; later: { title: string; chapter: number }[] } }): Promise<ExplainResponse> {
  try {
    const res = await call("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    });
    return (await res.json()) as ExplainResponse;
  } catch {
    return { error: "network" };
  }
}

export type GuidedReviewResponse = import("@ll/core/coach").ConversationReview & { error?: string };

/** Review a finished guided conversation (the server looks the cues up by id and rebuilds the AI's lines). */
export async function guidedReview(body: {
  cueIds: string[];
  members: { id: string; name: string; at?: { order: number; n: number } }[];
  segments: { turn: number; transcripts?: { scribe?: string; google?: string }; text?: string; skipped?: boolean }[];
}, packId?: string): Promise<GuidedReviewResponse> {
  const r = await call("/api/guided-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, packId }) });
  return r.json();
}
