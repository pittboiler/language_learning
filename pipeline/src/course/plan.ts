// Deterministic half of the course blueprint: given the spine, the line tags and whatever point text has
// been written, lay out every chapter's sessions — which point, which words, which story with which lines
// highlighted, what to build, when to speak — plus checkpoints and stage reviews. No LLM here: the plan is
// reproducible, so a review comment like "move this word a session later" is a spine tweak + re-run.
// See DESIGN-course-spine.md §4 (cadence), §4a (recall from earlier chapters), §8 (story lenses).
import type { ChunkNote, CourseChapter, CourseSession, CourseWord, GrammarPoint, LanguagePack, MiniStory, ReviewItem, SessionRole, StageReview } from "@ll/pack-schema";
import { resolveChapters, type ChapterContent } from "@ll/core/chapters";
import { deriveKeyForItem, normalize } from "@ll/core/familiarity";
import { requiredChapter, tierCapForChapter } from "@ll/core/sentences";
import { SPINE, STAGE_REVIEW_AFTER, spinePoints, type SpinePoint } from "./spine.js";
import { tokens } from "./lines.js";
import { knownInSet, properNames } from "./known.js";
import { knownForms, wordTokens } from "../../../apps/web/lib/course-player.js";

/** Hard cap on new words per session — Jake's pacing (lib/daily.ts NEW_WORDS_PER_SESSION). */
export const WORDS_PER_SESSION = 3;
/** Most extra practice sessions a chapter gets automatically for word load (DESIGN §4: "a day or two"). */
const MAX_AUTO_EXTRA = 2;
const BUILD_CANDIDATES = 6;
/** Most set-phrase notes a session surfaces for the first time (DESIGN §3: spread them out). */
export const NOTES_PER_SESSION = 3;

const toWord = (v: ReviewItem): CourseWord => ({ lexKey: deriveKeyForItem(v).lexKey, display: v.answer.trim(), gloss: v.gloss });

interface Slot { role: SessionRole; point?: SpinePoint }

/** The session skeleton for a chapter: teach each point (heavy ones get a practice session too), extra
 *  practice for word load, a mid-chapter review after point `reviewAfter` (0-based), two use sessions and
 *  the checkpoint. */
function skeleton(points: SpinePoint[], extra: number, reviewAfter: number): Slot[] {
  const out: Slot[] = [];
  points.forEach((p, i) => {
    out.push({ role: "teach", point: p });
    if (p.heavy) out.push({ role: "practice", point: p });
    if (i === reviewAfter) {
      for (let e = 0; e < extra; e++) out.push({ role: "practice" });
      out.push({ role: "review" });
    }
  });
  out.push({ role: "use" }, { role: "use" }, { role: "checkpoint" });
  return out;
}

const teachesWords = (r: SessionRole) => r === "teach" || r === "practice" || r === "use";

export interface PlanInput {
  pack: LanguagePack;
  points: GrammarPoint[];
  lineTags: Record<string, string[]>;
  chunkNotes?: ChunkNote[];
}

