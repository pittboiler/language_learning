"use client";
// Phase 0-1 UI ported from spike/public/index.html into React, on @ll/core + the ACTIVE language pack.
// The pack is selected by id from the registry (progress.activePackId) and flows through context — the
// UI reads the active pack, never a hardcoded language import. Pure engines (scenario/srs/leveling) run
// client-side; paid calls (tts/asr/feedback/chat) hit the server route handlers that hold the keys.
//
// Navigation is four sections — Today (the guided daily flow) / Library (Situations + Flashcards +
// Reference) / Progress (stats + Flashcards) / Partnered. "Today" sequences one session in a building order:
// warm-up review → new words → new grammar → story → speak. See DESIGN notes for the rationale.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as familiarity from "@ll/core/familiarity";
import * as scoring from "@ll/core/familiarity/scoring";
import * as api from "../lib/api";
import { getPack } from "../lib/packs";
import { getStore, emptyProgress, type Progress } from "../lib/store";
import * as cp from "../lib/course-player";
import { reviewPool } from "../lib/today-plan";
import { getPartnerStore } from "../lib/partner-store";
import { currentUser, type AuthUser } from "../lib/supabase";
import { AccountPanel } from "../features/account/AccountPanel";
import { Review } from "../features/flashcards/Review";
import { LibrarySection } from "../features/library/LibrarySection";
import { PartnerPanel, publishMine } from "../features/partner/PartnerPanel";
import { ProgressDash } from "../features/progress/ProgressDash";
import { CourseOrderContext, LibView, NoteAt, PackContext, ReplayContext, Section, SlowContext, computeLevel, effectiveRate, focusLetters, isDue, nameCard } from "../features/shared";
import { Today } from "../features/today/Today";

