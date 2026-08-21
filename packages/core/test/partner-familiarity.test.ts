// Runnable check for the Phase-2 cross-partner familiarity engine. Run with:
//   npx tsx packages/core/test/partner-familiarity.test.ts
import assert from "node:assert/strict";
import { projectFamiliarity, complementaryDiff, type FamiliarityProjection } from "../src/partner/familiarity-diff.js";
import { routeComplementary } from "../src/partner/complementary-srs.js";
import { proposeTeachBacks } from "../src/teachback/index.js";
import { EXPOSED_TAG, type FamiliarityEntry, type FamiliarityIndex, type FamiliarityStatus } from "../src/familiarity/index.js";

// ---- projectFamiliarity: strip to {status,strength,kind}; withhold ignored AND exposed-not-studied ----
const mkEntry = (lexKey: string, status: FamiliarityStatus, strength: number, tags?: string[]): FamiliarityEntry => ({
  lexKey, kind: "word", display: lexKey, srs: null, status, strength, createdAt: new Date(0), lastSeenAt: new Date(0), tags,
});
const index: FamiliarityIndex = {
  zdravo: mkEntry("zdravo", "known", 0.9),
  pivo: mkEntry("pivo", "learning", 0.2),
  ignoreme: mkEntry("ignoreme", "ignored", 0),
  seenonly: mkEntry("seenonly", "learning", 0.1, [EXPOSED_TAG]), // met while reading, never studied
};
const proj = projectFamiliarity(index, "mk");
assert.equal(proj.packId, "mk");
assert.deepEqual(proj.entries.zdravo, { status: "known", strength: 0.9, kind: "word" });
assert.equal(proj.entries.ignoreme, undefined, "ignored items are withheld");
assert.equal(proj.entries.seenonly, undefined, "exposed-but-not-studied items are withheld (partner activities use studied only)");
assert.equal(Object.keys(proj.entries).length, 2);

// ---- complementaryDiff: only items BOTH partners have studied (one strong, one weak) ----
const mine: FamiliarityProjection = { packId: "mk", entries: {
  zdravo: { status: "known", strength: 0.9, kind: "word" }, // both know → nobody helps
  kafe: { status: "known", strength: 0.8, kind: "word" }, // I know, partner learning ⇒ I help
  pivo: { status: "learning", strength: 0.3, kind: "word" }, // I'm learning, partner knows ⇒ they help me
  smetka: { status: "learning", strength: 0.2, kind: "chunk" }, // I'm learning, partner knows ⇒ they help me
} };
const theirs: FamiliarityProjection = { packId: "mk", entries: {
  zdravo: { status: "known", strength: 0.7, kind: "word" },
  kafe: { status: "learning", strength: 0.2, kind: "word" },
  pivo: { status: "known", strength: 0.85, kind: "word" },
  smetka: { status: "known", strength: 0.95, kind: "chunk" },
  novzbor: { status: "known", strength: 0.9, kind: "word" }, // partner knows, I've NEVER studied ⇒ must NOT surface
} };
const diff = complementaryDiff(mine, theirs);
assert.deepEqual(diff.partnerCanHelpMe.map((i) => i.lexKey).sort(), ["pivo", "smetka"]);
assert.ok(!diff.partnerCanHelpMe.some((i) => i.lexKey === "novzbor"), "a word I've never studied is NOT surfaced as 'partner can help me'");
assert.equal(diff.partnerCanHelpMe[0]!.lexKey, "smetka", "biggest gap first (0.95-0.2 > 0.85-0.3)");
assert.equal(diff.partnerCanHelpMe.find((i) => i.lexKey === "smetka")!.kind, "chunk", "kind carried through");
assert.deepEqual(diff.iCanHelpPartner.map((i) => i.lexKey), ["kafe"], "I can teach what I know + they're still learning");
assert.equal(diff.iCanHelpPartner[0]!.partnerStrength, 0.2);

// "known but shaky" (strength below needThreshold) still needs help
const shaky = complementaryDiff(
  { packId: "mk", entries: { x: { status: "known", strength: 0.3, kind: "word" } } },
  { packId: "mk", entries: { x: { status: "known", strength: 0.9, kind: "word" } } },
  { needThreshold: 0.5 },
);
assert.equal(shaky.partnerCanHelpMe.length, 1, "a shaky 'known' item still gets help");

// limit caps each set (I'm learning all of them, partner knows all of them)
const mineBig: FamiliarityProjection = { packId: "mk", entries: {} };
const theirsBig: FamiliarityProjection = { packId: "mk", entries: {} };
for (let i = 0; i < 10; i++) { mineBig.entries["w" + i] = { status: "learning", strength: 0.2, kind: "word" }; theirsBig.entries["w" + i] = { status: "known", strength: 0.9, kind: "word" }; }
const capped = complementaryDiff(mineBig, theirsBig, { limit: 3 });
assert.equal(capped.partnerCanHelpMe.length, 3);

// ---- routeComplementary: only DUE items the partner is strong on ----
const routed = routeComplementary(["pivo", "zdravo", "smetka", "nothere"], diff);
assert.deepEqual(routed.map((r) => r.lexKey).sort(), ["pivo", "smetka"]);
assert.equal(routed[0]!.source, "partner-strong");
assert.equal(routed[0]!.lexKey, "smetka", "most-helpful first");

// ---- proposeTeachBacks: iCanHelpPartner → prompts for the teacher ----
const prompts = proposeTeachBacks(diff, "me", "partner");
assert.equal(prompts.length, 1);
assert.deepEqual(prompts[0], { lexKey: "kafe", teacher: "me", learner: "partner", reason: "partner-lapsed" });

console.log("✓ partner familiarity diff / complementary-srs / teachback: all assertions passed");
