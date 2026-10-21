"use client";
import { useMemo } from "react";
import * as scoring from "@ll/core/familiarity/scoring";
import * as chapterSpine from "@ll/core/chapters";
import * as api from "../../lib/api";
import { type Progress } from "../../lib/store";
import * as cp from "../../lib/course-player";
import { SentenceBuilder } from "../build/SentenceBuilder";
import { ScenarioView } from "../conversation/ScenarioView";
import { ChapterHeading, useChapterMap } from "../course/ChapterHeading";
import { Review } from "../flashcards/Review";
import { Grammar, PointLibrary } from "../grammar/PointLibrary";
import { Letters } from "../letters/Letters";
import { PracticeAI, PracticeDecks } from "./PracticeAI";
import { Words } from "./Words";
import { MyNotes } from "../progress/MyNotes";
import { Reading } from "../reading/Reading";
import { StoryView } from "../reading/StoryReader";
import { LibView, Section, coverageOf, difficultyChip, pending, usePack } from "../shared";
import { Writing } from "../writing/Writing";

export function LibrarySection({ progress, persist, config, lettersDone, mode, setMode }: {
  progress: Progress;
  persist: (p: Progress) => void;
  config: api.Config | null;
  lettersDone: boolean;
  mode: LibView;
  setMode: (m: LibView) => void;
}) {
  const pack = usePack();

  // All graded content (scenarios + stories + readers) scored by i+1 fit for this learner.
  const items = useMemo(() => {
    const raw = [
      ...pack.scenarios.map((s) => ({ kind: "scenario" as const, id: s.id, title: s.title, sub: s.setting, theme: s.theme, text: s.script.map((t) => t.text).join(" "), unreviewed: s.confidence === "unreviewed" })),
      ...(pack.stories ?? []).map((st) => ({ kind: "story" as const, id: st.id, title: st.title, sub: st.titleGloss ?? st.level, theme: st.theme, text: st.body.map((b) => b.text).join(" "), unreviewed: st.confidence === "unreviewed" })),
      ...pack.readers.map((r) => ({ kind: "reading" as const, id: r.id, title: r.title, sub: r.titleGloss ?? "graded reader", theme: r.theme, text: r.body.map((b) => b.text).join(" "), unreviewed: r.confidence === "unreviewed" })),
    ];
    return raw
      .map((it) => { const c = coverageOf(it.text, progress.familiarity); return { ...it, knownPct: c.knownPct, familiarPct: c.familiarPct, fit: scoring.iPlusOneCurve(c.familiarPct), chip: difficultyChip(c.familiarPct) }; })
      .sort((a, b) => b.fit - a.fit || b.familiarPct - a.familiarPct || ["story", "reading", "scenario"].indexOf(a.kind) - ["story", "reading", "scenario"].indexOf(b.kind));
  }, [pack, progress.familiarity]);

  // Grouped by CHAPTER (course order), so the Library reads as a table of contents rather than a flat
  // best-fit list — a chapter's scenario, story and reader sit together. Inside a chapter the i+1 sort
  // above still decides the order. Anything the spine doesn't claim lands in a final catch-all.
  const chapterInfo = useChapterMap(progress);
  // On the course, the chapter headings count what the course teaches (sessions, words, grammar points).
  const courseOv = useMemo(() => (cp.courseV2On(pack, progress) && pack.course ? cp.courseOverview(pack, pack.course, progress) : undefined), [pack, progress]);
  const collections = useMemo(() => {
    const ordered = [...(pack.chapters ?? [])].sort((a, b) => a.order - b.order);
    const groups = new Map<string, typeof items>();
    for (const it of items) {
      const key = chapterSpine.chapterOf(pack, it.id)?.id ?? "";
      const arr = groups.get(key);
      if (arr) arr.push(it); else groups.set(key, [it]);
    }
    const out = ordered.filter((c) => groups.has(c.id)).map((c) => ({ chapter: c, list: groups.get(c.id)! }));
    const rest = groups.get("");
    return rest ? [...out, { chapter: undefined, list: rest }] : out;
  }, [items, pack]);

  const open = (kind: LibView, id?: string) => {
    if (kind === "scenario" && id) persist({ ...progress, pick: id });
    else if (kind === "story" && id) persist({ ...progress, storyPick: id });
    else if (kind === "reading" && id) pending.readerId = id;
    setMode(kind);
  };

  // The alphabet is a browsable reference that renders its OWN inline back-header (next to the title),
  // so it opts out of the shared floating back-row below — which is what read as "misplaced".
  if (mode === "letters")
    return <Letters progress={progress} persist={persist} reference onBack={() => setMode("reference")} onDone={() => setMode("reference")} />;

  // An opened content item or reference tool → show it with a back link to where it came from.
  if (mode !== "browse" && mode !== "reference" && mode !== "flashcards" && mode !== "words" && mode !== "practice") {
    const isTool = mode === "grammar" || mode === "write" || mode === "build" || mode === "notes";
    if (mode === "converse") return (
      <>
        <div className="row" style={{ marginBottom: 10 }}><button className="ghost small" onClick={() => setMode("practice")}>← Practice with AI</button></div>
        <PracticeAI progress={progress} persist={persist} chapterId={pending.guidedDeck ?? ""} />
      </>
    );
    // Inside the Library, a link elsewhere in it just switches the view.
    const libNavigate = (_sec: Section, lv?: LibView) => { if (lv) setMode(lv); };
    const view =
      mode === "scenario" ? <ScenarioView progress={progress} persist={persist} config={config} lettersDone={lettersDone} /> :
      mode === "story" ? <StoryView progress={progress} persist={persist} config={config} /> :
      mode === "reading" ? <Reading progress={progress} persist={persist} config={config} /> :
      mode === "grammar" ? (cp.courseV2On(pack, progress) ? <PointLibrary progress={progress} persist={persist} openNotes={(at) => { pending.notesFocus = at; setMode("notes"); }} /> : <Grammar progress={progress} persist={persist} />) :
      mode === "notes" ? <MyNotes progress={progress} persist={persist} navigate={libNavigate} /> :
      mode === "build" ? <SentenceBuilder progress={progress} persist={persist} /> :
      <Writing config={config} />;
    return (
      <>
        <div className="row" style={{ marginBottom: 10 }}><button className="ghost small" onClick={() => setMode(isTool ? "reference" : "browse")}>← {isTool ? "Reference" : "Library"}</button></div>
        {view}
      </>
    );
  }

  const typeLabel: Record<string, string> = { scenario: "🗣 Scenario", story: "★ Story", reading: "📖 Reading" };

  return (
    <section className="view">
      <h2>Library</h2>
      <div className="picker" style={{ margin: "2px 0 14px" }}>
        <button className={mode === "browse" ? "active" : ""} onClick={() => setMode("browse")}>Situations</button>
        <button className={mode === "words" ? "active" : ""} onClick={() => setMode("words")}>Words</button>
        <button className={mode === "flashcards" ? "active" : ""} onClick={() => setMode("flashcards")}>Flashcards</button>
        {!!pack.course?.guided?.length && <button className={mode === "practice" ? "active" : ""} onClick={() => setMode("practice")}>Practice with AI</button>}
        <button className={mode === "reference" ? "active" : ""} onClick={() => setMode("reference")}>Reference</button>
      </div>

      {mode === "words" ? (
        <Words progress={progress} persist={persist} />
      ) : mode === "practice" ? (
        <PracticeDecks progress={progress} onOpen={(id) => { pending.guidedDeck = id; setMode("converse"); }} />
      ) : mode === "flashcards" ? (
        <Review progress={progress} persist={persist} />
      ) : mode === "reference" ? (
        <>
          <p className="lead">Tools to look things up and practise — kept separate from your situational content.</p>
          <div className="cards">
            {cp.courseV2On(pack, progress) && (
              <button className="contentcard" onClick={() => setMode("notes")}>
                <div className="cc-top"><span className="cc-type">📒 My notes</span></div>
                <div className="cc-title">What I&apos;ve learned</div>
                <div className="muted small">Each chapter on one page, and your notes from every lesson</div>
              </button>
            )}
            <button className="contentcard" onClick={() => setMode("letters")}>
              <div className="cc-top"><span className="cc-type">🔤 Alphabet</span>{lettersDone && <span className="diff just">done</span>}</div>
              <div className="cc-title">The alphabet</div>
              <div className="muted small">All {pack.alphabet.length} Cyrillic letters — browse, hear, and quiz</div>
            </button>
            <button className="contentcard" onClick={() => setMode("grammar")}>
              <div className="cc-top"><span className="cc-type">ⓖ Grammar</span></div>
              <div className="cc-title">Grammar reference</div>
              <div className="muted small">Search or browse every point</div>
            </button>
            <button className="contentcard" onClick={() => setMode("write")}>
              <div className="cc-top"><span className="cc-type">✎ Writing</span></div>
              <div className="cc-title">Writing practice</div>
              <div className="muted small">Short prompts; type in Latin, get corrected</div>
            </button>
            <button className="contentcard" onClick={() => setMode("build")}>
              <div className="cc-top"><span className="cc-type">🧩 Build</span></div>
              <div className="cc-title">Build a sentence</div>
              <div className="muted small">Tap tiles to make full sentences — one person (I / you / you all / we / they) per card</div>
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="lead">The course, chapter by chapter. Each chapter holds its own conversation, story and reading — work down the list, or jump to anything you fancy.</p>
          {collections.map(({ chapter, list }) => (
            <div key={chapter?.id ?? "more"} style={{ marginBottom: 18 }}>
              {chapter
                ? <ChapterHeading chapter={chapter} status={chapterInfo.byId.get(chapter.id)} course={courseOv?.chapters.find((c) => c.chapterId === chapter.id)} />
                : <h3 style={{ margin: "18px 0 0" }}>More practice</h3>}
              <div className="cards">
                {list.map((it) => (
                  <button className="contentcard" key={it.kind + it.id} onClick={() => open(it.kind, it.id)}>
                    <div className="cc-top">
                      <span className="cc-type">{typeLabel[it.kind]}</span>
                      <span className={`diff ${it.chip.cls}`}>{it.chip.label}</span>
                    </div>
                    <div className="cc-title">{it.title}</div>
                    <div className="muted small">{it.sub}</div>
                    <div className="muted small" style={{ marginTop: 2 }} title="words you already know or are learning">{Math.round(it.familiarPct * 100)}% familiar{it.unreviewed ? " · ⚠ unreviewed" : ""}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
