"use client";
import { type CSSProperties, type ReactNode } from "react";
import type { VisibilitySettings } from "@ll/core/partner";
import { Icon } from "../shared";

// ---------- Me: settings ----------
// ---------- Partnered learning (Phase 0): invite/consent, visibility, shared streak, activity, nudges ----------
export const NUDGES = ["Proud of you", "Keep the streak going", "Your turn", "Miss practising with you"];
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
/** Is your partner here right now: a small dot (indigo when they are) and the words, no emoji. */
export function Presence({ online, here = "Partner here", away = "Waiting for your partner" }: { online: boolean; here?: string; away?: string }) {
  return <span className={`presence${online ? " on" : ""}`}>{online ? here : away}</span>;
}
/** The top of a partner activity: what it is and where you are in it, whether your partner is here, and a
 *  manual refresh for when the live sync drops. */
export function ActivityHead({ title, left, status, online, onRefresh }: { title?: string; left?: ReactNode; status?: ReactNode; online?: boolean; onRefresh?: () => void }) {
  return (
    <div className="activity-head">
      <div style={{ minWidth: 0 }}>
        {left ?? <div className="overline">{title}</div>}
        {status && <div className="activity-status">{status}</div>}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
        {online !== undefined && <Presence online={online} />}
        {onRefresh && <button className="icon-close" aria-label="Refresh" title="Refresh" onClick={onRefresh}><Icon name="restart" size={15} /></button>}
      </div>
    </div>
  );
}
/** A partner activity's home: what it's for, a start button, and the sessions already going, as rows. */
export function SessionList({ title, desc, onStart, rows }: {
  title: string; desc: string; onStart: () => void;
  rows: { id: string; title: string; status: string; action: string; primary?: boolean; onOpen: () => void }[];
}) {
  return (
    <div className="framed partner-card">
      <div className="overline">{title}</div>
      <p style={{ margin: "8px 0 14px", lineHeight: 1.55 }}>{desc}</p>
      <button className="btn" onClick={onStart}>Start a new one</button>
      {rows.length > 0 && (
        <div className="lib-list" style={{ marginTop: 14 }}>
          {rows.map((r) => (
            <button key={r.id} className="lib-item plain" onClick={r.onOpen}>
              <span style={{ minWidth: 0 }}><span className="lib-title">{r.title}</span><span className="lib-sub">{r.status}</span></span>
              <span className={`lib-fit${r.primary ? " just" : ""}`}>{r.action}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
