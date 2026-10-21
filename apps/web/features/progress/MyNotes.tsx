"use client";
import { useMemo, useState } from "react";
import { type Progress } from "../../lib/store";
import * as cp from "../../lib/course-player";
import { chapterChip, useChapterMap } from "../course/ChapterHeading";
import { ChapterGlance, LessonNotes, ReplayButton, noteDate } from "./Notes";
import { LibView, NoteAt, Section, pending, usePack } from "../shared";

// Library → Reference → My notes: what you've learned so far, two ways: each chapter on one page, and your
// notes from every finished lesson (newest first).
export function MyNotes({ progress, persist, navigate }: { progress: Progress; persist: (p: Progress) => void; navigate: (sec: Section, lv?: LibView) => void }) {
  const pack = usePack();
  const ov = useMemo(() => cp.courseOverview(pack, pack.course!, progress), [pack, progress]);
  const [view, setView] = useState<{ kind: "notes"; at: NoteAt } | { kind: "glance"; chapterId: string } | null>(() => {
    const f = pending.notesFocus;
    pending.notesFocus = null;
    return f ? { kind: "notes", at: f } : null;
  });
  if (view?.kind === "notes") return <LessonNotes at={view.at} progress={progress} persist={persist} navigate={navigate} onBack={() => setView(null)} backLabel="My notes" />;
  if (view?.kind === "glance") return <ChapterGlance chapterId={view.chapterId} progress={progress} navigate={navigate} onBack={() => setView(null)} backLabel="My notes" />;
  const reached = ov.chapters.filter((c) => c.order > 0 && (c.state !== "upcoming"));
  // A skipped letters chapter has no lessons to show: only sessions you actually finished (or, before records
  // were kept, curriculum sessions behind your place in the course).
  const lessons = ov.chapters.flatMap((c) => [
    ...c.sessions.filter((x) => x.state === "done" && (c.order > 0 || !!x.log)).map((x) => ({ at: { chapterId: c.chapterId, n: x.n } as NoteAt, headline: x.headline, log: x.log, order: c.order })),
    ...(c.stageReview?.state === "done" ? [{ at: { chapterId: c.chapterId, n: 0, stage: true } as NoteAt, headline: "Stage review: a look back at everything so far", log: c.stageReview.log, order: c.order }] : []),
  ]).reverse();
  return (
    <section className="view">
      <h2>My notes</h2>
      <p className="lead">What you&apos;ve learned so far: each chapter on one page, and your notes from every lesson you&apos;ve finished.</p>
      <h3>Chapters at a glance</h3>
      {reached.length ? (
        <div className="cards">
          {reached.map((c) => (
            <button className="contentcard" key={c.chapterId} onClick={() => setView({ kind: "glance", chapterId: c.chapterId })}>
              <div className="cc-top"><span className="cc-type">Chapter {c.order}</span>{c.state === "done" && <span className="diff just">done</span>}</div>
              <div className="cc-title">{c.shortTitle}</div>
              <div className="muted small">{c.points.filter((x) => x.taught).map((x) => x.title).join(" · ") || "Nothing taught yet"}</div>
            </button>
          ))}
        </div>
      ) : <p className="muted">Your first chapter shows up here once you start it.</p>}
      <h3>Lesson by lesson</h3>
      {lessons.length ? (
        <ol className="session-list">
          {lessons.map((l) => (
            <li key={`${l.at.chapterId}-${l.at.n}-${l.at.stage ? "s" : ""}`} className="session-row done">
              <span className="sess-n">✓</span>
              <span className="sess-text"><span className="muted small">{l.at.stage ? `After chapter ${l.order}` : `Chapter ${l.order} · session ${l.at.n}`}{l.log ? ` · ${noteDate(l.log.at)}` : ""}</span><br />{l.headline}</span>
              <span className="row" style={{ gap: 4, flexWrap: "nowrap" }}><button className="ghost small" onClick={() => setView({ kind: "notes", at: l.at })}>Notes</button><ReplayButton at={l.at} /></span>
            </li>
          ))}
        </ol>
      ) : <p className="muted">Finish a session and its notes appear here.</p>}
    </section>
  );
}
// The course at a glance: every chapter, what you've finished, the one you're on, and what's ahead.
// This is the "where were we, where are we, where are we going" view — the stats above say how much,
// this says where. Each row's bar is the same four-strand score the Library shows.
export function ChapterProgressMap({ progress }: { progress: Progress }) {
  const pack = usePack();
  const { statuses, current } = useChapterMap(progress);
  const byId = useMemo(() => new Map((pack.chapters ?? []).map((c) => [c.id, c])), [pack]);
  if (!statuses.length) return null;
  const done = statuses.filter((s) => s.state === "done").length;
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", marginTop: 22 }}>
        <h3 style={{ margin: 0 }}>The course</h3>
        <span className="muted small">{done} of {statuses.length} chapters done</span>
      </div>
      <p className="muted small" style={{ marginTop: 4 }}>
        A chapter is done once you know most of its words, have seen its grammar, read its story and met its conversation goals.
      </p>
      <div className="chapter-map">
        {statuses.map((st) => {
          const ch = byId.get(st.id);
          if (!ch) return null;
          const chip = chapterChip(st);
          return (
            <div key={st.id} className={`chapter-row ${st.state}`}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                <span><b>{ch.order}. {ch.shortTitle}</b> <span className="muted small">{ch.cefr}</span></span>
                <span className={`diff ${chip.cls}`}>{chip.label}</span>
              </div>
              <div className="pbar" style={{ margin: "6px 0 4px" }}><div style={{ width: `${Math.round(st.percent * 100)}%` }} /></div>
              <div className="muted small">
                {st.wordsKnown}/{st.wordsTotal} words
                {st.grammarTotal ? ` · ${st.grammarSeen}/${st.grammarTotal} grammar` : ""}
                {st.storyTotal ? (st.storyRead ? " · story read" : " · story to read") : ""}
                {st.criteriaTotal ? ` · ${st.criteriaMet}/${st.criteriaTotal} goals` : ""}
              </div>
            </div>
          );
        })}
      </div>
      {current && <p className="muted small">You&apos;re on <b>{byId.get(current.id)?.title}</b> — Today keeps bringing you back to it until it&apos;s solid.</p>}
      {statuses.some((s) => s.readyForCheckpoint) && (
        <p className="muted small">A <b>checkpoint</b> is waiting: your next session opens with a recap of that chapter before anything new.</p>
      )}
    </>
  );
}
