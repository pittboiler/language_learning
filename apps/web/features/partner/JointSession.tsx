"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LanguagePack, Scenario } from "@ll/pack-schema";
import * as familiarity from "@ll/core/familiarity";
import * as api from "../../lib/api";
import { type Progress } from "../../lib/store";
import { toggleStar, starMany } from "../../lib/capture";
import * as cp from "../../lib/course-player";
import { subscribeArtifacts, joinPresence, type PartnerStore, type PublishedState } from "../../lib/partner-store";
import * as joint from "@ll/core/partner/joint";
import * as together from "@ll/core/together";
import * as storyTog from "@ll/core/story-together";
import * as jsession from "@ll/core/partner/session";
import * as gtog from "@ll/core/partner/grammar-together";
import { FocusText } from "../conversation/ScenarioView";
import { StoryTogether } from "./StoryTogether";
import { TogetherSession } from "./TogetherSession";
import { Presence, colStack } from "./shared";
import { HintButton, SpeakButton, gradeItem, usePack, usePlay } from "../shared";

// Off the course (no blueprint): pick a story for the partnered session by SHARED readiness — the scenario
// whose vocabulary both have actually studied — so it lands at the pair's level. Falls back to the
// learner's own readiness when the partner hasn't shared familiarity yet.
export function sharedReadySession(pack: LanguagePack, progress: Progress, partnerEntries: Record<string, unknown>): { speakScenarioId?: string; storyId?: string; grammarConceptId?: string } {
  const lexOf = (id: string) => { const v = pack.vocab.find((x) => x.id === id); return v ? familiarity.deriveKeyForItem(v).lexKey : null; };
  const iStudied = (k: string) => { const e = progress.familiarity[k]; return !!e && familiarity.isStudied(e); };
  const partnerShared = Object.keys(partnerEntries).length > 0;
  const readiness = (s: Scenario): number => {
    const keys = s.requiredVocab.map(lexOf).filter((k): k is string => !!k);
    if (!keys.length) return 0;
    const mine = keys.filter(iStudied).length / keys.length;
    const theirs = keys.filter((k) => !!partnerEntries[k]).length / keys.length;
    return partnerShared ? Math.min(mine, theirs) : mine; // both must be ready; else fall back to me
  };
  const done = (s: Scenario) => (progress.scenarios[s.id]?.metCriteria?.length ?? 0) >= s.successCriteria.length;
  const ranked = pack.scenarios.map((s) => ({ s, r: readiness(s) })).filter((x) => x.r > 0).sort((a, b) => Number(done(a.s)) - Number(done(b.s)) || b.r - a.r);
  const scen = ranked[0]?.s;
  if (!scen) return {};
  const story = pack.stories?.find((st) => st.id === `${scen.id}-story`);
  return { speakScenarioId: scen.id, storyId: story?.id, grammarConceptId: scen.requiredStructures?.[0] };
}
// ---------- the partnered session: warm-up → grammar → story → recap, one shared flow ----------
// One row per partnership per day (@ll/core/partner/session) that both screens follow live. Whoever starts
// it plans every section once (the drill words, the grammar quiz, the story read-through — each its own
// shared row) so the two screens never plan separately; finishing or skipping a section moves you both on.
export type SessionRow = jsession.JointSessionState;
export const SECTION_LABEL: Record<jsession.JointPhase, string> = { warmup: "Warm-up", grammar: "Grammar", story: "Story", recap: "Recap" };
/** The landing's agenda — fixed, so you know what a session is before you start one. */
export const SESSION_AGENDA: [string, string][] = [
  ["Warm-up", "words you've both learned: one of you says it, the other checks"],
  ["Grammar", "a point you've both learned: read the rule aloud, then quiz each other"],
  ["Story", "re-read one you've both read, line by line, then two quick questions"],
  ["Recap", "what you practised together, and what's next"],
];
/** The joint plan over both partners' places in the course (focus point, story, framing, what's next). */
export function jointPlanFor(pack: LanguagePack, progress: Progress, partnerCourse: joint.CoursePositionShare | undefined): joint.JointPlan | undefined {
  const me = cp.positionShare(pack, progress);
  if (!me || !pack.course) return undefined;
  const pt = (id: string) => pack.course!.points.find((x) => x.id === id)?.title ?? id;
  return joint.planJointSession({
    course: pack.course,
    me,
    partner: partnerCourse,
    drillCount: 0,
    titles: {
      point: pt,
      story: (id) => pack.stories?.find((x) => x.id === id)?.title ?? id,
      scenario: (id) => pack.scenarios.find((x) => x.id === id)?.title ?? id,
      chapter: (o) => { const c = (pack.chapters ?? []).find((x) => x.order === o); return c ? `chapter ${o} (${c.shortTitle})` : `chapter ${o}`; },
    },
  });
}
export function JointSessionView({ store, partnershipId, packId, myId, partnerId, sessionRowId, progress, persist, config, partnerState, onExit }: {
  store: PartnerStore; partnershipId: string; packId: string; myId: string; partnerId: string; sessionRowId: string;
  progress: Progress; persist: (p: Progress) => void; config: api.Config | null; partnerState: PublishedState | null; onExit: () => void;
}) {
  const pack = usePack();
  const [row, setRow] = useState<SessionRow | null>(null);
  const [err, setErr] = useState("");
  const [finished, setFinished] = useState<jsession.JointPhase | null>(null); // the current section's activity is complete
  const read = useCallback(async () => (await store.listArtifacts(partnershipId, "joint-session")).find((x) => x.id === sessionRowId)?.payload as SessionRow | undefined, [store, partnershipId, sessionRowId]);
  const refresh = useCallback(async () => { try { const r = await read(); if (r) setRow(r); } catch { /* keep current */ } }, [read]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => subscribeArtifacts(partnershipId, () => void refresh()), [partnershipId, refresh]);

  const write = async (fn: (s: SessionRow) => SessionRow) => {
    setErr("");
    try {
      const latest = (await read()) ?? row;
      if (!latest) return;
      const next = fn(latest);
      if (next !== latest) await store.putArtifact(partnershipId, packId, "joint-session", next, sessionRowId);
      setRow(next);
    } catch (e) { setErr((e as { message?: string }).message ?? "Sync hiccup — try again."); }
  };
  const move = (from: jsession.JointSection, outcome: "done" | "skipped") => void write((s) => jsession.advance(s, from, outcome));

  if (!row) return <div style={colStack}><button className="ghost small" style={{ alignSelf: "flex-start" }} onClick={onExit}>← Partnered</button><span className="muted small">Loading the session…</span></div>;
  const { phase, refs } = row;
  const nextOf = (from: jsession.JointSection) => `Next: ${SECTION_LABEL[jsession.advance(row, from, "done").phase]}`;

  return (
    <div style={colStack}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <button className="ghost small" onClick={onExit}>← Partnered</button>
        <span className="muted small">Session together · step {jsession.stepOf(phase)} of 4</span>
      </div>
      <div className="session-steps">
        {(["warmup", "grammar", "story", "recap"] as jsession.JointPhase[]).map((p) => {
          const o = p === "recap" ? undefined : row.outcomes[p];
          const cls = p === phase ? "now" : o === "done" ? "done" : o ? "skipped" : "";
          return <span key={p} className={`session-step ${cls}`}>{o === "done" ? "✓ " : ""}{SECTION_LABEL[p]}{o === "skipped" ? " · skipped" : o === "empty" ? " · nothing yet" : ""}</span>;
        })}
      </div>
      {err ? <div className="err">{err}</div> : null}
      {phase === "warmup" && refs.drillRowId && (
        <TogetherSession key="warmup" store={store} partnershipId={partnershipId} packId={packId} myId={myId} partnerId={partnerId} progress={progress} persist={persist}
          partnerProjection={partnerState?.familiarity ?? null} partnerCourse={partnerState?.course} sessionId={refs.drillRowId}
          embedded={{ next: nextOf("warmup"), onNext: () => move("warmup", "done"), onFinished: () => setFinished("warmup") }} onExit={() => onExit()} />
      )}
      {phase === "grammar" && refs.grammarRowId && (
        <GrammarTogether key="grammar" store={store} partnershipId={partnershipId} packId={packId} myId={myId} partnerId={partnerId} rowId={refs.grammarRowId}
          progress={progress} persist={persist} next={nextOf("grammar")} onNext={() => move("grammar", "done")} onFinished={() => setFinished("grammar")} />
      )}
      {phase === "story" && refs.storyId && (
        <StoryTogether key="story" store={store} partnershipId={partnershipId} packId={packId} myId={myId} partnerId={partnerId} storyId={refs.storyId}
          progress={progress} persist={persist} config={config} embedded={{ next: nextOf("story"), onNext: () => move("story", "done"), onFinished: () => setFinished("story") }} onExit={() => onExit()} />
      )}
      {phase === "recap" && <JointSessionRecap row={row} store={store} partnershipId={partnershipId} myId={myId} progress={progress} persist={persist} onFinish={() => void write(jsession.finish).then(onExit)} />}
      {phase !== "recap" && finished !== phase && (
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="ghost small" onClick={() => move(phase, "skipped")} title="Moves you both on">Skip this section →</button>
        </div>
      )}
    </div>
  );
}
// The partnered grammar step (@ll/core/partner/grammar-together), synced like the story read-through: the
// rule read aloud, then the point's questions (asker judges) and fill-ins (the answerer taps on their OWN
// screen — a real answer, checked, with the "why" on both screens). A fill-in from the point's cards grades
// the answerer's own grammar flashcard.
export function GrammarTogether({ store, partnershipId, packId, myId, partnerId, rowId, progress, persist, next, onNext, onFinished }: {
  store: PartnerStore; partnershipId: string; packId: string; myId: string; partnerId: string; rowId: string;
  progress: Progress; persist: (p: Progress) => void; next: string; onNext: () => void; onFinished?: () => void;
}) {
  const pack = usePack();
  const play = usePlay();
  const [g, setG] = useState<gtog.GrammarTogetherSession | null>(null);
  const [online, setOnline] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const read = useCallback(async () => (await store.listArtifacts(partnershipId, "grammar-together")).find((x) => x.id === rowId)?.payload as gtog.GrammarTogetherSession | undefined, [store, partnershipId, rowId]);
  const refresh = useCallback(async () => { try { const r = await read(); if (r) setG(r); } catch { /* keep current */ } }, [read]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const unsubArtifacts = subscribeArtifacts(partnershipId, () => void refresh());
    const unsubPresence = joinPresence(partnershipId, myId, setOnline);
    return () => { unsubArtifacts(); unsubPresence(); };
  }, [partnershipId, myId, refresh]);

  const point = g ? pack.course?.points.find((p) => p.id === g.pointId) : undefined;
  useEffect(() => { if (g?.status === "complete") onFinished?.(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [g?.status]);
  // Grade MY answered card fill-ins into MY grammar flashcards as the results land.
  const graded = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!g || !point) return;
    const items = cp.blankCardItems(point);
    let p = progress;
    let n = 0;
    for (const t of g.turns) {
      if (t.kind !== "blank" || !t.result || t.answerer !== myId || !t.cardId || graded.current.has(t.index)) continue;
      graded.current.add(t.index);
      const it = items.find((x) => x.id === t.cardId);
      if (it) { p = gradeItem(p, it, t.result === "got"); n++; }
    }
    if (n) persist(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g]);

  const act = async (fn: (s: gtog.GrammarTogetherSession) => gtog.GrammarTogetherSession) => {
    if (!g) return;
    setErr("");
    try {
      const latest = (await read()) ?? g;
      const nxt = fn(latest);
      await store.putArtifact(partnershipId, packId, "grammar-together", nxt, rowId);
      setG(nxt);
    } catch (e) { setErr((e as { message?: string }).message ?? "Sync hiccup — tap ↻."); }
  };

  const partnerOnline = online.includes(partnerId);
  const head = (
    <div className="row" style={{ justifyContent: "space-between" }}>
      <span className="small">📚 Grammar together{point ? <> · <b>{point.title}</b></> : null}</span>
      <span className="muted small"><Presence online={partnerOnline} /> <button className="ghost small" onClick={refresh}>↻</button></span>
    </div>
  );
  if (!g || !point) return <div style={colStack}>{head}{err ? <div className="err">{err}</div> : <span className="muted small">Setting up…</span>}</div>;

  const sc = gtog.score(g);
  const prev = g.turns[g.turnIndex - 1];
  const lastResult = prev && prev.kind !== "read" && prev.result ? (
    <div className="last-turn">
      <span className="muted small">{prev.result === "got" ? "✓" : "✗"}</span>
      {prev.kind === "blank"
        ? <span className="small"><b>{prev.line}</b>{prev.choice && prev.choice !== prev.answer ? <> — picked “{prev.choice}”, it's <b>{prev.answer}</b></> : null}<span className="muted"> · {prev.why}</span></span>
        : prev.kind === "switch"
          ? <span className="small">{prev.pronoun}: <b>{prev.answer}</b><span className="muted"> · {prev.why}</span></span>
          : <span className="small">{prev.question} <span className="muted">— {prev.answer}</span></span>}
    </div>
  ) : null;
  const ruleBox = (
    <>
      <div className="gram-plain"><span className="lab">The rule</span><p>{point.rule}</p></div>
      <div className="gram-ex-list">
        {point.examples.slice(0, 3).map((ex) => (
          <div className="gram-ex" key={ex.source}>
            <SpeakButton label={`Play ${ex.text}`} onClick={() => play(ex.text)} />
            <span className="mk">{ex.text}</span><span className="en">{ex.gloss}</span>
          </div>
        ))}
      </div>
    </>
  );

  if (g.status === "complete") {
    return (
      <div style={colStack}>{head}
        {lastResult}
        <p className="lead" style={{ color: "var(--ok)", margin: 0 }}>{sc.got}/{sc.total} right together.</p>
        <div className="gram-plain"><span className="lab">In short</span><p>{point.recap}</p></div>
        <div className="row"><button className="btn" onClick={onNext}>{next} →</button></div>
      </div>
    );
  }

  const t = gtog.currentTurn(g)!;
  const iAsk = t.asker === myId;
  const pingPong = g.turns.some((x) => x.kind === "switch");
  return (
    <div style={colStack}>{head}
      {/* Person ping-pong: how it works, and the rule on both screens (nobody reads it aloud). */}
      {pingPong && g.turnIndex === 0 && (
        <div className="muted small">Take turns: one of you reads a line aloud, the other says it about the person on their screen. The reader sees the answer and taps ✓ or ↻. Now and then, a fill-in on today&apos;s point.</div>
      )}
      {pingPong && <details className="small"><summary>The rule: {point.title}</summary><p style={{ margin: "4px 0" }}>{point.rule}</p></details>}
      <div className="pbar"><div style={{ width: `${(g.turnIndex / (g.turns.length || 1)) * 100}%` }} /></div>
      <div className="muted small">Turn {g.turnIndex + 1} of {g.turns.length} · {sc.got} right</div>
      {err ? <div className="err">{err}</div> : null}
      {lastResult}
      {t.kind === "switch" && (iAsk ? (
        <div className="fb">
          <div className="muted small">Read this line aloud to your partner:</div>
          <div className="row" style={{ alignItems: "center", margin: "8px 0" }}>
            <SpeakButton onClick={() => play(t.line, 0.9)} />
            <b className="target" style={{ fontSize: 20 }}>{t.line}</b>
          </div>
          <div className="gloss">{t.gloss}</div>
          <div className="small" style={{ marginTop: 8 }}>They say it about <b>{t.pronoun}</b> ({t.personEn}). The answer: <b className="target">{t.answer}</b></div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" onClick={() => void act((s) => gtog.judge(s, myId, true))}>✓ Got it</button>
            <button className="ghost" onClick={() => void act((s) => gtog.judge(s, myId, false))}>↻ Not quite</button>
          </div>
        </div>
      ) : (
        <div className="fb">
          <div className="muted small">Your partner reads this line:</div>
          <div className="row" style={{ alignItems: "center", margin: "8px 0" }}>
            <b className="target" style={{ fontSize: 20 }}>{t.line}</b>
          </div>
          <div className="gloss">{t.gloss}</div>
          <p className="lead" style={{ margin: "10px 0 4px" }}>Now say it about <b className="target">{t.pronoun}</b> ({t.personEn}), out loud.</p>
          <HintButton hint={t.why.split(". All six: ")[1] ? `All six: ${t.why.split(". All six: ")[1]}` : t.why} label="Show the forms" />
          <div className="muted small" style={{ marginTop: 6 }}>{partnerOnline ? "Your partner is checking…" : "waiting for your partner…"}</div>
        </div>
      ))}
      {t.kind === "read" && (
        <div className="fb">
          <div className="muted small">{iAsk ? "Read the rule aloud to your partner, examples too:" : "Your partner is reading the rule aloud — follow along:"}</div>
          {ruleBox}
          {iAsk ? <button className="btn" style={{ marginTop: 8 }} onClick={() => void act((s) => gtog.doneReading(s, myId))}>Done reading →</button>
            : <div className="muted small" style={{ marginTop: 8 }}>{partnerOnline ? "Listening…" : "waiting for your partner…"}</div>}
        </div>
      )}
      {t.kind === "rule" && (iAsk ? (
        <div className="fb">
          <div className="muted small">Ask your partner, out loud:</div>
          <div style={{ fontSize: 18, margin: "6px 0" }}>{t.question}</div>
          <div className="gloss">Answer: {t.answer}</div>
          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn" onClick={() => void act((s) => gtog.judge(s, myId, true))}>✓ Got it</button>
            <button className="ghost" onClick={() => void act((s) => gtog.judge(s, myId, false))}>↻ Not quite</button>
          </div>
        </div>
      ) : (
        <div className="fb">
          <div className="muted small">Your partner is asking you — answer out loud:</div>
          <div style={{ fontSize: 18, margin: "6px 0" }}>{t.question}</div>
          <HintButton hint={point.rule} label="Peek at the rule" />
        </div>
      ))}
      {t.kind === "blank" && (iAsk ? (
        <div className="fb">
          <div className="muted small">Read this aloud, saying “hmm” at the gap — your partner picks the word:</div>
          <div className="row" style={{ alignItems: "center", margin: "8px 0" }}>
            <SpeakButton onClick={() => play(t.line, 0.9)} />
            <b className="target" style={{ fontSize: 20 }}><FocusText text={t.line} words={[t.answer]} /></b>
          </div>
          <div className="gloss">{t.gloss}</div>
          <div className="muted small" style={{ marginTop: 6 }}>Why: {t.why}</div>
          <div className="muted small" style={{ marginTop: 6 }}>🎯 {partnerOnline ? "Your partner is choosing…" : "waiting for your partner…"}</div>
        </div>
      ) : (
        <div className="fb">
          <div className="muted small">Your partner reads a line — which word fills the gap?</div>
          <div className="target" style={{ fontSize: 20, margin: "8px 0" }}>{cp.blankOut(t.line, t.answer)}</div>
          <div className="gloss">{t.gloss}</div>
          <div className="row" style={{ marginTop: 8 }}>
            {t.options.map((o) => <button key={o} className="btn" onClick={() => void act((s) => gtog.pick(s, myId, o))}>{o}</button>)}
          </div>
        </div>
      ))}
    </div>
  );
}
// The session's recap: how each section went, the point you practised (its recap + what you missed and why),
// the story lines that used it, every drilled word (who said it, how it went; ★ to save), and what's next.
export function JointSessionRecap({ row, store, partnershipId, myId, progress, persist, onFinish }: {
  row: SessionRow; store: PartnerStore; partnershipId: string; myId: string; progress: Progress; persist: (p: Progress) => void; onFinish: () => void;
}) {
  const pack = usePack();
  const play = usePlay();
  const { refs } = row;
  const [drill, setDrill] = useState<together.TogetherSession | null>(null);
  const [gram, setGram] = useState<gtog.GrammarTogetherSession | null>(null);
  const [story, setStory] = useState<storyTog.StorySession | null>(null);
  useEffect(() => {
    void (async () => {
      try {
        if (refs.drillRowId) setDrill(((await store.listArtifacts(partnershipId, "together")).find((x) => x.id === refs.drillRowId)?.payload as together.TogetherSession | undefined) ?? null);
        if (refs.grammarRowId) setGram(((await store.listArtifacts(partnershipId, "grammar-together")).find((x) => x.id === refs.grammarRowId)?.payload as gtog.GrammarTogetherSession | undefined) ?? null);
        if (refs.storyRowId) setStory(((await store.listArtifacts(partnershipId, "story-together")).find((x) => x.id === refs.storyRowId)?.payload as storyTog.StorySession | undefined) ?? null);
      } catch { /* show what we have */ }
    })();
  }, [store, partnershipId, refs.drillRowId, refs.grammarRowId, refs.storyRowId]);
  const point = refs.pointId ? pack.course?.points.find((p) => p.id === refs.pointId) : undefined;
  const st = refs.storyId ? pack.stories?.find((s) => s.id === refs.storyId) : undefined;
  const words = (drill?.turns ?? []).filter((t) => t.result);
  const missed = (gram?.turns ?? []).filter((t) => (t.kind === "blank" || t.kind === "switch") && t.result === "missed");
  const starred = (k: string) => { const e = progress.familiarity[k]; return !!e && familiarity.isStarred(e); };
  const allSaved = words.length > 0 && words.every((w) => starred(w.lexKey));
  const how = (s: jsession.JointSection) => { const o = row.outcomes[s]; return o === "done" ? "✓ done" : o === "skipped" ? "skipped" : "nothing to share yet"; };
  const sc = gram ? gtog.score(gram) : undefined;
  const ss = story ? storyTog.score(story) : undefined;
  return (
    <div className="fb">
      <h3 style={{ margin: "0 0 4px" }}>Today together</h3>
      <p className="muted small" style={{ margin: 0 }}>Warm-up: {how("warmup")} · Grammar: {how("grammar")}{sc && sc.done ? ` (${sc.got}/${sc.done} right)` : ""} · Story: {how("story")}{ss && ss.done ? ` (${ss.got}/${ss.done} nailed)` : ""}</p>
      {point && (
        <div style={{ marginTop: 12 }}>
          <div className="gram-kicker">What you practised</div>
          <div className="gram-title">{point.title}</div>
          <p style={{ margin: "6px 0" }}>{point.recap}</p>
          {missed.length > 0 && (
            <ul className="small" style={{ margin: "4px 0", paddingLeft: 18 }}>
              {missed.map((t) => t.kind === "blank" ? <li key={t.index}><b>{t.line}</b> — {t.why}</li>
                : t.kind === "switch" ? <li key={t.index}>{t.pronoun}: <b>{t.answer}</b> — {t.why}</li> : null)}
            </ul>
          )}
          {st && refs.storyLines.length > 0 && (
            <div className="gram-ex-list">
              {refs.storyLines.map((i) => st.body[i]).filter(Boolean).map((b) => (
                <div className="gram-ex" key={b!.text}>
                  <SpeakButton label={`Play ${b!.text}`} onClick={() => play(b!.text)} />
                  <span className="mk"><FocusText text={b!.text} words={pack.course?.lineFocus?.[`story:${st.id}#${st.body.indexOf(b!)}`]?.[point.id]?.words} /></span><span className="en">{b!.gloss}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {words.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="gram-kicker">Words you drilled together · {words.filter((w) => w.result === "got").length}/{words.length}</div>
            <button className="ghost small" disabled={allSaved} onClick={() => persist(starMany(progress, words.map((w) => ({ lexKey: w.lexKey, display: w.answer, gloss: w.prompt }))))}>{allSaved ? "★ All saved" : "★ Save all"}</button>
          </div>
          <ul style={{ margin: "6px 0 0", paddingLeft: 0, listStyle: "none" }}>
            {words.map((w) => (
              <li key={w.index} className="row" style={{ gap: 8, margin: "4px 0" }}>
                <button className={`ghost small${starred(w.lexKey) ? " active" : ""}`} title="Save to your flashcard deck" onClick={() => toggleStar(progress, persist, w.lexKey, { gloss: w.prompt })}>{starred(w.lexKey) ? "★" : "☆"}</button>
                <b className="target">{w.answer}</b>
                <span className="muted small">— {w.prompt} · {w.producer === myId ? "you said it" : "your partner said it"} {w.result === "got" ? "✓" : "↻"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {refs.next && <p className="lead" style={{ margin: "12px 0 0" }}>{refs.next}</p>}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={onFinish}>{row.status === "complete" ? "Back to Partnered" : "Finish session ✓"}</button>
      </div>
    </div>
  );
}
