// SERVER-ONLY. Shared cross-user cache for single-word glosses (see migration 0005_word_gloss.sql).
// Reads/writes the `word_gloss` table with the service-role key (bypasses RLS). Two users tapping the
// same word in the same sentence resolve to ONE stored gloss instead of independent LLM rolls, so the
// paired experience stays consistent. Everything degrades to a plain LLM call if Storage/DB is absent
// or errors — the look-up never breaks. Never import from client code (holds the service-role key).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface CachedGloss {
  gloss: string;
  translit: string;
  lemma: string;
}

let _svc: SupabaseClient | null | undefined;
function svc(): SupabaseClient | null {
  if (_svc !== undefined) return _svc;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  _svc = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return _svc;
}

/** Stable context key: lowercased, trimmed, whitespace-collapsed — so both partners on the same line
 *  hit the same row while different sentences keep their own (sense-disambiguated) gloss. */
export function normalizeContext(context?: string): string {
  return (context ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Cached gloss for (pack, word, context), or null on miss / no-DB / any error. */
export async function getCachedGloss(packId: string, word: string, context: string): Promise<CachedGloss | null> {
  const sb = svc();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from("word_gloss")
      .select("gloss,translit,lemma")
      .eq("pack_id", packId)
      .eq("word", word)
      .eq("context", context)
      .maybeSingle();
    if (error || !data) return null;
    return data as CachedGloss;
  } catch {
    return null;
  }
}

/** Best-effort store — a failure here must never fail the look-up (we already have the gloss). */
export async function putCachedGloss(packId: string, word: string, context: string, g: CachedGloss): Promise<void> {
  const sb = svc();
  if (!sb) return;
  try {
    await sb.from("word_gloss").upsert({ pack_id: packId, word, context, gloss: g.gloss, translit: g.translit, lemma: g.lemma });
  } catch {
    /* ignore — cache is an optimization */
  }
}
