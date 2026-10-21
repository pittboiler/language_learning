"use client";
import { type ReactNode } from "react";
import * as chapterSpine from "@ll/core/chapters";
import { type Progress } from "../../lib/store";
import * as cp from "../../lib/course-player";
import { NoteAt, Stitches, currentStory, usePack } from "../shared";

/** The small label over a lesson step ("Speak · Order a drink"). */
export function Tag({ children }: { children: ReactNode }) {
  return <div className="overline" style={{ marginBottom: 8 }}>{children}</div>;
}

const ROLE_LABEL: Record<string, string> = { review: "review day", use: "put it together", checkpoint: "checkpoint" };

function Streak({ count }: { count: number }) {
  return count > 0 ? <span className="streak" title="Day streak">Day {count} in a row</span> : null;
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
    const role = pos.kind === "session" ? ROLE_LABEL[pos.session.role] : undefined;
    return (
      <div className="today-head">
        <div style={{ minWidth: 0 }}>
          <div className="overline">
            {replay ? "Doing a lesson again" : pos.kind === "session" && ch ? `Today · chapter ${ch.order}` : "Today"}
          </div>
          <h2>
            {pos.kind === "session" && ch ? ch.shortTitle : pos.kind === "stage-review" ? "Stage review" : pos.kind === "exam" ? pos.exam.title : "Course complete"}
          </h2>
          {replay && <p className="muted small" style={{ margin: "6px 0 0" }}>Your place in the course doesn&apos;t move. <button className="linklike small" onClick={replay.onExit}>Back to where you were</button></p>}
          {pos.kind === "session" && ch && (
            <div className="today-sub">
              <span>Session {pos.session.n} of {pos.chapter.sessions.length}{role ? ` · ${role}` : ""}</span>
              <Stitches total={pos.chapter.sessions.length} done={pos.session.n - 1} now={pos.session.n - 1}
                label={`Session ${pos.session.n} of ${pos.chapter.sessions.length}`} />
            </div>
          )}
          {pos.kind === "stage-review" && <div className="today-sub">Everything so far</div>}
          {pos.kind === "exam" && <div className="today-sub">Open book</div>}
        </div>
        <Streak count={streak} />
      </div>
    );
  }
  const story = currentStory(pack, progress);
  const chapter = story ? chapterSpine.chapterOf(pack, story.id) : undefined;
  const dayIndex = story ? (progress.storyReads?.[story.id]?.length ?? 0) : 0;
  return (
    <div className="today-head">
      <div style={{ minWidth: 0 }}>
        <div className="overline">{chapter ? `Today · chapter ${chapter.order}` : "Today"}</div>
        <h2>{chapter ? chapter.shortTitle : "Your guided session"}</h2>
        {chapter && dayIndex > 0 && <div className="today-sub">Day {dayIndex + 1} with this story</div>}
      </div>
      <Streak count={streak} />
    </div>
  );
}
