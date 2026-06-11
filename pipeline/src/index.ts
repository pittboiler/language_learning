export * from "./profiler.js";
export * from "./architect.js";
export * from "./generator.js";
export * from "./validator.js";

/**
 * Orchestrates profiler → architect → generator → (validator deferred), then writes a cached
 * LanguagePack. This is the entry point you run offline to (re)build a pack.
 */
export async function buildPack(_languageCode: string): Promise<void> {
  throw new Error("not implemented: profiler → architect → generator → cache");
}
