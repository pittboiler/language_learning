// Hand corrections to the course's verb points (batch 3, 2026-11-14), laid over the generated blueprint
// (course.ts is machine-written; its points are kept as signed off, so changes go here, like story-fixes.ts).
// Each fix replaces only the fields it names; `library` fields merge one by one. They follow the verb research
// (Wikipedia en/mk, Wiktionary, Topolinjska 2012, Kramer & Mitkovska) and the Library's Verb patterns page,
// and wait for Jake's Macedonian reviewer like any changed text: `reviewed: false`.
import type { GrammarPoint } from "@ll/pack-schema";

type LibraryFix = Partial<NonNullable<GrammarPoint["library"]>>;
export type PointFix = Partial<Pick<GrammarPoint, "rule" | "recap">> & { library?: LibraryFix; reviewed: boolean };

export const pointFixes: Record<string, PointFix> = {
  // The groups were "told apart by the vowel in the middle"; for the pattern approach the useful fact is where to
  // look: the he/she (dictionary) form shows the group, the "I" form never does.
  "pt-verbs-e-i": {
    reviewed: false,
    rule: "Macedonian has three verb families: -а, -е and -и. You can tell a verb's family from its he/she form: сака, јаде, учи. The “I” form always ends in -ам: Учам македонски (“I'm learning Macedonian”). For “you” (ти), -е verbs end in -еш and -и verbs in -иш: Што работиш?",
  },
  // "Verbs in -а and -е add -ј … verbs in -и and those ending in a consonant add -и (дојди!, земи!)" contradicted
  // itself: дојде and земе are -е verbs. The rule is the stem: vowel → -ј, consonant → -и.
  "pt-commands": {
    reviewed: false,
    library: {
      rule: "A command (the imperative) is made from the verb by swapping its ending. An -а verb keeps its а and adds -ј for one person (гледај!, слушај!). For -е and -и verbs, drop the last vowel: if what's left ends in a vowel, add -ј (пие → пиј!); if it ends in a consonant, add -и (дојде → дојди!, земе → земи!). To address a group, or to be polite to a single stranger, the endings are -јте and -ете: гледајте!, дојдете!, and for these chapter verbs Свртете, Одете, Кажете, plus the everyday Извинете and Повелете. Two to learn on their own: дај! (give) and биди! (be). For a negative command — telling someone NOT to do something — you don't change the verb into a special “don't” shape; instead you put немој да in front of an ordinary verb: Немој да одиш!",
      mistakes: [
        "Not using plain не for “don't”: не negates a statement, but a command NOT to do something needs немој да, as in Немој да одиш!",
        "Not „Сврти“ to a stranger asking directions, but „Свртете“ — the bare form is for a friend; add -те to be polite.",
        "Not keeping the whole verb in a command, but trimming it: гледа → гледај!, пие → пиј!, јаде → јади!, so listen for the short ending.",
      ],
    },
  },
  // Said "the finished kind is usually the short stem (отиде, гледа)": гледа as "he watched" is dialectal; the
  // standard is гледаше. The two pasts split by the verb (ongoing or done), not by the ending alone.
  "pt-past": {
    reviewed: false,
    rule: "To talk about the past, the verb changes its ending, and “I” always ends in -в: бев (I was), имав (I had), отидов (I went). There are two kinds: something that went on, like бев or јадев (I was eating), and one finished event, like отидов. “You” and “he/she” share one form (беше, имаше, отиде), so context tells you who.",
    library: {
      rule: "Macedonian has two simple pasts, and the verb you use decides which. For something that went on, a habit or a state, an ongoing verb takes the ongoing past (the imperfect). One rule makes it for every such verb: а stays а, и or е become е, then -в, -ше, -ше, -вме, -вте, -а: бев, имав, јадев, гледав / гледаше. For one finished event, a “done” verb (the finished half of a pair; see the next lesson) takes the done past (the aorist): -в, the bare stem, -вме, -вте, -а (купив, купи), or for a few common verbs -ов, -е (отидов, отиде; дојдов, дојде). In both, “I” ends in -в, and “you” and “he/she” share one form. An ongoing verb never takes the bare stem: “he watched” is гледаше. Library → Verb patterns shows both pasts with every verb you know.",
      mistakes: [
        "Not the present ending for something that's over, but a past one: гледав (I watched, I was watching), not гледам.",
        "Not adding anything to tell “you” from “he/she”: one form serves both (беше, отиде), and the rest of the sentence makes it clear.",
        "Not „тој гледа“ for “he watched”, but „тој гледаше“: an ongoing verb's past always has the -ше.",
      ],
    },
  },
  // Pairs are how the two pasts are chosen: say which pairs look alike, which don't, and that each half keeps
  // to its own past.
  "pt-aspect": {
    reviewed: false,
    library: {
      rule: "Macedonian verbs usually come in two-member pairs (verb aspect: imperfective / perfective). One member describes an action as ongoing, repeated or habitual; the other presents it as a single, completed whole. English leans on extra words and tense to show this (“was reading” vs “read it all”), but Macedonian has two related verbs instead, such as пие / испие for “drink”. Most pairs look alike (купува / купи, чита / прочита, пие / испие); a few don't (оди / отиде, доаѓа / дојде, вели / рече). In the past each half keeps to its own kind: the ongoing verb gives пиев (I was drinking), the done one испив (I drank it up). At this stage you only need to recognise that both exist and roughly what each signals; Library → Verb patterns lists every verb with its pair.",
    },
  },
};

/** The points with their fixes applied. */
export function withPointFixes<P extends GrammarPoint>(points: P[]): P[] {
  return points.map((p) => {
    const fix = pointFixes[p.id];
    if (!fix) return p;
    const { library, reviewed, ...top } = fix;
    void reviewed;
    return { ...p, ...top, ...(library && p.library ? { library: { ...p.library, ...library } } : {}) };
  });
}
