"use client";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as scoring from "@ll/core/familiarity/scoring";
import * as api from "../../lib/api";
import * as cp from "../../lib/course-player";
import { type Progress } from "../../lib/store";
import { localDay } from "../../lib/daily";
import { captureWord, properNounLike } from "../../lib/capture";
import { subscribeArtifacts, joinPresence, sharedArtifactId, type PartnerStore } from "../../lib/partner-store";
import { translitOr } from "../../lib/romanize";
import * as storyTog from "@ll/core/story-together";
import { ActivityHead, colStack } from "./shared";
import { TappableText, WordPanel } from "../reading/Reading";
import { HintButton, Icon, MixedText, SlowContext, SpeakButton, Stitches, usePack, usePlay } from "../shared";

// "Read it together": the dyad walks a story LINE BY LINE, taking turns. On your line you read it aloud
// and say roughly what it means, with the words you haven't been taught yet translated under it (tap any other
// word if you're stuck); your partner holds the English and judges the gist.
// On a line that uses today's grammar the reader also says which bit and why — and the checker holds that
// answer too. It opens with the whole story played once, and ends with two of its questions asked
// partner-to-partner. Realtime-synced over partner_artifact 'story-together'; turns from @ll/core/story-together.
export function StoryTogether({ store, partnershipId, packId, myId, partnerId, storyId, onExit, progress, persist, config, embedded }: {
  store: PartnerStore; partnerId: string; partnershipId: string; packId: string; myId: string; storyId: string;
  /** `completed`: the read-through was finished (not just left). */
  onExit: (completed: boolean) => void;
  /** For tap-a-word meanings (optional). */
  progress?: Progress;
  persist?: (p: Progress) => void;
  config?: api.Config | null;
  /** Inside the partnered session: no back button of its own, and the wrap moves you both on. `onFinished`
   *  fires once the activity is complete (the session then hides "Skip"). */
  embedded?: { next: string; onNext: () => void; onFinished?: () => void };
}) {
  const pack = usePack();
  const play = usePlay();
  const rate = useContext(SlowContext);
  const story = pack.stories?.find((s) => s.id === storyId);
  const [session, setSession] = useState<storyTog.StorySession | null>(null);
  const [sid, setSid] = useState<string | null>(null);
  const [online, setOnline] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [playing, setPlaying] = useState<number | null>(null);
  const stopRef = useRef(false);
  const [sel, setSel] = useState<{ lexKey: string; surface: string; line: string } | null>(null);

  const refresh = useCallback(async () => {
    if (!sid) return;
    try { const a = (await store.listArtifacts(partnershipId, "story-together")).find((x) => x.id === sid); if (a) setSession(a.payload as storyTog.StorySession); } catch { /* keep current */ }
  }, [store, partnershipId, sid]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!sid) return;
    const unsubArtifacts = subscribeArtifacts(partnershipId, () => void refresh());
    const unsubPresence = joinPresence(partnershipId, myId, setOnline);
    return () => { unsubArtifacts(); unsubPresence(); };
  }, [partnershipId, sid, myId, refresh]);
  useEffect(() => () => { stopRef.current = true; }, []);
  useEffect(() => { if (session?.status === "complete") embedded?.onFinished?.(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [session?.status]);

  // Opening the story resumes TODAY's read-through as it stands — finished ones included (they show the wrap).
  // Only an older one, or an explicit "Read again", starts afresh: the row is shared, so restarting it on open
  // would yank your partner back to line 1 the moment either of you came back to it.
  const buildAndStart = useCallback(async (again = false) => {
    setErr("");
    try {
      const id = await sharedArtifactId("story-together", partnershipId, storyId);
      const existing = (await store.listArtifacts(partnershipId, "story-together")).find((x) => x.id === id);
      const ex = existing?.payload as (storyTog.StorySession & { day?: string }) | undefined;
      if (!again && ex && ex.day === localDay()) { setSession(ex); setSid(id); return; }
      const lines = (story?.body ?? []).map((b) => ({ text: b.text, translit: b.translit, gloss: b.gloss }));
      const questions = (story?.qa ?? []).slice(0, 2).map((q) => ({ question: q.question, questionGloss: q.questionGloss, answer: q.answer, answerGloss: q.answerGloss, answerTranslit: q.answerTranslit }));
      const sess = { ...storyTog.startStoryTogether(id, packId, storyId, myId, partnerId, lines, questions), day: localDay(), startedBy: myId };
      await store.putArtifact(partnershipId, packId, "story-together", sess, id);
      setSession(sess); setSid(id);
    } catch (e) { setErr((e as { message?: string }).message ?? "Couldn't start: try again."); }
  }, [store, partnershipId, packId, myId, partnerId, storyId, story]);
  useEffect(() => { void buildAndStart(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [storyId]);

  // Every change goes through the shared row (re-read first), so both screens move together.
  const update = async (fn: (s: storyTog.StorySession) => storyTog.StorySession) => {
    if (!session) return;
    setErr("");
    try {
      const latest = ((await store.listArtifacts(partnershipId, "story-together")).find((x) => x.id === session.id)?.payload as storyTog.StorySession) ?? session;
      const next = fn(latest);
      if (next !== latest) await store.putArtifact(partnershipId, packId, "story-together", next, next.id);
      setSession(next);
    } catch (e) { setErr((e as { message?: string }).message ?? "Sync hiccup: tap Refresh."); }
  };
  const check = (got: boolean) => update((s) => storyTog.checkTurn(s, myId, got));

  // Listen first: the whole story, line by line from cached audio (tap again to stop).
  const playAll = async () => {
    if (playing !== null) { stopRef.current = true; setPlaying(null); return; }
    stopRef.current = false;
    for (let i = 0; i < (story?.body.length ?? 0) && !stopRef.current; i++) {
      setPlaying(i);
      try { await api.playClip(story!.body[i]!.text, rate, pack.id); } catch { break; }
    }
    setPlaying(null);
  };
  const onTap = (surface: string, line: string, lineGloss?: string) => {
    if (!progress || !persist) return;
    const lexKey = captureWord(progress, persist, surface, line, { gloss: lineGloss, reviewable: !properNounLike(surface, pack) });
    if (lexKey) setSel({ lexKey, surface, line });
  };

  const partnerOnline = online.includes(partnerId);
  const HeaderRow = (
    <ActivityHead
      left={embedded ? <div className="overline">Read together</div> : <><button className="ghost small" onClick={() => onExit(session?.status === "complete")}>← Partner</button><div className="overline" style={{ marginTop: 12 }}>Read together</div></>}
      status={story ? <><b lang={pack.id} className="rmk">{story.title}</b>{story.titleGloss ? <span className="gloss small"> · {story.titleGloss}</span> : null}</> : undefined} online={partnerOnline} onRefresh={refresh} />
  );
  if (!story) return <div style={colStack}>{HeaderRow}<span className="muted small">Story not found.</span></div>;
  if (!session) return <div style={colStack}>{HeaderRow}{err ? <div className="err">{err}</div> : <span className="muted small">Setting up…</span>}</div>;

  const sc = storyTog.score(session);
  if (session.status === "complete") {
    return (
      <div style={colStack}>{HeaderRow}
        <div className="result-ok" style={{ fontSize: 17 }}><Icon name="check" size={16} /><span>You read <span lang={pack.id}>{story.title}</span> together: {sc.got} of {sc.total} nailed</span></div>
        <div className="row">
          {embedded ? <button className="btn" onClick={embedded.onNext}>{embedded.next}</button> : <button className="btn" onClick={() => onExit(true)}>Done</button>}
          <button className="ghost" onClick={() => void buildAndStart(true)}>Read again</button>
        </div>
      </div>
    );
  }

  // The intro: how the read-through works, before any of the story — no text up front (it was confusing to see
  // it all at once). Starting is shared: either of you taps it and you both go to line 1.
  if (storyTog.inIntro(session)) {
    const iGoFirst = session.turns[0]?.reader === myId;
    const qs = session.turns.filter((t) => t.kind === "qa").length;
    return (
      <div style={colStack}>{HeaderRow}
        <div className="framed write-card">
          <div className="overline">How this works</div>
          <ol style={{ margin: "8px 0 12px", paddingLeft: 20, lineHeight: 1.55 }}>
            <li>You take turns, one line each. <b>{iGoFirst ? "You read first." : "Your partner reads first."}</b></li>
            <li>The reader reads the line aloud in Macedonian, then says roughly what it means in English. Words you haven&apos;t learned yet are translated under the line.</li>
            <li>The other one sees the English and taps <b>Got the gist</b> or <b>Not quite</b>. It doesn&apos;t have to be word for word. After each line you both see what it means.</li>
            {qs > 0 && <li>At the end, {qs === 1 ? "a question" : `${qs} questions`} about the story: one of you asks, the other answers.</li>}
          </ol>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" onClick={() => { stopRef.current = true; setPlaying(null); void update(storyTog.begin); }}>Start reading together</button>
            <button className="ghost small" onClick={() => void playAll()}><Icon name={playing !== null ? "stop" : "speaker"} size={16} />{playing !== null ? "Stop" : "Hear it once first"}</button>
          </div>
          <div className="muted small" style={{ marginTop: 10 }}>Starting moves you both to the first line.{partnerOnline ? "" : " Your partner isn't here yet."}</div>
        </div>
      </div>
    );
  }

  const turn = storyTog.currentTurn(session)!;
  const iRead = storyTog.isMyTurnToRead(session, myId);
  const total = session.turns.length;
  const isQa = turn.kind === "qa";
  const lineCount = session.turns.filter((t) => t.kind !== "qa").length;
  const prev = session.turns[session.turnIndex - 1];
  return (
    <div style={colStack}>{HeaderRow}
      <div className="today-sub" style={{ marginTop: 0 }}>
        <Stitches total={total} done={session.turnIndex} now={session.turnIndex} size={10} label={isQa ? "Questions" : `Line ${session.turnIndex + 1} of ${lineCount}`} />
        <span>{isQa ? `Question ${turn.index - lineCount + 1} of ${total - lineCount}` : `Line ${session.turnIndex + 1} of ${lineCount}`} · {sc.got} nailed</span>
      </div>
      {err ? <div className="err">{err}</div> : null}
      {/* The reader says what the line means but never sees the English — so once it's marked, show it.
          Without this the one line you worked hardest on is the one you leave unconfirmed. */}
      {prev?.result ? (
        <div className="last-turn">
          <span className={prev.result === "got" ? "result-ok" : "result-miss"}><Icon name={prev.result === "got" ? "check" : "restart"} size={13} /></span>
          <span className="small lt-text"><b lang={pack.id}>{prev.text}</b> <span className="muted">·</span> {prev.kind === "qa" ? <><span lang={pack.id}>{prev.answer}</span>{prev.answerGloss ? ` (${prev.answerGloss})` : ""}</> : prev.gloss}</span>
        </div>
      ) : null}
      {isQa ? (iRead ? (
        <div className="framed write-card">
          <div className="overline">Your partner asks you about the story: answer out loud, in {pack.name} if you can</div>
          <div className="model-line"><SpeakButton label="Play the question" onClick={() => play(turn.text, 0.9)} /><span className="say-line" lang={pack.id} style={{ fontSize: 22, margin: 0 }}>{turn.text}</span></div>
          <HintButton hint={turn.gloss} label="What does it ask?" />
          <div className="muted small" style={{ marginTop: 10 }}>{partnerOnline ? "Your partner is checking your answer…" : "Waiting for your partner…"}</div>
        </div>
      ) : (
        <div className="framed write-card">
          <div className="overline">Ask your partner this question, out loud</div>
          <div className="model-line"><SpeakButton label="Play the question" onClick={() => play(turn.text, 0.9)} /><span className="say-line" lang={pack.id} style={{ fontSize: 22, margin: 0 }}>{turn.text}</span></div>
          <div className="say-gloss">{turn.gloss}</div>
          <p style={{ margin: "12px 0 0" }}>Answer: <b lang={pack.id} className="rmk">{turn.answer}</b>{turn.answerGloss ? <span className="muted"> · {turn.answerGloss}</span> : null}</p>
          <div className="grade-row">
            <button className="ghost" onClick={() => check(false)}><Icon name="restart" size={16} />Not quite</button>
            <button className="btn" onClick={() => check(true)}><Icon name="check" size={16} />Got it</button>
          </div>
        </div>
      )) : iRead ? (
        <div className="framed write-card">
          <div className="overline">Your line: read it aloud, then tell your partner roughly what it means{progress ? " (tap a word if you're stuck)" : ""}</div>
          <div className="model-line"><SpeakButton label="Play your line" onClick={() => play(turn.text, 0.9)} /><span className="say-line" lang={pack.id} style={{ fontSize: 24, margin: 0 }}>{progress ? <TappableText text={turn.text} progress={progress} onTapWord={(sf) => onTap(sf, turn.text, turn.gloss)} /> : turn.text}</span></div>
          <div className="say-gloss">{translitOr(turn.text, turn.translit)}</div>
          {progress && <NewWordsOnLine text={turn.text} storyId={story.id} progress={progress} />}
          {sel && progress && persist && <WordPanel sel={sel} progress={progress} persist={persist} config={config ?? null} onClose={() => setSel(null)} />}
          <div className="muted small" style={{ marginTop: 10 }}>{partnerOnline ? "Your partner is checking your meaning…" : "Waiting for your partner to check…"}</div>
        </div>
      ) : (
        <div className="framed write-card">
          <div className="overline">Your partner reads this line and says roughly what it means</div>
          <div className="model-line"><SpeakButton label="Play their line" onClick={() => play(turn.text, 0.9)} /><span className="say-line" lang={pack.id} style={{ fontSize: 22, margin: 0 }}>{turn.text}</span></div>
          <p style={{ margin: "10px 0 0" }}>It means: <MixedText text={turn.gloss} /></p>
          <div className="muted small" style={{ marginTop: 6 }}>Did they get the gist? It doesn&apos;t have to be word for word.</div>
          <div className="grade-row">
            <button className="ghost" onClick={() => check(false)}><Icon name="restart" size={16} />Not quite</button>
            <button className="btn" onClick={() => check(true)}><Icon name="check" size={16} />Got the gist</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The words on your line the course hasn't taught you yet (names aside, and any you've marked known), each
 *  with what it means: the story's own word list first, else the shared look-up (course words, then the cache).
 *  Without the course, every word you haven't met. So not knowing a word never stops you saying what the line
 *  is about (Jake, 2026-10-23). */
function NewWordsOnLine({ text, storyId, progress }: { text: string; storyId: string; progress: Progress }) {
  const pack = usePack();
  const forms = useMemo(() => (pack.course ? cp.formSlots(pack, pack.course) : undefined), [pack]);
  const at = pack.course ? cp.currentSlot(pack.course, progress) : undefined;
  const words = useMemo(() => {
    const seen = new Set<string>();
    return scoring.tokenize(text).filter((t) => {
      if (!t.isWord || seen.has(t.lexKey)) return false;
      seen.add(t.lexKey);
      const e = progress.familiarity[t.lexKey];
      if ((e && e.status === "known") || properNounLike(t.surface, pack)) return false;
      return forms && at ? !cp.taughtBefore(forms.get(t.lexKey), at) : !e;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, forms, at?.order, at?.n]);
  const own = useMemo(() => new Map((pack.stories?.find((x) => x.id === storyId)?.registersVocab ?? []).map((r) => [r.lexKey, r.gloss])), [pack, storyId]);
  const [looked, setLooked] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    for (const w of words) {
      if (own.has(w.lexKey) || looked[w.lexKey]) continue;
      api.gloss(w.surface, text, pack.id).then((r) => { if (live && r.gloss) setLooked((m) => ({ ...m, [w.lexKey]: r.gloss })); }).catch(() => {});
    }
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words]);
  if (!words.length) return null;
  return (
    <div className="small" style={{ marginTop: 10, lineHeight: 1.7 }}>
      <span className="muted">New words: </span>
      {words.map((w, i) => (
        <span key={w.lexKey}>{i ? " · " : ""}<b lang={pack.id} style={{ fontSize: 16 }}>{w.surface}</b> <span className="muted">{own.get(w.lexKey) ?? looked[w.lexKey] ?? "…"}</span></span>
      ))}
    </div>
  );
}
