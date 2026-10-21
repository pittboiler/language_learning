"use client";
import { useMemo, useState } from "react";
import { type Progress } from "../../lib/store";
import * as cp from "../../lib/course-player";
import { ExamResults, ExamView } from "../exam/Exam";
import { ChapterGlance, LessonNotes, ReplayButton } from "./Notes";
import { LibView, NoteAt, Section, pending, usePack, usePlay } from "../shared";

/** A course chapter's status chip: ✓ done / session k of n / stage review next / upcoming. */
export function courseChip(ch: cp.ChapterOverview): { cls: string; label: string } {
  const now = ch.sessions.find((x) => x.state === "current");
  return ch.stageReview?.state === "current" ? { cls: "easy", label: "stage review next" }
    : ch.state === "done" ? { cls: "just", label: "✓ done" }
    : ch.state === "current" ? { cls: "easy", label: now ? `session ${now.n} of ${ch.sessions.length}` : "now" }
    : { cls: "hard", label: `${ch.sessions.length} sessions` };
}
// Progress → The course (new course): every chapter opens into its full curriculum: its grammar, each
// session (✓ done, ▶ today, upcoming), the stage review that follows it, and its words. A finished session
// opens your notes from that lesson.
export function CourseMap({ progress, persist, navigate }: { progress: Progress; persist: (p: Progress) => void; navigate: (sec: Section, lv?: LibView) => void }) {
  const pack = usePack();
  const play = usePlay();
  const ov = useMemo(() => cp.courseOverview(pack, pack.course!, progress), [pack, progress]);
  const [open, setOpen] = useState<string | null>(() => ov.current?.chapterId ?? null);
  const [view, setView] = useState<{ kind: "notes"; at: NoteAt } | { kind: "glance"; chapterId: string } | { kind: "exam" | "exam-results"; examId: string } | null>(null);
  if (view?.kind === "notes") return <LessonNotes at={view.at} progress={progress} persist={persist} navigate={navigate} onBack={() => setView(null)} backLabel="The course" />;
  if (view?.kind === "glance") return <ChapterGlance chapterId={view.chapterId} progress={progress} navigate={navigate} onBack={() => setView(null)} backLabel="The course" />;
  // Exams can be taken again (or for the first time, if set aside) from here; that never moves the course.
  const examOf = (id: string) => pack.course?.exams?.find((e) => e.id === id);
  if (view?.kind === "exam" && examOf(view.examId)) {
    return (
      <div style={{ marginTop: 22 }}>
        <button className="ghost small" onClick={() => setView(null)}>← The course</button>
        <div style={{ marginTop: 10 }}><ExamView exam={examOf(view.examId)!} progress={progress} persist={persist} onFinish={(p) => { persist(p); setView(null); }} /></div>
      </div>
    );
  }
  if (view?.kind === "exam-results" && examOf(view.examId)) {
    const last = progress.exams?.[view.examId]?.at(-1);
    return (
      <div style={{ marginTop: 22 }}>
        <button className="ghost small" onClick={() => setView(null)}>← The course</button>
        {last ? <div style={{ marginTop: 10 }}><p className="muted small">Taken {new Date(last.at).toLocaleDateString()}</p><ExamResults exam={examOf(view.examId)!} results={last.results} answers={last.tasks} progress={progress} persist={persist} onDone={() => setView(null)} doneLabel="Back to the course" /></div> : <p className="muted">Not taken yet.</p>}
      </div>
    );
  }
  const here = ov.chapters.find((c) => c.state === "current" || c.stageReview?.state === "current" || c.exam?.state === "current");
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", marginTop: 22 }}>
        <h3 style={{ margin: 0 }}>The course</h3>
        <span className="muted small">{ov.done} of {ov.total} sessions done</span>
      </div>
      <p className="muted small" style={{ marginTop: 4 }}>Every chapter, session by session. Open a chapter to see its plan; a finished session opens your notes from that lesson.</p>
      <div className="chapter-map">
        {ov.chapters.map((ch) => {
          const isOpen = open === ch.chapterId;
          const done = ch.sessions.filter((x) => x.state === "done").length;
          const chip = courseChip(ch);
          const learned = ch.words.filter((w) => w.learned).length;
          return (
            <div key={ch.chapterId} className={`chapter-row ${ch.state}${isOpen ? " open" : ""}`}>
              <button className="concept-head" onClick={() => setOpen(isOpen ? null : ch.chapterId)} aria-expanded={isOpen}>
                <span>{ch.order}. {ch.shortTitle}</span>
                <span className="row" style={{ gap: 8, flexWrap: "nowrap" }}><span className={`diff ${chip.cls}`}>{chip.label}</span><span className="muted">{isOpen ? "−" : "+"}</span></span>
              </button>
              <div className="pbar" style={{ margin: "6px 0 2px" }}><div style={{ width: `${Math.round((done / Math.max(1, ch.sessions.length)) * 100)}%` }} /></div>
              {isOpen && (
                <div className="chapter-body">
                  {ch.points.length > 0 && (
                    <div className="chapter-points">
                      <span className="muted small">Grammar:</span>
                      {ch.points.map((pt) => (
                        <button key={pt.id} className="linklike small" onClick={() => { pending.pointFocus = pt.id; navigate("library", "grammar"); }}>{pt.taught ? "✓ " : ""}{pt.title}</button>
                      ))}
                    </div>
                  )}
                  <ol className="session-list">
                    {ch.sessions.map((x) => (
                      <li key={x.n} className={`session-row ${x.state}`}>
                        <span className="sess-n" aria-label={x.state}>{x.state === "done" ? "✓" : x.state === "current" ? "▶" : x.n}</span>
                        <span className="sess-text">{x.headline}{x.state === "current" ? <span className="muted small"> · next up in Today</span> : null}</span>
                        {x.state === "done" && <span className="row" style={{ gap: 4, flexWrap: "nowrap" }}><button className="ghost small" onClick={() => setView({ kind: "notes", at: { chapterId: ch.chapterId, n: x.n } })}>Notes</button><ReplayButton at={{ chapterId: ch.chapterId, n: x.n }} /></span>}
                      </li>
                    ))}
                    {ch.stageReview && (
                      <li className={`session-row ${ch.stageReview.state}`}>
                        <span className="sess-n">{ch.stageReview.state === "done" ? "✓" : ch.stageReview.state === "current" ? "▶" : "★"}</span>
                        <span className="sess-text">Stage review: a look back at everything so far</span>
                        {ch.stageReview.state === "done" && <button className="ghost small" onClick={() => setView({ kind: "notes", at: { chapterId: ch.chapterId, n: 0, stage: true } })}>Notes</button>}
                      </li>
                    )}
                    {ch.exam && (() => {
                      const ex = examOf(ch.exam.id);
                      const last = progress.exams?.[ch.exam.id]?.at(-1);
                      const metN = ex && last ? ex.canDos.filter((c) => last.results[c.id] === "met").length : 0;
                      return (
                        <li className={`session-row ${ch.exam.state}`}>
                          <span className="sess-n">{ch.exam.state === "current" ? "▶" : last ? "✓" : "✎"}</span>
                          <span className="sess-text">{ch.exam.title}
                            {last && ex ? <span className="muted small"> · last time {metN} of {ex.canDos.length} ✓</span> : ch.exam.state === "done" ? <span className="muted small"> · not taken yet</span> : null}
                            {ch.exam.state === "current" ? <span className="muted small"> · next up in Today</span> : null}
                          </span>
                          {last && <button className="ghost small" onClick={() => setView({ kind: "exam-results", examId: ch.exam!.id })}>Results</button>}
                          {ch.exam.state === "done" && <button className="ghost small" onClick={() => setView({ kind: "exam", examId: ch.exam!.id })}>{last ? "Retake" : "Take it"}</button>}
                        </li>
                      );
                    })()}
                  </ol>
                  {ch.words.length > 0 && (
                    <details>
                      <summary className="muted small" style={{ cursor: "pointer" }}>Words · {learned} of {ch.words.length} learned</summary>
                      <div className="word-grid">
                        {ch.words.map((w) => (
                          <span key={w.lexKey} className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                            <button className="gram-play" onClick={() => play(w.display)} aria-label={`Play ${w.display}`}>▶</button>
                            <span><b className="target">{w.display}</b> <span className="muted small">{w.gloss}{w.learned ? " ✓" : ""}</span></span>
                          </span>
                        ))}
                      </div>
                    </details>
                  )}
                  {ch.order > 0 && ch.state !== "upcoming" && (
                    <button className="ghost small" style={{ marginTop: 8 }} onClick={() => setView({ kind: "glance", chapterId: ch.chapterId })}>Chapter at a glance →</button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {here && <p className="muted small">You&apos;re on <b>{here.title}</b>. Today picks up at the ▶ session.</p>}
    </>
  );
}
