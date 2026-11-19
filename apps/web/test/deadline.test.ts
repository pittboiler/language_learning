// Runnable checks for the time limit on calls that might never answer (2026-11-19: a stalled speech provider
// left "Listening back…" up for minutes).
//   Run with: npx tsx apps/web/test/deadline.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DeadlineError, withDeadline } from "../lib/deadline.js";

// An answer in time comes through.
assert.equal(await withDeadline(200, "late", async () => "heard"), "heard");
// A failure in time is the failure, not a timeout.
await assert.rejects(withDeadline(200, "late", async () => { throw new Error("Scribe 401"); }), /Scribe 401/);

// No answer: rejects with the learner's message once the time is up, and tells the work to stop.
let aborted = false;
const t = Date.now();
await assert.rejects(
  withDeadline(80, "That took too long to hear back.", (signal) => new Promise<string>((_, reject) => {
    signal.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")); });
  })),
  (e: unknown) => e instanceof DeadlineError && e.message === "That took too long to hear back.",
);
assert.ok(Date.now() - t < 1000, "gives up at the deadline, not later");
assert.ok(aborted, "the stalled request is aborted");

// The speech route has its own limits: each engine, and the whole request.
const route = readFileSync(new URL("../app/api/asr/route.ts", import.meta.url), "utf8");
assert.match(route, /export const maxDuration = \d+;/, "the speech route can't run for minutes");
assert.match(route, /withDeadline\(ENGINE_MS/, "each engine has a time limit");
// The browser gives up a little after the server would have answered.
const api = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8");
assert.match(api, /withDeadline\(ASR_DEADLINE_MS/, "the speech check has a deadline");
assert.match(api, /withDeadline\(FEEDBACK_DEADLINE_MS/, "the feedback has a deadline");
console.log("deadline.test.ts: all assertions passed ✓");
