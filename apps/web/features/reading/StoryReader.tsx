"use client";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import type { MiniStory, ReviewItem } from "@ll/pack-schema";
import * as familiarity from "@ll/core/familiarity";
import * as scoring from "@ll/core/familiarity/scoring";
import * as api from "../../lib/api";
import { type Progress } from "../../lib/store";
import { captureWord, properNounLike } from "../../lib/capture";
import * as cp from "../../lib/course-player";
import { switchableVerbs, rotate, shuffle, type StoryLens } from "../../lib/today-plan";
import { TileBuilder } from "../build/SentenceBuilder";
import { CoursePointChips, HaveAQuestion, LearnerTurn, ScenarioGrammar } from "../conversation/ScenarioView";
import { HighlightLegend, TappableText, WordPanel } from "./Reading";
import { Icon, SlowContext, SpeakButton, seedStoryVocab, storyGrammarIds, usePack, usePlay } from "../shared";

// ---------- shared story reader (synced audio + tap-capture) — used by Today and the Library Story view ----------

export function StoryReader({ story, progress, persist, config, onDone, doneLabel, askable, lens }: {
  lens?: StoryLens;
  story: MiniStory;
  progress: Progress;
  persist: (p: Progress) => void;
  config: api.Config | null;
  onDone: () => void;
  doneLabel: string;
  askable?: boolean;
}) {
  const pack = usePack();
  const play = usePlay();
  const course = cp.courseV2On(pack, progress) ? pack.course : undefined;
  const [sel, setSel] = useState<{ lexKey: string; surface: string; line: string } | null>(null);
  const [current, setCurrent] = useState(-1);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  // Set-phrase notes for this story's lines (line index → note), shown with a line's English.
  const noteOf = useMemo(() => {
    const prefix = `story:${story.id}#`;
    return new Map((pack.course?.chunkNotes ?? []).filter((n) => n.source.startsWith(prefix)).map((n) => [Number(n.source.slice(prefix.length)), n.note]));
  }, [pack, story.id]);
  const speed = useContext(SlowContext);
  const playing = useRef(false);

  // Prefetch glosses for the SLOW words — those NOT in pack vocab, which hit Haiku (~1-3s) on tap — so the
  // word panel is instant when tapped (the lookup already ran in the background). Pack-vocab words are
  // already instant, so we skip them; deduped by word, throttled to 3 at a time, cancelled on unmount.
  useEffect(() => {
    let cancelled = false;
    const vocab = new Set(pack.vocab.map((v) => familiarity.normalize(v.answer)));
    const seen = new Set<string>();
    const jobs: { surface: string; line: string }[] = [];
    for (const l of story.body) {
      for (const t of scoring.tokenize(l.text)) {
        if (!t.isWord) continue;
        const norm = familiarity.normalize(t.surface);
        if (!norm || seen.has(norm) || vocab.has(norm)) continue;
        seen.add(norm);
        jobs.push({ surface: t.surface, line: l.text });
      }
    }
    // Cap eager warm-up cost: the earliest words (reading order) are tapped first; the rest lazy-load on
    // tap and are cached from then on. So this bounds Haiku spend per story open without slowing real taps.
    const queue = jobs.slice(0, 16);
    let i = 0;
    const worker = async () => {
      while (!cancelled && i < queue.length) {
        const j = queue[i++]!;
        try { await api.gloss(j.surface, j.line, pack.id); } catch { /* best-effort warm-up */ }
      }
    };
    void Promise.all([worker(), worker(), worker()]);
    return () => { cancelled = true; };
  }, [story.id, pack.id, pack.vocab]);

  const onTap = (surface: string, line: string, lineGloss?: string) => {
    const lexKey = captureWord(progress, persist, surface, line, { gloss: lineGloss, reviewable: !properNounLike(surface, pack) });
    if (lexKey) setSel({ lexKey, surface, line });
  };

  // Play segments in sequence, highlighting the current line (toggle = stop).
  const playAll = async () => {
    if (playing.current) { playing.current = false; setCurrent(-1); return; }
    playing.current = true;
    for (let i = 0; i < story.body.length; i++) {
      if (!playing.current) break;
      setCurrent(i);
      try { await api.playClip(story.body[i]!.text, speed, pack.id); } catch { break; }
    }
    playing.current = false;
    setCurrent(-1);
  };

  return (
    <>
      <p className="lead">Listen and read along, and tap any word to look it up. Read each line, then tap the blurred English to check yourself.</p>
      <HighlightLegend />
      {lens
        ? <div className="lens-banner">{lens.label}{Object.keys(lens.focus).length ? <> The words that carry it are <mark className="focus-word">outlined</mark>.</> : null}</div>
        : course
          ? <CoursePointChips sources={story.body.map((_, i) => `story:${story.id}#${i}`)} progress={progress} label="Grammar in this story:" />
          : <ScenarioGrammar ids={storyGrammarIds(pack, story)} label="Grammar in this story:" />}
      <div className="reader-tools">
        <button className="ghost" onClick={playAll}><Icon name={current >= 0 ? "stop" : "speaker"} size={16} />{current >= 0 ? "Stop" : "Play the story"}</button>
        <span className="muted small">Shadow each line: listen, then say it back.</span>
      </div>
      <div className="reader">
        {story.body.map((l, i) => (
          <div className={`rline2 rline-glossed ${current === i ? "playing" : ""} ${lens?.highlight.includes(i) ? "rline-lens" : ""}`} key={i}>
            <div className="rline-mk">
              <SpeakButton onClick={() => play(l.text, speed)} />
              <TappableText text={l.text} progress={progress} onTapWord={(s) => onTap(s, l.text, l.gloss)} focus={lens?.focus[i]} />
            </div>
            {l.gloss && (
              <button
                type="button"
                className={`rline-en ${revealed[i] ? "shown" : ""}`}
                title={revealed[i] ? "Tap to hide" : "Tap to reveal the English"}
                onClick={() => setRevealed((r) => ({ ...r, [i]: !r[i] }))}
              >
                {l.gloss}
              </button>
            )}
            {/* A line that leans on grammar from a later chapter explains itself with its English, on tap. */}
            {revealed[i] && noteOf.get(i) && <div className="rline-note">{noteOf.get(i)}</div>}
          </div>
        ))}
      </div>
      {sel && <WordPanel key={sel.lexKey} sel={sel} progress={progress} persist={persist} config={config} onClose={() => setSel(null)} />}
      {askable && <HaveAQuestion convoId={story.id} lines={story.body} conceptIds={storyGrammarIds(pack, story)} sources={story.body.map((_, i) => `story:${story.id}#${i}`)} progress={progress} />}
      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn" onClick={onDone}>{doneLabel.replace(/\s*→$/, "")}</button>
      </div>
    </>
  );
}
// ---------- Library view 5: mini-story (read → Q&A → speaking pipeline) ----------
export function StoryView({ progress, persist, config, onDone }: { progress: Progress; persist: (p: Progress) => void; config: api.Config | null; onDone?: () => void }) {
  const pack = usePack();
  const story = pack.stories?.find((s) => s.id === progress.storyPick) ?? pack.stories?.[0];
  const [phase, setPhase] = useState<"read" | "qa">("read");
  // On the course: exercises on the grammar you've been taught that this story uses (no single focus).
  const libUseIt = useMemo(() => {
    if (!story || !pack.course || !cp.courseV2On(pack, progress)) return [];
    const used = new Set(story.body.flatMap((_, i) => pack.course!.lineTags[`story:${story.id}#${i}`] ?? []));
    const taught = pack.course.points.filter((pt) => used.has(pt.id) && progress.seenGrammar?.[pt.id]).map((pt) => pt.id);
    return taught.length ? cp.useItItems(pack.course, story, taught, (progress.storyReads?.[story.id]?.length ?? 0)) : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack, story?.id, phase]);

  if (!story) return <section className="view"><h2>Story</h2><p className="lead">No stories yet for this pack.</p></section>;

  // Reading the story seeds its vocab into familiarity → moves the known-word count.
  const toQA = () => {
    persist(seedStoryVocab(progress, story));
    setPhase("qa");
  };

  return (
    <section className="view">
      <div className="overline" style={{ marginTop: 12 }}>Story</div>
      <h2 lang={pack.id} style={{ fontSize: 30, margin: "4px 0 2px" }}>{story.title}</h2>
      <div className="gloss" style={{ fontSize: 16 }}>{story.titleGloss}</div>
      {story.audioSource === "tts" && <p className="muted small" style={{ margin: "6px 0 14px" }}>Computer-voiced for now; a native speaker&apos;s recording is coming.</p>}
      {phase === "read" ? (
        <StoryReader
          story={story}
          progress={progress}
          persist={persist}
          config={config}
          doneLabel={`I read it → questions (+${story.registersVocab.length} words)`}
          onDone={toQA}
        />
      ) : libUseIt.length ? (
        <UseIt items={libUseIt} config={config} onRestart={() => setPhase("read")} onDone={onDone} />
      ) : (
        <StoryQAView story={story} config={config} onRestart={() => setPhase("read")} onDone={onDone} />
      )}
    </section>
  );
}
export function StoryQAView({ story, config, onRestart, onDone, dayIndex = 0 }: { story: MiniStory; config: api.Config | null; onRestart: () => void; onDone?: () => void; dayIndex?: number }) {
  const play = usePlay();
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  // Rotate the questions by day so a repeated story asks them in a fresh order (different lead + spoken
  // prompt each pass) rather than an identical quiz.
  const qa = rotate(story.qa, dayIndex);
  return (
    <div>
      <p className="lead">Questions — the story's words again, in a new frame.</p>
      {qa.map((q) => (
        <div className="fb" key={q.id}>
          <div className="row"><SpeakButton onClick={() => play(q.question, 0.9)} /><b className="rmk">{q.question}</b></div>
          <div className="gloss">{q.questionGloss}</div>
          {q.spokenPrompt ? (
            answered[q.id] ? (
              <div className="row" style={{ marginTop: 8 }}>
                <span className="muted small">✓ done —</span>
                <span className="target">{q.answer}</span>
                <span className="muted small">· {q.answerGloss}</span>
              </div>
            ) : (
              <div style={{ marginTop: 8 }}>
                <div className="muted small">Answer aloud — say:</div>
                <LearnerTurn turn={{ speaker: "learner", text: q.answer, translit: q.answerTranslit, gloss: q.answerGloss }} config={config} onDone={() => setAnswered((s) => ({ ...s, [q.id]: true }))} />
              </div>
            )
          ) : revealed[q.id] ? (
            <div className="row" style={{ marginTop: 6 }}><SpeakButton onClick={() => play(q.answer, 0.9)} /> <span className="target">{q.answer}</span> <span className="muted small">· {q.answerGloss}</span></div>
          ) : (
            <button className="ghost" style={{ marginTop: 8 }} onClick={() => setRevealed((s) => ({ ...s, [q.id]: true }))}>Reveal answer</button>
          )}
        </div>
      ))}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="ghost" onClick={onRestart}><Icon name="restart" size={16} />Read again</button>
        {onDone && <button className="btn" onClick={onDone}>Done</button>}
      </div>
    </div>
  );
}
// Today's story step: read → Q&A → speak. Mirrors the Library's StoryView phasing, but uses the
// session's chosen story and advances the daily flow on completion — the Q&A is the input→output
// bridge (recall the story's words, last question spoken) before the full speak scenario.
export function TodayStoryStep({ story, progress, persist, config, onDone, onMiss, dayIndex = 0, lens }: {
  lens?: StoryLens;
  story: MiniStory;
  progress: Progress;
  persist: (p: Progress) => void;
  config: api.Config | null;
  onDone: () => void;
  onMiss?: (item: ReviewItem) => void;
  dayIndex?: number;
}) {
  const pack = usePack();
  const [phase, setPhase] = useState<"read" | "qa">("read");
  // The course: a few exercises on today's focus, from the story's own lines. Otherwise the story's questions.
  // …plus "Switch the person": one of the story's lines told about someone else (any verb taught by now), so
  // every reading drills a different person in a familiar sentence.
  const useIt = useMemo(() => {
    if (!pack.course || !lens) return [];
    const items = cp.useItItems(pack.course, story, lens.points, dayIndex);
    const sw = cp.switchPersonItem(pack, story, switchableVerbs(pack, progress), (w) => properNounLike(w, pack), dayIndex);
    return sw ? [...items.slice(0, 2), sw, ...items.slice(2)] : items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack, story, lens, dayIndex, progress.seenGrammar, progress.course]);
  const hasQA = useIt.length > 0 || story.qa.length > 0;
  // Seed the story's vocab when moving on so the exercises reuse words now marked as met.
  const toQA = () => { persist(seedStoryVocab(progress, story)); setPhase("qa"); };
  return phase === "read" ? (
    <StoryReader
      story={story}
      lens={lens}
      progress={progress}
      persist={persist}
      config={config}
      askable
      doneLabel={useIt.length ? `I read it → use it (${useIt.length})` : hasQA ? `I read it → ${story.qa.length} questions` : "I read it → speak"}
      onDone={hasQA ? toQA : onDone}
    />
  ) : useIt.length ? (
    <UseIt items={useIt} config={config} onMiss={onMiss} onRestart={() => setPhase("read")} onDone={onDone} />
  ) : (
    <StoryQAView story={story} config={config} onRestart={() => setPhase("read")} onDone={onDone} dayIndex={dayIndex} />
  );
}
// "Use it": a few quick exercises on today's focus after the story, each a little more productive than the
// last — understand a line, pick the missing form, build a line from its words, say one aloud. Built from the
// story's own lines (cp.useItItems), so they practise the lesson at hand. Misses join the session's recap.
export function UseIt({ items, config, onMiss, onRestart, onDone, lead }: {
  /** The line above the exercises (default: the story's "Use it"). */
  lead?: string;
  items: cp.UseItItem[];
  config: api.Config | null;
  onMiss?: (item: ReviewItem) => void;
  onRestart?: () => void;
  onDone?: () => void;
}) {
  const play = usePlay();
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const it = items[i];
  const options = useMemo(() => (it && (it.kind === "understand" || it.kind === "complete" || it.kind === "switch") ? shuffle(it.options) : []), [it]);
  const asCard = (l: { text: string; gloss: string; source: string }): ReviewItem => ({ id: `use-${l.source}`, kind: "phrase", prompt: l.gloss, answer: l.text, gloss: l.gloss, i1Level: 0, tags: [] });
  const next = () => { setPicked(null); setFinished(false); if (i + 1 < items.length) setI(i + 1); else onDone?.(); };
  if (!it) return null;
  const answer = it.kind === "understand" ? it.line.gloss : it.kind === "complete" || it.kind === "switch" ? it.blank : "";
  const choose = (o: string) => {
    if (picked) return;
    setPicked(o); setFinished(true);
    if (o !== answer) onMiss?.(it.kind === "switch" ? { ...asCard(it.line), id: `use-switch-${it.line.source}-${it.person}`, prompt: `${cp.PRONOUN[it.person].en}: ${it.shown}`, answer: it.filled } : asCard(it.line));
  };
  const head = { understand: "What does it mean?", complete: "Complete the line", build: "Build the line", say: "Say it", switch: "Switch the person" }[it.kind];
  return (
    <div>
      <p className="lead" style={{ marginBottom: 6 }}>{lead ?? <>Use it: today&apos;s focus, in the story&apos;s own lines.</>}</p>
      <div className="fb">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <div className="gram-kicker">{head}</div>
          <span className="muted small">{i + 1} of {items.length}</span>
        </div>
        {it.kind === "understand" && (
          <>
            <div className="row" style={{ margin: "8px 0" }}><SpeakButton onClick={() => play(it.line.text)} /><b className="target">{it.line.text}</b></div>
            <div>{options.map((o) => <button key={o} className={picked ? (o === answer ? "opt right" : o === picked ? "opt wrong" : "opt") : "opt"} disabled={!!picked} onClick={() => choose(o)}>{o}</button>)}</div>
          </>
        )}
        {it.kind === "complete" && (
          <>
            <div className="row" style={{ margin: "8px 0 2px" }}><SpeakButton onClick={() => play(it.line.text)} /><b className="target">{cp.blankOut(it.line.text, it.blank)}</b></div>
            <div className="muted small" style={{ marginBottom: 4 }}>{it.line.gloss}</div>
            <div>{options.map((o) => <button key={o} className={picked ? (o === answer ? "opt right" : o === picked ? "opt wrong" : "opt") : "opt"} disabled={!!picked} onClick={() => choose(o)}>{o}</button>)}</div>
            {picked && <div className="why">{picked === answer ? "✓ " : "✗ "}{it.why}</div>}
          </>
        )}
        {it.kind === "switch" && (
          <>
            <div className="row" style={{ margin: "8px 0 2px" }}><SpeakButton onClick={() => play(it.line.text)} /><span className="target">{it.line.text}</span></div>
            <div className="muted small" style={{ marginBottom: 6 }}>{it.line.gloss}</div>
            <div className="lead" style={{ margin: "4px 0" }}>Now about <b>{cp.PRONOUN[it.person].mk}</b> ({cp.PRONOUN[it.person].en}):</div>
            <div style={{ margin: "2px 0 6px" }}><b className="target">{picked ? it.filled : it.shown}</b>{picked && <SpeakButton onClick={() => play(it.filled)} />}</div>
            <div>{options.map((o) => <button key={o} className={picked ? (o === answer ? "opt right" : o === picked ? "opt wrong" : "opt") : "opt"} disabled={!!picked} onClick={() => choose(o)}>{o}</button>)}</div>
            {picked && <div className="why">{picked === answer ? "✓ " : "✗ "}{it.why}</div>}
          </>
        )}
        {it.kind === "build" && (
          <>
            {/* The builder's own Next / Got it moves on: no second button here. */}
            <TileBuilder key={it.line.source} variant={{ en: it.line.gloss, mk: it.line.text }} onFinish={(outcome) => { if (outcome === "revealed") onMiss?.(asCard(it.line)); next(); }} />
          </>
        )}
        {it.kind === "say" && (
          <>
            <div className="muted small" style={{ margin: "6px 0" }}>Say this line out loud.</div>
            {/* Its own Next (after speaking) or "Skip / I said it" moves on: no second button here. */}
            <LearnerTurn key={it.line.source} turn={{ speaker: "learner", text: it.line.text, translit: it.line.translit, gloss: it.line.gloss }} config={config} onDone={next} />
          </>
        )}
        {finished && (it.kind === "understand" || it.kind === "complete" || it.kind === "switch") && (
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={next}>{i + 1 < items.length ? "Next →" : "Done →"}</button>
          </div>
        )}
      </div>
      {onRestart && <button className="ghost small" style={{ marginTop: 10 }} onClick={onRestart}>↺ Read the story again</button>}
    </div>
  );
}
