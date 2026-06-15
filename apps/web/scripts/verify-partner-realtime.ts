// Headless proof of the Phase-4 real-time primitive against LIVE Supabase: a partner receives another
// partner's live-session change via postgres_changes, and presence syncs both partners. Requires
// migration 0003 (partner_artifact in the supabase_realtime publication). Creates + cleans up two
// throwaway anon users. Run:  npx tsx apps/web/scripts/verify-partner-realtime.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

function envFrom(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1]) out[m[1]] = (m[2] ?? "").trim();
  }
  return out;
}
const env = envFrom(new URL("../.env.local", import.meta.url).pathname);
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !ANON) throw new Error("missing Supabase creds in apps/web/.env.local");

async function anon(): Promise<{ c: SupabaseClient; id: string }> {
  const c = createClient(SUPA_URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInAnonymously();
  if (error) throw new Error("anon sign-in failed: " + error.message);
  const { data } = await c.auth.getUser();
  return { c, id: data.user!.id };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const A = await anon();
  const B = await anon();
  const pid = crypto.randomUUID();
  const code = "RT" + Math.floor(Math.random() * 1e6).toString(36).toUpperCase();

  const r = await A.c.from("partnership").insert({ id: pid, pack_id: "mk", a_user_id: A.id, status: "pending", invite_code: code });
  if (r.error) throw new Error(`insert partnership failed (migration 0002 applied?): ${r.error.message}`);
  const red = await B.c.rpc("redeem_partner_invite", { code });
  assert(!red.error, "redeem invite: " + red.error?.message);

  // (1) B subscribes to partner_artifact changes; A writes a 'live' session; B must receive it.
  const got = new Promise<{ kind?: string }>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("no realtime event in 10s — is migration 0003 applied (partner_artifact in supabase_realtime)?")), 10_000);
    const ch = B.c
      .channel(`test-artifacts:${pid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "partner_artifact", filter: `partnership_id=eq.${pid}` }, (payload) => {
        clearTimeout(timer);
        resolve((payload.new ?? {}) as { kind?: string });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await wait(600); // let the subscription settle before writing
          const w = await A.c.from("partner_artifact").insert({ id: crypto.randomUUID(), partnership_id: pid, pack_id: "mk", kind: "live", created_by: A.id, payload: { turnIndex: 0 } });
          if (w.error) reject(new Error("A insert artifact: " + w.error.message));
        }
      });
  });
  const payload = await got;
  assert.equal(payload.kind, "live", "B should receive A's live-session change");
  console.log("✓ (1) partner receives the live-session change via postgres_changes");

  // (2) presence: both partners join a channel; each should see 2 members.
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("presence did not sync to 2 members in 10s")), 10_000);
    let aSees = false;
    let bSees = false;
    const done = () => {
      if (aSees && bSees) {
        clearTimeout(timer);
        resolve();
      }
    };
    const chA = A.c.channel(`test-presence:${pid}`, { config: { presence: { key: A.id } } });
    const chB = B.c.channel(`test-presence:${pid}`, { config: { presence: { key: B.id } } });
    chA.on("presence", { event: "sync" }, () => {
      if (Object.keys(chA.presenceState()).length >= 2) {
        aSees = true;
        done();
      }
    }).subscribe((s) => {
      if (s === "SUBSCRIBED") void chA.track({ t: 1 });
    });
    chB.on("presence", { event: "sync" }, () => {
      if (Object.keys(chB.presenceState()).length >= 2) {
        bSees = true;
        done();
      }
    }).subscribe((s) => {
      if (s === "SUBSCRIBED") void chB.track({ t: 1 });
    });
  });
  console.log("✓ (2) presence syncs both partners (online indicator)");

  console.log("\n✅ partner realtime: live sync + presence both work");

  if (SERVICE) {
    const svc = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } });
    await svc.from("partnership").delete().eq("id", pid);
    for (const u of [A.id, B.id]) await svc.auth.admin.deleteUser(u).catch(() => {});
    console.log("✓ cleaned up test rows + anon users");
  }
  process.exit(0); // realtime websockets keep the event loop alive
}

main().catch((e) => {
  console.error("\n✗ " + (e?.message ?? e));
  process.exit(1);
});
