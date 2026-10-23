"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LanguagePack } from "@ll/pack-schema";
import * as scoring from "@ll/core/familiarity/scoring";
import * as api from "../../lib/api";
import { type Progress } from "../../lib/store";
import { localDay } from "../../lib/daily";
import { properNounLike } from "../../lib/capture";
import * as cp from "../../lib/course-player";
import * as partner from "@ll/core/partner";
import type { Partnership, VisibilitySettings, ActivityRecord } from "@ll/core/partner";
import { getPartnerStore, subscribeArtifacts, joinPresence, sharedArtifactId, type PartnerStore, type PartnerArtifact, type PublishedState } from "../../lib/partner-store";
import * as joint from "@ll/core/partner/joint";
import * as partnerDiff from "@ll/core/partner/familiarity-diff";
import type { ComplementaryDiff, FamiliarityProjection } from "@ll/core/partner/familiarity-diff";
import * as together from "@ll/core/together";
import * as storyTog from "@ll/core/story-together";
import * as jsession from "@ll/core/partner/session";
import * as gtog from "@ll/core/partner/grammar-together";
import { FamiliarityCollab } from "./FamiliarityCollab";
import { InfoGap, InfoGapSection } from "./InfoGap";
import { JointSessionView, SECTION_LABEL, SESSION_AGENDA, SessionRow, jointPlanFor, sharedReadySession } from "./JointSession";
import { LiveConvo, LiveConvoSection } from "./LiveConvo";
import { RoleSwap, RoleSwapSection } from "./RoleSwap";
import { Phrasebook, SharedStory } from "./SharedStory";
import { togetherCandidates, withCourseWords } from "./TogetherSession";
import { NUDGES, Presence, VIS_TOGGLES, colStack } from "./shared";
import { Icon, usePack } from "../shared";

// Publish where I am — activity, the familiarity projection and my place in the course, each gated by my
// visibility settings at write time — to one partnership, then ping it. The ping is what makes it live: the
// published-state table isn't on the realtime feed but partner_artifact is, so a partner with the Partnered
// tab open re-reads my published state the moment it lands.
export async function publishMine(store: PartnerStore, pack: LanguagePack, progress: Progress, partnershipId: string): Promise<void> {
  await store.publish(partnershipId, pack.id, {
    activity: { lastActiveDay: progress.streak?.lastDay ?? "", metrics: scoring.computeMetrics(progress.familiarity) },
    familiarity: partnerDiff.projectFamiliarity(progress.familiarity, pack.id),
    course: cp.positionShare(pack, progress),
  });
  const me = await store.me();
  await store.putArtifact(partnershipId, pack.id, "ping", { at: new Date().toISOString() }, await sharedArtifactId("ping", partnershipId, me));
}
// "Other ways to practise" — the activities beyond the session, each opened on its own from the landing.
export type OtherWay = "live" | "roleswap" | "infogap" | "help" | "story" | "phrasebook";
export const OTHER_WAYS: [OtherWay, string, string][] = [
  ["live", "Live conversation", "talk through a scenario in real time, coached line by line"],
  ["roleswap", "Role-swap", "record your halves of a conversation and hear it stitched together"],
  ["infogap", "Info-gap", "each of you knows half: talk until you've both got it"],
  ["help", "Help each other", "words one of you knows that the other is still learning"],
  ["story", "Shared story", "the same story, each at your own level"],
  ["phrasebook", "Phrasebook", "phrases you collect together"],
];
/** "Here now" while the partner has the Partnered tab open (presence). Mounted only on the landing — the
 *  session's activities join the same presence channel themselves. */
