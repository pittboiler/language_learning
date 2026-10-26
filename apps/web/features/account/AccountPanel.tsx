"use client";
import { useEffect, useState } from "react";
import * as api from "../../lib/api";
import { packList } from "../../lib/packs";
import { type Progress } from "../../lib/store";
import * as cp from "../../lib/course-player";
import { currentUser, sendMagicLink, signOut, supabaseConfigured, type AuthUser } from "../../lib/supabase";
import { Icon, packUnreviewed, usePack } from "../shared";

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
        <span className="muted small">Cross-device sync needs Supabase: see SUPABASE_SETUP.md.</span>
      </div>
    );

  const send = async () => {
    const e = email.trim();
    if (!e) return;
    setBusy(true);
    setStatus("");
    try {
      const { mode } = await sendMagicLink(e);
      setStatus(`Check ${e} for a sign-in link${mode === "signin" ? ". It signs this device into your existing account" : " to finish setting up your account"}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not send the link. Is email sign-in enabled in Supabase?");
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
          <span className="small">Signed in as <b>{user.email}</b>. Your learning syncs to any device you sign in on.</span>
          <button className="ghost small" disabled={busy} onClick={out}>Sign out</button>
        </div>
      ) : (
        <>
          <span className="muted small">Sign in to carry your progress across web and phone. We&apos;ll email a one-tap link, no password.</span>
          <div className="row" style={{ width: "100%" }}>
            <input className="text" type="email" aria-label="Email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
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
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "var(--scrim)", zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
      <div className="drawer" role="dialog" aria-modal="true" aria-label="Account and settings" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Account &amp; settings</h2>
          <button className="icon-close" aria-label="Close" title="Close" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>
        <AccountSettings />
      <div className="setting-row">
        <b>Appearance</b>
        <div className="row" role="group" aria-label="Appearance" style={{ gap: 6 }}>
          {(["system", "light", "dark"] as const).map((t) => (
            <button key={t} className={`ghost small${(progress.settings?.theme ?? "system") === t ? " active" : ""}`} aria-pressed={(progress.settings?.theme ?? "system") === t} onClick={() => persist({ ...progress, settings: { ...progress.settings, theme: t } })}>
              {t === "system" ? "Match my device" : t === "light" ? "Light" : "Dark"}
            </button>
          ))}
        </div>
      </div>
      <div className="setting-row">
        <b>Language</b>
        {packList().length > 1 ? (
          <select className="lang-picker" aria-label="Language" value={pack.id} onChange={(e) => persist({ ...progress, activePackId: e.target.value, pick: null })}>
            {packList().map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ) : <span className="muted">{pack.name}</span>}
      </div>
      <div className="setting-row">
        <b>Auto-play audio</b>
        <button className={`ghost${autoplay ? " active" : ""}`} aria-pressed={autoplay} onClick={() => persist({ ...progress, settings: { ...progress.settings, autoplay: !autoplay } })}>{autoplay ? "On" : "Off"}</button>
        <span className="muted small">Play the other speaker's lines automatically in scenarios and stories.</span>
      </div>
      <div className="setting-row">
        <b>Playback speed</b>
        <button className={`ghost${slow ? " active" : ""}`} aria-pressed={slow} onClick={() => persist({ ...progress, settings: { ...progress.settings, slow: !slow } })}>{slow ? "Slow" : "Normal"}</button>
        <span className="muted small">One speed for all spoken audio across the app (also on the header switch).</span>
        {slow && (
          <label className="row small" style={{ width: "100%", gap: 8, marginTop: 6 }}>
            <span className="muted">Slow speed</span>
            <input
              type="range" min={0.5} max={0.9} step={0.05} value={slowRate}
              onChange={(e) => persist({ ...progress, settings: { ...progress.settings, slowRate: Number(e.target.value) } })}
              style={{ flex: 1 }}
            />
            <span className="muted" style={{ minWidth: 64, textAlign: "right" }}>{Math.round(slowRate * 100)}%</span>
          </label>
        )}
      </div>
      {pack.course?.chapters.length ? (
        <div className="setting-row">
          <b>New course (beta)</b>
          <button className={`ghost${cp.courseV2On(pack, progress) ? " active" : ""}`} aria-pressed={cp.courseV2On(pack, progress)} onClick={() => persist({ ...progress, settings: { ...progress.settings, courseV2: !(progress.settings?.courseV2 ?? cp.COURSE_V2_DEFAULT) } })}>{cp.courseV2On(pack, progress) ? "On" : "Off"}</button>
          <span className="muted small">Today follows the redesigned course: one grammar point at a time, a fixed plan per chapter, and review days built in.</span>
        </div>
      ) : null}
      {config && !(config.engines.anthropic && (config.engines.eleven || config.engines.google)) && (
        <div className="setting-row"><span className="muted small">Some speaking and feedback features aren&apos;t available right now.</span></div>
      )}
      {packUnreviewed(pack) && (
        <div className="setting-row">
          <span className="badge warn">Not reviewed yet</span>
          <span className="muted small">This pack&apos;s content is machine-generated and waiting for a native speaker&apos;s review, so it isn&apos;t authoritative yet.</span>
        </div>
      )}
      </div>
    </div>
  );
}
