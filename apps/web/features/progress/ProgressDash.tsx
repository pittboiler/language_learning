"use client";
import { type ReactNode } from "react";
import * as scoring from "@ll/core/familiarity/scoring";
import { type Progress } from "../../lib/store";
import * as cp from "../../lib/course-player";
import { CourseMap } from "./CourseMap";
import { ChapterProgressMap } from "./MyNotes";
import { LibView, Section, computeLevel, usePack } from "../shared";

// ---------- Progress section: functional stats + Strengthen ----------
export function ProgressDash({ progress, persist, navigate, dueCount }: { progress: Progress; persist: (p: Progress) => void; navigate: (sec: Section, lv?: LibView) => void; dueCount: number }) {
  const pack = usePack();
  const vocab = scoring.computeMetrics(progress.familiarity);
  const level = computeLevel(pack, progress);
  const streak = progress.streak?.count ?? 0;
  const stat = (l: string, v: ReactNode, accent?: boolean) => (
    <div className="stat" key={l}><div className={`v ${accent ? "accent" : ""}`}>{v}</div><div className="l">{l}</div></div>
  );
  return (
    <section className="view">
      <h2>Your progress</h2>
      <p className="lead">Functional progress — what you can actually understand and say — not just streak days.</p>
      <div className="stats">
        {stat("Words known", vocab.knownWordCount, true)}
        {stat("Learning", vocab.learningCount)}
        {stat("New this week", vocab.movedToKnownThisWeek)}
        {stat("To review", dueCount, dueCount > 0)}
        {stat("Day streak", streak)}
        {stat("Level", level.cefrBand)}
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>
        <b>To review</b> = items due in Flashcards (below, and in Library › Flashcards). <b>Level</b> is an estimate from letters learned, scenario goals met, and words tracked — roughly pre-A1 → A1 → A2.
      </p>
      {cp.courseV2On(pack, progress) ? <CourseMap progress={progress} persist={persist} navigate={navigate} /> : <ChapterProgressMap progress={progress} />}
    </section>
  );
}
