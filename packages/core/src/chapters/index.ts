// Chapters — the orienting spine. A pack declares named, ordered chapters (pack-schema `Chapter`);
// this module resolves which artifacts belong to each one and how far the learner has got through it.
// Nothing here is language-specific, and nothing rewrites content: chapters JOIN to existing artifacts
// by the id convention the generation pipeline already uses.
//
//   scenario  gen-<chapterId>              vocab    gen-<chapterId>-v<n>  (or chapterId in `tags`)
//   story     gen-<chapterId>-story        writing  gen-<chapterId>-w<n>
//   reader    gen-<chapterId>-reader       info-gap gen-<chapterId>-gap
//   grammar   the chapter scenario's `requiredStructures`
//
// Hand-authored artifacts that predate the convention are listed in `chapter.extraIds`, and the
// semantically-tagged core word list is distributed by `chapter.wordTags`.
import type { Chapter, LanguagePack, MiniStory, Reader, ReviewItem, Scenario } from "@ll/pack-schema";
import { deriveKeyForItem, type FamiliarityEntry } from "../familiarity/index.js";

/** Everything one chapter owns, resolved against a pack. */
export interface ChapterContent {
  chapter: Chapter;
  scenarios: Scenario[];
  stories: MiniStory[];
  readers: Reader[];
  /** Words + phrases this chapter teaches (unit vocab, plus core words in its `wordTags`). */
  vocab: ReviewItem[];
  writingIds: string[];
  infoGapIds: string[];
  /** GrammarConcept ids, from the chapter scenario's `requiredStructures`. */
  grammarIds: string[];
}

/** The learner-state this module needs. Structurally a subset of the app's Progress, so it can be
 *  passed straight in without adapting. */
export interface ChapterProgressInput {
  familiarity: Record<string, FamiliarityEntry>;
  seenGrammar?: Record<string, boolean>;
  storyReads?: Record<string, string[]>;
  scenarios?: Record<string, { turnIndex: number; metCriteria: string[] }>;
}

export type ChapterState = "done" | "current" | "upcoming";

export interface ChapterStatus {
  id: string;
  state: ChapterState;
  /** 0..1 overall, the mean of the four strands below — what a progress bar shows. */
  percent: number;
  wordsKnown: number;
  wordsTotal: number;
  grammarSeen: number;
  grammarTotal: number;
  /** Distinct days its story has been read in the daily flow. */
  storyDays: number;
  storyRead: boolean;
  storyTotal: number;
  criteriaMet: number;
  criteriaTotal: number;
}

const prefix = (chapterId: string) => `gen-${chapterId}`;
/** An artifact belongs to a chapter if its id carries the chapter prefix or it's listed explicitly. */
const owns = (ch: Chapter, id: string): boolean => id.startsWith(prefix(ch.id)) || !!ch.extraIds?.includes(id);

/** Vocab joins by id prefix, by the chapter id appearing in `tags` (how generated vocab is tagged),
 *  by an explicit extra id, or — for the hand-authored core word list — by semantic tag. */
function ownsVocab(ch: Chapter, it: ReviewItem): boolean {
  if (owns(ch, it.id) || it.tags.includes(ch.id)) return true;
  return !!ch.wordTags?.some((t) => it.tags.includes(t));
}

/** Resolve every chapter's content, in course order. Artifacts matching no chapter are simply absent
 *  (see `unchaptered` for the complement — nothing is silently dropped from the UI). */
