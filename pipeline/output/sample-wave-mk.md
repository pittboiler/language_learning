# Sample wave — Macedonian (Stage 0 repair kit + a café extension)

**One end-to-end wave, produced as a concrete proof of format + quality.** Generated at the **Opus 4.8
offline tier** (the same tier the pipeline uses), in the exact `pack-schema` shapes. Everything is
`confidence:"unreviewed"` and is **NOT wired into the served `macedonian` pack** — the trust gate holds
until a native spot-check promotes it. Two units:

- **`s0-repair`** — net-new, the highest-leverage missing content: chunks + mini-story + scenario + info-gap.
- **`s1-cafe-order`** — the anchor, shown *extending* the authored gold (not duplicating it): one new
  spiraling scenario + its vocab. (The existing `order-a-drink` scenario, `ana-coffee` story, café reader,
  and `cafe-order-gap` info-gap already map to this unit.)

A self-validation pass (the same checks `validator.ts` runs) and a spot-check sheet follow the content.

---

## Unit `s0-repair` — the repair kit

### 1. ReviewItems (chunks) — `confidence:"unreviewed"`

```ts
import type { ReviewItem } from "@ll/pack-schema";

export const s0RepairVocab: ReviewItem[] = [
  { id: "v-ne-razbiram", kind: "phrase", prompt: "I don't understand", answer: "Не разбирам.", translit: "Ne razbiram.", gloss: "I don't understand.", i1Level: 0, tags: ["repair", "s0-repair"], meta: { freqRank: 1 }, confidence: "unreviewed" },
  { id: "v-izvinete", kind: "phrase", prompt: "Excuse me / Sorry (formal)", answer: "Извинете.", translit: "Izvinete.", gloss: "Excuse me. / Sorry.", i1Level: 0, tags: ["repair", "s0-repair"], meta: { freqRank: 1 }, confidence: "unreviewed" },
  { id: "v-povtorete", kind: "phrase", prompt: "Can you repeat? (formal)", answer: "Можете ли да повторите?", translit: "Možete li da povtorite?", gloss: "Can you repeat?", i1Level: 0, tags: ["repair", "s0-repair"], meta: { freqRank: 1 }, confidence: "unreviewed" },
  { id: "v-pobavno", kind: "phrase", prompt: "Slower, please", answer: "Побавно, ве молам.", translit: "Pobavno, ve molam.", gloss: "Slower, please.", i1Level: 0, tags: ["repair", "s0-repair"], meta: { freqRank: 1 }, confidence: "unreviewed" },
  { id: "v-ushte-ednash", kind: "phrase", prompt: "Once more, please", answer: "Уште еднаш, ве молам.", translit: "Ušte ednaš, ve molam.", gloss: "Once more, please.", i1Level: 0, tags: ["repair", "s0-repair"], meta: { freqRank: 2 }, confidence: "unreviewed" },
  { id: "v-kako-se-veli", kind: "phrase", prompt: "How do you say … in Macedonian?", answer: "Како се вели … на македонски?", translit: "Kako se veli … na makedonski?", gloss: "How do you say … in Macedonian?", i1Level: 1, tags: ["repair", "s0-repair", "elicitation"], meta: { freqRank: 2 }, confidence: "unreviewed" },
  { id: "v-shto-znachi", kind: "phrase", prompt: "What does … mean?", answer: "Што значи …?", translit: "Što znači …?", gloss: "What does … mean?", i1Level: 1, tags: ["repair", "s0-repair", "elicitation"], meta: { freqRank: 2 }, confidence: "unreviewed" },
  { id: "v-se-ushte-ucam", kind: "phrase", prompt: "I'm still learning", answer: "Сѐ уште учам.", translit: "Sè ušte učam.", gloss: "I'm still learning.", i1Level: 1, tags: ["repair", "s0-repair"], meta: { freqRank: 2 }, confidence: "unreviewed" },
  { id: "v-ne-znam", kind: "phrase", prompt: "I don't know", answer: "Не знам.", translit: "Ne znam.", gloss: "I don't know.", i1Level: 0, tags: ["repair", "s0-repair"], meta: { freqRank: 1 }, confidence: "unreviewed" },
  { id: "v-vo-red", kind: "phrase", prompt: "OK / Alright", answer: "Во ред.", translit: "Vo red.", gloss: "OK. / Alright.", i1Level: 0, tags: ["repair", "s0-repair", "backchannel"], meta: { freqRank: 1 }, confidence: "unreviewed" },
  { id: "v-aha", kind: "phrase", prompt: "Uh-huh (backchannel)", answer: "Аха.", translit: "Aha.", gloss: "Uh-huh.", i1Level: 0, tags: ["repair", "s0-repair", "backchannel"], meta: { freqRank: 1 }, confidence: "unreviewed" },
  { id: "v-navistina", kind: "phrase", prompt: "Really? (backchannel)", answer: "Навистина?", translit: "Navistina?", gloss: "Really?", i1Level: 1, tags: ["repair", "s0-repair", "backchannel"], meta: { freqRank: 2 }, confidence: "unreviewed" },
];
```

