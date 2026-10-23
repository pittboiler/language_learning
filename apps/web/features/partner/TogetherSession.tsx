"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LanguagePack } from "@ll/pack-schema";
import * as familiarity from "@ll/core/familiarity";
import { type Progress } from "../../lib/store";
import { localDay } from "../../lib/daily";
import * as cp from "../../lib/course-player";
import { subscribeArtifacts, joinPresence, sharedArtifactId, type PartnerStore } from "../../lib/partner-store";
import { translitOr } from "../../lib/romanize";
import * as joint from "@ll/core/partner/joint";
import * as partnerDiff from "@ll/core/partner/familiarity-diff";
import type { FamiliarityProjection } from "@ll/core/partner/familiarity-diff";
import * as together from "@ll/core/together";
import { ActivityHead, colStack } from "./shared";
import { HintButton, Icon, SpeakButton, Stitches, useHintFor, usePack, usePlay } from "../shared";

// ---------- the Together drill (see DESIGN-partnered-v2.md) — the partnered session's warm-up ----------
// The session itself. One partner PRODUCES (says the target from the English prompt); the other CHECKS
// (holds the answer, taps ✓/↻). Roles flip per item. Synced over the same Realtime channel LiveConvo uses.
// Each partner grades their OWN produced turns into their private SRS (familiarity is per-user).
// Drillable pool for the Together drill. On the course: the course words BOTH partners have been taught
// (sessions each has finished — the partner's from their published position). Otherwise: single words +
// phrases with a gloss and a target form.
export const togetherCandidates = (pack: LanguagePack, progress: Progress, partnerCourse?: joint.CoursePositionShare): together.TogetherCandidate[] => {
  if (pack.course && cp.courseV2On(pack, progress)) {
    const mine = cp.currentSlot(pack.course, progress);
    const translit = (k: string) => pack.vocab.find((v) => familiarity.deriveKeyForItem(v).lexKey === k)?.translit;
    return cp.wordsTaughtToBoth(pack.course, mine, partnerCourse ? cp.slotOfShare(partnerCourse) : mine)
      .map((w) => ({ lexKey: w.lexKey, prompt: w.gloss, answer: w.display, translit: translit(w.lexKey) }));
  }
  return pack.vocab
    .filter((v) => (v.kind === "vocab" || v.kind === "phrase") && !!v.answer && !!v.gloss)
    .map((v) => ({ lexKey: familiarity.deriveKeyForItem(v).lexKey, prompt: v.gloss, answer: v.answer, translit: v.translit }));
};
// The course decides what both partners have been taught; a partner's familiarity projection can lag (or be
// private), so a course word missing from it counts as freshly learned rather than unknown.
export const withCourseWords = (proj: FamiliarityProjection, candidates: together.TogetherCandidate[], onCourse: boolean): FamiliarityProjection => {
  if (!onCourse) return proj;
  const entries = { ...proj.entries };
  for (const c of candidates) if (!entries[c.lexKey]) entries[c.lexKey] = { status: "learning", strength: 0 };
  return { ...proj, entries };
};
// The shared drill row is reused, so a session only counts if it was started TODAY (older ones are stale).
export type DrillPayload = together.TogetherSession & { day?: string; startedBy?: string };
export function TogetherSession({ store, partnershipId, packId, myId, partnerId, progress, persist, partnerProjection, partnerCourse, sessionId, onExit, embedded }: {
  store: PartnerStore;
  partnershipId: string;
  packId: string;
  myId: string;
  partnerId: string;
  progress: Progress;
  persist: (p: Progress) => void;
  partnerProjection: FamiliarityProjection | null;
  /** The partner's published place in the course — the drill only uses words you've both been taught. */
  partnerCourse?: joint.CoursePositionShare;
  sessionId: string | "new";
  /** `completed`: the drill was finished (not just left). */
  onExit: (completed: boolean) => void;
  /** Inside the partnered session: no back button of its own, and the wrap moves you both on. `onFinished`
   *  fires once the activity is complete (the session then hides "Skip"). */
  embedded?: { next: string; onNext: () => void; onFinished?: () => void };
}) {
  const pack = usePack();
  const play = usePlay();
  const hint = useHintFor();
  const [session, setSession] = useState<together.TogetherSession | null>(null);
  const [sid, setSid] = useState<string | "new">(sessionId);
  const [online, setOnline] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const gradedRef = useRef<Set<string>>(new Set()); // "<queue-sig>#<index>" of my produced turns already graded
  useEffect(() => { setSid(sessionId); }, [sessionId]);

  const onCourse = !!pack.course && cp.courseV2On(pack, progress);
  const candidates = useMemo(() => togetherCandidates(pack, progress, partnerCourse), [pack, progress, partnerCourse]);

  const refresh = useCallback(async () => {
    if (sid === "new") return;
    try {
      const a = (await store.listArtifacts(partnershipId, "together")).find((x) => x.id === sid);
      if (a) setSession(a.payload as together.TogetherSession);
    } catch {
      /* keep current */
    }
  }, [store, partnershipId, sid]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (sid === "new") return;
    const unsubArtifacts = subscribeArtifacts(partnershipId, () => void refresh());
    const unsubPresence = joinPresence(partnershipId, myId, setOnline);
    return () => { unsubArtifacts(); unsubPresence(); };
  }, [partnershipId, sid, myId, refresh]);

  const buildAndStart = useCallback(async () => {
    setErr("");
    try {
      // Deterministic id per partnership (mirrors LiveConvo): both partners converge on ONE session row.
      const id = await sharedArtifactId("together", partnershipId, "recall");
      const existing = (await store.listArtifacts(partnershipId, "together")).find((x) => x.id === id);
      const ex = existing?.payload as DrillPayload | undefined;
      if (ex && ex.status !== "complete" && ex.day === localDay()) {
        setSession(ex);
        setSid(id);
        return; // join today's in-progress session rather than overwriting it (an older one is stale: rebuild)
      }
      const members = [myId, partnerId].sort() as [string, string];
      const myProj = withCourseWords(partnerDiff.projectFamiliarity(progress.familiarity, packId), candidates, onCourse);
      const pProj = withCourseWords(partnerProjection ?? { packId, entries: {} }, candidates, onCourse);
      // Arrange projections to match the sorted members so both clients build an identical queue.
      const projections = (members[0] === myId ? [myProj, pProj] : [pProj, myProj]) as [FamiliarityProjection, FamiliarityProjection];
      const turns = together.buildQueue(members, projections, candidates, { limit: 12 });
      const sess = together.startTogether(id, packId, members[0], members[1], turns);
      // Stamp the day it was started and who started it (the row id is reused; created_by is the last writer),
      // so the launcher and the joint recap only count TODAY's drill.
      await store.putArtifact(partnershipId, packId, "together", { ...sess, day: localDay(), startedBy: myId }, id);
      setSession(sess);
      setSid(id);
    } catch (e) {
      setErr((e as { message?: string }).message ?? "Couldn't start: try again.");
    }
  }, [store, partnershipId, packId, myId, partnerId, progress.familiarity, partnerProjection, candidates, onCourse]);

  useEffect(() => { if (sessionId === "new" && !session) void buildAndStart(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sessionId]);

  // Grade MY produced turns into MY private SRS as the checker's verdicts land (via realtime). Namespaced
  // by the queue signature so a fresh "Go again" session re-grades cleanly.
  useEffect(() => {
    if (!session) return;
    const sig = session.turns.map((t) => t.lexKey).join(",");
    const mine = session.turns.filter((t) => t.result && t.producer === myId && !gradedRef.current.has(`${sig}#${t.index}`));
    if (!mine.length) return;
    let p = progress;
    for (const t of mine) {
      gradedRef.current.add(`${sig}#${t.index}`);
      const base = p.familiarity[t.lexKey] ?? familiarity.capture({ lexKey: t.lexKey, kind: t.answer.includes(" ") ? "chunk" : "word", display: t.answer, gloss: t.prompt });
      p = { ...p, familiarity: { ...p.familiarity, [t.lexKey]: familiarity.grade(familiarity.markStudied(base), t.result === "got" ? "good" : "again") } };
    }
    persist(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => { if (session?.status === "complete") embedded?.onFinished?.(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [session?.status]);

  const check = async (got: boolean) => {
    if (!session) return;
    setErr("");
    try {
      const latest = ((await store.listArtifacts(partnershipId, "together")).find((x) => x.id === session.id)?.payload as together.TogetherSession) ?? session;
      const next = together.checkTurn(latest, myId, got);
      await store.putArtifact(partnershipId, packId, "together", { ...next, day: (session as { day?: string } | null)?.day ?? localDay() }, next.id);
      setSession(next);
    } catch (e) {
      setErr((e as { message?: string }).message ?? "Sync hiccup: tap Refresh.");
    }
  };

  const partnerOnline = online.includes(partnerId);
  const HeaderRow = (
    <ActivityHead
      left={embedded ? <div className="overline">Warm-up together</div> : <button className="ghost small" onClick={() => onExit(session?.status === "complete" && session.turns.length > 0)}>← Together</button>}
      online={partnerOnline} onRefresh={refresh} />
  );

  if (!session) return <div style={colStack}>{HeaderRow}{err ? <div className="err">{err}</div> : <span className="muted small">Setting up…</span>}</div>;

  const sc = together.score(session);
  if (session.status === "complete") {
    return (
      <div style={colStack}>
        {HeaderRow}
        {sc.total === 0 ? (
          <p className="lead" style={{ margin: 0 }}>Nothing new to drill together right now: do a solo lesson to build up some words, then come back.</p>
        ) : (
          <>
            <div className="result-ok" style={{ fontSize: 17 }}><Icon name="check" size={16} />You cleared {sc.got} of {sc.total} together</div>
            <p className="muted small" style={{ margin: 0 }}>Each of you kept the words you produced in your own reviews.</p>
          </>
        )}
        <div className="row">
          {embedded ? <button className="btn" onClick={embedded.onNext}>{embedded.next}</button> : <button className="btn" onClick={() => onExit(sc.total > 0)}>Done</button>}
          <button className="ghost" onClick={() => void buildAndStart()}>Go again</button>
        </div>
      </div>
    );
  }

  const turn = together.currentTurn(session)!;
  const iProduce = together.isMyTurnToProduce(session, myId);
  const total = session.turns.length;
  return (
    <div style={colStack}>
      {HeaderRow}
      <div className="today-sub" style={{ marginTop: 0 }}>
        <Stitches total={total} done={session.turnIndex} now={session.turnIndex} size={10} label={`Turn ${session.turnIndex + 1} of ${total}`} />
        <span>Turn {session.turnIndex + 1} of {total} · cleared {sc.got}</span>
      </div>
      {err ? <div className="err">{err}</div> : null}
      <LastTurnRecap session={session} />
      {iProduce ? (
        <div className="framed write-card">
          <div className="overline">Your turn: say this in {pack.name}, out loud</div>
          <div className="card-prompt">{turn.prompt}</div>
          {/* The producer's only way in when the English prompt isn't enough — the hint never contains
              the word, so asking for it doesn't hand over the answer their partner is holding. */}
          <HintButton hint={hint(turn.lexKey)} label="I'm stuck: show a hint" />
          <div className="muted small" style={{ marginTop: 10 }}>{partnerOnline ? "Your partner is checking you…" : "Waiting for your partner to check…"}</div>
        </div>
      ) : (
        <div className="framed write-card">
          <div className="overline">Your partner is saying “{turn.prompt}”: did they get it?</div>
          <div className="model-line" style={{ margin: "10px 0 4px" }}>
            <SpeakButton label={`Play ${turn.answer}`} onClick={() => play(turn.answer, 0.9)} />
            <span className="mk" lang={pack.id} style={{ fontSize: 24 }}>{turn.answer}</span>
            <span className="translit">{translitOr(turn.answer, turn.translit)}</span>
          </div>
          <div className="grade-row">
            <button className="ghost" onClick={() => check(false)}><Icon name="restart" size={16} />Again</button>
            <button className="btn" onClick={() => check(true)}><Icon name="check" size={16} />Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}
// After a turn is marked, show BOTH partners the word that was just drilled — written out, romanized and
// speakable. The producer has until now only ever heard it from their partner (the answer lives on the
// checker's screen), so the one card they most need to see in writing was the one they never saw.
export function LastTurnRecap({ session }: { session: together.TogetherSession }) {
  const pack = usePack();
  const play = usePlay();
  const prev = session.turns[session.turnIndex - 1];
  if (!prev?.result) return null;
  return (
    <div className="last-turn">
      <span className={prev.result === "got" ? "result-ok" : "result-miss"} style={{ fontSize: 13 }}><Icon name={prev.result === "got" ? "check" : "restart"} size={13} />{prev.prompt}</span>
      <SpeakButton label={`Play ${prev.answer}`} onClick={() => play(prev.answer, 0.9)} />
      <b lang={pack.id} style={{ fontFamily: "var(--font-text)", fontSize: 17 }}>{prev.answer}</b>
      <span className="translit">{translitOr(prev.answer, prev.translit)}</span>
    </div>
  );
}
