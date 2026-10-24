// SERVER-ONLY. Shared cross-user cache for the "Have a question?" helper (see migration 0006_ai_explain.sql).
// Reads/writes ai_explain with the service-role key (bypasses RLS). Everything degrades gracefully if the DB
// is absent: the look-up never breaks. The daily limit now lives in the usage ledger (lib/usage.ts).
// Never import from client code.
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