export function planCourse({ pack, points, lineTags, chunkNotes = [] }: PlanInput): { chapters: CourseChapter[]; stageReviews: StageReview[]; version: string } {
  const contents = resolveChapters(pack);
  const byId = new Map(contents.map((c) => [c.chapter.id, c]));
  const allSpine = spinePoints();
  const names = properNames(pack);
  const pointText = new Map(points.map((p) => [p.id, p]));
  const spineOf = new Map(allSpine.map((p) => [p.id, p]));

  const taughtBefore = new Map<string, CourseWord>(); // every word taught by an earlier chapter
  const pointsBefore: string[] = []; // every point taught by an earlier chapter
  const reusedAt = new Map<string, number>(); // story id → chapter order it was last brought back in
  const lensAt = new Map<string, number>(); // point id → when it was last the lens of a refresher
  let refresherCount = 0;
  const chapters: CourseChapter[] = [];

  for (const spineCh of SPINE) {
    const content = byId.get(spineCh.chapterId);
    if (!content) throw new Error(`spine chapter ${spineCh.chapterId} is not in pack.chapters`);
    const chId = spineCh.chapterId;
    const order = content.chapter.order;

    // Script chapter (letters & sounds): one session per letter group, then a checkpoint quiz on the
    // tricky letters. No words, points, stories or conversations.
    if (spineCh.letterSessions) {
      const tricky = pack.alphabet.filter((a) => a.unique || a.falseFriend).map((a) => a.glyph);
      const sessions: CourseSession[] = [
        ...spineCh.letterSessions.map((ls, i): CourseSession => ({ n: i + 1, role: "teach", letters: ls, words: [], build: [], agenda: [], next: "" })),
        { n: spineCh.letterSessions.length + 1, role: "checkpoint", letters: { title: "The tricky ones", glyphs: tricky }, words: [], build: [], agenda: [], next: "" },
      ];
      chapters.push({ chapterId: chId, order, pointIds: [], words: [], extraWords: [], sessions, checkpoint: { wordKeys: [], pointIds: [] } });
      continue;
    }
    const drop = new Set((spineCh.dropWords ?? []).map(normalize));

    // ---- word list, in priority order ----
    const fresh = (v: ReviewItem) => { const k = deriveKeyForItem(v).lexKey; return !taughtBefore.has(k) && !drop.has(k); };
    const findWord = (w: string) => content.vocab.find((v) => normalize(v.answer) === normalize(w)) ?? pack.vocab.find((v) => normalize(v.answer) === normalize(w));
    const pointWords = new Map<string, CourseWord[]>();
    for (const p of spineCh.points) pointWords.set(p.id, (p.words ?? []).map(findWord).filter((v): v is ReviewItem => !!v && fresh(v)).map(toWord));
    const scen = pack.scenarios.find((s) => s.id === `gen-${chId}`);
    const required = (scen?.requiredVocab ?? []).map((id) => pack.vocab.find((v) => v.id === id)).filter((v): v is ReviewItem => !!v && fresh(v)).map(toWord);
    const isUnit = (v: ReviewItem) => v.id.startsWith(`gen-${chId}`) || v.tags.includes(chId);
    const unit = content.vocab.filter((v) => isUnit(v) && fresh(v)).map(toWord);
    const lineTokens = new Set(chapterLines(content).flatMap(tokens));
    const inLines = (w: CourseWord) => w.lexKey.split(" ").every((t) => lineTokens.has(t));
    const core = content.vocab.filter((v) => !isUnit(v) && fresh(v)).map(toWord);
    const coreUsed = core.filter(inLines);

    const dedupe = (ws: CourseWord[], seen: Set<string>) => ws.filter((w) => (seen.has(w.lexKey) ? false : (seen.add(w.lexKey), true)));
    const seen = new Set<string>();
    const pw = [...pointWords.values()].flat();
    const mandatory = dedupe([...pw, ...required, ...unit], seen);
    const optional = dedupe(coreUsed, seen);
    const extraWords = dedupe(core, seen);

    // ---- skeleton + word assignment ----
    // The mid-chapter review is the first try at the conversation, so every word the conversation needs
    // must be taught BEFORE it. Grow the chapter by practice sessions (up to MAX_AUTO_EXTRA, plus any
    // hand-tuned `extraSessions`) until that holds and the chapter's core words fit.
    const fixedExtra = spineCh.extraSessions ?? 0;
    const unitRest = dedupe(unit, new Set([...pw, ...required].map((w) => w.lexKey)));
    const tries: { extra: number; reviewAfter: number }[] = [];
    for (let extra = 0; extra <= MAX_AUTO_EXTRA; extra++) {
      for (let r = Math.min(1, spineCh.points.length - 1); r < spineCh.points.length; r++) tries.push({ extra: fixedExtra + extra, reviewAfter: r });
    }
    // Fewest sessions first; for the same length, the earliest review that works.
    tries.sort((a, b) => a.extra - b.extra || a.reviewAfter - b.reviewAfter);
    const ok = (l: ReturnType<typeof assignWords>) => l.requiredBeforeReview && l.mandatoryFit(mandatory);
    let layout = assignWords(skeleton(spineCh.points, tries[0]!.extra, tries[0]!.reviewAfter), pointWords, required, unitRest, optional);
    for (const t of tries) {
      const l = assignWords(skeleton(spineCh.points, t.extra, t.reviewAfter), pointWords, required, unitRest, optional);
      if (ok(l)) { layout = l; break; }
      if (t === tries.at(-1)) layout = assignWords(skeleton(spineCh.points, fixedExtra + MAX_AUTO_EXTRA, Math.min(1, spineCh.points.length - 1)), pointWords, required, unitRest, optional);
    }
    const { slots, sessionWords, leftover } = layout;
    const taught = sessionWords.flat();

    // ---- stories ----
    const home = content.stories.find((s) => s.id === `gen-${chId}-story`) ?? content.stories[0];
    const storyPool = contents.filter((c) => c.chapter.order <= order).flatMap((c) => c.stories.map((s) => ({ s, order: c.chapter.order })));
    const hits = (s: MiniStory, ids: string[]) => s.body.map((_, i) => i).filter((i) => (lineTags[`story:${s.id}#${i}`] ?? []).some((t) => ids.includes(t)));
    const usedReuse = new Set<string>(); // stories already brought back in THIS chapter
    const notRecent = (id: string) => (reusedAt.get(id) ?? -99) < order - 2; // not reused in the last two chapters
    const pickReuse = (lens: string[]): { s: MiniStory; lens: string[] } | undefined => {
      const earlier = storyPool.filter((x) => x.order < order && !usedReuse.has(x.s.id));
      const take = (s: MiniStory, l: string[]) => { usedReuse.add(s.id); reusedAt.set(s.id, order); return { s, lens: l }; };
      // 1. An earlier story that uses THIS chapter's grammar (a not-recently-reused one wins a tie).
      const onLens = earlier.map((x) => ({ x, n: hits(x.s, lens).length + (notRecent(x.s.id) ? 0.5 : 0) })).filter((r) => r.n >= 1).sort((a, b) => b.n - a.n || a.x.order - b.x.order)[0];
      if (onLens) return take(onLens.x.s, lens);
      // 2. Otherwise a refresher on ONE earlier point — the one revisited longest ago — in a story that
      //    uses it, highlighting just those lines. Spaced recall of grammar, not a wall of highlights.
      const due = [...pointsBefore].sort((a, b) => (lensAt.get(a) ?? -1) - (lensAt.get(b) ?? -1) || pointsBefore.indexOf(a) - pointsBefore.indexOf(b));
      for (const p of due) {
        const pick = earlier.filter((x) => notRecent(x.s.id)).map((x) => ({ x, n: hits(x.s, [p]).length })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n || a.x.order - b.x.order)[0]
          ?? earlier.map((x) => ({ x, n: hits(x.s, [p]).length })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n)[0];
        if (pick) { lensAt.set(p, refresherCount++); return take(pick.x.s, [p]); }
      }
      return undefined;
    };

    // ---- build candidates ----
    const conceptPoints = (cid: string) => allSpine.filter((p) => p.grammarIds.includes(cid)).map((p) => p.id);

    // ---- sessions ----
    const chapterPointIds = spineCh.points.map((p) => p.id);
    const sessions: CourseSession[] = [];
    let speakFrom = -1;
    const requiredKeys = new Set(required.map((w) => w.lexKey));
    slots.forEach((slot, i) => {
      const pointsSoFar = [...pointsBefore, ...chapterPointIds.slice(0, chapterPointIds.indexOf(lastPointUpTo(slots, i) ?? "") + 1)];
      const chapterSoFar = chapterPointIds.filter((id) => pointsSoFar.includes(id));
      const taughtUpTo = new Set([...taughtBefore.keys(), ...sessionWords.slice(0, i + 1).flat().map((w) => w.lexKey)]);

      let story: CourseSession["story"];
      if (slot.role === "teach" || (slot.role === "practice" && slot.point)) {
        const lens = [slot.point!.id];
        let s = home;
        if (home && i > 0 && hits(home, lens).length === 0) {
          const alt = storyPool.filter((x) => x.s.id !== home.id).map((x) => ({ x, n: hits(x.s, lens).length - (usedReuse.has(x.s.id) ? 0.5 : 0) })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n || b.x.order - a.x.order)[0];
          if (alt) { s = alt.x.s; usedReuse.add(s.id); reusedAt.set(s.id, order); }
        }
        if (s) story = { id: s.id, lens, highlight: hits(s, lens), ...(storyOrder(s) < order ? { reuse: true } : {}) };
      } else if (slot.role === "practice" || (slot.role === "use" && !sessions.some((x) => x.role === "use"))) {
        if (home) story = { id: home.id, lens: chapterSoFar, highlight: hits(home, chapterSoFar) };
      } else if (slot.role === "use" && content.stories.some((x) => x.id !== home?.id && !sessions.some((y) => y.story?.id === x.id))) {
        // A chapter's own second story (e.g. the hand-authored café one) gets read in the chapter itself.
        const other = content.stories.find((x) => x.id !== home?.id && !sessions.some((y) => y.story?.id === x.id))!;
        story = { id: other.id, lens: chapterSoFar, highlight: hits(other, chapterSoFar) };
      } else if (slot.role === "review" || slot.role === "use") {
        const r = pickReuse(chapterSoFar);
        if (r) story = { id: r.s.id, lens: r.lens, highlight: hits(r.s, r.lens), reuse: true };
        else if (home) story = { id: home.id, lens: chapterSoFar, highlight: hits(home, chapterSoFar) };
      }

      // Speak once every required word was taught in an EARLIER session (not minutes ago), from the review on.
      const reqBefore = new Set([...taughtBefore.keys(), ...sessionWords.slice(0, i).flat().map((w) => w.lexKey)]);
      const ready = [...requiredKeys].every((k) => reqBefore.has(k));
      const speakable = slot.role === "review" || slot.role === "use" || (slot.role === "practice" && !slot.point);
      if (speakFrom === -1 && ready && speakable && scen) speakFrom = i;
      const speak = speakFrom !== -1 && i >= speakFrom && slot.role !== "checkpoint" ? scen?.id : undefined;

      const knownNow = knownInSet(pack, knownForms(pack, points, taughtUpTo, pointsSoFar), pointsSoFar.some((id) => spineOf.get(id)?.grammarIds.includes("definite-articles")), names);
      const build = slot.role === "checkpoint" ? [] : buildCandidates(pack, {
        order, taughtUpTo, pointsSoFar, current: slot.point?.id, conceptPoints, words: sessionWords[i]!,
        chapterWords: taught, earlierWords: [...taughtBefore.values()], known: knownNow,
      });

      sessions.push({
        n: i + 1,
        role: slot.role,
        ...(slot.point ? { pointId: slot.point.id } : {}),
        words: sessionWords[i]!,
        ...(story ? { story } : {}),
        build,
        ...(speak ? { speak } : {}),
        ...(slot.role === "use" && sessions.some((x) => x.role === "use") ? { writing: true } : {}),
        agenda: [],
        next: "",
      });
    });

    chapters.push({
      chapterId: chId,
      order,
      pointIds: chapterPointIds,
      words: taught,
      extraWords: [...leftover, ...extraWords],
      sessions,
      checkpoint: { wordKeys: taught.map((w) => w.lexKey), pointIds: chapterPointIds, ...(scen ? { scenarioId: scen.id } : {}) },
    });
    taught.forEach((w) => taughtBefore.set(w.lexKey, w));
    pointsBefore.push(...chapterPointIds);
  }

  // ---- set-phrase notes: surfaced the first session their line is met, a few at a time ----
  const noted = new Set(chunkNotes.map((n) => n.source));
  const shown = new Set<string>();
  for (const ch of chapters) {
    for (const s of ch.sessions) {
      const met: string[] = [];
      const story = s.story && pack.stories?.find((x) => x.id === s.story!.id);
      if (story) {
        story.body.forEach((_, i) => met.push(`story:${story.id}#${i}`));
        story.qa.forEach((q) => met.push(`qa:${story.id}#${q.id}:q`, `qa:${story.id}#${q.id}:a`));
      }
      const scen = s.speak && pack.scenarios.find((x) => x.id === s.speak);
      if (scen) scen.script.forEach((_, i) => met.push(`scenario:${scen.id}#${i}`));
      const fresh = met.filter((src) => noted.has(src) && !shown.has(src)).slice(0, NOTES_PER_SESSION);
      fresh.forEach((src) => shown.add(src));
      if (fresh.length) s.notes = fresh;
    }
  }

  // ---- agenda + "next time" lines (needs the whole course laid out) ----
  const storyTitle = (id: string) => pack.stories?.find((s) => s.id === id)?.title ?? id;
  const scenTitle = (id: string) => pack.scenarios.find((s) => s.id === id)?.title ?? id;
  const pointName = (id: string) => pointText.get(id)?.title ?? spineOf.get(id)?.title ?? id;
  const flat: { ch: CourseChapter; s: CourseSession }[] = chapters.flatMap((ch) => ch.sessions.map((s) => ({ ch, s })));
  for (const { ch, s } of flat) {
    const a: string[] = [];
    const pt = s.pointId ? pointText.get(s.pointId) : undefined;
    if (s.letters) {
      a.push(s.role === "checkpoint" ? `Checkpoint: ${s.letters.glyphs.length} tricky letters, until you know them all` : `${s.letters.title}: ${s.letters.glyphs.join(" ")}`);
      if (s.role !== "checkpoint") a.push("Say example words out loud");
      s.agenda = a;
      continue;
    }
    // Bullets follow the order Today plays them in: new words, then the grammar, then say it / story / talk.
    const wordsLine = s.words.length ? `${s.words.length} new word${s.words.length > 1 ? "s" : ""}: ${s.words.map((w) => w.display.replace(/\.+$/, "")).join(", ")}` : undefined;
    if (s.role === "teach" || s.role === "practice") {
      if (wordsLine) a.push(wordsLine);
      // A practice session without its own point practises the chapter's latest one (as Today plays it).
      const practised = s.pointId ?? ch.pointIds.filter((id) => ch.sessions.some((x) => x.n < s.n && x.pointId === id)).at(-1);
      a.push(s.role === "teach" ? pt?.agenda ?? `New: ${pointName(s.pointId!)}` : practised ? `Practice: ${pointName(practised)}` : "Practice day: more of this chapter's patterns");
    } else {
      if (s.role === "review") a.push("Review day: nothing new");
      if (s.role === "use") a.push(s.writing ? "Put it together: use this chapter in your own words" : "Put it together: use this chapter in a real exchange");
      if (s.role === "checkpoint") a.push("Checkpoint: this chapter's words and grammar", "Then the conversation once more");
      if (wordsLine) a.push(wordsLine);
    }
    if (s.role === "teach" || s.role === "practice") a.push("Say it: today's words and examples, out loud");
    const lensHere = s.story ? s.story.lens.every((id) => ch.pointIds.includes(id)) : false;
    if (s.story) a.push(s.story.reuse
      ? `Reread “${storyTitle(s.story.id)}” from an earlier chapter: ${lensHere ? `find ${s.story.lens.length > 1 ? "this chapter's patterns" : pointName(s.story.lens[0]!).toLowerCase()}` : "a refresher on what you learned there"}`
      : `Read “${storyTitle(s.story.id)}”${s.story.highlight.length ? `: spot ${s.story.lens.length > 1 ? "everything from this chapter" : "today's pattern"}` : ""}`);
    if (s.build.length) a.push("Build a sentence: put the words in order");
    const firstTry = s.role === "review" && ch.sessions.find((x) => x.speak)?.n === s.n;
    if (s.speak) a.push(`${firstTry ? "First try at the conversation" : "Conversation"}: ${scenTitle(s.speak)}`);
    if (s.writing) a.push("Write a few lines of your own");
    s.agenda = a;
  }
  const chapterTitle = (id: string) => pack.chapters?.find((c) => c.id === id)?.shortTitle ?? id;
  flat.forEach(({ ch, s }, i) => {
    const nxt = flat[i + 1];
    if (!nxt) { s.next = "That's the whole course: the final stage review is next."; return; }
    if (nxt.ch !== ch) {
      s.next = STAGE_REVIEW_AFTER.includes(ch.chapterId) ? `Next: a stage review, then ${chapterTitle(nxt.ch.chapterId)}` : `Next: a new chapter, ${chapterTitle(nxt.ch.chapterId)}`;
      return;
    }
    s.next = `Next: ${nxt.s.agenda.find((b) => !/^\d+ new words?:/.test(b)) ?? nxt.s.role}`;
  });

  // ---- stage reviews ----
  const stageReviews: StageReview[] = [];
  let from = 0;
  for (const after of STAGE_REVIEW_AFTER) {
    const to = chapters.findIndex((c) => c.chapterId === after);
    const chs = chapters.slice(from, to + 1);
    stageReviews.push({
      afterChapterId: after,
      chapterIds: chs.map((c) => c.chapterId),
      wordKeys: chs.flatMap((c) => c.words.map((w) => w.lexKey)),
      pointIds: chs.flatMap((c) => c.pointIds),
      scenarioIds: chs.map((c) => c.checkpoint.scenarioId).filter((x): x is string => !!x),
    });
    from = to + 1;
  }
  return { chapters, stageReviews, version: structureVersion(chapters) };

  function storyOrder(s: MiniStory): number {
    return contents.find((c) => c.stories.some((x) => x.id === s.id))?.chapter.order ?? 0;
  }
}

