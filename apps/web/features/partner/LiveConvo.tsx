"use client";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import * as api from "../../lib/api";
import { subscribeArtifacts, joinPresence, sharedArtifactId, type PartnerStore, type PartnerArtifact } from "../../lib/partner-store";
import { translitOr } from "../../lib/romanize";
import * as live from "@ll/core/live";
import type { LiveSession } from "@ll/core/live";
import { colStack } from "./shared";
import { CourseOrderContext, byCourseOrder, usePack, usePlay, useRecorder } from "../shared";

// Live conversation (Phase 4, crown jewel): the app coaches a real-time conversation between the two
// learners over a scenario. The session is a 'live' partner_artifact; both screens stay in sync via
// Supabase Realtime (postgres_changes) + presence, falling back to a manual ↻ if realtime is down.
export function LiveConvoSection({ store, partnershipId, onOpen }: { store: PartnerStore; partnershipId: string; onOpen: (id: string | "new") => void }) {
  const pack = usePack();
  const [sessions, setSessions] = useState<PartnerArtifact[]>([]);
  // Realtime so a partner SEES the session the other just started and joins it (stay-in-sync) — instead
  // of the stale on-mount list that let both hit "Start" and create rival sessions.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const a = await store.listArtifacts(partnershipId, "live");
        if (alive) setSessions(a);
      } catch {
        /* tolerate */
      }
    };
    void load();
    const unsub = subscribeArtifacts(partnershipId, () => void load());
    return () => {
      alive = false;
      unsub();
    };
  }, [store, partnershipId]);
  const activeSessions = sessions.filter((a) => (a.payload as LiveSession).status !== "complete");
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="small">Live conversation</span>
        <button className="btn small" onClick={() => onOpen("new")}>Start →</button>
      </div>
      <p className="muted small" style={{ margin: "4px 0 0" }}>Talk through a scenario together in real time — the app keeps you both in sync and coaches each line.</p>
      {activeSessions.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "6px 0 0", display: "flex", flexDirection: "column", gap: 4 }}>
          {activeSessions.map((a) => {
            const s = a.payload as LiveSession;
            const title = pack.scenarios.find((x) => x.id === s.scenarioId)?.title ?? s.scenarioId;
            return (
              <li key={a.id} className="row" style={{ justifyContent: "space-between" }}>
                <span className="small">{title} <span className="muted">· live now</span></span>
                <button className="btn small" onClick={() => onOpen(a.id)}>Join</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
export function LiveConvo({ store, partnershipId, packId, myId, partnerId, sessionId, scenarioId, onComplete }: {
  store: PartnerStore;
  partnershipId: string;
  packId: string;
  myId: string;
  partnerId: string;
  sessionId: string | "new";
  /** Start (or join) this scenario straight away instead of showing the picker — the joint session's
   *  "Speak together" step. */
  scenarioId?: string;
  /** Fired once the conversation is complete (the joint session ticks its step only then). */
  onComplete?: () => void;
}) {
  const pack = usePack();
  const myOrder = useContext(CourseOrderContext);
  const play = usePlay();
  const [session, setSession] = useState<LiveSession | null>(null);
  // Effective session id: tracks the prop, but flips to the real id once a "new" session is created,
  // so refresh + realtime activate for a freshly-started session (not just pre-existing ones).
  const [sid, setSid] = useState<string | "new">(sessionId);
  useEffect(() => {
    setSid(sessionId);
  }, [sessionId]);
  const [online, setOnline] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tip, setTip] = useState(""); // short coaching tip for my last line, fetched off the critical path
  const [err, setErr] = useState(""); // surface start/sync failures instead of a dead click
  const rec = useRecorder();

  const refresh = useCallback(async () => {
    if (sid === "new") return;
    try {
      const a = (await store.listArtifacts(partnershipId, "live")).find((x) => x.id === sid);
      if (a) setSession(a.payload as LiveSession);
    } catch {
      /* keep current */
    }
  }, [store, partnershipId, sid]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Realtime: re-sync on any artifact change + track presence. Manual ↻ button covers realtime outages.
  useEffect(() => {
    if (sid === "new") return;
    const unsubArtifacts = subscribeArtifacts(partnershipId, () => void refresh());
    const unsubPresence = joinPresence(partnershipId, myId, setOnline);
    return () => {
      unsubArtifacts();
      unsubPresence();
    };
  }, [partnershipId, sid, myId, refresh]);

  const start = async (scenarioId: string) => {
    const sc = pack.scenarios.find((s) => s.id === scenarioId);
    if (!sc) return;
    setErr("");
    try {
      // Deterministic id per (partnership, scenario): two partners starting the same scenario converge on
      // ONE row (PK upsert) instead of minting rival sessions with swapped roles — the dual-learner/deadlock
      // fix, no migration needed. Join an existing session rather than overwriting its in-progress state.
      const id = await sharedArtifactId("live", partnershipId, scenarioId);
      const existing = (await store.listArtifacts(partnershipId, "live")).find((x) => x.id === id);
      if (existing) {
        setSession(existing.payload as LiveSession);
        setSid(id);
        return;
      }
      const sess = live.startLive(id, packId, sc, live.assignLiveRolesStable(myId, partnerId));
      await store.putArtifact(partnershipId, packId, "live", sess, id);
      setSession(sess);
      setSid(id); // activate refresh + realtime for the just-created session
    } catch (e) {
      setErr((e as { message?: string }).message ?? "Couldn't start the session — try again.");
    }
  };

  // The joint session hands over a scenario: start (or join) it without the picker.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (scenarioId && sessionId === "new" && !session && !autoStarted.current) { autoStarted.current = true; void start(scenarioId); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId, sessionId]);

  const completeFired = useRef(false);
  useEffect(() => {
    if (session && live.isComplete(session) && !completeFired.current) { completeFired.current = true; onComplete?.(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const startRec = async () => {
    setRecording(true);
    await rec.current.start();
  };

  const speak = async () => {
    if (!session) return;
    const turn = live.currentTurn(session);
    if (!turn) return;
    const spokenIndex = turn.index;
    setRecording(false);
    setBusy(true);
    setTip("");
    try {
      const blob = await rec.current.stop();
      const asr = await api.asr(blob, packId);
      const transcripts = { scribe: asr.eleven?.text, google: asr.google?.text };
      const transcript = transcripts.scribe || transcripts.google || "";
      // Advance the turn the instant ASR returns — don't make BOTH partners wait ~11s for coaching.
      const latest = ((await store.listArtifacts(partnershipId, "live")).find((x) => x.id === session.id)?.payload as LiveSession) ?? session;
      const next = live.speakTurn(latest, myId, transcript);
      await store.putArtifact(partnershipId, packId, "live", next, next.id);
      setSession(next);
      // Score + a short coaching tip arrive a beat later, off the critical path; realtime backfills both.
      void (async () => {
        try {
          const fb = await api.feedback({ answer: turn.text, translit: turn.translit, gloss: turn.gloss }, transcripts, packId);
          if (fb.error) return;
          if (fb.tip) setTip(fb.tip);
          const cur = ((await store.listArtifacts(partnershipId, "live")).find((x) => x.id === session.id)?.payload as LiveSession) ?? next;
          await store.putArtifact(partnershipId, packId, "live", live.setTurnScore(cur, spokenIndex, fb.score), cur.id);
        } catch {
          /* coaching is best-effort — the turn already advanced */
        }
      })();
    } finally {
      setBusy(false);
    }
  };

  if (sessionId === "new" && !session && scenarioId) {
    return <div className="muted small">Starting {pack.scenarios.find((s) => s.id === scenarioId)?.title ?? "the conversation"}…{err ? <div className="err">{err}</div> : null}</div>;
  }
  if (sessionId === "new" && !session) {
    return (
      <div style={colStack}>
        <span className="small">Pick a scenario to do live together</span>
        {err ? <div className="err">{err}</div> : null}
        <div className="cards">
          {byCourseOrder(pack, pack.scenarios, (x) => x.id, myOrder).map(({ item: s, later }) => (
            <button key={s.id} className="contentcard" style={later ? { opacity: 0.6 } : undefined} onClick={() => start(s.id)}>
              <div className="cc-title">{s.title}{later ? <span className="muted small"> · later chapter</span> : null}</div>
              <div className="muted small">{s.setting}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (!session) return <span className="muted small">…</span>;

  const myRole = live.roleOf(session, myId);
  const turn = live.currentTurn(session);
  const myTurn = live.isMyTurn(session, myId);
  const done = live.isComplete(session);
  const partnerOnline = online.includes(partnerId);

  return (
    <div style={colStack}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="small">Live · <b>{done ? "complete" : myTurn ? "your turn to speak" : "your partner's turn"}</b></span>
        <span className="muted small">{partnerOnline ? "🟢 partner here" : "⚪ waiting for partner"} <button className="ghost small" onClick={refresh}>↻</button></span>
      </div>
      {session.turns.filter((t) => t.spokenBy).map((t) => (
        <div className="fb" key={t.index}>
          <span className="muted small">{t.speaker === myRole ? "you" : "partner"}:</span> <b>{t.text}</b>
          <span className="translit"> · {translitOr(t.text, t.translit)}</span>
          {t.transcript ? <div className="muted small">heard: {t.transcript}{typeof t.score === "number" ? ` · ${t.score}/100` : " · scoring…"}</div> : null}
        </div>
      ))}
      {tip && <div className="fb"><span className="muted small">💡 on your last line: {tip}</span></div>}
      {done ? (
        <p className="lead" style={{ color: "var(--ok)", margin: 0 }}>🎉 Conversation complete — nicely done, both of you!</p>
      ) : myTurn ? (
        <div className="fb">
          <div className="muted small">Your line:</div>
          <div className="row"><button className="spk" onClick={() => turn && play(turn.text, 0.9)}>🔊</button> <b>{turn?.text}</b></div>
          <div className="gloss">{turn?.gloss}{turn ? ` · ${translitOr(turn.text, turn.translit)}` : ""}</div>
          {recording ? <button className="rec" onClick={speak}>⏹ Stop</button> : <button className="btn" disabled={busy} onClick={startRec}>{busy ? "scoring…" : "● say it"}</button>}
        </div>
      ) : (
        <div className="fb">
          <div className="muted small">🎙 Your partner&apos;s line — follow along &amp; help:</div>
          <div className="row"><button className="spk" onClick={() => turn && play(turn.text, 0.9)}>🔊</button> <b>{turn?.text}</b></div>
          <div className="gloss">{turn?.gloss}{turn ? ` · ${translitOr(turn.text, turn.translit)}` : ""}</div>
        </div>
      )}
    </div>
  );
}
