---
title: "The Eight Cases of Sanskrit"
summary: "Sanskrit nouns change their endings to show their job in a sentence. This article explains the seven cases and the vocative, how Panini's karakas relate to them, and why the match is not one to one."
date: "2026-11-21"
tags: [sanskrit, grammar, morphology, vibhakti, karaka, panini]
datings:
  - method: linguistic
    range: { earliest: "600 BCE", latest: "350 BCE", best: "400 BCE", precision: century, circa: true }
    grade: C
    label: "Panini's Ashtadhyayi, mainstream Indological dating"
    note: "The grammar that defines the case system and the karaka relations; dated from the state of the language it describes."
    sources: [src.cardona-1988-panini-work-traditions, src.katre-1987-astadhyayi-panini]
entities: [text.ashtadhyayi, person.panini, concept.vedic-sanskrit, text.rigveda]
readingLevel: adult
review: { status: draft, author: "claude-sonnet-5-5" }
---

In English, word order tells you who did what: "the dog bit the man" is not "the man bit the dog".
In Sanskrit, the endings do the work, and word order is free.
Learn the eight cases and you can read a sentence whichever way its words are shuffled.

## Cases and what they are for

A Sanskrit noun stem has forms for three numbers (singular, dual, plural) and, by the traditional count, eight sets of case endings. [@src.whitney-1896-sanskrit-grammar; @src.macdonell-1927-sanskrit-grammar-for-students]
The word for case is *vibhakti* (विभक्ति), "division" or "share".
Traditional grammar numbers them one to seven, called *prathamā* ("first") to *saptamī* ("seventh"), and adds the vocative, *sambodhana*, as an eighth.

| Case | Sanskrit name | Core function | English prompt |
|---|---|---|---|
| 1 | *prathamā* (प्रथमा) | subject; naming | who or what? |
| 2 | *dvitīyā* (द्वितीया) | object; goal of motion; extent | whom, what, to where? |
| 3 | *tṛtīyā* (तृतीया) | instrument; accompaniment; agent of a passive verb | by or with what? |
| 4 | *caturthī* (चतुर्थी) | recipient; purpose | to or for whom? |
| 5 | *pañcamī* (पञ्चमी) | source; point of departure | from where or whom? |
| 6 | *ṣaṣṭhī* (षष्ठी) | relation, possession | whose? |
| 7 | *saptamī* (सप्तमी) | place; time; the sphere in which something occurs | in, on, at what? |
| 8 | *sambodhana* (सम्बोधन) | calling or addressing | O ...! |

Panini lists seven case sets and treats the vocative as a use of the first, with the rule that the first case also appears "in address" (A 2.3.47). [@src.katre-1987-astadhyayi-panini]
Counting it as an eighth is a teaching convention, not a disagreement about the forms.

## One stem, all its forms: *rāma*

The masculine stem *rāma*, "Rama", is the standard model for the large class of nouns ending in short *a*. [@src.macdonell-1927-sanskrit-grammar-for-students]

| Case | Singular | Dual | Plural |
|---|---|---|---|
| Nominative | *rāmaḥ* | *rāmau* | *rāmāḥ* |
| Accusative | *rāmam* | *rāmau* | *rāmān* |
| Instrumental | *rāmeṇa* | *rāmābhyām* | *rāmaiḥ* |
| Dative | *rāmāya* | *rāmābhyām* | *rāmebhyaḥ* |
| Ablative | *rāmāt* | *rāmābhyām* | *rāmebhyaḥ* |
| Genitive | *rāmasya* | *rāmayoḥ* | *rāmāṇām* |
| Locative | *rāme* | *rāmayoḥ* | *rāmeṣu* |
| Vocative | *rāma* | *rāmau* | *rāmāḥ* |

Two patterns will save you effort.
In the dual there are only three distinct endings across all the cases: *-au* (nominative, accusative, vocative), *-bhyām* (instrumental, dative, ablative) and *-oḥ* (genitive, locative).
In the plural, dative and ablative are always identical.
The same set of endings with small adjustments underlies the other stem classes, such as feminine *-ā* stems (*latā*, "creeper") and neuter *-a* stems (*phala*, "fruit"); the neuter has *phalam* for both nominative and accusative singular. [@src.whitney-1896-sanskrit-grammar]