export function PartnerHere({ partnershipId, myId, partnerId }: { partnershipId: string; myId: string; partnerId: string }) {
  const [online, setOnline] = useState<string[]>([]);
  useEffect(() => (myId ? joinPresence(partnershipId, myId, setOnline) : undefined), [partnershipId, myId]);
  return <Presence online={online.includes(partnerId)} here="Here now" away="Not here right now" />;
}
export function PartnerPanel({ progress, persist, config, navigateToStory }: { progress: Progress; persist: (p: Progress) => void; config: api.Config | null; navigateToStory: (storyId: string) => void }) {
  const pack = usePack();
  const packId = pack.id;
  const store = useMemo(() => getPartnerStore(), []);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // All of the learner's partnerships (a person can have several 1:1 partners), plus which one is
  // currently in focus. The heavy per-partnership data below (visibility, partner state, streak…) is
  // loaded for the selected one; switching partners re-runs refresh.
  const [links, setLinks] = useState<Partnership[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false); // showing the invite/join view while other partners exist
  const [vis, setVis] = useState<VisibilitySettings>(partner.DEFAULT_VISIBILITY);
  const [partnerState, setPartnerState] = useState<PublishedState | null>(null);
  const [diff, setDiff] = useState<ComplementaryDiff | null>(null);
  const [shared, setShared] = useState<{ count: number; lastDay: string } | null>(null);
  const [nudges, setNudges] = useState<PartnerArtifact[]>([]);
  const [myId, setMyId] = useState<string>("");
  const [joinCode, setJoinCode] = useState("");
  const [view, setView] = useState<"home" | "session" | OtherWay>("home");
  const [sessRow, setSessRow] = useState<SessionRow | null>(null); // today's shared session row, if any
  const [rs, setRs] = useState<string | "new" | null>(null); // open role-swap session id, "new", or none
  const [ig, setIg] = useState<string | "new" | null>(null); // open info-gap session id, "new", or none
  const [lc, setLc] = useState<string | "new" | null>(null); // open live-conversation session id, "new", or none

  const myActivity = useCallback(
    (): ActivityRecord => ({
      lastActiveDay: progressRef.current.streak?.lastDay ?? "",
      metrics: scoring.computeMetrics(progressRef.current.familiarity),
    }),
    [],
  );

  const readSession = useCallback(async (pid: string): Promise<SessionRow | null> => {
    if (!store) return null;
    const id = await sharedArtifactId("joint-session", pid, localDay());
    return ((await store.listArtifacts(pid, "joint-session")).find((x) => x.id === id)?.payload as SessionRow | undefined) ?? null;
  }, [store]);

  const refresh = useCallback(async (preferId?: string) => {
    if (!store) return setLoading(false);
    setLoading(true);
    setError(null);
    try {
      const all = await store.myPartnerships(packId);
      setLinks(all);
      // Focus the requested partner (e.g. one just created), else keep the current, else the most recent.
      const wantId = preferId ?? currentId;
      const active = all.find((p) => p.id === wantId) ?? all[0] ?? null;
      if ((active?.id ?? null) !== currentId) setCurrentId(active?.id ?? null);
      if (active) setAdding(false);
      if (active && active.status !== "pending") {
        setMyId(await store.me());
        setVis(await store.getVisibility(active.id));
        await publishMine(store, pack, progressRef.current, active.id); // gated at publish time
        const ps = await store.readPartnerPublished(active.id);
        setPartnerState(ps);
        setDiff(ps?.familiarity ? partnerDiff.complementaryDiff(partnerDiff.projectFamiliarity(progressRef.current.familiarity, packId), ps.familiarity) : null);
        // shared streak: persisted in a single 'streak' artifact both members read/write
        const today = localDay();
        const arts = await store.listArtifacts(active.id, "streak");
        const prev = (arts[0]?.payload as { count: number; lastDay: string; freezes?: number }) ?? { count: 0, lastDay: "", freezes: 2 };
        const next = partner.sharedStreak(myActivity(), ps?.activity ?? { lastActiveDay: "" }, today, { count: prev.count, lastDay: prev.lastDay }, prev.freezes ?? 2);
        if (next.count !== prev.count || next.lastDay !== prev.lastDay) {
          await store.putArtifact(active.id, packId, "streak", { ...next, freezes: prev.freezes ?? 2 }, arts[0]?.id);
        }
        setShared(next);
        setNudges((await store.listArtifacts(active.id, "nudge")).slice(-6).reverse());
        setSessRow(await readSession(active.id));
      } else {
        setPartnerState(null);
        setDiff(null);
        setShared(null);
        setNudges([]);
        setSessRow(null);
      }
    } catch (e) {
      const m = e as { message?: string; code?: string };
      const missing = m.code === "PGRST205" || (m.message ?? "").includes("schema cache") || (m.message ?? "").includes("does not exist");
      setError(missing ? "Partner tables not found. Run apps/web/supabase/migrations/0002_partnered.sql, then reload." : m.message ?? "Partner sync failed.");
    } finally {
      setLoading(false);
    }
  }, [store, pack, packId, myActivity, currentId, readSession]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Live: any change in the partnership (your partner's ping after a session, a session they started) re-reads
  // their published state and today's session row — quietly, without reloading the panel, so an open
  // activity stays put. Debounced: a drill writes on every turn.
  useEffect(() => {
    if (!store || !currentId) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const unsub = subscribeArtifacts(currentId, () => {
      clearTimeout(t);
      t = setTimeout(() => void (async () => {
        try {
          const ps = await store.readPartnerPublished(currentId);
          setPartnerState(ps);
          setDiff(ps?.familiarity ? partnerDiff.complementaryDiff(partnerDiff.projectFamiliarity(progressRef.current.familiarity, packId), ps.familiarity) : null);
          setSessRow(await readSession(currentId));
        } catch { /* keep what's shown */ }
      })(), 1500);
    });
    return () => { clearTimeout(t); unsub(); };
  }, [store, currentId, packId, readSession]);

  if (!store) {
    return (
      <div className="setting-row" style={{ flexDirection: "column", alignItems: "flex-start" }}>
        <b>Learning partner</b>
        <span className="muted small">Partner learning needs Supabase (cross-device sync). See SUPABASE_SETUP.md.</span>
      </div>
    );
  }

  const act = (fn: () => Promise<unknown>) => async () => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError((e as { message?: string }).message ?? "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  // Invite/join create a NEW partnership and immediately focus it (so its code / new dyad is what you see),
  // rather than defaulting back to whichever partner was already selected.
  const invitePartner = async () => {
    setBusy(true); setError(null);
    try { const { partnership } = await store.invite(packId); setAdding(false); await refresh(partnership.id); }
    catch (e) { setError((e as { message?: string }).message ?? "Action failed."); }
    finally { setBusy(false); }
  };
  const joinPartner = async () => {
    setBusy(true); setError(null);
    try { const p = await store.redeem(joinCode); setJoinCode(""); setAdding(false); await refresh(p.id); }
    catch (e) { setError((e as { message?: string }).message ?? "Action failed."); }
    finally { setBusy(false); }
  };

  // Start today's session: plan it once over both places in the course, write each section's shared row
  // (drill, grammar quiz, story read-through), then the session row both screens follow.
  const startSession = async (pid: string, partnerId: string) => {
    setBusy(true); setError(null);
    try {
      const day = localDay();
      const plan = jointPlanFor(pack, progress, partnerState?.course);
      const onCourse = !!pack.course && cp.courseV2On(pack, progress);
      const members = [myId, partnerId].sort() as [string, string];
      // Warm-up: the both-taught drill.
      const cands = togetherCandidates(pack, progress, partnerState?.course);
      const myProj = withCourseWords(partnerDiff.projectFamiliarity(progress.familiarity, packId), cands, onCourse);
      const pProj = withCourseWords(partnerState?.familiarity ?? { packId, entries: {} }, cands, onCourse);
      const projections = (members[0] === myId ? [myProj, pProj] : [pProj, myProj]) as [FamiliarityProjection, FamiliarityProjection];
      const turns = together.buildQueue(members, projections, cands, { limit: 10 });
      const drillRowId = await sharedArtifactId("together", pid, "recall");
      if (turns.length) await store.putArtifact(pid, packId, "together", { ...together.startTogether(drillRowId, packId, members[0], members[1], turns), day, startedBy: myId }, drillRowId);
      // Grammar: the latest point you've both been taught.
      let grammarRowId: string | undefined;
      const myPos = cp.positionShare(pack, progress);
      if (plan?.focusPointId && pack.course && myPos) {
        const items = cp.grammarTogetherItems(pack, pack.course, plan.focusPointId, cp.slotOfShare(myPos), cp.slotOfShare(partnerState?.course ?? myPos), (w) => properNounLike(w, pack));
        if (items.length > 1) {
          grammarRowId = await sharedArtifactId("grammar-together", pid, day);
          await store.putArtifact(pid, packId, "grammar-together", { ...gtog.startGrammarTogether(grammarRowId, packId, plan.focusPointId, myId, partnerId, items), day, startedBy: myId }, grammarRowId);
        }
      }
      // Story: a re-read you've both done, then two of its questions.
      const storyId = plan ? plan.storyId : sharedReadySession(pack, progress, partnerState?.familiarity?.entries ?? {}).storyId;
      const story = storyId ? pack.stories?.find((s) => s.id === storyId) : undefined;
      let storyRowId: string | undefined;
      if (story) {
        storyRowId = await sharedArtifactId("story-together", pid, story.id);
        const lines = story.body.map((b) => ({ text: b.text, translit: b.translit, gloss: b.gloss }));
        const questions = story.qa.slice(0, 2).map((q) => ({ question: q.question, questionGloss: q.questionGloss, answer: q.answer, answerGloss: q.answerGloss, answerTranslit: q.answerTranslit }));
        await store.putArtifact(pid, packId, "story-together", { ...storyTog.startStoryTogether(storyRowId, packId, story.id, myId, partnerId, lines, questions), day, startedBy: myId }, storyRowId);
      }
      const id = await sharedArtifactId("joint-session", pid, day);
      const row = jsession.startJointSession(id, packId, day, myId, partnerId, myId, {
        drillRowId: turns.length ? drillRowId : undefined,
        drillCount: turns.length,
        pointId: grammarRowId ? plan?.focusPointId : undefined,
        grammarRowId,
        storyId: story?.id,
        storyLines: story && story.id === plan?.storyId ? plan.storyLines : [],
        storyRowId,
        framing: plan?.framing ?? "",
        next: plan?.next?.label,
      });
      await store.putArtifact(pid, packId, "joint-session", row, id);
      setSessRow(row);
      setView("session");
    } catch (e) {
      setError((e as { message?: string }).message ?? "Couldn't start the session. Try again.");
    } finally {
      setBusy(false);
    }
  };

  // The partnership currently in focus (heavy data below is loaded for it), and a switcher across all of
  // the learner's partners. Numbered because we don't store partner display names.
  const link = links.find((x) => x.id === currentId) ?? null;
  const partnerLabel = (p: Partnership, i: number) =>
    p.status === "pending" ? "Pending invite" : `Partner ${i + 1}${p.status === "paused" ? " · paused" : ""}`;
  const Switcher = links.length > 0 && !adding && view === "home" ? (
    <div className="theme-chips" style={{ marginBottom: 12 }}>
      {links.map((p, i) => (
        <button key={p.id} className={`chip-toggle${p.id === currentId ? " active" : ""}`} onClick={() => setCurrentId(p.id)}>{partnerLabel(p, i)}</button>
      ))}
      <button className="chip-toggle" onClick={() => setAdding(true)} title="Add another learning partner">Add a partner</button>
    </div>
  ) : null;

  const content = () => {
    if (loading && view === "home") return <span className="muted small">…</span>;
    if (adding || !link)
      return (
        <div style={colStack}>
          {links.length > 0 && <button className="ghost small" style={{ alignSelf: "flex-start" }} onClick={() => setAdding(false)}>← Back to partners</button>}
          <div className="framed partner-card">
            <div className="overline">Learn together</div>
            <h3 className="lesson-title" style={{ fontSize: 24 }}>Learn with someone you trust</h3>
            <p style={{ margin: "0 0 8px", lineHeight: 1.55 }}>Link up with a partner to practise <i>together</i>: a session side by side or on a call (warm-up, grammar and a story), plus live conversation, role-swap, info-gap, a shared story and phrasebook, and help with the words your partner knows and you don&apos;t.</p>
            <button className="btn" style={{ width: "100%", marginTop: 6 }} disabled={busy} onClick={invitePartner}>Invite a partner</button>
            <div className="or-rule">or join with a code</div>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <input className="text" aria-label="Invite code" placeholder="Invite code" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} style={{ textTransform: "uppercase", letterSpacing: ".08em", minWidth: 0 }} />
              <button className="ghost" disabled={busy || !joinCode.trim()} onClick={joinPartner}>Join</button>
            </div>
          </div>
          <p className="muted small" style={{ margin: 0 }}>Private to the two of you. Pause (no penalty) or end any time.</p>
        </div>
      );
    const l = link;
    if (l.status === "pending")
      return (
        <div className="framed partner-card" style={{ textAlign: "center" }}>
          <div className="overline">Invite created</div>
          <p style={{ margin: "8px 0 0" }}>Share this code with your partner:</p>
          <div className="invite-code">{l.inviteCode}</div>
          <p className="muted small" style={{ margin: "0 0 14px" }}>They open <b>Partnered</b>, choose <b>Join</b> and enter it. This updates once they join.</p>
          <div className="row" style={{ justifyContent: "center" }}>
            <button className="ghost" disabled={busy} onClick={act(async () => {})}>Refresh</button>
            <button className="quiet" disabled={busy} onClick={act(() => store.end(l.id))}>Cancel the invite</button>
          </div>
        </div>
      );
    if (l.status === "paused")
      return (
        <div className="framed partner-card">
          <div className="overline">Paused</div>
          <p style={{ margin: "8px 0 14px" }}>No streak pressure. Pick up whenever you both want.</p>
          <div className="row">
            <button className="btn" disabled={busy} onClick={act(() => store.resume(l.id))}>Resume</button>
            <button className="ghost" disabled={busy} onClick={act(() => store.end(l.id))}>End</button>
          </div>
        </div>
      );
    // active
    const partnerId = l.members.find((m) => m && m !== myId) ?? "";
    const back = (label = "← Partnered") => <button className="ghost small" style={{ alignSelf: "flex-start" }} onClick={() => setView("home")}>{label}</button>;

    if (view === "session" && sessRow) {
      return <JointSessionView store={store} partnershipId={l.id} packId={packId} myId={myId} partnerId={partnerId} sessionRowId={sessRow.id}
        progress={progress} persist={persist} config={config} partnerState={partnerState} onExit={() => { setView("home"); void readSession(l.id).then(setSessRow); }} />;
    }
    // Other ways to practise, each on its own screen.
    if (rs) return <div style={colStack}><button className="ghost small" style={{ alignSelf: "flex-start" }} onClick={() => setRs(null)}>← Role-swap</button><RoleSwap store={store} partnershipId={l.id} packId={packId} myId={myId} partnerId={partnerId} sessionId={rs} /></div>;
    if (ig) return <div style={colStack}><button className="ghost small" style={{ alignSelf: "flex-start" }} onClick={() => setIg(null)}>← Info-gap</button><InfoGap store={store} partnershipId={l.id} packId={packId} myId={myId} partnerId={partnerId} sessionId={ig} /></div>;
    if (lc) return <div style={colStack}><button className="ghost small" style={{ alignSelf: "flex-start" }} onClick={() => setLc(null)}>← Live conversation</button><LiveConvo store={store} partnershipId={l.id} packId={packId} myId={myId} partnerId={partnerId} sessionId={lc} /></div>;
    if (view === "live") return <div style={colStack}>{back()}<LiveConvoSection store={store} partnershipId={l.id} onOpen={setLc} /></div>;
    if (view === "roleswap") return <div style={colStack}>{back()}<RoleSwapSection store={store} partnershipId={l.id} onOpen={setRs} /></div>;
    if (view === "infogap") return <div style={colStack}>{back()}<InfoGapSection store={store} partnershipId={l.id} onOpen={setIg} /></div>;
    if (view === "help") return <div style={colStack}>{back()}<FamiliarityCollab store={store} partnershipId={l.id} packId={packId} myId={myId} partnerId={partnerId} diff={diff} progress={progress} /></div>;
    if (view === "story") return <div style={colStack}>{back()}<SharedStory store={store} partnershipId={l.id} packId={packId} progress={progress} navigateToStory={navigateToStory} /></div>;
    if (view === "phrasebook") return <div style={colStack}>{back()}<Phrasebook store={store} partnershipId={l.id} packId={packId} progress={progress} persist={persist} /></div>;

    // The landing: where you both are, one button for today's session, its agenda, then other ways.
    const today = localDay();
    const js = jsession.joinState(sessRow ?? undefined, myId, today);
    const myPos = cp.positionShare(pack, progress);
    const pPos = partnerState?.course;
    const where = (p: joint.CoursePositionShare) => { const c = (pack.chapters ?? []).find((x) => x.order === p.chapterOrder); return `chapter ${p.chapterOrder}${c ? ` (${c.shortTitle})` : ""}, session ${p.session}`; };
    const pDay = partnerState?.activity?.lastActiveDay;
    return (
      <div style={colStack}>
        <div className="partner-status">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="overline">Linked with your partner</span>
            <PartnerHere partnershipId={l.id} myId={myId} partnerId={partnerId} />
          </div>
          {myPos && <div style={{ marginTop: 8 }}><span className="who-label">You</span>{where(myPos)}</div>}
          <div style={{ marginTop: 4 }}>
            {pPos ? <><span className="who-label">Partner</span>{where(pPos)}</> : <span className="muted">Your partner hasn&apos;t shared their place in the course yet</span>}
            {pDay ? <span className="muted small"> · last practised {pDay === today ? "today" : pDay}</span> : null}
          </div>
          {shared && shared.count > 0 && <div className="muted small" style={{ marginTop: 6 }}>{shared.count} day{shared.count === 1 ? "" : "s"} you both showed up{shared.lastDay === today ? ", including today" : ""}</div>}
        </div>

        <div>
          <div className="framed menu" style={{ marginBottom: 14 }}>
            <div className="menu-title">Session together</div>
            <ol className="menu-list">
              {SESSION_AGENDA.map(([t, d], i) => {
                const o = sessRow && js !== "none" && t !== "Recap" ? sessRow.outcomes[t.toLowerCase().replace("-", "") as jsession.JointSection] : undefined;
                return (
                  <li key={t}>
                    <span className="menu-n" aria-hidden="true">{o === "done" ? <Icon name="check" size={14} /> : i + 1}</span>
                    <span className="menu-label">{t}{o === "done" ? <span className="muted small"> · done</span> : o === "skipped" ? <span className="muted small"> · skipped</span> : null}</span>
                    <span className="menu-detail">{d}</span>
                  </li>
                );
              })}
            </ol>
          </div>
          <p className="muted small" style={{ margin: "0 0 12px" }}>About 15 minutes. You both need to be here, side by side or on a call; any section can be skipped.</p>
          {js === "join" && <button className="btn menu-cta" disabled={busy} onClick={() => setView("session")}>Join your partner&apos;s session</button>}
          {js === "resume" && <button className="btn menu-cta" disabled={busy} onClick={() => setView("session")}>Back to your session</button>}
          {js === "none" && <button className="btn menu-cta" disabled={busy} onClick={() => void startSession(l.id, partnerId)}>{busy ? "Setting up…" : "Start a session together"}</button>}
          {js === "done" && (
            <div className="row">
              <span className="result-ok"><Icon name="check" size={16} />Today&apos;s session is done</span>
              <button className="ghost small" onClick={() => setView("session")}>See the recap</button>
              <button className="ghost small" disabled={busy} onClick={() => void startSession(l.id, partnerId)}>Start another</button>
            </div>
          )}
          {js === "join" && <p className="muted small" style={{ margin: "8px 0 0" }}>Your partner started today&apos;s session{sessRow ? ` (now on: ${SECTION_LABEL[sessRow.phase].toLowerCase()})` : ""}.</p>}
        </div>

        <div>
          <div className="overline" style={{ marginTop: 8 }}>Other ways to practise</div>
          <div className="lib-list">
            {OTHER_WAYS.map(([k, title, desc]) => (
              <button key={k} className="lib-item plain" onClick={() => setView(k)}>
                <span style={{ minWidth: 0 }}><span className="lib-title">{title}</span><span className="lib-sub">{desc}</span></span>
                <span className="lib-fit" aria-hidden="true"><Icon name="next" size={16} /></span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="overline" style={{ marginBottom: 8 }}>Send a nudge</div>
          <div className="theme-chips">
            {NUDGES.map((n) => (
              <button key={n} className="chip-toggle" disabled={busy} onClick={act(() => store.putArtifact(l.id, packId, "nudge", { text: n, day: localDay() }))}>{n}</button>
            ))}
          </div>
          {nudges.length > 0 && (
            <ul className="muted small" style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {nudges.map((nd) => {
                const pl = nd.payload as { text?: string; day?: string };
                return <li key={nd.id}>{nd.createdBy === myId ? "You" : "Partner"}: {pl.text} <span style={{ opacity: 0.6 }}>{pl.day}</span></li>;
              })}
            </ul>
          )}
        </div>

        <details className="partner-more">
          <summary className="small" style={{ cursor: "pointer" }}>Partner settings</summary>
          <div style={{ ...colStack, marginTop: 10 }}>
            <div>
              <span className="small">Visible to your partner</span>
              <div className="row" style={{ marginTop: 6 }}>
                {VIS_TOGGLES.map(([key, label]) => (
                  <button
                    key={key}
                    aria-pressed={vis[key]}
                    className={`chip-toggle${vis[key] ? " active" : ""}`}
                    disabled={busy}
                    title="Tap to toggle what your partner can see"
                    onClick={act(async () => {
                      const next: VisibilitySettings = { ...vis, [key]: !vis[key] };
                      setVis(next);
                      await store.setVisibility(l.id, next);
                    })}
                  >
                    {label}{vis[key] ? "" : " (hidden)"}
                  </button>
                ))}
              </div>
            </div>
            <div className="row">
              <button className="ghost" disabled={busy} onClick={act(() => store.pause(l.id))}>Pause (no-shame)</button>
              <button className="ghost" disabled={busy} onClick={act(async () => { if (typeof window !== "undefined" && !window.confirm("Unpair from this partner? This ends the partnership. You can always invite them again later.")) return; await store.end(l.id); })}>Unpair (end)</button>
            </div>
            <p className="muted small" style={{ margin: 0 }}>Unpairing affects only this partner{links.length > 1 ? ": your other partners stay linked" : ""}.</p>
          </div>
        </details>
      </div>
    );
  };

  return (
    <section className="view">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 32 }}>Partnered</h2>
        {shared && shared.count > 0 && <span className="streak" title="Shared streak: days you both practised">{shared.count} day{shared.count === 1 ? "" : "s"} together</span>}
      </div>
      {error && <p className="small" style={{ color: "var(--warn)", margin: "4px 0 0" }}>{error}</p>}
      {Switcher}
      {content()}
    </section>
  );
}
