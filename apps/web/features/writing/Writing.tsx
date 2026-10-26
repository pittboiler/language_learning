"use client";
import { useEffect, useRef, useState } from "react";
import type { CourseWriting, ReviewItem } from "@ll/pack-schema";
import * as api from "../../lib/api";
import * as cp from "../../lib/course-player";
import { romanize } from "../../lib/romanize";
import { Icon, MixedText, SpeakButton, Stitches, usePack, usePlay } from "../shared";

/** The tutor's correction, shared by every writing screen: the verdict, your line corrected (in the text
 *  face, with romanization), each fix as the original crossed out then the fix and why, and a kind word. */
function Correction({ r, hideCorrected, showMeta }: { r: api.WriteResponse; hideCorrected?: boolean; showMeta?: boolean }) {
  const pack = usePack();
  return (
    <div className={`feedback ${r.isCorrect ? "good" : "fix"}`} role="status">
      <div className="feedback-title"><MixedText text={r.overall} /></div>
      {!hideCorrected && r.corrected && (
        <div>
          <div className="muted small">{r.isCorrect ? `In ${pack.name}` : "Corrected"}</div>
          <div className="model-line"><span className="mk" lang={pack.id}>{r.corrected}</span>{r.correctedTranslit && <span className="translit">{r.correctedTranslit}</span>}</div>
        </div>
      )}
      {r.issues.map((it, i) => (
        <div className="issue" key={i}>
          <span className="was"><MixedText text={it.original} /></span>
          <span aria-label="changed to">→</span>
          <span className="now"><MixedText text={it.fix} /></span>
          {it.why && <span className="why"><MixedText text={it.why} /></span>}
        </div>
      ))}
      {r.encouragement && <div className="heard">{r.encouragement}</div>}
      {showMeta && <details><summary>Details</summary>Checked in {r.ms} ms, about ${r.costUsd}</details>}
    </div>
  );
}
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
    <div className="framed write-card">
      <div className="overline">Write it</div>
      <p style={{ margin: "8px 0 4px", lineHeight: 1.5 }}>You&apos;ve got the words and the grammar: now put it together in your own words. <b>Latin letters are fine.</b></p>
      <div className="card-prompt" style={{ marginBottom: 12 }}><MixedText text={prompt} /></div>
      <textarea className="text" aria-label={`Your writing in ${pack.name}`} placeholder={`Write in ${pack.name}, e.g. "sakam kafe, ve molam"`} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="write-actions">
        <button className="btn" onClick={submit} disabled={spin || !text.trim() || !config?.engines.anthropic}>{spin ? "Checking\u2026" : "Check my writing"}</button>
        {!config?.engines.anthropic && <span className="muted small">Checking isn&apos;t available right now.</span>}
      </div>
      {err && <div className="err">{err}</div>}
      {result && <Correction r={result} />}
      <div className="write-actions">
        <button className={result ? "btn" : "quiet"} onClick={onDone}>{result ? "Done" : "Skip"}</button>
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
    <div className="model-line">
      <SpeakButton label={`Play ${answer}`} onClick={() => play(answer)} />
      <span className="mk" lang={pack.id}>{answer}</span>
      <span className="translit">{romanize(answer)}</span>
    </div>
  );

  // The last screen: every line, what you wrote and the model.
  if (!line) {
    const right = results.filter((r) => r?.ok).length;
    return (
      <div className="framed write-card">
        <div className="overline">Your lines</div>
        <p style={{ margin: "8px 0 4px", lineHeight: 1.5 }}>{right} of {set.lines.length} right first time. Read the model lines aloud once before you move on.</p>
        {set.lines.map((l, k) => (
          <div className="written-row" key={k}>
            <div className="muted small">{k + 1}. {l.prompt}</div>
            {results[k]?.wrote && (
              <div className="small" style={{ marginTop: 2 }}>
                <span className={results[k]!.ok ? "result-ok" : "result-miss"}>{results[k]!.ok && <Icon name="check" size={14} />}You wrote:</span> <MixedText text={results[k]!.wrote} />
              </div>
            )}
            {model(l.answer)}
          </div>
        ))}
        <div className="write-actions"><button className="btn" onClick={onDone}>{(doneLabel ?? "Done").replace(/\s*→$/, "")}</button></div>
      </div>
    );
  }

  return (
    <div>
      {i === 0 && !result && <p className="lead" style={{ marginTop: 0 }}><MixedText text={set.scene} /> Write each line in {pack.name}, one at a time: <b>Latin letters are fine</b>.</p>}
      <div className="framed write-card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="row" style={{ gap: 10 }}>
          <span className="overline">Line {i + 1} of {set.lines.length}</span>
          <Stitches total={set.lines.length} done={i} now={i} size={10} label={`Line ${i + 1} of ${set.lines.length}`} />
        </div>
        {line.hint && !result && !hint && <button className="quiet" onClick={() => setHint(true)}>Hint</button>}
      </div>
      <div className="card-prompt" style={{ marginBottom: 10 }}><MixedText text={line.prompt} /></div>
      {hint && !result && <div className="hint" style={{ marginBottom: 8 }}><MixedText text={line.hint!} /></div>}
      {!result ? (
        <>
          <textarea className="text" aria-label={`Write this line in ${pack.name}`} style={{ minHeight: 56 }} placeholder={`In ${pack.name}, e.g. "sakam kafe"`} value={text} autoFocus
            onChange={(e) => { setText(e.target.value); setCompare(false); }} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void check(); } }} />
          {err && <div className="err">{err}</div>}
          {compare && (
            <div className="feedback fix">
              <div className="muted small">Compare yours with the model answer:</div>
              {model(line.answer)}
              <div className="row" style={{ marginTop: 6 }}>
                <button className="btn small" onClick={() => record({ wrote: text.trim(), ok: true })}>Mine says the same</button>
                <button className="ghost small" onClick={() => record({ wrote: text.trim(), ok: false })}>Not quite</button>
              </div>
            </div>
          )}
          <div className="write-actions">
            <button className="btn" onClick={check} disabled={spin || !text.trim()}>{spin ? "Checking\u2026" : "Check"}</button>
            <button className="quiet" onClick={() => record({ wrote: "", ok: false })}>Show me the answer</button>
          </div>
        </>
      ) : (
        <div style={{ marginTop: 4 }}>
          {result.wrote && <div className="small" style={{ marginBottom: 6 }}>You wrote: <MixedText text={result.wrote} /></div>}
          {result.ok
            ? (result.tutor ? <Correction r={result.tutor} hideCorrected /> : <div className="result-ok"><Icon name="check" size={16} />Right</div>)
            : result.tutor ? <Correction r={result.tutor} hideCorrected /> : null}
          <div className="muted small" style={{ marginTop: 12 }}>{result.ok && cp.writingKey(result.wrote) !== cp.writingKey(line.answer) ? "The model answer, another way to say it:" : "The model answer:"}</div>
          {model(line.answer)}
          <div className="write-actions">
            <button className="btn" onClick={next}>{i + 1 < set.lines.length ? "Next line" : "See all your lines"}</button>
          </div>
        </div>
      )}
      </div>
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
      <div className="overline">Reference</div>
      <h2 style={{ marginTop: 4 }}>Writing practice</h2>
      <p className="lead">Write a short line and get it corrected, with the <i>why</i>. <b>Typing in Latin letters is fine</b> (e.g. &quot;sakam kafe&quot;); you&apos;ll get it back in {pack.name}.</p>
      {task && (
        <div className="framed write-card">
          <div className="overline">Your task</div>
          <div className="card-prompt" style={{ marginBottom: 12 }}><MixedText text={task.prompt} /></div>
          <textarea
            className="text"
            aria-label={`Your writing in ${pack.name}`}
            placeholder={`Write in ${pack.name}, Latin letters are fine, e.g. "sakam kafe"`}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="write-actions">
            <button className="btn" onClick={submit} disabled={spin || !config?.engines.anthropic}>{spin ? "Checking…" : "Check my writing"}</button>
            {!config?.engines.anthropic && <span className="muted small">Checking isn&apos;t available right now.</span>}
          </div>
          {err && <div className="err">{err}</div>}
          {result && <Correction r={result} showMeta />}
        </div>
      )}
      {tasks.length > 1 && (
        <>
          <div className="overline" style={{ marginTop: 26 }}>Other tasks</div>
          <div className="lib-list">
            {tasks.filter((t) => t.id !== taskId).map((t) => (
              <button key={t.id} className="lib-item plain" onClick={() => { setTaskId(t.id); setText(""); setResult(null); setErr(""); window.scrollTo(0, 0); }}>
                <span className="lib-title"><MixedText text={t.prompt} /></span>
                <span className="lib-fit" aria-hidden="true"><Icon name="next" size={16} /></span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
