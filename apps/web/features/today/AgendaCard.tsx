"use client";
import { useState } from "react";
import * as cp from "../../lib/course-player";
import { MixedText } from "../shared";

/** "3 new words: имам, давам" → a menu line ("3 new words") and its detail ("имам, давам"). */
function splitLine(item: string): { label: string; detail?: string } {
  const at = item.indexOf(": ");
  return at > 0 ? { label: item.slice(0, at), detail: item.slice(at + 2) } : { label: item };
}

// The agenda that opens a session (DESIGN §5): a few seconds to see what today is for, set as a café menu.
// Deliberately brief — the detail lives in the recap and the Library. The title (chapter and session) is
// already in the header above it.
export function AgendaCard({ agenda, onStart, pointId, onOpenPoint, onSkipChapter }: { agenda: cp.Agenda; onStart: () => void; pointId?: string; onOpenPoint?: (id: string) => void; onSkipChapter?: () => void }) {
  const [confirmSkip, setConfirmSkip] = useState(false);
  // The grammar line follows the warm-up and new-words lines (the agenda runs in the lesson's order).
  const pointLine = agenda.items.findIndex((b) => !/^(Warm-up:|Catch-up:|\d+ new words?:)/.test(b));
  return (
    <div>
      <div className="framed menu">
        <div className="menu-title">Today’s menu</div>
        <ol className="menu-list">
          {agenda.items.map((it, i) => {
            const { label, detail } = splitLine(it);
            const more = i === pointLine && pointId && onOpenPoint
              ? <> <button className="linklike small" onClick={() => onOpenPoint(pointId)}>More in the Library</button></> : null;
            return (
              <li key={i}>
                <span className="menu-n" aria-hidden="true">{i + 1}</span>
                <span className="menu-label"><MixedText text={label} />{!detail && more}</span>
                {detail && <span className="menu-detail"><MixedText text={detail} />{more}</span>}
              </li>
            );
          })}
        </ol>
      </div>
      <button className="btn menu-cta" onClick={onStart}>Start today’s session</button>
      {onSkipChapter && (
        <div className="muted small" style={{ marginTop: 14 }}>
          {!confirmSkip ? (
            <>Already read Cyrillic? <button className="linklike small" onClick={() => setConfirmSkip(true)}>Skip chapter 0</button></>
          ) : (
            <span>
              Skip to chapter 1? The letters count as learned; the full alphabet stays in Library → Reference.{" "}
              <button className="btn small" onClick={onSkipChapter}>Yes, skip</button>{" "}
              <button className="ghost small" onClick={() => setConfirmSkip(false)}>Cancel</button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
