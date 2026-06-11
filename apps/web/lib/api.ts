// Typed client for the server API routes (which hold the provider keys).

export interface Config {
  engines: { eleven: boolean; google: boolean; anthropic: boolean };
  models: { live: string; offline: string; tts: string };
}

export async function getConfig(): Promise<Config> {
  return (await fetch("/api/config")).json();
}

/** Synthesize + play TTS. speed 0.7 (slowest) … 1.2. */
export async function playTts(text: string, speed = 1): Promise<void> {
  const r = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, speed }),
  });
  if (!r.ok) throw new Error((await r.json()).error || "TTS failed");
  const audio = new Audio(URL.createObjectURL(await r.blob()));
  await audio.play();
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

export async function asr(blob: Blob): Promise<AsrResponse> {
  const fd = new FormData();
  fd.append("audio", blob, "rec.webm");
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
): Promise<FeedbackResponse> {
  return (
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, transcripts }),
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
): Promise<ChatResponse> {
  return (
    await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userText, history, scenarioId }),
    })
  ).json();
}
