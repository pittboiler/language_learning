// Runnable check for the partnership primitive (no test harness in this repo — run with:
//   npx tsx packages/core/test/partner.test.ts
// Pure logic only; covers the invite/consent state machine, its trust guards, and the shared streak.
import assert from "node:assert/strict";
import {
  invite,
  accept,
  pause,
  resume,
  end,
  isActive,
  partnerOf,
  sharedStreak,
  buildPartnerSession,
  DEFAULT_VISIBILITY,
  type ActivityRecord,
} from "../src/partner/index.js";

const A = "user-a";
const B = "user-b";
const C = "user-c";
const t0 = new Date("2026-06-14T10:00:00Z");
const t1 = new Date("2026-06-14T11:00:00Z");

// ---- invite ----
const p0 = invite("p1", "mk", A, "ABC123", t0);
assert.equal(p0.status, "pending");
assert.deepEqual(p0.members, [A, undefined]);
assert.equal(p0.inviteCode, "ABC123");
assert.equal(p0.packId, "mk");
assert.equal(p0.createdAt, t0);
assert.equal(isActive(p0), false);

// ---- accept (mutual consent) ----
const p1 = accept(p0, B, t1);
assert.equal(p1.status, "active");
assert.deepEqual(p1.members, [A, B]);
assert.equal(p1.updatedAt, t1);
assert.equal(isActive(p1), true);

// ---- accept guards (the trust boundary) ----
assert.throws(() => accept(p0, A), /yourself/, "cannot partner with yourself");
assert.throws(() => accept(p1, C), /cannot accept/, "cannot accept an active partnership");

// ---- partnerOf ----
assert.equal(partnerOf(p1, A), B);
assert.equal(partnerOf(p1, B), A);
assert.equal(partnerOf(p1, C), undefined);

// ---- pause / resume / end + guards (no-shame exit) ----
const paused = pause(p1);
assert.equal(paused.status, "paused");
assert.throws(() => pause(p1.status === "active" ? paused : p1), /cannot pause/);
const resumed = resume(paused);
assert.equal(resumed.status, "active");
assert.throws(() => resume(resumed), /cannot resume/);
const ended = end(resumed);
assert.equal(ended.status, "ended");
assert.equal(end(ended), ended, "end is idempotent");

// ---- default visibility (trusted-dyad permissive, all revocable) ----
assert.deepEqual(DEFAULT_VISIBILITY, {
  shareActivity: true,
  shareFamiliarity: true,
  shareStreak: true,
  allowTeachBack: true,
});

// ---- shared streak ----
const act = (day: string): ActivityRecord => ({ lastActiveDay: day });
// not both active today → unchanged
assert.deepEqual(sharedStreak(act("2026-06-14"), act("2026-06-13"), "2026-06-14"), { count: 0, lastDay: "" });
// both active, first joint day → 1
assert.deepEqual(sharedStreak(act("2026-06-14"), act("2026-06-14"), "2026-06-14"), { count: 1, lastDay: "2026-06-14" });
// idempotent on the same day
assert.deepEqual(
  sharedStreak(act("2026-06-14"), act("2026-06-14"), "2026-06-14", { count: 5, lastDay: "2026-06-14" }),
  { count: 5, lastDay: "2026-06-14" },
);
// consecutive day → +1
assert.deepEqual(
  sharedStreak(act("2026-06-15"), act("2026-06-15"), "2026-06-15", { count: 5, lastDay: "2026-06-14" }),
  { count: 6, lastDay: "2026-06-15" },
);
// one-day gap WITHOUT a freeze → reset to 1
assert.deepEqual(
  sharedStreak(act("2026-06-16"), act("2026-06-16"), "2026-06-16", { count: 5, lastDay: "2026-06-14" }, 0),
  { count: 1, lastDay: "2026-06-16" },
);
// same one-day gap WITH a freeze → bridges, +1
assert.deepEqual(
  sharedStreak(act("2026-06-16"), act("2026-06-16"), "2026-06-16", { count: 5, lastDay: "2026-06-14" }, 1),
  { count: 6, lastDay: "2026-06-16" },
);
// month boundary, consecutive → +1 (date math, not string compare)
assert.deepEqual(
  sharedStreak(act("2026-07-01"), act("2026-07-01"), "2026-07-01", { count: 9, lastDay: "2026-06-30" }),
  { count: 10, lastDay: "2026-07-01" },
);

