"use client";
import { useCallback, useContext, useEffect, useState } from "react";
import type { InfoGapTask } from "@ll/pack-schema";
import { subscribeArtifacts, sharedArtifactId, type PartnerStore, type PartnerArtifact } from "../../lib/partner-store";
import { translitOr } from "../../lib/romanize";
import * as infogap from "@ll/core/infogap";
import type { InfoGapSession } from "@ll/core/infogap";
import { ActivityHead, SessionList, colStack } from "./shared";
import { CourseOrderContext, Icon, MixedText, SpeakButton, byCourseOrder, usePack, usePlay } from "../shared";

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
    <SessionList title="Info-gap challenge" desc={`Each of you gets different secret information; you can only finish by talking it out in ${pack.name}.`}
      onStart={() => onOpen("new")}
      rows={sessions.map((a) => {
        const s = a.payload as InfoGapSession;
        const task = pack.infoGapTasks?.find((t) => t.id === s.taskId);
        return { id: a.id, title: task?.title ?? s.taskId, status: s.status === "complete" ? "Done" : `${s.metCriteria.length} of ${task?.successCriteria.length ?? "?"} ticked off`, action: "Open", onOpen: () => onOpen(a.id) };
      })} />
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
      setErr((e as { message?: string }).message ?? "Couldn't start the challenge: try again.");
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
      <ActivityHead title="Info-gap challenge" status={<>You are <b>{role === "A" ? "the customer" : "the waiter"}</b></>} onRefresh={refresh} />
      <p className="lesson-rule" style={{ margin: 0 }}><MixedText text={task.goal} /></p>
      <div className="framed write-card">
        <div className="card-prompt" style={{ fontSize: 20, marginTop: 0 }}><MixedText text={brief.brief} /></div>
        <div className="overline" style={{ marginTop: 14 }}>Only you know</div>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.6 }}>{brief.secretInfo.map((s, i) => <li key={i}><MixedText text={s} /></li>)}</ul>
        <div className="overline" style={{ marginTop: 14 }}>You can say</div>
        <div className="gram-ex-list">
          {brief.targetPhrases.map((p, i) => (
            <div className="gram-ex" key={i}>
              <SpeakButton label={`Play ${p.text}`} onClick={() => play(p.text, 0.9)} />
              <span className="ex-text"><span className="mk" lang={pack.id}>{p.text}</span><span className="en">{translitOr(p.text, p.translit)} · {p.gloss}</span></span>
            </div>
          ))}
        </div>
      </div>
      <div className="overline">Together, tick off as you go</div>
      <div className="theme-chips" style={{ margin: 0 }}>
        {task.successCriteria.map((c) => {
          const met = session.metCriteria.includes(c.id);
          return (
            <button key={c.id} aria-pressed={met} className={`chip-toggle${met ? " active" : ""}`} onClick={() => toggle(task, c.id)}>
              {met && <Icon name="check" size={13} />} <MixedText text={c.description} />
            </button>
          );
        })}
      </div>
      {done && <div className="result-ok"><Icon name="check" size={16} />Gap bridged: you pulled it off together!</div>}
    </div>
  );
}
