// The Macedonian verb rule engine (batch 3, 2026-11-14). Every form of every verb in the bank is MADE here
// from a handful of rules, not stored, so "learn the pattern, not the verb" is literally how the pack works:
// a verb stores its dictionary form (the he/she present), whether it's ongoing or done, and only what no rule
// predicts (сум, знае → знам, the -о- past of дојде, the -л form дошол, the command дај).
//
// Sources (research 2026-11-14): Wikipedia (en/mk) "Macedonian grammar" and "Macedonian verbs", Wiktionary
// conjugation tables, Topolinjska 2012, Kramer & Mitkovska's textbook sequence. The rules:
//   Present: the group is the he/she form's last vowel (гледа а, носи и, јаде е). "I" is -ам for every verb
//     but сум; "they" is -аат for а-verbs, -ат otherwise. A stem ending in и/у/о adds ј before -ам / -ат
//     (пие → пијам, пијат; стои → стојам).
//   Future: ќе + the present (нема да + the present for "won't"); сум → ќе бидам.
//   Commands: a vowel stem takes -ј / -јте (гледај, пиј), a consonant stem -и / -ете (носи / носете, јади).
//   Past, ongoing (imperfect; ongoing verbs): а stays а, и and е become е; -в, -ше, -ше, -вме, -вте, -а
//     (гледав, носеше, јадеа); after a vowel stem "they" is -ја (пиеја).
//   Past, done (aorist; done verbs): -в, bare, bare, -вме, -вте, -а / -ја on a vowel stem (прочитав / прочита,
//     купив / купи / купија, седнав / седна; a few -и verbs keep е: свртев / сврте); a consonant stem takes -ов, -е, -е, -овме, -овте, -оа (дојдов /
//     дојде) and its "I" form has to be learnt.
//   Have done: сум / си / – / сме / сте / – + the -л form, made on the stem of the verb's own past.
import type { VerbEntry, VerbPerson, VerbTense } from "@ll/pack-schema";

export const PERSONS: VerbPerson[] = ["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"];
type Six = Record<VerbPerson, string>;
const six = (a: string[]): Six => Object.fromEntries(PERSONS.map((p, i) => [p, a[i]!])) as Six;

/** What a bank verb stores: its dictionary form, its aspect, and only the forms no rule predicts. */
export interface BankVerb {
  lemma: string;
  gloss: string;
  en?: { ing: string; past: string };
  aspect: "ongoing" | "done" | "both";
  partner?: string;
  impersonal?: boolean;
  note?: string;
  /** The whole present, when it isn't made by rule (сум). */
  present?: string[];
  /** Just the "I" form, when only that one isn't (знае → знам). */
  present1sg?: string;
  /** The ongoing past, when it isn't made by rule (сум → бев). */
  pastOngoing?: string[];
  /** The done past's "I" form, when its stem isn't the present's: -ов (дојдов) or -ав (напишав, разбрав). */
  pastDone1sg?: string;
  /** The done past's he/she form, when it isn't the -ов stem + е (реков → рече). */
  pastDone3sg?: string;
  /** The -л form, masculine and feminine, when it isn't the past stem + л (дошол / дошла). */
  lform?: [string, string];
  /** The command, one person and several (дај / дајте); null = none in use (може, треба). */
  command?: [string, string] | null;
  /** The future, when it isn't ќе + the present (сум → ќе бидам). */
  future?: string[];
  confidence?: VerbEntry["confidence"];
}

const VOWEL = /[аеиоу]$/;
/** The present group: the he/she form's last vowel. */
export const groupOf = (lemma: string): "a" | "i" | "e" => {
  const v = lemma.at(-1);
  if (v === "а") return "a";
  if (v === "и") return "i";
  if (v === "е") return "e";
  throw new Error(`${lemma}: a verb's dictionary form ends in а, и or е`);
};
const stemOf = (lemma: string) => lemma.slice(0, -1);

export function present(lemma: string): Six {
  const g = groupOf(lemma);
  const s = stemOf(lemma);
  if (g === "a") return six([s + "ам", s + "аш", s + "а", s + "аме", s + "ате", s + "аат"]);
  // пие → пијам, пијат; стои → стојам, стојат; живее → живеам (no ј after е).
  const j = /[иуо]$/.test(s) ? "ј" : "";
  const v = g === "i" ? "и" : "е";
  return six([s + j + "ам", s + v + "ш", s + v, s + v + "ме", s + v + "те", s + j + "ат"]);
}

/** The ongoing past (imperfect): а stays, и / е become е. */
export function pastOngoing(lemma: string): Six {
  const g = groupOf(lemma);
  const s = stemOf(lemma);
  const base = g === "a" ? s + "а" : s + "е";
  const they = g === "a" ? base + "а" : VOWEL.test(s) ? base + "ја" : base + "а";
  return six([base + "в", base + "ше", base + "ше", base + "вме", base + "вте", they]);
}

