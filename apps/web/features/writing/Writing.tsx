"use client";
import { useEffect, useRef, useState } from "react";
import type { CourseWriting, ReviewItem } from "@ll/pack-schema";
import * as api from "../../lib/api";
import * as cp from "../../lib/course-player";
import { romanize } from "../../lib/romanize";
import { usePack, usePlay } from "../shared";

// The gated Today writing capstone: one unit-scoped prompt (the scenario goal), free production with the
// same tutor correction as the Library Writing — but woven into the daily flow instead of sitting idle.
export function WritingCapstone({ prompt, config, onDone }: { prompt: string; config: api.Config | null; onDone: () => void }) {
  const pack = usePack();
  const [text, setText] = useState("");
  const [spin, setSpin] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<api.WriteResponse | null>(null);
  const submit = async () => {
    if (!text.trim()) return;
    setErr(""); setResult(null); setSpin(true);
    try {
      const r = await api.writeCorrect(text, "", pack.id, prompt);
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
      <p className="lead" style={{ marginTop: 0 }}>You’ve got the words and the grammar — now put it together in your own words. <b>Latin letters are fine.</b></p>
      <p className="lead"><b>Write:</b> {prompt}</p>
      <textarea className="text" style={{ width: "100%", minHeight: 70 }} placeholder={`Write in ${pack.name} — e.g. "sakam kafe, ve molam"`} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn" onClick={submit} disabled={spin || !text.trim() || !config?.engines.anthropic}>{spin ? "Checking\u2026" : "Check my writing"}</button>
        {!config?.engines.anthropic && <span className="muted small">Claude not configured</span>}
      </div>
      {err && <div className="err">{err}</div>}
      {result && (
        <div className="fb" style={{ marginTop: 8 }}>
          <div className="line">{result.isCorrect ? "\u2713 " : ""}{result.overall}</div>
          <div className="line"><span className="muted">{result.isCorrect ? `In ${pack.name}:` : "Corrected:"}</span> <span className="target" style={{ fontSize: 18 }}>{result.corrected}</span>{result.correctedTranslit && <span className="translit"> · {result.correctedTranslit}</span>}</div>
          {result.issues.map((it, i) => (
            <div className="line" key={i}><span className="pill wrong">{it.original}</span> → <span className="pill correct">{it.fix}</span><div className="why">{it.why}</div></div>
          ))}
          <div className="line muted">{result.encouragement}</div>
        </div>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <button className={result ? "btn" : "ghost small"} onClick={onDone}>{result ? "Done \u2192" : "Skip \u2192"}</button>
      </div>
    </div>
  );
}
// The course's writing exercise: a scene, then English lines to write in the target language one at a time —
// nothing to guess. Each line is checked as it's written: on sight when it's the model answer (Latin letters
// or Cyrillic), otherwise by the tutor against the model. The model answer always follows, and misses join the
// session's recap. The last screen lays every line out: what you wrote beside the model.
export type WrittenLine = { wrote: string; ok: boolean; tutor?: api.WriteResponse };
export function WritingLines({ set, config, onMiss, onDone, onFinished, doneLabel }: {
  set: CourseWriting; config: api.Config | null; onMiss?: (item: ReviewItem) => void; onDone: () => void;
  /** Called once when the summary screen appears (the session's last step: the lesson is done there). */
  onFinished?: () => void;
  doneLabel?: string;
}) {
  const pack = usePack();
  const play = usePlay();
  const [i, setI] = useState(0);
  const [text, setText] = useState("");
  const [hint, setHint] = useState(false);
  const [compare, setCompare] = useState(false); // no tutor: the learner compares with the model themselves
  const [spin, setSpin] = useState(false);
  const [err, setErr] = useState("");
  const [results, setResults] = useState<(WrittenLine | undefined)[]>([]);
  const tutorOn = !!config?.engines.anthropic;
  const line = set.lines[i];
  const result = results[i];
  const finished = useRef(false);
  useEffect(() => { if (!line && !finished.current) { finished.current = true; onFinished?.(); } }, [line, onFinished]);
  const record = (r: WrittenLine) => {
    setResults((rs) => { const next = [...rs]; next[i] = r; return next; });
    if (!r.ok && line) onMiss?.({ id: `write-${set.chapterId}-${i}`, kind: "phrase", prompt: line.prompt, answer: line.answer, translit: romanize(line.answer), gloss: line.prompt, i1Level: 0, tags: [] });
  };
  const check = async () => {
    const wrote = text.trim();
    if (!line || !wrote || spin) return;
    if (cp.writtenMatches(wrote, line)) return record({ wrote, ok: true });
    if (!tutorOn) return setCompare(true);
    setErr(""); setSpin(true);
    try {
      const r = await api.writeCorrect(wrote, "", pack.id, `Scene: ${set.scene}\nWrite this line in ${pack.name}: "${line.prompt}"`, line.answer);
      if (r.error) throw new Error(r.error);
      record({ wrote, ok: r.isCorrect, tutor: r });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSpin(false);
    }
  };
  const next = () => { setI(i + 1); setText(""); setHint(false); setCompare(false); setErr(""); };
  const model = (answer: string) => (
    <div className="row" style={{ alignItems: "baseline", gap: 6 }}>
      <button className="spk" onClick={() => play(answer)}>🔊</button>
      <span className="target" style={{ fontSize: 18 }}>{answer}</span>
      <span className="translit"> · {romanize(answer)}</span>
    </div>
  );

  // The last screen: every line, what you wrote and the model.
  if (!line) {
    const right = results.filter((r) => r?.ok).length;
    return (
      <div className="fb">
        <div className="gram-kicker">Your lines</div>
        <p className="lead" style={{ marginTop: 4 }}>{right} of {set.lines.length} right first time. Read the model lines aloud once before you move on.</p>
        {set.lines.map((l, k) => (
          <div className="line" key={k} style={{ margin: "10px 0" }}>
            <div className="muted small">{k + 1}. {l.prompt}</div>
            {results[k]?.wrote && <div className="small">{results[k]!.ok ? "✓" : "✗"} You wrote: {results[k]!.wrote}</div>}
            {model(l.answer)}
          </div>
        ))}
        <div className="row" style={{ marginTop: 12 }}><button className="btn" onClick={onDone}>{doneLabel ?? "Done →"}</button></div>
      </div>
    );
  }

  return (
    <div className="fb">
      {i === 0 && !result && <p className="lead" style={{ marginTop: 0 }}>{set.scene} Write each line in {pack.name}, one at a time — <b>Latin letters are fine</b>.</p>}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <div className="gram-kicker">Line {i + 1} of {set.lines.length}</div>
        {line.hint && !result && !hint && <button className="linklike small" onClick={() => setHint(true)}>Hint</button>}
      </div>
      <p className="lead" style={{ margin: "6px 0" }}><b>{line.prompt}</b></p>
      {hint && !result && <div className="why" style={{ marginBottom: 6 }}>{line.hint}</div>}
      {!result ? (
        <>
          <textarea className="text" style={{ width: "100%", minHeight: 52 }} placeholder={`In ${pack.name} — e.g. "sakam kafe"`} value={text} autoFocus
            onChange={(e) => { setText(e.target.value); setCompare(false); }} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void check(); } }} />
          {err && <div className="err">{err}</div>}
          {compare && (
            <div className="fb" style={{ marginTop: 8 }}>
              <div className="muted small">Compare yours with the model answer:</div>
              {model(line.answer)}
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn small" onClick={() => record({ wrote: text.trim(), ok: true })}>Mine says the same</button>
                <button className="ghost small" onClick={() => record({ wrote: text.trim(), ok: false })}>Not quite</button>
              </div>
            </div>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={check} disabled={spin || !text.trim()}>{spin ? "Checking\u2026" : "Check"}</button>
            <button className="ghost small" onClick={() => record({ wrote: "", ok: false })}>Show me</button>
          </div>
        </>
      ) : (
        <div style={{ marginTop: 4 }}>
          {result.wrote && <div className="small" style={{ marginBottom: 6 }}>You wrote: {result.wrote}</div>}
          {result.ok ? (
            <div className="line"><b>{"\u2713"} {result.tutor?.overall ?? "Right."}</b></div>
          ) : result.tutor ? (
            <>
              <div className="line">{result.tutor.overall}</div>
              {result.tutor.issues.map((it, k) => (
                <div className="line" key={k}><span className="pill wrong">{it.original}</span> {"\u2192"} <span className="pill correct">{it.fix}</span><div className="why">{it.why}</div></div>
              ))}
            </>
          ) : null}
          <div className="muted small" style={{ marginTop: 8 }}>{result.ok && cp.writingKey(result.wrote) !== cp.writingKey(line.answer) ? "The model answer, another way to say it:" : "The model answer:"}</div>
          {model(line.answer)}
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={next}>{i + 1 < set.lines.length ? "Next line \u2192" : "See all your lines \u2192"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
export function Writing({ config }: { config: api.Config | null }) {
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
      <p className="lead">Short production with correction that explains <i>why</i>. Pick a task and write it — <b>typing in Latin letters is fine</b> (e.g. &quot;sakam kafe&quot;); you&apos;ll get it back in {pack.name}.</p>
      <div className="picker">
        {tasks.map((t) => (
          <button key={t.id} className={t.id === taskId ? "active" : ""} onClick={() => { setTaskId(t.id); setText(""); setResult(null); }}>{t.prompt}</button>
        ))}
      </div>
      {task && <p className="lead"><b>Task:</b> {task.prompt}</p>}
      <textarea
        className="text"
        style={{ width: "100%", minHeight: 70 }}
        placeholder={`Write in ${pack.name} — Latin letters are fine, e.g. "sakam kafe"`}
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
          <div className="line">
            <span className="muted">{result.isCorrect ? `In ${pack.name}:` : "Corrected:"}</span>{" "}
            <span className="target" style={{ fontSize: 18 }}>{result.corrected}</span>
            {result.correctedTranslit && <span className="translit"> · {result.correctedTranslit}</span>}
          </div>
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