// ---- buildPartnerSession: the structured joint cadence ----

// daily, partner can help + a scenario → light pass: review + speak (no teach-back; no story once ≥2 items)
const daily = buildPartnerSession({ cadence: "daily", partnerCanHelpMe: 9, iCanHelpPartner: 7, speakScenarioId: "cafe-1", storyId: "s1" });
assert.equal(daily.window, "today");
assert.deepEqual(daily.items.map((i) => i.kind), ["review-help", "speak"]);
assert.equal(daily.items[0]!.count, 5, "daily caps review-help at 5");

// weekly widens: review (cap 12) + speak + teach-back + story
const weekly = buildPartnerSession({ cadence: "weekly", partnerCanHelpMe: 20, iCanHelpPartner: 7, speakScenarioId: "cafe-1", storyId: "s1" });
assert.equal(weekly.window, "this week");
assert.deepEqual(weekly.items.map((i) => i.kind), ["review-help", "speak", "teachback", "story"]);
assert.equal(weekly.items[0]!.count, 12, "weekly caps review-help at 12");

// thin daily (nothing to review) → speak + story (story fills when the plan is < 2 items)
const thin = buildPartnerSession({ cadence: "daily", partnerCanHelpMe: 0, iCanHelpPartner: 0, speakScenarioId: "cafe-1", storyId: "s1" });
assert.deepEqual(thin.items.map((i) => i.kind), ["speak", "story"]);

// nothing shared yet → empty plan (the UI shows a "each do a solo session first" hint), floored to 3 min
const empty = buildPartnerSession({ cadence: "daily", partnerCanHelpMe: 0, iCanHelpPartner: 0 });
assert.deepEqual(empty.items, []);
assert.equal(empty.estMinutes, 3);

// ---- adaptive cadence: tilt by who did more solo work this window ----
// no recency signal → balanced (unchanged behavior)
assert.equal(daily.emphasis, "balanced");
assert.equal(weekly.emphasis, "balanced");

// I did much more → I teach: teach-back included even on daily + boosted; review-help trimmed
const youTeach = buildPartnerSession({ cadence: "daily", partnerCanHelpMe: 10, iCanHelpPartner: 10, speakScenarioId: "cafe-1", myRecent: 20, partnerRecent: 2 });
assert.equal(youTeach.emphasis, "you-teach");
assert.deepEqual(youTeach.items.map((i) => i.kind), ["review-help", "speak", "teachback"]);
assert.equal(youTeach.items[0]!.count, 3, "review-help trimmed when I'm ahead (ceil(5/2))");
assert.equal(youTeach.items[2]!.count, 8, "teach-back boosted when I'm ahead");

// partner did much more → they help me: review-help widened, no teach-back on daily
const partnerTeaches = buildPartnerSession({ cadence: "daily", partnerCanHelpMe: 20, iCanHelpPartner: 10, speakScenarioId: "cafe-1", myRecent: 1, partnerRecent: 15 });
assert.equal(partnerTeaches.emphasis, "partner-teaches");
assert.deepEqual(partnerTeaches.items.map((i) => i.kind), ["review-help", "speak"]);
assert.equal(partnerTeaches.items[0]!.count, 9, "review-help widened when partner is ahead (base+4)");

// partner inactive this window → light catch-up (speak + story only), regardless of the diff sizes
const catchUp = buildPartnerSession({ cadence: "weekly", partnerCanHelpMe: 30, iCanHelpPartner: 30, speakScenarioId: "cafe-1", storyId: "s1", partnerActive: false });
assert.equal(catchUp.emphasis, "catch-up");
assert.deepEqual(catchUp.items.map((i) => i.kind), ["speak", "story"]);

console.log("✓ partner primitive: all assertions passed");
