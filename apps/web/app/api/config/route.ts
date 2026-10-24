// Reports which providers are configured (booleans only — never the keys) + the model tiers.
import { existsSync } from "node:fs";
import { requireCaller } from "../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clean = (v?: string) => (!v || v.startsWith("PASTE_") ? "" : v.trim());

function hasGoogle(): boolean {
  if (clean(process.env.GOOGLE_CREDENTIALS_JSON)) return true;
  const f = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  return !!f && existsSync(f);
}

export async function GET(req: Request) {
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;
  return Response.json({
    engines: {
      eleven: !!clean(process.env.ELEVENLABS_API_KEY),
      google: hasGoogle(),
      anthropic: !!clean(process.env.ANTHROPIC_API_KEY),
    },
    models: {
      live: "claude-sonnet-4-6",
      offline: "claude-opus-4-8",
      tts: process.env.ELEVENLABS_TTS_MODEL || "eleven_multilingual_v2",
    },
  });
}
