"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DialogueTurn, GrammarConcept } from "@ll/pack-schema";
import * as scenario from "@ll/core/scenario";
import * as familiarity from "@ll/core/familiarity";
import * as scoring from "@ll/core/familiarity/scoring";
import * as api from "../../lib/api";
import { type Progress } from "../../lib/store";
import * as cp from "../../lib/course-player";
import { GrammarExplainer } from "../grammar/GrammarCards";
import { Icon, MixedText, SpeakButton, usePack, usePlay, useRecorder } from "../shared";

// ---------- Library view 2: scenarios ----------
export function ScenarioView({ progress, persist, config, lettersDone, scenarioId, hidePicker, bare, onComplete, onMiss, askable, restartIfDone, focusPoints }: { progress: Progress; persist: (p: Progress) => void; config: api.Config | null; lettersDone: boolean; scenarioId?: string; hidePicker?: boolean; bare?: boolean; onComplete?: () => void; onMiss?: (turn: DialogueTurn) => void; askable?: boolean; restartIfDone?: boolean; focusPoints?: string[] }) {
  const pack = usePack();
  const course = cp.courseV2On(pack, progress) ? pack.course : undefined;
  const s = pack.scenarios.find((x) => x.id === (scenarioId ?? progress.pick)) || pack.scenarios[0]!;
  const sp = progress.scenarios[s.id] || { turnIndex: 0, metCriteria: [] };
  const run: scenario.ScenarioRun = { scenarioId: s.id, turnIndex: sp.turnIndex, metCriteria: sp.metCriteria, done: sp.turnIndex >= s.script.length };

  const saveRun = (r: scenario.ScenarioRun) =>
    persist({ ...progress, scenarios: { ...progress.scenarios, [s.id]: { turnIndex: r.turnIndex, metCriteria: r.metCriteria } } });
  const setPick = (id: string) => persist({ ...progress, pick: id });
  const restart = () => saveRun(scenario.start(s));
  const autoplay = progress.settings?.autoplay ?? false;
  const toggleAutoplay = () => persist({ ...progress, settings: { ...progress.settings, autoplay: !autoplay } });

  // Daily speak step: if this scenario was already finished on a previous day, start it fresh so the
  // learner actually gets a conversation to practise (instead of landing on the "Finish session" screen).
  const resetOnce = useRef(false);
  useEffect(() => {
    if (restartIfDone && !resetOnce.current && sp.turnIndex >= s.script.length) { resetOnce.current = true; restart(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const turn = scenario.currentTurn(run, s);
  const done = run.turnIndex >= s.script.length;
  // The conversation so far, as a script (the last few lines), and which of your lines this is.
  const past = s.script.slice(0, run.turnIndex).slice(-4);
  const mine = s.script.flatMap((t, i) => (t.speaker === "learner" ? [i] : []));
  const lineLabel = mine.includes(run.turnIndex) ? `Your line · ${mine.indexOf(run.turnIndex) + 1} of ${mine.length}` : undefined;

  const inner = (
    <>
      {!hidePicker && (
        <div className="picker">
          {pack.scenarios.map((x) => (
            <button key={x.id} className={x.id === s.id ? "active" : ""} onClick={() => setPick(x.id)}>{x.title}</button>
          ))}
        </div>
      )}
      {!lettersDone && !bare && <div className="banner">Tip: finish <b>Letters</b> first, but practise here anyway (tap “Show pronunciation” for the Latin spelling).</div>}
      {!bare && <h2>{s.title}</h2>}
      {!bare && <p className="lead"><MixedText text={s.goal} /> <span className="muted">· {s.setting}</span></p>}
      <div className="check">
        {s.successCriteria.map((c) => (
          <span key={c.id} className={`crit ${run.metCriteria.includes(c.id) ? "met" : ""}`}>
            {run.metCriteria.includes(c.id) && <Icon name="check" size={12} />} <MixedText text={c.description} />
          </span>
        ))}
      </div>
      {course
        ? <CoursePointChips sources={s.script.map((_, i) => `scenario:${s.id}#${i}`)} progress={progress} />
        : s.requiredStructures.length > 0 && <ScenarioGrammar ids={s.requiredStructures} />}

      {!done && past.length > 0 && (
        <div className="script">{past.map((t, i) => <ScriptLine key={run.turnIndex - past.length + i} turn={t} />)}</div>
      )}
      {done ? (
        <Completion scenarioId={s.id} config={config} onComplete={onComplete} />
      ) : turn?.speaker === "partner" ? (
        <PartnerTurn key={run.turnIndex} turn={turn} autoplay={autoplay} onContinue={() => saveRun(scenario.advance(run, s))} focusWords={course && focusPoints ? cp.focusWords(course, `scenario:${s.id}#${run.turnIndex}`, focusPoints) : undefined} />
      ) : turn ? (
        <LearnerTurn
          key={run.turnIndex}
          turn={turn}
          config={config}
          onDone={() => saveRun(scenario.completeTurn(run, s))}
          onMiss={onMiss}
          lineLabel={lineLabel}
          focusWords={course && focusPoints ? cp.focusWords(course, `scenario:${s.id}#${run.turnIndex}`, focusPoints) : undefined}
        />
      ) : null}

      {askable && <HaveAQuestion convoId={s.id} lines={s.script} conceptIds={s.requiredStructures} sources={s.script.map((_, i) => `scenario:${s.id}#${i}`)} progress={progress} />}

      <div className="row" style={{ marginTop: 18, gap: 18 }}>
        <button className="quiet" onClick={restart}>Start the conversation again</button>
        <button className="quiet" aria-pressed={autoplay} onClick={toggleAutoplay} title="Auto-play the other speaker's lines for hands-free listening practice">
          {autoplay ? "Auto-play their lines: on" : "Auto-play their lines: off"}
        </button>
      </div>
    </>
  );

  return bare ? inner : <section className="view">{inner}</section>;
}
// The new course's "grammar here" chips: the points these lines use that you've been taught (from the line
// tags), each opening its rule inline. Points you haven't met yet aren't offered, so nothing is explained early.
export function CoursePointChips({ sources, progress, label = "Grammar here:" }: { sources: string[]; progress: Progress; label?: string }) {
  const pack = usePack();
  const play = usePlay();
  const course = pack.course!;
  const pts = useMemo(() => {
    const used = new Set(sources.flatMap((src) => course.lineTags[src] ?? []));
    return course.points.filter((pt) => used.has(pt.id) && progress.seenGrammar?.[pt.id]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course, sources.join(), progress.seenGrammar]);
  const [open, setOpen] = useState<string | null>(null);
  if (!pts.length) return null;
  const shown = pts.find((pt) => pt.id === open);
  return (
    <div className="gram-inline">
      <span className="muted small">{label}</span>
      {pts.map((pt) => (
        <button key={pt.id} className={`chip-toggle${open === pt.id ? " active" : ""}`} aria-expanded={open === pt.id} onClick={() => setOpen(open === pt.id ? null : pt.id)}><MixedText text={pt.title} /></button>
      ))}
      {shown && (
        <div className="gram-pop">
          <div className="recap-head">
            <span className="gram-title" style={{ fontSize: 17, margin: 0 }}><MixedText text={shown.title} /></span>
            <button className="quiet" onClick={() => setOpen(null)}>Hide</button>
          </div>
          <p className="recap-text"><MixedText text={shown.rule} /></p>
          <div className="gram-ex-list">
            {shown.examples.slice(0, 2).map((ex) => (
              <div className="gram-ex" key={ex.source}>
                <SpeakButton label={`Play ${ex.text}`} onClick={() => play(ex.text)} />
                <span className="ex-text"><span className="mk" lang={pack.id}>{ex.text}</span><span className="en">{ex.gloss}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
/** A line with today's focus words outlined (the same mark the story uses). */
export function FocusText({ text, words }: { text: string; words?: string[] }) {
  if (!words?.length) return <>{text}</>;
  const esc = [...words].sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(?<![\\p{L}])(${esc.join("|")})(?![\\p{L}])`, "u"));
  return <>{parts.map((part, i) => (i % 2 ? <mark key={i} className="focus-word">{part}</mark> : <span key={i}>{part}</span>))}</>;
}
export function ScenarioGrammar({ ids, label = "Grammar here:" }: { ids: string[]; label?: string }) {
  const pack = usePack();
  const concepts = ids.map((id) => pack.grammar.find((c) => c.id === id)).filter((c): c is GrammarConcept => !!c);
  const [open, setOpen] = useState<string | null>(null);
  if (concepts.length === 0) return null;
  const shown = concepts.find((c) => c.id === open);
  return (
    <div className="gram-inline">
      <span className="muted small">{label}</span>
      {concepts.map((c) => (
        <button key={c.id} className={`chip-toggle${open === c.id ? " active" : ""}`} aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}><MixedText text={c.name} /></button>
      ))}
      {shown && (
        <div className="gram-pop">
          <div className="recap-head">
            <span className="gram-title" style={{ fontSize: 17, margin: 0 }}><MixedText text={shown.name} /></span>
            <button className="quiet" onClick={() => setOpen(null)}>Hide</button>
          </div>
          <GrammarExplainer concept={shown} compact />
        </div>
      )}
    </div>
  );
}
// "Have a question?" — a scoped AI explainer for the conversation in a Today session step (story read /
// speak scenario). Concept-derived canned chips + a bounded (≤120 char) free-text box; the answer is cached
// cross-user and rate-limited server-side (see DESIGN-ai-explain.md). Rendered ONLY in the Today flow.
export function HaveAQuestion({ convoId, lines, conceptIds, sources, progress }: {
  convoId: string;
  lines: { text: string; gloss?: string }[];
  conceptIds: string[];
  /** New course: the lines' sources, so the chips offer the taught points these lines use. */
  sources?: string[];
  progress?: Progress;
}) {
  const pack = usePack();
  const course = progress && cp.courseV2On(pack, progress) ? pack.course : undefined;
  // On the course the chips are the points these lines use that you've been taught, and the helper is told
  // what's been taught so it names later grammar ("chapter 8") instead of teaching it early.
  const taughtHere = course && sources ? course.points.filter((pt) => progress!.seenGrammar?.[pt.id] && sources.some((src) => (course.lineTags[src] ?? []).includes(pt.id))) : [];
  const courseCtx = course && progress ? cp.explainContext(course, progress) : undefined;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [spin, setSpin] = useState(false);
  const [err, setErr] = useState("");
  const concepts = conceptIds.map((id) => pack.grammar.find((c) => c.id === id)).filter((c): c is GrammarConcept => !!c);

  const ask = async (question: string, canned?: string) => {
    setSpin(true); setErr(""); setAnswer(null);
    try {
      const r = await api.explain({ packId: pack.id, convoId, lines, question, canned, ...(courseCtx ? { course: courseCtx } : {}) });
      if (r.answer) setAnswer(r.answer);
      else if (r.error === "rate_limited") setErr("You've asked a lot today. Take a look at the grammar reference for now, and come back tomorrow.");
      else if (r.error === "unconfigured") setErr("AI help isn't available right now.");
      else setErr("Couldn't answer that one. Try rephrasing.");
    } catch {
      setErr("Something went wrong. Try again.");
    } finally {
      setSpin(false);
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <button className="ghost small" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? "Close the question box" : "Have a question?"}</button>
      {open && (
        <div className="framed write-card" style={{ marginTop: 10 }}>
          <div className="overline">Have a question?</div>
          <p className="muted small" style={{ margin: "6px 0 0" }}>Ask about the grammar or wording in this conversation.</p>
          {course ? (taughtHere.length > 0 && (
            <div className="row" style={{ flexWrap: "wrap", margin: "8px 0" }}>
              {taughtHere.map((pt) => (
                <button key={pt.id} className="chip-toggle" disabled={spin} onClick={() => ask(`Why "${pt.title}"? Explain how it shows up in this conversation.`, pt.id)}><MixedText text={pt.title} />?</button>
              ))}
            </div>
          )) : concepts.length > 0 && (
            <div className="row" style={{ flexWrap: "wrap", margin: "8px 0" }}>
              {concepts.map((c) => (
                <button key={c.id} className="chip-toggle" disabled={spin} onClick={() => ask(`Why "${c.name}"? Explain how it shows up in this conversation.`, c.id)}><MixedText text={c.name} />?</button>
              ))}
            </div>
          )}
          <div className="row">
            <input className="text" aria-label="Your question" style={{ flex: 1, minWidth: 180 }} maxLength={120} placeholder="e.g. why is there a тоа here?" value={q}
              onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && q.trim() && !spin) ask(q.trim()); }} />
            <button className="btn" disabled={spin || !q.trim()} onClick={() => ask(q.trim())}>{spin ? "…" : "Ask"}</button>
          </div>
          {err && <div className="muted small" style={{ marginTop: 6 }}>{err}</div>}
          {answer && (
            <div className="gram-plain" style={{ marginBottom: 0 }}>
              <div className="recap-head">
                <span className="lab">Answer</span>
                <button className="quiet" style={{ minHeight: 0, padding: 0 }} onClick={() => setAnswer(null)}>Hide</button>
              </div>
              <p><MixedText text={answer} /></p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
/** A line already said, in the script above the current turn. */
function ScriptLine({ turn }: { turn: DialogueTurn }) {
  const pack = usePack();
  const play = usePlay();
  const mine = turn.speaker === "learner";
  return (
    <div className={`script-line${mine ? " past" : ""}`}>
      <div className="who">{mine ? "You" : "Them"}</div>
      <div>
        <div className="script-text" lang={pack.id}>{turn.text}</div>
        {!mine && <div className="script-gloss">{turn.gloss}</div>}
      </div>
      {mine
        ? <span className="script-done" role="img" aria-label="Done"><Icon name="check" size={16} /></span>
        : <SpeakButton label="Play their line" onClick={() => play(turn.text, 0.85)} />}
    </div>
  );
}
export function PartnerTurn({ turn, autoplay, onContinue, focusWords }: { turn: DialogueTurn; autoplay: boolean; onContinue: () => void; focusWords?: string[] }) {
  const pack = usePack();
  const play = usePlay();
  useEffect(() => {
    if (autoplay) play(turn.text, 0.85);
  }, [turn.text, play, autoplay]);
  return (
    <div>
      <div className="script">
        <div className="script-line">
          <div className="who">Them</div>
          <div>
            <div className="script-text" lang={pack.id}><FocusText text={turn.text} words={focusWords} /></div>
            <div className="script-gloss">{turn.gloss}</div>
          </div>
          <SpeakButton label="Play their line" onClick={() => play(turn.text, 0.85)} />
        </div>
      </div>
      <div className="row" style={{ marginTop: 16 }}><button className="btn" onClick={onContinue}>Continue</button></div>
    </div>
  );
}
/** The line to say, in the text face: today's focus words outlined, and after an attempt the words to work
 *  on underlined in gold. */
function SayLine({ text, focus, fix }: { text: string; focus?: string[]; fix: Set<string> }) {
  const pack = usePack();
  return (
    <div className="say-line" lang={pack.id}>
      {fix.size
        ? scoring.tokenize(text).map((t, i) => (t.isWord && fix.has(familiarity.normalize(t.surface)) ? <span key={i} className="needs-fix">{t.surface}</span> : <span key={i}>{t.surface}</span>))
        : <FocusText text={text} words={focus} />}
    </div>
  );
}
export function LearnerTurn({ turn, config, onDone, onMiss, focusWords, lineLabel }: { turn: DialogueTurn; config: api.Config | null; onDone: () => void; onMiss?: (turn: DialogueTurn) => void; focusWords?: string[]; lineLabel?: string }) {
  const pack = usePack();
  const play = usePlay();
  const rec = useRecorder();
  const [recording, setRecording] = useState(false);
  const [spin, setSpin] = useState("");
  const [err, setErr] = useState("");
  const [asr, setAsr] = useState<api.AsrResponse | null>(null);
  const [fb, setFb] = useState<api.FeedbackResponse | null>(null);
  const [finished, setFinished] = useState(false);
  // Romanization starts hidden so the learner reads the Cyrillic first; tap to reveal (and hide again).
  const [showTranslit, setShowTranslit] = useState(false);

  const onRec = async () => {
    setErr("");
    if (!recording) {
      try {
        await rec.current.start();
        setRecording(true);
      } catch {
        setErr("Microphone permission denied. Use a real Chrome tab.");
      }
      return;
    }
    setRecording(false);
    const blob = await rec.current.stop();
    setSpin("Listening back…");
    try {
      const a = await api.asr(blob, pack.id);
      if (a.error) throw new Error(a.error);
      setAsr(a);
      if (config?.engines.anthropic) {
        setSpin("Coaching…");
        const f = await api.feedback(
          { answer: turn.text, translit: turn.translit, gloss: turn.gloss },
          { scribe: a.eleven?.text, google: a.google?.text },
          pack.id,
        );
        if (f.error) throw new Error(f.error);
        setFb(f);
        // Flag a missed line for the end-of-lesson recap — but ONLY when the ASR gate is confident.
        // Low-confidence (engines disagree, no target match) is exactly where scoring is unreliable, so
        // we give the benefit of the doubt and don't count it as a miss.
        if (f.score < 60 && f.gate?.confidence === "high") onMiss?.(turn);
      }
      setFinished(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSpin("");
    }
  };

  // Offer a re-record when the attempt scored low (or errored) — clears the result so they can try again.
  const lowScore = !!fb && fb.score < 60;
  const retry = () => { setFinished(false); setAsr(null); setFb(null); setErr(""); };
  const again = () => { retry(); void onRec(); };
  const fix = useMemo(() => new Set((fb?.words ?? []).filter((w) => w.status !== "correct").map((w) => familiarity.normalize(w.target))), [fb]);
  const heard = asr?.eleven?.ok && asr.eleven.text ? asr.eleven.text : asr?.google?.ok ? asr.google.text : "";

  return (
    <div>
      <div className="stitch-rule">{lineLabel ?? "Your line"}</div>
      <SayLine text={turn.text} focus={focusWords} fix={fix} />
      {turn.translit && (showTranslit
        ? <button className="quiet translit" title="Tap to hide" onClick={() => setShowTranslit(false)} style={{ textDecoration: "none", fontSize: 15 }}>{turn.translit}</button>
        : <button className="quiet" onClick={() => setShowTranslit(true)}>Show pronunciation</button>)}
      <div className="say-gloss">{turn.gloss}</div>
      {fb && <FeedbackCard fb={fb} asr={asr} />}
      {!fb && finished && heard && <div className="feedback good"><div className="heard">We heard: <span lang={pack.id}>{heard}</span></div></div>}
      {err && <div className="err">{err}</div>}
      <div className="speak-controls">
        <button className="ghost" onClick={() => play(turn.text)}><Icon name="speaker" size={16} />Hear it</button>
        <div className={`mic-ring${recording ? " recording" : ""}`}>
          <button className="mic" disabled={!!spin} aria-label={recording ? "Stop recording" : finished ? "Say it again" : "Record yourself saying it"} onClick={finished ? again : onRec}>
            <Icon name={recording ? "stop" : "mic"} size={30} />
          </button>
        </div>
        {finished
          ? <button className={lowScore ? "ghost" : "btn"} onClick={onDone}>Next<Icon name="next" size={16} /></button>
          : <button className="quiet" title="Skip recording this line" onClick={onDone}>I said it</button>}
      </div>
      <div className="speak-hint" aria-live="polite">
        {spin || (recording ? "Listening… tap to stop" : finished ? (lowScore ? "Tap the mic to try again" : "Tap the mic to say it again") : "Tap the mic, then say it slowly and clearly")}
      </div>
    </div>
  );
}
const WORD_STATUS: Record<string, string> = { correct: "clear", mispronounced: "almost there", wrong: "sounded like a different word", missed: "we didn't catch it", uncertain: "hard to tell" };
/** Coaching after an attempt: one friendly sentence, the single most useful fix, and what we heard. The score
 *  and the word-by-word notes stay one tap away, so a number never leads. The speech engines are never named
 *  (Jake, 2026-10-26: this is customer-facing): when they may have missed something, the card says so plainly. */
export function FeedbackCard({ fb, asr }: { fb: api.FeedbackResponse; asr?: api.AsrResponse | null }) {
  const pack = usePack();
  const misses = fb.words.filter((w) => w.status !== "correct");
  const good = fb.score >= 80 && misses.length === 0;
  const heard = asr?.eleven?.ok && asr.eleven.text ? asr.eleven.text : asr?.google?.ok ? asr.google.text : "";
  const unsure = fb.asrCaveat.likelyAsrError || fb.gate.confidence === "low";
  return (
    <div className={`feedback ${good ? "good" : "fix"}`} role="status">
      <div className="feedback-title"><MixedText text={fb.overall} /></div>
      {fb.tip && !good && <div style={{ fontSize: 15, lineHeight: 1.5 }}><MixedText text={fb.tip} /></div>}
      {unsure && <div className="heard">We may not have caught every word, so take this one lightly.</div>}
      {heard && <div className="heard">We heard: <span lang={pack.id}>{heard}</span></div>}
      <details>
        <summary>Details</summary>
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
          <span>Score {fb.score}/100</span>
          {fb.words.map((w, i) => <span key={i}><b lang={pack.id}>{w.target}</b>: {WORD_STATUS[w.status] ?? w.status}{w.note ? <>. <MixedText text={w.note} /></> : null}</span>)}
        </div>
      </details>
    </div>
  );
}
export function Completion({ scenarioId, config, onComplete }: { scenarioId: string; config: api.Config | null; onComplete?: () => void }) {
  const pack = usePack();
  const play = usePlay();
  const [history, setHistory] = useState<{ role: "learner" | "tutor"; text: string; gloss?: string; corr?: string }[]>([]);
  // Seed response scaffolding from the active pack's phrase vocab (pack-driven — no language baked in).
  const [suggestions, setSuggestions] = useState<{ text: string; gloss: string }[]>(() =>
    pack.vocab.filter((v) => v.kind === "phrase").slice(0, 3).map((v) => ({ text: v.answer, gloss: v.gloss })),
  );
  const [spin, setSpin] = useState("");
  const [err, setErr] = useState("");
  const [input, setInput] = useState("");
  const rec = useRecorder();
  const [recording, setRecording] = useState(false);

  const send = async (text: string) => {
    if (!text.trim()) return;
    setErr("");
    setSuggestions([]);
    const nextHist = [...history, { role: "learner" as const, text }];
    setHistory(nextHist);
    setSpin("Replying…");
    try {
      const r = await api.chat(text, nextHist.map((h) => ({ role: h.role, text: h.text })), scenarioId, pack.id);
      if (r.error) throw new Error(r.error);
      setHistory((h) => [...h, { role: "tutor", text: r.reply, gloss: r.replyGloss, corr: r.correction }]);
      play(r.reply, 0.9);
      setSuggestions(r.suggestions);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSpin("");
    }
  };

  const onRec = async () => {
    if (!recording) {
      try { await rec.current.start(); setRecording(true); } catch { setErr("Microphone denied. Use Chrome."); }
      return;
    }
    setRecording(false);
    setSpin("Listening back…");
    try {
      const a = await api.asr(await rec.current.stop(), pack.id);
      const t = a.eleven?.text || a.google?.text || "";
      if (!t) throw new Error("Nothing came through. Try again, closer to the mic.");
      await send(t);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSpin("");
    }
  };

  return (
    <div>
      <div className="done-card"><h2>You did it.</h2><p className="lead">You hit the goal. Keep chatting to practise more, or wrap up.</p>{onComplete && <button className="btn" onClick={onComplete}>Finish this step</button>}</div>
      <div>
        {history.map((h, i) => (
          <div className={`bubble ${h.role === "learner" ? "learner" : "partner"}`} key={i}>
            <div>{h.role === "tutor" && <SpeakButton onClick={() => play(h.text, 0.9)} />}{h.text}</div>
            {h.gloss && <div className="gloss">{h.gloss}</div>}
            {h.corr && <div className="corr">✎ <b>correction:</b> {h.corr}</div>}
          </div>
        ))}
      </div>
      {suggestions.length > 0 && (
        <div className="row">
          <span className="muted small">Try saying:</span>
          {suggestions.map((s, i) => (
            <button className="ghost chip" key={i} onClick={() => send(s.text)}>{s.text} <span className="muted">· {s.gloss}</span></button>
          ))}
        </div>
      )}
      <div className="row" style={{ marginTop: 10 }}>
        <button className={`btn ${recording ? "rec" : ""}`} onClick={onRec} disabled={!config?.engines.anthropic}><Icon name={recording ? "stop" : "mic"} size={16} />{recording ? "Stop" : "Speak a turn"}</button>
        <input
          className="text"
          placeholder="…or type a turn, press Enter"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { send(input); setInput(""); } }}
        />
      </div>
      {spin && <div className="spin">{spin}</div>}
      {err && <div className="err">{err}</div>}
    </div>
  );
}
