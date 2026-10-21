"use client";
import { useEffect, useState } from "react";
import * as api from "../../lib/api";
import { packList } from "../../lib/packs";
import { type Progress } from "../../lib/store";
import * as cp from "../../lib/course-player";
import { currentUser, sendMagicLink, signOut, supabaseConfigured, type AuthUser } from "../../lib/supabase";
import { FLAG, packUnreviewed, usePack } from "../shared";

// Account / cross-device profile: magic-link sign-in (passwordless). Since progress already upserts to
// user_state keyed by uid, signing in with the same email on another device makes uid() stable across
// devices ⇒ the same row ⇒ synced learning. Anonymous sessions upgrade in place (no data loss).
export function AccountSettings() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void currentUser().then(setUser); }, []);

  if (!supabaseConfigured())
    return (
      <div className="setting-row">
        <b>Account</b>
        <span className="muted small">Cross-device sync needs Supabase — see SUPABASE_SETUP.md.</span>
      </div>
    );

  const send = async () => {
    const e = email.trim();
    if (!e) return;
    setBusy(true);
    setStatus("");
    try {
      const { mode } = await sendMagicLink(e);
      setStatus(`Check ${e} for a sign-in link${mode === "signin" ? " — it signs this device into your existing account" : " to finish setting up your account"}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not send the link — is email sign-in enabled in Supabase?");
    } finally {
      setBusy(false);
    }
  };
  const out = async () => {
    setBusy(true);
    try {
      await signOut();
      setUser(await currentUser());
      setStatus("Signed out on this device.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="setting-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
      <b>Account</b>
      {user && !user.isAnonymous && user.email ? (
        <div className="row" style={{ width: "100%", justifyContent: "space-between" }}>
          <span className="small">Signed in as <b>{user.email}</b> — your learning syncs to any device you sign in on.</span>
          <button className="ghost small" disabled={busy} onClick={out}>Sign out</button>
        </div>
      ) : (
        <>
          <span className="muted small">Sign in to carry your progress across web and phone — we&apos;ll email a one-tap link, no password.</span>
          <div className="row" style={{ width: "100%" }}>
            <input className="lang-picker" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
            <button className="btn" disabled={busy || !email.trim()} onClick={send}>{busy ? "Sending…" : "Send link"}</button>
          </div>
        </>
      )}
      {status && <span className="muted small">{status}</span>}
    </div>
  );
}
// Account & app settings — a header-triggered slide-over (was the "Me" tab body). Everything you-specific
// that's CONFIG lives here; the Partnered tab is now purely the dyad. Backdrop click / ✕ closes it.
export function AccountPanel({ progress, persist, config, onClose }: { progress: Progress; persist: (p: Progress) => void; config: api.Config | null; onClose: () => void }) {
  const pack = usePack();
  const autoplay = progress.settings?.autoplay ?? false;
  const slow = progress.settings?.slow ?? false;
  const slowRate = progress.settings?.slowRate ?? 0.75;
  const badge = (l: string, on?: boolean) => <span className={`badge ${on ? "on" : "off"}`} key={l}>{l} {on ? "✓" : "✗"}</span>;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
      <div className="view" onClick={(e) => e.stopPropagation()} style={{ width: "min(440px, 94vw)", height: "100%", borderRadius: 0, overflowY: "auto" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Account &amp; settings</h2>
          <button className="ghost small" onClick={onClose}>✕ Close</button>
        </div>
        <AccountSettings />
      <div className="setting-row">
        <b>Language</b>
        {packList().length > 1 ? (
          <select className="lang-picker" aria-label="Language" value={pack.id} onChange={(e) => persist({ ...progress, activePackId: e.target.value, pick: null })}>
            {packList().map((p) => <option key={p.id} value={p.id}>{(FLAG[p.id] ?? "🌐") + " " + p.name}</option>)}
          </select>
        ) : <span className="muted">{pack.name}</span>}
      </div>
      <div className="setting-row">
        <b>Auto-play audio</b>
        <button className="ghost" onClick={() => persist({ ...progress, settings: { ...progress.settings, autoplay: !autoplay } })}>{autoplay ? "🔊 On" : "🔇 Off"}</button>
        <span className="muted small">Play the other speaker's lines automatically in scenarios and stories.</span>
      </div>
      <div className="setting-row">
        <b>Playback speed</b>
        <button className="ghost" onClick={() => persist({ ...progress, settings: { ...progress.settings, slow: !slow } })}>{slow ? "🐢 Slow" : "🔊 Normal"}</button>
        <span className="muted small">One speed for all spoken audio across the app (also on the header switch).</span>
        {slow && (
          <label className="row small" style={{ width: "100%", gap: 8, marginTop: 6 }}>
            <span className="muted">Slow speed</span>
            <input
              type="range" min={0.5} max={0.9} step={0.05} value={slowRate}
              onChange={(e) => persist({ ...progress, settings: { ...progress.settings, slowRate: Number(e.target.value) } })}
              style={{ flex: 1 }}
            />
            <span className="muted" style={{ minWidth: 64, textAlign: "right" }}>{Math.round(slowRate * 100)}% {slowRate <= 0.55 ? "🐌" : "🐢"}</span>
          </label>
        )}
      </div>
      {pack.course?.chapters.length ? (
        <div className="setting-row">
          <b>New course (beta)</b>
          <button className="ghost" onClick={() => persist({ ...progress, settings: { ...progress.settings, courseV2: !(progress.settings?.courseV2 ?? cp.COURSE_V2_DEFAULT) } })}>{cp.courseV2On(pack, progress) ? "✓ On" : "Off"}</button>
          <span className="muted small">Today follows the redesigned course: one grammar point at a time, a fixed plan per chapter, and review days built in.</span>
        </div>
      ) : null}
      <div className="setting-row">
        <b>Speech &amp; AI</b>
        {config ? [badge("Scribe", config.engines.eleven), badge("Google", config.engines.google), badge("Claude", config.engines.anthropic)] : <span className="muted small">…</span>}
      </div>
      {packUnreviewed(pack) && (
        <div className="setting-row">
          <span className="badge warn">⚠ unreviewed</span>
          <span className="muted small">This pack's content is machine-generated, pending native review — not yet authoritative.</span>
        </div>
      )}
      </div>
    </div>
  );
}
