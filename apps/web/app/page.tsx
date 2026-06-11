"use client";
// Phase 0-1 UI ported from spike/public/index.html into React, on @ll/core + @ll/pack-mk.
// Pure engines (scenario/srs/leveling) run client-side; paid calls (tts/asr/feedback/chat) hit the
// server route handlers that hold the keys.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { macedonian as mk } from "@ll/pack-mk";
import type { DialogueTurn, ReviewItem, Scenario } from "@ll/pack-schema";
import * as scenario from "@ll/core/scenario";
import * as srs from "@ll/core/srs";
import * as leveling from "@ll/core/leveling";
import * as session from "@ll/core/session";
import { makeRecorder } from "../lib/recorder";
import * as api from "../lib/api";
import { getStore, emptyProgress, type Progress } from "../lib/store";

type View = "session" | "letters" | "scenario" | "grammar" | "reading" | "review" | "write";

const focusLetters = () => mk.alphabet.filter((a) => a.unique || a.falseFriend);
const play = (text: string, speed = 1) => api.playTts(text, speed).catch(() => {});

// Flatten the SRS review pool: vocab phrases + grammar drills.
const grammarDrills: ReviewItem[] = mk.grammar.flatMap((c) => c.drills.map((d) => ({ ...d, meta: { ...d.meta, concept: c.name } })));
const reviewPool: ReviewItem[] = [...mk.vocab, ...grammarDrills];

export default function Home() {
  const store = useMemo(() => getStore(), []);
  const [progress, setProgress] = useState<Progress>(emptyProgress());
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<api.Config | null>(null);
  const [view, setView] = useState<View>("letters");

  useEffect(() => {
    (async () => {
      const p = await store.load();
      if (!p.pick) p.pick = mk.scenarios[0]!.id;
      setProgress(p);
      setReady(true);
      setView(focusLetters().every((a) => p.letters[a.glyph]) ? "session" : "letters");
      api.getConfig().then(setConfig).catch(() => {});
    })();
  }, [store]);

  const persist = useCallback(
    (next: Progress) => {
      setProgress(next);
      void store.save(next);
    },
    [store],
  );

  // ---- derived progress signals ----
  const lettersDone = focusLetters().every((a) => progress.letters[a.glyph]);
  const dueCount = useMemo(() => {
    const now = new Date();
    return reviewPool.filter((it) => {
      const st = progress.reviews[it.id];
      return !st || new Date(st.due) <= now;
    }).length;
  }, [progress.reviews]);

  const level = useMemo(() => {
    const glyphsKnown = focusLetters().filter((a) => progress.letters[a.glyph]).length;
    const criteriaMet = Object.values(progress.scenarios).reduce((n, s) => n + s.metCriteria.length, 0);
    const reviewStrength = Object.keys(progress.reviews).length;
    return leveling.currentLevel({ glyphsKnown, glyphsTotal: focusLetters().length, criteriaMet, reviewStrength });
  }, [progress]);

  const nextUp = useMemo(() => {
    if (!lettersDone) return "learn the focus letters";
    const inc = mk.scenarios.find((s) => {
      const p = progress.scenarios[s.id];
      return !p || s.successCriteria.some((c) => !p.metCriteria.includes(c.id));
    });
    if (inc) return `do "${inc.title}"`;
    return dueCount ? `review ${dueCount} due` : "read or free-chat";
  }, [lettersDone, progress.scenarios, dueCount]);

  if (!ready) return <main style={{ padding: 24 }}>Loading…</main>;

  const badge = (l: string, on?: boolean) => <span className={`badge ${on ? "on" : "off"}`} key={l}>{l} {on ? "✓" : "✗"}</span>;

  return (
    <>
      <header>
        <h1>🇲🇰 Macedonian</h1>
        <span className="muted small">Level {level.cefrBand} · Next: {nextUp}</span>
        <div className="badges">
          {config
            ? [badge("Scribe", config.engines.eleven), badge("Google", config.engines.google), badge("Claude", config.engines.anthropic)]
            : <span className="muted small">…</span>}
        </div>
      </header>
      <nav>
        {([
          ["session", "▶ Session"],
          ["letters", `① Letters ${lettersDone ? "✓" : ""}`],
          ["scenario", "② Scenarios"],
          ["grammar", "③ Grammar"],
          ["reading", "④ Reading"],
          ["review", `⑤ Review ${dueCount ? dueCount : ""}`],
          ["write", "⑥ Write"],
        ] as [View, string][]).map(([v, label]) => (
          <button key={v} className={view === v ? "active" : ""} onClick={() => setView(v)}>{label}</button>
        ))}
      </nav>
      <main>
        {view === "session" && (
          <Session
            progress={progress}
            persist={persist}
            config={config}
            onNavigate={(v, sid) => {
              if (sid) persist({ ...progress, pick: sid });
              setView(v);
            }}
          />
        )}
        {view === "letters" && <Letters progress={progress} persist={persist} onDone={() => setView("scenario")} />}
        {view === "scenario" && <ScenarioView progress={progress} persist={persist} config={config} lettersDone={lettersDone} />}
        {view === "grammar" && <Grammar progress={progress} persist={persist} />}
        {view === "reading" && <Reading />}
        {view === "review" && <Review progress={progress} persist={persist} />}
        {view === "write" && <Writing config={config} />}
      </main>
    </>
  );
}

