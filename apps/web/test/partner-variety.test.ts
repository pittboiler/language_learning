// Sessions together vary (Jake, 2026-11-14: "our partnered session this week is very similar (the same?) as
// when we did it last week despite us making progress"). With the last few sessions passed in, the point, the
// story and the grammar lines move on; partners far apart drop the two-lesson lag. Real Macedonian course.
//   Run with: npx tsx apps/web/test/partner-variety.test.ts
import assert from "node:assert/strict";
import { macedonian as pack } from "@ll/pack-mk";
import * as joint from "@ll/core/partner/joint";
import * as cp from "../lib/course-player.js";

const course = pack.course!;
const titles = { point: (id: string) => id, story: (id: string) => id, scenario: (id: string) => id, chapter: (o: number) => `chapter ${o}` };
const share = (order: number, n: number): joint.CoursePositionShare => {
  const at = { order, n };
  const ps = cp.pointSlots(course);
  return { chapterId: course.chapters.find((c) => c.order === order)!.chapterId, chapterOrder: order, session: n, points: course.points.filter((p) => cp.taughtBefore(ps.get(p.id), at)).map((p) => p.id) };
};
// What the app does (JointSession.tsx jointPlanFor + PartnerPanel startSession), for two same-pace partners.
const session = (order: number, n: number, recent: { points: string[]; stories: string[] }, seed: number, avoid: Set<string>) => {
  const me = share(order, n);
  const lag = cp.PARTNER_LAG;
  const plan = joint.planJointSession({ course, me, partner: me, content: { me: cp.lagShare(course, me, lag), partner: cp.lagShare(course, me, lag) }, drillCount: 0, titles, recent });
  const back = cp.slotBefore(course, cp.slotOfShare(me), lag);
  const lines = plan.focusPointId ? cp.grammarTogetherItems(pack, course, plan.focusPointId, back, back, () => false, { seed, avoid }) : [];
  return { point: plan.focusPointId, story: plan.storyId, lines: lines.flatMap((x) => (x.kind === "switch" || x.kind === "blank" ? [cp.grammarLineKey(x.line)] : [])) };
};

// Before: last week at 3.7, this week at 4.3, with no memory: the very same session.
const lastWeek = session(3, 7, { points: [], stories: [] }, 0, new Set());
const sameAgain = session(4, 3, { points: [], stories: [] }, 0, new Set());
assert.deepEqual(sameAgain, lastWeek, "without history the two weeks plan identically (the bug)");

// After: this week remembers last week.
const thisWeek = session(4, 3, { points: [lastWeek.point!], stories: [lastWeek.story!] }, 1, new Set(lastWeek.lines));
assert.notEqual(thisWeek.point, lastWeek.point, `a different point: ${lastWeek.point} → ${thisWeek.point}`);
assert.notEqual(thisWeek.story, lastWeek.story, `a different story: ${lastWeek.story} → ${thisWeek.story}`);
const overlap = thisWeek.lines.filter((l) => lastWeek.lines.includes(l)).length;
assert.ok(overlap < lastWeek.lines.length / 2, `most grammar lines are new (${overlap} of ${thisWeek.lines.length} repeat)`);

// Three sessions in a row in the same stretch: three different points.
const a = session(4, 3, { points: [], stories: [] }, 0, new Set());
const b = session(4, 3, { points: [a.point!], stories: [a.story!] }, 1, new Set(a.lines));
const c = session(4, 3, { points: [b.point!, a.point!], stories: [b.story!, a.story!] }, 2, new Set([...a.lines, ...b.lines]));
assert.equal(new Set([a.point, b.point, c.point]).size, 3, `rotates: ${a.point}, ${b.point}, ${c.point}`);

// Far apart: the distance the panel uses to drop the lag.
assert.equal(cp.sessionsApart(course, { order: 3, n: 6 }, { order: 3, n: 6 }), 0);
assert.ok(cp.sessionsApart(course, { order: 5, n: 3 }, { order: 3, n: 6 }) >= 4, "chapter 5.3 and 3.6 count as far apart");
assert.equal(cp.sessionsApart(course, { order: 4, n: 1 }, { order: 3, n: course.chapters.find((c) => c.order === 3)!.sessions.length }), 1, "the next chapter's first session is one lesson on");
console.log(`partner-variety.test.ts: all assertions passed ✓ (last week ${lastWeek.point} / ${lastWeek.story}; this week ${thisWeek.point} / ${thisWeek.story})`);
