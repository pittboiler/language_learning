"use client";
import { useMemo, type ReactNode } from "react";
import type { Chapter } from "@ll/pack-schema";
import * as chapterSpine from "@ll/core/chapters";
import type { ChapterStatus } from "@ll/core/chapters";
import { type Progress } from "../../lib/store";
import * as cp from "../../lib/course-player";
import { courseChip } from "../progress/CourseMap";
import { Stitches, usePack } from "../shared";

// ---------- Chapters: the course spine, rendered as orientation ----------
// One answer to "where am I": the Library groups content by chapter, Today names the current one, and
// Progress draws the whole map. All the judgement (which artifacts belong to a chapter, how far through
// it you are) lives in @ll/core/chapters; this file only renders what it returns.
export function useChapterMap(progress: Progress): { statuses: ChapterStatus[]; byId: Map<string, ChapterStatus>; current?: ChapterStatus } {
  const pack = usePack();
  return useMemo(() => {
    const statuses = chapterSpine.chapterMap(pack, progress);
    return { statuses, byId: new Map(statuses.map((s) => [s.id, s])), current: statuses.find((s) => s.state === "current") };
  }, [pack, progress]);
}
export const CHAPTER_STATE_CHIP: Record<ChapterStatus["state"], { label: string; cls: string }> = {
  done: { label: "done", cls: "just" },
  current: { label: "you are here", cls: "easy" },
  upcoming: { label: "coming up", cls: "hard" },
};
/** What to badge a chapter with: its state, except that a finished chapter still owing its end-of-chapter
 *  checkpoint says so — that's the next thing Today will hand back. */
export const chapterChip = (st: ChapterStatus): { label: string; cls: string } =>
  st.readyForCheckpoint ? { label: "checkpoint due", cls: "stretch" } : CHAPTER_STATE_CHIP[st.state];
/** One chapter's headline: number, name, where you stand, its goal, and the sessions as stitches. */
export function ChapterHeading({ chapter, status, sub, course }: { chapter: Chapter; status?: ChapterStatus; sub?: ReactNode; course?: cp.ChapterOverview }) {
  const chip = course ? courseChip(course) : status ? chapterChip(status) : undefined;
  // On the course: its sessions, the words it teaches and its grammar points, as Progress counts them.
  const done = course ? course.sessions.filter((x) => x.state === "done").length : 0;
  const now = course ? course.sessions.findIndex((x) => x.state === "current") : -1;
  const goal = chapter.goal ? chapter.goal.charAt(0).toUpperCase() + chapter.goal.slice(1) : "";
  return (
    <>
      <div className="ch-head">
        <div style={{ minWidth: 0 }}>
          <div className="overline">Chapter {chapter.order}</div>
          <h3>{chapter.shortTitle}</h3>
        </div>
        {chip && <span className={`ch-status ${chip.cls}`}>{chip.label}</span>}
      </div>
      <div className="ch-goal">{goal}{chapter.cefr ? ` · ${chapter.cefr}` : ""}</div>
      {course && (
        <div className="ch-meta">
          <Stitches total={course.sessions.length} done={done} now={now} size={11} label={`${done} of ${course.sessions.length} sessions done`} />
          <span>
            {done}/{course.sessions.length} sessions
            {course.words.length ? ` · ${course.words.filter((w) => w.learned).length}/${course.words.length} words` : ""}
            {course.points.length ? ` · ${course.points.filter((x) => x.taught).length}/${course.points.length} grammar` : ""}
          </span>
        </div>
      )}
      {!course && status && (
        <>
          <div className="pbar" style={{ marginTop: 8 }}><div style={{ width: `${Math.round(status.percent * 100)}%` }} /></div>
          <div className="ch-meta" style={{ marginTop: 0 }}>
            {status.wordsKnown}/{status.wordsTotal} words known
            {status.grammarTotal ? ` · ${status.grammarSeen}/${status.grammarTotal} grammar` : ""}
            {status.storyTotal ? (status.storyRead ? " · story read" : " · story not read yet") : ""}
            {status.criteriaTotal ? ` · ${status.criteriaMet}/${status.criteriaTotal} goals met` : ""}
          </div>
        </>
      )}
      {sub}
    </>
  );
}
