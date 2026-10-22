import type { ChunkNote } from "@ll/pack-schema";

// Hand-written notes on a word or a line, merged over the generated ones in course.ts (index.ts), so a
// re-run of the notes step can't lose them. Shown with the line's English (stories, lesson examples) and on
// the new-word card (vocab:<id>).
const ZDRAVO_BYE = "Здраво is “hi”, and between friends it's “bye” too (like “ciao”). Догледање is the goodbye for anyone.";

export const handNotes: ChunkNote[] = [
  // 2026-10-22, Jake: "why does the story have zdravo as bye when it's hello?" It's both; the course now says so.
  { source: "vocab:v-zdravo", text: "Здраво", pointIds: [], note: "Hi, and between friends also bye (like “ciao”). To anyone else: Добар ден to say hello, Догледање to say goodbye." },
  { source: "vocab:gen-s0-greet-v1", text: "Здраво", pointIds: [], note: "Hi, and between friends also bye (like “ciao”). To anyone else: Добар ден to say hello, Догледање to say goodbye." },
  { source: "story:gen-s0-greet-story-b#7", text: "Марко: „Здраво!“ Ана: „Догледање!“", pointIds: [], note: ZDRAVO_BYE },
  { source: "scenario:gen-s0-greet-convo-b#7", text: "Добро! Здраво, Ема! Здраво, Петар!", pointIds: [], note: ZDRAVO_BYE },
];
