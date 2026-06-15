// Dev helper: simulate the PARTNER speaking the current live-conversation turn (advances the session
// via the service role, bypassing RLS) so the my-turn UI + turn handoff can be exercised single-browser.
//   npx tsx apps/web/scripts/partner-dev-speak-live.ts <partnershipId>
import { createClient } from "@supabase/supabase-js";
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
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !SERVICE) throw new Error("need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");

interface LiveTurn { index: number; speaker: string; text: string; spokenBy?: string; transcript?: string; score?: number }
interface LiveSession { turnIndex: number; turns: LiveTurn[]; assignment: Record<string, string>; status: string }

async function main() {
  const pid = process.argv[2];
  if (!pid) throw new Error("usage: partner-dev-speak-live.ts <partnershipId>");
  const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const { data, error } = await svc
    .from("partner_artifact")
    .select("id,payload")
    .eq("partnership_id", pid)
    .eq("kind", "live")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("no live session for that partnership");
  const s = data.payload as LiveSession;
  const turn = s.turns[s.turnIndex];
  if (!turn) throw new Error("session already complete");
  const partnerUserId = Object.keys(s.assignment).find((u) => s.assignment[u] === turn.speaker)!;
  s.turns[s.turnIndex] = { ...turn, spokenBy: partnerUserId, transcript: turn.text, score: 92 };
  s.turnIndex += 1;
  s.status = s.turnIndex >= s.turns.length ? "complete" : "active";
  const up = await svc.from("partner_artifact").update({ payload: s, updated_at: new Date().toISOString() }).eq("id", data.id);
  if (up.error) throw up.error;
  console.log(`✓ ${turn.speaker} spoke "${turn.text}" → now turn ${s.turnIndex}/${s.turns.length} (${s.status})`);
}

main().catch((e) => {
  console.error("✗ " + (e?.message ?? e));
  process.exit(1);
});