### 2. MiniStory — "Том не разбира" (a conversation that breaks and gets repaired)

```ts
import type { MiniStory } from "@ll/pack-schema";

export const tomRepairStory: MiniStory = {
  id: "tom-repair",
  title: "Том не разбира",
  titleGloss: "Tom doesn't understand",
  i1Level: 1,
  level: "pre-A1",
  theme: "Keeping the conversation alive",
  audioSource: "tts",
  confidence: "unreviewed",
  body: [
    { text: "Том е во Скопје.", translit: "Tom e vo Skopje.", gloss: "Tom is in Skopje." },
    { text: "Тој зборува со една жена.", translit: "Toj zboruva so edna žena.", gloss: "He is talking with a woman." },
    { text: "Жената зборува брзо.", translit: "Ženata zboruva brzo.", gloss: "The woman speaks fast." },
    { text: "Том вели: „Извинете, не разбирам.“", translit: "Tom veli: Izvinete, ne razbiram.", gloss: "Tom says: \"Excuse me, I don't understand.\"" },
    { text: "„Побавно, ве молам.“", translit: "Pobavno, ve molam.", gloss: "\"Slower, please.\"" },
    { text: "Жената се смее и зборува полека.", translit: "Ženata se smee i zboruva poleka.", gloss: "The woman smiles and speaks slowly." },
    { text: "„Како се вели ‘thank you’ на македонски?“ прашува Том.", translit: "Kako se veli 'thank you' na makedonski? prašuva Tom.", gloss: "\"How do you say 'thank you' in Macedonian?\" asks Tom." },
    { text: "„Фала“, вели жената.", translit: "Fala, veli ženata.", gloss: "\"Fala,\" says the woman." },
    { text: "„Фала!“ вели Том. „Сега разбирам.“", translit: "Fala! veli Tom. Sega razbiram.", gloss: "\"Thanks!\" says Tom. \"Now I understand.\"" },
  ],
  qa: [
    { id: "q1", question: "Како зборува жената на почетокот?", questionGloss: "How does the woman speak at the start?", answer: "Брзо.", answerGloss: "Fast." },
    { id: "q2", question: "Што вели Том кога не разбира?", questionGloss: "What does Tom say when he doesn't understand?", answer: "Извинете, не разбирам.", answerGloss: "Excuse me, I don't understand." },
    { id: "q3", question: "Замоли некого да зборува побавно — кажи го гласно!", questionGloss: "Ask someone to speak more slowly — say it aloud!", answer: "Побавно, ве молам.", answerGloss: "Slower, please.", answerTranslit: "Pobavno, ve molam.", spokenPrompt: true },
  ],
  registersVocab: [
    { lexKey: "не разбирам", gloss: "I don't understand" },
    { lexKey: "извинете", gloss: "excuse me / sorry" },
    { lexKey: "побавно", gloss: "slower" },
    { lexKey: "ве молам", gloss: "please" },
    { lexKey: "како се вели", gloss: "how do you say" },
    { lexKey: "прашува", gloss: "asks" },
    { lexKey: "полека", gloss: "slowly" },
    { lexKey: "сега", gloss: "now" },
    { lexKey: "разбирам", gloss: "I understand" },
    { lexKey: "зборува", gloss: "speaks / talks" },
    { lexKey: "брзо", gloss: "fast" },
    { lexKey: "се смее", gloss: "smiles / laughs" },
  ],
};
```

