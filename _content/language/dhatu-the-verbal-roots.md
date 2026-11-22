---
title: "Dhātu: The Verbal Roots of Sanskrit"
summary: "How Sanskrit grammar treats the verbal root (dhātu) as the starting point of word-building: the Dhātupāṭha list, the ten conjugation classes (gaṇas), a worked derivation of bhavati, and the old debate on whether all nouns come from verbs."
date: "2026-11-21"
tags: [sanskrit, grammar, dhatu, roots, verbs, panini, vyakarana]
datings:
  - method: linguistic
    range: { earliest: "500 BCE", latest: "350 BCE", best: "400 BCE", precision: century, circa: true }
    grade: B
    label: Root-and-affix system as used in Pāṇini's grammar
    sources: [src.cardona-1988-panini-work-traditions, src.katre-1987-astadhyayi-panini]
    note: Dates the grammar that relies on the root list. The transmitted Dhātupāṭha was copied and revised over later centuries and is not dated here.
entities: [person.panini, text.ashtadhyayi, text.nirukta, concept.vedic-sanskrit]
readingLevel: adult
review: { status: draft, author: "codex-gpt-6" }
---

Take the Sanskrit word *bhavati* (भवति, "he is; it becomes").
Its present stem is *bhava-* and its ending is *-ti*; the stem is built from the root *bhū* (भू, "be, become") with further grammatical changes.
The relation is not a matter of simply cutting the word into pieces: the grammar specifies how the root, present-class marker and ending combine.
This kind of grammatical root is a *dhātu* (धातु), the starting point for much of Sanskrit verbal morphology [@src.katre-1987-astadhyayi-panini, rules 3.1.68, 7.3.84, 6.1.78].

## What a dhātu is

Pāṇini defines the *dhātu* by pointing at a list: rule 1.3.1 says, in effect, that *bhū* and the other items beginning with it are dhātus [@src.katre-1987-astadhyayi-panini, rules 1.3.1].
That list is the *Dhātupāṭha* (धातुपाठ), a catalogue of roots each with a short gloss, beginning with *bhū sattāyām*, "bhū, in the sense of being".
The transmitted list contains roughly two thousand roots, and the exact count differs between versions [@src.cardona-1988-panini-work-traditions].
Tradition ascribes the list to Pāṇini himself; the scholarly view is that the grammar presupposes such a list and that the text we have was transmitted and revised afterwards, so its exact wording cannot be placed in his time [@src.cardona-1988-panini-work-traditions].

Roots in this sense are a description, not an excavation of prehistory.
Dhātus are not "irreducible atoms" either, because the grammar lets new dhātus be derived from old ones: a causative, desiderative or intensive stem formed from a root is itself called a dhātu (rule 3.1.32) [@src.katre-1987-astadhyayi-panini, rules 3.1.32].
Whitney's survey of the roots, verb-forms and derivatives found in the literature remains a useful check on the list, and it shows that many of the listed roots are barely or never attested outside the grammatical tradition [@src.whitney-1885-roots-verb-forms].

## Ten classes, one idea

Before the personal endings of the present system are added, a root receives a small element, the *vikaraṇa*, that shapes its stem.
The Dhātupāṭha sorts roots into ten groups, *gaṇas*, by that element, and each group is named after its first root [@src.katre-1987-astadhyayi-panini, rules 3.1.68-81, 2.4.72, 2.4.75, 3.1.25].

| Gaṇa | Named after | Stem formation | Example |
|---|---|---|---|
| 1 Bhvādi | bhū | -a- (after strengthening) | bhū to *bhavati* |
| 2 Adādi | ad | no element; ending added to the bare root | ad to *atti* |
| 3 Juhotyādi | hu | no element, root is reduplicated | hu to *juhoti* |
| 4 Divādi | div | -ya- | div to *dīvyati* |
| 5 Svādi | su | -nu- | su to *sunoti* |
| 6 Tudādi | tud | -a- (no strengthening) | tud to *tudati* |
| 7 Rudhādi | rudh | infix -na- inside the root | rudh to *ruṇaddhi* |
| 8 Tanādi | tan | -u- | tan to *tanoti*; kṛ to *karoti* |
| 9 Krīyādi | krī | -nā- | krī to *krīṇāti* |
| 10 Curādi | cur | -aya- | cur to *corayati* |

A point of precision: these classes determine the stem only in the "present system" (present, imperfect, imperative and optative forms).
The gaṇa primarily identifies how the present stem is formed.
The perfect, aorist and future have their own formations, so a learner cannot mechanically carry a present-class marker into every tense [@src.cardona-1988-panini-work-traditions].

