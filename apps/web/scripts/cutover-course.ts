// Course cutover, step 2 (DESIGN-course-spine.md §10): back up and reset the learners' progress so they
// start the new course fresh, keeping only ★ saved words/grammar cards (+ settings and alphabet).
//
//   DRY RUN (default, read-only):  npx tsx apps/web/scripts/cutover-course.ts --email <you> [--partner]
//   APPLY (writes user_state):     npx tsx apps/web/scripts/cutover-course.ts --email <you> [--partner] --apply
//
// Both modes write a backup of every affected row to backups/<date>/ first (git-ignored). --partner adds
// the other member of the email's active partnership. Restore = upsert a backup's `data` back.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Progress } from "../lib/store.js";
import { freshStart } from "../lib/reset.js";

const here = dirname(fileURLToPath(import.meta.url));
const env: Record<string, string> = {};
for (const line of readFileSync(join(here, "..", ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m?.[1]) env[m[1]] = (m[2] ?? "").trim();
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !SERVICE) throw new Error("needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local");
const arg = (f: string) => { const i = process.argv.indexOf(f); return i === -1 ? undefined : process.argv[i + 1]; };
const EMAIL = arg("--email")?.toLowerCase();
const PARTNER = process.argv.includes("--partner");
const APPLY = process.argv.includes("--apply");
if (!EMAIL) throw new Error("--email is required");

const sb = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

async function userByEmail(email: string) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return undefined;
  }
}

const me = await userByEmail(EMAIL);
if (!me) throw new Error(`no auth user with email ${EMAIL}`);
const targets: { role: string; id: string; email?: string }[] = [{ role: "you", id: me.id, email: me.email }];
if (PARTNER) {
  const { data: ps, error } = await sb.from("partnership").select("*").or(`a_user_id.eq.${me.id},b_user_id.eq.${me.id}`);
  if (error) throw error;
  const active = (ps ?? []).filter((p) => p.status === "active" && p.b_user_id);
  console.log(`partnerships: ${(ps ?? []).length} (${active.length} active)`);
  if (active.length !== 1) throw new Error(`expected exactly one active partnership, found ${active.length}: ${JSON.stringify(ps)}`);
  const pid = active[0].a_user_id === me.id ? active[0].b_user_id : active[0].a_user_id;
  const { data: pu } = await sb.auth.admin.getUserById(pid);
  targets.push({ role: "partner", id: pid, email: pu.user?.email ?? "(anonymous)" });
}

const day = new Date().toISOString().slice(0, 10);
const dir = join(here, "..", "..", "..", "backups", day);
mkdirSync(dir, { recursive: true });

for (const t of targets) {
  const { data: row, error } = await sb.from("user_state").select("*").eq("user_id", t.id).maybeSingle();
  if (error) throw error;
  if (!row) { console.log(`\n${t.role} (${t.email}): no user_state row — nothing to reset`); continue; }
  const file = join(dir, `user_state-${t.role}-${t.id}-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(row, null, 2));
  const data = row.data as Progress;
  const { next, summary } = freshStart(data, { courseV2: true });
  const fam = Object.values(data.familiarity ?? {});
  console.log(`\n=== ${t.role} (${t.email}) ===`);
  console.log(`backup: ${file}`);
  console.log(`now: ${fam.length} tracked words/cards, ${data.sessions ?? 0} sessions, streak ${data.streak?.count ?? 0}, chapters passed: ${Object.keys(data.chapters ?? {}).length}`);
  console.log(`KEEP (${summary.kept.length} ★ saved): ${summary.kept.map((k) => data.familiarity[k]?.display ?? k).join(" · ") || "(none)"}`);
  console.log(`KEEP too: settings, alphabet (${Object.keys(data.letters ?? {}).length} letters), sentence context for kept items`);
  console.log(`CLEAR: ${summary.cleared} other tracked words/cards; fields: ${summary.clearedFields.join(", ")}`);
  if (APPLY) {
    const stamped = { ...next, savedAt: Date.now() }; // newer than any device's cached copy, so it wins on load
    const { error: e2 } = await sb.from("user_state").upsert({ user_id: t.id, data: stamped, updated_at: new Date().toISOString() });
    if (e2) throw e2;
    console.log("✓ reset applied");
  }
}
console.log(APPLY ? "\nDone." : "\nDRY RUN — nothing was written. Re-run with --apply to reset.");
