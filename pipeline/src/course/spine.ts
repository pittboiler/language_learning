// The Macedonian grammar spine — HAND-AUTHORED course design (DESIGN-course-spine.md §3), the input that
// run-course.ts turns into the served blueprint (packages/pack-mk/src/course.ts). Order is cross-checked
// against Kramer & Mitkovska, "Macedonian: A Course for Beginning and Intermediate Students" (3rd ed.).
//
// `scope` is for the generator only: it tells the line tagger and the point writer exactly what the point
// covers, so a line is tagged with a point only when it really uses it. `words` are point-critical words
// (matched to pack vocab by answer) that must be taught in the point's own session.

export interface SpinePoint {
  id: string;
  title: string;
  grammarIds: string[];
  depth: "produce" | "recognize";
  heavy?: boolean;
  scope: string;
  words?: string[];
  /** Lesson lines (sources) accepted even though they use a later point, because the pack has no cleaner
   *  line for this point and the line's English spells the extra bit out. Keep it rare: the session lint
   *  reports these as notes instead of errors. */
  acceptLater?: Record<string, string>;
}

export interface SpineChapter {
  chapterId: string;
  points: SpinePoint[];
  /** Script chapter (letters & sounds): its teaching sessions, one group of letters each. */
  letterSessions?: { title: string; glyphs: string[]; note?: string }[];
  /** Hand-tuned extra practice sessions for a cumbersome chapter (beyond what the formula gives). */
  extraSessions?: number;
  /** Words the chapter currently carries that should NOT be taught in it (moved to the Library). */
  dropWords?: string[];
}

