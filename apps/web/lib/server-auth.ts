// SERVER-ONLY. Who is calling an /api route. The browser sends its Supabase session (anonymous or a real
// account) as `Authorization: Bearer <access token>` (lib/api.ts); every route checks it before doing
// anything that costs money, so the provider keys behind these routes can't be spent by anyone with the URL.
// The token is checked with Supabase Auth (which also catches revoked sessions) and the answer is remembered
// briefly per token, so a burst of calls doesn't re-check each one. Never import from client code.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface Caller {
  id: string;
  /** An anonymous session (no email linked yet). */
  anonymous: boolean;
}

let _auth: SupabaseClient | null | undefined;
function authClient(): SupabaseClient | null {
  if (_auth !== undefined) return _auth;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  _auth = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return _auth;
}

const RECHECK_MS = 5 * 60_000;
const known = new Map<string, { caller: Caller; until: number }>();

/** The token's own expiry (ms), read from its payload; the signature is Supabase's to check, not ours. */
function expiresAt(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()) as { exp?: number };
    return payload.exp ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/** The signed-in caller, or null when there's no valid session on the request. */
export async function callerOf(req: Request): Promise<Caller | null> {
  const token = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!token) return null;
  const now = Date.now();
  const hit = known.get(token);
  if (hit && hit.until > now) return hit.caller;
  const sb = authClient();
  if (!sb) return null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  const caller: Caller = { id: data.user.id, anonymous: data.user.is_anonymous ?? !data.user.email };
  if (known.size > 5000) known.clear(); // a crude bound: an instance only ever sees a few live sessions
  known.set(token, { caller, until: Math.min(now + RECHECK_MS, expiresAt(token) || now + RECHECK_MS) });
  return caller;
}

/**
 * The caller, or the response to send instead: 401 without a valid session. Without Supabase configured
 * (local dev only) every request is a single local caller; in production that's a 503, never an open door.
 */
export async function requireCaller(req: Request): Promise<Caller | Response> {
  if (!authClient()) {
    if (process.env.NODE_ENV !== "production") return { id: "local", anonymous: true };
    return Response.json({ error: "Sign-in isn't configured on the server." }, { status: 503 });
  }
  const caller = await callerOf(req);
  return caller ?? Response.json({ error: "Your session has expired. Reload the page and try again." }, { status: 401 });
}
