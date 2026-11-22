---
title: "Sandhi: How Sanskrit Sounds Join"
summary: "Sandhi is the set of sound changes that occur where Sanskrit words and word-parts meet. This article explains the vowel, consonant and visarga rules, how Panini described them, and works through Bhagavad Gita 2.47."
date: "2026-11-21"
tags: [sanskrit, grammar, phonology, sandhi, panini]
datings:
  - method: linguistic
    range: { earliest: "600 BCE", latest: "350 BCE", best: "400 BCE", precision: century, circa: true }
    grade: B
    label: "Panini's Ashtadhyayi, mainstream Indological dating"
    note: "The grammar that formalises Sanskrit sandhi; dated from the state of the language it describes and its place before Katyayana and Patanjali."
    sources: [src.cardona-1988-panini-work-traditions, src.katre-1987-astadhyayi-panini]
entities: [text.ashtadhyayi, person.panini, concept.vedic-sanskrit]
readingLevel: adult
review: { status: draft, author: "claude-sonnet-5-5" }
---

Say the English phrase "did you" quickly and it becomes "didja".
Nobody planned that; your mouth took the shortest path between two sounds.
Sanskrit does the same thing, but with one remarkable difference: it wrote the result down, and made it a rule.
The name for these rules is *sandhi* (सन्धि), "putting together" or "joining".

## What sandhi is

Sandhi covers the regular sound changes that happen where two units meet.
When the meeting point is inside a word, between a root and a suffix for example, grammarians speak of internal sandhi.
When it is between two separate words, it is external sandhi.
In Sanskrit the external kind is usually obligatory within a phrase or verse line, and it is what makes a Sanskrit text look like one long chain of sound. [@src.whitney-1896-sanskrit-grammar; @src.macdonell-1927-sanskrit-grammar-for-students]

Panini's own term for the close, uninterrupted utterance in which these changes apply is *saṃhitā*, defined as the "closest proximity" of sounds [@src.katre-1987-astadhyayi-panini, A 1.4.109].
The word *sandhi* is the one that stuck in later grammar and in teaching today.

Sandhi is a spelling of sound, not a puzzle for its own sake.
The same rules are why Vedic chanters kept two parallel recitation forms of the Vedic hymns: the continuous *saṃhitā* text, where sandhi has applied, and a word-by-word *pada* text in which the words are separated again. [@src.whitney-1896-sanskrit-grammar]

## The three families

Traditional teaching sorts sandhi by the kind of sound at the boundary.

| Family | Boundary | Plain description |
|---|---|---|
| Svara sandhi | vowel meets vowel | vowels merge, change into a glide, or both |
| Vyañjana sandhi | consonant meets consonant or vowel | consonants adjust to voicing and place of their neighbour |
| Visarga sandhi | the breath sound *ḥ* at the end of a word | *ḥ* becomes *o*, *r*, *s* or disappears, depending on its neighbours |

The rules are old and have exceptions, but the core is small enough to learn.

## Vowel sandhi

Five patterns cover most cases. [@src.katre-1987-astadhyayi-panini; @src.macdonell-1927-sanskrit-grammar-for-students]

| Pattern | Input | Result | Example | Panini |
|---|---|---|---|---|
| Similar vowels merge into one long vowel | *a/ā + a/ā*, *i/ī + i/ī*, *u/ū + u/ū* | *ā*, *ī*, *ū* | *vidyā + ālayaḥ* → *vidyālayaḥ* | A 6.1.101 |
| Guṇa | *a/ā* + *i/ī*, *u/ū*, *ṛ* | *e*, *o*, *ar* | *mahā + īśaḥ* → *maheśaḥ*; *sūrya + udayaḥ* → *sūryodayaḥ* | A 6.1.87 |
| Vṛddhi | *a/ā* + *e/ai*, *o/au* | *ai*, *au* | *sadā + eva* → *sadaiva*; *mahā + auṣadhiḥ* → *mahauṣadhiḥ* | A 6.1.88 |
| Yaṇ: a glide replaces the first vowel | *i/ī*, *u/ū*, *ṛ* + a different vowel | *y*, *v*, *r* | *iti + āha* → *ityāha*; *anu + ayaḥ* → *anvayaḥ* | A 6.1.77 |
| Ayādi: *e, o, ai, au* turn into *ay, av, āy, āv* | *e, o, ai, au* + any vowel | *ay, av, āy, āv* | *ne + anam* → *nayanam*; *po + anaḥ* → *pavanaḥ* | A 6.1.78 |

The names are Panini's.
*Guṇa* and *vṛddhi* are the grammarians' labels for "grade" vowels, and the sutras that name them (A 1.1.1 and 1.1.2) are the first two rules of the grammar. [@src.katre-1987-astadhyayi-panini]

There are exceptions worth knowing early.
Dual endings in *-ī*, *-ū* and *-e* are *pragṛhya*, "held apart": they do not undergo vowel sandhi, so *harī etau* ("these two Haris") stays as two words (A 1.1.11).
And final *e* or *o* before short *a* keeps its shape while the *a* is dropped and marked with an apostrophe-like sign, the *avagraha* (ऽ): *vane + atra* → *vane 'tra* (A 6.1.109). [@src.katre-1987-astadhyayi-panini]