/** The done past's stem and shape, from the dictionary form or the learnt "I" form. */
export function pastDoneStem(v: Pick<BankVerb, "lemma" | "pastDone1sg" | "pastDone3sg">): { kind: "vowel" | "o"; base: string; he: string } {
  if (v.pastDone1sg) {
    if (v.pastDone1sg.endsWith("ов")) { const base = v.pastDone1sg.slice(0, -2); return { kind: "o", base, he: v.pastDone3sg ?? base + "е" }; }
    if (v.pastDone1sg.endsWith("в")) { const base = v.pastDone1sg.slice(0, -1); return { kind: "vowel", base, he: base }; }
    throw new Error(`${v.lemma}: a done past's "I" form ends in -в`);
  }
  const g = groupOf(v.lemma);
  const s = stemOf(v.lemma);
  if (g === "a" || g === "i") return { kind: "vowel", base: v.lemma, he: v.lemma }; // прочита-, купи-
  if (s.endsWith("н")) return { kind: "vowel", base: s + "а", he: s + "а" }; // седне → седна-
  if (/[иу]$/.test(s)) return { kind: "vowel", base: s, he: s }; // испие → испи-, чуе → чу-
  throw new Error(`${v.lemma}: an -е verb's done past needs its "I" form (pastDone1sg), e.g. дојдов`);
}

export function pastDone(v: Pick<BankVerb, "lemma" | "pastDone1sg" | "pastDone3sg">): Six {
  const { kind, base, he } = pastDoneStem(v);
  if (kind === "o") return six([base + "ов", he, he, base + "овме", base + "овте", base + "оа"]);
  // "they": -ја after и / у (купија, чуја), -а after а / е (прочитаа, свртеа).
  return six([base + "в", he, he, base + "вме", base + "вте", base + (/[иу]$/.test(base) ? "ја" : "а")]);
}

export function command(lemma: string): [string, string] {
  const g = groupOf(lemma);
  const s = stemOf(lemma);
  if (g === "a") return [lemma + "ј", lemma + "јте"]; // гледај, гледајте
  if (VOWEL.test(s)) return [s + "ј", s + "јте"]; // пиј, живеј, знај
  return [s + "и", s + "ете"]; // носи / носете, јади / јадете
}

/** The -л form: on the ongoing past's stem for ongoing verbs (гледал, носел), the done past's for done ones
 *  (купил, седнал). */
export function lform(v: BankVerb): { m: string; f: string; n: string; pl: string } {
  if (v.lform) { const [m, f] = v.lform; const st = f.slice(0, -1); return { m, f, n: st + "о", pl: st + "е" }; }
  let base: string;
  if (v.aspect === "done") {
    const st = pastDoneStem(v);
    if (st.kind === "o") throw new Error(`${v.lemma}: an -ов past's -л form isn't made by rule (дошол, рекол): give lform`);
    base = st.base;
  }
  else base = groupOf(v.lemma) === "a" ? stemOf(v.lemma) + "а" : stemOf(v.lemma) + "е";
  return { m: base + "л", f: base + "ла", n: base + "ло", pl: base + "ле" };
}

const HAVE = ["сум", "си", "", "сме", "сте", ""];

/** Every form, with the pattern each tense follows. Impersonal verbs keep only the he/she forms. */
export function conjugate(v: BankVerb): VerbEntry {
  const irregular = (stored: unknown) => (stored ? "irregular" : undefined);
  const g = v.lemma === "сум" ? undefined : groupOf(v.lemma);
  const pres = v.present ? six(v.present) : { ...present(v.lemma), ...(v.present1sg ? { "1sg": v.present1sg } : {}) };
  const forms: VerbEntry["forms"] = { present: pres };
  const patterns: VerbEntry["patterns"] = { present: v.present || v.present1sg ? "irregular" : `present-${g}` };

  forms.future = v.future ? six(v.future) : six(PERSONS.map((p) => `ќе ${pres[p]}`));
  patterns.future = irregular(v.future) ?? "future";

  if (v.aspect !== "done") {
    forms.pastOngoing = v.pastOngoing ? six(v.pastOngoing) : pastOngoing(v.lemma);
    patterns.pastOngoing = irregular(v.pastOngoing) ?? "past-ongoing";
  }
  if (v.aspect !== "ongoing") {
    forms.pastDone = pastDone(v);
    patterns.pastDone = pastDoneStem(v).kind === "o" ? "past-done-o" : "past-done";
  }
  const l = lform(v);
  forms.haveDone = six(PERSONS.map((p, i) => [HAVE[i], p.endsWith("pl") ? l.pl : l.m].filter(Boolean).join(" ")));
  patterns.haveDone = v.lform ? "irregular" : "have-done";

  if (v.command !== null) {
    const [sg, pl] = v.command ?? command(v.lemma);
    forms.command = { "2sg": sg, "2pl": pl };
    patterns.command = v.command ? "irregular" : VOWEL.test(sg) ? "command-i" : "command-j";
  }

  if (v.impersonal) for (const t of Object.keys(forms) as VerbTense[]) {
    const f = forms[t]!;
    forms[t] = Object.fromEntries(Object.entries(f).filter(([p]) => p === "3sg" || p === "3pl"));
  }
  if (v.impersonal) { delete forms.command; delete patterns.command; }

  return {
    lemma: v.lemma, gloss: v.gloss, aspect: v.aspect, patterns, forms, lform: l,
    ...(v.en ? { en: v.en } : {}), ...(v.partner ? { partner: v.partner } : {}), ...(v.impersonal ? { impersonal: true } : {}),
    ...(v.note ? { note: v.note } : {}), confidence: v.confidence ?? "unreviewed",
  };
}
