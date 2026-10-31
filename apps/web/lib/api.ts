// Typed client for the server API routes (which hold the provider keys).
import { supabase, uid } from "./supabase";

// Every /api route checks the caller's Supabase session (lib/server-auth.ts), so each request carries it as a
// bearer token. The first try makes the anonymous session when there's none yet (a first visit, as the stores
// do). A 401 gets one retry after refreshing the token, with the SAME identity: never a new anonymous one,
// which would orphan the learner's saved progress and partnerships. With no session to send, the request
// isn't made: the learner sees why, and the console says so.
async function sessionToken(make: boolean): Promise<string | { why: string; made: boolean }> {
  const sb = supabase();
  if (!sb) return ""; // no Supabase (local dev): the server treats every request as one local caller
  try {
    if (make) await uid();
    const { data, error } = await sb.auth.getSession();
    return data.session ? data.session.access_token : { why: error?.message ?? "no session", made: make };
  } catch (e) {
    return { why: e instanceof Error ? e.message : String(e), made: make };
  }
}
async function call(path: string, init: RequestInit = {}): Promise<Response> {
  let unsent: Response | null = null; // the refusal made here when there was no session to send
  const send = async (make: boolean) => {
    const token = await sessionToken(make);
    if (typeof token !== "string") {
      console.warn(`[session] no session for ${path}: ${token.why}`);
      const error = token.made ? `We couldn't start your session (${token.why}). Reload the page and try again.` : "Your session ended. Reload the page and try again.";
      return (unsent = new Response(JSON.stringify({ error, code: "no_session" }), { status: 401, headers: { "Content-Type": "application/json" } }));
    }
    return fetch(path, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  };
  const res = await send(true);
  const sb = supabase();
  if (res === unsent || res.status !== 401 || !sb) return res;
  const { error } = await sb.auth.refreshSession();
  if (error) console.warn(`[session] ${path} was refused and the refresh failed: ${error.message}`);
  return send(false);
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
// 2026-10-31 (Jake: in Build a sentence „Не знам“ stayed silent however often he tapped): a line must never
// get stuck. A request that hangs gives up after CLIP_TIMEOUT_MS, only real audio is kept, a clip that won't
// play is fetched afresh on the next tap, and the caller learns it failed (the speaker button shows it).
const CLIPS_KEPT = 200;
/** Longer than the server's own limit (a first play's checked takes, 30 s), so only a stalled request ends here. */
const CLIP_TIMEOUT_MS = 35_000;
const clips = new Map<string, Promise<Blob>>();
/** Clips already fetched, so a tap plays at once, inside the tap (Safari refuses a sound that starts later). */
const ready = new Map<string, Blob>();
const clipKey = (text: string, packId?: string) => `${packId ?? ""}|${text}`;
function forget(key: string): void {
  clips.delete(key);
  ready.delete(key);
}
function clipBlob(text: string, packId?: string): Promise<Blob> {
  const key = clipKey(text, packId);
  let p = clips.get(key);
  if (!p) {
    p = call("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, packId }), signal: AbortSignal.timeout(CLIP_TIMEOUT_MS) })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "TTS failed");
        const blob = await r.blob();
        // Anything but audio (an error page, an empty body) would otherwise sit here and keep the line silent.
        if (!blob.size || !(r.headers.get("content-type") ?? blob.type).startsWith("audio/")) throw new Error("not audio");
        ready.set(key, blob);
        return blob;
      });
    p.catch(() => forget(key)); // a failure isn't kept: the next play tries again
    clips.set(key, p);
    if (clips.size > CLIPS_KEPT) forget(clips.keys().next().value!);
  }
  return p;
}
// One audio element for every line: once a tap has started it, later plays on it are allowed everywhere.
let player: HTMLAudioElement | null = null;
let playerUrl: string | null = null;
let generation = 0;
/** 10 ms of silence: started inside the tap while the clip is still loading, so the tap's permission to make a
 *  sound carries over to the clip (iOS and Safari only let a sound start inside a tap). */
const SILENCE = "data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";

/** Start fetching a line now, so it plays at once when asked for. */
export function prefetchTts(text: string, packId?: string): void {
  if (text.trim()) clipBlob(text, packId).catch(() => {});
}

/** Stop the line playing, and drop any line still loading. */
export function stopTts(): void {
  generation++;
  player?.pause();
}

/** Synthesize (cached) + play TTS for the active pack's voice. The clip is natural speed; `rate` is the
 *  client-side playbackRate for the slow/normal toggle (1 = normal, 0.75 = slow) — pitch-preserved. The
 *  newest call wins: a line that arrives after another was asked for (or after stopTts) isn't played.
 *  Resolves true once the line is playing (or another took its place), false when it couldn't be played. */
export async function playTts(text: string, rate = 1, packId?: string): Promise<boolean> {
  const mine = ++generation;
  const key = clipKey(text, packId);
  const el = (player ??= new Audio());
  el.pause();
  let blob = ready.get(key);
  if (!blob) {
    el.src = SILENCE;
    el.play().catch(() => {});
    try { blob = await clipBlob(text, packId); } catch { return mine !== generation; }
    if (mine !== generation) return true;
  }
  if (playerUrl) URL.revokeObjectURL(playerUrl);
  playerUrl = URL.createObjectURL(blob);
  el.src = playerUrl;
  el.preservesPitch = true;
  el.defaultPlaybackRate = rate; // a new source resets the rate to this
  el.playbackRate = rate;
  try {
    await el.play();
    return true;
  } catch (e) {
    if (mine !== generation || (e as { name?: string }).name === "AbortError") return true; // a newer line took over
    forget(key); // a clip that won't play is fetched afresh next time
    return false;
  }
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