## Consonant sandhi

Consonant sandhi follows one broad principle: at a boundary, a consonant takes on the voicing, and often the place of articulation, of the sound next to it.
Voiceless becomes voiced before a voiced sound, and the reverse. [@src.whitney-1896-sanskrit-grammar]

Two familiar examples:

- *jagat + īśaḥ* → *jagadīśaḥ*: the final *t* is voiced to *d* before a vowel.
- *sat + janaḥ* → *sajjanaḥ*: the *t* merges into the following palatal *j*.

Final consonants are also reduced in isolation.
A Sanskrit word cannot end in just any consonant; the language permits only a small set at the end of a word, which is why the nominative of *vāc* ("speech") is *vāk*. [@src.whitney-1896-sanskrit-grammar]

## Visarga sandhi

The visarga (*ḥ*, ः) is a breathy sound at the end of a word, most often the trace of an old final *s* or *r*.
Its behaviour is the most visible sandhi to a beginner, because the nominative singular of every masculine *-a* noun ends in it. [@src.macdonell-1927-sanskrit-grammar-for-students]

The most useful rules:

- *-aḥ* before *a* → *-o '*: *naraḥ + ayam* → *naro 'yam*.
- *-aḥ* before a voiced consonant → *-o*: *rāmaḥ + gacchati* → *rāmo gacchati*. The two steps are described in A 6.1.113 and 6.1.114.
- *-aḥ* before *t* → *-as*: *adhikāraḥ + te* → *adhikāras te*.
- After vowels other than *a*, a visarga before a voiced sound becomes *r*: *hariḥ + asti* → *harir asti*.

[@src.katre-1987-astadhyayi-panini; @src.whitney-1896-sanskrit-grammar]

## Reading a real line: Bhagavad Gita 2.47

The verse, in the transmitted text, reads:

> *karmaṇy evādhikāras te mā phaleṣu kadācana |*
> *mā karmaphalahetur bhūr mā te saṅgo 'stv akarmaṇi ||*

[@src.vanbuitenen-1981-bhagavadgita-mahabharata, BG 2.47]

Undoing the sandhi step by step gives the words as a grammar would list them.

| In the verse | Separate words | Rule at work |
|---|---|---|
| *karmaṇy eva* | *karmaṇi + eva* | *i* before a different vowel becomes *y* (yaṇ) |
| *evādhikāraḥ* | *eva + adhikāraḥ* | *a + a* merge to long *ā* |
| *adhikāras te* | *adhikāraḥ + te* | visarga before *t* becomes *s* |
| *hetur bhūr mā* | *hetuḥ + bhūḥ + mā* | visarga after *u* or *ū* before a voiced sound becomes *r* |
| *saṅgo 'stv akarmaṇi* | *saṅgaḥ + astu + akarmaṇi* | *aḥ + a* gives *o '*; then *u + a* gives *v + a* |

The result is a verse that reads as four smooth strings of sound, yet each string can be taken apart again by rule.
That reversibility is the point: with the rules, a reader can recover the words, and so the meaning.
A rough rendering of the verse: "Your entitlement is to action alone, never to its fruits; do not let the fruit of action be your motive, and do not let your attachment be to inaction."
Translators differ on shades of meaning, so compare more than one; the standard annotated rendering used here is van Buitenen's. [@src.vanbuitenen-1981-bhagavadgita-mahabharata, BG 2.47]

## What sandhi cannot tell you

Sandhi is many-to-one.
Different inputs can produce the same output, so a reader sometimes has to choose.
For example, a long *ā* can come from any of four pairs (*a + a*, *a + ā*, *ā + a*, *ā + ā*), so *vidyālayaḥ* could in principle be split in more than one way; context and vocabulary decide.
This is why Sanskrit readers learn to split words by meaning as much as by sound. [@src.whitney-1896-sanskrit-grammar]

## How Panini organised the rules

Panini did not present sandhi as a chapter.
The sandhi rules are spread across the grammar, mostly in its sixth and eighth chapters, and are ordered so that a rule in the last part of the text may undo or refine the output of an earlier one.
The ordering principle is stated in the grammar itself: when two rules conflict, the one later in the sequence wins (A 1.4.2).
Modern linguists such as Paul Kiparsky have studied how this ordering lets a compact set of rules derive correct forms, and treat it as a precursor of rule-ordered phonology. [@src.katre-1987-astadhyayi-panini; @src.kiparsky-2009-architecture-paninis-grammar; @src.cardona-1988-panini-work-traditions]

The grammar is dated by most scholars to the fifth or fourth century BCE, though the range of proposals is wider. [@src.cardona-1988-panini-work-traditions]
It also records Vedic usage where it differs from the spoken Sanskrit of its own day, so sandhi in the Vedic hymns can differ in details from Classical practice. [@src.katre-1987-astadhyayi-panini; @src.macdonell-1927-sanskrit-grammar-for-students]

## Where to go next

Learn the five vowel patterns first, then the *-aḥ* visarga rules, then consonant voicing.
Read slowly, with a text that gives both the joined and the split form.
