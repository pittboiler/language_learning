"use client";
import { useState } from "react";
import * as cp from "../../lib/course-player";

// The agenda that opens a session (DESIGN §5): a few seconds to see what today is for. Deliberately brief —
// the detail lives in the recap and the Library.
export function AgendaCard({ agenda, onStart, pointId, onOpenPoint, onSkipChapter }: { agenda: cp.Agenda; onStart: () => void; pointId?: string; onOpenPoint?: (id: string) => void; onSkipChapter?: () => void }) {
  const [confirmSkip, setConfirmSkip] = useState(false);
  // The grammar line follows the warm-up and new-words lines (the agenda runs in the lesson's order).
  const pointLine = agenda.items.findIndex((b) => !/^(Warm-up:|Catch-up:|\d+ new words?:)/.test(b));
  return (
    <div className="fb">
      <div className="gram-kicker">Today's plan</div>
      <div className="gram-title" style={{ fontSize: 17 }}>{agenda.title}</div>
      <ol style={{ margin: "10px 0 4px", paddingLeft: 20 }}>
        {agenda.items.map((it, i) => (
          <li key={i} style={{ margin: "4px 0" }}>
            {it}
            {i === pointLine && pointId && onOpenPoint && <> <button className="linklike small" onClick={() => onOpenPoint(pointId)}>more in the Library</button></>}
          </li>
        ))}
      </ol>
      <button className="btn" style={{ marginTop: 10 }} onClick={onStart}>Let&apos;s go →</button>
      {onSkipChapter && (
        <div className="muted small" style={{ marginTop: 12 }}>
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
