# Macedonian — stage 0 wave · spot-check queue

Units: `s0-repair`, `s0-greet`, `s0-survive`.
Generated: 34 vocab · 3 scenarios · 3 mini-stories · 2 info-gap tasks.
**8** line(s) flagged by the Validator (content correctness):

- `gen-s0-greet-v11`: 'Пријатно' does not mean 'Nice to meet you' — that is 'Мило ми е' / 'Драго ми е'. 'Пријатно' is a polite parting/well-wishing expression meaning 'Have a nice time/day' (and also 'Enjoy your meal' / 'Bon appétit'). The 'Nice to meet you' part of the gloss is incorrect.; The gloss conflates two unrelated phrases; the English should reflect the well-wishing/farewell sense.  → suggested: `Пријатно — Have a nice time / Enjoy (your meal)`
- `gen-s0-greet-v12`: 'Догледање' is not the standard Macedonian word for 'goodbye'. The correct term is 'Довидување'.; Stress should fall on the antepenultimate syllable: до-ВИ-ду-ва-ње.  → suggested: `Довидување`
- `gen-s0-greet-l1`: 'фала' is a colloquial/informal form; standard Macedonian for beginner content should use 'благодарам' (or the colloquial but more accepted 'фала ти/фала')  → suggested: `Добар ден! Добро сум, благодарам. А вие?`
- `gen-s0-greet-story-s8`: „Догледање“ is not standard Macedonian; the correct word is „Довидување“ (or „До гледање“ at most, but the natural farewell is „Довидување“).; Minor: „Пријатно“ literally means 'enjoy/have a nice time' used as a parting word; 'Take care' is an acceptable loose gloss.  → suggested: `„Пријатно, Ана!“ „Довидување, Марко!“`
- `gen-s0-survive-l1`: Gender agreement error: 'кафе' is neuter, so it should be 'едно кафе', not 'една кафе'.  → suggested: `Добар ден! Сакам едно кафе, ве молам.`
- `gen-s0-survive-l3`: 'може ли пак?' is too elliptical/colloquial and does not clearly mean 'can you repeat?'; a beginner would expect 'Можете ли да повторите?'; Gloss doesn't fully match the vague Macedonian phrasing  → suggested: `Извинете, можете ли да повторите? Каде е касата?`
- `gen-s0-survive-story-s5`: 'Може ли тоа?' literally means 'Is that possible?/May that?' and is too elliptical to clearly mean 'Can I have that?'; The English gloss adds 'I have' which is not present in the Macedonian; mismatch.; Not ideal for beginners since the meaning is ambiguous without context.  → suggested: `„Може ли да го добијам тоа?“ вели Ана.`
- `gen-s0-survive-gap-A4`: The two sentences are unrelated ('Can you repeat?' and 'I have a hundred denars') — combining them makes for an unnatural, confusing phrase for a beginner.; Each sentence is grammatically correct individually, but they don't belong together.  → suggested: `Може ли да повторите?`




Everything stays `confidence:"unreviewed"` and is NOT imported by the served pack until promoted. Total Opus cost: ~$0.800.
**Promotion:** spot-check → set `confidence:"validated"` → wire `generated-stage0.ts` exports into `pack-mk/src/index.ts` (mirror the existing `generated.ts` promotion).