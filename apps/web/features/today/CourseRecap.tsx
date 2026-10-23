"use client";
import { useMemo } from "react";
import type { ReviewItem } from "@ll/pack-schema";
import * as familiarity from "@ll/core/familiarity";
import { type Progress } from "../../lib/store";
import { toggleStar, starMany } from "../../lib/capture";
import * as cp from "../../lib/course-player";
import { LibView, MixedText, Section, SpeakButton, pending, usePack, usePlay } from "../shared";

// The end-of-session recap (DESIGN §5), in the order the lesson mattered: what was NEW (a point taught today,
// with its explanation; today's new words), then what you PRACTISED (earlier points, each in one line, quoted
// from today's story; the verbs whose every form you matched), today's grammar cards — each savable to the ★
// deck — what you slipped on, and what's next. (2026-10-22, Jake: a practice day's recap said he'd "learned"
// ли / дали, taught days before, and left out the conjugation he'd practised.)
export function CourseRecap({ pos, since, until, progress, persist, missed, drilled, onReviewMissed, onNext, nextLabel, navigate, notes }: {
  pos: cp.CoursePosition;
  since: Date;
  /** Saved lesson notes: the session's end, so words tapped later don't creep in. */
  until?: Date;
  progress: Progress;
  persist: (p: Progress) => void;
  missed: { answer: string; gloss: string }[];
  /** Verbs whose every form the warm-up matched today (by lemma). */
  drilled?: string[];
  onReviewMissed?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  navigate: (sec: Section, lv?: LibView) => void;
  /** Reopened later as lesson notes (Progress / Library → My notes): a heading and date, no "next" buttons. */
  notes?: { title: string; when?: string };
}) {
  const pack = usePack();
  const play = usePlay();
  const rc = useMemo(() => cp.sessionRecap(pack, pack.course!, pos, progress, since, until, drilled ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pos, since, until, drilled?.join()]);
  const learnedPoints = rc.points.filter((x) => x.fresh);
  const practisedPoints = rc.points.filter((x) => !x.fresh);
  const starred = (k: string) => { const e = progress.familiarity[k]; return !!e && familiarity.isStarred(e); };
  const cardKey = (it: ReviewItem) => familiarity.deriveKeyForItem(it).lexKey;
  const allWordsSaved = rc.words.length > 0 && rc.words.every((w) => starred(w.lexKey));
  const allCardsSaved = rc.cards.length > 0 && rc.cards.every((c) => starred(cardKey(c)));
  // A line of Macedonian with its meaning under it, and a speaker to hear it.
  const exLine = (l: { text: string; gloss?: string; source?: string }) => (
    <div className="gram-ex" key={l.source ?? l.text}>
      <SpeakButton label={`Play ${l.text}`} onClick={() => play(l.text)} />
      <span className="ex-text"><span className="mk" lang={pack.id}>{l.text}</span>{l.gloss && <span className="en">{l.gloss}</span>}</span>
    </div>
  );
  const star = (on: boolean, onClick: () => void) => (
    <button className={`ghost small${on ? " active" : ""}`} aria-pressed={on} aria-label={on ? "Saved to your flashcards" : "Save to your flashcards"} title="Save to your flashcard deck" onClick={onClick}>{on ? "★" : "☆"}</button>
  );
  return (
    <div>
      {notes ? (
        <>
          <div className="overline">Lesson notes</div>
          <h2 className="lesson-title">{notes.title}</h2>
          {notes.when && <div className="step-meta">{notes.when}</div>}
        </>
      ) : <div className="stitch-rule">Today’s recap · session done</div>}
      {pos.kind === "stage-review" && <p className="lead">{notes ? "A stage review: a sample of every chapter in the stage." : "Stage review done: everything you missed is back in your reviews."}</p>}
      {pos.kind === "exam" && <p className="lead">{notes ? `${pos.exam.title}: your results are in Progress → The course.` : `${pos.exam.title} done. Your results are saved in Progress → The course, where you can retake it any time.`}</p>}

      {learnedPoints.map(({ point, fresh, lines }) => (
        <div className="framed write-card recap-card" key={point.id}>
          <div className="overline">What you learned</div>
          <div className="gram-title"><MixedText text={point.title} /></div>
          <p className="recap-text"><MixedText text={point.recap} /></p>
          <button className="linklike small" onClick={() => { pending.pointFocus = point.id; navigate("library", "grammar"); }}>The full rule in the Library</button>
          {lines.length > 0 && (
            <>
              <div className="recap-sub">From today&apos;s story</div>
              <div className="gram-ex-list">{lines.map(exLine)}</div>
            </>
          )}
          {fresh && point.callbacks.length > 0 && (
            <>
              <div className="recap-sub">You&apos;ve already been saying</div>
              <div className="gram-ex-list">{point.callbacks.map(exLine)}</div>
            </>
          )}
        </div>
      ))}

      {rc.letters.length > 0 && (
        <div className="framed write-card recap-card">
          <div className="overline">Letters from today · {rc.letters.length}</div>
          <ul className="recap-list">
            {rc.letters.map((l) => (
              <li key={l.glyph} className="word-row">
                <b lang={pack.id} className="recap-glyph">{l.glyph}</b>
                <span>{l.sound}</span>
                {l.example && <><SpeakButton label={`Play ${l.example}`} onClick={() => play(l.example!)} /><span><span lang={pack.id}>{l.example}</span> <span className="muted small">{l.gloss}</span></span></>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rc.words.length > 0 && (
        <div className="framed write-card recap-card">
          <div className="recap-head">
            <div className="overline">New words · {rc.words.length}</div>
            <button className="ghost small" disabled={allWordsSaved} onClick={() => persist(starMany(progress, rc.words))}>{allWordsSaved ? "★ All saved" : "★ Save all"}</button>
          </div>
          <ul className="recap-list">
            {rc.words.map((w) => (
              <li key={w.lexKey} className="word-row">
                {star(starred(w.lexKey), () => toggleStar(progress, persist, w.lexKey, { gloss: w.gloss }))}
                <SpeakButton label={`Play ${w.display}`} onClick={() => play(w.display)} />
                <b lang={pack.id} className="rmk">{w.display}</b>{w.gloss && <span className="muted small">{w.gloss}</span>}
              </li>
            ))}
          </ul>
          <p className="muted small" style={{ margin: "10px 0 0" }}>They&apos;re already in your reviews; ★ also puts them in your own deck in Flashcards.</p>
        </div>
      )}

      {(practisedPoints.length > 0 || rc.drills.length > 0) && (
        <div className="framed write-card recap-card">
          <div className="overline">What you practised</div>
          {practisedPoints.map(({ point, lines }) => (
            <div key={point.id} className="recap-item">
              <div><b><MixedText text={point.title} /></b> <span className="muted small">· <MixedText text={point.agenda} /></span></div>
              {lines.length > 0 && <div className="gram-ex-list">{lines.slice(0, 2).map(exLine)}</div>}
              <button className="linklike small" onClick={() => { pending.pointFocus = point.id; navigate("library", "grammar"); }}>The rule in the Library</button>
            </div>
          ))}
          {rc.drills.map((d) => (
            <div key={d.lemma} className="recap-item">
              <div><b>Every form of <MixedText text={d.label} /></b> <span className="muted small">· {/^to /.test(d.gloss) ? d.gloss : `to ${d.gloss}`}</span></div>
              <div className="recap-forms">{d.forms.map((f) => <span key={f.pronoun}><span className="muted" lang={pack.id}>{f.pronoun}</span> <b lang={pack.id}>{f.form}</b></span>)}</div>
            </div>
          ))}
        </div>
      )}

      {rc.cards.length > 0 && (
        <div className="framed write-card recap-card">
          <div className="recap-head">
            <div className="overline">Grammar cards from today · {rc.cards.length}</div>
            <button className="ghost small" disabled={allCardsSaved} onClick={() => persist(starMany(progress, rc.cards.map((c) => ({ lexKey: cardKey(c), display: c.prompt, gloss: c.gloss }))))}>{allCardsSaved ? "★ All saved" : "★ Save all"}</button>
          </div>
          <ul className="recap-list">
            {rc.cards.map((c) => (
              <li key={c.id} className="word-row">
                {star(starred(cardKey(c)), () => persist(starred(cardKey(c)) ? { ...progress, familiarity: { ...progress.familiarity, [cardKey(c)]: familiarity.unstar(progress.familiarity[cardKey(c)]!) } } : starMany(progress, [{ lexKey: cardKey(c), display: c.prompt, gloss: c.gloss }])))}
                <span style={{ flex: 1, minWidth: 0 }}><MixedText text={c.prompt} /> <span className="muted" aria-label="answer">→</span> <b><MixedText text={c.answer} /></b></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {missed.length > 0 && (
        <div className="framed write-card recap-card">
          <div className="overline">You slipped on {missed.length}</div>
          <ul className="recap-list">
            {missed.map((m, i) => <li key={i} className="word-row"><b lang={pack.id} className="rmk">{m.answer}</b> <span className="muted small">{m.gloss}</span></li>)}
          </ul>
          {onReviewMissed && <div className="write-actions"><button className="btn" onClick={onReviewMissed}>Review the {missed.length} you missed</button></div>}
        </div>
      )}

      {!notes && rc.next && <p className="recap-next"><MixedText text={rc.next} /></p>}
      {!notes && (
        <div className="row" style={{ marginTop: 14 }}>
          {onNext && <button className="btn" onClick={onNext}>{nextLabel ?? "Start the next session now"}</button>}
          <button className="ghost small" onClick={() => navigate("library", "flashcards")}>Flashcards</button>
          <button className="ghost small" onClick={() => navigate("progress")}>Your progress</button>
        </div>
      )}
    </div>
  );
}
