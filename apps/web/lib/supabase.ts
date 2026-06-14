// One shared Supabase client + the anonymous-session helper, so the progress store and the partner
// store see the SAME anonymous user (and we avoid duplicate-GoTrueClient warnings / token races).
// Returns null when creds are absent — the app then falls back to localStorage, and partner features
// are disabled (linking two devices needs a real backend, not per-device localStorage).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null | undefined;

/** The shared anon client, or null if Supabase isn't configured. */
export function supabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  cached = url && anonKey ? createClient(url, anonKey) : null;
  return cached;
}

export function supabaseConfigured(): boolean {
  return supabase() !== null;
}

/** Ensure an anonymous session and return its user id. Throws if not configured / sign-in fails. */
export async function uid(): Promise<string> {
  const sb = supabase();
  if (!sb) throw new Error("Supabase not configured");
  let { data } = await sb.auth.getSession();
  if (!data.session) {
    await sb.auth.signInAnonymously();
    ({ data } = await sb.auth.getSession());
  }
  if (!data.session) throw new Error("Supabase anonymous sign-in failed (is Anonymous auth enabled?)");
  return data.session.user.id;
}
