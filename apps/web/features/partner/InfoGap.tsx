"use client";
import { useCallback, useContext, useEffect, useState } from "react";
import type { InfoGapTask } from "@ll/pack-schema";
import { subscribeArtifacts, sharedArtifactId, type PartnerStore, type PartnerArtifact } from "../../lib/partner-store";
import { translitOr } from "../../lib/romanize";
import * as infogap from "@ll/core/infogap";
import type { InfoGapSession } from "@ll/core/infogap";
import { colStack } from "./shared";
import { CourseOrderContext, byCourseOrder, usePack, usePlay } from "../shared";

// Info-gap (Phase 3, forced interdependence): each partner holds DIFFERENT secret info + a shared
// goal neither can reach alone. The view renders ONLY this partner's half (briefFor) — the asymmetry
// is the task. The shared checklist is one 'infogap' partner_artifact; ticks re-read latest to merge.
export function InfoGapSection({ store, partnershipId, onOpen }: { store: PartnerStore; partnershipId: string; onOpen: (id: string | "new") => void }) {
  const pack = usePack();
  const [sessions, setSessions] = useState<PartnerArtifact[]>([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const a = await store.listArtifacts(partnershipId, "infogap");
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
  if (!(pack.infoGapTasks ?? []).length) return null;
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="small">Info-gap challenge</span>
        <button className="btn small" onClick={() => onOpen("new")}>Start →</button>
      </div>
      <p className="muted small" style={{ margin: "4px 0 0" }}>Each of you gets different secret info — you can only finish by talking it out in {pack.name}.</p>
      {sessions.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "6px 0 0", display: "flex", flexDirection: "column", gap: 4 }}>
          {sessions.map((a) => {
            const s = a.payload as InfoGapSession;
            const task = pack.infoGapTasks?.find((t) => t.id === s.taskId);
            return (
              <li key={a.id} className="row" style={{ justifyContent: "space-between" }}>
                <span className="small">{task?.title ?? s.taskId} <span className="muted">· {s.status === "complete" ? "done ✓" : `${s.metCriteria.length}/${task?.successCriteria.length ?? "?"}`}</span></span>
                <button className="ghost small" onClick={() => onOpen(a.id)}>Open</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
export function InfoGap({ store, partnershipId, packId, myId, partnerId, sessionId }: {
  store: PartnerStore;
  partnershipId: string;
  packId: string;
  myId: string;
  partnerId: string;
  sessionId: string | "new";
}) {
  const pack = usePack();
  const myOrder = useContext(CourseOrderContext);
  const play = usePlay();
  const [session, setSession] = useState<InfoGapSession | null>(null);
  const [err, setErr] = useState(""); // surface start failures instead of a dead click

  const refresh = useCallback(async () => {
    if (sessionId === "new") return;
    try {
      const a = (await store.listArtifacts(partnershipId, "infogap")).find((x) => x.id === sessionId);
      if (a) setSession(a.payload as InfoGapSession);
    } catch {
      /* keep current */
    }
  }, [store, partnershipId, sessionId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const start = async (taskId: string) => {
    const task = pack.infoGapTasks?.find((t) => t.id === taskId);
    if (!task) return;
    setErr("");
    try {
      // Deterministic id + join-don't-duplicate: one shared task per (partnership, task) so both halves
      // and the shared checklist live on a single row. Sorted ids keep the A/B assignment stable.
      const id = await sharedArtifactId("infogap", partnershipId, taskId);
      const existing = (await store.listArtifacts(partnershipId, "infogap")).find((x) => x.id === id);
      if (existing) {
        setSession(existing.payload as InfoGapSession);
        return;
      }
      const [lo, hi] = [myId, partnerId].sort();
      const sess = infogap.startInfoGap(id, packId, task, { [lo!]: "A", [hi!]: "B" });
      await store.putArtifact(partnershipId, packId, "infogap", sess, id);
      setSession(sess);
    } catch (e) {
      setErr((e as { message?: string }).message ?? "Couldn't start the challenge — try again.");
    }
  };

  const toggle = async (task: InfoGapTask, criterionId: string) => {
    const latest = ((await store.listArtifacts(partnershipId, "infogap")).find((x) => x.id === session!.id)?.payload as InfoGapSession) ?? session!;
    const next = infogap.toggleCriterion(latest, task, criterionId);
    await store.putArtifact(partnershipId, packId, "infogap", next, next.id);
    setSession(next);
  };

  if (sessionId === "new" && !session) {
    return (
      <div style={colStack}>
        <span className="small">Pick an info-gap challenge</span>
        {err ? <div className="err">{err}</div> : null}
        <div className="cards">
          {byCourseOrder(pack, pack.infoGapTasks ?? [], (x) => x.id, myOrder).map(({ item: t, later }) => (
            <button key={t.id} className="contentcard" style={later ? { opacity: 0.6 } : undefined} onClick={() => start(t.id)}>
              <div className="cc-title">{t.title}{later ? <span className="muted small"> · later chapter</span> : null}</div>
              <div className="muted small">{t.goal}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (!session) return <span className="muted small">…</span>;
  const task = pack.infoGapTasks?.find((t) => t.id === session.taskId);
  if (!task) return <span className="muted small">task not found</span>;
  const role = infogap.roleOf(session, myId) ?? "A";
  const brief = infogap.briefFor(task, role);
  const done = infogap.isComplete(session, task);

  return (
    <div style={colStack}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="small">You are <b>{role === "A" ? "the customer" : "the waiter"}</b></span>
        <button className="ghost small" onClick={refresh}>↻ Refresh</button>
      </div>
      <p className="lead" style={{ margin: 0 }}>{task.goal}</p>
      <div className="fb">
        <b>{brief.brief}</b>
        <div style={{ marginTop: 6 }}>
          <span className="muted small">Only you know:</span>
          <ul style={{ margin: "2px 0 0", paddingLeft: 18 }}>{brief.secretInfo.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
        <div style={{ marginTop: 6 }}>
          <span className="muted small">You can say:</span>
          {brief.targetPhrases.map((p, i) => (
            <div className="row" key={i} style={{ marginTop: 2 }}>
              <button className="spk" onClick={() => play(p.text, 0.9)}>🔊</button>
              <span><b>{p.text}</b> <span className="muted small">· {translitOr(p.text, p.translit)} — {p.gloss}</span></span>
            </div>
          ))}
        </div>
      </div>
      <span className="small">Together, tick off as you go:</span>
      {task.successCriteria.map((c) => {
        const met = session.metCriteria.includes(c.id);
        return (
          <button key={c.id} className={`badge ${met ? "on" : "off"}`} style={{ textAlign: "left" }} onClick={() => toggle(task, c.id)}>
            {met ? "✓" : "○"} {c.description}
          </button>
        );
      })}
      {done && <p className="lead" style={{ color: "var(--ok)", margin: "6px 0 0" }}>🎉 Gap bridged — you pulled it off together!</p>}
    </div>
  );
}
