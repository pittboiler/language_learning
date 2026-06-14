// Dev helper: redeem an invite code as a FRESH anonymous "partner" and publish some activity, so the
// active partner experience (activity visibility, shared streak, phrasebook) can be exercised in the
// browser with a real second user. Prints the created ids for cleanup.
//   npx tsx apps/web/scripts/partner-dev-join.ts <CODE>
//   npx tsx apps/web/scripts/partner-dev-join.ts --cleanup <partnershipId> <userId>
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function envFrom(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1]) out[m[1]] = (m[2] ?? "").trim();
  }
  return out;
}

const env = envFrom(new URL("../.env.local", import.meta.url).pathname);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !ANON) throw new Error("missing Supabase creds in apps/web/.env.local");

async function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === "--cleanup") {
    if (!SERVICE) throw new Error("cleanup needs SUPABASE_SERVICE_ROLE_KEY");
    const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } });
    if (argv[1]) await svc.from("partnership").delete().eq("id", argv[1]);
    if (argv[2]) await svc.auth.admin.deleteUser(argv[2]).catch(() => {});
    console.log("✓ cleaned up");
    return;
  }

  const code = argv[0];
  if (!code) throw new Error("usage: partner-dev-join.ts <CODE>");
  const c: SupabaseClient = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signErr } = await c.auth.signInAnonymously();
  if (signErr) throw new Error("anon sign-in failed: " + signErr.message);
  const { data: u } = await c.auth.getUser();
  const userId = u.user!.id;

  const { data, error } = await c.rpc("redeem_partner_invite", { code: code.trim().toUpperCase() });
  if (error) throw new Error("redeem failed: " + error.message);
  const row = (Array.isArray(data) ? data[0] : data) as { id: string; pack_id: string };

  // Publish some activity so the inviter sees a live partner.
  await c.from("partner_published_state").upsert({
    partnership_id: row.id,
    user_id: userId,
    pack_id: row.pack_id,
    data: { activity: { lastActiveDay: new Date().toISOString().slice(0, 10), metrics: { knownWordCount: 87, learningCount: 12, movedToKnownThisWeek: 9 } } },
  });

  console.log(`✓ joined partnership ${row.id} as ${userId}`);
  console.log(`  cleanup: npx tsx apps/web/scripts/partner-dev-join.ts --cleanup ${row.id} ${userId}`);
}

main().catch((e) => {
  console.error("✗ " + (e?.message ?? e));
  process.exit(1);
});
