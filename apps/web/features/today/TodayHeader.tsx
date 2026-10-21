"use client";
import { type ReactNode } from "react";
import * as chapterSpine from "@ll/core/chapters";
import { type Progress } from "../../lib/store";
import * as cp from "../../lib/course-player";
import { NoteAt, currentStory, usePack } from "../shared";

export function Tag({ children }: { children: ReactNode }) {
  return <div className="muted small" style={{ marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{children}</div>;
}
// The session header also LOCATES the session: which chapter today's material comes from, and which
// day of it this is. The chapter is derived from the story the planner actually chose, so the header
// can never disagree with what the session goes on to teach.
export function TodayHeader({ progress, replay }: { progress: Progress; replay?: { at: NoteAt; onExit: () => void } }) {
  const pack = usePack();
  const streak = progress.streak?.count ?? 0;
  if (cp.courseV2On(pack, progress)) {
    const pos = cp.position(pack.course!, progress.course);
    const ch = pos.kind === "session" ? (pack.chapters ?? []).find((c) => c.id === pos.chapter.chapterId) : undefined;
    return (
      <div className="today-head">
        <div>
          <h2 style={{ marginBottom: 2 }}>{replay ? "Doing a lesson again" : "Today"}</h2>
          {replay && <p className="muted small" style={{ margin: "0 0 4px" }}>Your place in the course doesn&apos;t move. <button className="linklike small" onClick={replay.onExit}>Back to where you were</button></p>}
          <span className="muted small">
            {pos.kind === "session" && ch
              ? <>Chapter {ch.order} · <b>{ch.shortTitle}</b> · session {pos.session.n} of {pos.chapter.sessions.length}{pos.session.role === "review" ? " · review day" : pos.session.role === "checkpoint" ? " · checkpoint" : ""}</>
              : pos.kind === "stage-review" ? <>Stage review · everything so far</> : pos.kind === "exam" ? <><b>{pos.exam.title}</b> · open book</> : "Course complete"}
          </span>
        </div>
        <span className="streak-chip" title="Day streak">🔥 {streak} day{streak === 1 ? "" : "s"}</span>
      </div>
    );
  }
  const story = currentStory(pack, progress);
  const chapter = story ? chapterSpine.chapterOf(pack, story.id) : undefined;
  const dayIndex = story ? (progress.storyReads?.[story.id]?.length ?? 0) : 0;
  return (
    <div className="today-head">
      <div>
        <h2 style={{ marginBottom: 2 }}>Today</h2>
        <span className="muted small">
          {chapter
            ? <>Chapter {chapter.order} · <b>{chapter.shortTitle}</b>{dayIndex > 0 ? ` · day ${dayIndex + 1}` : ""}</>
            : "your guided session"}
        </span>
      </div>
      <span className="streak-chip" title="Day streak">🔥 {streak} day{streak === 1 ? "" : "s"}</span>
    </div>
  );
}
