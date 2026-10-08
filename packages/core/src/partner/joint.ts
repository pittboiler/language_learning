// @ll/core/partner/joint — the partnered session in the course's agenda → lesson → recap shape
// (DESIGN-course-spine.md §12). Both partners publish where they are in the course blueprint; this plans a
// joint session over the OVERLAP: the latest grammar point both have been taught, the furthest chapter both
// have reached, a story that uses that point, and a conversation both have unlocked. Being ahead never
// pushes your material onto your partner (the same rule the drill queue follows) — instead the plan says
// who's ahead, frames the roles, and names the next point you'll be able to share.
// Pure + language-agnostic: it reads only the Course structure and the two positions.
import type { Course } from "@ll/pack-schema";

/** What a member publishes about their place in the course (gated by shareActivity). */
export interface CoursePositionShare {
  chapterId: string;
  /** 1-based order of that chapter in the course. */
  chapterOrder: number;
  /** 1-based session within the chapter. */
  session: number;
  /** Point ids taught so far. */
  points: string[];
}

export type JointAlignment = "same" | "you-ahead" | "partner-ahead" | "solo";
export type JointItemKind = "drill" | "point" | "story" | "speak";

export interface JointItem {
  kind: JointItemKind;
  /** point id / story id / scenario id. */
  ref?: string;
  /** Drill: number of words queued for the two of you. */
  count?: number;
}

export interface JointPlan {
  alignment: JointAlignment;
  /** How many grammar points apart you are (always ≥ 0). */
  gap: number;
  /** The furthest chapter both have reached (1-based). */
  sharedChapterOrder: number;
  focusPointId?: string;
  /** The story read together and the lines in it that use the focus point. */
  storyId?: string;
  storyLines: number[];
  scenarioId?: string;
  items: JointItem[];
  /** The plan's framing line (who's where, and what that means for today). */
  framing: string;
  /** The agenda bullets. */
  agenda: string[];
  /** The next grammar point you'll be able to practise together, and what has to happen first. */
  next?: { pointId: string; waitingOn: "you" | "partner" | "both"; label: string };
  estMinutes: number;
}

export interface JointInputs {
  course: Course;
  me: CoursePositionShare;
  /** Absent ⇒ the partner hasn't shared a course position yet. */
  partner?: CoursePositionShare;
  /** Words the drill queue holds for the two of you (both studied, at least one still needs them). */
  drillCount: number;
  /** Did the partner practise in this window? false ⇒ a lighter plan. */
  partnerActive?: boolean;
  /** Point/story/scenario titles for the agenda text. */
  titles: { point: (id: string) => string; story: (id: string) => string; scenario: (id: string) => string; chapter: (order: number) => string };
  /** Display name for the partner in framing text (default "your partner"). */
  partnerName?: string;
}

const order = (course: Course, id: string) => course.points.find((p) => p.id === id)?.order ?? 0;

/** Index of the first session in a chapter where its conversation is attempted (speak), 1-based. */
const byOrder = (course: Course, o: number) => course.chapters.find((c) => c.order === o);

const speakFrom = (course: Course, chapterOrder: number): number | undefined => {
  const ch = byOrder(course, chapterOrder);
  return ch?.sessions.find((s) => !!s.speak)?.n;
};

/** Has a member unlocked a chapter's conversation (reached its first speak session, or moved past it)? */
const unlockedSpeak = (course: Course, p: CoursePositionShare, chapterOrder: number): boolean => {
  if (p.chapterOrder > chapterOrder) return true;
  if (p.chapterOrder < chapterOrder) return false;
  const n = speakFrom(course, chapterOrder);
  return n !== undefined && p.session > n; // the speak session itself has been done
};

