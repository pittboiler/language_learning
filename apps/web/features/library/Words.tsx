"use client";
import { useMemo } from "react";
import type { Chapter, ReviewItem } from "@ll/pack-schema";
import * as familiarity from "@ll/core/familiarity";
import * as chapterSpine from "@ll/core/chapters";
import { type Progress } from "../../lib/store";
import { toggleStar } from "../../lib/capture";
import * as cp from "../../lib/course-player";
import { Icon, SpeakButton, usePack, usePlay, wordStatus } from "../shared";

// ---------- Library → Words: browse the core vocabulary by chapter and pick up words on demand ----------
// The flashcard deck only surfaces words you've MET, so this is where you meet single words directly:
// tap ＋ to capture one (it becomes a studied, due card in the Words flashcard filter).
export function Words({ progress, persist }: { progress: Progress; persist: (p: Progress) => void }) {
  const pack = usePack();
  const play = usePlay();
  // Grouped by chapter, in course order — the same spine as the Library and Progress, so a word is
  // always findable by the chapter that teaches it (the old tag grouping put every generated word in a
  // single "more words" heap). Words the spine doesn't claim keep a catch-all at the end.
  const course = cp.courseV2On(pack, progress) ? pack.course : undefined;
  const groups = useMemo(() => {
    const single = pack.vocab.filter((v) => v.kind === "vocab" && !/\s/.test(v.answer.trim()));
    const byChapter = new Map<string, ReviewItem[]>();
    for (const v of single) {
      // On the course: the chapter that teaches the word (a bundle's words go with the bundle).
      const key = course ? cp.chapterOfWord(course, familiarity.deriveKeyForItem(v).lexKey)?.chapterId ?? "" : chapterSpine.chapterOfVocab(pack, v)?.id ?? "";
      const arr = byChapter.get(key);
      if (arr) arr.push(v); else byChapter.set(key, [v]);
    }
    const ordered = [...(pack.chapters ?? [])].sort((a, b) => a.order - b.order);
    const out: { chapter?: Chapter; label: string; items: ReviewItem[] }[] = ordered
      .filter((c) => byChapter.get(c.id)?.length)
      .map((c) => ({ chapter: c, label: `${c.order}. ${c.shortTitle}`, items: byChapter.get(c.id)! }));
    const rest = byChapter.get("");
    return rest?.length ? [...out, { chapter: undefined, label: course ? "more words (not in the lessons)" : "more words", items: rest }] : out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack, !!course]);
  const isExtra = (it: ReviewItem) => !!course && !!cp.chapterOfWord(course, familiarity.deriveKeyForItem(it).lexKey)?.extra;
  // A word learned inside a taught bundle ("два, три, четири, пет") counts as learning, not new.
  const statusOf = (key: string) => { const st = wordStatus(progress, key); return st === "new" && course && cp.learnedInBundle(course, progress, key) ? "learning" : st; };

  const learn = (items: ReviewItem[]) => {
    const fam = { ...progress.familiarity };
    for (const it of items) {
      const spec = familiarity.deriveKeyForItem(it);
      const existing = fam[spec.lexKey];
      // Marked as your own pick, so the course's review days bring it back.
      fam[spec.lexKey] = familiarity.markPicked(existing ? familiarity.markStudied(existing) : familiarity.capture(spec));
    }
    persist({ ...progress, familiarity: fam });
  };

  const all = groups.flatMap((g) => g.items);
  const started = all.filter((it) => statusOf(familiarity.deriveKeyForItem(it).lexKey) !== "new").length;

  return (
    <>
      <p className="lead">The vocabulary, chapter by chapter. Tap the speaker to hear a word, <b>☆</b> to save it to your Starred flashcards, or <b>Learn</b> to start it so it comes up in review. {started} of {all.length} started.</p>
      {groups.map(({ chapter, label, items }) => {
        const unmet = items.filter((it) => statusOf(familiarity.deriveKeyForItem(it).lexKey) === "new");
        return (
          <div key={chapter?.id ?? label} className="word-group">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <h3 style={{ margin: "26px 0 6px" }} title={chapter?.title}>{label}</h3>
              {unmet.length > 0 && <button className="ghost small" onClick={() => learn(unmet)}><Icon name="plus" size={14} />Learn all {unmet.length}</button>}
            </div>
            {/* On the course a chapter's own lesson words come first; its extra words (Library-only) after. */}
            {[items.filter((it) => !isExtra(it)), items.filter(isExtra)].map((list, li) => list.length > 0 && (
              <div key={li}>
                {li === 1 && <div className="muted small" style={{ margin: "10px 0 4px" }}>More words for this chapter (not in the lessons): pick them up here if you like.</div>}
                <div className="word-list">
                  {list.map((it) => {
                    const key = familiarity.deriveKeyForItem(it).lexKey;
                    const status = statusOf(key);
                    const gender = it.meta?.gender ? ` · ${String(it.meta.gender)}` : "";
                    const on = !!progress.familiarity[key] && familiarity.isStarred(progress.familiarity[key]!);
                    return (
                      <div className="word-row" key={it.id}>
                        <SpeakButton label={`Play ${it.answer}`} onClick={() => play(it.answer, 0.9)} />
                        <span className="word-mk"><b lang={pack.id}>{it.answer}</b> <span className="translit">{it.translit}</span></span>
                        <span className="word-gloss muted small">{it.gloss}{gender}</span>
                        <button className={`ghost small${on ? " active" : ""}`} aria-pressed={on} aria-label={on ? "Saved to your flashcards" : "Save to your flashcards"} title="Save to your flashcard deck" onClick={() => toggleStar(progress, persist, it.answer, { gloss: it.gloss })}>{on ? "★" : "☆"}</button>
                        {status === "new"
                          ? <button className="ghost small" onClick={() => learn([it])}><Icon name="plus" size={14} />Learn</button>
                          : <span className={`word-status${status === "known" ? " known" : ""}`}>{status === "known" ? "known" : "learning"}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
