"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as familiarity from "@ll/core/familiarity";
import * as api from "../../lib/api";
import { type Progress } from "../../lib/store";
import { properNounLike, starMany } from "../../lib/capture";
import * as cp from "../../lib/course-player";
import { romanize } from "../../lib/romanize";
import * as guided from "@ll/core/partner/guided";
import { colStack } from "../partner/shared";
import { HintButton, Icon, MixedText, SpeakButton, Stitches, usePack, usePlay, useRecorder } from "../shared";

// ---------- Practice with AI: the guided conversation, solo (DESIGN-partnered-conversation.md §4) ----------
// The AI partner's lines are scripted from the chapter's deck (reviewed Macedonian, nothing generated while
// you talk). Each of your turns: answer what she said in your own words, then say the line on your screen.
// Nothing is corrected while you talk; at the end ONE review of the whole conversation (/api/guided-review),
// then the fixes one by one: say the better line aloud, tap "Got it", and it's saved to your Flashcards.
export const AI_NAME = "Ema";
export const ME = "me";
export function PracticeDecks({ progress, onOpen }: { progress: Progress; onOpen: (chapterId: string) => void }) {
  const pack = usePack();
  const course = pack.course;
  const at = course ? cp.currentSlot(course, progress) : undefined;
  const names = useCallback((w: string) => properNounLike(w, pack), [pack]);
  const decks = useMemo(() => (!course || !at ? [] : (course.guided ?? []).map((d) => {
    const order = course.chapters.find((c) => c.chapterId === d.chapterId)?.order ?? 999;
    const n = cp.guidedCuesIn(pack, course, d, at, at, names, { ai: true }).length;
    return { d, order, title: pack.chapters?.find((c) => c.id === d.chapterId)?.title ?? d.chapterId, n, open: n >= cp.GUIDED_MIN };
  }).sort((a, b) => a.order - b.order)), // eslint-disable-next-line react-hooks/exhaustive-deps
  [pack, course, at?.order, at?.n, names]);
  if (!course) return null;
  return (
    <>
      <p className="lead">A short conversation with {AI_NAME}, an AI partner. Each turn, answer what {AI_NAME} said in your own words, then say the line on your screen. Nothing is corrected while you talk: at the end you go through a few fixes.</p>
      <div className="lib-list">
        {decks.map((x) => (
          <button key={x.d.chapterId} className="lib-item" disabled={!x.open} onClick={() => onOpen(x.d.chapterId)}>
            <span className="lib-kind">Chapter {x.order}</span>
            <span style={{ minWidth: 0 }}>
              <span className="lib-title">{x.title}</span>
              <span className="lib-sub">{x.open ? `${x.d.scene} · ${x.n} lines` : "Opens as you learn this chapter's words"}</span>
            </span>
            <span className={`lib-fit${x.open ? " just" : ""}`}>{x.open ? "open" : "later"}</span>
          </button>
        ))}
      </div>
    </>
  );
}
export const FIX_KIND: Record<string, string> = { grammar: "grammar", person: "who it's about", word: "word choice", meaning: "meaning", sound: "pronunciation" };
export function PracticeAI({ progress, persist, chapterId }: { progress: Progress; persist: (p: Progress) => void; chapterId: string }) {
  const pack = usePack();
  const play = usePlay();
  const rec = useRecorder();
  const course = pack.course;
  const deck = course?.guided?.find((d) => d.chapterId === chapterId);
  const at = course ? cp.currentSlot(course, progress) : { order: 0, n: 1 };
  const names = useCallback((w: string) => properNounLike(w, pack), [pack]);
  const [s, setS] = useState<guided.GuidedSession | null>(null);
  const [rows, setRows] = useState<guided.GuidedMemberRow[]>([]);
  const [recording, setRecording] = useState(false);
  const [micWait, setMicWait] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState("");
  const [showText, setShowText] = useState(false);
  const [showEn, setShowEn] = useState(false);
  const [saved, setSaved] = useState(false);
  const clips = useRef(new Map<number, string>());
  const requested = useRef(false);
  const chapterTitle = pack.chapters?.find((c) => c.id === chapterId)?.title ?? chapterId;

  const start = () => {
    if (!course || !deck) return;
    const cues = cp.guidedCuesIn(pack, course, deck, at, at, names, { ai: true });
    // Ema starts, so your first turn is an answer; she ends with the reply to your goodbye.
    const sess = guided.startGuided({ id: `practice-${Date.now()}`, packId: pack.id, members: [guided.AI_MEMBER, ME], names: { [guided.AI_MEMBER]: AI_NAME, [ME]: "you" }, cues, startedAt: new Date().toISOString() });
    clips.current.forEach((u) => URL.revokeObjectURL(u));
    clips.current.clear();
    requested.current = false;
    setRows([guided.emptyRow(sess.id, guided.AI_MEMBER), guided.emptyRow(sess.id, ME)]);
    setS(sess); setSaved(false); setErr(""); setShowText(false); setShowEn(false); setTyped("");
  };
  const update = (id: string, f: (r: guided.GuidedMemberRow) => guided.GuidedMemberRow) => setRows((rs) => rs.map((r) => (r.userId === id ? f(r) : r)));
  const mine = rows.find((r) => r.userId === ME);
  const turn = s ? guided.nextTurn(s, rows) : undefined;
  const ph = s ? guided.phase(s, rows) : undefined;
  const now = () => new Date().toISOString();

  const emaNext = () => {
    if (!s || turn === undefined) return;
    const line = guided.aiLine(s, turn);
    update(guided.AI_MEMBER, (r) => guided.endTurn(s, rows, r, { at: now(), text: line.text }).row);
    setShowText(false); setShowEn(false);
  };
  const startRec = async () => {
    setErr(""); setMicWait(true);
    try { await rec.current.start(); setRecording(true); } catch { setErr("Couldn't use the microphone, so type your turns instead."); setTyping(true); }
    setMicWait(false);
  };
  // Typing instead: let go of the mic (and of a permission prompt still waiting).
  const toggleTyping = () => { if (!typing) { rec.current.release(); setRecording(false); setMicWait(false); } setTyping(!typing); };
  const endMine = async (how: "spoken" | "typed" | "skipped") => {
    if (!s || turn === undefined || !mine) return;
    const t = turn;
    if (how === "spoken") {
      setRecording(false);
      const blob = await rec.current.stop();
      clips.current.set(t, URL.createObjectURL(blob));
      update(ME, (r) => guided.endTurn(s, rows, r, { at: now() }).row);
      // Transcribed in the background while the conversation goes on.
      api.asr(blob, pack.id)
        .then((res) => update(ME, (r) => guided.addTranscripts(r, t, { scribe: res.eleven?.ok ? res.eleven.text : undefined, google: res.google?.ok ? res.google.text : undefined })))
        .catch(() => update(ME, (r) => guided.addTranscripts(r, t, {})));
    } else if (how === "typed") {
      update(ME, (r) => guided.endTurn(s, rows, r, { at: now(), text: typed.trim() }).row);
      setTyped("");
    } else {
      rec.current.release(); setRecording(false); setMicWait(false);
      update(ME, (r) => guided.endTurn(s, rows, r, { at: now(), skipped: true }).row);
    }
  };

  // The whole conversation is in (and transcribed): one review of all of it.
  useEffect(() => {
    if (!s || ph !== "reviewing" || requested.current || s.reviewError) return;
    requested.current = true;
    const segs = [...guided.segments(s, rows).values()];
    api.guidedReview({
      cueIds: s.cues.map((c) => c.id),
      members: [{ id: guided.AI_MEMBER, name: AI_NAME }, { id: ME, name: "You", at }],
      segments: segs.map((x) => ({ turn: x.turn, ...(x.skipped ? { skipped: true } : x.text !== undefined ? { text: x.text } : { transcripts: x.transcripts }) })),
    }, pack.id)
      .then((r) => { if (r.error || !r.fixes) throw new Error(r.error || "no review came back"); setS((cur) => cur && guided.withReview(cur, r)); })
      .catch((e: unknown) => setS((cur) => cur && { ...cur, reviewError: e instanceof Error ? e.message : String(e) }));
  }, [s, ph, rows, at, pack.id]);

  // Finished: your corrected lines go to your Flashcards (★), once.
  useEffect(() => {
    if (!s?.review || ph !== "done" || saved) return;
    const keep = guided.keptFixes(s, rows, ME);
    if (keep.length) persist(starMany(progress, keep.map((f) => ({ lexKey: familiarity.normalize(f.better), display: f.better, gloss: f.betterEn }))));
    setSaved(true);
  }, [s, ph, rows, saved, persist, progress]);

  if (!course || !deck) return <section className="view"><p className="muted">That conversation isn't available.</p></section>;

  const head = <div><div className="overline" style={{ marginTop: 12 }}>Practice with {AI_NAME}</div><h2 style={{ margin: "4px 0 0" }}>{chapterTitle}</h2></div>;

  if (!s) {
    const n = cp.guidedCuesIn(pack, course, deck, at, at, names, { ai: true }).length;
    return (
      <section className="view" style={colStack}>
        {head}
        <p className="lead">{deck.scene}</p>
        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.55 }}>
          <li>{AI_NAME} speaks first. Tap the speaker to hear her, and try to understand before you show the words.</li>
          <li>On your turn, answer her in your own words, then say the line on your screen. Tap <b>Talk</b>, then <b>Done</b> when you&apos;ve said it.</li>
          <li>Nothing is corrected while you talk. At the end you go through a few fixes: say each better line aloud.</li>
        </ol>
        <div className="row"><button className="btn" disabled={n < cp.GUIDED_MIN} onClick={start}>Start ({n} lines)</button></div>
      </section>
    );
  }

  if (ph === "talk" && turn !== undefined) {
    const spec = guided.turnSpec(s, turn);
    const bar = (
      <div className="today-sub" style={{ marginTop: 0 }}>
        <Stitches total={guided.turnCount(s)} done={turn - 1} now={turn - 1} size={10} label={`Turn ${turn} of ${guided.turnCount(s)}`} />
        <span>Turn {turn} of {guided.turnCount(s)}</span>
      </div>
    );
    if (spec.speaker === guided.AI_MEMBER) {
      const line = guided.aiLine(s, turn);
      return (
        <section className="view" style={colStack} key={`t${turn}`}>
          {head}{bar}
          <div className="framed write-card">
            <div className="overline">{AI_NAME} says</div>
            <div className="model-line" style={{ margin: "10px 0 4px" }}>
              <SpeakButton label={`Hear ${AI_NAME}`} onClick={() => play(line.text)} />
              {showText ? <span className="say-line" lang={pack.id} style={{ fontSize: 24, margin: 0 }}>{line.text}</span> : <button className="ghost small" onClick={() => setShowText(true)}>Show the words</button>}
            </div>
            {showText && <div className="say-gloss">{romanize(line.text)}</div>}
            {showText && (showEn ? <p style={{ margin: "8px 0 0" }}>{line.gloss}</p> : <button className="quiet" onClick={() => setShowEn(true)}>Translate</button>)}
          </div>
          <div className="row"><button className="btn" onClick={emaNext}>{guided.turnSpec(s, turn + 1).speaker === ME ? "Your turn" : "Finish"}</button></div>
        </section>
      );
    }
    return (
      <section className="view" style={colStack} key={`t${turn}`}>
        {head}{bar}
        <div className="framed write-card" style={colStack}>
          <div className="overline">Your turn</div>
          {spec.answers && (
            <div>
              <div className="activity-sub">{spec.asks ? "1. " : ""}Answer {AI_NAME} in your own words</div>
              {spec.answers.replyFrame && <HintButton hint={spec.answers.replyFrame} label="A way to start" />}
            </div>
          )}
          {spec.asks && (
            <div>
              <div className="activity-sub">{spec.answers ? "2. Then:" : "Say:"}</div>
              <p className="card-prompt" style={{ fontSize: 20 }}><MixedText text={guided.cueText(s, spec.asks, ME)} /></p>
              <HintButton hint={`${spec.asks.answer} (${spec.asks.answerGloss})`} label="Show a way to say it" />
            </div>
          )}
        </div>
        {err ? <div className="err">{err}</div> : null}
        {typing ? (
          <div className="row">
            <input className="text" aria-label="Your line, typed" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type it (Cyrillic or Latin)" style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter" && typed.trim()) void endMine("typed"); }} />
            <button className="btn" disabled={!typed.trim()} onClick={() => void endMine("typed")}>Done</button>
          </div>
        ) : (
          <div className="row">
            {recording
              ? <button className="btn rec" onClick={() => void endMine("spoken")}><Icon name="stop" size={16} />Done</button>
              : <button className="btn" disabled={micWait} onClick={() => void startRec()}><Icon name="mic" size={16} />Talk</button>}
            {micWait && <span className="muted small">Waiting for the microphone… allow it in your browser, or type instead.</span>}
          </div>
        )}
        <div className="row">
          <button className="quiet" onClick={() => void endMine("skipped")}>Skip this one</button>
          {!recording && <button className="quiet" onClick={toggleTyping}>{typing ? "Speak instead" : "Type instead"}</button>}
        </div>
      </section>
    );
  }

  if (ph === "transcribing" || ph === "reviewing" || !s.review) {
    return (
      <section className="view" style={colStack}>
        {head}
        {s.reviewError ? (
          <>
            <div className="err">The review didn&apos;t come through: {s.reviewError}</div>
            <div className="row"><button className="btn" onClick={() => { requested.current = false; setS({ ...s, reviewError: undefined }); }}>Try again</button></div>
          </>
        ) : <p className="lead">Putting your review together… <span className="muted small">(about 20 seconds)</span></p>}
      </section>
    );
  }

  const review = s.review;
  const highlights = review.highlights.filter((h) => h.speakerId === ME);
  const fix = guided.currentFix(s, rows);
  const playClip = (t: number) => { const u = clips.current.get(t); if (u) void new Audio(u).play().catch(() => {}); };
  const goodBits = highlights.length > 0 && (
    <div className="framed write-card">
      <div className="overline">What went well</div>
      <ul style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.55 }}>{highlights.map((h, i) => <li key={i}><MixedText text={h.text} /></li>)}</ul>
    </div>
  );

  if (ph === "review" && fix && mine) {
    const i = review.fixes.indexOf(fix);
    return (
      <section className="view" style={colStack} key={fix.id}>
        {head}
        {i === 0 && goodBits}
        <div className="framed write-card">
          <div className="overline">Fix {i + 1} of {review.fixes.length} · {FIX_KIND[fix.kind] ?? fix.kind}</div>
          <div className="model-line" style={{ marginTop: 10 }}>
            <span className="muted small">You said:</span> <span lang={pack.id} style={{ fontWeight: 600 }}>“{fix.said}”</span>
            {clips.current.has(fix.turn) && <button className="ghost small" onClick={() => playClip(fix.turn)}><Icon name="speaker" size={14} />Hear yourself</button>}
          </div>
          <div className="recap-sub">Better</div>
          <div className="model-line" style={{ marginTop: 4 }}>
            <SpeakButton label="Play the better line" onClick={() => play(fix.better)} />
            <span className="say-line" lang={pack.id} style={{ fontSize: 24, margin: 0 }}>{fix.better}</span>
          </div>
          <div className="say-gloss">{fix.betterTranslit ?? romanize(fix.better)} · {fix.betterEn}</div>
          <p style={{ margin: "10px 0 0", lineHeight: 1.55 }}><MixedText text={fix.why} /></p>
          <div className="muted small" style={{ marginTop: 14 }}>Say the better line aloud, then:</div>
          <div className="grade-row">
            <button className="ghost" onClick={() => update(ME, (r) => guided.judgeFix(s, rows, r, false))}><Icon name="restart" size={16} />Not quite</button>
            <button className="btn" onClick={() => update(ME, (r) => guided.judgeFix(s, rows, r, true))}><Icon name="check" size={16} />Got it</button>
          </div>
        </div>
        <button className="quiet" style={{ alignSelf: "flex-start" }} onClick={() => update(ME, (r) => guided.dismissFix(s, rows, r))}>That&apos;s not what I said</button>
      </section>
    );
  }

  const sc = guided.reviewScore(s, rows);
  const kept = guided.keptFixes(s, rows, ME);
  return (
    <section className="view" style={colStack}>
      {head}
      <p className="lead">{review.fixes.length ? "That's the conversation." : "A clean conversation: nothing to fix."} {sc.asksRight} of {sc.asks} lines spot on{review.fixes.length ? `, ${sc.got} of ${review.fixes.length - sc.dismissed} fixes said right` : ""}.</p>
      {goodBits}
      {kept.length > 0 && (
        <div className="framed write-card">
          <div className="overline">★ Saved to your Flashcards</div>
          <ul className="recap-list">{kept.map((f) => <li key={f.id} className="word-row"><b lang={pack.id} className="rmk">{f.better}</b> <span className="muted small">{f.betterEn}</span></li>)}</ul>
        </div>
      )}
      <div className="row"><button className="btn" onClick={start}>Practise again</button></div>
    </section>
  );
}
