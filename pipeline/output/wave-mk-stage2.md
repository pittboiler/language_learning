# Macedonian — stage 2 wave · spot-check queue

Units: `s2-smalltalk`, `s2-pasttime`, `s2-home-family`, `s2-arrange`, `s2-problems`.
Generated: 42 vocab · 5 scenarios · 5 mini-stories · 0 grammar · 0 readers · 9 writing · 2 info-gap tasks.
**13** line(s) flagged by the Validator (content correctness):

- `gen-s2-pasttime-l2`: 'кафе' usually means 'coffee'; for 'café' a native speaker would say 'кафуле' (or 'кафана'); aspect: 'јадев' is imperfective ('was eating'); for a completed action 'изедов сендвич' is more natural  → suggested: `Отидов во кафуле и изедов сендвич.`
- `gen-s2-pasttime-story-s2`: Verb conjugation error: 'имав' is 1st person singular (I had), but subject 'Тој' (he) requires 3rd person singular 'имаше'.  → suggested: `Тој имаше многу работа.`
- `gen-s2-pasttime-story-s3`: Wrong verb conjugation: 'отидов' is 1st person singular (I went), but subject is Marko (3rd person), should be 'отиде'; Missing definite article: 'во парк' should be 'во паркот' to match 'the park'  → suggested: `Денес Марко отиде во паркот.`
- `gen-s2-pasttime-story-s4`: Verb form mismatch: 'јадев' is first person singular ('I ate'), but the gloss says 'he ate' (which would be 'јадеше').  → suggested: `Таму јадев сендвич. (There I ate a sandwich.)`
- `gen-s2-pasttime-story-s6`: 'во парк' sounds incomplete/unnatural without the definite article; the gloss says 'the park', which corresponds to 'паркот'.; 'читав книга' is grammatically fine but slightly more natural as 'читав книга' or 'читав една книга'; minor.  → suggested: `„Бев во паркот и читав книга“, вели Марко.`
- `gen-s2-arrange-l3`: The gloss says 'Let's meet' but the Macedonian contains no verb for 'meet' — it implies 'let's go' (Ајде = come on/let's go).; 'кафето' most naturally means 'the coffee'; for 'cafe' the natural word is 'кафулето' (or 'кафето' is ambiguous).; The sentence is elliptical/casual and doesn't clearly express the intended meaning.  → suggested: `Ајде да се сретнеме во кафулето на плоштадот.`
- `gen-s2-arrange-story-s1`: Missing dative clitic 'ѝ' — Macedonian requires clitic doubling: 'Марко ѝ телефонира на Ана.'; More natural verb would be 'се јавува' (to call).  → suggested: `Марко ѝ телефонира на Ана.`
- `gen-s2-arrange-gap-B2`: The gloss omits the preposition: 'Во седум часот' means 'At seven o'clock', not 'Seven o'clock'.; The sentence order is unnatural — saying the time is good, then asking 'When? Tomorrow?' reads disjointed for a beginner phrase.  → suggested: `Во седум часот е добро. — At seven o'clock is good.`
- `gen-s2-arrange-gap-B4`: 'Тоа е десно' is unnatural; a native speaker would say 'Тоа е надесно' or 'Тоа е од десната страна' to mean 'it's on the right'.  → suggested: `Тоа е надесно, до банката.`
- `gen-s2-problems-v6`: The Macedonian lacks an object, so 'Сакам да вратам' sounds incomplete/unnatural — a native speaker would include the clitic/object.; The gloss says 'return (this)' but the Macedonian has no word for 'this' or 'it'.  → suggested: `Сакам да го вратам ова.`
- `gen-s2-problems-gap-A3`: The gloss says 'the coffee' (definite) but Macedonian 'кафе' lacks the definite article; should be 'кафето' to match.; 'Можете ли да помогнете?' sounds incomplete; a native speaker would add 'ми' (me): 'Можете ли да ми помогнете?'; Returning 'coffee' is a slightly unusual scenario for a beginner phrase.  → suggested: `Сакам да го вратам кафето. Можете ли да ми помогнете?`
- `gen-s2-problems-gap-B1`: 'Што има проблем?' is unnatural/incorrect Macedonian — a calque. The natural phrasing is 'Каков е проблемот?' or 'Што е проблемот?'; The two sentences ('What's the problem?' and 'Sorry') are oddly combined and don't flow naturally together.  → suggested: `Каков е проблемот? Извинете.`
- `gen-s2-problems-gap-B4`: Number agreement: with plural '40 денари' the verb should be plural 'се', not singular 'е' — 'Вкупно се 40 денари' (or simply 'Вкупно 40 денари').  → suggested: `Вкупно се 40 денари. Во ред?`


**0** structural drill issue(s) (malformed multiple-choice — the line Validator can't see these):

- (none)

Everything stays `confidence:"unreviewed"` and is NOT imported by the served pack until promoted. Total Opus cost: ~$1.084.
**Promotion:** spot-check → set `confidence:"validated"` → wire `generated-stage2.ts` exports into `pack-mk/src/index.ts` (mirror the existing `generated.ts` promotion).