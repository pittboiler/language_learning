"use client";
// Phase 0-1 UI ported from spike/public/index.html into React, on @ll/core + the ACTIVE language pack.
// The pack is selected by id from the registry (progress.activePackId) and flows through context — the
// UI reads the active pack, never a hardcoded language import. Pure engines (scenario/srs/leveling) run
// client-side; paid calls (tts/asr/feedback/chat) hit the server route handlers that hold the keys.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DialogueTurn, LanguagePack, MiniStory, ReviewItem, Scenario } from "@ll/pack-schema";
import * as scenario from "@ll/core/scenario";
import * as familiarity from "@ll/core/familiarity";
import * as scoring from "@ll/core/familiarity/scoring";
import * as leveling from "@ll/core/leveling";
import * as session from "@ll/core/session";
import { makeRecorder } from "../lib/recorder";
import * as api from "../lib/api";
import { getPack, DEFAULT_PACK_ID, packList } from "../lib/packs";
import { getStore, emptyProgress, type Progress } from "../lib/store";

type View = "session" | "letters" | "scenario" | "grammar" | "reading" | "story" | "review" | "write";

// The active pack flows through context so every view reads the same selected language.
const PackContext = createContext<LanguagePack>(getPack(DEFAULT_PACK_ID));
const usePack = () => useContext(PackContext);
/** Play TTS in the active pack's voice. Stable across renders (keyed on pack id). */
function usePlay() {
  const pack = usePack();
  return useCallback((text: string, speed = 1) => api.playTts(text, speed, pack.id).catch(() => {}), [pack.id]);
}

// Cosmetic flag per pack id (app-level only — not pack data).
const FLAG: Record<string, string> = { mk: "🇲🇰", bg: "🇧🇬" };

// The script's focus glyphs (unique + false-friends) for any pack.
const focusLetters = (pack: LanguagePack) => pack.alphabet.filter((a) => a.unique || a.falseFriend);

// The SRS review pool for a pack: vocab phrases + grammar drills (tagged with their concept name).
const reviewPool = (pack: LanguagePack): ReviewItem[] => [
  ...pack.vocab,
  ...pack.grammar.flatMap((c) => c.drills.map((d) => ({ ...d, meta: { ...d.meta, concept: c.name } }))),
];

// A pack whose scenarios are all machine-generated + not yet native-reviewed (e.g. Bulgarian). The
// design rule is "never serve unreviewed content as authoritative" — so we surface it in the UI.
const packUnreviewed = (pack: LanguagePack) => pack.scenarios.length > 0 && pack.scenarios.every((s) => s.confidence === "unreviewed");

// ---- familiarity helpers — unify vocab state + SRS in one store keyed by lexKey ----
// new (no entry) ⇒ due; known (no SRS card) ⇒ not due; else the SRS due date governs.
const isDue = (p: Progress, item: ReviewItem, now: Date): boolean => {
  const e = p.familiarity[familiarity.deriveKeyForItem(item).lexKey];
  return !e ? true : e.srs ? new Date(e.srs.due) <= now : false;
};
// Grade a review item → next Progress with its familiarity entry rescheduled via the same FSRS engine.
const gradeItem = (p: Progress, item: ReviewItem, ok: boolean): Progress => {
  const spec = familiarity.deriveKeyForItem(item);
  const entry = p.familiarity[spec.lexKey] ?? familiarity.capture(spec);
  return { ...p, familiarity: { ...p.familiarity, [spec.lexKey]: familiarity.grade(entry, ok ? "good" : "again") } };
};
// Visual familiarity status of a reader word (drives the colored tokens).
const wordStatus = (p: Progress, lexKey: string): string => {
  const e = p.familiarity[lexKey];
  return !e ? "new" : e.status === "known" ? "known" : e.status === "ignored" ? "ignored" : "learning";
};
// Capture a tapped word into familiarity + SRS if it's new. Returns its lexKey ("" if not a word).
const captureWord = (progress: Progress, persist: (p: Progress) => void, surface: string): string => {
  const lexKey = familiarity.normalize(surface);
  if (lexKey && !progress.familiarity[lexKey]) {
    persist({ ...progress, familiarity: { ...progress.familiarity, [lexKey]: familiarity.capture({ lexKey, kind: "word", display: surface }) } });
  }
  return lexKey;
};