export default function Home() {
  const store = useMemo(() => getStore(), []);
  const [progress, setProgress] = useState<Progress>(emptyProgress());
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<api.Config | null>(null);
  const [section, setSection] = useState<Section>("today");
  // A finished lesson being done again (Progress / My notes → "Do again"); null = the real session.
  const [replay, setReplay] = useState<{ at: NoteAt; key: number } | null>(null);
  const [libView, setLibView] = useState<LibView>("browse");
  const [acctOpen, setAcctOpen] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const pack = useMemo(() => getPack(progress.activePackId), [progress.activePackId]);

  useEffect(() => {
    (async () => {
      const p = await store.load();
      const loadedPack = getPack(p.activePackId);
      // One-time: migrate legacy reviews (itemId→FSRS) into the lexKey-keyed familiarity store.
      if (p.reviews && Object.keys(p.reviews).length && !Object.keys(p.familiarity).length) {
        p.familiarity = familiarity.migrateReviews(p.reviews, reviewPool(loadedPack));
        delete p.reviews;
      }
      if (!p.pick) p.pick = loadedPack.scenarios[0]!.id;
      setProgress(p);
      setReady(true);
      api.getConfig().then(setConfig).catch(() => {});
    })();
  }, [store]);

  // Who's signed in (drives the header account chip). Re-read when the account panel closes, so signing
  // in/out there reflects immediately.
  useEffect(() => { void currentUser().then(setAuthUser).catch(() => {}); }, [acctOpen]);

  // Light / dark / follow the system. The setting syncs with progress; localStorage keeps a copy so the
  // layout can apply it before first paint next time.
  const theme = progress.settings?.theme ?? "system";
  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    try { localStorage.setItem("ll-theme", theme); } catch { /* private mode: first paint follows the system */ }
  }, [theme, ready]);

  const persist = useCallback(
    (next: Progress) => {
      setProgress(next);
      void store.save(next);
    },
    [store],
  );

  // Jump to a section (optionally a Library sub-view + a pre-picked scenario). Used by the Today flow.
  const navigate = useCallback(
    (sec: Section, lv?: LibView, scenarioId?: string) => {
      if (scenarioId) persist({ ...progress, pick: scenarioId });
      if (lv) setLibView(lv);
      setSection(sec);
    },
    [persist, progress],
  );

  // Open a specific mini-story in the Library reader (used by the partner "shared story" deep-link).
  const goToStory = useCallback(
    (storyId: string) => {
      persist({ ...progress, storyPick: storyId });
      setLibView("story");
      setSection("library");
    },
    [persist, progress],
  );

  // ---- derived progress signals ----
  const lettersDone = focusLetters(pack).every((a) => progress.letters[a.glyph]);
  const dueCount = useMemo(() => {
    const now = new Date();
    // The same pool the Flashcards deck reviews (new course: words + the grammar cards of taught points).
    const pool = cp.courseV2On(pack, progress) && pack.course ? [...pack.vocab, ...cp.taughtPointItems(pack.course, progress)] : reviewPool(pack);
    const poolKeys = new Set(pool.map((it) => familiarity.deriveKeyForItem(it).lexKey));
    const poolDue = pool.filter((it) => isDue(progress, it, now)).length;
    const capturedDue = Object.values(progress.familiarity).filter((e) => familiarity.isStudied(e) && e.srs && new Date(e.srs.due) <= now && (e.kind === "word" || e.kind === "chunk") && !poolKeys.has(e.lexKey) && !nameCard(e.display, pack)).length;
    return poolDue + capturedDue;
  }, [progress, pack]);
  const level = useMemo(() => computeLevel(pack, progress), [pack, progress]);
  const vocab = useMemo(() => scoring.computeMetrics(progress.familiarity), [progress.familiarity]);

  // Keep partners up to date: publish where I am when the app opens and whenever my place in the course moves
  // (a session finished) — not only when the Partnered tab is opened.
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const shareSig = ready ? `${JSON.stringify(cp.positionShare(pack, progress) ?? null)}|${progress.streak?.lastDay ?? ""}` : "";
  useEffect(() => {
    const ps = shareSig ? getPartnerStore() : null;
    if (!ps) return;
    void (async () => {
      try {
        for (const l of await ps.myPartnerships(pack.id)) if (l.status === "active") await publishMine(ps, pack, progressRef.current, l.id);
      } catch { /* best-effort — the Partnered tab publishes again when opened */ }
    })();
  }, [shareSig, pack]);

  if (!ready) return <main style={{ padding: 24 }}>Loading…</main>;

  return (
    <PackContext.Provider value={pack}>
      <SlowContext.Provider value={effectiveRate(progress.settings)}>
      <header>
        <div className="brand">
          <h1>{pack.name}</h1>
          <span className="header-meta">Level {level.cefrBand} · {vocab.knownWordCount} words known</span>
        </div>
        <div className="header-actions">
          <button className="ghost small" aria-label={`Playback speed: ${progress.settings?.slow ? "slow" : "normal"}`} title="Playback speed for all spoken audio" onClick={() => persist({ ...progress, settings: { ...progress.settings, slow: !progress.settings?.slow } })}>{progress.settings?.slow ? `${effectiveRate(progress.settings)}×` : "1×"}</button>
          <button className="avatar" aria-label="Account and settings" title="Account & settings" onClick={() => setAcctOpen(true)}>{(authUser && !authUser.isAnonymous && authUser.email ? authUser.email[0]! : "").toUpperCase() || <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></svg>}</button>
        </div>
      </header>
      <nav>
        {([
          ["today", "Today"],
          ["library", "Library"],
          ["progress", "Progress"],
          ["partnered", "Partnered"],
        ] as [Section, string][]).map(([s, label]) => (
          <button key={s} className={section === s && !replay ? "active" : ""} onClick={() => { setReplay(null); setSection(s); }}>{label}</button>
        ))}
      </nav>
      <CourseOrderContext.Provider value={cp.courseV2On(pack, progress) && pack.course ? cp.currentSlot(pack.course, progress).order : undefined}>
      <ReplayContext.Provider value={cp.courseV2On(pack, progress) && pack.course ? (at) => { setReplay({ at, key: Date.now() }); window.scrollTo(0, 0); } : null}>
      <main>
        {/* Replaying a finished lesson: its own Today, on top; your real session stays as it was underneath. */}
        {replay && <Today key={replay.key} progress={progress} persist={persist} config={config} navigate={navigate} replay={{ at: replay.at, onExit: () => setReplay(null) }} />}
        {/* Today stays MOUNTED (just hidden) across tab switches so your place in the session — the
            step index and the once-built plan — survives. Other sections are cheap to remount. */}
        <div style={{ display: section === "today" && !replay ? undefined : "none" }}>
          <Today progress={progress} persist={persist} config={config} navigate={navigate} />
        </div>
        {!replay && section === "library" && (
          <LibrarySection progress={progress} persist={persist} config={config} lettersDone={lettersDone} mode={libView} setMode={setLibView} />
        )}
        {!replay && section === "progress" && (
          <>
            <ProgressDash progress={progress} persist={persist} navigate={navigate} dueCount={dueCount} />
            <Review progress={progress} persist={persist} />
          </>
        )}
        {!replay && section === "partnered" && <PartnerPanel progress={progress} persist={persist} config={config} navigateToStory={goToStory} />}
      </main>
      </ReplayContext.Provider>
      </CourseOrderContext.Provider>
      {acctOpen && <AccountPanel progress={progress} persist={persist} config={config} onClose={() => setAcctOpen(false)} />}
      </SlowContext.Provider>
    </PackContext.Provider>
  );
}
