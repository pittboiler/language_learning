// SERVER-ONLY. The per-user usage ledger (migration 0007_api_usage.sql). Each paid call is counted against
// the caller's caps for the UTC day (calls per route, and total spend across routes) before it runs, and its
// cost is added after the response goes out. Calls that cost nothing (a cached clip or answer, a course word,
// an exact-match spoken line) aren't counted. These are the caps for everyone today; free and paid tiers will
// set their own later. If the ledger is missing or erroring the caps fail OPEN (the session check still
// holds) with one warning in the log, so deploying ahead of the migration never breaks the app.
import { after } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Caller } from "./server-auth";

export type PaidRoute = "asr" | "feedback" | "tts" | "gloss" | "explain" | "chat" | "write" | "exam" | "guided-review" | "import";

/** Paid calls per user per UTC day. Sized for a heavy learning day (a few sessions); abuse hits them fast. */
export const DAILY_CALLS: Record<PaidRoute, number> = {
  asr: 400, // every spoken attempt (Scribe + Google)
  feedback: 300, // spoken coaching that needs Sonnet (an exact match skips it, uncounted)
  tts: 120, // NEW clips only: a cached clip costs nothing
  gloss: 150, // look-ups that need Haiku (course words and cached glosses are free)
  explain: 25, // "Have a question?" answers not already cached (DESIGN-ai-explain.md §5)
  chat: 100,
  write: 60,
  exam: 30,
  "guided-review": 10,
  import: 10,
};

/** Total spend per user per UTC day, across every route (reported costs plus the estimates below). */
export const DAILY_COST_CAP_USD = 3;

/** Rough costs for the calls that don't report their own (list prices, rounded up). */
const ESTIMATED_COST_USD: Partial<Record<PaidRoute, number>> = {
  asr: 0.007, // a few seconds through Scribe, plus Google STT's 15-second minimum
  tts: 0.03, // one new line on eleven_v3, up to three checked takes each heard back by Scribe
};

let _svc: SupabaseClient | null | undefined;
function svc(): SupabaseClient | null {
  if (_svc !== undefined) return _svc;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  _svc = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return _svc;
}

let warned = false;
function ledgerDown(why: string): void {
  if (warned) return;
  warned = true;
  console.warn(`[usage] the usage ledger isn't working, so daily caps aren't enforced (is migration 0007 applied?): ${why}`);
}

const limited = (route: PaidRoute) =>
  route === "explain"
    ? Response.json({ error: "rate_limited" }, { status: 429 }) // the "Have a question?" UI words this one itself
    : Response.json({ error: "You've reached today's limit for this. It resets at midnight UTC.", limit: "daily" }, { status: 429 });

/** Count one paid call against the caller's caps: null to go ahead, or the 429 to send instead. */
export async function spend(caller: Caller, route: PaidRoute): Promise<Response | null> {
  const sb = svc();
  if (!sb || caller.id === "local") return null;
  try {
    const { data, error } = await sb.rpc("api_usage_hit", { p_user: caller.id, p_route: route, p_call_cap: DAILY_CALLS[route], p_cost_cap: DAILY_COST_CAP_USD });
    if (error) { ledgerDown(error.message); return null; }
    return data === false ? limited(route) : null;
  } catch (e) {
    ledgerDown(e instanceof Error ? e.message : String(e));
    return null;
  }
}

/** Add what a call cost to the caller's day, once the response has gone: it never delays or fails a request.
 *  Without a reported cost the route's estimate is used. */
export function recordCost(caller: Caller, route: PaidRoute, costUsd?: number): void {
  const cost = typeof costUsd === "number" && costUsd > 0 ? costUsd : ESTIMATED_COST_USD[route] ?? 0;
  const sb = svc();
  if (!sb || caller.id === "local" || cost <= 0) return;
  after(async () => {
    try {
      const { error } = await sb.rpc("api_usage_cost", { p_user: caller.id, p_route: route, p_cost: Number(cost.toFixed(4)) });
      if (error) ledgerDown(error.message);
    } catch (e) {
      ledgerDown(e instanceof Error ? e.message : String(e));
    }
  });
}
