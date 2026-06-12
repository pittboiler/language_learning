// Side-effect import: load the provider keys from apps/web/.env.local into process.env so the
// offline pipeline runners (profiler / generator / validator batches) can reach Anthropic without
// the key being passed inline. Import this FIRST, before anything that constructs the LLM client.
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
config({ path: join(ROOT, "apps", "web", ".env.local") });
