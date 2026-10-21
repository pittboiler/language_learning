"use client";
import { useMemo } from "react";
import type { ReviewItem } from "@ll/pack-schema";
import * as familiarity from "@ll/core/familiarity";
import { type Progress } from "../../lib/store";
import { toggleStar, starMany } from "../../lib/capture";
import * as cp from "../../lib/course-player";
import { LibView, Section, pending, usePack, usePlay } from "../shared";

// The end-of-session recap (DESIGN §5): what you learned (the point's recap, quoted from today's own lines),
// every word from today and today's grammar cards — each savable to the ★ deck — what you slipped on, and
// what's next. More detail than the agenda, still not a textbook: the Library holds the rest.
export function CourseRecap({ pos, since, until, progress, persist, missed, onReviewMissed, onNext, nextLabel, navigate, notes }: {
  pos: cp.CoursePosition;
  since: Date;
  /** Saved lesson notes: the session's end, so words tapped later don't creep in. */
  until?: Date;
  progress: Progress;
  persist: (p: Progress) => void;
  missed: { answer: string; gloss: string }[];
  onReviewMissed?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  navigate: (sec: Section, lv?: LibView) => void;
  /** Reopened later as lesson notes (Progress / Library → My notes): a heading and date, no "next" buttons. */
  notes?: { title: string; when?: string };
}) {
  const pack = usePack();
  const play = usePlay();
  const rc = useMemo(() => cp.sessionRecap(pack, pack.course!, pos, progress, since, until),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pos, since, until]);
  const starred = (k: string) => { const e = progress.familiarity[k]; return !!e && familiarity.isStarred(e); };
  const cardKey = (it: ReviewItem) => familiarity.deriveKeyForItem(it).lexKey;
  const allWordsSaved = rc.words.length > 0 && rc.words.every((w) => starred(w.lexKey));
  const allCardsSaved = rc.cards.length > 0 && rc.cards.every((c) => starred(cardKey(c)));
  return (
    <div>
      {notes ? (
        <>
          <h3 style={{ marginTop: 4, marginBottom: 2 }}>Lesson notes · {notes.title}</h3>
          {notes.when && <p className="muted small" style={{ marginTop: 0 }}>{notes.when}</p>}
        </>
      ) : <h3 style={{ marginTop: 4 }}>Today&apos;s recap</h3>}
      {pos.kind === "stage-review" && <p className="lead">{notes ? "A stage review: a sample of every chapter in the stage." : "Stage review done — everything you missed is back in your reviews."}</p>}
      {pos.kind === "exam" && <p className="lead">{notes ? `${pos.exam.title}: your results are in Progress → The course.` : `${pos.exam.title} done. Your results are saved in Progress → The course, where you can retake it any time.`}</p>}

      {rc.points.map(({ point, fresh, lines }) => (
        <div className="fb" key={point.id} style={{ marginBottom: 12 }}>
          <div className="gram-kicker">{fresh ? "What you learned" : "What you practised"}</div>
          <div className="gram-title">{point.title}</div>
          <p style={{ margin: "6px 0" }}>{point.recap}</p>
          <button className="linklike small" onClick={() => { pending.pointFocus = point.id; navigate("library", "grammar"); }}>The full rule in the Library</button>
          {lines.length > 0 && (
            <>
              <div className="muted small" style={{ marginTop: 8 }}>From today&apos;s story</div>
              <div className="gram-ex-list">
                {lines.map((l) => (
                  <div className="gram-ex" key={l.source}>
                    <button className="gram-play" onClick={() => play(l.text)} aria-label={`Play ${l.text}`}>▶</button>
                    <span className="mk">{l.text}</span><span className="en">{l.gloss}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {fresh && point.callbacks.length > 0 && (
            <>
              <div className="muted small" style={{ marginTop: 8 }}>You&apos;ve already been saying</div>
              <div className="gram-ex-list">
                {point.callbacks.map((l) => (
                  <div className="gram-ex" key={l.source}>
                    <button className="gram-play" onClick={() => play(l.text)} aria-label={`Play ${l.text}`}>▶</button>
                    <span className="mk">{l.text}</span><span className="en">{l.gloss}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ))}

      {rc.letters.length > 0 && (
        <div className="fb" style={{ marginBottom: 12 }}>
          <div className="gram-kicker">Letters from today · {rc.letters.length}</div>
          <ul style={{ margin: "6px 0 0", paddingLeft: 0, listStyle: "none" }}>
            {rc.letters.map((l) => (
              <li key={l.glyph} className="row" style={{ gap: 8, margin: "4px 0" }}>
                <b className="target" style={{ fontSize: 22, minWidth: 28 }}>{l.glyph}</b>
                <span>{l.sound}</span>
                {l.example && <><button className="gram-play" onClick={() => play(l.example!)} aria-label={`Play ${l.example}`}>▶</button><span className="muted small">{l.example} — {l.gloss}</span></>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rc.words.length > 0 && (
        <div className="fb" style={{ marginBottom: 12 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="gram-kicker">Words from today · {rc.words.length}</div>
            <button className="ghost small" disabled={allWordsSaved} onClick={() => persist(starMany(progress, rc.words))}>{allWordsSaved ? "★ All saved" : "★ Save all"}</button>
          </div>
          <ul style={{ margin: "6px 0 0", paddingLeft: 0, listStyle: "none" }}>
            {rc.words.map((w) => (
              <li key={w.lexKey} className="row" style={{ gap: 8, margin: "4px 0" }}>
                <button className={`ghost small${starred(w.lexKey) ? " active" : ""}`} title="Save to your flashcard deck" onClick={() => toggleStar(progress, persist, w.lexKey, { gloss: w.gloss })}>{starred(w.lexKey) ? "★" : "☆"}</button>
                <button className="gram-play" onClick={() => play(w.display)} aria-label={`Play ${w.display}`}>▶</button>
                <b className="target">{w.display}</b>{w.gloss && <span className="muted small">— {w.gloss}</span>}
              </li>
            ))}
          </ul>
          <p className="muted small" style={{ margin: "8px 0 0" }}>They&apos;re already in your reviews; ★ also puts them in your own deck in Flashcards.</p>
        </div>
      )}

      {rc.cards.length > 0 && (
        <div className="fb" style={{ marginBottom: 12 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="gram-kicker">Grammar cards from today · {rc.cards.length}</div>
            <button className="ghost small" disabled={allCardsSaved} onClick={() => persist(starMany(progress, rc.cards.map((c) => ({ lexKey: cardKey(c), display: c.prompt, gloss: c.gloss }))))}>{allCardsSaved ? "★ All saved" : "★ Save all"}</button>
          </div>
          <ul style={{ margin: "6px 0 0", paddingLeft: 0, listStyle: "none" }}>
            {rc.cards.map((c) => (
              <li key={c.id} className="row" style={{ gap: 8, margin: "4px 0" }}>
                <button className={`ghost small${starred(cardKey(c)) ? " active" : ""}`} title="Save to your flashcard deck" onClick={() => persist(starred(cardKey(c)) ? { ...progress, familiarity: { ...progress.familiarity, [cardKey(c)]: familiarity.unstar(progress.familiarity[cardKey(c)]!) } } : starMany(progress, [{ lexKey: cardKey(c), display: c.prompt, gloss: c.gloss }]))}>{starred(cardKey(c)) ? "★" : "☆"}</button>
                <span>{c.prompt} → <b className="target">{c.answer}</b></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {missed.length > 0 && (
        <div className="fb" style={{ marginBottom: 12 }}>
          <div className="gram-kicker">You slipped on {missed.length}</div>
          <ul style={{ margin: "6px 0 4px", paddingLeft: 18 }}>
            {missed.map((m, i) => <li key={i}><b className="target">{m.answer}</b> <span className="muted small">— {m.gloss}</span></li>)}
          </ul>
          {onReviewMissed && <button className="btn" onClick={onReviewMissed}>Review {missed.length} missed →</button>}
        </div>
      )}

      {!notes && rc.next && <p className="lead" style={{ margin: "8px 0" }}>{rc.next}</p>}
      {!notes && (
        <div className="row" style={{ marginTop: 4 }}>
          {onNext && <button className="btn" onClick={onNext}>{nextLabel ?? "Start the next session now →"}</button>}
          <button className="ghost small" onClick={() => navigate("library", "flashcards")}>Flashcards</button>
          <button className="ghost small" onClick={() => navigate("progress")}>Your progress</button>
        </div>
      )}
    </div>
  );
}
