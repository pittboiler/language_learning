"use client";
import { type CSSProperties } from "react";
import type { VisibilitySettings } from "@ll/core/partner";

// ---------- Me: settings ----------
// ---------- Partnered learning (Phase 0): invite/consent, visibility, shared streak, activity, nudges ----------
export const NUDGES = ["Proud of you 💪", "Keep the streak 🔥", "Your turn 🎤", "Miss practising with you 👋"];
export const VIS_TOGGLES: [keyof VisibilitySettings, string][] = [
  ["shareActivity", "Activity"],
  ["shareStreak", "Streak"],
  ["shareFamiliarity", "Vocabulary"],
  ["allowTeachBack", "Teach-back"],
];
export const colStack: CSSProperties = { display: "flex", flexDirection: "column", gap: 10 };
// Async voice role-swap (Phase 1, flagship): split a 2-role scenario across the dyad; each records
// their lines (reusing makeRecorder + the dual-ASR feedback pipeline), the app stitches them into a
// replayable conversation. The session — incl. recorded audio as data-URLs for the MVP — is one
// partner_artifact (kind 'roleswap'); recording re-reads latest before saving to avoid clobber.
export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error("audio read failed"));
    r.readAsDataURL(blob);
  });
export const playDataUrl = (url: string): Promise<void> =>
  new Promise((res, rej) => {
    const a = new Audio(url);
    a.onended = () => res();
    a.onerror = () => rej(new Error("audio playback error"));
    a.play().catch(rej);
  });