/** Fill a chapter's sessions with words, three at most each. A session teaching (or practising) a point
 *  takes that point's own words first — but only two while the conversation still needs words, so the
 *  conversation's vocabulary isn't crowded out before the review. Then: the conversation's words, any
 *  point's leftovers, the unit's chunks, and finally core words the chapter's lines actually use. */
function assignWords(slots: Slot[], pointWords: Map<string, CourseWord[]>, required: CourseWord[], unitIn: CourseWord[], optionalIn: CourseWord[]) {
  const assigned = new Set<string>();
  const unit = [...unitIn];
  const optional = [...optionalIn];
  const own = new Map([...pointWords].map(([k, v]) => [k, [...v]]));
  const isPointWord = new Set([...pointWords.values()].flat().map((w) => w.lexKey));
  const req = required.filter((w) => !isPointWord.has(w.lexKey));
  const introduced: string[] = []; // points taught so far — only THEIR leftover words may be drawn
  const next = () => {
    for (const q of [req, ...introduced.map((id) => own.get(id)!), unit, optional]) {
      while (q.length) { const w = q.shift()!; if (!assigned.has(w.lexKey)) return w; }
    }
    return undefined;
  };
  const sessionWords = slots.map((slot) => {
    if (slot.role === "teach" && slot.point) introduced.push(slot.point.id);
    if (!teachesWords(slot.role)) return [];
    const take: CourseWord[] = [];
    const mine = slot.point ? own.get(slot.point.id) ?? [] : [];
    const cap = req.some((w) => !assigned.has(w.lexKey)) ? 2 : WORDS_PER_SESSION;
    while (mine.length && take.length < cap) { const w = mine.shift()!; if (!assigned.has(w.lexKey)) { take.push(w); assigned.add(w.lexKey); } }
    while (take.length < WORDS_PER_SESSION) { const w = next(); if (!w) break; take.push(w); assigned.add(w.lexKey); }
    return take;
  });
  const reviewAt = slots.findIndex((s) => s.role === "review");
  const before = new Set(sessionWords.slice(0, reviewAt).flat().map((w) => w.lexKey));
  const leftover = [...required, ...[...pointWords.values()].flat(), ...unitIn, ...optionalIn].filter((w) => !assigned.has(w.lexKey));
  return {
    slots, sessionWords, leftover,
    requiredBeforeReview: required.every((w) => before.has(w.lexKey)),
    mandatoryFit: (mandatory: CourseWord[]) => mandatory.every((w) => assigned.has(w.lexKey)),
  };
}

