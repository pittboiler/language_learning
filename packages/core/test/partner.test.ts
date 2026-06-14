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

console.log("✓ partner primitive: all assertions passed");