// ---------- view 1: letters ----------
function Letters({ progress, persist, onDone }: { progress: Progress; persist: (p: Progress) => void; onDone: () => void }) {
  const toggle = (glyph: string) => persist({ ...progress, letters: { ...progress.letters, [glyph]: !progress.letters[glyph] } });
  const f = focusLetters();
  const known = f.filter((a) => progress.letters[a.glyph]).length;
  return (
    <section className="view">
      <h2>The Macedonian alphabet — 31 letters</h2>
      <p className="lead">
        Spelling is phonetic: one letter, one sound. Focus on the <span style={{ color: "var(--ok)" }}>7 unique</span> letters and
        the <span style={{ color: "var(--warn)" }}>false friends</span> that look Latin but sound different. Tap 🔊 to hear any example.
      </p>
      <div className="letters">
        {mk.alphabet.map((a) => {
          const focus = a.unique || a.falseFriend;
          const done = !!progress.letters[a.glyph];
          const ex = a.examples[0];
          return (
            <div className={`letter ${done ? "done" : ""}`} key={a.glyph}>
              <div className="g">{a.glyph}</div>
              <div className="n">
                {a.name}
                {a.unique ? <span className="tag uniq">unique</span> : a.falseFriend ? <span className="tag ff">looks Latin</span> : null}
              </div>
              <div className="s">{a.sound}</div>
              <div className="ex">{ex?.text} <span className="muted small">· {ex?.gloss}</span></div>
              <div className="acts">
                <button className="ghost" onClick={() => ex && play(ex.text, 0.7)}>🔊</button>
                {focus && <button className="ghost" onClick={() => toggle(a.glyph)}>{done ? "✓ known" : "got it"}</button>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="row">
        <button className="btn" onClick={onDone}>Done with the focus letters → scenarios</button>
        <span className="muted small">{known}/{f.length} focus letters known</span>
      </div>
    </section>
  );
}

// ---------- view 2: scenarios ----------
function ScenarioView({ progress, persist, config, lettersDone }: { progress: Progress; persist: (p: Progress) => void; config: api.Config | null; lettersDone: boolean }) {
  const s = mk.scenarios.find((x) => x.id === progress.pick) || mk.scenarios[0]!;
  const sp = progress.scenarios[s.id] || { turnIndex: 0, metCriteria: [] };
  const run: scenario.ScenarioRun = { scenarioId: s.id, turnIndex: sp.turnIndex, metCriteria: sp.metCriteria, done: sp.turnIndex >= s.script.length };

  const saveRun = (r: scenario.ScenarioRun) =>
    persist({ ...progress, scenarios: { ...progress.scenarios, [s.id]: { turnIndex: r.turnIndex, metCriteria: r.metCriteria } } });
  const setPick = (id: string) => persist({ ...progress, pick: id });
  const restart = () => saveRun(scenario.start(s));

  const turn = scenario.currentTurn(run, s);
  const done = run.turnIndex >= s.script.length;

  return (
    <section className="view">
      <div className="picker">
        {mk.scenarios.map((x) => (
          <button key={x.id} className={x.id === s.id ? "active" : ""} onClick={() => setPick(x.id)}>{x.title}</button>
        ))}
      </div>
      {!lettersDone && <div className="banner">Tip: finish <b>① Letters</b> first — but practice here anyway (transliteration is shown).</div>}
      <h2>{s.title}</h2>
      <p className="lead">{s.goal} — <span className="muted">{s.setting}</span></p>
      <div className="check">
        {s.successCriteria.map((c) => (
          <span key={c.id} className={`crit ${run.metCriteria.includes(c.id) ? "met" : ""}`}>
            {run.metCriteria.includes(c.id) ? "✓ " : ""}{c.description}
          </span>
        ))}
      </div>

      {done ? (
        <Completion scenarioId={s.id} config={config} />
      ) : turn?.speaker === "partner" ? (
        <PartnerTurn key={run.turnIndex} turn={turn} onContinue={() => saveRun(scenario.advance(run, s))} />
      ) : turn ? (
        <LearnerTurn
          key={run.turnIndex}
          turn={turn}
          config={config}
          onDone={() => saveRun(scenario.completeTurn(run, s))}
        />
      ) : null}

      <div className="row" style={{ marginTop: 14 }}>
        <button className="ghost" onClick={restart}>↺ Restart</button>
      </div>
    </section>
  );
}

function PartnerTurn({ turn, onContinue }: { turn: DialogueTurn; onContinue: () => void }) {
  useEffect(() => {
    play(turn.text, 0.85);
  }, [turn.text]);
  return (
    <div>
      <div className="bubble partner">
        <div><button className="spk" onClick={() => play(turn.text, 0.85)}>🔊</button>{turn.text}</div>
        <div className="gloss">{turn.gloss}</div>
      </div>
      <div className="row"><button className="btn" onClick={onContinue}>Continue →</button></div>
    </div>
  );
}

function LearnerTurn({ turn, config, onDone }: { turn: DialogueTurn; config: api.Config | null; onDone: () => void }) {
  const rec = useRef(makeRecorder());
  const [recording, setRecording] = useState(false);
  const [spin, setSpin] = useState("");
  const [err, setErr] = useState("");
  const [asr, setAsr] = useState<api.AsrResponse | null>(null);
  const [fb, setFb] = useState<api.FeedbackResponse | null>(null);
  const [finished, setFinished] = useState(false);

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
      const a = await api.asr(blob);
      if (a.error) throw new Error(a.error);
      setAsr(a);
      if (config?.engines.anthropic) {
        setSpin("Coaching…");
        const f = await api.feedback(
          { answer: turn.text, translit: turn.translit, gloss: turn.gloss },
          { scribe: a.eleven?.text, google: a.google?.text },
        );
        if (f.error) throw new Error(f.error);
        setFb(f);
      }
      setFinished(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSpin("");
    }
  };

  return (
    <div>
      <p className="muted small">🐢 Speak slowly and clearly — recognition (and your pronunciation) both improve with deliberate pacing.</p>
      <p className="muted small">Your turn — say:</p>
      <div className="target">{turn.text}</div>
      <div className="translit">{turn.translit}</div>
      <div className="muted">{turn.gloss}</div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="ghost" onClick={() => play(turn.text, 1)}>▶︎ Play native</button>
        <button className="ghost" onClick={() => play(turn.text, 0.7)}>🐢 Slow</button>
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
        <div className="row" style={{ marginTop: 12 }}><button className="btn" onClick={onDone}>Next →</button></div>
      )}
    </div>
  );
}

function FeedbackCard({ fb }: { fb: api.FeedbackResponse }) {
  return (
    <div className="fb">
      <div className="line">
        <b>{fb.score}/100</b> {fb.overall}
        <span className={`gate ${fb.gate.confidence}`}>{fb.gate.agreed ? "engines agree" : "engines disagree"}</span>
      </div>
      <div className="line">
        {fb.words.map((w, i) => (
          <span className={`pill ${w.status}`} key={i} title={w.note}>{w.target} · {w.status}</span>
        ))}
      </div>
      <div className="line"><span className="muted">Stress:</span> {fb.stress}</div>
      <div className="line"><span className="muted">Tip:</span> {fb.tip}</div>
      {fb.asrCaveat.likelyAsrError && <div className="flag">⚠ <b>Likely ASR error:</b> {fb.asrCaveat.explanation}</div>}
      <div className="meta">Claude {fb.ms}ms · ~${fb.costUsd}</div>
    </div>
  );
}

function Completion({ scenarioId, config }: { scenarioId: string; config: api.Config | null }) {
  const [history, setHistory] = useState<{ role: "learner" | "tutor"; text: string; gloss?: string; corr?: string }[]>([]);
  const [suggestions, setSuggestions] = useState<{ text: string; gloss: string }[]>([
    { text: "Многу добро!", gloss: "Very good!" },
    { text: "Колку чини?", gloss: "How much is it?" },
    { text: "Фала, чао!", gloss: "Thanks, bye!" },
  ]);
  const [spin, setSpin] = useState("");
  const [err, setErr] = useState("");
  const [input, setInput] = useState("");
  const rec = useRef(makeRecorder());
  const [recording, setRecording] = useState(false);

  const send = async (text: string) => {
    if (!text.trim()) return;
    setErr("");
    setSuggestions([]);
    const nextHist = [...history, { role: "learner" as const, text }];
    setHistory(nextHist);
    setSpin("Replying…");
    try {
      const r = await api.chat(text, nextHist.map((h) => ({ role: h.role, text: h.text })), scenarioId);
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
      const a = await api.asr(await rec.current.stop());
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
      <div className="done-card"><h2>Наздравје! 🍻 Done</h2><p className="lead">Now keep the conversation going — say anything.</p></div>
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

// ---------- view 3: grammar ----------
function Grammar({ progress, persist }: { progress: Progress; persist: (p: Progress) => void }) {
  const grade = (item: ReviewItem, correct: boolean) => {
    const st = progress.reviews[item.id] ?? srs.initState("local", item.id);
    const next = srs.schedule(st, correct ? "good" : "again");
    persist({ ...progress, reviews: { ...progress.reviews, [item.id]: next } });
  };
  return (
    <section className="view">
      <h2>Grammar that matters</h2>
      <p className="lead">Macedonian dropped the Slavic case system — so we drill what's actually distinctive. Answer a drill and it enters your spaced review.</p>
      {mk.grammar.map((c) => (
        <div className="concept" key={c.id}>
          <h3>{c.name}</h3>
          <p className="small">{c.explanation}</p>
          <p className="small muted">{c.examples.join(" · ")}</p>
          {c.drills.map((d) => <Drill key={d.id} drill={d} onGrade={(ok) => grade(d, ok)} />)}
        </div>
      ))}
    </section>
  );
}

function Drill({ drill, onGrade }: { drill: ReviewItem; onGrade: (ok: boolean) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const choose = (opt: string) => {
    if (picked) return;
    setPicked(opt);
    onGrade(opt === drill.answer);
  };
  return (
    <div>
      <div className="small" style={{ margin: "8px 0 4px" }}><b>{drill.prompt}</b></div>
      <div>
        {(drill.options ?? []).map((o) => {
          const cls = picked ? (o === drill.answer ? "opt right" : o === picked ? "opt wrong" : "opt") : "opt";
          return <button className={cls} key={o} disabled={!!picked} onClick={() => choose(o)}>{o}</button>;
        })}
      </div>
      {picked && <div className="why">{picked === drill.answer ? "✓ " : "✗ "}{drill.why}</div>}
    </div>
  );
}

// ---------- view 4: reading ----------
function Reading() {
  const r = mk.readers[0];
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  if (!r) return <section className="view"><h2>Reading</h2><p className="lead">No readers yet.</p></section>;
  return (
    <section className="view">
      <h2>Reading — {r.title} <span className="muted small">· {r.titleGloss}</span></h2>
      <p className="lead">Read each line aloud; tap a line to reveal its meaning, 🔊 to hear it.</p>
      <div>
        {r.body.map((l, i) => (
          <div className="rline" key={i} onClick={() => setRevealed((s) => ({ ...s, [i]: !s[i] }))}>
            <button className="spk" onClick={(e) => { e.stopPropagation(); play(l.text, 0.85); }}>🔊</button>
            <span className="rmk">{l.text}</span>
            {revealed[i] && <div className="rg">{l.gloss}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- interleaved session (mixes review / speak / grammar / read / write / glyph) ----------
function Session({ progress, persist, config, onNavigate }: {
  progress: Progress;
  persist: (p: Progress) => void;
  config: api.Config | null;
  onNavigate: (view: View, scenarioId?: string) => void;
}) {
  const plan = useMemo(() => {
    const now = new Date();
    const dueReviewIds = reviewPool.filter((it) => { const st = progress.reviews[it.id]; return !st || new Date(st.due) <= now; }).map((it) => it.id);
    const unknownGlyphs = focusLetters().filter((a) => !progress.letters[a.glyph]).map((a) => a.glyph);
    const completedScenarioIds = mk.scenarios
      .filter((s) => { const p = progress.scenarios[s.id]; return !!p && s.successCriteria.every((c) => p.metCriteria.includes(c.id)); })
      .map((s) => s.id);
    return session.buildSession({ dueReviewIds, lettersDone: unknownGlyphs.length === 0, unknownGlyphs, completedScenarioIds }, mk, { size: 8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [idx, setIdx] = useState(0);
  const next = () => setIdx((i) => i + 1);

  if (plan.activities.length === 0)
    return <section className="view"><h2>Session</h2><p className="lead">Nothing to practice right now — you're caught up. 🎉 Add items via a scenario or grammar drill.</p></section>;
  if (idx >= plan.activities.length)
    return <section className="view"><h2>Session complete 🎉</h2><p className="lead">{plan.activities.length} activities done — nicely interleaved. Come back later for more.</p><button className="btn" onClick={() => setIdx(0)}>Go again</button></section>;

  const act = plan.activities[idx]!;
  return (
    <section className="view">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>Session <span className="muted small">· {idx + 1}/{plan.activities.length} · ~{plan.estMinutes} min</span></h2>
        <button className="ghost small" onClick={next}>Skip →</button>
      </div>
      <p className="lead muted small">Interleaved practice — a mix of review, speaking, grammar, reading and writing rather than one block at a time.</p>
      <SessionStep key={idx} act={act} progress={progress} persist={persist} config={config} onDone={next} onNavigate={onNavigate} />
    </section>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return <div className="muted small" style={{ marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{children}</div>;
}
function AutoSkip({ onDone }: { onDone: () => void }) {
  useEffect(() => { onDone(); }, [onDone]);
  return null;
}

function SessionStep({ act, progress, persist, config, onDone, onNavigate }: {
  act: session.Activity;
  progress: Progress;
  persist: (p: Progress) => void;
  config: api.Config | null;
  onDone: () => void;
  onNavigate: (view: View, scenarioId?: string) => void;
}) {
  const gradeReview = (item: ReviewItem, ok: boolean) => {
    const st = progress.reviews[item.id] ?? srs.initState("local", item.id);
    persist({ ...progress, reviews: { ...progress.reviews, [item.id]: srs.schedule(st, ok ? "good" : "again") } });
    onDone();
  };

  switch (act.kind) {
    case "review": {
      const item = reviewPool.find((i) => i.id === act.ref);
      if (!item) return <AutoSkip onDone={onDone} />;
      return <div><Tag>Review</Tag>{item.kind === "grammar"
        ? <GrammarCard item={item} onGrade={(ok) => gradeReview(item, ok)} />
        : <PhraseCard item={item} onGrade={(ok) => gradeReview(item, ok)} />}</div>;
    }
    case "grammar": {
      const concept = mk.grammar.find((c) => c.id === act.ref);
      const drill = concept?.drills[0];
      if (!drill) return <AutoSkip onDone={onDone} />;
      return <div><Tag>Grammar · {concept!.name}</Tag><GrammarCard item={drill} onGrade={(ok) => gradeReview(drill, ok)} /></div>;
    }
    case "glyph": {
      const g = mk.alphabet.find((a) => a.glyph === act.ref);
      if (!g) return <AutoSkip onDone={onDone} />;
      return (
        <div><Tag>Letter</Tag>
          <div className="fb">
            <div className="target">{g.glyph}</div>
            <div className="translit">{g.name} · {g.sound}</div>
            <div className="ex" style={{ marginTop: 4 }}>{g.examples[0]?.text} <span className="muted small">· {g.examples[0]?.gloss}</span></div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="ghost" onClick={() => g.examples[0] && play(g.examples[0].text, 0.7)}>🔊 hear</button>
              <button className="btn" onClick={() => { persist({ ...progress, letters: { ...progress.letters, [g.glyph]: true } }); onDone(); }}>Got it →</button>
            </div>
          </div>
        </div>
      );
    }
    case "reading": {
      const r = mk.readers.find((x) => x.id === act.ref);
      const line = r?.body[0];
      if (!line) return <AutoSkip onDone={onDone} />;
      return <div><Tag>Reading · {r!.title}</Tag><ReadingLine line={line} onDone={onDone} /></div>;
    }
    case "writing": {
      const task = (mk.writingTasks ?? []).find((t) => t.id === act.ref);
      if (!task) return <AutoSkip onDone={onDone} />;
      return <div><Tag>Writing</Tag><InlineWriting task={task} config={config} onDone={onDone} /></div>;
    }
    case "scenario": {
      const s = mk.scenarios.find((x) => x.id === act.ref);
      if (!s) return <AutoSkip onDone={onDone} />;
      return (
        <div><Tag>Speaking</Tag>
          <div className="fb">
            <div className="line"><b>{s.title}</b> — {s.goal}</div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn" onClick={() => onNavigate("scenario", s.id)}>Practice in Scenarios →</button>
              <button className="ghost" onClick={onDone}>Skip →</button>
            </div>
          </div>
        </div>
      );
    }
    default:
      return <AutoSkip onDone={onDone} />;
  }
}

function ReadingLine({ line, onDone }: { line: DialogueTurn; onDone: () => void }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="fb">
      <div className="row"><button className="spk" onClick={() => play(line.text, 0.85)}>🔊</button><span className="rmk">{line.text}</span></div>
      {revealed ? <div className="rg">{line.gloss}</div> : <button className="ghost" style={{ marginTop: 8 }} onClick={() => setRevealed(true)}>Reveal meaning</button>}
      <div className="row" style={{ marginTop: 10 }}><button className="btn" onClick={onDone}>Next →</button></div>
    </div>
  );
}

function InlineWriting({ task, config, onDone }: { task: { id: string; prompt: string }; config: api.Config | null; onDone: () => void }) {
  const [text, setText] = useState("");
  const [spin, setSpin] = useState(false);
  const [result, setResult] = useState<api.WriteResponse | null>(null);
  const [err, setErr] = useState("");
  const submit = async () => {
    if (!text.trim()) return;
    setErr("");
    setSpin(true);
    try {
      const r = await api.writeCorrect(text, task.id);
      if (r.error) throw new Error(r.error);
      setResult(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSpin(false);
    }
  };
  return (
    <div className="fb">
      <div className="line"><b>Task:</b> {task.prompt}</div>
      <textarea className="text" style={{ width: "100%", minHeight: 60 }} placeholder="Write in Macedonian…" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn" onClick={submit} disabled={spin || !config?.engines.anthropic}>{spin ? "Checking…" : "Check"}</button>
        <button className="ghost" onClick={onDone}>Next →</button>
      </div>
      {err && <div className="err">{err}</div>}
      {result && (
        <div className="line" style={{ marginTop: 8 }}>
          {result.isCorrect ? "✓ " : ""}{result.overall}
          {!result.isCorrect && <> <span className="muted">→</span> <span className="target" style={{ fontSize: 16 }}>{result.corrected}</span></>}
        </div>
      )}
    </div>
  );
}

// ---------- view 6: writing (prompted production + correction-why) ----------
function Writing({ config }: { config: api.Config | null }) {
  const tasks = mk.writingTasks ?? [];
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? "");
  const [text, setText] = useState("");
  const [spin, setSpin] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<api.WriteResponse | null>(null);
  const task = tasks.find((t) => t.id === taskId);

  const submit = async () => {
    if (!text.trim() || !task) return;
    setErr("");
    setResult(null);
    setSpin(true);
    try {
      const r = await api.writeCorrect(text, task.id);
      if (r.error) throw new Error(r.error);
      setResult(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSpin(false);
    }
  };

  return (
    <section className="view">
      <h2>Writing</h2>
      <p className="lead">Short production with correction that explains <i>why</i>. Pick a task, write it in Macedonian, and submit.</p>
      <div className="picker">
        {tasks.map((t) => (
          <button key={t.id} className={t.id === taskId ? "active" : ""} onClick={() => { setTaskId(t.id); setText(""); setResult(null); }}>{t.prompt}</button>
        ))}
      </div>
      {task && <p className="lead"><b>Task:</b> {task.prompt}</p>}
      <textarea
        className="text"
        style={{ width: "100%", minHeight: 70 }}
        placeholder="Write in Macedonian…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn" onClick={submit} disabled={spin || !config?.engines.anthropic}>{spin ? "Checking…" : "Check my writing"}</button>
        {!config?.engines.anthropic && <span className="muted small">Claude not configured</span>}
      </div>
      {err && <div className="err">{err}</div>}
      {result && (
        <div className="fb">
          <div className="line">{result.isCorrect ? "✓ " : ""}{result.overall}</div>
          {!result.isCorrect && (
            <div className="line"><span className="muted">Corrected:</span> <span className="target" style={{ fontSize: 18 }}>{result.corrected}</span></div>
          )}
          {result.issues.map((it, i) => (
            <div className="line" key={i}>
              <span className="pill wrong">{it.original}</span> → <span className="pill correct">{it.fix}</span>
              <div className="why">{it.why}</div>
            </div>
          ))}
          <div className="line muted">{result.encouragement}</div>
          <div className="meta">Claude {result.ms}ms · ~${result.costUsd}</div>
        </div>
      )}
    </section>
  );
}

// ---------- view 5: review (unified SRS over phrases + grammar) ----------
function Review({ progress, persist }: { progress: Progress; persist: (p: Progress) => void }) {
  const queue = useMemo(() => {
    const now = new Date();
    return reviewPool.filter((it) => {
      const st = progress.reviews[it.id];
      return !st || new Date(st.due) <= now;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [idx, setIdx] = useState(0);

  const grade = (item: ReviewItem, ok: boolean) => {
    const st = progress.reviews[item.id] ?? srs.initState("local", item.id);
    const next = srs.schedule(st, ok ? "good" : "again");
    persist({ ...progress, reviews: { ...progress.reviews, [item.id]: next } });
    setIdx((i) => i + 1);
  };

  if (queue.length === 0)
    return <section className="view"><h2>Review</h2><p className="lead">Nothing due — you're caught up. Do a scenario or a grammar drill to add items.</p></section>;
  if (idx >= queue.length)
    return <section className="view"><h2>Review</h2><p className="lead">Done — {queue.length} reviewed. 🎉</p></section>;

  const it = queue[idx]!;
  return (
    <section className="view">
      <h2>Review <span className="muted small">· {queue.length - idx} left</span></h2>
      <p className="lead">Recall before you reveal.</p>
      {it.kind === "grammar" ? (
        <GrammarCard key={it.id} item={it} onGrade={(ok) => grade(it, ok)} />
      ) : (
        <PhraseCard key={it.id} item={it} onGrade={(ok) => grade(it, ok)} />
      )}
    </section>
  );
}

function PhraseCard({ item, onGrade }: { item: ReviewItem; onGrade: (ok: boolean) => void }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="fb">
      <div className="muted small">Say in Macedonian:</div>
      <div style={{ fontSize: 20, margin: "6px 0" }}>{item.gloss}</div>
      {!revealed ? (
        <button className="btn" onClick={() => setRevealed(true)}>Reveal</button>
      ) : (
        <div>
          <div className="target" style={{ fontSize: 22 }}>{item.answer}</div>
          <div className="translit">{item.translit}</div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="ghost" onClick={() => play(item.answer, 0.8)}>🔊 hear</button>
            <button className="ghost" onClick={() => onGrade(false)}>Again</button>
            <button className="btn" onClick={() => onGrade(true)}>Good</button>
          </div>
        </div>
      )}
    </div>
  );
}

function GrammarCard({ item, onGrade }: { item: ReviewItem; onGrade: (ok: boolean) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const choose = (opt: string) => {
    if (picked) return;
    setPicked(opt);
  };
  const concept = (item.meta?.concept as string) || "";
  return (
    <div className="fb">
      <div className="muted small">{concept}</div>
      <div style={{ fontSize: 18, margin: "6px 0" }}><b>{item.prompt}</b></div>
      <div>
        {(item.options ?? []).map((o) => {
          const cls = picked ? (o === item.answer ? "opt right" : o === picked ? "opt wrong" : "opt") : "opt";
          return <button className={cls} key={o} disabled={!!picked} onClick={() => choose(o)}>{o}</button>;
        })}
      </div>
      {picked && (
        <div className="why">
          {picked === item.answer ? "✓ " : "✗ "}{item.why}
          <button className="btn" style={{ marginLeft: 8 }} onClick={() => onGrade(picked === item.answer)}>Next →</button>
        </div>
      )}
    </div>
  );
}
