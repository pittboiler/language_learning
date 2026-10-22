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

  const typeLabel: Record<string, string> = { scenario: "Conversation", story: "Story", reading: "Reading" };
  const cyrillic = (t: string) => /[\u0400-\u04FF]/.test(t);
  const tabs: [LibView, string][] = [
    ["browse", "Situations"], ["words", "Words"], ["flashcards", "Flashcards"],
    ...(pack.course?.guided?.length ? [["practice", "Practice with AI"] as [LibView, string]] : []),
    ["reference", "Reference"],
  ];
  const tool = (key: string, kind: string, title: string, sub: string, onClick: () => void, status?: string) => (
    <button className="lib-item" key={key} onClick={onClick}>
      <span className="lib-kind">{kind}</span>
      <span><span className="lib-title">{title}</span><span className="lib-sub">{sub}</span></span>
      <span className="lib-fit just">{status}</span>
    </button>
  );

  return (
    <section className="view">
      <h2 style={{ fontSize: 32 }}>Library</h2>
      <div className="tabs" role="tablist" aria-label="Library sections">
        {tabs.map(([m, label]) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}>{label}</button>
        ))}
      </div>

      {mode === "words" ? (
        <Words progress={progress} persist={persist} />
      ) : mode === "practice" ? (
        <PracticeDecks progress={progress} onOpen={(id) => { pending.guidedDeck = id; setMode("converse"); }} />
      ) : mode === "flashcards" ? (
        <Review progress={progress} persist={persist} />
      ) : mode === "reference" ? (
        <>
          <p className="lead">Tools to look things up and practise, kept apart from the situations.</p>
          <div className="lib-list">
            {cp.courseV2On(pack, progress) && tool("notes", "My notes", "What I’ve learned", "Each chapter on one page, and your notes from every lesson", () => setMode("notes"))}
            {tool("letters", "Alphabet", "The alphabet", `All ${pack.alphabet.length} Cyrillic letters: browse, hear and quiz`, () => setMode("letters"), lettersDone ? "done" : undefined)}
            {tool("grammar", "Grammar", "Grammar reference", "Search or browse every point", () => setMode("grammar"))}
            {tool("write", "Writing", "Writing practice", "Short prompts; type in Latin and get corrected", () => setMode("write"))}
            {tool("build", "Build", "Build a sentence", "Put tiles in order to make full sentences, one person (I / you / you all / we / they) per card", () => setMode("build"))}
          </div>
        </>
      ) : (
        <>
          <p className="lead">The course, chapter by chapter. Each chapter holds its own conversations, stories and readings: work down the list, or jump to anything you fancy.</p>
          {collections.map(({ chapter, list }) => (
            <div key={chapter?.id ?? "more"} style={{ marginBottom: 18 }}>
              {chapter
                ? <ChapterHeading chapter={chapter} status={chapterInfo.byId.get(chapter.id)} course={courseOv?.chapters.find((c) => c.chapterId === chapter.id)} />
                : <div className="ch-head"><h3>More practice</h3></div>}
              <div className="lib-list">
                {list.map((it) => (
                  <button className="lib-item" key={it.kind + it.id} onClick={() => open(it.kind, it.id)}>
                    <span className="lib-kind">{typeLabel[it.kind]}</span>
                    <span style={{ minWidth: 0 }}>
                      <span className="lib-title" lang={cyrillic(it.title) ? pack.id : undefined}>{it.title}</span>
                      {it.sub && <span className={cyrillic(it.title) ? "lib-sub gloss" : "lib-sub"}>{it.sub}</span>}
                    </span>
                    <span className={`lib-fit ${it.chip.cls}`} title="Words you already know or are learning">
                      {it.chip.label}<small>{Math.round(it.familiarPct * 100)}% familiar{it.unreviewed ? " · unreviewed" : ""}</small>
                    </span>
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