/** A short hash of the course STRUCTURE (chapters, session roles, points, letter groups) — wording changes
 *  don't move learners, structural ones re-place them (see Course.version). */
function structureVersion(chapters: CourseChapter[]): string {
  const sig = chapters.map((c) => `${c.chapterId}:${c.sessions.map((s) => `${s.role}${s.pointId ? `/${s.pointId}` : ""}${s.letters ? `/${s.letters.glyphs.join("")}` : ""}`).join(",")}`).join("|");
  let h = 2166136261;
  for (let i = 0; i < sig.length; i++) { h ^= sig.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

/** The last point taught at or before slot i of a chapter. */
function lastPointUpTo(slots: Slot[], i: number): string | undefined {
  for (let j = i; j >= 0; j--) if (slots[j]!.role === "teach" && slots[j]!.point) return slots[j]!.point!.id;
  return undefined;
}

/** Every target-language line a chapter's own content holds. */
function chapterLines(c: ChapterContent): string[] {
  return [
    ...c.scenarios.flatMap((s) => s.script.map((t) => t.text)),
    ...c.stories.flatMap((s) => [...s.body.map((b) => b.text), ...s.qa.flatMap((q) => [q.question, q.answer])]),
    ...c.readers.flatMap((r) => r.body.map((b) => b.text)),
  ];
}

/** Build-a-sentence candidates for one session (DESIGN §4a item 4): phrase cards from taught chunks and
 *  sentence items whose words and grammar are both in scope. Today's point and words lead; at least one
 *  candidate comes from an EARLIER chapter so production keeps recycling old material. */
function buildCandidates(pack: LanguagePack, o: {
  order: number; taughtUpTo: Set<string>; pointsSoFar: string[]; current?: string;
  conceptPoints: (cid: string) => string[]; words: CourseWord[]; chapterWords: CourseWord[]; earlierWords: CourseWord[];
  /** Is this word form taught by now? Every word of every person's version must be. */
  known: (token: string) => boolean;
}): string[] {
  const vocabId = (w: CourseWord) => pack.vocab.find((v) => deriveKeyForItem(v).lexKey === w.lexKey)?.id;
  const phrase = (w: CourseWord) => { const n = w.display.split(/\s+/).length; return n >= 2 && n <= 5 && !w.display.includes("…") ? vocabId(w) : undefined; };
  const today = o.words.map(phrase).filter((x): x is string => !!x).map((id) => `phrase-${id}`);
  const chapter = o.chapterWords.filter((w) => o.taughtUpTo.has(w.lexKey)).map(phrase).filter((x): x is string => !!x).map((id) => `phrase-${id}`);
  const earlier = o.earlierWords.map(phrase).filter((x): x is string => !!x).map((id) => `phrase-${id}`);

  const cap = tierCapForChapter(o.order);
  const sentences = (pack.sentences ?? []).filter((it) => {
    if ((it.tier ?? 1) > cap) return false;
    const need = requiredChapter(pack, it);
    if (need === undefined || need > o.order) return false;
    if (!it.conceptIds.every((c) => o.conceptPoints(c).some((p) => o.pointsSoFar.includes(p)))) return false;
    if (!it.supportWords.every((w) => o.taughtUpTo.has(normalize(w)))) return false;
    return it.variants.every((v) => wordTokens(v.mk).every(o.known));
  });
  const onPoint = sentences.filter((it) => o.current && it.conceptIds.some((c) => o.conceptPoints(c).includes(o.current!))).map((it) => it.id);
  const otherSentences = sentences.map((it) => it.id).filter((id) => !onPoint.includes(id));

  const out: string[] = [];
  const push = (ids: string[], n: number) => { for (const id of ids) { if (out.length >= BUILD_CANDIDATES || n <= 0) break; if (!out.includes(id)) { out.push(id); n--; } } };
  push(onPoint, 2);
  push(today, 2);
  push(rotate(earlier, o.order), 1); // ≥1 from an earlier chapter
  push(otherSentences, 2);
  push(chapter, BUILD_CANDIDATES);
  push(earlier, BUILD_CANDIDATES);
  return out;
}

const rotate = <T,>(a: T[], n: number): T[] => (a.length ? a.map((_, i) => a[(i + n) % a.length]!) : a);
