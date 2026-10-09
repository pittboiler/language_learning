// Runnable checks for the partnered joint-session planner (@ll/core/partner/joint) over a tiny synthetic
// course — core never imports a language pack.
//   Run with: npx tsx packages/core/test/joint.test.ts
import assert from "node:assert/strict";
import type { Course, CourseSession } from "@ll/pack-schema";
import { planJointSession, type CoursePositionShare } from "../src/partner/joint.js";

const sess = (n: number, role: CourseSession["role"], extra: Partial<CourseSession> = {}): CourseSession =>
  ({ n, role, words: [], build: [], agenda: [], next: "", ...extra });
const point = (id: string, chapterId: string, order: number) =>
  ({ id, chapterId, order, grammarIds: [], depth: "produce", title: id.toUpperCase(), agenda: "", rule: "", recap: "", library: { rule: "", why: [], mistakes: [] }, examples: [], callbacks: [], cards: [], confidence: "validated" }) as Course["points"][number];
const course: Course = {
  points: [point("p1", "c1", 1), point("p2", "c1", 2), point("p3", "c2", 3), point("p4", "c2", 4)],
  chapters: [
    { chapterId: "c1", order: 1, pointIds: ["p1", "p2"], words: [], extraWords: [], checkpoint: { wordKeys: [], pointIds: ["p1", "p2"], scenarioId: "scen1" },
      sessions: [sess(1, "teach", { pointId: "p1", story: { id: "st1", lens: ["p1"], highlight: [0] } }), sess(2, "teach", { pointId: "p2", story: { id: "st1", lens: ["p2"], highlight: [] } }), sess(3, "review", { speak: "scen1" }), sess(4, "use", { speak: "scen1" }), sess(5, "checkpoint")] },
    { chapterId: "c2", order: 2, pointIds: ["p3", "p4"], words: [], extraWords: [], checkpoint: { wordKeys: [], pointIds: ["p3", "p4"], scenarioId: "scen2" },
      sessions: [sess(1, "teach", { pointId: "p3", story: { id: "st2", lens: ["p3"], highlight: [1] } }), sess(2, "teach", { pointId: "p4" }), sess(3, "review", { speak: "scen2" }), sess(4, "checkpoint")] },
  ],
  stageReviews: [],
  lineTags: { "story:st1#0": ["p1"], "story:st1#2": ["p1", "p2"], "story:st2#1": ["p3", "p1"], "story:st2#3": ["p1"], "story:st2#4": ["p1"] },
  chunkNotes: [],
};
const titles = { point: (id: string) => id.toUpperCase(), story: (id: string) => `Story ${id}`, scenario: (id: string) => `Convo ${id}`, chapter: (o: number) => `Chapter ${o}` };
const pos = (chapterOrder: number, session: number, points: string[]): CoursePositionShare => ({ chapterId: `c${chapterOrder}`, chapterOrder, session, points });

// 1. Same place: focus = latest shared point; story from a chapter both reached; conversation both unlocked.
let plan = planJointSession({ course, me: pos(1, 4, ["p1", "p2"]), partner: pos(1, 4, ["p1", "p2"]), drillCount: 8, titles });
assert.equal(plan.alignment, "same");
assert.equal(plan.focusPointId, "p2");
assert.equal(plan.storyId, "st1");
assert.deepEqual(plan.storyLines, [2]);
assert.equal(plan.scenarioId, "scen1", "both are past the review session");
assert.deepEqual(plan.items.map((i) => i.kind), ["drill", "point", "story", "speak"]);
assert.equal(plan.next?.pointId, "p3");
assert.equal(plan.next?.waitingOn, "both");

// 2. I'm ahead by two points: the plan stays on the overlap (p2), never my p3/p4; framing says so.
plan = planJointSession({ course, me: pos(2, 3, ["p1", "p2", "p3", "p4"]), partner: pos(1, 4, ["p1", "p2"]), drillCount: 5, titles, partnerName: "Madison" });
assert.equal(plan.alignment, "you-ahead");
assert.equal(plan.gap, 2);
assert.equal(plan.focusPointId, "p2", "focus is the latest SHARED point");
assert.equal(plan.sharedChapterOrder, 1);
assert.notEqual(plan.storyId, "st2", "no story from a chapter the partner hasn't reached");
assert.match(plan.framing, /You're 2 grammar points ahead/);
assert.match(plan.framing, /you'll mostly check/);
assert.equal(plan.next?.waitingOn, "partner");
assert.match(plan.next!.label, /after Madison has done Chapter 2, session 1/);

// 3. Partner ahead (mirror) and a conversation only one of us has unlocked is skipped.
plan = planJointSession({ course, me: pos(1, 3, ["p1", "p2"]), partner: pos(2, 1, ["p1", "p2", "p3"]), drillCount: 0, titles });
assert.equal(plan.alignment, "partner-ahead");
assert.match(plan.framing, /Your partner is 1 grammar point ahead/);
assert.equal(plan.scenarioId, undefined, "I haven't done chapter 1's speak session yet");
assert.ok(!plan.items.some((i) => i.kind === "drill"), "no drill when nothing is shared to drill");
assert.equal(plan.next?.waitingOn, "you");

// 4. Story choice prefers the most lines using the focus point, within reached chapters.
plan = planJointSession({ course, me: pos(2, 2, ["p1", "p2", "p3"]), partner: pos(2, 2, ["p1"]), drillCount: 3, titles });
assert.equal(plan.focusPointId, "p1");
assert.equal(plan.storyId, "st2", "st2 has 3 lines with p1 vs st1's 2");
assert.deepEqual(plan.storyLines, [1, 3, 4]);

// 5. Partner hasn't shared a position: solo framing, my own overlap; a partner who didn't practise → lighter.
plan = planJointSession({ course, me: pos(1, 2, ["p1"]), drillCount: 4, titles });
assert.equal(plan.alignment, "solo");
assert.equal(plan.focusPointId, "p1");
plan = planJointSession({ course, me: pos(1, 4, ["p1", "p2"]), partner: pos(1, 4, ["p1", "p2"]), drillCount: 6, titles, partnerActive: false });
assert.deepEqual(plan.items.map((i) => i.kind), ["story", "speak"], "a partner who didn't practise gets a light plan");

// 6. The story is a RE-READ: at chapter 2 session 1 neither of us has read st2 yet (it's today's story), so the
//    plan picks st1 — read by both — even though st2 has more lines using the focus point.
plan = planJointSession({ course, me: pos(2, 1, ["p1", "p2"]), partner: pos(2, 1, ["p1", "p2"]), drillCount: 3, titles });
assert.equal(plan.focusPointId, "p2");
assert.equal(plan.storyId, "st1", "a story both have already read");
// …and once both are past st2's session, the one with more focus lines wins.
plan = planJointSession({ course, me: pos(2, 2, ["p1", "p2", "p3"]), partner: pos(2, 2, ["p1"]), drillCount: 3, titles });
assert.equal(plan.storyId, "st2");
assert.deepEqual(plan.storyLines, [1, 3, 4]);

console.log("joint.test.ts: all assertions passed ✓");
