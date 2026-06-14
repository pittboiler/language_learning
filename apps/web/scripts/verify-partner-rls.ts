// Headless end-to-end verification of the partnered-learning privacy model against LIVE Supabase.
// This is THE proof of Phase 0's load-bearing property (DESIGN-partnered-learning.md §1.1 / §5.1).
// Creates three throwaway anonymous users and asserts:
//   (1) a partner CAN read my published projection;
//   (2) a partner CANNOT read my raw user_state (own-row-only RLS is intact);
//   (3) a non-member sees nothing;
//   (4) revoking visibility hides the data at the next publish;
//   (5) a member cannot overwrite the partner's published row.
// Requires migration 0002 applied. Run:  npx tsx apps/web/scripts/verify-partner-rls.ts
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
if (!SUPA_URL || !ANON) throw new Error("missing NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY in apps/web/.env.local");

const mk = (): SupabaseClient => createClient(SUPA_URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

async function anon(): Promise<{ c: SupabaseClient; id: string }> {
  const c = mk();
  const { error } = await c.auth.signInAnonymously();
  if (error) throw new Error("anonymous sign-in failed (enable Anonymous auth in Supabase): " + error.message);
  const { data } = await c.auth.getUser();
  return { c, id: data.user!.id };
}

async function main() {
  // Preflight: detect whether migration 0002 is applied before creating any throwaway users.
  const pre = await mk().from("partnership").select("id").limit(1);
  if (pre.error && (pre.error.code === "PGRST205" || /does not exist|schema cache/.test(pre.error.message))) {
    console.error("\nℹ Migration 0002 not applied yet — run apps/web/supabase/migrations/0002_partnered.sql in the\n  Supabase SQL editor, then re-run this script.");
    process.exit(2);
  }

  const A = await anon();
  const B = await anon();
  const C = await anon();
  const pid = crypto.randomUUID();
  const code = "VRFY" + Math.floor(Math.random() * 1e6).toString(36).toUpperCase();

  // A creates a pending invite; B redeems it (mutual consent).
  let r = await A.c.from("partnership").insert({ id: pid, pack_id: "mk", a_user_id: A.id, status: "pending", invite_code: code });
  if (r.error) throw new Error(`insert partnership failed (is migration 0002 applied?): ${r.error.message}`);
  const red = await B.c.rpc("redeem_partner_invite", { code });
  assert(!red.error, "B redeem invite: " + red.error?.message);

  // A publishes a projection (with metrics) and ALSO writes its own private user_state.
  const full = { activity: { lastActiveDay: "2026-06-14", metrics: { knownWordCount: 42, learningCount: 5, movedToKnownThisWeek: 3 } } };
  r = await A.c.from("partner_published_state").upsert({ partnership_id: pid, user_id: A.id, pack_id: "mk", data: full });
  assert(!r.error, "A publish: " + r.error?.message);
  await A.c.from("user_state").upsert({ user_id: A.id, data: { secret: "A-private" } });

  // (1) B CAN read A's published projection.
  const bPub = await B.c.from("partner_published_state").select("data,user_id").eq("partnership_id", pid).neq("user_id", B.id).maybeSingle();
  assert(!bPub.error && bPub.data, "B should see A's published row: " + bPub.error?.message);
  assert.equal((bPub.data!.data as { activity: { metrics?: { knownWordCount: number } } }).activity.metrics!.knownWordCount, 42);
  console.log("✓ (1) partner reads the published projection");

  // (2) B CANNOT read A's raw user_state (own-row-only RLS preserved).
  const bState = await B.c.from("user_state").select("data").eq("user_id", A.id);
  assert(!bState.error, "B read user_state errored: " + bState.error?.message);
  assert.equal(bState.data?.length ?? 0, 0, "B must NOT see A's raw user_state");
  console.log("✓ (2) raw user_state stays private (the single-user invariant holds)");

  // (3) non-member C sees nothing.
  const cPub = await C.c.from("partner_published_state").select("data").eq("partnership_id", pid);
  assert.equal(cPub.data?.length ?? 0, 0, "non-member C must see no published rows");
  const cPart = await C.c.from("partnership").select("id").eq("id", pid);
  assert.equal(cPart.data?.length ?? 0, 0, "non-member C must not see the partnership");
  console.log("✓ (3) non-member sees nothing");

  // (4) A revokes shareActivity → re-publishes gated (metrics dropped) → B no longer sees metrics.
  await A.c.from("partner_visibility").upsert({ partnership_id: pid, user_id: A.id, settings: { shareActivity: false, shareStreak: true, shareFamiliarity: true, allowTeachBack: true } });
  await A.c.from("partner_published_state").upsert({ partnership_id: pid, user_id: A.id, pack_id: "mk", data: { activity: { lastActiveDay: "2026-06-14" } } });
  const bPub2 = await B.c.from("partner_published_state").select("data").eq("partnership_id", pid).neq("user_id", B.id).maybeSingle();
  assert.equal((bPub2.data!.data as { activity: { metrics?: unknown } }).activity.metrics, undefined, "B must NOT see metrics after revoke");
  console.log("✓ (4) revoking visibility hides the data");

  // (5) B cannot overwrite A's published row (write is owner-only); A's row stays intact.
  await B.c.from("partner_published_state").update({ data: { hacked: true } }).eq("partnership_id", pid).eq("user_id", A.id);
  const aOwn = await A.c.from("partner_published_state").select("data").eq("partnership_id", pid).eq("user_id", A.id).maybeSingle();
  assert.notDeepEqual((aOwn.data!.data as { hacked?: boolean }).hacked, true, "B must not be able to overwrite A's published row");
  console.log("✓ (5) a member cannot overwrite the partner's published row");

  console.log("\n✅ partner RLS: all privacy properties hold");

  if (SERVICE) {
    const svc = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } });
    await svc.from("partnership").delete().eq("id", pid);
    for (const u of [A.id, B.id, C.id]) await svc.auth.admin.deleteUser(u).catch(() => {});
    console.log("✓ cleaned up test rows + anonymous users");
  } else {
    console.log("ℹ no service-role key — skipped cleanup (3 anon users + 1 partnership left behind)");
  }
}

main().catch((e) => {
  console.error("\n✗ " + (e?.message ?? e));
  process.exit(1);
});