export const SPINE: SpineChapter[] = [
  {
    // Chapter 0 (2026-10-08, Jake): the writing system first, grouped so each step builds on the last —
    // what you can already read, then the look-alikes that fool you, then new shapes, then the letters
    // special to Macedonian. The checkpoint quizzes the tricky ones (unique + look-alikes).
    chapterId: "s0-letters",
    points: [],
    letterSessions: [
      { title: "Letters that work like English", glyphs: ["А", "Е", "К", "М", "О", "Т"],
        note: "Macedonian spelling is phonetic: one letter, one sound, every time. These six look and sound the way you'd expect." },
      { title: "Look-alikes that fool you", glyphs: ["В", "Н", "Р", "С", "У", "Х"],
        note: "These look like English letters but make different sounds: В is v, Н is n, Р is a rolled r, С is s, У is oo, Х is h." },
      { title: "New shapes, familiar sounds", glyphs: ["Б", "Г", "Д", "З", "И", "Л", "П"],
        note: "New shapes for sounds you already make." },
      { title: "More new shapes", glyphs: ["Ф", "Ж", "Ц", "Ч", "Ш"],
        note: "Ж, Ц, Ч and Ш each write in one letter a sound English spells with two (zh, ts, ch, sh). Where's the stress? On the third syllable from the end, in words of three or more syllables." },
      { title: "Letters special to Macedonian", glyphs: ["Ѓ", "Ѕ", "Ј", "Љ", "Њ", "Ќ", "Џ"],
        note: "Seven letters you won't find in Russian. Ј is the y in yes; Љ and Њ are soft l and n; Ѓ and Ќ are soft dj and tj." },
    ],
  },
  {
    chapterId: "s0-repair",
    dropWords: ["Навистина?", "што", "каде", "како"], // question words are taught with their point in chapter 2
    points: [
      { id: "pt-sum", title: "Am / is / are: сум", grammarIds: ["to-be"], depth: "produce",
        scope: "Present tense of сум (сум, си, е, сме, сте, се) with the subject pronouns јас, ти, тој, таа, тоа, ние, вие, тие; сум can't start a sentence (Добро сум, Јас сум…).",
        words: ["јас", "ти", "тој", "таа", "ние"] },
      { id: "pt-ne", title: "Saying “not”: не", grammarIds: ["negation"], depth: "produce",
        scope: "не placed directly before the verb (or before a form of сум) to negate it: Не разбирам, Не знам, не е, не сакам.",
        words: ["Не разбирам.", "Не знам."] },
    ],
  },
  {
    chapterId: "s0-greet",
    dropWords: ["Добро утро", "Пријатно", "тие"],
    points: [
      { id: "pt-question-words", title: "Question words", grammarIds: ["questions"], depth: "produce",
        scope: "Wh-question words that open a question: што (what), кој (who), каде (where), кога (when), зошто (why), како (how), колку (how much), чиј (whose).",
        words: ["што", "каде", "како", "колку"] },
      { id: "pt-ti-vie", title: "Casual ти or polite вие", grammarIds: [], depth: "produce",
        scope: "Choosing informal ти forms (Како си?, verbs ending -ш) with friends and family vs polite/plural вие forms (Како сте?, verbs ending -те, Извинете) with strangers and elders.",
        words: ["вие", "Како си?", "Како сте?"] },
      { id: "pt-yes-no", title: "Yes/no questions: ли or дали", grammarIds: ["questions"], depth: "produce",
        scope: "Yes/no questions made with ли placed right after the verb (Можете ли…, Имате ли…, Може ли…, Сакате ли…) or with дали at the start (Дали…). Includes: a form of сум (си, е, сте) takes дали, not ли.",
        words: ["Можете ли да повторите?"] },
    ],
  },
  {
    chapterId: "s0-survive",
    dropWords: ["десет", "таму", "еден", "два", "три", "пет"],
    points: [
      { id: "pt-gender", title: "Three genders: еден, една, едно", grammarIds: ["gender"], depth: "produce",
        scope: "Noun gender (masculine/feminine/neuter, usually visible from the ending) and words that agree with it: еден/една/едно, овој/оваа/ова.",
        words: ["еден / една / едно", "ова / тоа"] },
      { id: "pt-numbers", title: "Counting things", grammarIds: ["numbers"], depth: "produce",
        scope: "Numbers (еден…десет, сто), два vs две, nouns after a number going plural (пет денари), and asking prices (Колку чини?).",
        words: ["два, три, четири, пет", "шест, седум, осум, девет, десет", "денар / денари"] },
    ],
  },
  {
    chapterId: "s1-cafe-order",
    points: [
      { id: "pt-verbs-a", title: "Verb endings: the -а verbs", grammarIds: ["verb-conjugation"], depth: "produce", heavy: true,
        scope: "Present-tense person endings of а-verbs: сакам, сакаш, сака, сакаме, сакате, сакаат (also имам, плаќам, зборувам). The -м ending means “I”.",
        words: ["имам", "давам"] },
      { id: "pt-the", title: "Saying “the”: it goes on the end", grammarIds: ["definite-articles"], depth: "produce",
        scope: "The definite article as a suffix: -от (m), -та (f), -то (n), -те (pl): сметката, кафето, пивото, центарот." },
      { id: "pt-da", title: "Want to, can: да + verb", grammarIds: ["da-modals"], depth: "produce",
        scope: "да + a conjugated verb after сакам, можам/може, треба, морам — Macedonian has no infinitive: Сакам да платам, Може ли да…, Можете ли да повторите?" },
    ],
  },
  {
    chapterId: "s1-greet-intro",
    dropWords: ["сум / си / е"], // taught as a grammar point in chapter 2
    points: [
      { id: "pt-verbs-e-i", title: "The other verb groups: -е and -и verbs", grammarIds: ["verb-conjugation-e", "verb-conjugation-i"], depth: "produce", heavy: true,
        scope: "Present tense of е-verbs (јадам, јадеш, јаде; пијам, пиеш, пие) and и-verbs (учам, учиш, учи; одам, одиш, оди; работам, работиш, работи).",
        words: ["јадам", "пијам", "знам", "одам", "работам", "видам"] },
      { id: "pt-se", title: "Verbs that come with се", grammarIds: ["clitics"], depth: "produce",
        scope: "Verbs that always carry се, placed right before the verb: се викам/се викаш, се вели, се гледаме, се согласувам, се разбира.",
        words: ["Како се викаш?", "Јас се викам..."] },
    ],
  },
  {
    chapterId: "s1-market",
    points: [
      { id: "pt-plurals", title: "More than one: plurals", grammarIds: ["noun-plurals"], depth: "produce",
        scope: "Regular noun plurals: masculine -и/-ови, feminine -а → -и, neuter -о/-е → -а (денар → денари, пиво → пива, кафе → кафиња; јаболка = apples).",
        words: ["јаболка"] },
      { id: "pt-adjectives", title: "Adjectives match their noun", grammarIds: ["adjective-agreement"], depth: "produce",
        scope: "Adjective agreement in gender and number: добар/добра/добро/добри, евтин/евтина, голем/голема/големи, убав/убаво/убави, нов/ново — including with the article (новиот).",
        words: ["евтин", "скап", "добар"] },
      { id: "pt-go-ja-gi", title: "It, them: го, ја, ги", grammarIds: ["clitics"], depth: "produce",
        scope: "Direct-object pronouns го (him/it), ја (her/it), ги (them) placed before the verb, including doubling a definite object: ќе ги земам, Го сакам.",
        acceptLater: {
          // Every го/ги line in the pack carries something later (ќе, ми, a command); this one's English says "to-me + it + gives".
          "grammar:clitics#1": "the only го-before-the-verb line without a command; its English spells out ми",
        } },
    ],
  },
  {
    chapterId: "s1-directions",
    points: [
      { id: "pt-prepositions", title: "Little linking words: во, на, до, од, со", grammarIds: ["prepositions"], depth: "produce",
        scope: "Prepositions of place and movement: во (in), на (on/at/to), до (to/next to), од (from), со (with), кај (at someone's), пред, зад, близу до.",
        words: ["во", "на", "од"] },
      { id: "pt-commands", title: "Telling someone what to do", grammarIds: ["imperatives"], depth: "produce",
        scope: "Imperatives: polite/plural -ете/-ајте (Свртете, Одете, Повелете, Извинете, Кажете) and informal -ај/-и, plus немој да for “don't”.",
        words: ["Свртете лево."] },
      { id: "pt-more-most", title: "More and most: по- and нај-", grammarIds: ["comparatives"], depth: "produce",
        scope: "Comparatives and superlatives with по- and нај- written as one word: побавно, побрзо, подобро, поголем, поубав; најдобар, најубав, најголем." },
    ],
  },
  {
    chapterId: "s2-smalltalk",
    dropWords: ["ама", "затоа", "и"],
    points: [
      { id: "pt-mi-ti-mu", title: "To me, to you: ми, ти, му", grammarIds: ["clitics"], depth: "produce", heavy: true,
        scope: "Short to-whom pronouns ми, ти, му, ѝ, ни, ви, им before the verb, including the liking construction ми се допаѓа (it pleases me), Мило ми е, Кажи ми.",
        words: ["Ми се допаѓа.", "Не ми се допаѓа."] },
      { id: "pt-future", title: "The future: ќе and нема да", grammarIds: ["future-tense", "negation"], depth: "produce", heavy: true,
        scope: "Future with ќе + present verb (ќе одам, Ќе се видиме, Што ќе сакате?) and its negative нема да + verb.",
        words: ["Ќе …", "Ќе се видиме."] },
    ],
  },
  {
    chapterId: "s2-pasttime",
    points: [
      { id: "pt-past", title: "What happened: the past tense", grammarIds: ["past-tense"], depth: "produce", heavy: true,
        scope: "Simple past of common verbs: бев, беше, имав, имаше, отидов, отиде, јадев, правеше, гледав — finished events and past states." },
      { id: "pt-aspect", title: "Two versions of a verb", grammarIds: ["verb-aspect"], depth: "recognize",
        scope: "Verb aspect: an ongoing/repeated verb vs a one-time finished partner (пијам/испијам, купувам/купам, гледам/видам)." },
    ],
  },
  {
    chapterId: "s2-home-family",
    points: [
      { id: "pt-possessives", title: "My, your: мој and мајка ми", grammarIds: ["possessives"], depth: "produce",
        scope: "Possessives мој/моја/мое/мои, твој, негов, нејзин, наш, ваш, usually with the article (мојот, мојата), and the family shortcut мајка ми, брат ми.",
        words: ["мојот / мојата", "мој", "твој"] },
      { id: "pt-irregular-plurals", title: "Odd plurals: деца and луѓе", grammarIds: ["noun-plurals"], depth: "recognize",
        scope: "Irregular plurals: дете → деца, човек → луѓе, and the counting form for people (двајца)." },
    ],
  },
  {
    chapterId: "s2-arrange",
    points: [
      { id: "pt-time", title: "Telling the time: во … часот", grammarIds: [], depth: "produce",
        scope: "Clock times: во + number + часот (Во шест часот), Во колку часот?, кога." },
      { id: "pt-ajde-da", title: "Let's…: ајде да", grammarIds: ["da-modals"], depth: "produce",
        scope: "Suggestions with ајде да + verb (Ајде да се видиме) and planning questions with да (Каде да се видиме?)." },
    ],
  },
  {
    chapterId: "s2-problems",
    points: [
      { id: "pt-ima-nema", title: "There is, there isn't: има and нема", grammarIds: ["negation"], depth: "produce",
        scope: "има (there is / has) vs нема (there isn't / doesn't have): Има проблем, Нема проблем, нема вода, and the double negative (Немам ништо)." },
      { id: "pt-perfect", title: "The “have done” past", grammarIds: ["perfect-tense"], depth: "recognize",
        scope: "The past built from сум + an -л form (сум бил, си јадел) for experiences and things you didn't witness." },
    ],
  },
];

/** Cumulative stage reviews (DESIGN §4a) — one session after each of these chapters. */
export const STAGE_REVIEW_AFTER = ["s0-survive", "s1-directions", "s2-problems"];

/** Flattened, in spine order, with each point's chapter. */
export const spinePoints = (): (SpinePoint & { chapterId: string; order: number; chapterOrder: number })[] =>
  // SPINE[0] is chapter 0 (letters & sounds), so a chapter's index IS its pack order (run-course asserts it).
  SPINE.flatMap((c, ci) => c.points.map((p) => ({ ...p, chapterId: c.chapterId, chapterOrder: ci }))).map((p, i) => ({ ...p, order: i + 1 }));
