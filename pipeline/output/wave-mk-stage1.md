# Macedonian — stage 1 wave · spot-check queue

Units: `s1-cafe-order`, `s1-greet-intro`, `s1-market`, `s1-directions`.
Generated: 41 vocab · 4 scenarios · 4 mini-stories · 2 grammar · 3 readers · 3 writing · 3 info-gap tasks.
**13** line(s) flagged by the Validator (content correctness):

- `gen-s1-cafe-order-v10`: Spelling: should be written as two words 'На здравје!' not 'Наздравје!'  → suggested: `На здравје!`
- `gen-s1-cafe-order-l3`: The two sentences belong to different speakers: 'Повелете' (here you are/go ahead) is typically said by the waiter offering something, while 'Сметката, ве молам' (the bill, please) is said by the customer. Combined as one utterance it's contradictory/unnatural.  → suggested: `Сметката, ве молам.`
- `gen-s1-cafe-order-story-s6`: The toast is standardly written as two words: „На здравје!“ rather than „Наздравје!“  → suggested: `„На здравје!“ вели Марко.`
- `gen-s1-cafe-order-gender-d1`: The gloss 'one coffee' does not match the word 'едно' alone, which means just 'one'. 'кафе' is part of the context, not the target word.  → suggested: `едно — one (neuter)`
- `gen-s1-cafe-order-gap-A1`: 'Добар вечер' has wrong gender agreement — 'вечер' is feminine in Macedonian, so it should be 'Добра вечер' (or 'Добровечер').  → suggested: `Добра вечер! Едно пиво и еден сок, ве молам.`
- `gen-s1-cafe-order-gap-A3`: English gloss has a number agreement error: 'five hundred denars' is plural, so it should be 'Here are five hundred denars.'  → suggested: `Еве петстотини денари. — Here are five hundred denars.`
- `gen-s1-cafe-order-gap-B1`: 'Добар вечер' is incorrect in standard Macedonian — 'вечер' is feminine and the fixed greeting is 'Добровечер' (one word). 'Добар вечер' is a calque from Bulgarian/Serbian.; Missing capital handling aside, the rest ('Повелете, што сакате?') is correct and natural.  → suggested: `Добровечер! Повелете, што сакате?`
- `gen-s1-cafe-order-gap-B4`: 'на здравје' literally means 'to your health' (used as a toast, after a sneeze 'bless you', or when offering food/drink) — it is not natural when handing back change; The English gloss 'cheers' doesn't accurately match 'на здравје' in this context; pairing change with 'на здравје' sounds odd to a native speaker; More natural would be 'Повелете' (here you go) or 'Пријатно' when giving change  → suggested: `Еве кусур, повелете!`
- `gen-s1-market-v10`: 'фала' is a colloquial/spoken form; for beginner learning content the standard form 'благодарам' is preferable.; 'Само тоа' is understandable but slightly clipped; 'Само тоа е сѐ' or 'Тоа е сѐ' is more natural for 'That's all'.  → suggested: `Тоа е сѐ, благодарам.`
- `gen-s1-directions-v4`: 'направо' is not standard Macedonian; it is a Serbian/Russian form. The Macedonian word for 'straight ahead' is 'право' (or 'право напред').  → suggested: `право`
- `gen-s1-directions-v10`: 'во центар' literally means 'in centre' (location), not 'to the centre' (direction) — gloss mismatch; Missing definite article; natural Macedonian would be 'во центарот' (in/to the centre); As written, 'во центар' sounds incomplete/unnatural for a beginner phrase  → suggested: `во центарот — in/to the centre`
- `gen-s1-directions-story-s6`: 'во центар' means 'in the centre', not 'to the centre' — the gloss doesn't match; a bus going to a destination uses 'за' or 'до'.; 'центар' should be definite ('центарот') to mean 'the centre'.; The phrasing 'автобус во центар' is unnatural in Macedonian.  → suggested: `Таму има автобус за центарот.`
- `gen-s1-directions-reader-l5`: Semantically odd: taxis don't use tickets (билет), so 'билет за такси' is unnatural. A native speaker wouldn't say this. Use 'билет за воз/автобус' or 'пари за такси'.  → suggested: `Ана нема билет за воз.`


**0** structural drill issue(s) (malformed multiple-choice — the line Validator can't see these):

- (none)

Everything stays `confidence:"unreviewed"` and is NOT imported by the served pack until promoted. Total Opus cost: ~$1.210.
**Promotion:** spot-check → set `confidence:"validated"` → wire `generated-stage1.ts` exports into `pack-mk/src/index.ts` (mirror the existing `generated.ts` promotion).