### 3. Scenario — "Keep the conversation alive" (sustain an exchange with ≥3 repair moves)

```ts
import type { Scenario } from "@ll/pack-schema";

export const repairScenario: Scenario = {
  id: "s0-repair-survive",
  title: "Keep the conversation alive",
  goal: "Stay in a conversation you don't fully understand, using repair moves.",
  setting: "chatting with someone at a bar",
  theme: "Keeping the conversation alive",
  requiredVocab: ["v-ne-razbiram", "v-povtorete", "v-shto-znachi", "v-se-ushte-ucam"],
  requiredStructures: [],
  script: [
    { speaker: "partner", text: "Здраво! Од каде си?", gloss: "Hi! Where are you from?" },
    { speaker: "learner", text: "Извини, не разбирам. Можеш ли да повториш?", translit: "Izvini, ne razbiram. Možeš li da povtoriš?", gloss: "Sorry, I don't understand. Can you repeat?", satisfies: ["asked-repeat"] },
    { speaker: "partner", text: "Од каде си? Од која земја?", gloss: "Where are you from? From which country?" },
    { speaker: "learner", text: "Аха! Од Америка сум.", translit: "Aha! Od Amerika sum.", gloss: "Uh-huh! I'm from America.", satisfies: ["answered-origin"] },
    { speaker: "partner", text: "Супер! Колку време си тука?", gloss: "Cool! How long have you been here?" },
    { speaker: "learner", text: "Што значи „време“?", translit: "Što znači „vreme“?", gloss: "What does 'vreme' mean?", satisfies: ["asked-meaning"] },
    { speaker: "partner", text: "„Време“ — time. Колку дена си тука?", gloss: "'Vreme' — time. How many days are you here?" },
    { speaker: "learner", text: "Аха! Три дена. Сѐ уште учам македонски.", translit: "Aha! Tri dena. Sè ušte učam makedonski.", gloss: "Uh-huh! Three days. I'm still learning Macedonian.", satisfies: ["answered-time", "stayed-in"] },
    { speaker: "partner", text: "Браво! Одлично ти оди.", gloss: "Well done! You're doing great." },
  ],
  successCriteria: [
    { id: "asked-repeat", description: "Asked the partner to repeat" },
    { id: "asked-meaning", description: "Asked what a word means" },
    { id: "answered-origin", description: "Answered where you're from" },
    { id: "answered-time", description: "Answered how long you're here" },
    { id: "stayed-in", description: "Stayed in the conversation to the end" },
  ],
  confidence: "unreviewed",
};
```

### 4. InfoGapTask — "Teach each other the words" (forced interdependence on the elicitation kit)

```ts
import type { InfoGapTask } from "@ll/pack-schema";

export const wordsInfoGap: InfoGapTask = {
  id: "words-gap",
  title: "Teach each other the words (info-gap)",
  goal: "Complete your list — each of you knows the Macedonian words the other is missing. Ask for them.",
  setting: "two friends comparing shopping lists",
  roleA: {
    role: "A",
    brief: "You know some Macedonian words; your partner knows the rest. Ask for the ones you don't know using „Како се вели … на македонски?“.",
    secretInfo: ["You KNOW: леб = bread, вода = water, млеко = milk.", "You still NEED: apple, cheese, coffee."],
    targetPhrases: [
      { text: "Како се вели apple на македонски?", gloss: "How do you say apple in Macedonian?", translit: "Kako se veli apple na makedonski?" },
      { text: "Што значи „леб“?", gloss: "What does 'leb' mean?", translit: "Što znači „leb“?" },
      { text: "Аха, фала!", gloss: "Uh-huh, thanks!", translit: "Aha, fala!" },
    ],
  },
  roleB: {
    role: "B",
    brief: "You know some Macedonian words; your partner knows the rest. Ask for the ones you don't know using „Како се вели … на македонски?“.",
    secretInfo: ["You KNOW: јаболко = apple, сирење = cheese, кафе = coffee.", "You still NEED: bread, water, milk."],
    targetPhrases: [
      { text: "Се вели „јаболко“.", gloss: "It's called 'jabolko'.", translit: "Se veli „jabolko“." },
      { text: "Како се вели milk на македонски?", gloss: "How do you say milk in Macedonian?", translit: "Kako se veli milk na makedonski?" },
      { text: "Нема на што.", gloss: "You're welcome.", translit: "Nema na što." },
    ],
  },
  successCriteria: [
    { id: "a-asked", description: "A asked for apple, cheese, coffee" },
    { id: "b-asked", description: "B asked for bread, water, milk" },
    { id: "taught", description: "Each gave the words they knew, using „Се вели …“" },
    { id: "complete", description: "Both lists are complete" },
  ],
  confidence: "unreviewed",
};
```