export function resolveChapters(pack: LanguagePack): ChapterContent[] {
  return [...(pack.chapters ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((chapter) => {
      const scenarios = pack.scenarios.filter((s) => owns(chapter, s.id));
      return {
        chapter,
        scenarios,
        stories: (pack.stories ?? []).filter((s) => owns(chapter, s.id)),
        readers: pack.readers.filter((r) => owns(chapter, r.id)),
        vocab: pack.vocab.filter((v) => ownsVocab(chapter, v)),
        writingIds: (pack.writingTasks ?? []).filter((w) => owns(chapter, w.id)).map((w) => w.id),
        infoGapIds: (pack.infoGapTasks ?? []).filter((g) => owns(chapter, g.id)).map((g) => g.id),
        grammarIds: [...new Set(scenarios.flatMap((s) => s.requiredStructures))],
      };
    });
}

/** Artifact ids that belong to no chapter — the honest "what's left over" list, so a UI grouped by
 *  chapter can still show everything (and a lint can assert this shrinks). */
export function unchaptered(pack: LanguagePack): { scenarios: string[]; stories: string[]; readers: string[]; vocab: string[] } {
  const chs = pack.chapters ?? [];
  const homeless = (id: string) => !chs.some((c) => owns(c, id));
  return {
    scenarios: pack.scenarios.filter((s) => homeless(s.id)).map((s) => s.id),
    stories: (pack.stories ?? []).filter((s) => homeless(s.id)).map((s) => s.id),
    readers: pack.readers.filter((r) => homeless(r.id)).map((r) => r.id),
    vocab: pack.vocab.filter((v) => !chs.some((c) => ownsVocab(c, v))).map((v) => v.id),
  };
}

const inOrder = (pack: LanguagePack): Chapter[] => [...(pack.chapters ?? [])].sort((a, b) => a.order - b.order);

/** Which chapter an artifact id belongs to (first match in course order), or undefined. */
export function chapterOf(pack: LanguagePack, id: string): Chapter | undefined {
  return inOrder(pack).find((c) => owns(c, id));
}

/** Which chapter teaches a vocab item. Unlike `chapterOf`, this also honours the tag routes — the
 *  chapter id in `tags`, and the semantic `wordTags` that distribute a hand-authored core word list. */
export function chapterOfVocab(pack: LanguagePack, item: ReviewItem): Chapter | undefined {
  return inOrder(pack).find((c) => ownsVocab(c, item));
}

/** A chapter counts as done when all four strands are satisfied: most of its words known, its grammar
 *  seen, its story read, and its scenario's success criteria met. `MIN_WORDS_KNOWN` mirrors the
 *  writing-capstone gate (70%) — a chapter shouldn't demand perfection to be called finished. */
export const MIN_WORDS_KNOWN = 0.7;

export function chapterStatus(content: ChapterContent, p: ChapterProgressInput): Omit<ChapterStatus, "state"> {
  const wordsTotal = content.vocab.length;
  const wordsKnown = content.vocab.filter((v) => p.familiarity[deriveKeyForItem(v).lexKey]?.status === "known").length;
  const grammarTotal = content.grammarIds.length;
  const grammarSeen = content.grammarIds.filter((g) => p.seenGrammar?.[g]).length;
  const storyDays = Math.max(0, ...content.stories.map((s) => p.storyReads?.[s.id]?.length ?? 0));
  const criteriaTotal = content.scenarios.reduce((n, s) => n + s.successCriteria.length, 0);
  const criteriaMet = content.scenarios.reduce(
    (n, s) => n + s.successCriteria.filter((c) => p.scenarios?.[s.id]?.metCriteria.includes(c.id)).length,
    0,
  );
  // Only strands the chapter actually has count toward the bar (a chapter with no reader isn't penalised).
  const strands: number[] = [];
  if (wordsTotal) strands.push(Math.min(1, wordsKnown / wordsTotal / MIN_WORDS_KNOWN));
  if (grammarTotal) strands.push(grammarSeen / grammarTotal);
  if (content.stories.length) strands.push(storyDays > 0 ? 1 : 0);
  if (criteriaTotal) strands.push(criteriaMet / criteriaTotal);
  const percent = strands.length ? strands.reduce((a, b) => a + b, 0) / strands.length : 0;
  return {
    id: content.chapter.id,
    percent,
    wordsKnown,
    wordsTotal,
    grammarSeen,
    grammarTotal,
    storyDays,
    storyRead: storyDays > 0,
    storyTotal: content.stories.length,
    criteriaMet,
    criteriaTotal,
  };
}

const isComplete = (s: Omit<ChapterStatus, "state">): boolean =>
  (!s.wordsTotal || s.wordsKnown / s.wordsTotal >= MIN_WORDS_KNOWN) &&
  s.grammarSeen === s.grammarTotal &&
  (!s.storyTotal || s.storyRead) &&
  s.criteriaMet === s.criteriaTotal;

/** Status for every chapter, with exactly one marked `current`: the first that isn't complete (or the
 *  last chapter, once they all are). Later chapters that happen to be complete still read as `done`,
 *  so a learner who jumped ahead isn't told they're behind. */
export function chapterMap(pack: LanguagePack, p: ChapterProgressInput): ChapterStatus[] {
  const resolved = resolveChapters(pack);
  const raw = resolved.map((c) => chapterStatus(c, p));
  const currentIdx = raw.findIndex((s) => !isComplete(s));
  return raw.map((s, i) => ({
    ...s,
    state: isComplete(s) ? "done" : i === (currentIdx === -1 ? raw.length - 1 : currentIdx) ? "current" : "upcoming",
  }));
}

/** The chapter the learner is working through right now. */
export function currentChapter(pack: LanguagePack, p: ChapterProgressInput): ChapterStatus | undefined {
  return chapterMap(pack, p).find((s) => s.state === "current");
}
