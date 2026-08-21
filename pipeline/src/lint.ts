import type { GrammarConcept, LanguagePack } from "@ll/pack-schema";

// Language-agnostic STRUCTURAL lint for grammar drills. The line-level Validator checks whether the
// answer text is correct, natural Bulgarian/etc. — but it never sees the option SET, so it can't
// catch a malformed multiple-choice (duplicate distractors, an answer missing from its own options,
// or too few options). This pure structural check fills that gap with no LLM call. Run it in the
// batch (every generation) and standalone over any committed pack.

export type DrillLintKind = "duplicate-options" | "answer-not-in-options" | "too-few-options";

export interface DrillLintIssue {
  conceptId: string;
  drillId: string;
  kind: DrillLintKind;
  detail: string;
}

// --- Transliteration homoglyph lint -------------------------------------------------------------
// The LLM romanizer occasionally keeps a source-script glyph inside an otherwise-Latin translit — e.g.
// Cyrillic "ѐ" (U+0450) pasted into "Sѐ ušte…" where Latin "è" was meant. It renders as a normal-looking
// Latin letter, so it's invisible to review but wrong (and it breaks any text->romanization matching).
// A translit / answerTranslit / targetPhrase.translit value must contain NO Cyrillic (U+0400–U+04FF).

export interface TranslitLintIssue {
  location: string; // e.g. "story gen-s0-repair-story body[3].translit"
  value: string; // the offending string
  cyrillic: string[]; // the specific out-of-place Cyrillic character(s)
}

const CYRILLIC = /[\u0400-\u04FF]/;
const cyrillicChars = (s: string): string[] => [...new Set([...s].filter((ch) => CYRILLIC.test(ch)))];

/** Every translit-bearing field in a pack whose value smuggles in a Cyrillic homoglyph (empty ⇒ clean). */
export function lintTranslit(pack: LanguagePack): TranslitLintIssue[] {
  const issues: TranslitLintIssue[] = [];
  const check = (value: string | undefined, location: string) => {
    if (!value) return;
    const bad = cyrillicChars(value);
    if (bad.length) issues.push({ location, value, cyrillic: bad });
  };
  pack.vocab.forEach((v) => check(v.translit, `vocab ${v.id}.translit`));
  pack.srsSeed.forEach((v) => check(v.translit, `srsSeed ${v.id}.translit`));
  pack.scenarios.forEach((s) => s.script.forEach((t, i) => check(t.translit, `scenario ${s.id} script[${i}].translit`)));
  pack.readers.forEach((r) => r.body.forEach((t, i) => check(t.translit, `reader ${r.id} body[${i}].translit`)));
  (pack.stories ?? []).forEach((st) => {
    st.body.forEach((seg, i) => check(seg.translit, `story ${st.id} body[${i}].translit`));
    st.qa.forEach((q) => check(q.answerTranslit, `story ${st.id} qa ${q.id}.answerTranslit`));
  });
  (pack.infoGapTasks ?? []).forEach((task) => {
    for (const role of [task.roleA, task.roleB]) {
      role.targetPhrases.forEach((p, i) => check(p.translit, `infogap ${task.id} role${role.role} targetPhrases[${i}].translit`));
    }
  });
  return issues;
}

// --- Vocabulary-consistency lint ----------------------------------------------------------------
// A pack should teach ONE word per everyday concept. A beginner who learned учител and then meets
// наставник in a scenario reads it as a mistake, not as vocabulary range — and the same for доктор vs
// лекар. Synonymy can't be inferred, so the choices are DECLARED (see run-lint.ts); this only enforces
// one once it's been made, across every string the pack serves (target text AND translit).
export interface SynonymGroup {
  concept: string; // what the word means, for the report ("teacher")
  preferred: string; // the form the pack teaches
  avoid: string[]; // competing stems — Cyrillic and/or Latin (translit)
}

export interface SynonymLintIssue {
  location: string; // dotted path into the pack, e.g. "scenarios[7].script[9].text"
  concept: string;
  found: string;
  preferred: string;
  value: string;
}

// Stem + at most 2 more letters, so inflections count (наставникот, учители) but a different word that
// merely starts the same does not (лекарство "medicine" is stem+4, and stays clean).
const stemRe = (stem: string) => new RegExp(`(?<!\\p{L})${stem}\\p{L}{0,2}(?!\\p{L})`, "iu");

/** Every served string using a competing synonym instead of the pack's chosen word (empty ⇒ consistent). */
export function lintSynonyms(pack: LanguagePack, groups: SynonymGroup[]): SynonymLintIssue[] {
  const issues: SynonymLintIssue[] = [];
  const walk = (node: unknown, path: string) => {
    if (typeof node === "string") {
      for (const g of groups) {
        for (const stem of g.avoid) {
          const hit = node.match(stemRe(stem));
          if (hit) issues.push({ location: path, concept: g.concept, found: hit[0], preferred: g.preferred, value: node });
        }
      }
      return;
    }
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`));
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(pack, "");
  return issues;
}

/** Structural issues across a pack's grammar drills (empty array ⇒ all drills are well-formed). */
export function lintDrills(concepts: GrammarConcept[]): DrillLintIssue[] {
  const issues: DrillLintIssue[] = [];
  for (const c of concepts) {
    for (const d of c.drills) {
      const opts = d.options ?? [];
      if (opts.length < 2) {
        issues.push({ conceptId: c.id, drillId: d.id, kind: "too-few-options", detail: `${opts.length} option(s) — a multiple-choice drill needs ≥2` });
      }
      const dupes = [...new Set(opts.filter((o, i) => opts.indexOf(o) !== i))];
      if (dupes.length) {
        issues.push({ conceptId: c.id, drillId: d.id, kind: "duplicate-options", detail: `duplicate option(s): ${dupes.map((o) => `"${o}"`).join(", ")}` });
      }
      if (opts.length > 0 && !opts.includes(d.answer)) {
        issues.push({ conceptId: c.id, drillId: d.id, kind: "answer-not-in-options", detail: `answer "${d.answer}" is not among the options` });
      }
    }
  }
  return issues;
}