export function planJointSession(inp: JointInputs): JointPlan {
  const { course, me, partner, titles } = inp;
  const who = inp.partnerName ?? "your partner";
  const Who = who.charAt(0).toUpperCase() + who.slice(1);

  // Overlap. Without the partner's position, fall back to mine (the drill is still both-studied-only).
  const mine = new Set(me.points);
  const theirs = partner ? new Set(partner.points) : mine;
  const shared = course.points.filter((p) => mine.has(p.id) && theirs.has(p.id)).map((p) => p.id);
  const focusPointId = shared.sort((a, b) => order(course, b) - order(course, a))[0];
  const sharedChapterOrder = partner ? Math.min(me.chapterOrder, partner.chapterOrder) : me.chapterOrder;

  // Who's ahead, by points taught (sessions break ties within a chapter).
  const gap = partner ? Math.abs(mine.size - theirs.size) : 0;
  const alignment: JointAlignment = !partner ? "solo"
    : mine.size > theirs.size ? "you-ahead"
    : mine.size < theirs.size ? "partner-ahead"
    : "same";

  // Story: the one (in chapters both have reached) with the most lines using the focus point; ties → the
  // most recent chapter, so it's fresh for both.
  let storyId: string | undefined;
  let storyLines: number[] = [];
  if (focusPointId) {
    const lineNo = (src: string) => Number(src.slice(src.lastIndexOf("#") + 1));
    const byStory = new Map<string, number[]>();
    for (const [src, tags] of Object.entries(course.lineTags)) {
      if (!src.startsWith("story:") || !tags.includes(focusPointId)) continue;
      const id = src.slice("story:".length, src.lastIndexOf("#"));
      byStory.set(id, [...(byStory.get(id) ?? []), lineNo(src)]);
    }
    const chapterOfStory = (id: string) =>
      course.chapters.find((c) => c.sessions.some((s) => s.story?.id === id && !s.story.reuse))?.order ?? Infinity;
    const best = [...byStory.entries()]
      .filter(([id]) => chapterOfStory(id) <= sharedChapterOrder)
      .sort((a, b) => b[1].length - a[1].length || chapterOfStory(b[0]) - chapterOfStory(a[0]))[0];
    if (best) { storyId = best[0]; storyLines = best[1].sort((x, y) => x - y); }
  }

  // Conversation: the latest chapter whose conversation BOTH have unlocked.
  let scenarioId: string | undefined;
  for (let o = sharedChapterOrder; o >= 0 && !scenarioId; o--) {
    const ok = unlockedSpeak(course, me, o) && (!partner || unlockedSpeak(course, partner, o));
    if (ok) scenarioId = byOrder(course, o)?.checkpoint.scenarioId;
  }

  // Items, in agenda → lesson order. A partner who hasn't practised this window gets a lighter plan.
  const light = inp.partnerActive === false;
  const items: JointItem[] = [];
  if (inp.drillCount > 0 && !light) items.push({ kind: "drill", count: Math.min(inp.drillCount, 12) });
  if (focusPointId && !light) items.push({ kind: "point", ref: focusPointId });
  if (storyId) items.push({ kind: "story", ref: storyId });
  if (scenarioId) items.push({ kind: "speak", ref: scenarioId });

  // Framing: where each of you is, and what that means for today's roles.
  const chap = (p: CoursePositionShare) => `chapter ${p.chapterOrder}, session ${p.session}`;
  const pts = (n: number) => `${n} grammar point${n === 1 ? "" : "s"}`;
  const framing = alignment === "solo"
    ? `${Who} hasn't shared a place in the course yet, so today uses what you've both studied.`
    : alignment === "same"
      ? `You're both at the same place (${chap(me)}${partner && (partner.chapterOrder !== me.chapterOrder || partner.session !== me.session) ? ` and ${chap(partner)}` : ""}): practise it together, taking turns.`
      : alignment === "you-ahead"
        ? `You're ${pts(gap)} ahead (${chap(me)}; ${who} is at ${chap(partner!)}). Today stays on what you've both learned: you'll mostly check, ${who} will mostly answer.`
        : `${Who} is ${pts(gap)} ahead (${chap(partner!)}; you're at ${chap(me)}). Today stays on what you've both learned: ${who} will mostly check, you'll mostly answer.`;

  // The next point you can share: the earliest point in the spine that at least one of you hasn't been taught.
  let next: JointPlan["next"];
  const nextPoint = course.points.find((p) => !(mine.has(p.id) && theirs.has(p.id)));
  if (nextPoint) {
    const waitingOn = !mine.has(nextPoint.id) && !theirs.has(nextPoint.id) ? "both" : !mine.has(nextPoint.id) ? "you" : "partner";
    const ch = course.chapters.find((c) => c.pointIds.includes(nextPoint.id));
    const s = ch?.sessions.find((x) => x.pointId === nextPoint.id && x.role === "teach")?.n;
    const where = `${titles.chapter(ch?.order ?? 0)}, session ${s}`;
    const label = waitingOn === "both"
      ? `Next together: ${titles.point(nextPoint.id)}, after you've both done ${where}.`
      : waitingOn === "you"
        ? `Next together: ${titles.point(nextPoint.id)}, after you've done ${where}.`
        : `Next together: ${titles.point(nextPoint.id)}, after ${who} has done ${where}.`;
    next = { pointId: nextPoint.id, waitingOn, label };
  }

  const agenda = items.map((it) =>
    it.kind === "drill" ? `Warm up together: ${it.count} word${it.count === 1 ? "" : "s"} you're both learning`
      : it.kind === "point" ? `Grammar together: ${titles.point(it.ref!)}`
        : it.kind === "story" ? `Read together: ${titles.story(it.ref!)}${storyLines.length && focusPointId ? `, spotting “${titles.point(focusPointId)}”` : ""}`
          : `Speak together: ${titles.scenario(it.ref!)}`);

  const estMinutes = items.reduce((m, it) => m + (it.kind === "drill" ? Math.max(2, Math.ceil((it.count ?? 0) * 0.5)) : it.kind === "point" ? 3 : 5), 0);
  return { alignment, gap, sharedChapterOrder, focusPointId, storyId, storyLines, scenarioId, items, framing, agenda, next, estMinutes: Math.max(3, estMinutes) };
}