---

## Unit `s1-cafe-order` — extension (spirals repair + numbers + gender)

### 5. Scenario — "Order for two and split the bill"

```ts
import type { Scenario, ReviewItem } from "@ll/pack-schema";

export const cafeForTwoScenario: Scenario = {
  id: "s1-cafe-order-for-two",
  title: "Order for two and split the bill",
  goal: "Order two coffees and a water, ask the total, and pay separately.",
  setting: "a busy café in Skopje",
  theme: "Café & bar",
  requiredVocab: ["v-dve-kafinja", "v-se-zaedno", "v-oddelno"],
  requiredStructures: ["gender", "definite-articles"],
  script: [
    { speaker: "partner", text: "Повелете, што ќе сакате?", gloss: "Go ahead, what would you like?" },
    { speaker: "learner", text: "Две кафиња и една вода, ве молам.", translit: "Dve kafinja i edna voda, ve molam.", gloss: "Two coffees and one water, please.", satisfies: ["ordered"] },
    { speaker: "partner", text: "Веднаш. Нешто друго?", gloss: "Right away. Anything else?" },
    { speaker: "learner", text: "Не, фала. Колку чини сѐ заедно?", translit: "Ne, fala. Kolku čini sè zaedno?", gloss: "No, thanks. How much is it all together?", satisfies: ["asked-total"] },
    { speaker: "partner", text: "Сто и дваесет денари.", gloss: "A hundred and twenty denars." },
    { speaker: "learner", text: "Може ли да платиме одделно?", translit: "Može li da platime oddelno?", gloss: "Can we pay separately?", satisfies: ["asked-separate"] },
    { speaker: "partner", text: "Се разбира. Шеесет денари секој.", gloss: "Of course. Sixty denars each." },
    { speaker: "learner", text: "Повелете. Фала!", translit: "Povelete. Fala!", gloss: "Here you are. Thanks!", satisfies: ["paid"] },
  ],
  successCriteria: [
    { id: "ordered", description: "Ordered for two (two coffees, one water)" },
    { id: "asked-total", description: "Asked the total" },
    { id: "asked-separate", description: "Asked to pay separately" },
    { id: "paid", description: "Paid" },
  ],
  confidence: "unreviewed",
};

export const cafeForTwoVocab: ReviewItem[] = [
  { id: "v-dve-kafinja", kind: "phrase", prompt: "two coffees", answer: "две кафиња", translit: "dve kafinja", gloss: "two coffees", i1Level: 2, tags: ["cafe", "s1-cafe-order"], meta: { freqRank: 2, gender: "neuter" }, confidence: "unreviewed" },
  { id: "v-se-zaedno", kind: "phrase", prompt: "all together", answer: "сѐ заедно", translit: "sè zaedno", gloss: "all together", i1Level: 2, tags: ["cafe", "paying", "s1-cafe-order"], meta: { freqRank: 2 }, confidence: "unreviewed" },
  { id: "v-oddelno", kind: "phrase", prompt: "separately", answer: "одделно", translit: "oddelno", gloss: "separately", i1Level: 2, tags: ["cafe", "paying", "s1-cafe-order"], meta: { freqRank: 3 }, confidence: "unreviewed" },
];
```

---

## Self-validation pass (the same checks `validator.ts` runs)

Grammar (esp. gender agreement + article forms), gloss accuracy, naturalness, beginner-level, against the
authored `order-a-drink` style. `✓` = validated · `⚠` = pass, but flagged for the native spot-check.

