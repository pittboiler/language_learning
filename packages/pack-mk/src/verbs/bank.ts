// The verb bank (batch 3, 2026-11-14): every verb the course uses, in aspect pairs where it has one. A verb
// stores its dictionary form (the he/she present) and its aspect; engine.ts makes every form. Only what no
// rule predicts is written here: сум, знае's short "I" (знам), the -ов past of the -е verbs (дојдов, реков,
// зедов, дадов, отидов, изедов, видов), the odd -л forms (дошол, отишол, рекол, зел, дал, изел) and дај.
// Forms are checked against Wiktionary (verbs.test.ts); a native review flips `confidence` to "validated".
import type { BankVerb } from "./engine.js";

const en = (ing: string, past: string) => ({ ing, past });

export const bank: BankVerb[] = [
  // ---- learnt on their own ----
  {
    lemma: "сум", gloss: "be", en: en("being", "was"), aspect: "ongoing",
    present: ["сум", "си", "е", "сме", "сте", "се"],
    pastOngoing: ["бев", "беше", "беше", "бевме", "бевте", "беа"],
    future: ["ќе бидам", "ќе бидеш", "ќе биде", "ќе бидеме", "ќе бидете", "ќе бидат"],
    command: ["биди", "бидете"], lform: ["бил", "била"],
    note: "Learnt on its own: no pattern makes сум, бев or ќе бидам.", confidence: "validated",
  },
  { lemma: "знае", gloss: "know", en: en("knowing", "knew"), aspect: "ongoing", present1sg: "знам", note: "The “I” form is short: знам, not знаам." },

  // ---- ongoing only (no everyday "done" partner) ----
  { lemma: "има", gloss: "have", en: en("having", "had"), aspect: "ongoing" },
  { lemma: "нема", gloss: "not have; there isn’t", en: en("not having", "didn’t have"), aspect: "ongoing", command: null },
  { lemma: "сака", gloss: "want, like", en: en("wanting", "wanted"), aspect: "ongoing" },
  { lemma: "може", gloss: "can, be able to", en: en("being able to", "could"), aspect: "ongoing", command: null },
  { lemma: "работи", gloss: "work", en: en("working", "worked"), aspect: "ongoing" },
  { lemma: "зборува", gloss: "speak", en: en("speaking", "spoke"), aspect: "ongoing" },
  { lemma: "живее", gloss: "live", en: en("living", "lived"), aspect: "ongoing" },
  { lemma: "спие", gloss: "sleep", en: en("sleeping", "slept"), aspect: "ongoing" },
  { lemma: "мисли", gloss: "think", en: en("thinking", "thought"), aspect: "ongoing" },
  { lemma: "гледа", gloss: "watch, look at", en: en("watching", "watched"), aspect: "ongoing" },
  { lemma: "слуша", gloss: "listen", en: en("listening", "listened"), aspect: "ongoing" },
  { lemma: "бара", gloss: "look for, ask for", en: en("looking for", "looked for"), aspect: "ongoing" },
  { lemma: "игра", gloss: "play", en: en("playing", "played"), aspect: "ongoing" },
  { lemma: "согласува", gloss: "agree (се согласува)", en: en("agreeing", "agreed"), aspect: "ongoing" },

  // ---- both pasts from one verb ----
  { lemma: "види", gloss: "see", en: en("seeing", "saw"), aspect: "both", pastDone1sg: "видов", note: "Both pasts: видев (was seeing) and видов (saw, once)." },

  // ---- aspect pairs: ongoing ↔ done ----
  { lemma: "разбира", gloss: "understand", en: en("understanding", "understood"), aspect: "ongoing", partner: "разбере" },
  { lemma: "разбере", gloss: "understand (get it)", en: en("understanding", "understood"), aspect: "done", partner: "разбира", pastDone1sg: "разбрав" },
  { lemma: "учи", gloss: "learn, study", en: en("learning", "learnt"), aspect: "ongoing", partner: "научи" },
  { lemma: "научи", gloss: "learn (master)", en: en("learning", "learnt"), aspect: "done", partner: "учи" },
  { lemma: "јаде", gloss: "eat", en: en("eating", "ate"), aspect: "ongoing", partner: "изеде" },
  { lemma: "изеде", gloss: "eat up", en: en("eating", "ate up"), aspect: "done", partner: "јаде", pastDone1sg: "изедов", lform: ["изел", "изела"] },
  { lemma: "пие", gloss: "drink", en: en("drinking", "drank"), aspect: "ongoing", partner: "испие" },
  { lemma: "испие", gloss: "drink up", en: en("drinking", "drank up"), aspect: "done", partner: "пие" },
  { lemma: "оди", gloss: "go", en: en("going", "went"), aspect: "ongoing", partner: "отиде" },
  { lemma: "отиде", gloss: "go (and get there)", en: en("going", "went"), aspect: "done", partner: "оди", pastDone1sg: "отидов", lform: ["отишол", "отишла"] },
  { lemma: "доаѓа", gloss: "come", en: en("coming", "came"), aspect: "ongoing", partner: "дојде" },
  { lemma: "дојде", gloss: "come (and arrive)", en: en("coming", "came"), aspect: "done", partner: "доаѓа", pastDone1sg: "дојдов", lform: ["дошол", "дошла"] },
  { lemma: "дава", gloss: "give", en: en("giving", "gave"), aspect: "ongoing", partner: "даде" },
  { lemma: "даде", gloss: "give (once)", en: en("giving", "gave"), aspect: "done", partner: "дава", pastDone1sg: "дадов", lform: ["дал", "дала"], command: ["дај", "дајте"] },
  { lemma: "зема", gloss: "take", en: en("taking", "took"), aspect: "ongoing", partner: "земе" },
  { lemma: "земе", gloss: "take (once)", en: en("taking", "took"), aspect: "done", partner: "зема", pastDone1sg: "зедов", lform: ["зел", "зела"] },
  { lemma: "вели", gloss: "say", en: en("saying", "said"), aspect: "ongoing", partner: "рече" },
  { lemma: "рече", gloss: "say (once)", en: en("saying", "said"), aspect: "done", partner: "вели", pastDone1sg: "реков", pastDone3sg: "рече", lform: ["рекол", "рекла"], command: null },
  { lemma: "кажува", gloss: "tell, say", en: en("telling", "told"), aspect: "ongoing", partner: "каже" },
  { lemma: "каже", gloss: "tell, say (once)", en: en("telling", "told"), aspect: "done", partner: "кажува", pastDone1sg: "кажав" },
  { lemma: "купува", gloss: "buy", en: en("buying", "bought"), aspect: "ongoing", partner: "купи" },
  { lemma: "купи", gloss: "buy (once)", en: en("buying", "bought"), aspect: "done", partner: "купува" },
  { lemma: "плаќа", gloss: "pay", en: en("paying", "paid"), aspect: "ongoing", partner: "плати" },
  { lemma: "плати", gloss: "pay (once)", en: en("paying", "paid"), aspect: "done", partner: "плаќа" },
  { lemma: "прашува", gloss: "ask", en: en("asking", "asked"), aspect: "ongoing", partner: "праша" },
  { lemma: "праша", gloss: "ask (once)", en: en("asking", "asked"), aspect: "done", partner: "прашува" },
  { lemma: "чита", gloss: "read", en: en("reading", "read"), aspect: "ongoing", partner: "прочита" },
  { lemma: "прочита", gloss: "read (through)", en: en("reading", "read"), aspect: "done", partner: "чита" },
  { lemma: "пишува", gloss: "write", en: en("writing", "wrote"), aspect: "ongoing", partner: "напише" },
  { lemma: "напише", gloss: "write (once)", en: en("writing", "wrote"), aspect: "done", partner: "пишува", pastDone1sg: "напишав" },
  { lemma: "прави", gloss: "do, make", en: en("doing", "did"), aspect: "ongoing", partner: "направи" },
  { lemma: "направи", gloss: "do, make (once)", en: en("doing", "did"), aspect: "done", partner: "прави" },
  { lemma: "вика", gloss: "call (се вика: be called)", en: en("calling", "called"), aspect: "ongoing", partner: "повика" },
  { lemma: "повика", gloss: "call (once)", en: en("calling", "called"), aspect: "done", partner: "вика" },
  { lemma: "остава", gloss: "leave", en: en("leaving", "left"), aspect: "ongoing", partner: "остави" },
  { lemma: "остави", gloss: "leave (once)", en: en("leaving", "left"), aspect: "done", partner: "остава" },
  { lemma: "враќа", gloss: "return, give back", en: en("returning", "returned"), aspect: "ongoing", partner: "врати" },
  { lemma: "врати", gloss: "return (once)", en: en("returning", "returned"), aspect: "done", partner: "враќа" },
  { lemma: "свртува", gloss: "turn", en: en("turning", "turned"), aspect: "ongoing", partner: "сврти" },
  { lemma: "сврти", gloss: "turn (once)", en: en("turning", "turned"), aspect: "done", partner: "свртува", pastDone1sg: "свртев", note: "Its past keeps е: свртев, сврте (not свртив)." },
  { lemma: "помага", gloss: "help", en: en("helping", "helped"), aspect: "ongoing", partner: "помогне" },
  { lemma: "помогне", gloss: "help (once)", en: en("helping", "helped"), aspect: "done", partner: "помага" },
  { lemma: "повторува", gloss: "repeat", en: en("repeating", "repeated"), aspect: "ongoing", partner: "повтори" },
  { lemma: "повтори", gloss: "repeat (once)", en: en("repeating", "repeated"), aspect: "done", partner: "повторува" },
  { lemma: "седне", gloss: "sit down", en: en("sitting down", "sat down"), aspect: "done" },

  // ---- one form only (never drilled across persons) ----
  { lemma: "треба", gloss: "need, should (ми треба, треба да)", aspect: "ongoing", impersonal: true },
  { lemma: "допаѓа", gloss: "please (ми се допаѓа: I like it)", aspect: "ongoing", impersonal: true },
  { lemma: "чини", gloss: "cost", aspect: "ongoing", impersonal: true },
  { lemma: "боли", gloss: "hurt (ме боли: it hurts me)", aspect: "ongoing", impersonal: true },
  { lemma: "значи", gloss: "mean", aspect: "ongoing", impersonal: true },
];
