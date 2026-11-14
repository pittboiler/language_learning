"use client";
import { useCallback, useContext, useEffect, useState } from "react";
import * as api from "../../lib/api";
import { subscribeArtifacts, sharedArtifactId, type PartnerStore, type PartnerArtifact } from "../../lib/partner-store";
import { translitOr } from "../../lib/romanize";
import * as roleswap from "@ll/core/roleswap";
import type { RoleSwapSession, RoleSwapTurn } from "@ll/core/roleswap";
import type { SpeakingFeedback } from "@ll/core/speaking";
import { ActivityHead, SessionList, blobToDataUrl, colStack, playDataUrl } from "./shared";
import { CourseOrderContext, Icon, byCourseOrder, usePack, useRecorder } from "../shared";

// Overview entry: list in-progress/ready role-swaps + start a new one.
export function RoleSwapSection({ store, partnershipId, onOpen }: { store: PartnerStore; partnershipId: string; onOpen: (id: string | "new") => void }) {
  const pack = usePack();
  const [sessions, setSessions] = useState<PartnerArtifact[]>([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const a = await store.listArtifacts(partnershipId, "roleswap");
        if (alive) setSessions(a);
      } catch {
        /* overview tolerates a missing list */
      }
    };
    void load();
    const unsub = subscribeArtifacts(partnershipId, () => void load());
    return () => {
      alive = false;
      unsub();
    };
  }, [store, partnershipId]);
  return (
    <SessionList title="Role-swap" desc="Act out a two-person conversation together: each of you records your own lines, then you play it back with feedback."
      onStart={() => onOpen("new")}
      rows={sessions.map((a) => {
        const s = a.payload as RoleSwapSession;
        const done = s.turns.filter((t) => t.recordedBy).length;
        return { id: a.id, title: pack.scenarios.find((x) => x.id === s.scenarioId)?.title ?? s.scenarioId, status: s.status === "complete" ? "Ready to play" : `${done} of ${s.turns.length} lines recorded`, action: "Open", primary: s.status === "complete", onOpen: () => onOpen(a.id) };
      })} />
  );
}
// The role-swap session: pick a scenario (when "new"), record your role's lines, see the partner's,
// then play the stitched conversation. Each recording runs the dual-ASR feedback pipeline.
// Lines show in English: you say yours in Macedonian, with the Macedonian a tap away as a hint (Jake,
// 2026-11-14). It shows by itself once a line is recorded, to check against.
// Saving (2026-11-14): both partners write the same shared row, so every write re-reads the latest copy and
// changes only its own line, straight before writing. The recording is saved first and the feedback (a slow
// call) added after, so a partner saving in between can no longer be wiped out. The view follows the row live.
const MIN_TAKE_BYTES = 1500; // a webm with no audio in it is a few hundred bytes
export function RoleSwap({ store, partnershipId, packId, myId, partnerId, sessionId }: {
  store: PartnerStore;
  partnershipId: string;
  packId: string;
  myId: string;
  partnerId: string;
  sessionId: string | "new";
}) {
  const pack = usePack();
  const myOrder = useContext(CourseOrderContext);
  // The session's real id: "Start a new one" opens with "new", and start() learns the id.
  const [sid, setSid] = useState<string | "new">(sessionId);
  const [session, setSession] = useState<RoleSwapSession | null>(null);
  const [recIdx, setRecIdx] = useState<number | null>(null);
  const [busyIdx, setBusyIdx] = useState<number | null>(null);
  const [shown, setShown] = useState<Set<number>>(new Set());
  const [err, setErr] = useState(""); // surface failures instead of a dead click
  const rec = useRecorder();

  const latest = useCallback(async (): Promise<RoleSwapSession | null> => {
    if (sid === "new") return null;
    const a = (await store.listArtifacts(partnershipId, "roleswap")).find((x) => x.id === sid);
    return a ? (a.payload as RoleSwapSession) : null;
  }, [store, partnershipId, sid]);
  const refresh = useCallback(async () => {
    try {
      const s = await latest();
      if (s) setSession(s);
    } catch {
      /* keep whatever we have */
    }
  }, [latest]);
  useEffect(() => {
    void refresh();
    if (sid === "new") return;
    // Your partner's recordings appear as they save them.
    return subscribeArtifacts(partnershipId, () => void refresh());
  }, [refresh, partnershipId, sid]);

  const start = async (scenarioId: string) => {
    const sc = pack.scenarios.find((s) => s.id === scenarioId);
    if (!sc) return;
    setErr("");
    try {
      // Deterministic id + join-don't-duplicate: both partners land on ONE shared session so their
      // recordings accumulate together instead of two rival half-recorded copies. Roles sorted for stability.
      const id = await sharedArtifactId("roleswap", partnershipId, scenarioId);
      const existing = (await store.listArtifacts(partnershipId, "roleswap")).find((x) => x.id === id);
      setSid(id);
      if (existing) {
        setSession(existing.payload as RoleSwapSession);
        return;
      }
      const [lo, hi] = [myId, partnerId].sort();
      const sess = roleswap.startRoleSwap(id, packId, sc, roleswap.assignRoles(lo!, hi!));
      await store.putArtifact(partnershipId, packId, "roleswap", sess, id);
      setSession(sess);
    } catch (e) {
      setErr((e as { message?: string }).message ?? "Couldn't start the session: try again.");
    }
  };

  // Change one line on the freshest copy of the session and save it.
  const write = async (change: (s: RoleSwapSession) => RoleSwapSession) => {
    const base = (await latest()) ?? session!;
    const next = change(base);
    await store.putArtifact(partnershipId, packId, "roleswap", next, next.id);
    setSession(next);
  };

  const onRecord = async (turn: RoleSwapTurn) => {
    setErr("");
    setRecIdx(turn.index);
    try {
      await rec.current.start();
    } catch {
      setRecIdx(null);
      setErr("Couldn't use the microphone. Check that the browser may use it, then try again.");
    }
  };

  const onStop = async (turn: RoleSwapTurn) => {
    setRecIdx(null);
    setBusyIdx(turn.index);
    try {
      const blob = await rec.current.stop();
      if (blob.size < MIN_TAKE_BYTES) throw new Error("Nothing was recorded. Check the microphone and record the line again.");
      const dataUrl = await blobToDataUrl(blob);
      const asr = await api.asr(blob, packId);
      const transcripts = { scribe: asr.eleven?.text, google: asr.google?.text };
      // The take first, so it's safe whatever happens with the feedback.
      await write((s) => roleswap.recordTurn(s, turn.index, myId, dataUrl, transcripts));
      try {
        const fb = await api.feedback({ answer: turn.text, translit: turn.translit, gloss: turn.gloss }, transcripts, packId);
        if (!fb.error) await write((s) => (s.turns[turn.index]?.audio === dataUrl ? roleswap.attachFeedback(s, turn.index, fb as unknown as SpeakingFeedback) : s));
      } catch {
        setErr("Your recording is saved, but the feedback on it didn't come through.");
      }
    } catch (e) {
      setErr((e as { message?: string }).message ?? "Couldn't save that recording: try again.");
    } finally {
      setBusyIdx(null);
    }
  };

  const playAll = async () => {
    if (!session) return;
    for (const t of session.turns) if (t.audio) await playDataUrl(t.audio);
  };

  if (sid === "new" && !session) {
    return (
      <div style={colStack}>
        <span className="small">Pick a scenario to act out together</span>
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

  const myRole = session.assignment[myId];
  const busy = recIdx !== null || busyIdx !== null;
  const show = (i: number) => setShown((x) => new Set(x).add(i));
  return (
    <div style={colStack}>
      <ActivityHead title="Role-swap" status={<>Say the lines marked <b>Your line</b> in Macedonian, from the English; your partner says the rest. Stuck? Show the Macedonian for that line.</>} onRefresh={refresh} />
      {err ? <div className="err">{err}</div> : null}
      <div className="framed write-card">
      {session.turns.map((t) => {
        const mine = t.speaker === myRole;
        const mk = shown.has(t.index) || !!t.recordedBy;
        return (
          <div className="written-row" key={t.index}>
            <div className="model-line" style={{ marginTop: 0 }}><span>{t.gloss}</span>{mine && <span className="mark" style={{ color: "var(--accent)" }}>Your line</span>}</div>
            {mk
              ? <div className="small" style={{ margin: "2px 0 6px" }}><span className="mk" lang={pack.id}>{t.text}</span> <span className="muted">· {translitOr(t.text, t.translit)}</span></div>
              : <div style={{ margin: "2px 0 6px" }}><button className="linklike small" onClick={() => show(t.index)}>Show the Macedonian</button></div>}
            {t.recordedBy ? (
              <div className="row" style={{ marginTop: 4 }}>
                <button className="ghost small" onClick={() => t.audio && playDataUrl(t.audio)}><Icon name="speaker" size={16} />Play</button>
                <span className="muted small">{t.recordedBy === myId ? "You recorded it" : "Your partner recorded it"}{t.feedback ? ` · ${t.feedback.score}/100` : busyIdx === t.index ? " · checking…" : ""}</span>
                {mine && (recIdx === t.index
                  ? <button className="rec" onClick={() => onStop(t)}><Icon name="stop" size={16} />Stop and save</button>
                  : <button className="ghost small" disabled={busy} onClick={() => onRecord(t)}><Icon name="mic" size={14} />Record again</button>)}
              </div>
            ) : mine ? (
              recIdx === t.index ? (
                <button className="rec" onClick={() => onStop(t)}><Icon name="stop" size={16} />Stop and save</button>
              ) : (
                <button className="btn small" disabled={busy} onClick={() => onRecord(t)}><Icon name="mic" size={14} />{busyIdx === t.index ? "Saving…" : "Record your line"}</button>
              )
            ) : (
              <span className="muted small">Waiting for your partner</span>
            )}
          </div>
        );
      })}
      </div>
      {roleswap.isStitchable(session) && <button className="btn" onClick={playAll}><Icon name="speaker" size={16} />Play the whole conversation</button>}
    </div>
  );
}
