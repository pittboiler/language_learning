"use client";
import { useState } from "react";
import type { CourseExam, ExamTask, GrammarPoint } from "@ll/pack-schema";
import * as api from "../../lib/api";
import { type ExamAttempt, type Progress } from "../../lib/store";
import * as cp from "../../lib/course-player";
import { combineResults, selfCheckGrade, type CanDoResult, type ExamGrade } from "@ll/core/exam/results";
import { Icon, MixedText, SpeakButton, Stitches, gradeItem, usePack, usePlay, useRecorder } from "../shared";

// ---------- midterm / final (course.exams) ----------
// Open book: every task opens on a prep screen (the steps, the grammar inline, the chapters' words) for as long
// as the learner likes; then they speak (recorded → both speech engines → marked) or write (marked). Speech the
// engines can't hear — or no mic — becomes a self-check against the model answer. Not a gate: the results end
// with a review list, and the course moves on either way.
export type ExamAnswer = { response: string; grade?: ExamGrade; selfCheck?: boolean; skipped?: boolean };
export const RESULT_LABEL: Record<CanDoResult, string> = { met: "you can do this", partly: "nearly", "not-yet": "not yet" };
const STEP_LABEL: Record<"yes" | "partly" | "no", string> = { yes: "done", partly: "partly", no: "missed" };
/** A step's or a can-do's mark, in words and colour (indigo when it's there, gold when it isn't yet). */
function Mark({ kind, label }: { kind: string; label: string }) {
  return <span className={`mark ${kind}`}>{(kind === "yes" || kind === "met") && <Icon name="check" size={13} />}{label}</span>;
}
export function ExamView({ exam, progress, persist, onFinish, onLater }: {
  exam: CourseExam; progress: Progress; persist: (p: Progress) => void;
  /** Called with the progress to keep (attempt saved) when the learner is done with the results. */
  onFinish: (p: Progress) => void;
  /** Today only: set the exam aside for now (the course still moves on; take it later from Progress). */
  onLater?: () => void;
}) {
  const [at, setAt] = useState<"intro" | number | "results">("intro");
  const [answers, setAnswers] = useState<Record<string, ExamAnswer>>({});
  const tasks = exam.tasks;
  if (at === "intro") {
    return (
      <div>
        <div className="overline" style={{ color: "var(--accent)" }}>Open book</div>
        <h3 className="lesson-title">{exam.title}</h3>
        <p className="lesson-rule"><MixedText text={exam.intro} /></p>
        <div className="framed menu">
          <div className="menu-title">By now you should be able to</div>
          <ol className="menu-list">
            {exam.canDos.map((c, i) => <li key={c.id}><span className="menu-n" aria-hidden="true">{i + 1}</span><span className="menu-label" style={{ fontWeight: 500 }}><MixedText text={c.text} /></span></li>)}
          </ol>
        </div>
        <p className="muted small">{tasks.filter((t) => t.mode === "speak").length} speaking tasks, then {tasks.filter((t) => t.mode === "write").length} writing tasks · about {tasks.length * 4} minutes · any task can be skipped</p>
        <div className="row" style={{ gap: 16 }}>
          <button className="btn" onClick={() => setAt(0)}>Start</button>
          {onLater && <button className="quiet" onClick={onLater}>Take it later (from Progress)</button>}
        </div>
      </div>
    );
  }
  if (at === "results") {
    const results = combineResults(Object.values(answers).flatMap((a) => (a.grade ? [a.grade] : [])));
    return <ExamResults exam={exam} results={results} answers={answers} progress={progress} persist={persist}
      onDone={(p) => {
        const attempt: ExamAttempt = { at: new Date().toISOString(), results, tasks: answers };
        onFinish({ ...p, exams: { ...p.exams, [exam.id]: [...(p.exams?.[exam.id] ?? []), attempt] } });
      }} />;
  }
  const task = tasks[at]!;
  const next = () => setAt(at + 1 < tasks.length ? at + 1 : "results");
  return (
    <ExamTaskView key={task.id} exam={exam} task={task} index={at} total={tasks.length}
      onAnswered={(a) => setAnswers((x) => ({ ...x, [task.id]: a }))} onNext={next} />
  );
}
export function ExamTaskView({ exam, task, index, total, onAnswered, onNext }: {
  exam: CourseExam; task: ExamTask; index: number; total: number;
  onAnswered: (a: ExamAnswer) => void; onNext: () => void;
}) {
  const pack = usePack();
  const play = usePlay();
  const [phase, setPhase] = useState<"prep" | "do" | "marking" | "result" | "self">("prep");
  const [selfWhy, setSelfWhy] = useState<"unclear" | "chosen">("chosen"); // why we're self-checking
  const [text, setText] = useState("");
  const [heard, setHeard] = useState<{ scribe?: string; google?: string } | null>(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [grade, setGrade] = useState<ExamGrade | null>(null);
  const [self, setSelf] = useState<("yes" | "partly" | "no" | undefined)[]>(() => task.steps.map(() => undefined));
  const rec = useRecorder();
  const points = task.pointIds.map((id) => pack.course?.points.find((p) => p.id === id)).filter((p): p is GrammarPoint => !!p);
  const chapterIds = [...new Set(exam.canDos.filter((c) => task.canDoIds.includes(c.id)).flatMap((c) => c.chapterIds))];
  const words = (pack.course?.chapters ?? []).filter((c) => chapterIds.includes(c.chapterId)).flatMap((c) => c.words);
  const speak = task.mode === "speak";

  const reference = (
    <>
      {points.length > 0 && (
        <details className="exam-ref">
          <summary className="small">Grammar for this task · <MixedText text={points.map((p) => p.title).join(" · ")} /></summary>
          {points.map((p) => (
            <div key={p.id} style={{ marginTop: 8 }}>
              <div className="small"><b><MixedText text={p.title} /></b></div>
              <p className="small" style={{ margin: "2px 0 4px", lineHeight: 1.5 }}><MixedText text={p.rule} /></p>
              <div className="gram-ex-list">
                {p.examples.slice(0, 2).map((e) => (
                  <div className="gram-ex" key={e.source}><SpeakButton label={`Play ${e.text}`} onClick={() => play(e.text)} /><span className="ex-text"><span className="mk" lang={pack.id}>{e.text}</span><span className="en">{e.gloss}</span></span></div>
                ))}
              </div>
            </div>
          ))}
        </details>
      )}
      {words.length > 0 && (
        <details className="exam-ref">
          <summary className="small">Words from {chapterIds.length > 1 ? "these chapters" : "this chapter"} · {words.length}</summary>
          <div className="word-grid">
            {words.map((w) => (
              <span key={w.lexKey} className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                <SpeakButton label={`Play ${w.display}`} onClick={() => play(w.display)} />
                <span><b lang={pack.id} style={{ fontFamily: "var(--font-text)", fontSize: 16 }}>{w.display}</b> <span className="muted small">{w.gloss}</span></span>
              </span>
            ))}
          </div>
        </details>
      )}
    </>
  );
  const steps = (marks?: ("yes" | "partly" | "no" | undefined)[]) => (
    <ol className="step-list">
      {task.steps.map((s, i) => <li key={i}><span><MixedText text={s} /></span>{marks?.[i] ? <Mark kind={marks[i]!} label={STEP_LABEL[marks[i]!]} /> : <span />}</li>)}
    </ol>
  );
  const head = (
    <>
      <div className="step-meta">
        <Stitches total={total} done={index} now={index} size={10} label={`Task ${index + 1} of ${total}`} />
        <span>{exam.title} · task {index + 1} of {total} · {speak ? "speaking" : "writing"}</span>
      </div>
      <h3 className="lesson-title"><MixedText text={task.title} /></h3>
      <p className="lesson-rule"><MixedText text={task.scene} /></p>
    </>
  );

  const mark = async (body: { response?: string; transcripts?: { scribe?: string; google?: string } }) => {
    setPhase("marking"); setErr("");
    try {
      const g = await api.gradeExam({ examId: exam.id, taskId: task.id, ...body }, pack.id);
      if (g.error) throw new Error(g.error);
      if (g.unclear) { setSelfWhy("unclear"); setPhase("self"); return; }
      setGrade(g);
      onAnswered({ response: body.response ?? body.transcripts?.scribe ?? body.transcripts?.google ?? "", grade: g });
      setPhase("result");
    } catch (e) {
      setErr((e as { message?: string }).message ?? "Couldn't mark that.");
      setPhase("self"); // marking failed: the learner checks themselves rather than losing the task
    }
  };
  const startRec = async () => { setErr(""); try { await rec.current.start(); setRecording(true); } catch { setErr("No microphone available — check yourself against the model answer instead."); setPhase("self"); } };
  const stopRec = async () => {
    setRecording(false); setBusy(true);
    try {
      const out = await api.asr(await rec.current.stop(), pack.id);
      setHeard({ scribe: out.eleven?.text, google: out.google?.text });
    } catch { setErr("Couldn't process the recording — try again, or check yourself."); }
    finally { setBusy(false); }
  };
  const model = (
    <div className="framed write-card" style={{ marginTop: 14 }}>
      <div className="overline">One way to say it (yours can be different)</div>
      <div className="gram-ex-list">
        {task.model.map((m) => (
          <div className="gram-ex" key={m.source}><SpeakButton label={`Play ${m.text}`} onClick={() => play(m.text)} /><span className="ex-text"><span className="mk" lang={pack.id}>{m.text}</span><span className="en">{m.gloss}</span></span></div>
        ))}
      </div>
    </div>
  );

  if (phase === "prep") {
    return (
      <div>
        {head}
        <div className="framed write-card">
          <div className="overline">Prepare · open book</div>
          <div className="muted small" style={{ marginTop: 6 }}>{speak ? "Say" : "Write"}, in order:</div>
          {steps()}
          {reference}
          <p className="muted small" style={{ margin: "10px 0 0" }}>Take as long as you like. {speak ? "When you record, it's fine to glance at notes." : "The grammar and words stay open while you write."}</p>
        </div>
        <div className="write-actions">
          <button className="btn" onClick={() => setPhase("do")}>I&apos;m ready</button>
          <button className="quiet" onClick={() => { onAnswered({ response: "", skipped: true }); onNext(); }}>Skip this task</button>
        </div>
      </div>
    );
  }
  if (phase === "do") {
    return (
      <div>
        {head}
        {steps()}
        {speak ? (
          <div className="framed write-card" style={{ textAlign: "center" }}>
            {!heard ? (
              <>
                <div className="muted small">Record yourself doing the whole thing, start to finish.</div>
                <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
                  <div className={`mic-ring${recording ? " recording" : ""}`}>
                    <button className="mic" disabled={busy} aria-label={recording ? "Stop recording" : "Record your answer"} onClick={() => void (recording ? stopRec() : startRec())}>
                      <Icon name={recording ? "stop" : "mic"} size={30} />
                    </button>
                  </div>
                </div>
                <div className="speak-hint" aria-live="polite">{busy ? "Listening back…" : recording ? "Recording… tap to stop" : "Tap the mic to start"}</div>
              </>
            ) : (
              <>
                <div className="muted small">We heard:</div>
                <div className="say-line" lang={pack.id} style={{ fontSize: 22, margin: "6px 0 12px" }}>{heard.scribe || heard.google || "(nothing clear)"}</div>
                <div className="row" style={{ justifyContent: "center", gap: 16 }}>
                  <button className="btn" onClick={() => void mark({ transcripts: heard })}>Mark it</button>
                  <button className="quiet" onClick={() => setHeard(null)}>Record again</button>
                </div>
              </>
            )}
            <button className="linklike small" style={{ marginTop: 14 }} onClick={() => { rec.current.release(); setRecording(false); setPhase("self"); }}>Can&apos;t record? Check yourself against a model answer</button>
          </div>
        ) : (
          <div className="framed write-card">
            <textarea className="text" aria-label="Your answer" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Write in ${pack.name} (Cyrillic or Latin letters both fine)…`} />
            <div className="write-actions">
              <button className="btn" disabled={!text.trim()} onClick={() => void mark({ response: text })}>Mark it</button>
            </div>
          </div>
        )}
        {err ? <div className="err">{err}</div> : null}
        {reference}
      </div>
    );
  }
  if (phase === "marking") return <div>{head}<p className="spin">Marking your answer… this takes a few seconds.</p></div>;
  if (phase === "self") {
    const ready = self.every((s) => !!s);
    return (
      <div>
        {head}
        {err ? <div className="err">{err}</div> : <p className="small">{selfWhy === "unclear" ? "We couldn't hear that clearly, so check yourself: c" : "C"}ompare what you {speak ? "said" : "wrote"} with the model, step by step.</p>}
        {model}
        <div className="framed write-card" style={{ marginTop: 14 }}>
          <div className="overline">How did each step go?</div>
          {task.steps.map((s, i) => (
            <div key={i} className="self-row">
              <span style={{ flex: "1 1 200px" }}><MixedText text={s} /></span>
              <span className="theme-chips" role="group" aria-label={`Step ${i + 1}`} style={{ margin: 0, flexWrap: "nowrap" }}>
                {(["yes", "partly", "no"] as const).map((v) => (
                  <button key={v} aria-pressed={self[i] === v} className={`chip-toggle${self[i] === v ? " active" : ""}`} onClick={() => setSelf((x) => x.map((y, j) => (j === i ? v : y)))}>{v === "yes" ? "Got it" : v === "partly" ? "Partly" : "Missed"}</button>
                ))}
              </span>
            </div>
          ))}
        </div>
        <div className="write-actions">
          <button className="btn" disabled={!ready} onClick={() => { onAnswered({ response: text || heard?.scribe || heard?.google || "", grade: selfCheckGrade(self as ("yes" | "partly" | "no")[], task.canDoIds), selfCheck: true }); onNext(); }}>{index + 1 < total ? "Next task" : "See your results"}</button>
        </div>
      </div>
    );
  }
  // result
  const g = grade!;
  return (
    <div>
      {head}
      <div className={`feedback ${g.steps.every((s) => s.done === "yes") ? "good" : "fix"}`} role="status">
        {g.summary && <div className="feedback-title"><MixedText text={g.summary} /></div>}
        {steps(g.steps.map((s) => s.done))}
        {g.corrections.length > 0 && (
          <>
            <div className="overline">Worth fixing</div>
            {g.corrections.map((c, i) => (
              <div className="issue" key={i}>
                <span className="was"><MixedText text={c.wrote} /></span>
                <span aria-label="changed to">→</span>
                <span className="now"><MixedText text={c.better} /></span>
                {c.why && <span className="why"><MixedText text={c.why} /></span>}
              </div>
            ))}
          </>
        )}
      </div>
      {model}
      <div className="write-actions">
        <button className="btn" onClick={onNext}>{index + 1 < total ? "Next task" : "See your results"}</button>
      </div>
    </div>
  );
}
// The exam's results: each can-do (you can do this / nearly / not yet), then what to look at again —
// the grammar behind anything not yet met, which "Add to my reviews" sends back into the flashcards.
export function ExamResults({ exam, results, answers, progress, persist, onDone, doneLabel = "Finish" }: {
  exam: CourseExam; results: Record<string, CanDoResult>; answers: Record<string, ExamAnswer>; progress: Progress; persist: (p: Progress) => void;
  onDone: (p: Progress) => void; doneLabel?: string;
}) {
  const pack = usePack();
  const [added, setAdded] = useState(false);
  const notes = (id: string) => Object.values(answers).flatMap((a) => a.grade?.canDos.filter((c) => c.id === id && c.note).map((c) => c.note) ?? []);
  const assessed = exam.canDos.filter((c) => results[c.id]);
  const met = assessed.filter((c) => results[c.id] === "met").length;
  const toReview = [...new Set(exam.canDos.filter((c) => results[c.id] && results[c.id] !== "met").flatMap((c) => c.pointIds))]
    .map((id) => pack.course?.points.find((p) => p.id === id)).filter((p): p is GrammarPoint => !!p);
  const addToReviews = () => {
    // A missed point's grammar cards come back soon: graded "again", so they're due in the next review.
    let p = progress;
    for (const pt of toReview) for (const card of cp.blankCardItems(pt)) p = gradeItem(p, card, false);
    persist(p);
    setAdded(true);
  };
  const skipped = Object.values(answers).filter((a) => a.skipped).length;
  return (
    <div>
      <div className="overline" style={{ color: "var(--accent)" }}>Results</div>
      <h3 className="lesson-title">{exam.title}</h3>
      <p className="lead" style={{ marginTop: 0 }}>{assessed.length ? `You can do ${met} of ${assessed.length} things this checks.` : "Nothing was marked this time."}{skipped ? ` (${skipped} task${skipped > 1 ? "s" : ""} skipped.)` : ""}</p>
      <div style={{ marginBottom: 14 }}>
        {exam.canDos.map((c) => {
          const r = results[c.id];
          return (
            <div key={c.id} className="cando">
              <span style={{ fontWeight: 500 }}><MixedText text={c.text} /></span>
              {r ? <Mark kind={r} label={RESULT_LABEL[r]} /> : <span className="mark" style={{ color: "var(--text-muted)" }}>not checked</span>}
              {notes(c.id).length > 0 && <div className="notes">{notes(c.id).slice(0, 2).map((n, i) => <div key={i}><MixedText text={n} /></div>)}</div>}
            </div>
          );
        })}
      </div>
      {toReview.length > 0 && (
        <div className="framed write-card">
          <div className="overline">Worth another look</div>
          <ul style={{ margin: "8px 0 12px", paddingLeft: 18, lineHeight: 1.6 }}>
            {toReview.map((p) => <li key={p.id}><MixedText text={p.title} /> <span className="muted small">· Library › Grammar</span></li>)}
          </ul>
          {added
            ? <span className="result-ok"><Icon name="check" size={15} />Added: they&apos;ll come up in your next review</span>
            : <button className="ghost small" onClick={addToReviews}>Add these to my reviews</button>}
        </div>
      )}
      <div className="write-actions">
        <button className="btn" onClick={() => onDone(progress)}>{doneLabel.replace(/\s*→$/, "")}</button>
      </div>
    </div>
  );
}