## Building one verb, step by step

Here is *bhavati* as a derivation, in the order Pāṇini's rules apply.
Each line is a rule from the grammar [@src.katre-1987-astadhyayi-panini, rules 3.2.123, 3.4.78, 3.1.68, 7.3.84, 6.1.78]:

| Step | What happens | Result |
|---|---|---|
| 1 | Root *bhū*; the meaning "present" calls for the present-tense affix (3.2.123) | bhū + laṬ |
| 2 | laṬ is replaced by the third-person singular ending *ti* (3.4.78) | bhū + ti |
| 3 | The vikaraṇa śap (-a-) is inserted for active verbs (3.1.68) | bhū + a + ti |
| 4 | The root vowel is strengthened (guṇa), ū becoming o (7.3.84) | bho + a + ti |
| 5 | o before a vowel becomes av (6.1.78) | bhav + a + ti |
| 6 | Result | *bhavati* |

Other common roots have special present forms: *gam* becomes *gaccha-* under 7.3.77, while 7.3.78 gives special forms such as *tiṣṭha-* from *sthā* and *paśya-* from *dṛś* [@src.katre-1987-astadhyayi-panini, rules 7.3.77-78].

## Ten roots and the words they grow

| Root | Class | Meaning | Present, 3rd singular | Some derived words |
|---|---|---|---|---|
| bhū | 1 | be, become | bhavati | bhāva (state), bhūta |
| gam | 1 | go | gacchati | gati (movement), āgata (arrived) |
| kṛ | 8 | do, make | karoti | karman (action), kriyā (deed), kāraka |
| jñā | 9 | know | jānāti | jñāna (knowledge) |
| dṛś | 1 | see | paśyati | darśana (sight, viewpoint), dṛṣṭi |
| vad | 1 | speak | vadati | vāda (debate), saṃvāda (dialogue) |
| sthā | 1 | stand | tiṣṭhati | sthāna (place), sthiti (stability) |
| dā | 3 | give | dadāti | dāna (gift), dātṛ (giver) |
| yuj | 7 | join | yunakti, yuṅkte | yoga (union), yukti (reasoning) |
| vid | 2 | know | vetti | veda (knowledge), vidyā (learning) |

The class and present forms in this table follow the grammatical tradition; the root glosses are concise teaching labels, not full dictionary definitions [@src.katre-1987-astadhyayi-panini; @src.whitney-1885-roots-verb-forms].

Two cautions: the Dhātupāṭha lists more than one *yuj* (a second, in the fourth class, with the sense of concentration) and more than one *vid*, so a word like *yoga* may be traced to either by different commentators [@src.cardona-1988-panini-work-traditions].
The derived words are the standard ones given in grammatical tradition; the meanings shown are glosses, not complete definitions.

## An old argument: do all nouns come from verbs?

The idea that roots lie behind words is older than Pāṇini.
Yāska's *Nirukta*, a text on word origins that reaches us in a form older than the *Aṣṭādhyāyī*, reports a dispute: Śākaṭāyana and the etymologists hold that all nouns are derived from verbs, while Gārgya and some grammarians deny that this holds for all of them [@src.sarup-1920-nighantu-nirukta, "Nirukta 1.12"].
Gārgya's objection is practical: many words, such as names of things, do not obviously express an action.
The grammar tradition's answer was to give many nouns a root-based derivation anyway, and the dispute is a good reminder that "every word has a root" was a claim argued for, not an obvious fact.

## Where scholars disagree

- **Dhātupāṭha and Pāṇini.** Tradition gives Pāṇini the list; scholars treat the present text as a transmitted and revised work [@src.cardona-1988-panini-work-traditions].
- **Roots as history or as description.** Sanskrit grammarians assign roots by form and meaning for the sake of deriving words. A root in this sense need not coincide with a reconstructed root of the older ancestor language, and Whitney's attestation-based approach shows the gap between the list and actual usage [@src.whitney-1885-roots-verb-forms].
- **Meaning.** The one-line glosses in the Dhātupāṭha are brief, and different roots often share a gloss, so deriving a word's meaning from its root is better treated as a guide than a proof [@src.cardona-1988-panini-work-traditions].

The idea is still useful for a learner: once you know a few hundred roots and the ten classes, a large share of Sanskrit's verbal vocabulary stops looking like a list and starts looking like a system [@src.kiparsky-2009-architecture-paninis-grammar].
