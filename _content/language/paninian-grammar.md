---
title: "Pāṇini's Grammar: Sound Algebra and the Rules of Sanskrit"
summary: "How Pāṇini's Aṣṭādhyāyī (5th to 4th century BCE, Gandhara) described Sanskrit in about four thousand terse, ordered rules, starting from a list of fourteen sound-lines. Includes what scholars have and have not shown about its formal power."
date: "2026-11-21"
tags: [sanskrit, grammar, panini, ashtadhyayi, vyakarana, linguistics]
datings:
  - method: linguistic
    range: { earliest: "600 BCE", latest: "350 BCE", best: "400 BCE", precision: century, circa: true }
    grade: C
    label: Mainstream scholarly dating of the Aṣṭādhyāyī
    sources: [src.cardona-1988-panini-work-traditions, src.katre-1987-astadhyayi-panini]
    note: Usually placed in the 5th or 4th century BCE, with some estimates reaching back to the 6th century from the state of the language described and from its place before the later grammatical commentators.
entities: [person.panini, text.ashtadhyayi, concept.vedic-sanskrit, text.vedangas]
readingLevel: adult
review: { status: draft, author: "codex-gpt-6" }
---

Imagine describing an entire language so completely that a patient reader could build any correct word from scratch, using fewer than four thousand short rules that fit in a few hours of recitation.
That is the ambition of the *Aṣṭādhyāyī* (अष्टाध्यायी, "Eight Chapters"), composed by the grammarian Pāṇini (पाणिनि), who is traditionally said to have come from Śalātura in Gandhara, in the far north-west [@src.cardona-1988-panini-work-traditions; @src.katre-1987-astadhyayi-panini].
Scholars commonly place him in the 5th or 4th century BCE, but the evidence does not fix a precise year; this is a debated linguistic and historical estimate [@src.cardona-1988-panini-work-traditions; @src.katre-1987-astadhyayi-panini].

## A grammar built like a program

The text has eight chapters, each split into four quarters, and holds roughly four thousand rules (*sūtras*), the exact count varying slightly between transmitted versions [@src.katre-1987-astadhyayi-panini].
It does not list words.
It works as a derivation machine: you start with a root (see [the article on verbal roots](/archive/article/language/dhatu-the-verbal-roots)) and an affix, apply rules in a fixed order, and a finished word comes out [@src.cardona-1988-panini-work-traditions; @src.kiparsky-2009-architecture-paninis-grammar].
The grammar also records where the older Vedic language differs from the speech of Pāṇini's own day, including the pitch accents of Vedic recitation [@src.katre-1987-astadhyayi-panini; @src.cardona-1988-panini-work-traditions].
It is one of the six Vedāṅgas, the "limbs of the Veda", and Pāṇini names a number of earlier grammarians whose work he built on [@src.cardona-1988-panini-work-traditions].

## Sounds first: the fourteen lines

Everything starts with a list of sounds, the *Māheśvara* or *Śiva Sūtras* (माहेश्वरसूत्राणि).
Later tradition says the god Śiva sounded his drum fourteen times and Pāṇini heard the sounds as fourteen lines.
Historians instead ask whether Pāṇini devised the arrangement or adapted an older list, a question the scholarship discusses without a settled answer [@src.cardona-1988-panini-work-traditions].

| Line | Sounds | Closing marker |
|---|---|---|
| 1 | a i u | ṇ |
| 2 | ṛ ḷ | k |
| 3 | e o | ṅ |
| 4 | ai au | c |
| 5 | ha ya va ra | ṭ |
| 6 | la | ṇ |
| 7 | ña ma ṅa ṇa na | m |
| 8 | jha bha | ñ |
| 9 | gha ḍha dha | ṣ |
| 10 | ja ba ga ḍa da | ś |
| 11 | kha pha cha ṭha tha ca ṭa ta | v |
| 12 | ka pa | y |
| 13 | śa ṣa sa | r |
| 14 | ha | l |

The last consonant of each line is a silent marker (*it*), not a real sound of the language; a rule says a final consonant is such a marker and another says that markers are dropped [@src.katre-1987-astadhyayi-panini, rules 1.3.3, 1.3.9].
The marker ṇ appears in both line 1 and line 6, an economy that depends on context to be read correctly [@src.cardona-1988-panini-work-traditions].

The trick is a rule that lets you name a whole stretch of the list by its first sound plus a marker: the first sound together with the last marker stands for every sound in between, while the marker itself is excluded [@src.katre-1987-astadhyayi-panini, rules 1.1.71].
These abbreviations are called *pratyāhāras*.

| Abbreviation | Reads as | Covers |
|---|---|---|
| aC (अच्) | a up to marker c in line 4 | all vowels: a i u ṛ ḷ e o ai au |
| haL (हल्) | h of line 5 up to l in line 14 | all consonants |
| iK (इक्) | i up to k in line 2 | i u ṛ ḷ |
| yaṆ (यण्) | y up to ṇ in line 6 | y v r l, the semivowels |

