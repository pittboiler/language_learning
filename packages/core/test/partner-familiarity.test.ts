// Runnable check for the Phase-2 cross-partner familiarity engine. Run with:
//   npx tsx packages/core/test/partner-familiarity.test.ts
import assert from "node:assert/strict";
import { projectFamiliarity, complementaryDiff, type FamiliarityProjection } from "../src/partner/familiarity-diff.js";
import { routeComplementary } from "../src/partner/complementary-srs.js";
import { proposeTeachBacks } from "../src/teachback/index.js";
import type { FamiliarityEntry, FamiliarityIndex, FamiliarityStatus } from "../src/familiarity/index.js";

// ---- projectFamiliarity: strip to {status,strength}, withhold ignored ----
const mkEntry = (lexKey: string, status: FamiliarityStatus, strength: number): FamiliarityEntry => ({
  lexKey, kind: "word", display: lexKey, srs: null, status, strength, createdAt: new Date(0), lastSeenAt: new Date(0),
});
const index: FamiliarityIndex = {
  zdravo: mkEntry("zdravo", "known", 0.9),
  pivo: mkEntry("pivo", "learning", 0.2),
  ignoreme: mkEntry("ignoreme", "ignored", 0),
};
const proj = projectFamiliarity(index, "mk");
assert.equal(proj.packId, "mk");
assert.deepEqual(proj.entries.zdravo, { status: "known", strength: 0.9 });
assert.equal(proj.entries.ignoreme, undefined, "ignored items are withheld");
assert.equal(Object.keys(proj.entries).length, 2);

// ---- complementaryDiff ----
const mine: FamiliarityProjection = { packId: "mk", entries: {
  zdravo: { status: "known", strength: 0.9 }, // I know it
  kafe: { status: "known", strength: 0.8 }, // I know; partner doesn't track
  pivo: { status: "learning", strength: 0.2 }, // I'm still learning
} };
const theirs: FamiliarityProjection = { packId: "mk", entries: {
  zdravo: { status: "known", strength: 0.7 }, // both know
  pivo: { status: "known", strength: 0.85 }, // partner knows, I'm learning ⇒ they help me
  smetka: { status: "known", strength: 0.95 }, // partner knows, I don't track ⇒ they help me
} };
const diff = complementaryDiff(mine, theirs);
assert.deepEqual(diff.partnerCanHelpMe.map((i) => i.lexKey).sort(), ["pivo", "smetka"]);
assert.equal(diff.partnerCanHelpMe[0]!.lexKey, "smetka", "biggest gap first (0.95-0 > 0.85-0.2)");
const smetka = diff.partnerCanHelpMe.find((i) => i.lexKey === "smetka")!;
assert.equal(smetka.mineStatus, "untracked");
assert.equal(smetka.partnerStrength, 0.95);
assert.deepEqual(diff.iCanHelpPartner.map((i) => i.lexKey), ["kafe"], "I can teach what I know + they don't");
assert.equal(diff.iCanHelpPartner[0]!.partnerStrength, 0);

// "known but shaky" (strength below needThreshold) still needs help
const shaky = complementaryDiff(
  { packId: "mk", entries: { x: { status: "known", strength: 0.3 } } },
  { packId: "mk", entries: { x: { status: "known", strength: 0.9 } } },
  { needThreshold: 0.5 },
);
assert.equal(shaky.partnerCanHelpMe.length, 1, "a shaky 'known' item still gets help");

// limit caps each set
const big: FamiliarityProjection = { packId: "mk", entries: {} };
for (let i = 0; i < 10; i++) big.entries["w" + i] = { status: "known", strength: 0.9 };
const capped = complementaryDiff({ packId: "mk", entries: {} }, big, { limit: 3 });
assert.equal(capped.partnerCanHelpMe.length, 3);

// ---- routeComplementary: only due items the partner is strong on ----
const routed = routeComplementary(["pivo", "zdravo", "smetka", "nothere"], diff);
assert.deepEqual(routed.map((r) => r.lexKey).sort(), ["pivo", "smetka"]);
assert.equal(routed[0]!.source, "partner-strong");
assert.equal(routed[0]!.lexKey, "smetka", "most-helpful first");

// ---- proposeTeachBacks: iCanHelpPartner → prompts for the teacher ----
const prompts = proposeTeachBacks(diff, "me", "partner");
assert.equal(prompts.length, 1);
assert.deepEqual(prompts[0], { lexKey: "kafe", teacher: "me", learner: "partner", reason: "partner-new" });

console.log("✓ partner familiarity diff / complementary-srs / teachback: all assertions passed");
