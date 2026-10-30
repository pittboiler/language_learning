"use client";
// The study desk (2026-10-26, Jake: on a computer it felt like a phone app): on wide screens the sections move
// into a sidebar with your place in the course, and a rail beside the page holds what's relevant now — today's
// words and point, and your week. (No flashcards-due card: today's warm-up already reviews them, so it only
// pulled you off the day's path — Jake, 2026-10-30.) Narrower screens never show either (globals.css), so phones
// keep the header, the tabs and the bottom bar.
import type { ReactNode } from "react";
import { type Progress } from "../../lib/store";
import { localDay } from "../../lib/daily";
import * as cp from "../../lib/course-player";
import { Icon, SpeakButton, currentStreak, usePack, usePlay, type Section } from "../shared";

export const SECTIONS: [Section, string, "today" | "library" | "progress" | "partner"][] = [
  ["today", "Today", "today"],
  ["library", "Library", "library"],
  ["progress", "Progress", "progress"],
  ["partnered", "Partnered", "partner"],
];

export function Sidebar({ progress, section, onSection, meta, footer }: {
  progress: Progress;
  /** The section shown, or null while a finished lesson is being done again. */
  section: Section | null;
  onSection: (s: Section) => void;
  meta: string;
  footer: ReactNode;
}) {
  const pack = usePack();
  const course = cp.courseV2On(pack, progress) ? pack.course : undefined;
  const at = course ? cp.currentSlot(course, progress) : undefined;
  // Your place in the course: the chapter you're on with one before it and a few after.
  const chapters = course && at ? course.chapters.filter((c) => c.order >= at.order - 1 && c.order <= at.order + 4) : [];
  return (
    <aside className="sidebar">
      <div className="side-brand">
        <h1>{pack.name}</h1>
        <span className="header-meta">{meta}</span>
      </div>
      <nav className="side-nav" aria-label="Sections">
        {SECTIONS.map(([s, label, icon]) => (
          <button key={s} className={section === s ? "active" : ""} aria-current={section === s ? "page" : undefined} onClick={() => onSection(s)}>
            <Icon name={icon} size={20} />{label}
          </button>
        ))}
      </nav>
      {chapters.length > 0 && at && (
        <>
          <div className="side-label">Your course</div>
          <ol className="side-course">
            {chapters.map((c) => {
              const title = (pack.chapters ?? []).find((x) => x.id === c.chapterId)?.shortTitle ?? c.chapterId;
              const state = c.order < at.order ? "done" : c.order === at.order ? "now" : "";
              return <li key={c.chapterId} className={state}><span className="sr-only">{state === "done" ? "Done: " : state === "now" ? "Now: " : ""}</span>{title}</li>;
            })}
          </ol>
        </>
      )}
      <div className="side-foot">{footer}</div>
    </aside>
  );
}

/** The last seven days, oldest first, each on if it's inside the current streak. */
function week(progress: Progress): { day: string; on: boolean; today: boolean }[] {
  const s = progress.streak ?? { count: 0, lastDay: "" };
  const last = s.lastDay ? new Date(`${s.lastDay}T12:00:00`) : null;
  const today = new Date();
  return Array.from({ length: 7 }, (_, k) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - k), 12);
    const ago = last ? Math.round((last.getTime() - d.getTime()) / 86400000) : -1;
    return { day: d.toLocaleDateString("en", { weekday: "narrow" }), on: ago >= 0 && ago < s.count, today: localDay(d) === localDay() };
  });
}

export function Rail({ progress, section }: { progress: Progress; section: Section | null }) {
  const pack = usePack();
  const play = usePlay();
  const pos = cp.courseV2On(pack, progress) && pack.course ? cp.position(pack.course, progress.course) : undefined;
  const session = section === "today" && pos?.kind === "session" ? pos.session : undefined;
  const point = session?.pointId ? pack.course?.points.find((p) => p.id === session.pointId) : undefined;
  const streak = currentStreak(progress);
  return (
    <aside className="rail" aria-label="Alongside">
      {session && session.words.length > 0 && (
        <section className="rail-card">
          <div className="rail-title">Today&apos;s words</div>
          <ul className="rail-words">
            {session.words.map((w) => (
              <li key={w.lexKey}>
                <SpeakButton label={`Play ${w.display}`} onClick={() => play(w.display)} />
                <span><b lang={pack.id}>{w.display}</b> <span className="muted small">{w.gloss}</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {point && (
        <section className="rail-card soft">
          <div className="rail-title" style={{ color: "var(--accent)" }}>Today&apos;s point</div>
          <div style={{ fontWeight: 700 }}>{point.title}</div>
          <div className="small" style={{ lineHeight: 1.5 }}>{point.agenda}</div>
        </section>
      )}
      <section className="rail-card">
        <div className="rail-head"><span className="rail-title">This week</span><span className="muted small">{streak > 0 ? `${streak} ${streak === 1 ? "day" : "days"} in a row` : "Start a streak today"}</span></div>
        <div className="week" role="img" aria-label={`${week(progress).filter((d) => d.on).length} of the last 7 days`}>
          {week(progress).map((d, i) => <span key={i}><i className={`${d.on ? "on" : ""}${d.today ? " today" : ""}`} />{d.day}</span>)}
        </div>
      </section>
    </aside>
  );
}