Two syllables thus replace a list of nine, or of thirty-odd, sounds.
Careful readers have noted that this is set notation in all but name, though the analogy is ours, not Pāṇini's [@src.staal-1988-universals].

## A rule at work: *iko yaṇaci*

The rule *iko yaṇaci* (इको यणचि, 6.1.77) is three words long.
Read with the abbreviations above it means: i, u, ṛ or ḷ (*ik*) are replaced by y, v, r or l (*yaṇ*) when a vowel (*ac*) follows [@src.katre-1987-astadhyayi-panini, rules 6.1.77].
The correspondence is positional: i goes to y, u to v, ṛ to r, ḷ to l.

- *iti* + *āha* becomes *ityāha* ("so he said"): i turns into y before the vowel ā.
- *su* + *āgatam* becomes *svāgatam* ("welcome").

The rule does not stand alone.
When the following vowel is the same as the one that precedes it, another rule (6.1.101) lengthens instead, so *iti* + *iha* gives *itīha* and not *ityiha* [@src.katre-1987-astadhyayi-panini, rules 6.1.101].
The grammar therefore needs a principle for deciding which rule wins when two apply at once.

## The machinery that keeps it short

Pāṇini's economy comes from a handful of devices [@src.cardona-1988-panini-work-traditions; @src.kiparsky-2009-architecture-paninis-grammar]:

- **Technical terms** (*saṃjñā*) defined once and used everywhere.
- **Carry-over** (*anuvṛtti*): a rule inherits words from earlier rules, so later rules can be a single word long. A heading rule (*adhikāra*) governs everything that follows it.
- **Meta-rules** (*paribhāṣā*) that say how the other rules are to be read.
- **Ordering.** The rule *vipratiṣedhe paraṃ kāryam* (1.4.2) is traditionally read to give precedence to the later of two conflicting rules. The *tripādī* (Aṣṭādhyāyī 8.2-8.4) is treated as *asiddha*, or unavailable for certain operations in the preceding portion; these interacting principles make rule ordering more subtle than a simple left-to-right algorithm [@src.katre-1987-astadhyayi-panini, rules 1.4.2, 8.2.1].

The price of this brevity is that the text cannot be read without a commentary.
Katyāyana's *vārttikas* and Patañjali's *Mahābhāṣya* (the "Great Commentary", of the 2nd century BCE) began that work, and a long line of commentators followed [@src.cardona-1988-panini-work-traditions].

## How formal was it? Separating claims from evidence

Pāṇini's grammar is widely admired by modern linguists, and that admiration sometimes grows into claims no source supports.
Popular summaries call it the first "Turing-complete" grammar or credit particular modern scientists with saying so; we found no scholarly source making that claim in a checkable form, so it is not repeated here.
What is documented is narrower and still remarkable:

- The grammar is explicit, ordered and economical enough that scholars compare its architecture with modern generative frameworks, with each part of the derivation (meaning-to-relation, relation-to-form, form-to-sound) handled by distinct rule blocks [@src.kiparsky-2009-architecture-paninis-grammar; @src.staal-1988-universals].
- Hyman showed that the sandhi (sound-joining) rules can be translated directly into finite-state machines, the same model used in practical computing today [@src.hyman-2009-paninian-sandhi-finite-state].

How conflicts should be resolved has a long interpretive history.
Rishi Rajpopat's 2023 article examines Kātyāyana's and Patañjali's treatment of *nitya* and *antaraṅga* as conflict-resolution tools.
In his Cambridge dissertation, Rajpopat argues that 1.4.2 resolves conflicts between operations on different elements, while more specific rules resolve conflicts on the same element; this is a distinct modern interpretation, not a settled replacement for the traditional reading [@src.rajpopat-2023-conflict-resolution-tools; @src.rajpopat-2021-in-panini-we-trust].

## Where scholars disagree and what is settled

- **Date.** The mainstream range is 5th to 4th century BCE, based on the language described and on his place before Katyāyana and Patañjali [@src.cardona-1988-panini-work-traditions]. Traditional accounts of Pāṇini's life are later, and the date should be read as a range, not a year.
- **Origin of the sound list.** Pāṇini's own authorship of the fourteen lines is debated; the tradition's story of Śiva's drum is a statement of reverence for the sounds, not a historical claim [@src.cardona-1988-panini-work-traditions].
- **Modern analogies.** Comparisons with algebra, set theory, programming languages or Backus-Naur notation illuminate the design, but they are modern analogies about the text and were not intended by its author [@src.staal-1988-universals].

What is not in dispute is the achievement: a compact, systematic description of a language by explicit rules, composed more than two thousand years ago.
