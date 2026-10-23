"use client";
import { useContext, useMemo } from "react";
import type { GrammarPoint, LanguagePack } from "@ll/pack-schema";
import * as familiarity from "@ll/core/familiarity";
import { type Progress } from "../../lib/store";
import * as cp from "../../lib/course-player";
import { LibView, MixedText, NoteAt, ReplayContext, Section, SpeakButton, pending, usePack, usePlay } from "../shared";
import { CourseRecap } from "../today/CourseRecap";

export function ReplayButton({ at }: { at: NoteAt }) {
  const start = useContext(ReplayContext);
  if (!start || at.stage || at.exam) return null;
  return <button className="ghost small" title="Do this lesson again: your place in the course stays where it is" onClick={() => start(at)}>Do again</button>;
}
export const noteDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : undefined);
export function noteTitle(pack: LanguagePack, at: NoteAt): string {
  const ch = pack.chapters?.find((c) => c.id === at.chapterId);
  return at.exam ? (pack.course?.exams?.find((e) => e.afterChapterId === at.chapterId)?.title ?? "Exam") : at.stage ? `Stage review after ${ch?.shortTitle ?? at.chapterId}` : `Chapter ${ch?.order ?? ""} · ${ch?.shortTitle ?? ""} · session ${at.n}`;
}
export function LessonNotes({ at, progress, persist, navigate, onBack, backLabel }: {
  at: NoteAt;
  progress: Progress;
  persist: (p: Progress) => void;
  navigate: (sec: Section, lv?: LibView) => void;
  onBack: () => void;
  backLabel: string;
}) {
  const pack = usePack();
  const pos = useMemo(() => cp.positionOf(pack.course!, at), [pack, at]);
  const log = [...(progress.courseLog ?? [])].reverse().find((e) => e.chapterId === at.chapterId && e.n === at.n && !!e.stage === !!at.stage);
  // No record ⇒ no time window: the notes show the session's own words, not words tapped some other day.
  const since = useMemo(() => new Date(log ? log.startedAt : 8.64e15), [log]);
  const until = useMemo(() => (log ? new Date(log.at) : undefined), [log]);
  return (
    <div>
      <div className="row" style={{ marginBottom: 8, justifyContent: "space-between" }}>
        <button className="ghost small" onClick={onBack}>← {backLabel}</button>
        <ReplayButton at={at} />
      </div>
      {pos
        ? <CourseRecap pos={pos} since={since} until={until} progress={progress} persist={persist} missed={log?.missed ?? []} drilled={log?.drilled} navigate={navigate} notes={{ title: noteTitle(pack, at), when: log ? `Finished ${noteDate(log.at)}` : undefined }} />
        : <p className="muted">This lesson isn&apos;t in the course any more.</p>}
    </div>
  );
}
// One chapter on a page: each point's rule with two examples, then every word, so a quick read brings the
// chapter back. Points not taught yet are only named (no preview of the rule).
export function ChapterGlance({ chapterId, progress, navigate, onBack, backLabel }: {
  chapterId: string;
  progress: Progress;
  navigate: (sec: Section, lv?: LibView) => void;
  onBack: () => void;
  backLabel: string;
}) {
  const pack = usePack();
  const play = usePlay();
  const course = pack.course!;
  const cc = course.chapters.find((c) => c.chapterId === chapterId);
  const ch = pack.chapters?.find((c) => c.id === chapterId);
  if (!cc) return null;
  const pts = cc.pointIds.map((id) => course.points.find((x) => x.id === id)).filter((x): x is GrammarPoint => !!x);
  const learned = (k: string) => { const e = progress.familiarity[k]; return !!e && familiarity.isStudied(e) && e.status !== "ignored"; };
  return (
    <div>
      <button className="ghost small" onClick={onBack} style={{ marginBottom: 8 }}>← {backLabel}</button>
      <div className="overline">Chapter {ch?.order} at a glance</div>
      <h2 className="lesson-title">{ch?.shortTitle}</h2>
      <div className="step-meta">{ch?.title}</div>
      {pts.map((p) => progress.seenGrammar?.[p.id] ? (
        <div className="framed write-card recap-card" key={p.id}>
          <div className="overline">Grammar</div>
          <div className="gram-title"><MixedText text={p.title} /></div>
          <p className="recap-text"><MixedText text={p.rule} /></p>
          <div className="gram-ex-list">
            {p.examples.slice(0, 2).map((ex) => (
              <div className="gram-ex" key={ex.source}>
                <SpeakButton label={`Play ${ex.text}`} onClick={() => play(ex.text)} />
                <span className="ex-text"><span className="mk" lang={pack.id}>{ex.text}</span><span className="en">{ex.gloss}</span></span>
              </div>
            ))}
          </div>
          <button className="linklike small" onClick={() => { pending.pointFocus = p.id; navigate("library", "grammar"); }}>The full rule in the Library</button>
        </div>
      ) : (
        <p className="muted small" key={p.id}>Coming up in this chapter: <b><MixedText text={p.title} /></b></p>
      ))}
      {cc.words.length > 0 && (
        <div className="framed write-card recap-card">
          <div className="overline">Words · {cc.words.filter((w) => learned(w.lexKey)).length} of {cc.words.length} learned</div>
          <div className="word-grid">
            {cc.words.map((w) => (
              <span key={w.lexKey} className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                <SpeakButton label={`Play ${w.display}`} onClick={() => play(w.display)} />
                <span><b lang={pack.id} className="rmk" style={{ fontSize: 16 }}>{w.display}</b> <span className="muted small">{w.gloss}{learned(w.lexKey) ? " · learned" : ""}</span></span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
