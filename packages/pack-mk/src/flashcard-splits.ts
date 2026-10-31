// Flashcards only: cards that bundle several forms are drilled one form per card (Jake, 2026-10-31: "one
// (m/f/n) can be split into a flashcard for each gender"). Lessons and the warm-up still show the bundle.
// Keyed by the bundled card's answer, exactly as written; the parts line up with it. A comma list of single
// words ("два, три, четири, пет") splits on its own (index.ts); every "x / y" answer needs an entry here
// (the pack check fails otherwise), since its English doesn't always split cleanly ("one (m / f / n)").
// Each prompt says which form it wants, so a part never has two right answers.
export const flashcardSplits: Record<string, { prompt: string; answer: string }[]> = {
  "Би сакал / Би сакала …": [
    { prompt: "I'd like … (said by a man)", answer: "Би сакал …" },
    { prompt: "I'd like … (said by a woman)", answer: "Би сакала …" },
  ],
  "кој / кога / зошто": [
    { prompt: "who", answer: "кој" },
    { prompt: "when", answer: "кога" },
    { prompt: "why", answer: "зошто" },
  ],
  "бевме / бевте / беа": [
    { prompt: "we were", answer: "бевме" },
    { prompt: "you were (you all, or polite)", answer: "бевте" },
    { prompt: "they were", answer: "беа" },
  ],
  "имавме / имавте / имаа": [
    { prompt: "we had", answer: "имавме" },
    { prompt: "you had (you all, or polite)", answer: "имавте" },
    { prompt: "they had", answer: "имаа" },
  ],
  "отидовме / отидовте / отидоа": [
    { prompt: "we went", answer: "отидовме" },
    { prompt: "you went (you all, or polite)", answer: "отидовте" },
    { prompt: "they went", answer: "отидоа" },
  ],
  "јадевме / јадевте / јадеа": [
    { prompt: "we ate", answer: "јадевме" },
    { prompt: "you ate (you all, or polite)", answer: "јадевте" },
    { prompt: "they ate", answer: "јадеа" },
  ],
  "Добро утро / Добра вечер / Добра ноќ": [
    { prompt: "good morning", answer: "Добро утро" },
    { prompt: "good evening", answer: "Добра вечер" },
    { prompt: "good night", answer: "Добра ноќ" },
  ],
  "Благодарам / Нема за што": [
    { prompt: "thank you (formal)", answer: "Благодарам" },
    { prompt: "you're welcome (“it's nothing”)", answer: "Нема за што" },
  ],
  "Пријатно / Чао": [
    { prompt: "goodbye, have a nice day (formal)", answer: "Пријатно" },
    { prompt: "bye (casual)", answer: "Чао" },
  ],
  "и / а / или": [
    { prompt: "and", answer: "и" },
    { prompt: "and, whereas (for a contrast)", answer: "а" },
    { prompt: "or", answer: "или" },
  ],
  "овој / оваа / овие": [
    { prompt: "this (with a masculine noun)", answer: "овој" },
    { prompt: "this (with a feminine noun)", answer: "оваа" },
    { prompt: "these", answer: "овие" },
  ],
  "многу / малку": [
    { prompt: "a lot, very", answer: "многу" },
    { prompt: "a little", answer: "малку" },
  ],
  "голем / мал": [
    { prompt: "big", answer: "голем" },
    { prompt: "small", answer: "мал" },
  ],
  "нов / стар": [
    { prompt: "new", answer: "нов" },
    { prompt: "old", answer: "стар" },
  ],
  "со / за / кај": [
    { prompt: "with", answer: "со" },
    { prompt: "for, about", answer: "за" },
    { prompt: "at (someone's place)", answer: "кај" },
  ],
  "пред / зад": [
    { prompt: "in front of", answer: "пред" },
    { prompt: "behind", answer: "зад" },
  ],
  "ама / но / затоа": [
    { prompt: "but (casual)", answer: "ама" },
    { prompt: "but (more formal)", answer: "но" },
    { prompt: "so, that's why", answer: "затоа" },
  ],
  "негов / нејзин": [
    { prompt: "his", answer: "негов" },
    { prompt: "her (hers)", answer: "нејзин" },
  ],
  "наш / ваш / нивен": [
    { prompt: "our", answer: "наш" },
    { prompt: "your (you all, or polite)", answer: "ваш" },
    { prompt: "their", answer: "нивен" },
  ],
  "пријател / пријателка": [
    { prompt: "friend (a man)", answer: "пријател" },
    { prompt: "friend (a woman)", answer: "пријателка" },
  ],
  "еден / една / едно": [
    { prompt: "one (with a masculine noun)", answer: "еден" },
    { prompt: "one (with a feminine noun)", answer: "една" },
    { prompt: "one (with a neuter noun)", answer: "едно" },
  ],
  "ова / тоа": [
    { prompt: "this (“this is …”)", answer: "ова" },
    { prompt: "that, it (“that is …”)", answer: "тоа" },
  ],
  "денар / денари": [
    { prompt: "denar (one)", answer: "денар" },
    { prompt: "denars (more than one)", answer: "денари" },
  ],
  "педесет / сто / сто и педесет": [
    { prompt: "fifty", answer: "педесет" },
    { prompt: "a hundred", answer: "сто" },
    { prompt: "a hundred and fifty", answer: "сто и педесет" },
  ],
  "сум / си / е": [
    { prompt: "(I) am", answer: "сум" },
    { prompt: "(you) are (casual, one person)", answer: "си" },
    { prompt: "(he/she/it) is", answer: "е" },
  ],
  "близу / далеку": [
    { prompt: "near", answer: "близу" },
    { prompt: "far", answer: "далеку" },
  ],
  "тука / таму": [
    { prompt: "here", answer: "тука" },
    { prompt: "there", answer: "таму" },
  ],
  "убаво / грозно": [
    { prompt: "nice (“it's nice”)", answer: "убаво" },
    { prompt: "awful (“it's awful”)", answer: "грозно" },
  ],
  "и / ама / затоа": [
    { prompt: "and", answer: "и" },
    { prompt: "but (casual)", answer: "ама" },
    { prompt: "so, that's why", answer: "затоа" },
  ],
  "вчера / денес / утре": [
    { prompt: "yesterday", answer: "вчера" },
    { prompt: "today", answer: "денес" },
    { prompt: "tomorrow", answer: "утре" },
  ],
  "мајка / татко": [
    { prompt: "mother", answer: "мајка" },
    { prompt: "father", answer: "татко" },
  ],
  "брат / сестра": [
    { prompt: "brother", answer: "брат" },
    { prompt: "sister", answer: "сестра" },
  ],
  "жена / маж": [
    { prompt: "wife; woman", answer: "жена" },
    { prompt: "husband; man", answer: "маж" },
  ],
  "дете / деца": [
    { prompt: "child", answer: "дете" },
    { prompt: "children", answer: "деца" },
  ],
  "мојот / мојата": [
    { prompt: "my (masculine, as in “my brother”)", answer: "мојот" },
    { prompt: "my (feminine, as in “my sister”)", answer: "мојата" },
  ],
  "Важи. / Договорено.": [
    { prompt: "OK, deal! (short and casual)", answer: "Важи." },
    { prompt: "Agreed. (“it's arranged”)", answer: "Договорено." },
  ],
};
