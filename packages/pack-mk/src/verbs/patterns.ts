// The six verb patterns, in plain words (batch 3, 2026-11-14). Each says how the tense is made and when it's
// used; the Library's "Verb patterns" page shows them with the verbs you know that follow each, and the pattern
// drills practise them across verbs. The rules match engine.ts. Wording drafted for Jake's Macedonian reviewer.
import type { VerbPattern } from "@ll/pack-schema";

export const verbPatterns: VerbPattern[] = [
  {
    id: "present",
    tense: "present",
    title: "Now: the present",
    how: "Take the dictionary form (the he/she form), drop its last vowel and add the endings. That last vowel, а, и or е, tells you which set of endings the verb takes.",
    when: "What happens now or usually: Пијам кафе (I drink coffee). After ќе it’s the future, after да it’s “to”: Сакам да одам (I want to go).",
    pointId: "pt-verbs-a",
    variants: [
      { id: "present-a", label: "а-verbs", spot: "The he/she form ends in -а: сака, има, зборува.", endings: { "1sg": "-ам", "2sg": "-аш", "3sg": "-а", "1pl": "-аме", "2pl": "-ате", "3pl": "-аат" } },
      { id: "present-i", label: "и-verbs", spot: "The he/she form ends in -и: работи, оди, учи.", endings: { "1sg": "-ам", "2sg": "-иш", "3sg": "-и", "1pl": "-име", "2pl": "-ите", "3pl": "-ат" }, pointId: "pt-verbs-e-i" },
      { id: "present-e", label: "е-verbs", spot: "The he/she form ends in -е: јаде, пие, живее.", endings: { "1sg": "-ам", "2sg": "-еш", "3sg": "-е", "1pl": "-еме", "2pl": "-ете", "3pl": "-ат" }, pointId: "pt-verbs-e-i" },
    ],
    notes: [
      "“I” ends in -ам in all three, so you can’t tell the group from it. Listen for “you” instead: сакаш, работиш, јадеш.",
      "“They” is -аат for а-verbs (сакаат) and -ат for the others (работат, јадат).",
      "When the stem ends in и, у or о, “I” and “they” add ј: пие → пијам, пијат.",
      "Two to learn on their own: сум (сум, си, е, сме, сте, се) and знае, whose “I” is just знам.",
    ],
  },
  {
    id: "future",
    tense: "future",
    title: "Later: the future",
    how: "Put ќе in front of the present form you already know. Nothing else changes. For “won’t”, use нема да in front instead.",
    when: "What will happen: Ќе одам утре (I’ll go tomorrow); Нема да одам (I won’t go).",
    pointId: "pt-future",
    variants: [
      { id: "future", label: "every verb", spot: "Any verb: ќе + its present.", endings: { "1sg": "ќе + -ам", "2sg": "ќе + -аш / -иш / -еш", "3sg": "ќе + -а / -и / -е", "1pl": "ќе + -аме / -име / -еме", "2pl": "ќе + -ате / -ите / -ете", "3pl": "ќе + -аат / -ат" } },
    ],
    notes: [
      "сум is the one exception: ќе бидам, ќе бидеш, ќе биде, ќе бидеме, ќе бидете, ќе бидат.",
      "Words like ги, се or ми come after ќе: Ќе ги земам (I’ll take them).",
    ],
  },
  {
    id: "command",
    tense: "command",
    title: "Telling someone: commands",
    how: "Take the dictionary form. An а-verb keeps its а and adds -ј. For the others, drop the last vowel: if what’s left ends in a vowel, add -ј; if it ends in a consonant, add -и. For several people, or to be polite, the endings are -јте and -ете.",
    when: "Asking or telling someone to do something: Свртете лево (Turn left), Повелете (Here you go).",
    pointId: "pt-commands",
    variants: [
      { id: "command-j", label: "vowel before the ending", spot: "Every а-verb, and stems ending in a vowel: гледа → гледај, пие → пиј.", endings: { "2sg": "-ј", "2pl": "-јте" } },
      { id: "command-i", label: "consonant before the ending", spot: "A stem ending in a consonant: носи → носи, јаде → јади, сврти → свртете.", endings: { "2sg": "-и", "2pl": "-ете" } },
    ],
    notes: [
      "Two to learn on their own: дај / дајте (give) and биди / бидете (be).",
      "“Don’t” isn’t a special form: немој да + the present. Немој да одиш! (Don’t go!)",
    ],
  },
  {
    id: "past-ongoing",
    tense: "pastOngoing",
    title: "The past, ongoing: was doing, used to",
    how: "One rule for every ongoing verb: keep the stem, а stays а and и or е become е, then add -в, -ше, -ше, -вме, -вте, -а.",
    when: "Something that went on, a habit, or a state: Бев дома (I was at home), Имав многу работа (I had a lot of work), Јадев сендвич (I was eating a sandwich).",
    pointId: "pt-past",
    variants: [
      { id: "past-ongoing", label: "every ongoing verb", spot: "сака → сакав, носи → носев, јаде → јадев.", endings: { "1sg": "-в", "2sg": "-ше", "3sg": "-ше", "1pl": "-вме", "2pl": "-вте", "3pl": "-а" } },
    ],
    notes: [
      "“You” and “he/she” share one form (беше, имаше): the rest of the sentence says who.",
      "After a vowel, “they” is -ја: пиеја.",
      "сум: бев, беше, беше, бевме, бевте, беа.",
      "An ongoing verb’s past is always this one: гледаше (he was watching), never a bare гледа.",
    ],
  },
  {
    id: "past-done",
    tense: "pastDone",
    title: "The past, done: did it, once",
    how: "Most verbs come in pairs: an ongoing one (купува, buy) and a done one (купи, buy once). The done verb has its own past: -в for “I”, the bare stem for “you” and “he/she”, then -вме, -вте and -а (or -ја).",
    when: "One finished event: Купив леб (I bought bread), Отидов во кафуле (I went to a café). For something that went on, use the ongoing verb’s past instead.",
    pointId: "pt-past",
    variants: [
      { id: "past-done", label: "vowel stems", spot: "купи → купив, купи; прочита → прочитав, прочита; седне → седнав, седна.", endings: { "1sg": "-в", "2sg": "the stem", "3sg": "the stem", "1pl": "-вме", "2pl": "-вте", "3pl": "-а / -ја" } },
      { id: "past-done-o", label: "-ов verbs", spot: "Learn the “I” form and the rest follows: дојдов, отидов, зедов, дадов, реков.", endings: { "1sg": "-ов", "2sg": "-е", "3sg": "-е", "1pl": "-овме", "2pl": "-овте", "3pl": "-оа" } },
    ],
    notes: [
      "Which past? Ask whether it was going on (јадев, I was eating) or done and finished (изедов, I ate it up).",
      "The two halves of a pair often look alike: купува / купи, чита / прочита, пие / испие. A few don’t: оди / отиде, доаѓа / дојде, вели / рече, дава / даде.",
    ],
  },
  {
    id: "have-done",
    tense: "haveDone",
    title: "Have done: experiences and hearsay",
    how: "сум, си, сме or сте + the verb’s -л form; for he, she and they, just the -л form. The -л form agrees with who: -л for a man, -ла for a woman, -ле for several.",
    when: "Things you’ve done in your life (Сум бил во Скопје, I’ve been to Skopje) and things you heard about but didn’t see (Тој видел сѐ).",
    pointId: "pt-perfect",
    variants: [
      { id: "have-done", label: "every verb", spot: "The -л form comes from the verb’s own past: гледав → гледал, купив → купил.", endings: { "1sg": "сум -л / -ла", "2sg": "си -л / -ла", "3sg": "-л / -ла", "1pl": "сме -ле", "2pl": "сте -ле", "3pl": "-ле" } },
    ],
    notes: [
      "A few -л forms are short or change: бил (сум), дошол (дојде), отишол (отиде), рекол (рече), зел (земе), дал (даде).",
      "The same -л form makes “would”: Би сакал / Би сакала (I’d like).",
    ],
  },
];
