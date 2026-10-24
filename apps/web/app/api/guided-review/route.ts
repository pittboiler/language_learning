// The end of a guided conversation (DESIGN-partnered-conversation.md §3.3): the whole transcript, reviewed
// once (core/coach, Opus 5.5). The cues are looked up here by id and the AI partner's lines rebuilt from them,
// never taken from the client; each speaker is held only to what their own place in the course has taught.
import * as coach from "@ll/core/coach";
import * as guided from "@ll/core/partner/guided";
import type { GuidedCue } from "@ll/pack-schema";
import { getPack } from "../../../lib/packs";
import * as cp from "../../../lib/course-player";
import { romanize } from "../../../lib/romanize";
import { requireCaller } from "../../../lib/server-auth";
import { recordCost, spend } from "../../../lib/usage";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  packId?: string;
  cueIds: string[];
  /** Two members, the first to speak first. The AI partner is guided.AI_MEMBER. */
  members: { id: string; name: string; at?: cp.CourseSlot }[];
  segments: { turn: number; transcripts?: { scribe?: string; google?: string }; text?: string; skipped?: boolean }[];
}

export async function POST(req: Request) {
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "Anthropic not configured" }, { status: 400 });
  const body = (await req.json()) as Body;
  const pack = getPack(body.packId);
  const course = pack.course;
  const all = new Map((course?.guided ?? []).flatMap((d) => d.cues).map((c) => [c.id, c]));
  const cues = (body.cueIds ?? []).slice(0, 12).map((id) => all.get(id));
  if (!course || !cues.length || cues.some((c) => !c)) return Response.json({ error: "unknown cues" }, { status: 400 });
  if (body.members?.length !== 2 || body.members[0]!.id === body.members[1]!.id) return Response.json({ error: "two members" }, { status: 400 });
  const [m0, m1] = body.members as [Body["members"][0], Body["members"][0]];
  const s = guided.startGuided({ id: "review", packId: pack.id, members: [m0.id, m1.id], names: { [m0.id]: m0.name.slice(0, 40), [m1.id]: m1.name.slice(0, 40) }, cues: cues as GuidedCue[], startedAt: "" });
  const clip = (x?: string) => x?.slice(0, 1500);
  const rows = body.members.map((m) => ({
    ...guided.emptyRow("review", m.id),
    segments: (body.segments ?? []).filter((x) => guided.speakerOf(s, x.turn) === m.id).map((x) => m.id === guided.AI_MEMBER
      ? { turn: x.turn, at: "", text: guided.aiLine(s, x.turn).text }
      : { turn: x.turn, at: "", ...(x.skipped ? { skipped: true } : x.text !== undefined ? { text: clip(x.text) } : { transcripts: { scribe: clip(x.transcripts?.scribe), google: clip(x.transcripts?.google) } }) }),
  }));
  if (guided.phase(s, rows) !== "reviewing") return Response.json({ error: "the conversation isn't finished" }, { status: 400 });
  const speakers = body.members.map((m): coach.CoachSpeaker => {
    if (m.id === guided.AI_MEMBER || !m.at) return { id: m.id, name: m.name, taughtWords: [], taughtGrammar: [] };
    const t = cp.taughtFor(course, m.at);
    return { id: m.id, name: m.name, taughtWords: t.words, taughtGrammar: t.grammar };
  });
  const over = await spend(caller, "guided-review");
  if (over) return over;
  try {
    const review = await coach.reviewConversation({
      languageName: pack.name,
      register: "informal: the two are friends; a cue may ask for the polite or plural form (a stranger, a seller, more than one person)",
      speakers,
      turns: guided.transcript(s, rows),
    });
    recordCost(caller, "guided-review", review.costUsd);
    return Response.json({ ...review, fixes: review.fixes.map((f) => ({ ...f, betterTranslit: romanize(f.better) })) });
  } catch (e) {
    return Response.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
