// @ll/core — language-agnostic engines. NO hardcoded language data lives anywhere under src/.
export * as llm from "./llm/index.js";
export * as srs from "./srs/index.js";
export * as familiarity from "./familiarity/index.js";
export * as familiarityScoring from "./familiarity/scoring.js";
export * as scenario from "./scenario/index.js";
export * as session from "./session/index.js";
export * as speaking from "./speaking/index.js";
export * as tutor from "./tutor/index.js";
export * as writing from "./writing/index.js";
export * as leveling from "./leveling/index.js";
// --- partnered learning (additive; see DESIGN-partnered-learning.md) ---
export * as partner from "./partner/index.js";
export * as partnerDiff from "./partner/familiarity-diff.js";
export * as complementarySrs from "./partner/complementary-srs.js";
export * as roleswap from "./roleswap/index.js";
export * as teachback from "./teachback/index.js";
export * as infogap from "./infogap/index.js";
export * as live from "./live/index.js";
