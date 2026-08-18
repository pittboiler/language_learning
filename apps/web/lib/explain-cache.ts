// SERVER-ONLY. Shared cross-user cache + rate-limit counter for the "Have a question?" helper (see
// migration 0006_ai_explain.sql). Reads/writes ai_explain and ai_ask_usage with the service-role key
// (bypasses RLS). Everything degrades gracefully if Storage/DB is absent — the look-up never breaks and
// the rate limit fails OPEN (the shared cache is the primary cost bound). Never import from client code.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface CachedExplain {
  answer: string;
}

let _svc: SupabaseClient | null | undefined;
function svc(): SupabaseClient | null {
  if (_svc !== undefined) return _svc;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  _svc = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return _svc;
}

/** Stable question key: lowercased, whitespace-collapsed, trimmed, length-capped — so trivially-different
 *  phrasings of the same free-text question share one cached answer. Canned questions pass their concept id. */
export function normalizeQuestion(q?: string): string {
  return (q ?? "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 200);
}

/** Cached answer for (pack, conversation, question), or null on miss / no-DB / any error. */
export async function getCachedExplain(packId: string, convoId: string, question: string): Promise<CachedExplain | null> {
  const sb = svc();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from("ai_explain")
      .select("answer")
      .eq("pack_id", packId)
      .eq("convo_id", convoId)
      .eq("question", question)
      .maybeSingle();
    if (error || !data) return null;
    return data as CachedExplain;
  } catch {
    return null;
  }
}

/** Best-effort store — a failure here must never fail the request (we already have the answer). */
export async function putCachedExplain(packId: string, convoId: string, question: string, v: { answer: string; model?: string }): Promise<void> {
  const sb = svc();
  if (!sb) return;
  try {
    await sb.from("ai_explain").upsert({ pack_id: packId, convo_id: convoId, question, answer: v.answer, model: v.model ?? "" });
  } catch {
    /* ignore — cache is an optimization */
  }
}

/** Increment this user's ask count for today (UTC) and return whether they're still under `limit`. Fails
 *  OPEN (returns true) on any DB error — the shared cache is the real cost bound; a soft over-count is fine. */
export async function bumpUsage(userId: string, limit: number): Promise<boolean> {
  const sb = svc();
  if (!sb || !userId) return true;
  const day = new Date().toISOString().slice(0, 10);
  try {
    const { data } = await sb.from("ai_ask_usage").select("count").eq("user_id", userId).eq("day", day).maybeSingle();
    const count = (data as { count?: number } | null)?.count ?? 0;
    if (count >= limit) return false;
    await sb.from("ai_ask_usage").upsert({ user_id: userId, day, count: count + 1 });
    return true;
  } catch {
    return true; // fail-open
  }
}