export default function Home() {
  const store = useMemo(() => getStore(), []);
  const [progress, setProgress] = useState<Progress>(emptyProgress());
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<api.Config | null>(null);
  const [view, setView] = useState<View>("letters");
  const pack = useMemo(() => getPack(progress.activePackId), [progress.activePackId]);

  useEffect(() => {
    (async () => {
      const p = await store.load();
      const loadedPack = getPack(p.activePackId);
      // One-time: migrate legacy reviews (itemId→FSRS) into the lexKey-keyed familiarity store.
      if (p.reviews && Object.keys(p.reviews).length && !Object.keys(p.familiarity).length) {
        p.familiarity = familiarity.migrateReviews(p.reviews, reviewPool(loadedPack));
        delete p.reviews;
      }
      if (!p.pick) p.pick = loadedPack.scenarios[0]!.id;
      setProgress(p);
      setReady(true);
      setView(focusLetters(loadedPack).every((a) => p.letters[a.glyph]) ? "session" : "letters");
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
  const lettersDone = focusLetters(pack).every((a) => progress.letters[a.glyph]);
  const dueCount = useMemo(() => {
    const now = new Date();
    return reviewPool(pack).filter((it) => isDue(progress, it, now)).length;
  }, [progress, pack]);

  const level = useMemo(() => {
    const glyphsKnown = focusLetters(pack).filter((a) => progress.letters[a.glyph]).length;
    const criteriaMet = Object.values(progress.scenarios).reduce((n, s) => n + s.metCriteria.length, 0);
    const reviewStrength = Object.keys(progress.familiarity).length;
    return leveling.currentLevel({ glyphsKnown, glyphsTotal: focusLetters(pack).length, criteriaMet, reviewStrength });
  }, [progress, pack]);

  const nextUp = useMemo(() => {
    if (!lettersDone) return "learn the focus letters";
    const inc = pack.scenarios.find((s) => {
      const p = progress.scenarios[s.id];
      return !p || s.successCriteria.some((c) => !p.metCriteria.includes(c.id));
    });
    if (inc) return `do "${inc.title}"`;
    return dueCount ? `review ${dueCount} due` : "read or free-chat";
  }, [lettersDone, progress.scenarios, dueCount, pack]);

  // Compounding vocabulary metrics (known/learning counts) — motivational + drive content selection.
  const vocab = useMemo(() => scoring.computeMetrics(progress.familiarity), [progress.familiarity]);

  if (!ready) return <main style={{ padding: 24 }}>Loading…</main>;

  const badge = (l: string, on?: boolean) => <span className={`badge ${on ? "on" : "off"}`} key={l}>{l} {on ? "✓" : "✗"}</span>;

  return (
    <PackContext.Provider value={pack}>
      <header>
        <h1>{FLAG[pack.id] ?? "🌐"} {pack.name}</h1>
        {packList().length > 1 && (
          <select
            className="lang-picker"
            aria-label="Language"
            value={pack.id}
            onChange={(e) => persist({ ...progress, activePackId: e.target.value, pick: null })}
          >
            {packList().map((p) => (
              <option key={p.id} value={p.id}>{(FLAG[p.id] ?? "🌐") + " " + p.name}</option>
            ))}
          </select>
        )}
        <span className="muted small">Level {level.cefrBand} · {vocab.knownWordCount} known · {vocab.learningCount} learning · Next: {nextUp}</span>
        <div className="badges">
          {packUnreviewed(pack) && <span className="badge warn" title="Machine-generated content, pending native review — not yet authoritative">⚠ unreviewed</span>}
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
          ["story", "★ Story"],
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
        {view === "reading" && <Reading progress={progress} persist={persist} config={config} />}
        {view === "story" && <StoryView progress={progress} persist={persist} config={config} />}
        {view === "review" && <Review progress={progress} persist={persist} />}
        {view === "write" && <Writing config={config} />}
      </main>
    </PackContext.Provider>
  );
}

// ---------- view 1: letters ----------
function Letters({ progress, persist, onDone }: { progress: Progress; persist: (p: Progress) => void; onDone: () => void }) {
  const pack = usePack();
  const play = usePlay();
  const toggle = (glyph: string) => persist({ ...progress, letters: { ...progress.letters, [glyph]: !progress.letters[glyph] } });
  const f = focusLetters(pack);
  const known = f.filter((a) => progress.letters[a.glyph]).length;
  return (
    <section className="view">
      <h2>The {pack.name} alphabet — {pack.alphabet.length} letters</h2>
      <p className="lead">
        Spelling is phonetic: one letter, one sound. Focus on the <span style={{ color: "var(--ok)" }}>unique</span> letters and
        the <span style={{ color: "var(--warn)" }}>false friends</span> that look Latin but sound different. Tap 🔊 to hear any example.
      </p>
      <div className="letters">
        {pack.alphabet.map((a) => {
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
  const pack = usePack();
  const s = pack.scenarios.find((x) => x.id === progress.pick) || pack.scenarios[0]!;
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
        {pack.scenarios.map((x) => (
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
  const play = usePlay();
  useEffect(() => {
    play(turn.text, 0.85);
  }, [turn.text, play]);
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
  const pack = usePack();
  const play = usePlay();
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
      <div className="done-card"><h2>🎉 Done</h2><p className="lead">Now keep the conversation going — say anything.</p></div>
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
  const pack = usePack();
  const grade = (item: ReviewItem, correct: boolean) => persist(gradeItem(progress, item, correct));
  return (
    <section className="view">
      <h2>Grammar that matters</h2>
      <p className="lead">We drill the grammar features that actually matter for {pack.name} — not a generic template. Answer a drill and it enters your spaced review.</p>
      {pack.grammar.map((c) => (
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

// ---------- view 4: reading (tap-to-capture) ----------
function Reading({ progress, persist, config }: { progress: Progress; persist: (p: Progress) => void; config: api.Config | null }) {
  const pack = usePack();
  const play = usePlay();
  const r = pack.readers[0];
  const [sel, setSel] = useState<{ lexKey: string; surface: string; line: string } | null>(null);
  if (!r) return <section className="view"><h2>Reading</h2><p className="lead">No readers yet.</p></section>;

  // Tap a word → capture it into familiarity + SRS (if new), then open the look-up panel.
  const onTap = (surface: string, line: string) => {
    const lexKey = captureWord(progress, persist, surface);
    if (lexKey) setSel({ lexKey, surface, line });
  };

  return (
    <section className="view">
      <h2>Reading — {r.title} <span className="muted small">· {r.titleGloss}</span></h2>
      <p className="lead">
        Tap any word to look it up — it joins your vocabulary + spaced review.{" "}
        <span className="tok new">new</span> <span className="tok learning">learning</span> <span className="tok known">known</span>
      </p>
      <div className="reader">
        {r.body.map((l, i) => (
          <div className="rline2" key={i}>
            <button className="spk" onClick={() => play(l.text, 0.85)}>🔊</button>
            <TappableText text={l.text} progress={progress} onTapWord={(s) => onTap(s, l.text)} />
          </div>
        ))}
      </div>
      {sel && <WordPanel key={sel.lexKey} sel={sel} progress={progress} persist={persist} config={config} onClose={() => setSel(null)} />}
    </section>
  );
}

function WordToken({ surface, status, onTap }: { surface: string; status: string; onTap: () => void }) {
  return <span className={`tok ${status}`} onClick={onTap}>{surface}</span>;
}

// Renders a line as tappable, status-colored word tokens. Shared by the reader + the story player.
function TappableText({ text, progress, onTapWord }: { text: string; progress: Progress; onTapWord: (surface: string) => void }) {
  return (
    <span className="rtext">
      {scoring.tokenize(text).map((t, j) =>
        t.isWord ? (
          <WordToken key={j} surface={t.surface} status={wordStatus(progress, t.lexKey)} onTap={() => onTapWord(t.surface)} />
        ) : (
          <span key={j}>{t.surface}</span>
        ),
      )}
    </span>
  );
}

function WordPanel({ sel, progress, persist, config, onClose }: {
  sel: { lexKey: string; surface: string; line: string };
  progress: Progress;
  persist: (p: Progress) => void;
  config: api.Config | null;
  onClose: () => void;
}) {
  const pack = usePack();
  const play = usePlay();
  const [g, setG] = useState<api.GlossResponse | null>(null);
  const [spin, setSpin] = useState(false);
  useEffect(() => {
    let live = true;
    setG(null);
    setSpin(true);
    api.gloss(sel.surface, sel.line, pack.id).then((r) => { if (live) setG(r); }).catch(() => {}).finally(() => { if (live) setSpin(false); });
    return () => { live = false; };
  }, [sel.surface, sel.line, pack.id]);

  const entry = progress.familiarity[sel.lexKey];
  const setStat = (status: "known" | "ignored") => {
    const e = entry ?? familiarity.capture({ lexKey: sel.lexKey, kind: "word", display: sel.surface });
    persist({ ...progress, familiarity: { ...progress.familiarity, [sel.lexKey]: familiarity.setStatus(e, status) } });
    onClose();
  };

  return (
    <div className="wordpanel">
      <div className="row">
        <b className="target" style={{ fontSize: 20 }}>{sel.surface}</b>
        <button className="spk" onClick={() => play(sel.surface, 0.8)}>🔊</button>
        <button className="ghost small" style={{ marginLeft: "auto" }} onClick={onClose}>✕</button>
      </div>
      {spin ? (
        <div className="spin">Looking up…</div>
      ) : g?.gloss ? (
        <div style={{ marginTop: 4 }}>
          {g.translit && <span className="translit">{g.translit} · </span>}
          <span style={{ fontSize: 16 }}>{g.gloss}</span>
          <span className="muted small"> ({g.source})</span>
        </div>
      ) : (
        <div className="muted small" style={{ marginTop: 4 }}>{config?.engines.anthropic ? "No gloss found." : "Gloss needs Claude configured."}</div>
      )}
      <div className="row" style={{ marginTop: 10 }}>
        <button className="ghost" onClick={() => setStat("known")}>✓ Known</button>
        <button className="ghost" onClick={() => setStat("ignored")}>✕ Ignore</button>
        <span className="muted small">{entry ? `tracked · ${entry.status}` : "captured"}</span>
      </div>
    </div>
  );
}

// ---------- story tab: mini-story (synced audio + tap-capture + Q&A → speaking pipeline) ----------
function StoryView({ progress, persist, config }: { progress: Progress; persist: (p: Progress) => void; config: api.Config | null }) {
  const pack = usePack();
  const play = usePlay();
  const story = pack.stories?.[0];
  const [phase, setPhase] = useState<"read" | "qa">("read");
  const [sel, setSel] = useState<{ lexKey: string; surface: string; line: string } | null>(null);
  const [current, setCurrent] = useState(-1);
  const [slow, setSlow] = useState(false);
  const playing = useRef(false);

  if (!story) return <section className="view"><h2>Story</h2><p className="lead">No stories yet for this pack.</p></section>;
  const speed = slow ? 0.7 : 0.9;

  const onTap = (surface: string, line: string) => {
    const lexKey = captureWord(progress, persist, surface);
    if (lexKey) setSel({ lexKey, surface, line });
  };

  // Play segments in sequence, highlighting the current line (toggle = stop).
  const playAll = async () => {
    if (playing.current) { playing.current = false; setCurrent(-1); return; }
    playing.current = true;
    for (let i = 0; i < story.body.length; i++) {
      if (!playing.current) break;
      setCurrent(i);
      try { await api.playClip(story.body[i]!.text, speed, pack.id); } catch { break; }
    }
    playing.current = false;
    setCurrent(-1);
  };

  // Reading the story seeds its vocab into familiarity → moves the known-word count.
  const toQA = () => {
    const fam = { ...progress.familiarity };
    for (const v of story.registersVocab) {
      if (!fam[v.lexKey]) fam[v.lexKey] = familiarity.capture({ lexKey: v.lexKey, kind: v.lexKey.includes(" ") ? "chunk" : "word", display: v.lexKey, gloss: v.gloss });
    }
    persist({ ...progress, familiarity: fam });
    setPhase("qa");
  };

  return (
    <section className="view">
      <h2>★ {story.title} <span className="muted small">· {story.titleGloss}</span></h2>
      {story.audioSource === "tts" && <p className="muted small">audio: synthesized (TTS) — a native recording is pending.</p>}
      {phase === "read" ? (
        <>
          <p className="lead">Listen and read along; tap any word to look it up. Then answer the questions.</p>
          <div className="row" style={{ marginBottom: 8 }}>
            <button className="btn" onClick={playAll}>{current >= 0 ? "⏹ Stop" : "▶ Play story"}</button>
            <button className="ghost" onClick={() => setSlow((s) => !s)}>{slow ? "🐢 Slow" : "▶︎ Normal"}</button>
            <span className="muted small">🐢 shadow each line: listen, then say it back.</span>
          </div>
          <div className="reader">
            {story.body.map((l, i) => (
              <div className={`rline2 ${current === i ? "playing" : ""}`} key={i}>
                <button className="spk" onClick={() => play(l.text, speed)}>🔊</button>
                <TappableText text={l.text} progress={progress} onTapWord={(s) => onTap(s, l.text)} />
              </div>
            ))}
          </div>
          {sel && <WordPanel key={sel.lexKey} sel={sel} progress={progress} persist={persist} config={config} onClose={() => setSel(null)} />}
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn" onClick={toQA}>I read it → questions <span className="muted small">(+{story.registersVocab.length} words)</span></button>
          </div>
        </>
      ) : (
        <StoryQAView story={story} config={config} onRestart={() => setPhase("read")} />
      )}
    </section>
  );
}

function StoryQAView({ story, config, onRestart }: { story: MiniStory; config: api.Config | null; onRestart: () => void }) {
  const play = usePlay();
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  return (
    <div>
      <p className="lead">Questions — the story's words again, in a new frame. The last one is spoken.</p>
      {story.qa.map((q) => (
        <div className="fb" key={q.id}>
          <div className="row"><button className="spk" onClick={() => play(q.question, 0.9)}>🔊</button><b>{q.question}</b></div>
          <div className="gloss">{q.questionGloss}</div>
          {q.spokenPrompt ? (
            <div style={{ marginTop: 8 }}>
              <div className="muted small">Answer aloud — say:</div>
              <LearnerTurn turn={{ speaker: "learner", text: q.answer, translit: q.answerTranslit, gloss: q.answerGloss }} config={config} onDone={() => {}} />
            </div>
          ) : revealed[q.id] ? (
            <div style={{ marginTop: 6 }}><span className="target">{q.answer}</span> <span className="muted small">· {q.answerGloss}</span></div>
          ) : (
            <button className="ghost" style={{ marginTop: 8 }} onClick={() => setRevealed((s) => ({ ...s, [q.id]: true }))}>Reveal answer</button>
          )}
        </div>
      ))}
      <div className="row" style={{ marginTop: 12 }}><button className="ghost" onClick={onRestart}>↺ Read again</button></div>
    </div>
  );
}

// ---------- interleaved session (mixes review / speak / grammar / read / write / glyph) ----------
function Session({ progress, persist, config, onNavigate }: {
  progress: Progress;
  persist: (p: Progress) => void;
  config: api.Config | null;
  onNavigate: (view: View, scenarioId?: string) => void;
}) {
  const pack = usePack();
  const plan = useMemo(() => {
    const now = new Date();
    const dueReviewIds = reviewPool(pack).filter((it) => isDue(progress, it, now)).map((it) => it.id);
    const unknownGlyphs = focusLetters(pack).filter((a) => !progress.letters[a.glyph]).map((a) => a.glyph);
    const completedScenarioIds = pack.scenarios
      .filter((s) => { const p = progress.scenarios[s.id]; return !!p && s.successCriteria.every((c) => p.metCriteria.includes(c.id)); })
      .map((s) => s.id);
    return session.buildSession({ dueReviewIds, lettersDone: unknownGlyphs.length === 0, unknownGlyphs, completedScenarioIds }, pack, { size: 8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack]);
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
  const pack = usePack();
  const play = usePlay();
  const gradeReview = (item: ReviewItem, ok: boolean) => {
    persist(gradeItem(progress, item, ok));
    onDone();
  };

  switch (act.kind) {
    case "review": {
      const item = reviewPool(pack).find((i) => i.id === act.ref);
      if (!item) return <AutoSkip onDone={onDone} />;
      return <div><Tag>Review</Tag>{item.kind === "grammar"
        ? <GrammarCard item={item} onGrade={(ok) => gradeReview(item, ok)} />
        : <PhraseCard item={item} onGrade={(ok) => gradeReview(item, ok)} />}</div>;
    }
    case "grammar": {
      const concept = pack.grammar.find((c) => c.id === act.ref);
      const drill = concept?.drills[0];
      if (!drill) return <AutoSkip onDone={onDone} />;
      return <div><Tag>Grammar · {concept!.name}</Tag><GrammarCard item={drill} onGrade={(ok) => gradeReview(drill, ok)} /></div>;
    }
    case "glyph": {
      const g = pack.alphabet.find((a) => a.glyph === act.ref);
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
      const r = pack.readers.find((x) => x.id === act.ref);
      const line = r?.body[0];
      if (!line) return <AutoSkip onDone={onDone} />;
      return <div><Tag>Reading · {r!.title}</Tag><ReadingLine line={line} onDone={onDone} /></div>;
    }
    case "writing": {
      const task = (pack.writingTasks ?? []).find((t) => t.id === act.ref);
      if (!task) return <AutoSkip onDone={onDone} />;
      return <div><Tag>Writing</Tag><InlineWriting task={task} config={config} onDone={onDone} /></div>;
    }
    case "scenario": {
      const s = pack.scenarios.find((x) => x.id === act.ref);
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
  const play = usePlay();
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
  const pack = usePack();
  const [text, setText] = useState("");
  const [spin, setSpin] = useState(false);
  const [result, setResult] = useState<api.WriteResponse | null>(null);
  const [err, setErr] = useState("");
  const submit = async () => {
    if (!text.trim()) return;
    setErr("");
    setSpin(true);
    try {
      const r = await api.writeCorrect(text, task.id, pack.id);
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
      <textarea className="text" style={{ width: "100%", minHeight: 60 }} placeholder={`Write in ${pack.name}…`} value={text} onChange={(e) => setText(e.target.value)} />
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
  const pack = usePack();
  const tasks = pack.writingTasks ?? [];
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
      const r = await api.writeCorrect(text, task.id, pack.id);
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
      <p className="lead">Short production with correction that explains <i>why</i>. Pick a task, write it in {pack.name}, and submit.</p>
      <div className="picker">
        {tasks.map((t) => (
          <button key={t.id} className={t.id === taskId ? "active" : ""} onClick={() => { setTaskId(t.id); setText(""); setResult(null); }}>{t.prompt}</button>
        ))}
      </div>
      {task && <p className="lead"><b>Task:</b> {task.prompt}</p>}
      <textarea
        className="text"
        style={{ width: "100%", minHeight: 70 }}
        placeholder={`Write in ${pack.name}…`}
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
  const pack = usePack();
  const queue = useMemo(() => {
    const now = new Date();
    return reviewPool(pack).filter((it) => isDue(progress, it, now));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack]);
  const [idx, setIdx] = useState(0);

  const grade = (item: ReviewItem, ok: boolean) => {
    persist(gradeItem(progress, item, ok));
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
  const pack = usePack();
  const play = usePlay();
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="fb">
      <div className="muted small">Say in {pack.name}:</div>
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
