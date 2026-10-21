"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DialogueTurn, GrammarConcept } from "@ll/pack-schema";
import * as scenario from "@ll/core/scenario";
import * as api from "../../lib/api";
import { type Progress } from "../../lib/store";
import * as cp from "../../lib/course-player";
import { GrammarExplainer } from "../grammar/GrammarCards";
import { usePack, usePlay, useRecorder } from "../shared";

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

  const inner = (
    <>
      {!hidePicker && (
        <div className="picker">
          {pack.scenarios.map((x) => (
            <button key={x.id} className={x.id === s.id ? "active" : ""} onClick={() => setPick(x.id)}>{x.title}</button>
          ))}
        </div>
      )}
      {!lettersDone && !bare && <div className="banner">Tip: finish <b>Letters</b> first — but practice here anyway (tap “Show pronunciation” for the Latin spelling).</div>}
      {!bare && <h2>{s.title}</h2>}
      {!bare && <p className="lead">{s.goal} — <span className="muted">{s.setting}</span></p>}
      <div className="check">
        {s.successCriteria.map((c) => (
          <span key={c.id} className={`crit ${run.metCriteria.includes(c.id) ? "met" : ""}`}>
            {run.metCriteria.includes(c.id) ? "✓ " : ""}{c.description}
          </span>
        ))}
      </div>
      {course
        ? <CoursePointChips sources={s.script.map((_, i) => `scenario:${s.id}#${i}`)} progress={progress} />
        : s.requiredStructures.length > 0 && <ScenarioGrammar ids={s.requiredStructures} />}

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
          focusWords={course && focusPoints ? cp.focusWords(course, `scenario:${s.id}#${run.turnIndex}`, focusPoints) : undefined}
        />
      ) : null}

      {askable && <HaveAQuestion convoId={s.id} lines={s.script} conceptIds={s.requiredStructures} sources={s.script.map((_, i) => `scenario:${s.id}#${i}`)} progress={progress} />}

      <div className="row" style={{ marginTop: 14 }}>
        <button className="ghost" onClick={restart}>↺ Restart</button>
        <button className="ghost" onClick={toggleAutoplay} title="Auto-play the other speaker's lines for hands-free listening practice">
          {autoplay ? "🔊 Auto-play: on" : "🔇 Auto-play: off"}
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
        <button key={pt.id} className={`ghost small ${open === pt.id ? "active" : ""}`} onClick={() => setOpen(open === pt.id ? null : pt.id)}>ⓖ {pt.title}</button>
      ))}
      {shown && (
        <div className="fb" style={{ width: "100%", marginTop: 4 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
            <span className="gram-title" style={{ fontSize: 15 }}>ⓖ {shown.title}</span>
            <button className="ghost small" onClick={() => setOpen(null)}>Hide ▲</button>
          </div>
          <p style={{ margin: "6px 0" }}>{shown.rule}</p>
          <div className="gram-ex-list">
            {shown.examples.slice(0, 2).map((ex) => (
              <div className="gram-ex" key={ex.source}>
                <button className="gram-play" onClick={() => play(ex.text)} aria-label={`Play ${ex.text}`}>▶</button>
                <span className="mk">{ex.text}</span><span className="en">{ex.gloss}</span>
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
        <button key={c.id} className={`ghost small ${open === c.id ? "active" : ""}`} onClick={() => setOpen(open === c.id ? null : c.id)}>ⓖ {c.name}</button>
      ))}
      {shown && (
        <div className="fb" style={{ width: "100%", marginTop: 4 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
            <span className="gram-title" style={{ fontSize: 15 }}>ⓖ {shown.name}</span>
            <button className="ghost small" onClick={() => setOpen(null)}>Hide ▲</button>
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
      else if (r.error === "rate_limited") setErr("You've asked a lot today — take a look at the grammar reference for now, and come back tomorrow.");
      else if (r.error === "unconfigured") setErr("AI help isn't configured in this environment.");
      else setErr("Couldn't answer that one — try rephrasing.");
    } catch {
      setErr("Something went wrong — try again.");
    } finally {
      setSpin(false);
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <button className="ghost small" onClick={() => setOpen((o) => !o)}>{open ? "▲" : "▾"} Have a question?</button>
      {open && (
        <div className="fb" style={{ marginTop: 8 }}>
          <div className="muted small">Ask about the grammar or wording in this conversation.</div>
          {course ? (taughtHere.length > 0 && (
            <div className="row" style={{ flexWrap: "wrap", margin: "8px 0" }}>
              {taughtHere.map((pt) => (
                <button key={pt.id} className="ghost small" disabled={spin} onClick={() => ask(`Why "${pt.title}"? Explain how it shows up in this conversation.`, pt.id)}>ⓖ {pt.title}?</button>
              ))}
            </div>
          )) : concepts.length > 0 && (
            <div className="row" style={{ flexWrap: "wrap", margin: "8px 0" }}>
              {concepts.map((c) => (
                <button key={c.id} className="ghost small" disabled={spin} onClick={() => ask(`Why "${c.name}"? Explain how it shows up in this conversation.`, c.id)}>ⓖ {c.name}?</button>
              ))}
            </div>
          )}
          <div className="row">
            <input className="lang-picker" style={{ flex: 1, minWidth: 180 }} maxLength={120} placeholder="e.g. why is there a тоа here?" value={q}
              onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && q.trim() && !spin) ask(q.trim()); }} />
            <button className="btn" disabled={spin || !q.trim()} onClick={() => ask(q.trim())}>{spin ? "…" : "Ask"}</button>
          </div>
          {err && <div className="muted small" style={{ marginTop: 6 }}>{err}</div>}
          {answer && (
            <div className="fb" style={{ marginTop: 8 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                <span className="muted small">Answer</span>
                <button className="ghost small" onClick={() => setAnswer(null)}>Hide ▲</button>
              </div>
              <p style={{ margin: "4px 0 0" }}>{answer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export function PartnerTurn({ turn, autoplay, onContinue, focusWords }: { turn: DialogueTurn; autoplay: boolean; onContinue: () => void; focusWords?: string[] }) {
  const play = usePlay();
  useEffect(() => {
    if (autoplay) play(turn.text, 0.85);
  }, [turn.text, play, autoplay]);
  return (
    <div>
      <div className="bubble partner">
        <div><button className="spk" onClick={() => play(turn.text, 0.85)}>🔊</button><FocusText text={turn.text} words={focusWords} /></div>
        <div className="gloss">{turn.gloss}</div>
      </div>
      <div className="row"><button className="btn" onClick={onContinue}>Continue →</button></div>
    </div>
  );
}
export function LearnerTurn({ turn, config, onDone, onMiss, focusWords }: { turn: DialogueTurn; config: api.Config | null; onDone: () => void; onMiss?: (turn: DialogueTurn) => void; focusWords?: string[] }) {
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
        setErr("Microphone permission denied — use a real Chrome tab.");
      }
      return;
    }
    setRecording(false);
    const blob = await rec.current.stop();
    setSpin("Transcribing…");
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

  return (
    <div>
      <p className="muted small">🐢 Speak slowly and clearly — recognition (and your pronunciation) both improve with deliberate pacing.</p>
      <p className="muted small">Your turn — say:</p>
      <div className="target"><FocusText text={turn.text} words={focusWords} /></div>
      {turn.translit && (showTranslit ? (
        <div className="translit" style={{ cursor: "pointer" }} title="Tap to hide" onClick={() => setShowTranslit(false)}>{turn.translit}</div>
      ) : (
        <button className="ghost small" onClick={() => setShowTranslit(true)}>Show pronunciation</button>
      ))}
      <div className="muted">{turn.gloss}</div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="ghost" onClick={() => play(turn.text)}>🔊 Hear it</button>
        <button className={`btn ${recording ? "rec" : ""}`} onClick={onRec}>{recording ? "⏹ Stop" : "⏺ Record"}</button>
        <button className="ghost" onClick={onDone}>Skip / I said it ✓</button>
      </div>
      {asr && (
        <div className="panels">
          {(["eleven", "google"] as const).map((eng) => {
            const e = asr[eng];
            const label = eng === "eleven" ? "Scribe" : "Google";
            return (
              <div className="panel" key={eng}>
                <div className="lab"><span>{label}</span><span>{e?.ok ? `${e.ms}ms` : ""}</span></div>
                <div className="val">{e ? (e.ok ? e.text || "(empty)" : "⚠ " + e.error) : "(off)"}</div>
              </div>
            );
          })}
        </div>
      )}
      {fb && <FeedbackCard fb={fb} />}
      {spin && <div className="spin">{spin}</div>}
      {err && <div className="err">{err}</div>}
      {finished && (
        <div className="row" style={{ marginTop: 12 }}>
          {lowScore && <button className="btn" onClick={retry}>🔁 Try again</button>}
          <button className={lowScore ? "ghost" : "btn"} onClick={onDone}>Next →</button>
        </div>
      )}
    </div>
  );
}
export function FeedbackCard({ fb }: { fb: api.FeedbackResponse }) {
  return (
    <div className="fb">
      <div className="line">
        <b>{fb.score}/100</b> {fb.overall}
        <span className={`gate ${fb.gate.confidence}`}>{fb.gate.confidence === "high" ? "high confidence" : "low confidence (ASR)"}</span>
      </div>
      <div className="line">
        {fb.words.map((w, i) => (
          <span className={`pill ${w.status}`} key={i} title={w.note}>{w.target} · {w.status}</span>
        ))}
      </div>
      {fb.tip && <div className="line"><span className="muted">💡</span> {fb.tip}</div>}
      {fb.asrCaveat.likelyAsrError && <div className="flag">⚠ <b>Likely ASR error:</b> {fb.asrCaveat.explanation}</div>}
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
      try { await rec.current.start(); setRecording(true); } catch { setErr("Mic denied — use Chrome."); }
      return;
    }
    setRecording(false);
    setSpin("Transcribing…");
    try {
      const a = await api.asr(await rec.current.stop(), pack.id);
      const t = a.eleven?.text || a.google?.text || "";
      if (!t) throw new Error("No transcript — closer to the mic");
      await send(t);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSpin("");
    }
  };

  return (
    <div>
      <div className="done-card"><h2>🎉 You did it!</h2><p className="lead">You hit the goal. Keep chatting to practise more, or wrap up.</p>{onComplete && <button className="btn" onClick={onComplete}>Finish session →</button>}</div>
      <div>
        {history.map((h, i) => (
          <div className={`bubble ${h.role === "learner" ? "learner" : "partner"}`} key={i}>
            <div>{h.role === "tutor" && <button className="spk" onClick={() => play(h.text, 0.9)}>🔊</button>}{h.text}</div>
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
        <button className={`btn ${recording ? "rec" : ""}`} onClick={onRec} disabled={!config?.engines.anthropic}>{recording ? "⏹ Stop" : "⏺ Speak a turn"}</button>
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