| Item / line | Key checks | Verdict |
|---|---|---|
| `Не разбирам.` / `Не знам.` / `Извинете.` | top-frequency fixed forms; glosses exact | ✓ |
| `Можете ли да повторите?` (formal) | formal 2pl `повторите`; matches `Извинете`/`ве молам` register | ✓ |
| `Побавно, ве молам.` / `Уште еднаш, ве молам.` | comparative `побавно`; `ве молам` from authored vocab | ✓ |
| `Како се вели … на македонски?` / `Што значи …?` | elicitation frames; placeholder slot natural | ✓ |
| `Сѐ уште учам.` | `сѐ` (with grave) = 'still'; `учам` 1sg as authored | ✓ |
| Backchannels `Во ред.` / `Аха.` / `Навистина?` | natural spoken discourse markers | ✓ |
| Story: `една жена` / `Жената … брзо` | `една` (f) agrees; definite `жената` correct | ✓ |
| Story: `се смее` / `прашува` / `полека` | reflexive `се смее`; `полека` natural register | ✓ |
| Story Q&A `spokenPrompt` (q3) | routes to `core/speaking`; answer matches a taught chunk | ✓ |
| Scenario: `Можеш ли да повториш?` (informal) | informal 2sg, register-consistent with partner's `си` | ✓ |
| Scenario: `Три дена` | counting-plural after a number (`ден → дена`) | ⚠ (correct; native to confirm the counting form) |
| Café: `Две кафиња и една вода` | `кафе`(n) pl `кафиња`; `две`+n-pl, `една`(f) — agreement correct | ✓ |
| Café: `да платиме одделно` / `сѐ заедно` | 1pl `платиме`; `одделно`/`сѐ заедно` natural | ✓ |
| Café: total 120 → `Шеесет денари секој` | arithmetic self-consistent for two payers | ⚠ (illustrative prices — confirm plausibility) |
| Info-gap: `Како се вели apple…?` (English slot) | intentional: learner names the unknown word in English to elicit MK | ⚠ (by design — confirm the convention reads clearly) |

**No `✗` (blocking) items.** Structural `lintDrills` is N/A here (no MC grammar drills in this wave).

---

## Spot-check sheet (mirrors `spotcheck-bg.md`) — Jake / a native, before promotion

**Everything stays `confidence:"unreviewed"` and is surfaced with a "⚠ unreviewed" badge until promoted.**

### Cross-checks that PASSED (high confidence)
- **Repair kit (12 chunks):** all top-frequency fixed expressions; formal/informal register split is deliberate
  (`Можете ли да повторите?` formal chunk vs `Можеш ли да повториш?` in the peer-bar scenario). Glosses exact.
- **Gender agreement** (the Haiku-trap class): `една жена`, `една вода`, `две кафиња` (neuter plural) — all correct.
- **Definite forms:** `Жената`, and the café unit's article rule (`сметка→сметката`, `кафе→кафето`) consistent
  with the authored pack.
- **Reuse/spiraling is real:** the café-for-two scenario recycles `ве молам`, `колку чини`, `сѐ заедно`
  (from the authored info-gap), `може ли` (survival), and gender — exactly the compounding the curriculum promises.

### Items for the NATIVE-REVIEW queue (3)
1. **Counting plural `три дена`** — standard Macedonian counting form after numbers; confirm it reads as natural
   as `три дена` vs any regional `три дни`.
2. **Illustrative café prices** — total 120 den, split 60 each (2 payers). Self-consistent; confirm it's
   plausible for two coffees + a water in Skopje (cosmetic, not grammatical).
3. **English-in-the-slot convention** (`Како се вели apple на македонски?`) — intentional for the elicitation
   info-gap (the learner doesn't yet know the MK word). Confirm the UI renders the English token clearly so it
   reads as "the word I'm asking for," not an error.

### Note
This wave was authored at the Opus 4.8 tier (the pipeline's generation tier) and self-validated; the live
pipeline would additionally run the independent `validate()` pass before this sheet. **Promotion path:**
spot-check → `unreviewed → validated` → wire into `pack-mk/src` (mirror the `generated.ts → index.ts`
promotion). Nothing here is served until then.
```

**STOP for review** — no further units are generated, and nothing is wired into the served pack, until the
curriculum (`curriculum-mk.json`) and this sample wave are approved.