The forms above are Classical.
Older Vedic Sanskrit keeps some alternatives, such as nominative plural *devāsaḥ* beside *devāḥ*, and instrumental plural *devebhiḥ* beside *devaiḥ*. [@src.macdonell-1927-sanskrit-grammar-for-students; @src.whitney-1896-sanskrit-grammar]
The first line of the Rigveda shows the accusative at work: *agním īḷe* ("I praise Agni"), where *agnim* is the object of the verb. [@src.jamison-brereton-2014-rigveda, RV 1.1.1]

## From case to karaka

Panini's grammar goes beyond listing endings.
It asks what the noun is doing relative to the action of the verb, and gives six roles called *kārakas* (कारक), from the root meaning "to do".
In outline, each is defined by a short rule of the Ashtadhyayi. [@src.katre-1987-astadhyayi-panini; @src.cardona-1988-panini-work-traditions]

| Kāraka | Meaning | Defining rule | Usual case |
|---|---|---|---|
| *kartṛ* | the independent agent | *svatantraḥ kartā* (A 1.4.54) | nominative (active), instrumental (passive) |
| *karman* | what the agent most wants to reach | *kartur īpsitatamaṃ karma* (A 1.4.49) | accusative (active), nominative (passive) |
| *karaṇa* | the most effective means | *sādhakatamaṃ karaṇam* (A 1.4.42) | instrumental |
| *sampradāna* | the one aimed at by the giving | A 1.4.32 | dative |
| *apādāna* | the fixed point from which separation occurs | *dhruvam apāye 'pādānam* (A 1.4.24) | ablative |
| *adhikaraṇa* | the support or location | *ādhāro 'dhikaraṇam* (A 1.4.45) | locative |

The genitive is deliberately missing.
Panini assigns the sixth case to the "remainder", the relations not involving a verb (A 2.3.50), which is why teaching tables list it as a relation (*sambandha*) and not a kāraka. [@src.katre-1987-astadhyayi-panini]

## Why case and karaka are not the same thing

It is tempting to say "nominative equals agent, accusative equals object".
Panini's system is subtler.
Kārakas are roles in a sentence's meaning; cases are endings on words.
The grammar links them through rules, such as the one that applies a case only when the role is not already expressed by the verb itself (A 2.3.1). [@src.katre-1987-astadhyayi-panini]

The consequence shows in the passive:

- Active: *rāmaḥ phalaṃ khādati*, "Rama eats the fruit." The agent is in the nominative and the object in the accusative.
- Passive: *rāmeṇa phalaṃ khādyate*, "The fruit is eaten by Rama." The same agent now takes the instrumental; the object takes the nominative.

The kāraka roles are unchanged, but the cases shift, because the verb now "expresses" a different role in its own ending. [@src.katre-1987-astadhyayi-panini; @src.cardona-1988-panini-work-traditions]

Another wrinkle: some cases are demanded not by the verb but by a particular word nearby, such as *namaḥ* ("homage") with the dative, as in *gurave namaḥ*, "homage to the teacher" (A 2.3.16), or *saha* ("with") with the instrumental (A 2.3.19). [@src.katre-1987-astadhyayi-panini]

Modern linguists read the kāraka system as an early account of what is now called thematic or semantic roles, and Paul Kiparsky has argued that it works as an intermediate level between meaning and form. [@src.kiparsky-2009-architecture-paninis-grammar]
That reading is a scholarly interpretation, not a settled consensus, and some historians of linguistics emphasise how different the Panini framework is from modern role theory. [@src.cardona-1988-panini-work-traditions]

## A worked example: Bhagavad Gita 2.47

*karmaṇy evādhikāras te mā phaleṣu kadācana* [@src.vanbuitenen-1981-bhagavadgita-mahabharata, BG 2.47]

| Word | Form | Role in the sentence |
|---|---|---|
| *karmaṇi* | locative singular of *karman*, "action" | the sphere to which the entitlement is limited |
| *eva* | particle | "alone" |
| *adhikāraḥ* | nominative singular | the thing asserted: "entitlement" |
| *te* | genitive (enclitic) singular of *tvam*, "you" | "your" |
| *phaleṣu* | locative plural of *phala*, "fruit" | the sphere denied: "in the fruits" |

Read with the case roles in mind, the sentence says: "Your entitlement is in action alone, never in the fruits."
The two locatives, singular and plural, set the two spheres against each other.
Translators render the locative with different English prepositions ("to", "in", "over"), so for the exact shade of meaning compare more than one translation.

## What this gives a reader

If you can identify the case, you can often reconstruct the meaning without word order or vocabulary.
Learn the *rāma* table cold, learn the six kāraka roles with their questions, and then watch for the places where Panini says the ending is not the role.
