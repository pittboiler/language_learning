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

// ---- accounts (cross-device profiles) ----
// Identity is the ONLY thing standing between the existing per-user_id sync and true cross-device sync:
// progress already upserts to user_state keyed by uid (see store.ts), so signing in with the SAME email
// on web + phone makes uid() stable across them ⇒ the same row ⇒ synced learning. No migration needed.

export interface AuthUser {
  id: string;
  email?: string;
  isAnonymous: boolean;
}

/** The current user (anonymous or permanent), or null if Supabase isn't configured / there's no session.
 *  Reads the locally-cached session (no network round-trip), so it's cheap to call from the UI. */
export async function currentUser(): Promise<AuthUser | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  const u = data.session?.user;
  if (!u) return null;
  return { id: u.id, email: u.email || undefined, isAnonymous: (u as { is_anonymous?: boolean }).is_anonymous ?? !u.email };
}

/**
 * Start passwordless (magic-link) sign-in. If the current session is ANONYMOUS we upgrade it in place via
 * updateUser — the user id (and thus all their progress + partnerships) is preserved and the email is
 * linked. If that email already belongs to an account (upgrade rejected) we fall back to signing INTO it,
 * which on a second device is exactly what makes learning follow the user. Returns which path ran so the
 * UI can word the confirmation. The user must click the emailed link; supabase-js picks up the returning
 * session automatically (the link's redirect origin must be allowlisted in Supabase → Auth → URL config).
 */
export async function sendMagicLink(email: string): Promise<{ mode: "upgrade" | "signin" }> {
  const sb = supabase();
  if (!sb) throw new Error("Supabase not configured");
  const emailRedirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
  const me = await currentUser();
  if (me?.isAnonymous) {
    const { error } = await sb.auth.updateUser({ email }, { emailRedirectTo });
    if (!error) return { mode: "upgrade" }; // anon → permanent, same id, data preserved
    // else: email already registered / can't upgrade → fall through to sign into the existing account
  }
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo, shouldCreateUser: true } });
  if (error) throw error;
  return { mode: "signin" };
}

/** Sign out of a permanent account. The next uid() call re-establishes a fresh anonymous session. */
export async function signOut(): Promise<void> {
  const sb = supabase();
  if (sb) await sb.auth.signOut();
}
