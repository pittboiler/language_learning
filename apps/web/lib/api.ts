// Typed client for the server API routes (which hold the provider keys). Ported from the spike.
import type { ReviewItem } from "@ll/pack-schema";

export async function tts(text: string, speed = 1): Promise<Blob> {
  const r = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, speed }),
  });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.blob();
}

export interface AsrResponse {
  eleven?: { text: string; language?: string; ms: number; ok: boolean; error?: string };
  google?: { text: string; ms: number; ok: boolean; error?: string };
}

export async function asr(audio: Blob): Promise<AsrResponse> {
  const fd = new FormData();
  fd.append("audio", audio, "rec.webm");
  return (await fetch("/api/asr", { method: "POST", body: fd })).json();
}

export async function feedback(target: ReviewItem, transcripts: { eleven?: string; google?: string }) {
  return (
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, transcriptEleven: transcripts.eleven, transcriptGoogle: transcripts.google }),
    })
  ).json();
}

export async function chat(userText: string, history: { role: "learner" | "tutor"; text: string }[]) {
  return (
    await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userText, history }),
    })
  ).json();
}
